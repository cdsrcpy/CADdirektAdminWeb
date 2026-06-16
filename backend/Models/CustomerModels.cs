using System;

namespace CADdirektAdmin.API.Models
{
    public class CustomerRow
    {
        public long RowNum { get; set; }
        public int SM_ID { get; set; }
        public string? SM_TEXT { get; set; }
        public string SM_SERIALNO { get; set; } = string.Empty;
        public int? UPGRADED { get; set; }
        public int? UPGRADED2xy { get; set; }
        public int? UPGRADED3xy { get; set; }
        public int? UPGRADED4xy { get; set; }
        public int? UPGRADED5xy { get; set; }
        public string SM_ISACTIVE { get; set; } = string.Empty;
        public int SM_TOTALDAYS { get; set; }
        public string SM_ISPERPETUAL { get; set; } = string.Empty;
        public int? CD_ID { get; set; }
        public string SM_ISUSED { get; set; } = string.Empty;
        public string? CD_USERNAME { get; set; }
        public string? CD_COMPANYNAME { get; set; }
        public string? CD_EMAIL { get; set; }
        public string? CD_PHONENO { get; set; }
        public string? CD_ADDRESS { get; set; }
        public string? CD_APPLICATION { get; set; }
        public string? CD_CADPRODUCTNAME { get; set; }
        public string? CD_HARDWARESERIALNO { get; set; }
        public string? CD_MACADDRESS { get; set; }
        public string? CD_PRODUCTKEY { get; set; }
        public string? CD_TRANSFER { get; set; }
        public DateTime? CD_DATE { get; set; }
        public string? CD_VERSION { get; set; }
        public int SDDAYS { get; set; }
        public DateTime? SM_RESETON { get; set; }
        public string SM_IGNOREPARENT { get; set; } = string.Empty;
        public string? USER_STATUS { get; set; }
        public string? COMMENTS { get; set; }
        public string? UPGRADED_SERIALNO { get; set; }
        public string? SM_APPLICATION { get; set; }
        public DateTime? MINDATE { get; set; }
        public DateTime? MAXDATE { get; set; }
        public int? RESELLER { get; set; }
        public string? RESELLER_NAME { get; set; }
        public int? DAYSLEFT { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public int? SM_INCR { get; set; }
        public string? SM_LATEST { get; set; }
    }

    public class CustomerSearchCriteria
    {
        public int Registered { get; set; } = 2; // 0 = Unregistered, 1 = Registered, 2 = Both
        public bool Upgraded { get; set; } = false;
        public bool WithDeactivatedLic { get; set; } = false; // false = Active only, true = All
        public int Perpetual { get; set; } = -1; // -1 = Both, 1 = Perpetual, 0 = Subscription
        public int WithSmText { get; set; } = -1; // -1 = Both, 1 = With text, 0 = Without text
        
        // Filter options for modules (corresponds to checkboxes in the original desktop UI)
        public string? ApplicationModule { get; set; } // e.g. "6000", "5000", "7000", etc.
        public string[]? Products { get; set; } // Grouped checkbox checklist
        public bool HideTrial { get; set; } = false;
        public string? SearchText { get; set; }
        public string[]? Versions { get; set; }
        public int? Limit { get; set; } // Row limit
        public int ExpiryCondition { get; set; } = 0; // 0 = All, 1 = Expiring in 1 Month, 2 = Expiring in 2 Months
    }
}
