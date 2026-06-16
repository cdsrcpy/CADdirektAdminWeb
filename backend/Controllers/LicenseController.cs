using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Dapper;
using System.Data;
using System.IO;
using System.Text;
using System.Runtime.Serialization.Formatters.Binary;
using CADdirektAdmin.API.Models;

namespace CADdirektAdmin.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class LicenseController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public LicenseController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("DefaultConnection") 
                   ?? "Data Source=103.14.120.147,34569;Initial Catalog=msdirekt;User ID=dokum_sa;Password=@bjectARX1$;TrustServerCertificate=True;";
        }

        [HttpGet("subscriptions")]
        public async Task<IActionResult> GetSubscriptions([FromQuery] string serialNo)
        {
            if (string.IsNullOrEmpty(serialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var results = await connection.QueryAsync<SubscriptionRow>(
                    "[dokum_msa].[LoadSubscriptions]", 
                    new { SM_SERIALNO = serialNo }, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load subscriptions.", details = ex.Message });
            }
        }

        [HttpPost("extend")]
        public async Task<IActionResult> ExtendLicense([FromBody] ExtendLicenseRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Valid serial number and details are required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                // 1. Insert new subscription
                var parameters = new DynamicParameters();
                parameters.Add("@SM_SERIALNO", request.SerialNo);
                parameters.Add("@SD_DAYS", request.Days);
                parameters.Add("@SD_MODE", request.Mode);
                parameters.Add("@SD_STATUS", request.Status);
                parameters.Add("@SD_VERSION", request.Version);
                parameters.Add("@SD_STARTDATE", string.IsNullOrEmpty(request.StartDate) ? null : request.StartDate);
                parameters.Add("@SD_REMARKS", request.Remarks ?? "");

                await connection.ExecuteAsync(
                    "[dokum_msa].[InsertSubscriptions]", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );

                // 2. If Offline mode (Mode = 1), compile the .lic file
                if (request.Mode == 1)
                {
                    // Query Mindate
                    var regDateObj = await connection.QueryFirstOrDefaultAsync<DateTime?>(
                        "SELECT [dokum_msa].udfGetMINDATE(@SerialNo)", 
                        new { SerialNo = request.SerialNo }
                    );
                    string regDateStr = regDateObj?.ToString("yyyy-MM-dd HH:mm:ss") ?? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

                    // Query Updated Total Days
                    int totalDays = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT [dokum_msa].udfGetTotalDays(@SerialNo)", 
                        new { SerialNo = request.SerialNo }
                    );

                    // Load Subscriptions to get SD_IDs
                    var sdList = await connection.QueryAsync<dynamic>(
                        "SELECT SD_ID, SD_VERSION FROM [dbo].[SubscriptionDetails] WHERE SD_SM_ID = (SELECT SM_ID FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @SerialNo)",
                        new { SerialNo = request.SerialNo }
                    );

                    string encryptPassword = "IndojinTech123$";
                    string serial = EncDec.Encrypt(request.SerialNo, encryptPassword);
                    string days = EncDec.Encrypt(totalDays.ToString(), encryptPassword);
                    string password = EncDec.Encrypt("", encryptPassword);
                    string regDate = EncDec.Encrypt(regDateStr, encryptPassword);
                    
                    var sdIdList = new List<string>();
                    var sdIdVerList = new List<string>();
                    foreach (var r in sdList)
                    {
                        string id = Convert.ToString(r.SD_ID) ?? "";
                        string ver = Convert.ToString(r.SD_VERSION) ?? "";
                        sdIdList.Add(id);
                        sdIdVerList.Add(EncDec.Encrypt(id + "," + ver, encryptPassword));
                    }
                    string[] sd_ids = sdIdList.ToArray();
                    string[] sd_ids_version = sdIdVerList.ToArray();

                    object[] licData = new object[] { serial, days, password, regDate, sd_ids, sd_ids_version };

                    #pragma warning disable SYSLIB0011 // BinaryFormatter serialization is obsolete
                    var formatter = new BinaryFormatter();
                    using var stream = new MemoryStream();
                    formatter.Serialize(stream, licData);
                    var fileBytes = stream.ToArray();
                    #pragma warning restore SYSLIB0011

                    return File(fileBytes, "application/octet-stream", $"{request.SerialNo}_{DateTime.Now:ddMMyyyyHHmmss}.lic");
                }

                return Ok(new { message = "License successfully extended." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to extend license.", details = ex.Message });
            }
        }

        [HttpGet("linked")]
        public async Task<IActionResult> GetLinkedLicenses([FromQuery] bool withTest = false)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var results = await connection.QueryAsync<LinkedLicenseRow>(
                    "[dokum_msa].[GETSERIALLINKN]", 
                    new { WITH_TEST = withTest ? 1 : 0 }, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load linked serial keys.", details = ex.Message });
            }
        }

        [HttpPost("deactivate")]
        public async Task<IActionResult> Deactivate([FromBody] SerialActionRequest request)
        {
            if (string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "update [dbo].[SerialKeyMaster] set SM_ISACTIVE = 0 where SM_SERIALNO = @SerialNo", 
                    new { SerialNo = request.SerialNo }
                );

                if (rows > 0)
                {
                    return Ok(new { message = "License deactivated successfully." });
                }
                return NotFound(new { message = "Serial key not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Deactivation failed.", details = ex.Message });
            }
        }

        [HttpPost("activate")]
        public async Task<IActionResult> Activate([FromBody] SerialActionRequest request)
        {
            if (string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "update [dbo].[SerialKeyMaster] set SM_ISACTIVE = 1 where SM_SERIALNO = @SerialNo", 
                    new { SerialNo = request.SerialNo }
                );

                if (rows > 0)
                {
                    return Ok(new { message = "License activated successfully." });
                }
                return NotFound(new { message = "Serial key not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Activation failed.", details = ex.Message });
            }
        }

        [HttpPost("reset-used")]
        public async Task<IActionResult> ResetUsed([FromBody] SerialActionRequest request)
        {
            if (string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "update [dbo].[SerialKeyMaster] set SM_ISUSED = 'False' where SM_SERIALNO = @SerialNo and SM_ISUSED = 'True'", 
                    new { SerialNo = request.SerialNo }
                );

                return Ok(new { message = "License usage successfully released.", rowsAffected = rows });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to release license usage status.", details = ex.Message });
            }
        }

        [HttpPost("update-text")]
        public async Task<IActionResult> UpdateText([FromBody] UpdateTextRequest request)
        {
            if (string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "update [dbo].[SerialKeyMaster] set SM_TEXT = @Text where SM_SERIALNO = @SerialNo", 
                    new { SerialNo = request.SerialNo, Text = request.Text ?? "" }
                );

                return Ok(new { message = "Remarks successfully updated.", rowsAffected = rows });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to update remarks.", details = ex.Message });
            }
        }

        [HttpPost("update-type")]
        public async Task<IActionResult> UpdateType([FromBody] UpdateTypeRequest request)
        {
            if (string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    @"update [dbo].[SerialKeyMaster] 
                      set SM_ISPERPETUAL = @IsPerpetual, 
                          SM_IGNOREPARENT = @IgnoreParent, 
                          SM_TOTALDAYS = @TotalDays 
                      where SM_SERIALNO = @SerialNo", 
                    new { 
                        SerialNo = request.SerialNo, 
                        IsPerpetual = request.IsPerpetual, 
                        IgnoreParent = request.IgnoreParent ? 1 : 0, 
                        TotalDays = request.TotalDays 
                    }
                );

                return Ok(new { message = "License parameters successfully updated.", rowsAffected = rows });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to update license parameters.", details = ex.Message });
            }
        }

        [HttpGet("deleted")]
        public async Task<IActionResult> GetDeletedLicenses([FromQuery] string? serialNo)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                string sql = @"
                    SELECT s.SM_SERIALNO, s.SM_ID, c.CD_ID, c.CD_USERNAME, c.CD_COMPANYNAME, c.CD_EMAIL, c.CD_PHONENO, c.CD_DATE 
                    FROM [dbo].[SerialKeyMaster] s 
                    INNER JOIN [dbo].[DeletedCustomerDetail] c ON s.SM_ID = c.CD_SERIAL_ID";

                if (!string.IsNullOrEmpty(serialNo))
                {
                    sql += " WHERE s.SM_SERIALNO = @SerialNo";
                }

                var results = await connection.QueryAsync<dynamic>(sql, new { SerialNo = serialNo });
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load deleted licenses.", details = ex.Message });
            }
        }

        [HttpGet("deleted/{serialNo}/subscriptions")]
        public async Task<IActionResult> GetDeletedSubscriptions(string serialNo)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var results = await connection.QueryAsync<dynamic>(
                    "dokum_msa.LoadDeletedSubscriptions", 
                    new { SM_SERIALNO = serialNo }, 
                    commandType: CommandType.StoredProcedure
                );
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load deleted subscriptions.", details = ex.Message });
            }
        }

        [HttpGet("restore")]
        public async Task<IActionResult> GetRestoreKeys([FromQuery] string appCode, [FromQuery] string version, [FromQuery] int num, [FromQuery] bool withTest = true)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var results = await connection.QueryAsync<dynamic>(
                    "dokum_msa.LoadSerialKeyMasterToRestore", 
                    new { 
                        SM_APPLICATION = appCode, 
                        SM_VERSION = version, 
                        num = num, 
                        with_test_lic = withTest ? 1 : 0 
                    }, 
                    commandType: CommandType.StoredProcedure
                );
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load backup keys.", details = ex.Message });
            }
        }

        [HttpPost("restore")]
        public async Task<IActionResult> RestoreKeys([FromBody] RestoreKeysRequest request)
        {
            if (request == null || request.Ids == null || request.Ids.Length == 0)
            {
                return BadRequest(new { message = "At least one key ID is required to restore." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                var table = new DataTable();
                table.Columns.Add("ID", typeof(int));
                foreach (var id in request.Ids)
                {
                    table.Rows.Add(id);
                }

                var parameters = new DynamicParameters();
                parameters.Add("@List", table.AsTableValuedParameter("dokum_msa.IDList"));

                var results = await connection.QueryAsync<dynamic>(
                    "dokum_msa.RestoreSerialKeyMaster", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(new { message = "Keys restored successfully.", restored = results });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Key restoration failed.", details = ex.Message });
            }
        }

        [HttpPut("subscriptions/{id}")]
        public async Task<IActionResult> UpdateSubscription(int id, [FromBody] UpdateSubscriptionRequest request)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "UPDATE [dbo].[SubscriptionDetails] SET SD_DAYS = @Days WHERE SD_ID = @Id", 
                    new { Id = id, Days = request.Days }
                );

                return Ok(new { message = "Subscription days updated successfully.", rowsAffected = rows });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to edit subscription.", details = ex.Message });
            }
        }

        [HttpDelete("subscriptions/{id}")]
        public async Task<IActionResult> DeleteSubscription(int id)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                int rows = await connection.ExecuteAsync(
                    "DELETE FROM [dbo].[SubscriptionDetails] WHERE SD_ID = @Id", 
                    new { Id = id }
                );

                return Ok(new { message = "Subscription deleted successfully.", rowsAffected = rows });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to delete subscription.", details = ex.Message });
            }
        }

        [HttpPost("link")]
        public async Task<IActionResult> LinkKeys([FromBody] LinkKeysRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.SourceSerial) || string.IsNullOrEmpty(request.TargetSerial))
            {
                return BadRequest(new { message = "Source and Target serial numbers are required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());

                // 1. Get IDs and verify keys
                var sourceKey = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT SM_ID, SM_TEXT, SM_APPLICATION FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @Serial", 
                    new { Serial = request.SourceSerial }
                );
                var targetKey = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT SM_ID, SM_TEXT, SM_APPLICATION FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @Serial", 
                    new { Serial = request.TargetSerial }
                );

                if (sourceKey == null || targetKey == null)
                {
                    return BadRequest(new { message = "Invalid source or target serial key." });
                }

                if (sourceKey.SM_APPLICATION != targetKey.SM_APPLICATION)
                {
                    return BadRequest(new { message = "Product types do not match. Linking is not allowed." });
                }

                // 2. Check if already linked
                int sourceLinkCount = await connection.QueryFirstOrDefaultAsync<int>(
                    "SELECT COUNT(*) FROM [dokum_msa].[SerialKeyLink] WHERE SM_ID = @Id", new { Id = sourceKey.SM_ID }
                );
                int targetLinkCount = await connection.QueryFirstOrDefaultAsync<int>(
                    "SELECT COUNT(*) FROM [dokum_msa].[SerialKeyLink] WHERE SM_ID = @Id", new { Id = targetKey.SM_ID }
                );

                if (sourceLinkCount > 0 && targetLinkCount > 0)
                {
                    return BadRequest(new { message = "Entered serial keys are already linked." });
                }

                // 3. Establish link relationship
                if (sourceLinkCount == 0 && targetLinkCount == 0)
                {
                    string gid = Guid.NewGuid().ToString();
                    await connection.ExecuteAsync(
                        "INSERT INTO [dokum_msa].[SerialKeyLink] (Name, SM_ID, ParentId) VALUES (@Name, @Id, 0)",
                        new { Name = gid, Id = sourceKey.SM_ID }
                    );

                    int parentLinkId = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT SK_ID FROM [dokum_msa].[SerialKeyLink] WHERE SM_ID = @Id", new { Id = sourceKey.SM_ID }
                    );

                    await connection.ExecuteAsync(
                        "INSERT INTO [dokum_msa].[SerialKeyLink] (Name, SM_ID, ParentId) VALUES (@Name, @Id, @ParentId)",
                        new { Name = Guid.NewGuid().ToString(), Id = targetKey.SM_ID, ParentId = parentLinkId }
                    );
                }
                else if (sourceLinkCount > 0)
                {
                    var sourceLink = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT SK_ID, ParentId FROM [dokum_msa].[SerialKeyLink] WHERE SM_ID = @Id", new { Id = sourceKey.SM_ID }
                    );
                    int parentId = sourceLink.ParentId == 0 ? sourceLink.SK_ID : sourceLink.ParentId;

                    await connection.ExecuteAsync(
                        "INSERT INTO [dokum_msa].[SerialKeyLink] (Name, SM_ID, ParentId) VALUES (@Name, @Id, @ParentId)",
                        new { Name = Guid.NewGuid().ToString(), Id = targetKey.SM_ID, ParentId = parentId }
                    );
                }
                else
                {
                    var targetLink = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        "SELECT SK_ID, ParentId FROM [dokum_msa].[SerialKeyLink] WHERE SM_ID = @Id", new { Id = targetKey.SM_ID }
                    );
                    int parentId = targetLink.ParentId == 0 ? targetLink.SK_ID : targetLink.ParentId;

                    await connection.ExecuteAsync(
                        "INSERT INTO [dokum_msa].[SerialKeyLink] (Name, SM_ID, ParentId) VALUES (@Name, @Id, @ParentId)",
                        new { Name = Guid.NewGuid().ToString(), Id = sourceKey.SM_ID, ParentId = parentId }
                    );
                }

                // 4. Update total days if selected
                if (request.UpdateTotalDays)
                {
                    await connection.ExecuteAsync(
                        "UPDATE [dbo].[SerialKeyMaster] SET SM_TOTALDAYS = @Days WHERE SM_ID = @Id",
                        new { Id = targetKey.SM_ID, Days = request.TotalDays }
                    );
                }

                // 5. Update comments/text
                if (!string.IsNullOrEmpty(request.Remarks))
                {
                    await connection.ExecuteAsync(
                        "UPDATE [dbo].[SerialKeyMaster] SET SM_TEXT = @Text WHERE SM_ID = @Id",
                        new { Id = targetKey.SM_ID, Text = request.Remarks }
                    );
                    await connection.ExecuteAsync(
                        "UPDATE [dbo].[SerialKeyMaster] SET SM_TEXT = @Text WHERE SM_ID = @Id",
                        new { Id = sourceKey.SM_ID, Text = request.Remarks }
                    );
                }

                return Ok(new { message = "Keys successfully linked." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Linking failed.", details = ex.Message });
            }
        }

        [HttpPost("upgrade")]
        public async Task<IActionResult> UpgradeLicense([FromBody] UpgradeLicenseRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.SourceSerial) || string.IsNullOrEmpty(request.TargetVersion))
            {
                return BadRequest(new { message = "Source serial key and target version are required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());

                // Find source key
                var source = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT SM_ID, SM_SERIALNO, SM_APPLICATION, SM_ISPERPETUAL FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @Serial",
                    new { Serial = request.SourceSerial }
                );

                if (source == null)
                {
                    return BadRequest(new { message = "Source serial key not found." });
                }

                // Extract second part of serial
                var parts = request.SourceSerial.Split('-');
                string secondPart = parts.Length > 1 ? parts[1] : "";

                // Restrict upgrade parameters (e.g. check version links count)
                int existingLinkCount = await connection.QueryFirstOrDefaultAsync<int>(
                    "SELECT COUNT(*) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_OLD = @Id",
                    new { Id = source.SM_ID }
                );

                if (existingLinkCount >= 4)
                {
                    return BadRequest(new { message = "Key already upgraded." });
                }

                // Query next available key in master lists
                // Mimic logic from Main_Products_Manualupgrade_VBdotnet_Logic.txt
                string targetApp = request.SourceSerial.Replace("500-", "000-").Split('-')[0];
                string selectSql = @"
                    SELECT TOP 1 s.SM_SERIALNO, s.SM_ID 
                    FROM [dbo].[CustomerDetail] c 
                    RIGHT JOIN [dbo].[SerialKeyMaster] s ON s.SM_ID = c.CD_SERIAL_ID 
                    WHERE (s.SM_TEXT IS NULL OR s.SM_TEXT = '') 
                      AND s.SM_APPLICATION = @App 
                      AND c.CD_ID IS NULL ";

                if (request.TargetVersion == "5.x.y")
                {
                    selectSql += " AND CONVERT(INT, SUBSTRING(s.SM_SERIALNO, 6, CHARINDEX('-', s.SM_SERIALNO)-6)) > 5000 ORDER BY s.SM_SERIALNO";
                }
                else if (request.TargetVersion == "4.x.y")
                {
                    selectSql += " AND CONVERT(INT, SUBSTRING(s.SM_SERIALNO, 6, CHARINDEX('-', s.SM_SERIALNO)-6)) > 4000 ORDER BY s.SM_SERIALNO";
                }
                else
                {
                    selectSql += " AND CONVERT(INT, SUBSTRING(s.SM_SERIALNO, 6, CHARINDEX('-', s.SM_SERIALNO)-6)) > 3000 ORDER BY s.SM_SERIALNO";
                }

                var targetRow = await connection.QueryFirstOrDefaultAsync<dynamic>(selectSql, new { App = targetApp });
                if (targetRow == null)
                {
                    return NotFound(new { message = "No available target upgrade serial keys found in the database." });
                }

                string targetSerial = targetRow.SM_SERIALNO;
                int targetId = Convert.ToInt32(targetRow.SM_ID);

                // Insert/Update SerialKeyMasterLink
                // Based on source second part values
                int sPartVal = 0;
                int.TryParse(secondPart, out sPartVal);

                if (sPartVal < 2000)
                {
                    string linkSql = "";
                    if (request.TargetVersion == "2.x.y")
                        linkSql = "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNOOLD,SL_SERIALNONEW,SL_VERSIONOLD,SL_VERSIONNEW, SM_ID_OLD, SM_ID_NEW) values(@Src, @Dest, '1.x.y.', @V, @SrcId, @DestId)";
                    else if (request.TargetVersion == "3.x.y")
                        linkSql = "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNOOLD,SL_VERSIONOLD,SL_VERSIONNEW, SM_ID_OLD, SM_ID_NEW3) values(@Src, '1.x.y.', @V, @SrcId, @DestId)";
                    else if (request.TargetVersion == "4.x.y")
                        linkSql = "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNOOLD,SL_VERSIONOLD,SL_VERSIONNEW, SM_ID_OLD, SM_ID_NEW4) values(@Src, '1.x.y.', @V, @SrcId, @DestId)";
                    else
                        linkSql = "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNOOLD,SL_VERSIONOLD,SL_VERSIONNEW, SM_ID_OLD, SM_ID_NEW5) values(@Src, '1.x.y.', @V, @SrcId, @DestId)";

                    await connection.ExecuteAsync(linkSql, new { Src = request.SourceSerial, Dest = targetSerial, V = request.TargetVersion, SrcId = source.SM_ID, DestId = targetId });
                }
                else if (sPartVal < 3000)
                {
                    int linkId = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT SL_ID FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW = @Id", new { Id = source.SM_ID }
                    );

                    if (linkId == 0)
                    {
                        string linkSql = request.TargetVersion == "3.x.y" ? "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNONEW, SM_ID_NEW, SM_ID_NEW3) values(@Src, @SrcId, @DestId)" :
                                         request.TargetVersion == "4.x.y" ? "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNONEW, SM_ID_NEW, SM_ID_NEW4) values(@Src, @SrcId, @DestId)" :
                                                                            "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNONEW, SM_ID_NEW, SM_ID_NEW5) values(@Src, @SrcId, @DestId)";
                        await connection.ExecuteAsync(linkSql, new { Src = request.SourceSerial, SrcId = source.SM_ID, DestId = targetId });
                    }
                    else
                    {
                        string updateSql = request.TargetVersion == "3.x.y" ? "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW3 = @DestId where SL_ID = @LinkId" :
                                           request.TargetVersion == "4.x.y" ? "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW4 = @DestId where SL_ID = @LinkId" :
                                                                              "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW5 = @DestId where SL_ID = @LinkId";
                        await connection.ExecuteAsync(updateSql, new { DestId = targetId, LinkId = linkId });
                    }
                }
                else if (sPartVal < 4000)
                {
                    int linkId = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT SL_ID FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW3 = @Id", new { Id = source.SM_ID }
                    );

                    if (linkId == 0)
                    {
                        string linkSql = request.TargetVersion == "4.x.y" ? "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNONEW, SM_ID_NEW3, SM_ID_NEW4) values(@Src, @SrcId, @DestId)" :
                                                                            "insert into [dbo].[SERIALKEYMASTERLINK] (SL_SERIALNONEW, SM_ID_NEW3, SM_ID_NEW5) values(@Src, @SrcId, @DestId)";
                        await connection.ExecuteAsync(linkSql, new { Src = request.SourceSerial, SrcId = source.SM_ID, DestId = targetId });
                    }
                    else
                    {
                        string updateSql = request.TargetVersion == "4.x.y" ? "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW4 = @DestId where SL_ID = @LinkId" :
                                                                              "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW5 = @DestId where SL_ID = @LinkId";
                        await connection.ExecuteAsync(updateSql, new { DestId = targetId, LinkId = linkId });
                    }
                }
                else if (sPartVal < 5000)
                {
                    int linkId = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT SL_ID FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW4 = @Id", new { Id = source.SM_ID }
                    );

                    if (linkId == 0)
                    {
                        await connection.ExecuteAsync(
                            "insert into [dbo].[SERIALKEYMASTERLINK] (SM_ID_NEW4, SM_ID_NEW5) values(@SrcId, @DestId)",
                            new { SrcId = source.SM_ID, DestId = targetId }
                        );
                    }
                    else
                    {
                        await connection.ExecuteAsync(
                            "update [dbo].[SERIALKEYMASTERLINK] set SM_ID_NEW5 = @DestId where SL_ID = @LinkId",
                            new { DestId = targetId, LinkId = linkId }
                        );
                    }
                }

                // Update parameters on target serial key
                int perpetualVal = request.IsPerpetual ? 0 : 1;
                int ignoreParentVal = request.IgnoreParent ? 1 : 0;
                int totalDaysVal = request.IsPerpetual ? (10 * 365) : request.TotalDays;

                await connection.ExecuteAsync(
                    "UPDATE [dbo].[SerialKeyMaster] SET SM_ISPERPETUAL = @P, SM_IGNOREPARENT = @I, SM_TOTALDAYS = @Days, SM_UPGRADEDMODE = 0 WHERE SM_SERIALNO = @Serial",
                    new { P = perpetualVal, I = ignoreParentVal, Days = totalDaysVal, Serial = targetSerial }
                );

                // Copy SM_TEXT
                await connection.ExecuteAsync(
                    "UPDATE [dbo].[SerialKeyMaster] SET SM_TEXT = (SELECT SM_TEXT FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @Src) WHERE SM_SERIALNO = @Dest",
                    new { Src = request.SourceSerial, Dest = targetSerial }
                );

                // Log into SerialKeyUpgrade
                int upgradeLogId = await connection.QueryFirstOrDefaultAsync<int>(
                    "SELECT ID FROM [dbo].[SerialKeyUpgrade] WHERE SM_ID = @Id", new { Id = targetId }
                );
                if (upgradeLogId == 0)
                {
                    await connection.ExecuteAsync("INSERT INTO [dbo].[SerialKeyUpgrade] VALUES (@Id, GETDATE())", new { Id = targetId });
                }
                else
                {
                    await connection.ExecuteAsync("UPDATE [dbo].[SerialKeyUpgrade] SET SM_UPGRADEDATE = GETDATE() WHERE ID = @LogId", new { LogId = upgradeLogId });
                }

                return Ok(new { message = $"Successfully upgraded to {request.TargetVersion}.", upgradedSerial = targetSerial });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Upgrade failed.", details = ex.Message });
            }
        }

        [HttpGet("{serialNo}/calc")]
        public async Task<IActionResult> GetLicenseCalculation(string serialNo)
        {
            if (string.IsNullOrEmpty(serialNo))
            {
                return BadRequest(new { message = "Serial number is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());

                // Find master record
                var keyMaster = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    "SELECT SM_ID, SM_SERIALNO FROM [dbo].[SerialKeyMaster] WHERE SM_SERIALNO = @SerialNo",
                    new { SerialNo = serialNo }
                );

                if (keyMaster == null)
                {
                    return NotFound(new { message = "Serial key not found." });
                }

                int smId = Convert.ToInt32(keyMaster.SM_ID);

                // Find if linked
                var linkRow = await connection.QueryFirstOrDefaultAsync<dynamic>(
                    @"SELECT SM_ID_OLD, SM_ID_NEW, SM_ID_NEW3, SM_ID_NEW4, SM_ID_NEW5 
                      FROM [dbo].[SerialKeyMasterLink] 
                      WHERE SM_ID_OLD = @Id OR SM_ID_NEW = @Id OR SM_ID_NEW3 = @Id OR SM_ID_NEW4 = @Id OR SM_ID_NEW5 = @Id",
                    new { Id = smId }
                );

                var smIds = new List<int>();
                if (linkRow != null)
                {
                    if (linkRow.SM_ID_OLD != null) smIds.Add(Convert.ToInt32(linkRow.SM_ID_OLD));
                    if (linkRow.SM_ID_NEW != null) smIds.Add(Convert.ToInt32(linkRow.SM_ID_NEW));
                    if (linkRow.SM_ID_NEW3 != null) smIds.Add(Convert.ToInt32(linkRow.SM_ID_NEW3));
                    if (linkRow.SM_ID_NEW4 != null) smIds.Add(Convert.ToInt32(linkRow.SM_ID_NEW4));
                    if (linkRow.SM_ID_NEW5 != null) smIds.Add(Convert.ToInt32(linkRow.SM_ID_NEW5));
                }
                else
                {
                    smIds.Add(smId);
                }

                // Query details for each ID
                var sb = new StringBuilder();
                sb.AppendLine();

                foreach (var id in smIds)
                {
                    var details = await connection.QueryFirstOrDefaultAsync<dynamic>(
                        @"SELECT SM_ID, SM_SERIALNO, SM_ISACTIVE, SM_TOTALDAYS, SM_INCR,
                                 CASE WHEN SM_ISPERPETUAL = 0 THEN 'PERPETUAL' ELSE 'SUBSCRIPTION' END as SM_ISPERPETUAL,
                                 [dokum_msa].udfGetMINDATE(SM_SERIALNO) as MINDATE,
                                 [dokum_msa].udfGetDAYSLEFT(SM_SERIALNO) as DAYSLEFT,
                                 [dokum_msa].udfGetEXPIRYDATE(SM_SERIALNO) as EXPIRYDATE,
                                 SM_EXPORTEDON
                          FROM [dbo].[SerialKeyMaster]
                          WHERE SM_ID = @Id",
                        new { Id = id }
                    );

                    if (details == null) continue;

                    string curSerial = Convert.ToString(details.SM_SERIALNO) ?? "";
                    string licType = Convert.ToString(details.SM_ISPERPETUAL) ?? "";
                    DateTime? minDate = details.MINDATE;
                    string regDate = minDate.HasValue ? minDate.Value.ToString("yyyy-MM-dd HH:mm:ss") : "";
                    int totalDays = Convert.ToInt32(details.SM_TOTALDAYS ?? 0);
                    int daysLeft = Convert.ToInt32(details.DAYSLEFT ?? 0);
                    string active = Convert.ToString(details.SM_ISACTIVE) ?? "";

                    // Query subscriptions sum
                    int subDays = await connection.QueryFirstOrDefaultAsync<int>(
                        "SELECT ISNULL(SUM(SD_DAYS), 0) FROM [dbo].[SubscriptionDetails] WHERE SD_SM_ID = @Id",
                        new { Id = id }
                    );

                    sb.Append(" Serial Key : ").Append(curSerial)
                      .Append("\t License Type : ").Append(licType)
                      .Append("\t Registered On : ").Append(regDate)
                      .AppendLine();

                    sb.Append("\t Total Days in Serialkey : ").Append(totalDays)
                      .Append("\t Subscription Days : ").Append(subDays)
                      .AppendLine();

                    // Query subscription list
                    var subs = await connection.QueryAsync<dynamic>(
                        @"SELECT SD_ID, SD_DATE, SD_DAYS, SD_MODE, SD_STATUS, SD_VERSION, SD_DAYSLEFTB4, SD_DAYSLEFTAFTER 
                          FROM [dbo].[SubscriptionDetails] 
                          WHERE SD_SM_ID = @Id 
                          ORDER BY SD_DATE ASC",
                        new { Id = id }
                    );

                    int sno = 1;
                    foreach (var sub in subs)
                    {
                        DateTime? subDateVal = sub.SD_DATE;
                        string subDate = subDateVal.HasValue ? subDateVal.Value.ToString("yyyy-MM-dd HH:mm:ss") : "";
                        int daysB4 = Convert.ToInt32(sub.SD_DAYSLEFTB4 ?? 0);
                        int sDays = Convert.ToInt32(sub.SD_DAYS ?? 0);
                        int daysAfter = Convert.ToInt32(sub.SD_DAYSLEFTAFTER ?? 0);

                        sb.Append("\t Subscription : ").Append(sno++)
                          .Append(" Added On : ").Append(subDate)
                          .Append("\t Days Left Before : ").Append(daysB4)
                          .Append("\t Subscription Days : ").Append(sDays)
                          .Append("\t Days Left After : ").Append(daysAfter)
                          .AppendLine();
                    }

                    if (sno > 1)
                    {
                        sb.AppendLine();
                    }

                    sb.Append("\t Days Left : ").Append(daysLeft)
                      .AppendLine();

                    sb.Append("\t Status : ");
                    if (active == "0")
                    {
                        sb.Append(" DeActivated");
                    }
                    else if (daysLeft < 0)
                    {
                        sb.Append(" Expired");
                    }
                    else
                    {
                        DateTime? expiryDate = details.EXPIRYDATE;
                        string exp = expiryDate.HasValue ? expiryDate.Value.ToString("yyyy-MM-dd") : "";
                        sb.Append(" Will Expire On : ").Append(exp);
                    }

                    DateTime? exportedOn = details.SM_EXPORTEDON;
                    if (exportedOn.HasValue)
                    {
                        sb.Append("\t Reset Done On : ").Append(exportedOn.Value.ToString("yyyy-MM-dd HH:mm:ss"));
                    }

                    sb.AppendLine();
                    sb.AppendLine();
                }

                return Ok(new { summaryText = sb.ToString() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to calculate days left breakdown.", details = ex.Message });
            }
        }
    }

    public class UpdateTextRequest
    {
        public string SerialNo { get; set; } = string.Empty;
        public string? Text { get; set; }
    }

    public class UpdateTypeRequest
    {
        public string SerialNo { get; set; } = string.Empty;
        public int IsPerpetual { get; set; }
        public bool IgnoreParent { get; set; }
        public int TotalDays { get; set; }
    }

    public class RestoreKeysRequest
    {
        public int[] Ids { get; set; } = Array.Empty<int>();
    }

    public class UpdateSubscriptionRequest
    {
        public int Days { get; set; }
    }

    public class LinkKeysRequest
    {
        public string SourceSerial { get; set; } = string.Empty;
        public string TargetSerial { get; set; } = string.Empty;
        public bool UpdateTotalDays { get; set; }
        public int TotalDays { get; set; }
        public string? Remarks { get; set; }
    }

    public class UpgradeLicenseRequest
    {
        public string SourceSerial { get; set; } = string.Empty;
        public string TargetVersion { get; set; } = string.Empty;
        public bool IsPerpetual { get; set; }
        public bool IgnoreParent { get; set; }
        public int TotalDays { get; set; }
    }
}
