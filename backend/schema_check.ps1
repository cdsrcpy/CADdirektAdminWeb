$connectionString = "Data Source=103.14.120.147,34569;Initial Catalog=msdirekt;User ID=dokum_sa;Password=@bjectARX1$;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
$conn.Open()
$cmd = $conn.CreateCommand()
try {
    # 2 represents 'Both'
    $cmd.CommandText = "exec dokum_direkt_queryvar1 2, 0, 0, -1, -1, '', ''"
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($cmd)
    $dt = New-Object System.Data.DataTable
    $adapter.Fill($dt)
    Write-Output "Executed with 2 (Both) successfully! Row count: $($dt.Rows.Count)"
} catch {
    Write-Output "Failed to execute with 2 (Both): $_"
}
$conn.Close()
