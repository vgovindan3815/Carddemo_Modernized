# Quick Start Deployment Guide

## Option 1: Unified Dashboard via Wrapper (Recommended) - 5 Minutes

The **Wrapper** provides a central launcher dashboard with health monitoring for all project services.

### Windows PowerShell
```powershell
# Navigate to Wrapper folder
cd ..\Wrapper
npm install  # (if first time)
npm start

# Wrapper dashboard opens automatically at http://localhost:8080
```

### macOS/Linux
```bash
# Navigate to Wrapper folder
cd ../Wrapper
npm install  # (if first time)
npm start

# Open http://localhost:8080 in browser
```

**Done!** The wrapper dashboard shows:
- ✅ Service health status for all components
- 🔗 Direct links to CardDemo (Legacy), Railcar, and other projects
- 📊 Real-time health monitoring (3-second auto-refresh)

## Option 2: Docker Deployment (Full Stack)

### Windows PowerShell (Admin)
```powershell
# From legacy-cobol-modernization-workspace directory
.\deploy\deploy-docker.ps1
```

### macOS/Linux
```bash
# From legacy-cobol-modernization-workspace directory
chmod +x deploy/deploy-docker.sh
./deploy/deploy-docker.sh
```

**Done!** Visit http://localhost

## Option 3: Local Development (Manual Start)

### Prerequisites
- Node.js 18+
- npm 9+

### Terminal 1 - Start Backend
```bash
cd backend
npm install  # (if first time)
npm start
# Backend runs at http://localhost:3000
```

### Terminal 2 - Start Frontend
```bash
cd frontend
npm install  # (if first time)
npm start
# Frontend runs at http://localhost:4200
```

### Terminal 3 - Access Services
- **Application**: http://localhost:4200
- **API Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health

## Access Points

### Via Wrapper (Recommended)
| Component | URL | Purpose |
|-----------|-----|---------|
| Dashboard | http://localhost:8080 | Project launcher & health monitoring |
| CardDemo | http://localhost:8080/carddemo | Link to legacy application |

### Direct Access (if running individually)
| Component | URL | Purpose |
|-----------|-----|---------|
| Frontend | http://localhost:4200 | Application UI |
| Backend API | http://localhost:3000 | REST endpoints |
| API Docs | http://localhost:3000/api-docs | Swagger documentation |
| Health | http://localhost:3000/api/health | Service health status |

## Default Credentials

**Admin User:**
```
User ID: A0000001
Password: Passw0rd
```

## Quick Stop

### If using Wrapper
```bash
# Press Ctrl+C in Wrapper terminal
```

### If using Docker
```bash
docker-compose down
```

### If using Local Development
```bash
# Press Ctrl+C in each terminal (Backend, Frontend, Wrapper)
```

## Troubleshooting

### Wrapper won't start
```bash
# Clear node_modules and reinstall
cd Wrapper
rm -rf node_modules package-lock.json
npm install
npm start
```

### Port 8080 already in use
```powershell
# Windows: Find and kill process using port 8080
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8080
kill -9 <PID>
```

### Services not showing in Wrapper
1. Ensure each service is running on correct port:
   - Legacy Backend: 3000
   - Legacy Frontend: 4000
   - Railcar Backend: 3100
2. Refresh browser (F5)
3. Check health endpoint manually: `curl http://localhost:3000/api/health`

## Documentation

- [Full Application Guide](./LEGACY_APPLICATION_GUIDE.md)
- [Detailed Deployment Guide](./DEPLOYMENT_SUMMARY.md)
- [System Specifications](./specs.md)
- [Batch Processing Guide](./batch_specs.md)

## Next Steps

1. Start wrapper or services using one of the options above
2. Login with default admin credentials
3. Explore Account Inquiry, Card Inquiry, Transactions
4. Try Bill Payment or Authorization Management
5. (Admin) Access User Maintenance for RBAC operations

See [DEPLOYMENT_SUMMARY.md](./DEPLOYMENT_SUMMARY.md) for complete documentation.
