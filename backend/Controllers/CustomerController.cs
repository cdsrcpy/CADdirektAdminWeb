using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Dapper;
using System.Data;
using System.Text;
using ClosedXML.Excel;
using CADdirektAdmin.API.Models;

namespace CADdirektAdmin.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public CustomerController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("DefaultConnection") 
                   ?? "Data Source=103.14.120.147,34569;Initial Catalog=msdirekt;User ID=dokum_sa;Password=@bjectARX1$;TrustServerCertificate=True;";
        }

        private string BuildSearchQuery(CustomerSearchCriteria criteria, DynamicParameters parameters, bool isExport = false)
        {
            var builder = new StringBuilder();
            
            // Limit results for performance when no specific search text/filter is provided
            string topClause = "";
            if (!isExport)
            {
                if (criteria.Limit.HasValue && criteria.Limit.Value > 0)
                {
                    topClause = $"TOP {criteria.Limit.Value}";
                }
                else
                {
                    bool hasFilter = !string.IsNullOrEmpty(criteria.SearchText) ||
                                     (criteria.Products != null && criteria.Products.Length > 0) ||
                                     !string.IsNullOrEmpty(criteria.ApplicationModule) ||
                                     (criteria.Versions != null && criteria.Versions.Length > 0);

                    if (!hasFilter)
                    {
                        topClause = "TOP 200";
                    }
                }
            }

            builder.Append($@"
select ROW_NUMBER() OVER (ORDER BY q.SM_SERIALNO) RowNum,* from ( 
select {topClause}
s.SM_ID, s.SM_TEXT, s.SM_SERIALNO, s.SM_INCR,
(SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_OLD = s.SM_ID) UPGRADED,
(SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW = s.SM_ID) UPGRADED2xy,
(SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW3 = s.SM_ID) UPGRADED3xy,
(SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW4 = s.SM_ID) UPGRADED4xy,
(SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW5 = s.SM_ID) UPGRADED5xy,
(SELECT min(sk_id) FROM [dokum_msa].[SerialKeyLink] o WHERE o.SM_ID = s.SM_ID) LINKED,
(CASE WHEN s.SM_ISACTIVE = 0 THEN 'DeActivated' ELSE (CASE WHEN s.SM_TRIAL = 1 THEN 'Test' ELSE 'Active' END) END) SM_ISACTIVE,
(CASE WHEN s.SM_TRIAL = 0 THEN 'true' ELSE 'false' END) SM_TRIAL,
s.SM_TOTALDAYS, CASE WHEN s.SM_ISPERPETUAL = 0 THEN 'PERPETUAL' WHEN s.SM_ISPERPETUAL = 1 THEN 'SUBSCRIPTION' END as SM_ISPERPETUAL, 
c.CD_ID, 
CASE WHEN s.SM_ISUSED = 'False' THEN CASE WHEN c.CD_ID is null THEN 'NotUsed' ELSE 'Exported' END ELSE 'Used' END as SM_ISUSED,
c.CD_USERNAME, c.CD_COMPANYNAME, c.CD_EMAIL, c.CD_PHONENO, c.CD_ADDRESS, c.CD_APPLICATION, c.CD_CADPRODUCTNAME, 
c.CD_HARDWARESERIALNO, c.CD_MACADDRESS, c.CD_PRODUCTKEY, c.CD_TRANSFER, c.CD_DATE, c.CD_VERSION, 
(SELECT CASE WHEN SUM(SD_DAYS) IS NULL THEN 0 ELSE SUM(SD_DAYS) END FROM [dbo].[SubscriptionDetails] WHERE SD_SM_ID = s.SM_ID) SDDAYS,
s.SM_EXPORTEDON SM_RESETON,
(CASE WHEN ISNULL(s.SM_IGNOREPARENT,0) = 0 THEN 'Parent Days Left will be Included' ELSE 'Parent Days Left will be Ignored' END) SM_IGNOREPARENT, 
c.CD_REMARKS USER_STATUS, (SELECT '') COMMENTS, (SELECT '') UPGRADED_SERIALNO, s.SM_APPLICATION,
(SELECT CASE WHEN count(SML_ID) = 0 THEN 'false' ELSE 'true' END FROM [dbo].[SerialKeyMasterLatest] where SML_SM_ID = s.SM_ID) SM_LATEST,
(SELECT MIN(CD_DATE) FROM [dbo].[CustomerDetail] WHERE CD_SERIAL_ID = s.SM_ID) MINDATE,
(SELECT MAX(CD_DATE) FROM [dbo].[CustomerDetail] WHERE CD_SERIAL_ID = s.SM_ID) AS MAXDATE,
[dokum_msa].udfGetEXPIRYDATE(s.SM_SERIALNO) ExpiryDate, (CASE WHEN s.SM_ISPREMIUM = 0 THEN 'No' ELSE 'Yes' END) SM_ISPREMIUM, s.SM_PREMIUMSTARTDATE,
(SELECT RESELLER_ID FROM [dokum_msa].[RESELLERSERIALKEY] L WHERE L.SM_SERIALNO=s.SM_SERIALNO) RESELLER,
(SELECT RESELLER_NAME FROM [dokum_msa].[RESELLERSERIALKEY] L INNER JOIN [dokum_msa].[RESELLERS] K ON L.RESELLER_ID = K.RESELLER_ID WHERE L.SM_SERIALNO=s.SM_SERIALNO) RESELLER_NAME,
[dokum_msa].udfGetDAYSLEFT(s.SM_SERIALNO) DAYSLEFT
FROM [dbo].[CustomerDetail] c RIGHT JOIN [dbo].[SerialKeyMaster] s ON s.SM_ID = c.CD_SERIAL_ID
");

            var conditions = new List<string>();

            // 1. Registered Filter
            if (criteria.Registered == 1)
            {
                conditions.Add("c.CD_ID is not null");
            }
            else if (criteria.Registered == 0)
            {
                conditions.Add("c.CD_ID is null");
            }

            // 2. Active / Deactivated
            if (criteria.WithDeactivatedLic)
            {
                conditions.Add("(s.SM_ISACTIVE = 0 or s.SM_ISACTIVE = 1)");
            }
            else
            {
                conditions.Add("(s.SM_ISACTIVE <> 0 and s.SM_ISACTIVE = 1)");
            }

            // 3. Perpetual vs Subscription
            if (criteria.Perpetual == 1)
            {
                conditions.Add("s.SM_ISPERPETUAL = 1");
            }
            else if (criteria.Perpetual == 0)
            {
                conditions.Add("s.SM_ISPERPETUAL = 0");
            }

            // 4. With/Without Remarks (SM_TEXT)
            if (criteria.WithSmText == 1)
            {
                conditions.Add("(s.SM_TEXT is not null and s.SM_TEXT <> '')");
            }
            else if (criteria.WithSmText == 0)
            {
                conditions.Add("(s.SM_TEXT is null or s.SM_TEXT = '')");
            }

            // 5. Hide Trial
            if (criteria.HideTrial)
            {
                conditions.Add("s.SM_TRIAL = 0");
            }

            // 6. Upgraded
            if (criteria.Upgraded)
            {
                conditions.Add(@"((SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_OLD = s.SM_ID) is not null 
                                  or (SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW = s.SM_ID) is not null
                                  or (SELECT min(sl_id) FROM [dbo].[SERIALKEYMASTERLINK] WHERE SM_ID_NEW3 = s.SM_ID) is not null)");
            }

            // 7. Product module filters
            if (criteria.Products != null && criteria.Products.Length > 0)
            {
                conditions.Add("s.SM_APPLICATION IN @Products");
                parameters.Add("@Products", criteria.Products);
            }
            else if (!string.IsNullOrEmpty(criteria.ApplicationModule))
            {
                conditions.Add("s.SM_APPLICATION = @ApplicationModule");
                parameters.Add("@ApplicationModule", criteria.ApplicationModule);
            }

            // 8. Text Search
            if (!string.IsNullOrEmpty(criteria.SearchText))
            {
                conditions.Add(@"(c.CD_COMPANYNAME like @SearchText 
                                  or c.CD_USERNAME like @SearchText 
                                  or s.SM_SERIALNO like @SearchText 
                                  or c.CD_EMAIL like @SearchText 
                                  or c.CD_PHONENO like @SearchText)");
                parameters.Add("@SearchText", $"%{criteria.SearchText}%");
            }

            // 9. Version Filter
            if (criteria.Versions != null && criteria.Versions.Length > 0)
            {
                var versionConditions = new List<string>();
                foreach (var version in criteria.Versions)
                {
                    if (version == "1.x.y")
                    {
                        versionConditions.Add("(s.SM_INCR >= 1000 AND s.SM_INCR < 2000)");
                    }
                    else if (version == "2.x.y")
                    {
                        versionConditions.Add("(s.SM_INCR >= 2000 AND s.SM_INCR < 3000)");
                    }
                    else if (version == "3.x.y")
                    {
                        versionConditions.Add("(s.SM_INCR >= 3000 AND s.SM_INCR < 4000)");
                    }
                    else if (version == "4.x.y")
                    {
                        versionConditions.Add("(s.SM_INCR >= 4000 AND s.SM_INCR < 5000)");
                    }
                    else if (version == "5.x.y")
                    {
                        versionConditions.Add("(s.SM_INCR >= 5000 AND s.SM_INCR < 6000)");
                    }
                    else if (version == "Other")
                    {
                        versionConditions.Add("(s.SM_INCR is null or s.SM_INCR < 1000 or s.SM_INCR >= 6000)");
                    }
                }
                if (versionConditions.Count > 0)
                {
                    conditions.Add("(" + string.Join(" OR ", versionConditions) + ")");
                }
            }

            if (conditions.Count > 0)
            {
                builder.Append(" WHERE " + string.Join(" AND ", conditions));
            }

            if (!string.IsNullOrEmpty(topClause))
            {
                builder.Append(" ORDER BY s.SM_SERIALNO ASC ");
            }

            builder.Append(@"
) q where q.CD_DATE = q.MAXDATE Or q.CD_DATE Is null order by q.SM_SERIALNO asc, q.CD_ID desc");

            return builder.ToString();
        }

        [HttpPost("search")]
        public async Task<IActionResult> Search([FromBody] CustomerSearchCriteria criteria)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var parameters = new DynamicParameters();
                string sql = BuildSearchQuery(criteria, parameters, isExport: false);

                var results = await connection.QueryAsync<CustomerRow>(sql, parameters);
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Database query failed.", details = ex.Message });
            }
        }

        [HttpPost("export")]
        public async Task<IActionResult> Export([FromBody] CustomerSearchCriteria criteria)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var parameters = new DynamicParameters();
                string sql = BuildSearchQuery(criteria, parameters, isExport: true);

                var results = (await connection.QueryAsync<CustomerRow>(sql, parameters)).ToList();

                using var workbook = new XLWorkbook();
                var worksheet = workbook.Worksheets.Add("Customers");

                // Add headers
                worksheet.Cell(1, 1).Value = "Serial Number";
                worksheet.Cell(1, 2).Value = "Company Name";
                worksheet.Cell(1, 3).Value = "User Name";
                worksheet.Cell(1, 4).Value = "Email";
                worksheet.Cell(1, 5).Value = "Phone";
                worksheet.Cell(1, 6).Value = "Application";
                worksheet.Cell(1, 7).Value = "License Type";
                worksheet.Cell(1, 8).Value = "Days Left";
                worksheet.Cell(1, 9).Value = "Expiry Date";
                worksheet.Cell(1, 10).Value = "Status";

                // Formatting headers
                var headerRange = worksheet.Range("A1:J1");
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#1E3A8A");
                headerRange.Style.Font.FontColor = XLColor.White;

                for (int i = 0; i < results.Count; i++)
                {
                    var row = results[i];
                    worksheet.Cell(i + 2, 1).Value = row.SM_SERIALNO;
                    worksheet.Cell(i + 2, 2).Value = row.CD_COMPANYNAME ?? "";
                    worksheet.Cell(i + 2, 3).Value = row.CD_USERNAME ?? "";
                    worksheet.Cell(i + 2, 4).Value = row.CD_EMAIL ?? "";
                    worksheet.Cell(i + 2, 5).Value = row.CD_PHONENO ?? "";
                    worksheet.Cell(i + 2, 6).Value = row.SM_APPLICATION ?? "";
                    worksheet.Cell(i + 2, 7).Value = row.SM_ISPERPETUAL;
                    worksheet.Cell(i + 2, 8).Value = row.DAYSLEFT ?? 0;
                    worksheet.Cell(i + 2, 9).Value = row.ExpiryDate?.ToString("yyyy-MM-dd") ?? "";
                    worksheet.Cell(i + 2, 10).Value = row.SM_ISACTIVE;
                }

                worksheet.Columns().AdjustToContents();

                using var stream = new MemoryStream();
                workbook.SaveAs(stream);
                var content = stream.ToArray();

                return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"Customers_{DateTime.Now:yyyyMMddHHmmss}.xlsx");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Export failed.", details = ex.Message });
            }
        }

        [HttpPost("emails")]
        public async Task<IActionResult> GetEmails([FromBody] string[] products)
        {
            if (products == null || products.Length == 0)
            {
                return BadRequest(new { message = "At least one product application code is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                string sql = @"
                    SELECT s.SM_SERIALNO, c.CD_EMAIL, c.CD_APPLICATION 
                    FROM [dbo].[CustomerDetail] c 
                    INNER JOIN [dbo].[SerialKeyMaster] s ON s.SM_ID = c.CD_SERIAL_ID 
                    WHERE s.SM_APPLICATION IN @Products 
                      AND s.SM_ISUSED = 'True' 
                      AND c.CD_ID IS NOT NULL";

                var rawRows = await connection.QueryAsync<dynamic>(sql, new { Products = products });

                // Deduplicate emails per application code category
                // Map the app code matching rule from CopyEmailSelectProduct.vb
                var groupedEmails = new Dictionary<string, HashSet<string>>();

                foreach (var row in rawRows)
                {
                    string serial = Convert.ToString(row.SM_SERIALNO);
                    string email = Convert.ToString(row.CD_EMAIL);
                    string app = Convert.ToString(row.CD_APPLICATION);

                    if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(app)) continue;

                    string category = "Other";
                    bool isSpecialPrefix = serial.StartsWith("sv", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cde", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cdv", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cdb", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("scs", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cdap", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cdkg", StringComparison.OrdinalIgnoreCase) || 
                                           serial.StartsWith("cdep", StringComparison.OrdinalIgnoreCase);

                    if (!isSpecialPrefix)
                    {
                        if (app == "9000") category = "CADdirekt BRAND";
                        else if (app == "6000") category = "CADdirekt EL";
                        else if (app == "5000") category = "CADdirekt VVS";
                        else if (app == "7000") category = "CADdirekt TELE";
                        else if (app == "9500") category = "CADdirekt BRAND LT";
                        else if (app == "6500") category = "CADdirekt EL LT";
                        else if (app == "5500") category = "CADdirekt VVS LT";
                        else if (app == "1200") category = "CADdirekt SkalaFormat LT";
                        else if (app == "1300") category = "CADdirekt SkalaFormat LT Upgrade";
                    }
                    else
                    {
                        if (app == "1000") category = "CADdirekt BOM";
                        else if (app.Contains("cdbl", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt BRANDLARM";
                        else if (app.Contains("cdbs", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt BRANDSKYDD";
                        else if (app.Contains("cdvs", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt BBVVS";
                        else if (app.Contains("scsb", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt SAKERHET";
                        else if (app.Contains("cdep", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt ELPRODUKTION";
                        else if (app.Contains("cdel", StringComparison.OrdinalIgnoreCase)) category = "CADdirekt BBEL";
                    }

                    if (!groupedEmails.ContainsKey(category))
                    {
                        groupedEmails[category] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    }
                    groupedEmails[category].Add(email);
                }

                var sb = new StringBuilder();
                foreach (var kvp in groupedEmails)
                {
                    if (kvp.Value.Count > 0)
                    {
                        sb.AppendLine($"{kvp.Key} : {string.Join(";", kvp.Value)}");
                    }
                }

                return Ok(new { emailsText = sb.ToString() });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to compile emails.", details = ex.Message });
            }
        }

        [HttpGet("{cdId}/comments")]
        public async Task<IActionResult> GetComments(int cdId)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var comments = await connection.QueryAsync<dynamic>(
                    "select * from [dbo].[Comment] where CD_ID = @CD_ID order by Comment_ID desc", 
                    new { CD_ID = cdId }
                );
                return Ok(comments);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load comments.", details = ex.Message });
            }
        }

        [HttpPost("comments")]
        public async Task<IActionResult> InsertComment([FromBody] InsertCommentRequest request)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                var parameters = new { Comment = request.CommentText, CD_ID = request.CustomerDetailId };
                await connection.ExecuteAsync(
                    "[dbo].[InsertComment]", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );
                return Ok(new { message = "Comment added successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to insert comment.", details = ex.Message });
            }
        }
    }

    public class InsertCommentRequest
    {
        public int CustomerDetailId { get; set; }
        public string CommentText { get; set; } = string.Empty;
    }
}
