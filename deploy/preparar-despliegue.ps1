# Prepara SIVEN para subirlo a SmarterASP.NET (o a cualquier IIS con HttpPlatformHandler).
# Uso, desde la RAÍZ del repositorio en PowerShell:
#   powershell -ExecutionPolicy Bypass -File deploy\preparar-despliegue.ps1
# Resultado: deploy\salida (carpeta del sitio) y deploy\siven-sitio.zip (para subir y descomprimir).
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$salida = Join-Path $PSScriptRoot 'salida'

Write-Host '1/5 Compilando el frontend...' -ForegroundColor Cyan
Push-Location (Join-Path $raiz 'frontend')
npm ci
$env:VITE_API_URL = '/api/v1'
$env:VITE_DEMO_ACCOUNTS = 'false'
npm run build
Pop-Location

Write-Host '2/5 Compilando el backend...' -ForegroundColor Cyan
Push-Location (Join-Path $raiz 'backend')
npm ci
npx prisma generate
npm run build
Pop-Location

Write-Host '3/5 Armando la carpeta del sitio...' -ForegroundColor Cyan
if (Test-Path $salida) { Remove-Item $salida -Recurse -Force }
New-Item -ItemType Directory -Path $salida, (Join-Path $salida 'logs'), (Join-Path $salida 'uploads') | Out-Null
Copy-Item (Join-Path $raiz 'backend\dist') (Join-Path $salida 'dist') -Recurse
Copy-Item (Join-Path $raiz 'backend\package.json'), (Join-Path $raiz 'backend\package-lock.json') $salida
Copy-Item (Join-Path $raiz 'frontend\dist') (Join-Path $salida 'public') -Recurse
$fotos = Join-Path $raiz 'backend\uploads'
if (Test-Path $fotos) { Copy-Item (Join-Path $fotos '*') (Join-Path $salida 'uploads') -Recurse }
$config = Join-Path $PSScriptRoot 'web.config'
if (-not (Test-Path $config)) {
  Copy-Item (Join-Path $PSScriptRoot 'web.config.ejemplo') $config
  Write-Host '   Se creó deploy\web.config: complete las claves (CAMBIAR) y vuelva a ejecutar.' -ForegroundColor Yellow
}
Copy-Item $config (Join-Path $salida 'web.config')

Write-Host '4/5 Instalando solo las dependencias de producción...' -ForegroundColor Cyan
Push-Location $salida
npm ci --omit=dev --ignore-scripts
# Herramientas de Prisma que solo se usan en desarrollo (CLI, Studio, base local): el cliente ya
# está compilado en dist, así que se quitan para subir la mitad de archivos (~200 MB en vez de ~400 MB).
'prisma', '@prisma\dev', '@prisma\studio-core', '@prisma\engines', '@prisma\fetch-engine', '@prisma\get-platform', '@electric-sql', 'effect', 'typescript' |
  ForEach-Object { $p = Join-Path 'node_modules' $_; if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
Pop-Location

Write-Host '5/5 Comprimiendo...' -ForegroundColor Cyan
$zip = Join-Path $PSScriptRoot 'siven-sitio.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $salida '*') -DestinationPath $zip
if (Select-String -Path (Join-Path $salida 'web.config') -Pattern 'CAMBIAR' -Quiet) {
  Write-Host 'ATENCIÓN: web.config todavía tiene valores CAMBIAR.' -ForegroundColor Red
}
Write-Host "Listo: $zip" -ForegroundColor Green
