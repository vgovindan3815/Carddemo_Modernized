# CardDemo Modernization - Docker Deployment Script (Windows PowerShell)

param(
    [string]$BackendPort = "3000",
    [string]$FrontendPort = "80",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

Write-Host " CardDemo Modernization - Docker Deployment (Windows)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$ProjectName = "carddemo-modernized"

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ  $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host " $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Yellow
}

Write-Info "Checking prerequisites..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker not found. Please install Docker Desktop for Windows."
    exit 1
}

if (-not (Get-Command docker-compose -ErrorAction SilentlyContinue)) {
    Write-Warning "Docker Compose not found. Please install Docker Compose."
    exit 1
}

Write-Success "Docker and Docker Compose found"

try {
    docker ps > $null 2>&1
} catch {
    Write-Warning "Docker daemon is not running. Please start Docker Desktop."
    exit 1
}

Write-Success "Docker daemon is running"

Write-Info "Building Docker images..."
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Build failed"
    exit 1
}

Write-Success "Docker images built successfully"

Write-Info "Stopping existing containers..."
docker-compose down 2>$null

Write-Info "Starting services..."
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Failed to start services"
    exit 1
}

Write-Success "Services started"

Write-Info "Waiting for backend to be ready..."
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    try {
        $response = docker-compose exec -T backend node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend is ready"
            break
        }
    } catch {
        # Continue waiting
    }
    $attempt++
    Start-Sleep -Seconds 2
}

if ($attempt -eq $maxAttempts) {
    Write-Warning "Backend health check timed out, but services are running"
}

Write-Host ""
Write-Host " Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Access the application:"
Write-Host "  Frontend:  http://localhost:$FrontendPort" -ForegroundColor Yellow
Write-Host "  Backend:   http://localhost:$BackendPort/api/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs:      docker-compose logs -f" -ForegroundColor Cyan
Write-Host "  Stop services:  docker-compose down" -ForegroundColor Cyan
Write-Host "  Remove data:    docker-compose down -v" -ForegroundColor Cyan
Write-Host ""
