# Copies DISCORD_TOKEN from the bot's .env straight to the Cloudflare Worker.
# No pasting, so no stray characters. The token is never printed.
Set-Location $PSScriptRoot
$line = Get-Content ..\.env | Where-Object { $_ -match '^\s*DISCORD_TOKEN\s*=' } | Select-Object -First 1
if (-not $line) { Write-Host "No DISCORD_TOKEN line in ..\.env" -ForegroundColor Red; exit 1 }
$token = ($line -replace '^\s*DISCORD_TOKEN\s*=\s*', '').Trim().Trim('"').Trim("'")
$token | npx wrangler secret put DISCORD_TOKEN --name shadow-news
Write-Host "Done. You can close this window." -ForegroundColor Green
