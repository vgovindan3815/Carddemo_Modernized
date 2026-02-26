# Legacy Application - CardDemo ONLINE Modernization Guide

## 📋 Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Core Features](#core-features)
5. [User Roles & Access Control](#user-roles--access-control)
6. [Getting Started](#getting-started)
7. [API Endpoints](#api-endpoints)
8. [Database Schema](#database-schema)
9. [Authentication Flow](#authentication-flow)
10. [Deployment Options](#deployment-options)
11. [Development Guidelines](#development-guidelines)
12. [Troubleshooting](#troubleshooting)

---

## Application Overview

### What is CardDemo?

**CardDemo ONLINE** is a modernized web application that replaces the original COBOL/CICS (Customer Information Control System) mainframe application. It provides a comprehensive credit card management system with online transaction processing capabilities.

### Original Legacy System
- **Platform**: IBM CICS (mainframe)
- **Language**: COBOL with BMS (Basic Mapping Support) screens
- **Database**: VSAM files
- **Terminal Interface**: Text-based green screens

### Modernized Application
- **Frontend**: Angular 18+ (responsive web UI)
- **Backend**: Node.js + Express.js (REST API)
- **Database**: SQLite (relational)
- **Deployment**: Docker containerized

### Purpose
CardDemo enables financial institutions to:
- Manage customer accounts and credit cards
- Process online transactions and bill payments
- Maintain user security and access control
- Generate reports and authorization tracking
- Provide role-based administrative functions

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Angular Frontend (Port 4000)           │
│          (Responsive Web UI with Bootstrap/CSS)          │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST API calls
┌──────────────────────▼──────────────────────────────────┐
│              Express.js Backend (Port 3000)              │
│         (REST API, Authentication, Business Logic)       │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL queries
┌──────────────────────▼──────────────────────────────────┐
│           SQLite Database (carddemo.db)                 │
│    (Customers, Accounts, Cards, Transactions, Users)    │
└─────────────────────────────────────────────────────────┘
```

### Component Structure

```
legacy-cobol-modernization-workspace/
├── frontend/                 # Angular application
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # UI components
│   │   │   ├── services/     # HTTP services
│   │   │   ├── models/       # TypeScript interfaces
│   │   │   └── app.component.ts
│   │   ├── styles/
│   │   └── main.ts
│   └── angular.json
├── backend/                  # Node.js Express application
│   ├── src/
│   │   ├── app.js           # Main Express app
│   │   ├── db.js            # SQLite initialization
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── constants.js     # System constants
│   │   └── errors.js        # Error handling
│   └── package.json
├── data/                     # Sample data files
├── deploy/                   # Docker deployment scripts
└── docker-compose.yml        # Container orchestration
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Angular | 18+ | SPA framework |
| TypeScript | Latest | Type-safe JavaScript |
| Bootstrap | 5+ | CSS framework |
| RxJS | Latest | Reactive programming |
| Angular Forms | Latest | Form handling & validation |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| Express.js | 4.x | Web framework |
| SQLite3 | Latest | Relational database |
| Bcryptjs | Latest | Password hashing |
| Zod | Latest | Schema validation |
| Pino | Latest | Structured logging |

### DevOps & Deployment
| Tool | Purpose |
|------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Git | Version control |
| npm | Package management |

---

## Core Features

### 1. **Authentication & Authorization**
- Secure login with username/password
- Session-based authentication with 1-hour timeout
- Role-based access control (Admin / Standard User)
- Password encryption with bcryptjs

### 2. **User Management** (Admin Only)
- List all users with pagination
- Create new users
- Update existing users
- Delete users
- User type assignment (Admin/Standard)

### 3. **Account Management**
- View all customer accounts with search/filter
- Account detail view with customer information
- Account inquiry (balance, credit limits, status)
- Update account information
- Account activity history

### 4. **Card Management**
- List cards associated with accounts
- Card detail viewing
- Add new cards to accounts
- Card status management (Active/Inactive)
- Card-on-file for bill payment

### 5. **Transaction Processing**
- View transaction history
- Transaction detail inquiry
- Add new transactions
- Transaction search with filters
- Generate transaction reports

### 6. **Bill Payment**
- Process online bill payments
- Card selection (card-on-file)
- Payment history tracking
- Batch payment submission
- Payment confirmation

### 7. **Authorization Management**
- View pending authorizations list (CPVS equivalent)
- Authorization detail view (CPVD equivalent)
- Mark authorizations as fraud
- Filter by authorization status (Pending/Matched/Declined/Error)
- Authorization summary reporting

### 8. **Reports**
- Submit batch report requests
- Track report generation status
- Report history inquiry
- Export capabilities

---

## User Roles & Access Control

### User Types

#### 1. **Standard User (Type: 'U')**
Access to operational flows:
- ✅ Account inquiry
- ✅ Card inquiry
- ✅ Transaction inquiry & detail
- ✅ Bill payment submission
- ✅ Report viewing
- ✅ Authorization viewing
- ❌ User administration
- ❌ Restricted operations

#### 2. **Administrator (Type: 'A')**
All standard user access PLUS:
- ✅ User maintenance (CRUD operations)
- ✅ System administration console
- ✅ Configuration management
- ✅ User activity audit

### Default Admin Credentials
```
User ID: A0000001
Password: Passw0rd
```

### Role-Based Menu Options

**Main Menu (All Users)**
```
1. Account Inquiry
2. Card Inquiry  
3. Transaction Inquiry
4. Add Transaction
5. Bill Payment
6. Account Maintenance
7. Card Maintenance
8. User Maintenance (Admin Only)
9. Report Submission
10. Pending Authorizations
11. Logout
```

---

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher
- Docker & Docker Compose (for containerized deployment)
- Git

### Installation Steps

#### 1. Clone Repository
```bash
git clone https://github.com/vgovindan3815/Carddemo_Modernized.git
cd Carddemo_Modernized
```

#### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
cd ..
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

#### 3. Start Services (Local Development)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Backend runs on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
# Frontend runs on http://localhost:4200
```

#### 4. Access Application
- **Frontend**: http://localhost:4200
- **API Docs**: http://localhost:3000/api-docs
- **Backend Health**: http://localhost:3000/api/health

### Quick Start with Docker

```bash
# Windows (PowerShell as Admin)
.\deploy\deploy-docker.ps1

# macOS/Linux
chmod +x deploy/deploy-docker.sh
./deploy/deploy-docker.sh

# Access at http://localhost
```

---

## API Endpoints

### Authentication
```
POST   /api/v1/auth/login           Login with userId/password
POST   /api/v1/auth/logout          Logout current user
GET    /api/v1/auth/verify          Verify session
```

### Users (Admin Only)
```
GET    /api/v1/users                List all users
POST   /api/v1/users                Create new user
GET    /api/v1/users/:userId        Get user details
PUT    /api/v1/users/:userId        Update user
DELETE /api/v1/users/:userId        Delete user
```

### Accounts
```
GET    /api/v1/accounts             List accounts (with search/pagination)
GET    /api/v1/accounts/:accountId  Get account details
POST   /api/v1/accounts             Create new account
PUT    /api/v1/accounts/:accountId  Update account
```

### Cards
```
GET    /api/v1/cards                List all cards
GET    /api/v1/accounts/:accountId/cards   Get cards for account
POST   /api/v1/cards                Add new card
PUT    /api/v1/cards/:cardId        Update card
```

### Transactions
```
GET    /api/v1/transactions         List transactions
GET    /api/v1/accounts/:accountId/transactions   Transactions for account
GET    /api/v1/transactions/:transId   Get transaction detail
POST   /api/v1/transactions         Add new transaction
```

### Bill Payments
```
GET    /api/v1/payments             List payment history
POST   /api/v1/billing/payments     Submit bill payment
GET    /api/v1/billing/payments/:paymentId   Get payment detail
```

### Authorizations
```
GET    /api/v1/authorizations             List pending authorizations
GET    /api/v1/authorizations/:authId     Get authorization detail
POST   /api/v1/authorizations/:authId/fraud   Mark as fraud
```

### Batch Jobs & Reports
```
GET    /api/v1/jobs                 List batch jobs
POST   /api/v1/jobs/submit          Submit new job
POST   /api/v1/jobs/:jobId/cancel   Cancel job
```

### System
```
GET    /api/health                  Health check
GET    /api-docs                    Swagger UI documentation
GET    /api-docs.json               OpenAPI spec
```

---

## Database Schema

### Core Tables

#### **users**
```sql
CREATE TABLE users (
  userId TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  passwordHash TEXT NOT NULL,
  userType TEXT NOT NULL,  -- 'A' (Admin) or 'U' (User)
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);
```

#### **customers**
```sql
CREATE TABLE customers (
  custId INTEGER PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  ssn TEXT NOT NULL,
  dob TEXT,
  ficoScore INTEGER,
  address_line1 TEXT,
  address_line2 TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT,
  phone1 TEXT,
  phone2 TEXT
);
```

#### **accounts**
```sql
CREATE TABLE accounts (
  accountId TEXT PRIMARY KEY,
  custId INTEGER NOT NULL,
  activeStatus TEXT,
  creditLimit REAL,
  cashCreditLimit REAL,
  currBal REAL,
  currCycCredit REAL,
  currCycDebit REAL,
  openDate TEXT,
  expirationDate TEXT,
  reissueDate TEXT,
  FOREIGN KEY (custId) REFERENCES customers(custId)
);
```

#### **cards**
```sql
CREATE TABLE cards (
  cardId TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  cardNum TEXT,
  cardType TEXT,
  expirationDate TEXT,
  status TEXT,
  issuedDate TEXT,
  FOREIGN KEY (accountId) REFERENCES accounts(accountId)
);
```

#### **transactions**
```sql
CREATE TABLE transactions (
  transId TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  transType TEXT,
  amount REAL,
  transDate TEXT,
  description TEXT,
  status TEXT,
  FOREIGN KEY (accountId) REFERENCES accounts(accountId)
);
```

#### **payments**
```sql
CREATE TABLE payments (
  paymentId TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  cardId TEXT,
  amount REAL,
  paymentDate TEXT,
  status TEXT,
  FOREIGN KEY (accountId) REFERENCES accounts(accountId)
);
```

#### **authorizations**
```sql
CREATE TABLE authorizations (
  authId TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  transId TEXT,
  merchantName TEXT,
  merchantCategory TEXT,
  amount REAL,
  authDate TEXT,
  matchStatus TEXT,  -- P (Pending), M (Matched), D (Declined), E (Error)
  isFraudFlag BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (accountId) REFERENCES accounts(accountId)
);
```

---

## Authentication Flow

### Login Flow Diagram

```
1. User enters credentials (userId, password)
   ↓
2. Frontend POST /api/v1/auth/login
   ↓
3. Backend validates credentials against users table
   ↓
4. Password verification with bcryptjs
   ↓
5. Session created (express-session)
   ↓
6. Session cookie returned to browser
   ↓
7. Frontend stores session, redirects to main menu
   ↓
8. Subsequent requests include session cookie
   ↓
9. Backend middleware verifies session
   ↓
10. Request authorized if valid
```

### Session Management
- **Session Timeout**: 1 hour of inactivity
- **Storage**: In-memory (can be configured for Redis)
- **Cookie**: httpOnly, secure flags enabled
- **CORS**: Allowed from http://localhost:4200 and http://localhost:4000

---

## Deployment Options

### Option 1: Local Development

**Requirements:**
- Node.js 18+
- npm 9+
- SQLite3

**Steps:**
```bash
# Backend
cd backend && npm install && npm start

# Frontend (new terminal)
cd frontend && npm install && npm start
```

**Access:** http://localhost:4200

### Option 2: Docker Compose

**Requirements:**
- Docker
- Docker Compose

**Windows:**
```powershell
cd deploy
.\deploy-docker.ps1
```

**macOS/Linux:**
```bash
chmod +x deploy/deploy-docker.sh
./deploy/deploy-docker.sh
```

**Access:** http://localhost

**Stop Services:**
```bash
docker-compose down
```

### Option 3: Docker Manual Build

```bash
# Backend image
docker build -f Dockerfile.backend -t carddemo-backend .

# Frontend image
docker build -f Dockerfile.frontend -t carddemo-frontend .

# Run with docker-compose
docker-compose up -d
```

### Environment Variables

Create `.env` file in backend directory:

```env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
SESSION_SECRET=your-secret-key-here
DATABASE_URL=./data/carddemo.db
CORS_ORIGINS=http://localhost:4200,http://localhost:4000
```

---

## Development Guidelines

### Adding New Features

#### 1. Backend (Express.js)
```javascript
// backend/src/routes/new-feature.js
const express = require('express');
const router = express.Router();

router.get('/:id', (req, res) => {
  try {
    // Business logic
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

#### 2. Frontend (Angular)
```typescript
// frontend/src/app/services/new-feature.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class NewFeatureService {
  constructor(private http: HttpClient) {}

  getFeature(id: string) {
    return this.http.get(`/api/v1/features/${id}`);
  }
}
```

### Code Style
- **Backend**: Follow Express.js conventions, use async/await
- **Frontend**: Follow Angular style guide, use typed components
- **Database**: Use parameterized queries to prevent SQL injection
- **Naming**: camelCase for JS/TS, snake_case for database

### Security Best Practices
- ✅ Always hash passwords with bcryptjs
- ✅ Validate input with Zod schemas
- ✅ Use HTTPS in production
- ✅ Enable CORS only for trusted origins
- ✅ Implement rate limiting for auth endpoints
- ✅ Use parameterized SQL queries
- ✅ Set secure HTTP headers with Helmet

---

## Troubleshooting

### Common Issues

#### Issue: Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 PID  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

#### Issue: Database Locked
```bash
# SQLite database is locked - restart services
docker-compose down
docker-compose up -d
```

#### Issue: CORS Error
Check `backend/src/app.js` CORS configuration:
```javascript
cors({ 
  origin: ['http://localhost:4200', 'http://localhost:4000'],
  credentials: true 
})
```

#### Issue: Login Fails
- Verify user exists: `node list_tables.js` (backend directory)
- Check password is correct: `Passw0rd` (default admin)
- Check session cookie is enabled in browser

#### Issue: Angular Build Errors
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm start
```

### Debugging

#### Backend Logs
```bash
cd backend
LOG_LEVEL=debug npm start
```

#### Frontend Console
- Open Browser DevTools (F12)
- Check Network tab for API calls
- Check Console for JavaScript errors

#### Database Inspection
```bash
# From backend directory
node list_tables.js  # Shows all tables and row counts

# Direct SQLite access
sqlite3 data/carddemo.db
sqlite> SELECT * FROM users;
sqlite> .schema
```

---

## Contact & Support

### Documentation Links
- [Quick Start Guide](./QUICKSTART.md)
- [Specifications](./specs.md)
- [Batch Processing Guide](./batch_specs.md)
- [Deployment Summary](./DEPLOYMENT_SUMMARY.md)
- [API Documentation](http://localhost:3000/api-docs) (when running)

### Repository
- **GitHub**: https://github.com/vgovindan3815/Carddemo_Modernized
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

### Key Contacts
- **Development**: GitHub Issues
- **Deployment**: See DEPLOYMENT_SUMMARY.md
- **Architecture**: Review specs.md and architecture diagrams

---

## License

This project is part of the AWS Mainframe Modernization initiative. Based on the AWS Card Demo modernization from COBOL/CICS to cloud-native technologies.

---

**Last Updated**: February 26, 2026  
**Version**: 1.0 - Modernized CardDemo ONLINE  
**Status**: Production Ready
