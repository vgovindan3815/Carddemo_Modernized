# Quick Start Deployment Guide

## 5-Minute Docker Deployment

### Windows PowerShell (Admin)
`powershell
git clone https://github.com/vgovindan3815/Carddemo_Modernized.git
cd Carddemo_Modernized
.\deploy\deploy-docker.ps1
`
**Done!** Visit http://localhost

### macOS/Linux
`ash
git clone https://github.com/vgovindan3815/Carddemo_Modernized.git
cd Carddemo_Modernized
chmod +x deploy/deploy-docker.sh
./deploy/deploy-docker.sh
`
**Done!** Visit http://localhost

## Access Points

| Component | Docker | 
|-----------|--------|
| Frontend  | http://localhost |
| Backend   | http://localhost:3000 |
| Health    | http://localhost:3000/api/health |

## Stop Services

`ash
docker-compose down
`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete documentation.
