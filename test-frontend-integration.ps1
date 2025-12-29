# Test script to verify frontend integration
Write-Host "Testing FirstAidVox Frontend Integration..." -ForegroundColor Green

# Test 1: Check if frontend is running
Write-Host "`n1. Checking frontend server..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 5
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✅ Frontend server is running on port 5173" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Frontend server is not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Check if backend is running
Write-Host "`n2. Checking backend server..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET -TimeoutSec 5
    Write-Host "✅ Backend server is running on port 3001" -ForegroundColor Green
    Write-Host "Backend status: $($backendResponse.status)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Backend server is not accessible" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Test backend chat endpoint
Write-Host "`n3. Testing backend chat functionality..." -ForegroundColor Yellow
try {
    $form = @{
        text = 'I have a headache and feel dizzy'
    }
    
    # Create multipart form data
    $boundary = [System.Guid]::NewGuid().ToString()
    $LF = "`r`n"
    $bodyLines = @()
    
    foreach ($key in $form.Keys) {
        $bodyLines += "--$boundary"
        $bodyLines += "Content-Disposition: form-data; name=`"$key`""
        $bodyLines += ""
        $bodyLines += $form[$key]
    }
    $bodyLines += "--$boundary--"
    $bodyLines += ""
    
    $body = $bodyLines -join $LF
    
    $chatResponse = Invoke-RestMethod -Uri "http://localhost:3001/chat" -Method POST -Body $body -ContentType "multipart/form-data; boundary=$boundary" -TimeoutSec 10
    
    Write-Host "✅ Backend chat is working" -ForegroundColor Green
    Write-Host "Response confidence: $($chatResponse.confidence_level)" -ForegroundColor Cyan
    Write-Host "Advice preview: $($chatResponse.advice.Substring(0, [Math]::Min(100, $chatResponse.advice.Length)))..." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Backend chat test failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🎯 Integration Test Summary:" -ForegroundColor Magenta
Write-Host "- Frontend should be accessible at: http://localhost:5173" -ForegroundColor White
Write-Host "- Backend should be accessible at: http://localhost:3001" -ForegroundColor White
Write-Host "- Try sending a message through the frontend UI to test the full flow" -ForegroundColor White
Write-Host "- Check browser console for any JavaScript errors" -ForegroundColor White
Write-Host "- Look for the medical report card with high-visibility styling after sending a message" -ForegroundColor White

Write-Host "`n📋 Manual Testing Steps:" -ForegroundColor Magenta
Write-Host "1. Open http://localhost:5173 in your browser" -ForegroundColor White
Write-Host "2. Type a medical question in the text area (e.g., 'I have a headache')" -ForegroundColor White
Write-Host "3. Click the 'Send' button" -ForegroundColor White
Write-Host "4. Look for a red box with blue border containing the medical report" -ForegroundColor White
Write-Host "5. Check browser console (F12) for any error messages" -ForegroundColor White