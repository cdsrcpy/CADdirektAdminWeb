/*
   CreateAssistantUser.sql – creates a read‑only login for the AI Assistant.
   Run this script against the CADdirekt database on the remote SQL Server.
*/

-- 1. Create a login (server‑level) – if it already exists, skip.
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'assistant_user')
BEGIN
    CREATE LOGIN assistant_user WITH PASSWORD = N'@bjectARX1$', CHECK_POLICY = OFF;
END;
GO

-- 2. Create a user in the CADdirekt database (database‑level) – map to the login.
USE [msdirekt];
GO
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'assistant_user')
BEGIN
    CREATE USER assistant_user FOR LOGIN assistant_user;
END;
GO

-- 3. Grant SELECT on the tables the assistant may query.
-- Adjust the list below if you want to restrict to specific tables.
GRANT SELECT ON dbo.Customer TO assistant_user;
GRANT SELECT ON dbo.License TO assistant_user;
GRANT SELECT ON dbo.Reseller TO assistant_user;
GRANT SELECT ON dbo.Subscription TO assistant_user;
GO

-- Optional: deny any other permissions (defensive)
DENY INSERT, UPDATE, DELETE, ALTER, REFERENCES, EXECUTE TO assistant_user;
GO
