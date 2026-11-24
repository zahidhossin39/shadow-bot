# Asks for the two secrets and sends them straight to Cloudflare. Nothing is saved on disk.
Set-Location $PSScriptRoot
Write-Host "1) Paste your Discord bot token (the value after DISCORD_TOKEN= in .env), then press Enter:" -ForegroundColor Cyan
npx wrangler secret put DISCORD_TOKEN
Write-Host "2) Type a passcode you will remember (Gemini asks for it once), then press Enter:" -ForegroundColor Cyan
npx wrangler secret put PASSCODE
Write-Host "Done. You can close this window." -ForegroundColor Green
