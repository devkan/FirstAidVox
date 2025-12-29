# Test chat endpoint with form data
$boundary = "----WebKitFormBoundary" + [System.Guid]::NewGuid().ToString()
$LF = "`r`n"

$bodyLines = @(
    "--$boundary",
    "Content-Disposition: form-data; name=`"text`"",
    "",
    "I have a headache and feel dizzy",
    "--$boundary--"
) -join $LF

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/chat" -Method POST -Body $bodyLines -ContentType "multipart/form-data; boundary=$boundary" -TimeoutSec 30
    
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    Write-Host $response.Content -ForegroundColor White
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}