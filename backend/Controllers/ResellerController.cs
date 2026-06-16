using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Dapper;
using System.Data;
using CADdirektAdmin.API.Models;

namespace CADdirektAdmin.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ResellerController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public ResellerController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("DefaultConnection") 
                   ?? "Data Source=103.14.120.147,34569;Initial Catalog=msdirekt;User ID=dokum_sa;Password=@bjectARX1$;TrustServerCertificate=True;";
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                var results = await connection.QueryAsync<Reseller>(
                    "[dokum_msa].[LoadReseller]", 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load resellers.", details = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Reseller reseller)
        {
            if (reseller == null || string.IsNullOrEmpty(reseller.Reseller_Name))
            {
                return BadRequest(new { message = "Reseller name is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                var parameters = new { 
                    RESELLER_NAME = reseller.Reseller_Name, 
                    RESELLER_LOCATION = reseller.Reseller_Location ?? "" 
                };

                await connection.ExecuteAsync(
                    "[dokum_msa].[InsertReseller]", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(new { message = "Reseller created successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to create reseller.", details = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Reseller reseller)
        {
            if (reseller == null || string.IsNullOrEmpty(reseller.Reseller_Name))
            {
                return BadRequest(new { message = "Reseller name is required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                var parameters = new { 
                    RESELLER_ID = id,
                    RESELLER_NAME = reseller.Reseller_Name, 
                    RESELLER_LOCATION = reseller.Reseller_Location ?? "" 
                };

                await connection.ExecuteAsync(
                    "[dokum_msa].[UpdateReseller]", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(new { message = "Reseller updated successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to update reseller.", details = ex.Message });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                await connection.ExecuteAsync(
                    "[dokum_msa].[DeleteReseller]", 
                    new { RESELLER_ID = id }, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(new { message = "Reseller deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to delete reseller.", details = ex.Message });
            }
        }

        [HttpPost("assign")]
        public async Task<IActionResult> Assign([FromBody] AssignResellerRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.SerialNo))
            {
                return BadRequest(new { message = "Reseller ID and serial key are required." });
            }

            try
            {
                using var connection = new SqlConnection(GetConnectionString());
                
                var parameters = new { 
                    RESELLER_ID = request.ResellerId, 
                    SM_SERIALNO = request.SerialNo 
                };

                await connection.ExecuteAsync(
                    "[dokum_msa].[InsertResellerSerialKey]", 
                    parameters, 
                    commandType: CommandType.StoredProcedure
                );

                return Ok(new { message = "Reseller successfully assigned to license key." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to assign reseller.", details = ex.Message });
            }
        }
    }
}
