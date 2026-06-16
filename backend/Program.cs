using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add Services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = new CustomJsonNamingPolicy();
    });
builder.Services.AddOpenApi();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Configure JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "CADdirektAdminWebSuperSecretKey123!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "CADdirektAdminAPI";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "CADdirektAdminClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure HTTP Request Pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public class CustomJsonNamingPolicy : System.Text.Json.JsonNamingPolicy
{
    public override string ConvertName(string name)
    {
        if (string.IsNullOrEmpty(name)) return name;

        if (name.StartsWith("SM_"))
        {
            return "sm_" + name.Substring(3);
        }
        if (name.StartsWith("CD_"))
        {
            return "cd_" + name.Substring(3);
        }
        if (name.StartsWith("SD_"))
        {
            return "sD_" + name.Substring(3);
        }
        if (name == "USER_STATUS")
        {
            return "user_STATUS";
        }
        if (name == "RESELLER_NAME")
        {
            return "reseller_NAME";
        }
        if (name == "UPGRADED_SERIALNO")
        {
            return "upgraded_SERIALNO";
        }
        
        // Convert all-uppercase words (like DAYSLEFT, SDDAYS, MINDATE, MAXDATE, RESELLER) to lowercase
        if (name.All(c => char.IsUpper(c) || char.IsDigit(c) || c == '_'))
        {
            return name.ToLowerInvariant();
        }

        // Default to camelCase for properties like ExpiryDate, etc.
        return System.Text.Json.JsonNamingPolicy.CamelCase.ConvertName(name);
    }
}
