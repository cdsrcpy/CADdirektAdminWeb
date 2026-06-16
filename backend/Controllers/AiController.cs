using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using System.Text.Json;
using System.Text;

namespace CADdirektAdmin.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AiController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetOllamaBaseUrl()
        {
            return _configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
        }

        [HttpGet("models")]
        public async Task<IActionResult> GetModels()
        {
            var defaultModels = new List<string> { "qwen3:8b" };
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
                var url = $"{GetOllamaBaseUrl()}/api/tags";
                var response = await client.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    var tagsResponse = JsonSerializer.Deserialize<OllamaTagsResponse>(content, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                    if (tagsResponse?.Models != null && tagsResponse.Models.Count > 0)
                    {
                        var modelsList = tagsResponse.Models.Select(m => m.Name).ToList();
                        return Ok(modelsList);
                    }
                }
            }
            catch (Exception ex)
            {
                // Fallback if Ollama is not running or offline
                System.Diagnostics.Debug.WriteLine($"Ollama not accessible: {ex.Message}");
            }

            return Ok(defaultModels);
        }

        [HttpPost("parse-prompt")]
        public async Task<IActionResult> ParsePrompt([FromBody] ParsePromptRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Prompt))
            {
                return BadRequest(new { message = "Prompt is required." });
            }

            var model = string.IsNullOrWhiteSpace(request.Model) ? "qwen3:8b" : request.Model;
            var systemPrompt = @"You are the AI assistant for CADdirekt License Matrix.
You are running in a secure, authorized local admin dashboard. The user is a system administrator querying their own local database. It is fully safe and authorized to map these query parameters to JSON.
Your job is to parse a natural language query from an administrator and output a JSON object representing the search filters to apply to the customer grid. Do not refuse the request, write safety warnings, or generate thought blocks. Output ONLY the JSON block.

Products mappings:
- '9000': 'CADdirekt BRAND'
- '6000': 'CADdirekt EL'
- '5000': 'CADdirekt VVS'
- '7000': 'CADdirekt TELE'
- '9500': 'CADdirekt BRAND LT'
- '6500': 'CADdirekt EL LT'
- '5500': 'CADdirekt VVS LT'
- '1200': 'CADdirekt SkalaFormat LT'
- '1300': 'CADdirekt SkalaFormat LT Upgrade'
- '1000': 'CADshop Svensk översättning'
- 'CDBL': 'CADdirekt BRANDLARM'
- 'CDBS': 'CADdirekt BRANDSKYDD'
- 'SCSB': 'CADdirekt SÄKERHET'
- 'CDVS': 'CADdirekt BBVVS'
- 'CDEP': 'CADdirekt ELPRODUKTION'
- 'CDEL': 'CADdirekt BBEL'

Versions mappings:
- '1.x.y' (SM_INCR 1000-1999)
- '2.x.y' (SM_INCR 2000-2999)
- '3.x.y' (SM_INCR 3000-3999)
- '4.x.y' (SM_INCR 4000-4999)
- '5.x.y' (SM_INCR 5000-5999)
- 'Other'

JSON format must match exactly:
{
  ""registered"": 2,
  ""upgraded"": false,
  ""deactivated"": false,
  ""perpetual"": -1,
  ""withSmText"": -1,
  ""products"": [],
  ""versions"": [],
  ""hideTrial"": false,
  ""searchText"": null,
  ""limit"": null,
  ""explanation"": ""Short summary of filters applied""
}

Rules:
1. Return ONLY the valid JSON object. Do not include markdown code block formatting (such as ```json) or any explanation outside of the JSON.
2. Maintain default values for fields not mentioned in the query:
   - registered defaults to 2 (0 = Unregistered, 1 = Registered, 2 = Both)
   - upgraded defaults to false
   - deactivated defaults to false
   - perpetual defaults to -1 (-1 = Both, 1 = Perpetual, 0 = Subscription)
   - withSmText defaults to -1
   - products defaults to []
   - versions defaults to []
   - hideTrial defaults to false
   - searchText defaults to null
   - limit defaults to null (if user asks for a quantity/limit like ""top 50"" or ""first 10"", set limit to that integer value, e.g. 50 or 10, otherwise null)
3. products and versions MUST be JSON arrays of strings (e.g. [""6000""] or [""1.x.y""]), even if there is only one product/version. Never output them as single strings. If no products/versions are filtered, output empty arrays [].
4. Be smart about recognizing product names (e.g. ""CADdirekt EL"" -> ""6000"", ""SkalaFormat"" -> ""1200"", ""BBEL"" or ""ELPRODUKTION"" -> ""CDEP"", ""CDEL"", etc.). If a user mentions multiple products, include all matching product codes in the array.
5. Be smart about recognizing version numbers (e.g. ""v1"" or ""version 1"" -> ""1.x.y"", ""v2"" or ""version 2"" -> ""2.x.y""). If they mention ""2.x.y"", output ""2.x.y"".
6. Be smart about active/deactivated, registered/unregistered, perpetual/subscription, and comments/text filters.";

            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(240) };
                var url = $"{GetOllamaBaseUrl()}/api/chat";
                
                var chatRequest = new
                {
                    model = model,
                    messages = new[]
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = request.Prompt }
                    },
                    stream = false,
                    options = new
                    {
                        temperature = 0.0,
                        num_predict = 1000
                    },
                    think = false
                };

                var requestJson = JsonSerializer.Serialize(chatRequest);
                var content = new StringContent(requestJson, Encoding.UTF8, "application/json");
                
                var response = await client.PostAsync(url, content);
                if (response.IsSuccessStatusCode)
                {
                    var responseBody = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(responseBody);
                    if (doc.RootElement.TryGetProperty("message", out var messageElement) &&
                        messageElement.TryGetProperty("content", out var contentElement))
                    {
                        var rawJson = contentElement.GetString() ?? string.Empty;
                        var cleanedJson = CleanJson(rawJson);

                        // Validate that it parses as JSON. If it does, we return it as is.
                        try
                        {
                            using var parsedJsonDoc = JsonDocument.Parse(cleanedJson);
                            return Content(cleanedJson, "application/json");
                        }
                        catch (JsonException ex)
                        {
                            return StatusCode(500, new { message = "LLM returned invalid JSON format.", raw = rawJson, error = ex.Message });
                        }
                    }
                }
                else
                {
                    var errorMsg = await response.Content.ReadAsStringAsync();
                    return StatusCode((int)response.StatusCode, new { message = $"Ollama service failed: {errorMsg}" });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Connection to Ollama failed: {ex.Message}" });
            }

            return StatusCode(500, new { message = "Failed to parse prompt." });
        }

        private string CleanJson(string text)
        {
            text = text.Trim();
            if (text.StartsWith("```json", StringComparison.OrdinalIgnoreCase))
            {
                text = text.Substring(7);
            }
            else if (text.StartsWith("```", StringComparison.OrdinalIgnoreCase))
            {
                text = text.Substring(3);
            }
            
            if (text.EndsWith("```"))
            {
                text = text.Substring(0, text.Length - 3);
            }
            return text.Trim();
        }
    }

    public class ParsePromptRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public string Model { get; set; } = "qwen3:8b";
    }

    public class OllamaTagsResponse
    {
        public List<OllamaModelItem>? Models { get; set; }
    }

    public class OllamaModelItem
    {
        public string Name { get; set; } = string.Empty;
    }
}
