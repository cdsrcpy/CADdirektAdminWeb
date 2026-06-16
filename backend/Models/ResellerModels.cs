using System;

namespace CADdirektAdmin.API.Models
{
    public class Reseller
    {
        public int Reseller_ID { get; set; }
        public string Reseller_Name { get; set; } = string.Empty;
        public string? Reseller_Location { get; set; }
    }

    public class AssignResellerRequest
    {
        public int ResellerId { get; set; }
        public string SerialNo { get; set; } = string.Empty;
    }
}
