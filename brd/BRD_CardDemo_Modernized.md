# Business Requirements Document
# CardDemo Modernized — Credit Card Account Management System

**Document Version:** 1.0
**Date:** July 1, 2026
**Status:** Final Draft
**Prepared For:** Systems Specification and Development Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Background and Context](#2-business-background-and-context)
3. [Business Objectives](#3-business-objectives)
4. [Project Scope](#4-project-scope)
5. [Stakeholders and User Roles](#5-stakeholders-and-user-roles)
6. [Business Functional Requirements](#6-business-functional-requirements)
   - 6.1 Authentication and Session Management
   - 6.2 User Security Administration
   - 6.3 Account Management
   - 6.4 Credit Card Management
   - 6.5 Transaction Management
   - 6.6 Bill Payment
   - 6.7 Authorization Review
   - 6.8 Transaction Report Requests
   - 6.9 Batch Processing
7. [Business Rules](#7-business-rules)
8. [Data Entities and Relationships](#8-data-entities-and-relationships)
9. [Business Processes and Workflows](#9-business-processes-and-workflows)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Assumptions and Constraints](#11-assumptions-and-constraints)
12. [Out of Scope](#12-out-of-scope)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

CardDemo Modernized is a web-based credit card account management system that replaces a legacy mainframe CICS/COBOL application (the AWS Mainframe Modernization CardDemo reference application). The modernized system delivers the same credit card management capabilities — account inquiry and maintenance, card lifecycle management, transaction posting, bill payment, authorization review, and batch financial processing — through a modern, browser-based interface accessible to both operations staff and administrators.

This document defines the business requirements that a development team must satisfy when building the modernized system. It is intentionally technology-neutral at the business level; a separate Systems Specification document will translate these requirements into a concrete technical architecture and implementation plan.

---

## 2. Business Background and Context

The original CardDemo system was implemented as a set of CICS online transaction programs and batch JCL jobs running on an IBM mainframe. Operations staff accessed the system through 3270 green-screen terminals. Although the system functioned correctly, the terminal-based interface limited usability, the proprietary COBOL/CICS stack is increasingly expensive to support, and the organization wants to migrate to cloud-compatible, open-standard technologies.

The modernization preserves **all existing business behavior** — the same accounts, cards, customers, transactions, authorizations, and batch processes — while replacing the terminal interface with a responsive web application and replacing the COBOL batch runtime with an equivalent batch job execution engine.

The legacy system's data was ingested from the AWS Mainframe Modernization CardDemo sample dataset (fixed-width ASCII files for customers, accounts, cards, card cross-references, and transactions) and now resides in a relational database.

---

## 3. Business Objectives

| # | Objective |
|---|-----------|
| BO-1 | Enable operations staff to manage credit card accounts, cards, customers, and transactions through a modern web browser without requiring a mainframe terminal. |
| BO-2 | Preserve all business rules, validation logic, and workflow behaviors from the legacy CICS system so that day-to-day operations are uninterrupted after cutover. |
| BO-3 | Provide role-based access control so that administrative functions (user management) are restricted to authorized administrators and operational functions are available to standard users. |
| BO-4 | Automate recurring financial batch operations (daily transaction posting, monthly interest calculation, transaction reporting, statement generation, data backup) in a way that operations staff can monitor and control through a web interface. |
| BO-5 | Enable authorized users to review pending card authorizations and flag suspicious transactions as fraud without requiring mainframe access. |
| BO-6 | Serve as a demonstrable, buildable reference application that practitioners can use to learn modern full-stack development with the assistance of AI coding tools. |

---

## 4. Project Scope

### 4.1 Online (Interactive) Modules

| Module | Description |
|--------|-------------|
| Authentication | Sign-on, sign-out, session management |
| User Administration | List, create, update, and delete system users (Admin only) |
| Account Management | View and update credit card accounts and associated customer records |
| Card Management | List, view, and update credit cards |
| Transaction Management | List, view, and manually add transactions |
| Bill Payment | Post payments against accounts |
| Authorization Review | View pending authorizations and flag fraud |
| Report Requests | Request transaction reports (monthly, yearly, or custom date range) |

### 4.2 Batch Processing Modules

| Batch Job | Description |
|-----------|-------------|
| POSTTRAN | Post daily transactions from the transaction table to account balances |
| INTCALC | Calculate and post interest and charges based on category balances and discount group rates |
| CREASTMT | Generate periodic account statements in text and HTML format |
| TRANREPT | Produce filtered transaction reports enriched with type and category descriptions |
| TRANBKP | Back up the transaction dataset to an output directory |
| ACCTFILE | Import account data from a fixed-width flat file into the accounts table |
| CUSTFILE | Import customer data from a fixed-width flat file into the customers table |
| CARDFILE | Import card and card cross-reference data from flat files |
| CBEXPORT | Export all core entity data (customers, accounts, cards, cross-references, transactions) to a unified export file |
| CBIMPORT | Import a unified export file back into entity-specific tables |

### 4.3 Explicitly Not in Scope

- Legacy 3270 terminal interface reproduction
- Real-time authorization decisioning (the system reviews post-authorization records, it does not approve or decline in real time)
- Card embossing or physical issuance workflows
- External payment network integrations (Visa/Mastercard processing networks)
- Core banking system integrations
- Mobile native applications

---

## 5. Stakeholders and User Roles

### 5.1 User Roles

| Role Code | Role Name | Description |
|-----------|-----------|-------------|
| `U` | Standard User | Operations staff. Can access account inquiry, card inquiry, transaction management, bill payment, authorization review, and report requests. Cannot manage system users. |
| `A` | Administrator | Has all Standard User access plus user security administration (create, update, delete system users). |

### 5.2 Role-to-Module Access Matrix

| Module | Standard User | Administrator |
|--------|:---:|:---:|
| Sign-on / Sign-out | ✓ | ✓ |
| Account View | ✓ | ✓ |
| Account Update | ✓ | ✓ |
| Card List / View | ✓ | ✓ |
| Card Update | ✓ | ✓ |
| Transaction List / View | ✓ | ✓ |
| Transaction Add | ✓ | ✓ |
| Bill Payment | ✓ | ✓ |
| Authorization Review | ✓ | ✓ |
| Report Requests | ✓ | ✓ |
| Batch Job Submission | ✓ | ✓ |
| User List / Add / Update / Delete | — | ✓ |
| Admin Menu | — | ✓ |

---

## 6. Business Functional Requirements

### 6.1 Authentication and Session Management

**Purpose:** Allow authorized staff to sign in, access role-appropriate functions, and sign out securely.

| ID | Requirement |
|----|-------------|
| AUTH-1 | The system shall present a sign-on page that requires a User ID and Password. |
| AUTH-2 | The system shall authenticate the user against the user security store. |
| AUTH-3 | If the User ID does not exist, the system shall display: *"Unknown User ID"*. |
| AUTH-4 | If the Password does not match, the system shall display: *"Wrong Password. Try again …"*. |
| AUTH-5 | If either the User ID or Password field is blank, the system shall display an appropriate missing-field error message and not attempt authentication. |
| AUTH-6 | Upon successful sign-on, the system shall establish a session identifying the user and their role, and navigate the user to the Main Menu. |
| AUTH-7 | The session shall carry the user's identity and role for the duration of their interaction. |
| AUTH-8 | The system shall provide a Sign-out action on all authenticated pages that terminates the session and returns the user to the sign-on page. |
| AUTH-9 | All pages except the sign-on page shall require an active session; an expired or absent session shall redirect the user to the sign-on page. |

---

### 6.2 User Security Administration

**Purpose:** Allow administrators to manage the set of users who can access the system.

**Access:** Administrator role only.

#### 6.2.1 User List

| ID | Requirement |
|----|-------------|
| USR-1 | The system shall display a paginated list of all system users. |
| USR-2 | The list shall show each user's User ID, first name, last name, and role. |
| USR-3 | The administrator shall be able to search/filter the list by User ID prefix. |
| USR-4 | The administrator shall be able to page forward and backward through the list. |
| USR-5 | From the list, the administrator shall be able to select a user to update or delete. |

#### 6.2.2 Add User

| ID | Requirement |
|----|-------------|
| USR-6 | The system shall provide a form to create a new user with: First Name, Last Name, User ID, Password, and User Type (role). |
| USR-7 | All fields are required; the system shall reject submission with field-level error messages if any field is blank. |
| USR-8 | The User ID must be unique; if a duplicate is submitted, the system shall display: *"User ID already exist…"*. |
| USR-9 | User Type must be a valid role code (`A` for Admin, `U` for Standard User). |
| USR-10 | On successful creation, the system shall confirm that the user was created. |

#### 6.2.3 Update User

| ID | Requirement |
|----|-------------|
| USR-11 | The administrator shall enter a User ID to retrieve the user's current details for editing. |
| USR-12 | If the User ID does not exist, the system shall display: *"User ID NOT found…"*. |
| USR-13 | The administrator may update: First Name, Last Name, Password, and User Type. |
| USR-14 | All fields remain mandatory for the update operation. |
| USR-15 | On success, the system shall confirm the update. |

#### 6.2.4 Delete User

| ID | Requirement |
|----|-------------|
| USR-16 | The administrator shall enter a User ID to retrieve the user record for deletion review. |
| USR-17 | If the User ID is blank, the system shall display: *"User ID can NOT be empty…"*. |
| USR-18 | If the User ID does not exist, the system shall display: *"User ID NOT found…"*. |
| USR-19 | After retrieving the user record, the system shall prompt the administrator to confirm deletion before proceeding. |
| USR-20 | On confirmation, the system shall permanently delete the user record. |

---

### 6.3 Account Management

**Purpose:** Allow staff to view and maintain credit card account records and the associated customer information.

#### 6.3.1 Account List

| ID | Requirement |
|----|-------------|
| ACCT-1 | The system shall display a paginated list of all accounts showing Account ID, status, current balance, credit limit, expiration date, and the cardholder's name. |
| ACCT-2 | The list shall support search/filter and sorting. |
| ACCT-3 | The staff member shall be able to page forward and backward through the list. |
| ACCT-4 | From the list, the staff member shall be able to select an account to view its full detail. |

#### 6.3.2 Account Detail View

| ID | Requirement |
|----|-------------|
| ACCT-5 | The account detail view shall display the full account record: Account ID, active status, current balance, credit limit, cash credit limit, current cycle credit, current cycle debit, open date, expiration date, reissue date, address ZIP, and group ID. |
| ACCT-6 | The account detail view shall also display the associated customer information: name, address, SSN (masked), date of birth, FICO score, phone numbers, government ID, EFT account ID, and primary holder indicator. |
| ACCT-7 | The account detail view shall list the cards associated with the account. |
| ACCT-8 | From the account detail view, the staff member shall be able to initiate a bill payment for that account. |
| ACCT-9 | If the account has multiple cards on file, the system shall present a card selection option during bill payment initiation. |
| ACCT-10 | If the account has no cards on file, the system shall present an option to add a card and pay. |

#### 6.3.3 Account Update

| ID | Requirement |
|----|-------------|
| ACCT-11 | The staff member shall be able to update the following account fields: active status, credit limit, cash credit limit, current balance, current cycle credit, current cycle debit, open date, expiration date, reissue date, address ZIP, and group ID. |
| ACCT-12 | The staff member shall be able to update the following customer fields on the same form: first name, middle name, last name, SSN, date of birth, FICO score, address lines (1–3), state, country, ZIP, phone numbers (up to 2), government ID, EFT account ID, and primary holder indicator. |
| ACCT-13 | All mandatory fields must be populated; the system shall display field-level errors for missing or invalid values. |
| ACCT-14 | Date fields (open date, expiration date, reissue date, date of birth) must be valid calendar dates. |
| ACCT-15 | Numeric/monetary fields (credit limits, balances) must be in valid decimal format. |
| ACCT-16 | SSN must conform to a valid structure. |
| ACCT-17 | Phone numbers must conform to a valid area-code and number format. |
| ACCT-18 | The system shall require explicit confirmation before saving account changes. |
| ACCT-19 | On confirmation and successful save, the system shall notify the staff member that the update was applied. |

---

### 6.4 Credit Card Management

**Purpose:** Allow staff to view cards associated with accounts and update card details.

#### 6.4.1 Card List

| ID | Requirement |
|----|-------------|
| CRD-1 | The system shall display a paginated list of cards. |
| CRD-2 | The list shall be filterable by Account ID and/or Card Number. |
| CRD-3 | The list shall show Card Number, Account ID, embossed name, expiration date, and active status. |
| CRD-4 | The staff member shall be able to page forward and backward through the list. |
| CRD-5 | If no records match the filter, the system shall display an appropriate empty-state message. |

#### 6.4.2 Card Detail View

| ID | Requirement |
|----|-------------|
| CRD-6 | The card detail view shall display: Card Number, embossed name, active status, expiration date, CVV/secret code (masked), associated Account ID, current account balance, and cardholder name. |

#### 6.4.3 Card Update

| ID | Requirement |
|----|-------------|
| CRD-7 | The staff member shall be able to update: embossed name, active status, and expiration date. |
| CRD-8 | The embossed name must not be blank. |
| CRD-9 | Active status must be a valid status code. |
| CRD-10 | The expiration date must be a valid future date (valid month and year). |
| CRD-11 | The system shall require explicit confirmation before saving card changes. |
| CRD-12 | On confirmation and successful save, the system shall notify the staff member that the update was applied. |

---

### 6.5 Transaction Management

**Purpose:** Allow staff to view transaction history and manually post new transactions.

#### 6.5.1 Transaction List

| ID | Requirement |
|----|-------------|
| TXN-1 | The system shall display a paginated list of transactions with columns for Transaction ID, type code, category code, amount, merchant name, card number, and processing timestamp. |
| TXN-2 | The list shall support filtering and sorting. |
| TXN-3 | The staff member shall be able to page forward and backward through the list. |
| TXN-4 | The staff member shall be able to select a transaction to view its full detail. |
| TXN-5 | If no transactions match the filter, the system shall display an appropriate empty-state message. |

#### 6.5.2 Transaction Detail View

| ID | Requirement |
|----|-------------|
| TXN-6 | The transaction detail view shall display: Transaction ID, type code, category code, source, description, amount, merchant ID, merchant name, merchant city, merchant ZIP, card number, origination timestamp, and processing timestamp. |

#### 6.5.3 Add Transaction

| ID | Requirement |
|----|-------------|
| TXN-7 | The system shall provide a form to manually post a new transaction. |
| TXN-8 | All of the following fields are required: Account ID, Card Number, Transaction Type Code, Transaction Category Code, Source, Description, Amount, Origination Date, Processing Date, Merchant ID, Merchant Name, Merchant City, and Merchant ZIP. |
| TXN-9 | The Account ID must exist in the system. |
| TXN-10 | The Card Number must be associated with the specified Account ID. |
| TXN-11 | Origination Date and Processing Date must be valid calendar dates. |
| TXN-12 | Amount must be a valid signed decimal value. |
| TXN-13 | The system shall require explicit confirmation (Y/N) before posting the transaction. |
| TXN-14 | On confirmation, the system shall post the transaction and confirm successful creation. |

---

### 6.6 Bill Payment

**Purpose:** Allow staff to post a bill payment for a customer's account, reducing the account balance and creating a payment transaction record.

| ID | Requirement |
|----|-------------|
| BILL-1 | The system shall provide a bill payment form requiring: Account ID and Payment Amount. |
| BILL-2 | The Account ID must exist in the system. |
| BILL-3 | The staff member may optionally provide payment card details: Card Number, Expiration Date, and CVV/Secret Code. |
| BILL-4 | If card details are already on file for the account, the system shall auto-populate those details on the form. |
| BILL-5 | The CVV/Secret Code field shall be masked by default, with a show/hide toggle. |
| BILL-6 | The system shall require explicit confirmation (Y/N) before posting the payment. |
| BILL-7 | Upon posting, the system shall: (a) create a payment transaction record linked to the account, and (b) reduce the account's current balance by the payment amount. These two operations must succeed or fail together — partial posting is not acceptable. |
| BILL-8 | On success, the system shall display the updated account balance and the payment transaction ID. |
| BILL-9 | If card details are supplied, the system shall save or update those card details on file for the account for future reuse. |

---

### 6.7 Authorization Review

**Purpose:** Allow staff to review pending card authorizations and flag fraudulent activity.

#### 6.7.1 Pending Authorizations List

| ID | Requirement |
|----|-------------|
| AUTH-ADV-1 | The system shall display a paginated list of authorization records. |
| AUTH-ADV-2 | The list shall be filterable by Account ID, Card Number, and Match Status. |
| AUTH-ADV-3 | Match Status values are: **P** (Pending), **M** (Matched), **D** (Declined), **E** (Error). |
| AUTH-ADV-4 | The list shall show: Authorization ID, account, card, authorization date/time, amount, merchant, and match status. |
| AUTH-ADV-5 | The staff member shall be able to select an authorization to view its full detail. |

#### 6.7.2 Authorization Detail View

| ID | Requirement |
|----|-------------|
| AUTH-ADV-6 | The authorization detail view shall display: Authorization ID, Account ID, Card Number, authorization date and time, original date and time, authorization type (Purchase/Cash), message source (POS/ATM/Web), transaction amount, approved amount, merchant category code, merchant name and location, authorization response code, response reason, match status, and fraud flag. |
| AUTH-ADV-7 | The authorization response codes are: `00` = Approved, `51` = Insufficient Funds, `54` = Expired Card, `05` = Do Not Honor. |

#### 6.7.3 Fraud Flagging

| ID | Requirement |
|----|-------------|
| AUTH-ADV-8 | From the authorization detail view, the staff member shall be able to mark the authorization as fraudulent. |
| AUTH-ADV-9 | Once flagged as fraud, the system shall record the fraud flag and the date of the fraud report on the authorization record. |
| AUTH-ADV-10 | A fraud flag, once set, shall not be reversible through the online interface. |

---

### 6.8 Transaction Report Requests

**Purpose:** Allow staff to request transaction reports covering a specified time period. Reports are generated asynchronously by the batch processing system.

| ID | Requirement |
|----|-------------|
| RPT-1 | The system shall provide a report request form with three report type options: **Monthly**, **Yearly**, and **Custom date range**. |
| RPT-2 | For Monthly reports, the staff member shall provide the report month and year. |
| RPT-3 | For Yearly reports, the staff member shall provide the report year. |
| RPT-4 | For Custom reports, the staff member shall provide both a start date and an end date. |
| RPT-5 | All date fields must be populated and must represent valid calendar dates. |
| RPT-6 | The system shall require explicit confirmation (Y/N) before submitting the request. |
| RPT-7 | On confirmation, the system shall queue the report request for asynchronous batch processing. |
| RPT-8 | The system shall confirm to the staff member that the report request has been queued, displaying a request ID. |
| RPT-9 | The staff member shall be able to view a history of previously submitted report requests, including their status (Queued, Processing, Completed, Failed). |

---

### 6.9 Batch Processing

**Purpose:** Allow operations staff to submit, monitor, and manage batch jobs that perform periodic financial operations.

#### 6.9.1 Job Submission

| ID | Requirement |
|----|-------------|
| BATCH-1 | The system shall provide a batch job submission page listing all available batch jobs. |
| BATCH-2 | Depending on the job selected, the system shall present the appropriate input parameters (e.g., processing date, date range, input file path, output directory path). |
| BATCH-3 | Date parameter fields shall use date picker controls. |
| BATCH-4 | Upon submission, the system shall create a job run record, return a Job Run ID, and begin processing the job asynchronously. |
| BATCH-5 | The system shall reject submission of a job that is already actively running (to prevent duplicate runs). |

#### 6.9.2 Job Run Monitoring

| ID | Requirement |
|----|-------------|
| BATCH-6 | The system shall display a paginated list of all job runs with: Job Name, Job Run ID, start time, end time, and status. |
| BATCH-7 | The list shall be filterable by Job Name, Status, and date range. |
| BATCH-8 | Job Run Status values are: **Queued**, **Running**, **Succeeded**, **Failed**, **Cancelled**. |
| BATCH-9 | The staff member shall be able to drill into a job run to see step-level detail: step name, legacy program name, status, return code, start time, and end time. |
| BATCH-10 | The staff member shall be able to view the consolidated execution log for a job run. |
| BATCH-11 | The staff member shall be able to list and download output artifacts produced by a job run (reports, extracts, backup files, statement files). |

#### 6.9.3 Restart and Replay

| ID | Requirement |
|----|-------------|
| BATCH-12 | For jobs that failed mid-run, the system shall support restarting the job from the point of failure rather than from the beginning. |
| BATCH-13 | The system shall also support a full rerun (replay from first step) of any completed or failed job run. |

#### 6.9.4 Key Batch Job Behaviors

| Job | Business Behavior |
|-----|-------------------|
| **POSTTRAN** | Reads unposted transactions from the transaction table and posts them to the corresponding account balances. Posting is idempotent — re-running the job will not double-post already-posted transactions. Invalid transactions are rejected and recorded separately. |
| **INTCALC** | Calculates interest and service charges based on each account's transaction category balance and the applicable discount group rate. Posts resulting charge transactions and updates account and category balances. Requires a processing date parameter. |
| **CREASTMT** | Generates account statements in text and HTML formats from transaction, account, customer, and cross-reference data. Output files are stored as artifacts. |
| **TRANREPT** | Produces a transaction report filtered by a date range. Enriches raw transactions with transaction type descriptions and category descriptions. Output is stored as a report artifact. |
| **TRANBKP** | Creates a backup copy of all transaction records in JSON and summary text formats. Output directory is configurable. |
| **ACCTFILE** | Loads account records from a fixed-width flat file into the accounts table. Supports upsert (insert new, update existing). Handles signed-decimal (overpunch) encoded amount fields. |
| **CUSTFILE** | Loads customer records from a fixed-width flat file into the customers table. Supports upsert. |
| **CARDFILE** | Loads card and card cross-reference records from flat files into the cards and card cross-reference tables. Supports upsert. |
| **CBEXPORT** | Exports all core business entities (customers, accounts, cards, cross-references, transactions) into a single unified export file. |
| **CBIMPORT** | Reads a unified export file and distributes records into entity-specific tables. Errors are captured in a separate error output. |

#### 6.9.5 Recurring Batch Chains (Scheduler Orchestration)

The following chains are executed on a scheduled basis by an external scheduler. The batch system must be able to execute these sequences and handle intermediate failures:

| Chain | Trigger | Sequence |
|-------|---------|----------|
| Daily Transaction Backup | Daily | Close Files → TRANBKP → Wait → Open Files |
| Monthly Interest Calculation | Monthly | Close Files → INTCALC → Combine Transactions → Wait → Open Files |
| Weekly Disclosure Group Refresh | Weekly | Close Files → DISCGRP load → Wait → Open Files |

---

## 7. Business Rules

### 7.1 Authentication

| Rule ID | Rule |
|---------|------|
| BR-AUTH-1 | A user must have a record in the user security store to sign in. |
| BR-AUTH-2 | The password entered must exactly match the stored password for the user. |
| BR-AUTH-3 | The user's role (Admin or Standard User) determines which menu options and system functions are available after sign-on. |
| BR-AUTH-4 | Only users with the Admin role may access user administration functions. |

### 7.2 User Administration

| Rule ID | Rule |
|---------|------|
| BR-USR-1 | User IDs must be unique across all system users. |
| BR-USR-2 | All user fields (first name, last name, user ID, password, user type) are mandatory when creating or updating a user. |
| BR-USR-3 | User deletion requires the administrator to first retrieve the user record and then explicitly confirm the deletion action. |
| BR-USR-4 | Valid user type values are `A` (Admin) and `U` (Standard User). |

### 7.3 Account and Customer Maintenance

| Rule ID | Rule |
|---------|------|
| BR-ACCT-1 | All mandatory account and customer fields must be populated before an update can be saved. |
| BR-ACCT-2 | Account dates (open date, expiration date, reissue date) and customer date of birth must be valid calendar dates. |
| BR-ACCT-3 | Monetary fields (credit limit, cash credit limit, balances) must be in valid signed decimal format. |
| BR-ACCT-4 | SSN must conform to a valid format. |
| BR-ACCT-5 | Phone numbers must conform to a valid area-code and 7-digit format. |
| BR-ACCT-6 | Account updates require explicit confirmation before they are written. |

### 7.4 Card Maintenance

| Rule ID | Rule |
|---------|------|
| BR-CRD-1 | The embossed name on a card must not be blank. |
| BR-CRD-2 | A card's expiration date must represent a valid future month and year. |
| BR-CRD-3 | Card updates require explicit confirmation before they are written. |

### 7.5 Transaction Posting

| Rule ID | Rule |
|---------|------|
| BR-TXN-1 | A manually posted transaction must reference an existing Account ID. |
| BR-TXN-2 | The Card Number specified must be linked to the Account ID specified. |
| BR-TXN-3 | All mandatory transaction fields must be present and valid before posting. |
| BR-TXN-4 | Transaction origination and processing dates must be valid calendar dates. |
| BR-TXN-5 | Transaction posting requires explicit confirmation (Y/N response). |

### 7.6 Bill Payment

| Rule ID | Rule |
|---------|------|
| BR-BILL-1 | A bill payment must reference an existing Account ID. |
| BR-BILL-2 | Bill payment requires explicit confirmation before it is posted. |
| BR-BILL-3 | Posting a bill payment must atomically create a payment transaction record AND reduce the account balance. Either both operations succeed, or neither is applied. |

### 7.7 Authorization Review

| Rule ID | Rule |
|---------|------|
| BR-AUTH-ADV-1 | Authorization Match Status values are restricted to: P (Pending), M (Matched), D (Declined), E (Error). |
| BR-AUTH-ADV-2 | An authorization flagged as fraud (`F`) shall have its fraud flag date recorded at the time of flagging. |
| BR-AUTH-ADV-3 | Fraud flags cannot be reversed through the online system. |

### 7.8 Report Requests

| Rule ID | Rule |
|---------|------|
| BR-RPT-1 | A report request must specify a valid report type (Monthly, Yearly, or Custom). |
| BR-RPT-2 | Custom reports require both a start date and an end date. |
| BR-RPT-3 | All date fields must be valid calendar dates. |
| BR-RPT-4 | Report requests must be confirmed before queuing. |
| BR-RPT-5 | Report generation is asynchronous; the online system queues the request and the batch system processes it separately. |

### 7.9 Batch Processing

| Rule ID | Rule |
|---------|------|
| BR-BATCH-1 | The POSTTRAN job is idempotent: re-running it will not post the same transactions more than once. |
| BR-BATCH-2 | Batch jobs that modify account balances must ensure the modification is atomic. |
| BR-BATCH-3 | Invalid transactions encountered by POSTTRAN must be rejected and recorded separately, not silently dropped. |
| BR-BATCH-4 | A job run may be restarted from the failed step or fully replayed from the beginning. |
| BR-BATCH-5 | Duplicate active runs of the same job are not permitted. |

---

## 8. Data Entities and Relationships

### 8.1 Core Business Entities

```
User ──────────────────────────── Manages accounts and cards
  │  (user_id, first_name, last_name, role)
  │
  ▼
Customer ──────────────────────── Holds one or more accounts
  │  (cust_id, name, ssn, dob, address, phone, fico_score)
  │
  ▼
Account ───────────────────────── Has one or more cards
  │  (acct_id, status, current_balance, credit_limit, dates)
  │
  ├──▶ Card Cross-Reference ─────── Links card ↔ customer ↔ account
  │      (card_num, cust_id, acct_id)
  │
  └──▶ Card ─────────────────────── Carries transactions
         (card_num, acct_id, embossed_name, expiry, status)
           │
           ├──▶ Transaction ────────── Financial activity records
           │      (tran_id, type, category, amount, merchant, timestamps)
           │
           └──▶ Authorization ───────── Pre-settlement authorization records
                  (auth_id, amount, merchant, response_code, match_status)
```

### 8.2 Entity Descriptions

| Entity | Key Identifier | Purpose |
|--------|---------------|---------|
| **User** | `user_id` (8 chars) | System operator credentials and role |
| **Customer** | `cust_id` (integer) | Cardholder personal and contact information |
| **Account** | `acct_id` (11-digit integer) | Credit card account — balances, limits, dates |
| **Card** | `card_num` (16-digit string) | Physical or virtual card linked to an account |
| **Card Cross-Reference** | `card_num` | Junction table linking card to both its account and its customer |
| **Transaction** | `tran_id` (16 chars) | Individual financial event (purchase, payment, fee, etc.) |
| **Authorization Summary** | `acct_id` | Aggregated authorization statistics per account |
| **Authorization Detail** | `auth_id` | Individual card authorization record with full merchant and response data |
| **Report Request** | `request_id` | User-submitted request for a transaction report |
| **Batch Job** | `job_name` | Definition of a runnable batch job |
| **Job Run** | `job_run_id` | Single execution instance of a batch job |
| **Job Run Step** | `step_run_id` | Individual step within a job run |
| **Artifact** | `artifact_id` | Output file produced by a job run (report, backup, log) |

### 8.3 Key Relationships

| Relationship | Cardinality | Notes |
|---|---|---|
| Customer → Account | 1 to many | One customer may hold multiple accounts |
| Account → Card | 1 to many | One account may have multiple cards |
| Card → Transaction | 1 to many | A card accumulates many transactions over its lifetime |
| Account → Authorization Summary | 1 to 1 | One summary record per account |
| Account → Authorization Detail | 1 to many | An account may have many authorization events |
| Job Run → Job Run Step | 1 to many | A job run consists of one or more ordered steps |
| Job Run → Artifact | 1 to many | A job run may produce zero or more output artifacts |

### 8.4 Key Reference Codes

| Code Set | Values |
|----------|--------|
| User Role | `A` = Admin, `U` = Standard User |
| Account / Card Active Status | `Y` = Active, `N` = Inactive |
| Authorization Type | `PURCH` = Purchase, `CASH` = Cash Advance |
| Authorization Response Code | `00` = Approved, `51` = Insufficient Funds, `54` = Expired Card, `05` = Do Not Honor |
| Authorization Match Status | `P` = Pending, `M` = Matched, `D` = Declined, `E` = Error |
| Authorization Fraud Flag | `F` = Fraud |
| Message Source | `POS` = Point of Sale, `ATM` = ATM, `WEB` = Web/Online |
| Merchant Category (MCC examples) | `5411` = Grocery, `5541` = Gas Station, `5812` = Restaurant |
| Report Type | `MONTHLY`, `YEARLY`, `CUSTOM` |
| Report Request Status | `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED` |
| Batch Job Run Status | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| Batch Job Category | `business`, `setup`, `utility`, `scheduler` |

---

## 9. Business Processes and Workflows

### 9.1 Staff Sign-on Flow

```
1. Staff navigates to Sign-on page
2. Enters User ID and Password
3. System validates credentials
   ├─ Failure → Display error, stay on sign-on page
   └─ Success → Create session, navigate to Main Menu
4. Staff selects a function from the menu (role filters available options)
5. Staff performs operation, navigates back to menu
6. Staff selects Sign-out → Session terminated, return to sign-on
```

### 9.2 Account View and Pay Flow

```
1. Staff selects Accounts from the menu
2. System displays paginated account list
3. Staff searches/pages to find account, clicks View
4. System displays full account detail with cards
5. Staff clicks Pay
   ├─ If multiple cards on file → System shows card selection dropdown
   ├─ If no cards on file → System shows Add Card & Pay option
   └─ If one card on file → Card details auto-populated
6. Staff enters payment amount and confirms card details
7. Staff confirms payment (Y/N prompt)
8. System posts payment transaction and updates balance
9. System displays updated balance and payment confirmation
```

### 9.3 Transaction Add Flow

```
1. Staff navigates to Transactions → Add Transaction
2. Staff enters all required transaction fields
3. System validates all fields
   └─ Errors → Display field-level messages, stay on form
4. System prompts for confirmation (Y/N)
5. Staff confirms
6. System posts transaction and displays Transaction ID
```

### 9.4 Authorization Fraud Flag Flow

```
1. Staff navigates to Pending Authorizations
2. Staff filters list (optionally by status, account, or card)
3. Staff selects an authorization to view
4. System displays full authorization detail
5. Staff reviews and clicks "Mark as Fraud"
6. System records fraud flag and fraud report date
7. System returns to updated authorization detail
```

### 9.5 Batch Job Submission Flow

```
1. Operator navigates to Submit Batch Job
2. Operator selects job from dropdown
3. System presents job-specific parameter form
4. Operator fills in parameters and submits
5. System validates parameters
   └─ Errors → Display validation messages, stay on form
6. System creates job run record (status: Queued), returns Job Run ID
7. Operator navigates to Job Runs list to monitor progress
8. Operator drills into run for step detail, logs, and artifacts
```

### 9.6 Recurring Batch Chains

| Chain | Frequency | Purpose |
|-------|-----------|---------|
| Transaction Backup | Daily | Backs up current transaction data before nightly changes |
| Interest Calculation | Monthly | Computes and posts interest/fees; updates balances |
| Disclosure Group Refresh | Weekly | Reloads discount rate reference data |

---

## 10. Non-Functional Requirements

### 10.1 Performance

| Requirement | Target |
|-------------|--------|
| List page response time (P95) | Under 500 milliseconds for default page size (20 records) |
| Detail page response time (P95) | Under 300 milliseconds |
| Batch job throughput | Capable of processing at least 300 transactions per POSTTRAN run |

### 10.2 Security

| Requirement | Detail |
|-------------|--------|
| Authentication required | All pages except sign-on require an active session |
| Role enforcement | Admin-only functions must be inaccessible to Standard Users at both UI and API layers |
| Password storage | Passwords must be stored as one-way hashes (not plaintext) |
| Session expiry | Inactive sessions must expire after a reasonable period |
| Input validation | All user inputs must be validated server-side before processing |
| Audit logging | All create, update, delete, and payment operations must produce a structured audit log entry with the user ID, timestamp, and action |

### 10.3 Usability

| Requirement | Detail |
|-------------|--------|
| Web-native UI | All screens must be rendered as responsive web pages — not as emulated 3270 terminal layouts |
| Navigation | A consistent navigation header must appear on all authenticated pages |
| Clickable actions | All actions must be accessible via visible buttons or links; keyboard shortcuts are optional enhancements |
| Date inputs | All date fields must use date picker controls |
| Masked fields | CVV/Secret Code fields must be masked by default with an explicit show/hide toggle |
| Monetary display | All monetary values must be displayed with consistent currency formatting and two decimal places |
| Empty states | List pages must display a meaningful empty-state message when no records are found |
| Error messages | Validation errors must be displayed inline at the field level, not as generic dialogs |
| High contrast | The application must support a high-contrast display mode for accessibility |

### 10.4 Data Integrity

| Requirement | Detail |
|-------------|--------|
| Atomic multi-write operations | Bill payment (transaction insert + balance update) and batch jobs that update multiple tables must be atomic |
| Foreign key integrity | Relationships between accounts, cards, customers, transactions, and authorizations must be enforced |
| Unique constraints | User IDs and transaction IDs must be unique across the system |

### 10.5 Observability

| Requirement | Detail |
|-------------|--------|
| Correlation IDs | Every request must carry a unique correlation ID included in logs and error responses |
| Structured logging | Logs must be structured (e.g., JSON) and include route, user ID, status, and duration |
| Batch run artifacts | Every batch job run must produce a log artifact accessible through the monitoring UI |

---

## 11. Assumptions and Constraints

| # | Assumption / Constraint |
|---|-------------------------|
| A-1 | The modernized system reproduces the business **behavior** of the legacy CICS application, not its visual layout. |
| A-2 | All date values are exchanged between the UI and the back-end in `YYYY-MM-DD` format. |
| A-3 | All monetary values are stored and transmitted as numeric decimal values (e.g., `1250.45`); currency symbol formatting is applied in the UI only. |
| A-4 | Report generation is asynchronous — the online system queues a request and the batch system processes it separately. The online system does not wait for report completion. |
| A-5 | Batch jobs are triggered either manually through the batch submission UI or by an external scheduler. The application must support both modes. |
| A-6 | The initial data set (customers, accounts, cards, cross-references, transactions) is sourced from the AWS Mainframe Modernization CardDemo fixed-width ASCII flat files and loaded using the ACCTFILE, CUSTFILE, and CARDFILE batch jobs. |
| A-7 | Transaction IDs are 16-character identifiers generated by the system. |
| A-8 | Account IDs are 11-digit integers. Card numbers are 16-digit numeric strings. |
| A-9 | The application is intended as a single-organization deployment (no multi-tenant isolation required). |
| A-10 | Browser support baseline is modern desktop browsers (Chrome, Edge, Firefox, Safari); mobile layout is a secondary concern. |

---

## 12. Out of Scope

| Item | Rationale |
|------|-----------|
| 3270 terminal interface | The modernization explicitly replaces this with a web UI |
| Real-time card authorization decisioning | The system reviews post-authorization records; it does not sit in the authorization network path |
| Physical card issuance and embossing | Operational workflow not represented in the legacy system |
| Payment network integrations (Visa, Mastercard, etc.) | Outside the boundary of this application |
| Core banking system integrations | Outside the boundary of this application |
| Mobile native applications (iOS/Android) | Web-responsive baseline only |
| Multi-factor authentication | Not present in legacy system; considered a future enhancement |
| Self-service cardholder portal | This system is for bank operations staff, not cardholders |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Account** | A credit card account record holding balance, limit, and date information for a cardholder. |
| **Admin (Role A)** | A system user with full access including user security administration. |
| **Artifact** | An output file produced by a batch job run (e.g., report file, backup file, export file, log). |
| **Authorization** | A pre-settlement record of a card being presented for a transaction, including the issuer's response code. |
| **Batch Job** | A non-interactive, automated process that runs to completion without real-time user interaction. |
| **CICS** | Customer Information Control System — the IBM mainframe transaction processing middleware used by the legacy CardDemo application. |
| **COBOL** | Common Business Oriented Language — the programming language used to implement the legacy application's business logic. |
| **Card Cross-Reference (XREF)** | A junction record explicitly linking a card number to both its owning account and its cardholder customer. |
| **CVV / Secret Code** | The 3- or 4-digit card verification value printed on the card, used to validate card-present and card-not-present transactions. |
| **Discount Group** | A reference data set that defines the interest rate applicable to a particular category of transaction. |
| **Embossed Name** | The cardholder name printed (embossed) on the physical credit card. |
| **FICO Score** | A numerical credit score (typically 300–850) indicating the cardholder's credit risk. |
| **Fraud Flag** | A marker placed on an authorization record indicating that the transaction is suspected to be fraudulent. |
| **JCL** | Job Control Language — the scripting language used to define and schedule batch jobs on IBM mainframes. |
| **Match Status** | The reconciliation state of an authorization record: Pending (P), Matched to a posted transaction (M), Declined (D), or Error (E). |
| **MCC** | Merchant Category Code — a 4-digit code classifying the type of business a merchant operates (e.g., 5411 = Grocery, 5812 = Restaurant). |
| **Overpunch** | A mainframe encoding convention for signed numeric fields where the sign is encoded into the last digit. |
| **POSTTRAN** | The batch job that posts pending transactions from the transaction table to account balances. |
| **Standard User (Role U)** | A system user with access to all operational functions but not user administration. |
| **Transaction Category Code** | A 4-digit code classifying the nature of a transaction for balance-tracking and interest-calculation purposes. |
| **Transaction Type Code** | A 2-character code indicating the broad type of a transaction (e.g., purchase, payment, fee). |
| **VSAM** | Virtual Storage Access Method — the IBM mainframe file system used by the legacy application for its data files. |

---

*End of Business Requirements Document*

*This BRD was derived from analysis of the CardDemo modernization project codebase, including the online modernization specification (docs/specs.md) and batch modernization specification (docs/batch_specs.md).*
