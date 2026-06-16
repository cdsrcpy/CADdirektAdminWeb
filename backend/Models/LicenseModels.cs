using System;

namespace CADdirektAdmin.API.Models
{
    public class ExtendLicenseRequest
    {
        public string SerialNo { get; set; } = string.Empty;
        public int Days { get; set; }
        public int Mode { get; set; } = 1;
        public string Status { get; set; } = "Active";
        public string Version { get; set; } = string.Empty;
        public string? StartDate { get; set; }
        public string Remarks { get; set; } = string.Empty;
    }

    public class SubscriptionRow
    {
        public int SD_ID { get; set; }
        public int SD_SM_ID { get; set; }
        public DateTime SD_DATE { get; set; }
        public int SD_DAYS { get; set; }
        public int SD_MODE { get; set; }
        public string SD_STATUS { get; set; } = string.Empty;
        public string SD_VERSION { get; set; } = string.Empty;
        public string? SD_REMARKS { get; set; }
        public int? SD_DAYSLEFTB4 { get; set; }
        public int? SD_DAYSLEFTAFTER { get; set; }
    }

    public class LinkedLicenseRow
    {
        public int PId { get; set; }
        public int PParentId { get; set; }
        public int SM_ID { get; set; }
        public int? CD_ID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string SerialKey { get; set; } = string.Empty;
        public string? UserName { get; set; }
        public string? CompanyName { get; set; }
        public string? Email { get; set; }
        public string? PhoneNo { get; set; }
        public string? Address { get; set; }
        public string? CAD_Product_Name { get; set; }
        public string ActiveStatus { get; set; } = string.Empty;
    }

    public class SerialActionRequest
    {
        public string SerialNo { get; set; } = string.Empty;
    }
}
