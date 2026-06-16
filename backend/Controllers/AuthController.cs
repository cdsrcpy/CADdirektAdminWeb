using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using CADdirektAdmin.API.Models;

namespace CADdirektAdmin.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Username and password are required." });
            }

            bool isValid = false;
            bool isPatrikUser = false;

            // Replicate original WinForms login credentials:
            // CADdirekt / patrik (IsPatrikUser = true)
            // CADshop / SF (IsPatrikUser = false)
            if (request.Username == "CADdirekt" && request.Password == "patrik")
            {
                isValid = true;
                isPatrikUser = true;
            }
            else if (request.Username == "CADshop" && request.Password == "SF")
            {
                isValid = true;
                isPatrikUser = false;
            }

            if (!isValid)
            {
                return Unauthorized(new { message = "Access denied. Unauthorized." });
            }

            var token = GenerateJwtToken(request.Username, isPatrikUser);

            return Ok(new LoginResponse
            {
                Token = token,
                Username = request.Username,
                IsPatrikUser = isPatrikUser
            });
        }

        private string GenerateJwtToken(string username, bool isPatrikUser)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? "CADdirektAdminWebSuperSecretKey123!";
            var jwtIssuer = _configuration["Jwt:Issuer"] ?? "CADdirektAdminAPI";
            var jwtAudience = _configuration["Jwt:Audience"] ?? "CADdirektAdminClient";

            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim("isPatrikUser", isPatrikUser.ToString().ToLower())
            };

            var token = new JwtSecurityToken(
                issuer: jwtIssuer,
                audience: jwtAudience,
                claims: claims,
                expires: DateTime.UtcNow.AddHours(8),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
