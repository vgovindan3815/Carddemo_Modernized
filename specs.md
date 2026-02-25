# CardDemo ONLINE Modernization Specification (Angular + Node.js + SQLite)

## Implemented deltas since baseline spec (2026-02-24)

- Added `GET /api/v1/accounts` paged list endpoint (`search`, `page`, `pageSize`, `sort`) to support account overview grid UX.
- Enhanced `POST /api/v1/billing/payments` to optionally accept and persist card details (`cardNum`, `expirationDate`, `secretCode`) for future reuse.
- Added account-driven billing UX behavior: entering/selecting account id auto-loads saved card details when available.
- Implemented bill payment card UX controls: masked secret code input with Show/Hide toggle and date-picker expiry input.
- Replaced raw JSON output rendering with structured table/card layouts for detail views (including account, card, and transaction pages).
- Upgraded Account View UX to include:
  - all-accounts table,
  - account selection + detail drill-in,
  - table-only initial state with details shown only after explicit View click,
  - pay action available from detail section (not from list rows),
  - card-on-file behavior: dropdown when multiple cards exist,
  - Add Card & Pay path when no cards exist,
  - previous/next pagination controls.
- Aligned validation and error messages to legacy-style mappings for core user/transaction/billing/report flows.
- **Added CPVD/CPVS Authorization Module (2026-02-25)**:
  - Implemented Pending Authorizations list view (CPVS equivalent) with filtering by match status (P/M/D/E).
  - Implemented Authorization Details view (CPVD equivalent) with full transaction/merchant information.
  - Added authorization_summary and authorization_details database tables with proper foreign key relationships.
  - Added Mark as Fraud functionality (PF5 equivalent) for flagging suspicious authorizations.
  - Created realistic sample data generator for 61 authorizations across 15 accounts with mixed statuses.
  - Added menu option 11 (Pending Authorizations) to main menu navigation.
  - Implemented back button navigation on authorization detail page.

## 1) System Overview

### 1.1 Purpose
CardDemo ONLINE is a CICS transactional application for:
- Sign-on and role-based menu access
- User security maintenance (list/add/update/delete users)
- Account/card inquiry and update
- Transaction inquiry, detail view, and add
- Bill payment posting
- Report request submission

### 1.2 User roles
- **Standard User (`U`)**: operational flows (account/card/transaction inquiry, bill payment, reports)
- **Admin (`A`)**: all user flows plus security administration (user maintenance)

Role and identity are carried in COMMAREA fields (`CDEMO-USER-ID`, `CDEMO-USER-TYPE`) from `app/cpy/COCOM01Y.cpy`.

### 1.3 Online vs batch boundary (explicit scope)
**In scope (ONLINE only):**
- CICS transactions, online COBOL CICS programs, BMS maps, CICS files/queues used by online programs
- Source folders analyzed: `app/cbl`, `app/bms`, `app/cpy`, `app/cpy-bms`, `app/csd`

**Out of scope (BATCH):**
- Batch-only loaders/exporters/report processors (examples in `CB*` programs)
- JCL/scheduler execution

**Boundary note:** online report screen submits a TDQ request (`JOBS`) that is later processed by batch/report jobs; this interface is documented as an assumption.

---

## 2) Discovery Summary and Evidence

### 2.1 Artifacts used
- CICS definitions: `app/csd/CARDDEMO.CSD`
- Online programs/maps/copybooks:
  - `app/cbl/*.cbl` (online set listed below)
  - `app/bms/*.bms`
  - `app/cpy/*.cpy`
  - `app/cpy-bms/*.CPY`

### 2.2 Dependency artifacts requested but not present
- `carddemo_dependencies.json`: **not found in repository**
- Blu Insights dependency PDF: **not found in repository**

### 2.3 Confirmed online entry points from CSD
From `DEFINE TRANSACTION(...) PROGRAM(...)` in `app/csd/CARDDEMO.CSD`:

| Transaction | Program |
|---|---|
| CAUP | COACTUPC |
| CAVW | COACTVWC |
| CA00 | COADM01C |
| CB00 | COBIL00C |
| CCDL | COCRDSLC |
| CCLI | COCRDLIC |
| CCUP | COCRDUPC |
| CC00 | COSGN00C |
| CDV1 | COCRDSEC *(program source not found in `app/cbl`)* |
| CM00 | COMEN01C |
| CR00 | CORPT00C |
| CT00 | COTRN00C |
| CT01 | COTRN01C |
| CT02 | COTRN02C |
| CU00 | COUSR00C |
| CU01 | COUSR01C |
| CU02 | COUSR02C |
| CU03 | COUSR03C |

---

## 3) Discovered ONLINE Inventory

## 3.1 Program-to-map-to-datastore matrix

| Transaction | Program | Main BMS mapset/map | Copybooks (core) | Data stores touched | External call/link |
|---|---|---|---|---|---|
| CC00 | COSGN00C | COSGN00 | COCOM01Y, COSGN00, CSUSR01Y | USRSEC | XCTL to next program (menu/admin) |
| CM00 | COMEN01C | COMEN01 | COCOM01Y, COMEN01, COMEN02Y | USRSEC (role/option gating) | XCTL dynamic |
| CA00 | COADM01C | COADM01 | COCOM01Y, COADM01, COADM02Y | USRSEC (role context) | XCTL dynamic |
| CU00 | COUSR00C | COUSR00 | COCOM01Y, COUSR00, CSUSR01Y | USRSEC | XCTL dynamic |
| CU01 | COUSR01C | COUSR01 | COCOM01Y, COUSR01, CSUSR01Y | USRSEC (WRITE) | XCTL dynamic |
| CU02 | COUSR02C | COUSR02 | COCOM01Y, COUSR02, CSUSR01Y | USRSEC (READ/REWRITE) | XCTL dynamic |
| CU03 | COUSR03C | COUSR03 | COCOM01Y, COUSR03, CSUSR01Y | USRSEC (READ/DELETE) | XCTL dynamic |
| CAVW | COACTVWC | COACTVW | CVACT01Y, CVACT02Y, CVACT03Y, CVCUS01Y, CVCRD01Y | ACCTDAT, CUSTDAT, CARDDAT/CCXREF/CXACAIX (lookup path) | XCTL to prior/menu |
| CAUP | COACTUPC | COACTUP | CVACT01Y, CVACT03Y, CVCUS01Y, CVCRD01Y, CSLKPCDY | ACCTDAT, CUSTDAT, CARDDAT, CCXREF/CXACAIX | XCTL to prior/menu |
| CCLI | COCRDLIC | COCRDLI | CVCRD01Y, CVACT02Y | CARDDAT (browse), CCXREF/CXACAIX | XCTL to prior/menu |
| CCDL | COCRDSLC | COCRDSL | CVCRD01Y, CVACT02Y, CVCUS01Y | CARDDAT + related account/customer path | XCTL to prior/menu |
| CCUP | COCRDUPC | COCRDUP | CVCRD01Y, CVACT02Y, CVCUS01Y | CARDDAT (READ/REWRITE) | XCTL to prior/menu |
| CT00 | COTRN00C | COTRN00 | CVTRA05Y | TRANSACT (browse) | XCTL dynamic |
| CT01 | COTRN01C | COTRN01 | CVTRA05Y | TRANSACT (single READ) | XCTL dynamic |
| CT02 | COTRN02C | COTRN02 | CVTRA05Y, CVACT01Y, CVACT03Y, CSUTLDWY | TRANSACT (WRITE), ACCTDAT, CCXREF, CXACAIX | CALL `CSUTLDTC` (date validation), XCTL dynamic |
| CB00 | COBIL00C | COBIL00 | CVACT01Y, CVACT03Y, CVTRA05Y | ACCTDAT (REWRITE), TRANSACT (WRITE), CXACAIX | XCTL dynamic |
| CR00 | CORPT00C | CORPT00 | CVTRA05Y, CSUTLDWY | TRANSACT (date/filter context), TDQ `JOBS` | CALL `CSUTLDTC`, WRITEQ TD |

Notes:
- CICS file names come from CSD and program constants (`WS-...-FILE` / `LIT-...FILENAME`).
- Some data access in account/card screens uses dataset path identifiers (e.g., `CXACAIX`) and multi-entity lookups.

## 3.2 CICS files/mapsets discovered (online relevant)

From `CARDDEMO.CSD`:
- **Files:** `ACCTDAT`, `CARDDAT`, `CARDAIX`, `CCXREF`, `CXACAIX`, `CUSTDAT`, `TRANSACT`, `USRSEC`
- **Mapsets:** `COSGN00`, `COMEN01`, `COADM01`, `COUSR00/01/02/03`, `COACTVW`, `COACTUP`, `COCRDLI`, `COCRDSL`, `COCRDUP`, `COTRN00/01/02`, `COBIL00`, `CORPT00`

---

## 4) Screen/Map Specifications (fields, actions, errors)

Field source = `app/cpy-bms/*.CPY` and `app/bms/*.bms`. Validation source = corresponding `app/cbl/*.cbl`.

### 4.1 COSGN00 (Sign-on)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| USERID | string | 8 | Yes | non-blank; must exist in `USRSEC` |
| PASSWD | password string | 8 | Yes | non-blank; must match stored password |
| ERRMSG | display | 78 | N/A | populated on failure |

Actions:
- Enter = sign-on
- F3 = exit

Errors/conditions:
- Missing user id/password
- Unknown user
- Wrong password (`Wrong Password. Try again ...`)

### 4.2 COMEN01 (Main menu)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| OPTION | numeric | 2 | Yes | option must be valid for role; invalid-key error otherwise |
| OPTN001..OPTN012 | display | 40 each | N/A | rendered from `COMEN02Y` |

Actions:
- Enter = route to selected option
- F3 = exit

### 4.3 COADM01 (Admin menu)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| OPTION | numeric | 2 | Yes | must be admin option in `COADM02Y` |

Actions:
- Enter = route to selected admin flow
- F3 = exit

### 4.4 COUSR00 (User list)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| USRIDIN | string | 8 | Optional | optional start key/filter |
| SEL0001..SEL0010 | char | 1 | Optional | selection action (`S`/`D` pattern) |

Actions:
- Enter = browse/select
- F7/F8 = page backward/forward (list browse)
- F3 = back

Errors:
- invalid selection code (`Invalid selection. Valid values are U and D` in related user flows)

### 4.5 COUSR01 (User add)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| FNAME | string | 20 | Yes | non-blank |
| LNAME | string | 20 | Yes | non-blank |
| USERID | string | 8 | Yes | non-blank; must be unique |
| PASSWD | password | 8 | Yes | non-blank |
| USRTYPE | enum | 1 | Yes | valid role code (`A`/`U`) |

Actions:
- Enter = add user
- F4 = clear
- F3 = back
- F12 = exit

Errors:
- required-field messages
- duplicate user id (`User ID already exist...`)

### 4.6 COUSR02 (User update)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| USRIDIN | string | 8 | Yes | user id to fetch/update |
| FNAME | string | 20 | Yes | non-blank |
| LNAME | string | 20 | Yes | non-blank |
| PASSWD | password | 8 | Yes | non-blank |
| USRTYPE | enum | 1 | Yes | valid role code |

Actions:
- Enter = fetch/update
- F3/F4 = back/clear

Errors:
- required-field messages
- `User ID NOT found...`

### 4.7 COUSR03 (User delete)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| USRIDIN | string | 8 | Yes | user id must exist |

Actions:
- Enter = fetch candidate user
- F5 = delete
- F3/F4 = back/clear

Errors:
- `User ID can NOT be empty...`
- `Press PF5 key to delete this user ...`
- `User ID NOT found...`

### 4.8 COACTVW (Account view)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| ACCTSID | numeric-string | 11 | Yes | account must exist |

Actions:
- Enter = fetch/view
- F3 = exit

Errors:
- invalid PF key paths
- record not found/read failures

### 4.9 COACTUP (Account update)

Editable inputs (major):
- Account core: `ACCTSID(11)`, `ACSTTUS(1)`, `ACRDLIM(15)`, `ACSHLIM(15)`, `ACURBAL(15)`, `ACRCYCR(15)`, `ACRCYDB(15)`, `AADDGRP(10)`
- Dates: open/expiry/reissue (`OPN*`, `EXP*`, `RIS*`), DOB (`DOB*`)
- Customer identity/contact: names, address, SSN fragments (`ACTSSN1/2/3`), phone parts (`ACSPH*`), govt id, EFT id, fico, primary flag

Validation highlights (from COBOL):
- mandatory checks for key fields
- numeric/signed-decimal formatting checks for amount fields
- date validity checks (open/expiry/reissue/DOB)
- SSN structure checks
- phone/area-code checks via `CSLKPCDY`
- confirmation workflow before save (`F5` save, `F12` cancel)

Actions:
- Enter = process/validate
- F5 = save (after confirmation)
- F12 = cancel
- F3 = exit/back

### 4.10 COCRDLI (Card list)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| ACCTSID | numeric-string | 11 | Optional | optional account filter |
| CARDSID | string | 16 | Optional | optional card filter/start |

Actions:
- Enter = list
- F7/F8 = backward/forward paging
- F3 = exit

Errors:
- `NO MORE RECORDS TO SHOW`
- `NO RECORDS TO SHOW`

### 4.11 COCRDSL (Card detail/view search)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| ACCTSID | numeric-string | 11 | Optional | used for narrowing search |
| CARDSID | string | 16 | Optional | used to locate card |

Actions:
- Enter = search/view
- F3 = exit

### 4.12 COCRDUP (Card update)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| CARDSID | string | 16 | Yes | card must exist |
| CRDNAME | string | 50 | Yes | non-blank |
| CRDSTCD | enum | 1 | Yes | valid card status |
| EXPMON | numeric | 2 | Yes | valid month |
| EXPYEAR | numeric | 4 | Yes | valid year/date |

Actions:
- Enter = process
- F5 = save (with confirm stage)
- F12 = cancel
- F3 = exit

Errors:
- invalid expiry year/date
- invalid PF-key flow states

### 4.13 COTRN00 (Transaction list)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| TRNIDIN | string | 16 | Optional | optional starting transaction id |
| SEL0001..SEL0010 | char | 1 | Optional | row select (`S`) |

Actions:
- Enter = list/select
- F7/F8 = paging
- F3 = back

Errors:
- `Invalid selection. Valid value is S`

### 4.14 COTRN01 (Transaction detail)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| TRNIDIN | string | 16 | Yes | non-blank, transaction must exist |

Actions:
- Enter = fetch transaction
- F3 = back

### 4.15 COTRN02 (Transaction add)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| ACTIDIN | numeric-string | 11 | Yes | account exists |
| CARDNIN | string | 16 | Yes | card/account relation valid |
| TTYPCD | string | 2 | Yes | non-blank |
| TCATCD | numeric-string | 4 | Yes | non-blank |
| TRNSRC | string | 10 | Yes | non-blank |
| TDESC | string | 60 | Yes | non-blank |
| TRNAMT | signed decimal-string | 12 | Yes | valid amount |
| TORIGDT | date | 10 | Yes | valid date (`CSUTLDTC`) |
| TPROCDT | date | 10 | Yes | valid date (`CSUTLDTC`) |
| MID | numeric-string | 9 | Yes | non-blank |
| MNAME | string | 30 | Yes | non-blank |
| MCITY | string | 25 | Yes | non-blank |
| MZIP | string | 10 | Yes | non-blank |
| CONFIRM | char | 1 | Yes before commit | `Y/N` only |

Actions:
- Enter = validate/process
- F3 = back

Errors:
- explicit mandatory-field messages for each major input
- confirm required / invalid confirm value

### 4.16 COBIL00 (Bill payment)

| Field | Type | Length | Required | Validation |
|---|---|---:|---|---|
| ACTIDIN | numeric-string | 11 | Yes | account exists |
| CONFIRM | char | 1 | Yes before commit | `Y/N` |

Actions:
- Enter = validate/process
- F3 = back
- F4 = clear

Behavior:
- creates a transaction record (bill payment) and updates account balance

### 4.17 CORPT00 (Transaction reports request)

| Field | Type | Length | Required | Validation |
|---|---:|---:|---|---|
| MONTHLY | char | 1 | one option required | report type selection |
| YEARLY | char | 1 | one option required | report type selection |
| CUSTOM | char | 1 | one option required | report type selection |
| SDTMM/SDTDD/SDTYYYY | date parts | 2/2/4 | required by mode | non-blank, valid date |
| EDTMM/EDTDD/EDTYYYY | date parts | 2/2/4 | required by custom/range | non-blank, valid date |
| CONFIRM | char | 1 | Yes | `Y/N` |

Actions:
- Enter = validate and queue report request
- F3 = back

Errors:
- empty/invalid date part messages
- invalid confirm value
- TDQ write failure (`Unable to Write TDQ (JOBS)...`)

---

## 5) User Journeys and Navigation Model (Angular)

## 5.1 Angular route plan

| Route | Page | Source map/program |
|---|---|---|
| `/signon` | Sign-on | COSGN00 / COSGN00C |
| `/menu` | Main menu | COMEN01 / COMEN01C |
| `/admin` | Admin menu | COADM01 / COADM01C |
| `/users` | User list | COUSR00 / COUSR00C |
| `/users/new` | Add user | COUSR01 / COUSR01C |
| `/users/:userId/edit` | Update user | COUSR02 / COUSR02C |
| `/users/:userId/delete` | Delete user | COUSR03 / COUSR03C |
| `/accounts/view` | Account view | COACTVW / COACTVWC |
| `/accounts/edit` | Account update | COACTUP / COACTUPC |
| `/cards` | Card list | COCRDLI / COCRDLIC |
| `/cards/view` | Card detail | COCRDSL / COCRDSLC |
| `/cards/edit` | Card update | COCRDUP / COCRDUPC |
| `/transactions` | Transaction list | COTRN00 / COTRN00C |
| `/transactions/view` | Transaction detail | COTRN01 / COTRN01C |
| `/transactions/new` | Add transaction | COTRN02 / COTRN02C |
| `/billing/payment` | Bill payment | COBIL00 / COBIL00C |
| `/reports/transactions` | Report request | CORPT00 / CORPT00C |
| `/authorizations` | Pending authorizations list | COPAUS0C (CPVS equivalent) |
| `/authorizations/view/:authId` | Authorization details | COPAUS1C (CPVD equivalent) |

## 5.2 Top navigation menu (header, complete)
- Home/Menu (`/menu`)
- Accounts: View, Update
- Cards: List, View, Update
- Transactions: List, View, Add
- Billing: Bill Payment
- Authorizations: Pending Authorizations
- Reports: Transaction Reports
- Admin (role=`A` only): Admin Menu, User List, Add User
- Sign out

## 5.3 Click-based control rules
- Replace PF/AID keys with explicit buttons per page:
  - `Enter` => **Submit/Search/Continue** button
  - `F3` => **Back**
  - `F4` => **Clear**
  - `F5` => **Save/Delete (contextual)**
  - `F7/F8` => **Previous Page / Next Page** for browse lists
  - `F12` => **Cancel**
- Row-level selectors (`SELxxxx`) become clickable row actions (`View`, `Edit`, `Delete`, `Select`)
- All date inputs use Angular date picker control and submit as `YYYY-MM-DD`

  ## 5.4 Web-native UX and banking template requirements

  - Rebuild all screens as **native web pages** (responsive HTML/CSS + Angular components), not 3270-like fixed-screen emulation.
  - Apply a **bank-themed visual template** consistently across all pages:
    - clean financial dashboard style
    - card/account/transaction information grouped into web-native cards, tables, and forms
    - accessible contrast and readable typography for enterprise users
  - Global header must be present on all authenticated pages and must include:
    - complete navigation menu from section 5.2
    - application title/brand area
    - a **credit card image/icon** in the header brand area
  - Keep interactions click-first (buttons/links), with keyboard support as enhancement only.
  - For all date fields, use date-picker UI controls (no free-form date-only UX).

---

## 6) Data Model (SQLite)

## 6.1 COBOL record to SQLite mapping

| COBOL copybook | Proposed SQLite table |
|---|---|
| `CSUSR01Y` | `user_security` |
| `CVCUS01Y` | `customers` |
| `CVACT01Y` | `accounts` |
| `CVACT02Y` | `cards` |
| `CVACT03Y` | `card_xref` |
| `CVTRA05Y` | `transactions` |
| `COCOM01Y` | `sessions` (web replacement for COMMAREA) |

## 6.2 Normalized schema

### `user_security`
- `user_id` TEXT(8) PK
- `first_name` TEXT(20) NOT NULL
- `last_name` TEXT(20) NOT NULL
- `password_hash` TEXT NOT NULL *(store hash, not plain COBOL password)*
- `user_type` TEXT(1) NOT NULL CHECK (`A`,`U`)

Indexes:
- PK on `user_id`
- index on `user_type`

### `customers`
- `cust_id` INTEGER PK
- names, address lines, state/country/zip, phones, ssn, govt_id, dob, eft_account_id, primary_holder_ind, fico_score

Indexes:
- unique index on `ssn`
- index on `last_name, first_name`

### `accounts`
- `acct_id` INTEGER PK
- `active_status`, `curr_bal`, `credit_limit`, `cash_credit_limit`, `open_date`, `expiration_date`, `reissue_date`, `curr_cyc_credit`, `curr_cyc_debit`, `addr_zip`, `group_id`

Indexes:
- index on `active_status`
- index on `addr_zip`

### `cards`
- `card_num` TEXT(16) PK
- `acct_id` INTEGER NOT NULL FK -> `accounts.acct_id`
- `cvv_cd`, `embossed_name`, `expiration_date`, `active_status`

Indexes:
- index on `acct_id`

### `card_xref`
- `card_num` TEXT(16) PK FK -> `cards.card_num`
- `cust_id` INTEGER NOT NULL FK -> `customers.cust_id`
- `acct_id` INTEGER NOT NULL FK -> `accounts.acct_id`

Indexes:
- index on `acct_id` (equivalent of `CXACAIX` path)
- index on `cust_id`

### `transactions`
- `tran_id` TEXT(16) PK
- `tran_type_cd`, `tran_cat_cd`, `source`, `description`, `amount`, `merchant_id`, `merchant_name`, `merchant_city`, `merchant_zip`, `card_num`, `orig_ts`, `proc_ts`

Indexes:
- index on `card_num`
- index on `proc_ts`
- index on `tran_cat_cd, tran_type_cd`

### `report_requests`
- `request_id` INTEGER PK AUTOINCREMENT
- `requested_by` TEXT FK -> `user_security.user_id`
- `report_type` TEXT (`MONTHLY`,`YEARLY`,`CUSTOM`)
- `start_date`, `end_date`, `status`, `submitted_at`

### `sessions` (server-side session store)
- `session_id` TEXT PK
- `user_id` TEXT FK
- `user_type` TEXT(1)
- `from_program`, `to_program`, `context_json`, `created_at`, `expires_at`

### `authorization_summary`
- `acct_id` INTEGER PK FK -> `accounts.acct_id`
- `cust_id` INTEGER NOT NULL FK -> `customers.cust_id`
- `auth_status` TEXT
- `credit_limit` REAL NOT NULL
- `cash_limit` REAL NOT NULL
- `credit_balance` REAL NOT NULL
- `cash_balance` REAL NOT NULL
- `approved_auth_count` INTEGER DEFAULT 0
- `declined_auth_count` INTEGER DEFAULT 0
- `approved_auth_amount` REAL DEFAULT 0
- `declined_auth_amount` REAL DEFAULT 0

### `authorization_details`
- `auth_id` TEXT PK
- `acct_id` INTEGER NOT NULL FK -> `authorization_summary.acct_id`
- `auth_date` TEXT NOT NULL (format: YYYYMMDD)
- `auth_time` TEXT NOT NULL (format: HHMMSS)
- `auth_orig_date` TEXT NOT NULL
- `auth_orig_time` TEXT NOT NULL
- `card_num` TEXT NOT NULL FK -> `cards.card_num`
- `auth_type` TEXT NOT NULL (`PURCH`, `CASH`)
- `card_expiry_date` TEXT (format: YYYY-MM)
- `message_type` TEXT (`REQAUT`)
- `message_source` TEXT (`POS`, `ATM`, `WEB`)
- `auth_id_code` TEXT
- `auth_resp_code` TEXT NOT NULL (`00`=Approved, `51`=Insufficient Funds, `54`=Expired Card, `05`=Do Not Honor)
- `auth_resp_reason` TEXT (`INSF`, `EXPR`, `DENY`)
- `processing_code` TEXT
- `transaction_amt` REAL NOT NULL
- `approved_amt` REAL NOT NULL
- `merchant_category_code` TEXT (MCC codes: `5411`=Grocery, `5541`=Gas, `5812`=Restaurant, etc.)
- `acqr_country_code` TEXT
- `pos_entry_mode` TEXT
- `merchant_id` TEXT NOT NULL
- `merchant_name` TEXT NOT NULL
- `merchant_city` TEXT
- `merchant_state` TEXT
- `merchant_zip` TEXT
- `transaction_id` TEXT
- `match_status` TEXT DEFAULT 'P' (`P`=Pending, `M`=Matched, `D`=Declined, `E`=Error)
- `auth_fraud` TEXT DEFAULT '' (`F`=Fraud)
- `fraud_rpt_date` TEXT
- `created_at` TEXT NOT NULL

Indexes:
- index on `acct_id`
- index on `card_num`
- index on `auth_date`
- index on `match_status`

## 6.3 Migration outline
1. `001_init_security.sql` (`user_security`)
2. `002_init_customer_account_card.sql` (`customers`, `accounts`, `cards`, `card_xref`)
3. `003_init_transactions.sql` (`transactions`)
4. `004_init_reporting.sql` (`report_requests`)
5. `005_init_sessions.sql` (`sessions`)
6. `006_init_authorizations.sql` (`authorization_summary`, `authorization_details`)
7. `900_seed_demo_data.sql`

---

## 7) API Contract (Node.js REST)

Base path: `/api/v1`

Monetary fields in request/response payloads (e.g., `amount`, `currBal`, `creditLimit`) are numeric decimal values, not currency-formatted strings; display formatting is UI-only.

## 7.1 Auth/session

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/auth/login` | `{ userId, password }` | `{ sessionId/userToken, userType, displayName }` | `400`, `401`, `423` |
| POST | `/auth/logout` | none | `204` | `401` |
| GET | `/auth/me` | none | `{ userId, userType, permissions }` | `401` |

## 7.2 Menu and navigation metadata

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/menu/main` | none | options from `COMEN02Y` filtered by role | `401` |
| GET | `/menu/admin` | none | options from `COADM02Y` | `401`, `403` |

## 7.3 User security

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/users` | `?search=&page=&pageSize=&sort=` | paged list | `400`, `401`, `403` |
| GET | `/users/{userId}` | none | user detail | `401`, `403`, `404` |
| POST | `/users` | add payload | created user | `400`, `401`, `403`, `409` |
| PUT | `/users/{userId}` | update payload | updated user | `400`, `401`, `403`, `404` |
| DELETE | `/users/{userId}` | none | `204` | `401`, `403`, `404` |

## 7.4 Accounts/cards

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/accounts` | `?search=&page=&pageSize=&sort=` | paged account list with customer summary | `401` |
| GET | `/accounts/{acctId}` | none | account + customer summary | `401`, `404` |
| PUT | `/accounts/{acctId}` | account update payload | updated account aggregate | `400`, `401`, `404`, `409` |
| GET | `/cards` | `?acctId=&cardNum=&page=&pageSize=&sort=` | paged cards | `400`, `401` |
| GET | `/cards/{cardNum}` | none | card detail + owner/account | `401`, `404` |
| PUT | `/cards/{cardNum}` | card update payload | updated card | `400`, `401`, `404`, `409` |

## 7.5 Transactions and billing

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/transactions` | filters + pagination/sort | paged list | `400`, `401` |
| GET | `/transactions/{tranId}` | none | detail | `401`, `404` |
| POST | `/transactions` | add transaction payload | created transaction | `400`, `401`, `404`, `409` |
| POST | `/billing/payments` | `{ acctId, amount, confirm, card? }` | posted payment transaction + account balance + optional card upsert | `400`, `401`, `404`, `409` |

## 7.6 Reporting

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| POST | `/reports/transactions` | `{ reportType, startDate, endDate, confirm }` | queued request | `400`, `401`, `409`, `503` |
| GET | `/reports/transactions/requests` | `?page=&pageSize=&sort=` | request history | `401` |

## 7.7 Authorizations

| Method | Path | Request | Response | Errors |
|---|---|---|---|---|
| GET | `/authorizations` | `?acctId=&cardNum=&status=&page=&pageSize=&sort=` | paged authorization list | `400`, `401` |
| GET | `/authorizations/{authId}` | none | authorization detail | `401`, `404` |
| PUT | `/authorizations/{authId}/fraud` | `{ fraudStatus: 'F' }` | updated authorization | `400`, `401`, `404` |

## 7.8 Page-by-page sample payloads (request/response)

### `/signon` (COSGN00)

**Request** (`POST /api/v1/auth/login`)
```json
{
  "userId": "A0000001",
  "password": "Passw0rd"
}
```

**Response 200**
```json
{
  "sessionId": "a3fcbf80-4f95-47ff-b2c6-cf4d5f42c2d8",
  "userId": "A0000001",
  "userType": "A",
  "displayName": "ADMIN USER",
  "nextRoute": "/menu"
}
```

### `/menu` (COMEN01)

**Request** (`GET /api/v1/menu/main`)

**Response 200**
```json
{
  "title": "Main Menu",
  "options": [
    { "option": 1, "label": "Account View", "route": "/accounts/view" },
    { "option": 2, "label": "Account Update", "route": "/accounts/edit" },
    { "option": 6, "label": "Transaction List", "route": "/transactions" },
    { "option": 11, "label": "Pending Authorizations", "route": "/authorizations", "program": "COPAUS0C" }
  ]
}
```

### `/admin` (COADM01)

**Request** (`GET /api/v1/menu/admin`)

**Response 200**
```json
{
  "title": "Admin Menu",
  "options": [
    { "option": 1, "label": "User List (Security)", "route": "/users" },
    { "option": 2, "label": "User Add (Security)", "route": "/users/new" },
    { "option": 3, "label": "User Update (Security)", "route": "/users/A0000002/edit" },
    { "option": 4, "label": "User Delete (Security)", "route": "/users/A0000002/delete" }
  ]
}
```

### `/users` (COUSR00)

**Request** (`GET /api/v1/users?search=A0&page=1&pageSize=10&sort=userId:asc`)

**Response 200**
```json
{
  "items": [
    { "userId": "A0000001", "firstName": "ADMIN", "lastName": "USER", "userType": "A" },
    { "userId": "U0000001", "firstName": "STANDARD", "lastName": "USER", "userType": "U" }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 2
}
```

### `/users/new` (COUSR01)

**Request** (`POST /api/v1/users`)
```json
{
  "userId": "U0000100",
  "firstName": "JANE",
  "lastName": "DOE",
  "password": "Temp1234",
  "userType": "U"
}
```

**Response 201**
```json
{
  "userId": "U0000100",
  "firstName": "JANE",
  "lastName": "DOE",
  "userType": "U",
  "created": true
}
```

### `/users/:userId/edit` (COUSR02)

**Request** (`PUT /api/v1/users/U0000100`)
```json
{
  "firstName": "JANE",
  "lastName": "DOE",
  "password": "NewPass99",
  "userType": "A"
}
```

**Response 200**
```json
{
  "userId": "U0000100",
  "firstName": "JANE",
  "lastName": "DOE",
  "userType": "A",
  "updated": true
}
```

### `/users/:userId/delete` (COUSR03)

**Request** (`DELETE /api/v1/users/U0000100`)

**Response 204** (no body)

### `/accounts/view` (COACTVW)

**Request** (`GET /api/v1/accounts?page=1&pageSize=10&sort=acctId:asc`)

**Response 200**
```json
{
  "items": [
    {
      "acctId": 10000000001,
      "activeStatus": "Y",
      "currBal": 1250.45,
      "creditLimit": 5000.0,
      "expirationDate": "2028-01-31",
      "custId": 100000001,
      "firstName": "JOHN",
      "lastName": "SMITH"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

**Request** (`GET /api/v1/accounts/10000000001`)

**Response 200**
```json
{
  "account": {
    "acctId": 10000000001,
    "activeStatus": "Y",
    "currBal": 1250.45,
    "creditLimit": 5000.0,
    "cashCreditLimit": 1500.0,
    "openDate": "2024-01-10",
    "expirationDate": "2028-01-31",
    "reissueDate": "2026-01-31"
  },
  "customer": {
    "custId": 100000001,
    "firstName": "JOHN",
    "lastName": "SMITH"
  },
  "cards": [
    { "cardNum": "4444333322221111", "activeStatus": "Y" }
  ]
}
```

### `/accounts/edit` (COACTUP)

**Request** (`PUT /api/v1/accounts/10000000001`)
```json
{
  "confirm": "Y",
  "account": {
    "activeStatus": "Y",
    "creditLimit": 5500.0,
    "cashCreditLimit": 1800.0,
    "openDate": "2024-01-10",
    "expirationDate": "2028-01-31",
    "reissueDate": "2026-01-31",
    "currBal": 1100.45,
    "currCycCredit": 200.0,
    "currCycDebit": 350.0,
    "groupId": "GRP0000001"
  },
  "customer": {
    "custId": 100000001,
    "firstName": "JOHN",
    "middleName": "A",
    "lastName": "SMITH",
    "ssn": "123456789",
    "dob": "1988-07-21",
    "ficoScore": 745,
    "address": {
      "line1": "10 MAIN ST",
      "line2": "APT 2",
      "line3": "",
      "state": "TX",
      "country": "USA",
      "zip": "73301"
    },
    "phone1": "5125551111",
    "phone2": "5125552222",
    "govtId": "DL1234567",
    "eftAccountId": "EFT998877",
    "primaryHolderInd": "Y"
  }
}
```

**Response 200**
```json
{
  "acctId": 10000000001,
  "updated": true,
  "message": "Account and customer details updated"
}
```

### `/cards` (COCRDLI)

**Request** (`GET /api/v1/cards?acctId=10000000001&page=1&pageSize=10&sort=cardNum:asc`)

**Response 200**
```json
{
  "items": [
    {
      "cardNum": "4444333322221111",
      "acctId": 10000000001,
      "embossedName": "JOHN A SMITH",
      "expirationDate": "2028-01-31",
      "secretCode": "123",
      "activeStatus": "Y"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

### `/cards/view` (COCRDSL)

**Request** (`GET /api/v1/cards/4444333322221111`)

**Response 200**
```json
{
  "card": {
    "cardNum": "4444333322221111",
    "embossedName": "JOHN A SMITH",
    "activeStatus": "Y",
    "expirationDate": "2028-01-31",
    "secretCode": "123"
  },
  "account": {
    "acctId": 10000000001,
    "currBal": 1100.45
  },
  "customer": {
    "custId": 100000001,
    "firstName": "JOHN",
    "lastName": "SMITH"
  }
}
```

### `/cards/edit` (COCRDUP)

**Request** (`PUT /api/v1/cards/4444333322221111`)
```json
{
  "confirm": "Y",
  "embossedName": "JOHN SMITH",
  "activeStatus": "Y",
  "expirationDate": "2029-01-31"
}
```

**Response 200**
```json
{
  "cardNum": "4444333322221111",
  "updated": true,
  "message": "Card updated"
}
```

### `/transactions` (COTRN00)

**Request** (`GET /api/v1/transactions?cardNum=4444333322221111&page=1&pageSize=10&sort=procTs:desc`)

**Response 200**
```json
{
  "items": [
    {
      "tranId": "TXN202602240001",
      "tranTypeCd": "PM",
      "tranCatCd": 2001,
      "amount": 75.0,
      "merchantName": "UTILITY PAYMENT",
      "cardNum": "4444333322221111",
      "origTs": "2026-02-24T10:01:00Z",
      "procTs": "2026-02-24T10:02:00Z"
    }
  ],
  "page": 1,
  "pageSize": 10,
  "total": 1
}
```

### `/transactions/view` (COTRN01)

**Request** (`GET /api/v1/transactions/TXN202602240001`)

**Response 200**
```json
{
  "tranId": "TXN202602240001",
  "tranTypeCd": "PM",
  "tranCatCd": 2001,
  "source": "BILLPAY",
  "description": "Monthly utility payment",
  "amount": 75.0,
  "merchantId": 100234567,
  "merchantName": "UTILITY PAYMENT",
  "merchantCity": "AUSTIN",
  "merchantZip": "73301",
  "cardNum": "4444333322221111",
  "origTs": "2026-02-24T10:01:00Z",
  "procTs": "2026-02-24T10:02:00Z"
}
```

### `/transactions/new` (COTRN02)

**Request** (`POST /api/v1/transactions`)
```json
{
  "confirm": "Y",
  "acctId": 10000000001,
  "cardNum": "4444333322221111",
  "tranTypeCd": "PU",
  "tranCatCd": 3001,
  "source": "POS",
  "description": "GROCERY",
  "amount": 120.35,
  "origDate": "2026-02-24",
  "procDate": "2026-02-24",
  "merchantId": 101001001,
  "merchantName": "FRESH MART",
  "merchantCity": "AUSTIN",
  "merchantZip": "73301"
}
```

**Response 201**
```json
{
  "tranId": "TXN202602240055",
  "created": true,
  "message": "Transaction added"
}
```

### `/billing/payment` (COBIL00)

**Request** (`POST /api/v1/billing/payments`)
```json
{
  "acctId": 10000000001,
  "amount": 250.0,
  "confirm": "Y",
  "card": {
    "cardNum": "4111111111111111",
    "expirationDate": "2029-12-31",
    "secretCode": "789"
  }
}
```

**Response 200**
```json
{
  "paymentTranId": "TXN202602240078",
  "acctId": 10000000001,
  "newBalance": 850.45,
  "posted": true
}
```

### `/reports/transactions` (CORPT00)

**Request** (`POST /api/v1/reports/transactions`)
```json
{
  "reportType": "CUSTOM",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "confirm": "Y"
}
```

**Response 202**
```json
{
  "requestId": 145,
  "status": "QUEUED",
  "message": "Report request queued"
}
```

### `/reports/transactions` history

**Request** (`GET /api/v1/reports/transactions/requests?page=1&pageSize=20&sort=submittedAt:desc`)

**Response 200**
```json
{
  "items": [
    {
      "requestId": 145,
      "reportType": "CUSTOM",
      "startDate": "2026-01-01",
      "endDate": "2026-01-31",
      "status": "QUEUED",
      "submittedAt": "2026-02-24T11:00:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

## 7.8 Sample error payloads by endpoint/journey

### Authentication errors (`/signon`)

**Invalid credentials** (`POST /api/v1/auth/login` -> `401`)
```json
{
  "code": "UNAUTHORIZED",
  "message": "Wrong Password. Try again ...",
  "details": [
    { "field": "password", "message": "Password does not match" }
  ]
}
```

**Missing required fields** (`POST /api/v1/auth/login` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "userId", "message": "Please enter User ID ..." },
    { "field": "password", "message": "Please enter Password ..." }
  ]
}
```

### User maintenance errors (`/users*`)

**Duplicate user id** (`POST /api/v1/users` -> `409`)
```json
{
  "code": "CONFLICT",
  "message": "User ID already exist...",
  "details": [
    { "field": "userId", "message": "User ID must be unique" }
  ]
}
```

**User not found** (`GET|PUT|DELETE /api/v1/users/{userId}` -> `404`)
```json
{
  "code": "NOT_FOUND",
  "message": "User ID NOT found...",
  "details": [
    { "field": "userId", "message": "No user exists for supplied userId" }
  ]
}
```

**Required-field failure (add/update)** (`POST|PUT /api/v1/users*` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "firstName", "message": "First Name can NOT be empty..." },
    { "field": "lastName", "message": "Last Name can NOT be empty..." },
    { "field": "password", "message": "Password can NOT be empty..." },
    { "field": "userType", "message": "User Type can NOT be empty..." }
  ]
}
```

### Account/card errors (`/accounts*`, `/cards*`)

**Account not found** (`GET|PUT /api/v1/accounts/{acctId}` -> `404`)
```json
{
  "code": "NOT_FOUND",
  "message": "Account not found",
  "details": [
    { "field": "acctId", "message": "No account exists for supplied acctId" }
  ]
}
```

**Card not found** (`GET|PUT /api/v1/cards/{cardNum}` -> `404`)
```json
{
  "code": "NOT_FOUND",
  "message": "Card not found",
  "details": [
    { "field": "cardNum", "message": "No card exists for supplied card number" }
  ]
}
```

**Invalid card expiry** (`PUT /api/v1/cards/{cardNum}` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "expirationDate", "message": "Invalid card expiry year" }
  ]
}
```

### Transaction errors (`/transactions*`)

**Missing required transaction fields** (`POST /api/v1/transactions` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "tranTypeCd", "message": "Type CD can NOT be empty..." },
    { "field": "tranCatCd", "message": "Category CD can NOT be empty..." },
    { "field": "description", "message": "Description can NOT be empty..." },
    { "field": "amount", "message": "Amount can NOT be empty..." }
  ]
}
```

**Invalid confirmation value** (`POST /api/v1/transactions` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid value. Valid values are (Y/N)...",
  "details": [
    { "field": "confirm", "message": "confirm must be Y or N" }
  ]
}
```

**Transaction not found** (`GET /api/v1/transactions/{tranId}` -> `404`)
```json
{
  "code": "NOT_FOUND",
  "message": "Transaction not found",
  "details": [
    { "field": "tranId", "message": "No transaction exists for supplied tranId" }
  ]
}
```

### Bill payment errors (`/billing/payments`)

**Missing account id** (`POST /api/v1/billing/payments` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "acctId", "message": "Acct ID can NOT be empty..." }
  ]
}
```

**Confirmation required** (`POST /api/v1/billing/payments` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Confirm to make a bill payment...",
  "details": [
    { "field": "confirm", "message": "confirm must be Y to post payment" }
  ]
}
```

### Reporting errors (`/reports/transactions`)

**Invalid date parts/date range** (`POST /api/v1/reports/transactions` -> `400`)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    { "field": "startDate", "message": "Start Date - Not a valid date..." },
    { "field": "endDate", "message": "End Date - Not a valid date..." }
  ]
}
```

**Queue write failure** (`POST /api/v1/reports/transactions` -> `503`)
```json
{
  "code": "SYSTEM_ERROR",
  "message": "Unable to Write TDQ (JOBS)...",
  "details": []
}
```

### Authorization/session errors (all protected endpoints)

**No active session** (`401`)
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required",
  "details": []
}
```

**Admin role required** (`403`)
```json
{
  "code": "FORBIDDEN",
  "message": "Admin role is required",
  "details": []
}
```

## 7.9 Canonical message-to-error-code mapping

Use this table to keep backend responses deterministic when translating COBOL validation/error text into REST error semantics.

| COBOL-style message pattern | Canonical API `code` | HTTP status | Typical endpoint(s) |
|---|---|---:|---|
| `Please enter User ID ...` / `Please enter Password ...` | `VALIDATION_ERROR` | 400 | `POST /auth/login` |
| `Wrong Password. Try again ...` | `UNAUTHORIZED` | 401 | `POST /auth/login` |
| `First Name can NOT be empty...` / `Last Name can NOT be empty...` / `User Type can NOT be empty...` | `VALIDATION_ERROR` | 400 | `POST /users`, `PUT /users/{userId}` |
| `User ID already exist...` | `CONFLICT` | 409 | `POST /users` |
| `User ID NOT found...` | `NOT_FOUND` | 404 | `GET/PUT/DELETE /users/{userId}` |
| `Acct ID can NOT be empty...` | `VALIDATION_ERROR` | 400 | `POST /billing/payments`, account/card flows |
| `Invalid card expiry year` / invalid date text | `VALIDATION_ERROR` | 400 | `PUT /cards/{cardNum}`, account/card/report flows |
| `Type CD can NOT be empty...` / `Category CD can NOT be empty...` / `Amount can NOT be empty...` | `VALIDATION_ERROR` | 400 | `POST /transactions` |
| `Invalid value. Valid values are (Y/N)...` | `VALIDATION_ERROR` | 400 | `POST /transactions`, `POST /billing/payments`, `POST /reports/transactions` |
| `Confirm to make a bill payment...` / report confirm prompts | `VALIDATION_ERROR` | 400 | billing/report submit |
| `NO RECORDS TO SHOW` / `NO MORE RECORDS TO SHOW` | `NOT_FOUND` (or empty result with 200 for list APIs) | 404 or 200 | card/transaction list browse |
| `Unable to Write TDQ (JOBS)...` | `SYSTEM_ERROR` | 503 | `POST /reports/transactions` |
| CICS read/rewrite/write failure (`READ`, `REWRITE`, `WRITE` failure paths) | `SYSTEM_ERROR` | 500 | all data-mutating/query endpoints |
| Invalid menu/action/PF-key equivalent (`INVALID-KEY`, invalid selection/action code) | `VALIDATION_ERROR` | 400 | menu/list/detail action endpoints |
| Missing/expired session | `UNAUTHORIZED` | 401 | all protected endpoints |
| Role violation (admin-only function by user role) | `FORBIDDEN` | 403 | `/menu/admin`, `/users*` admin operations |

Implementation note:
- Preserve user-facing message text close to COBOL wording where feasible, while keeping `code` stable for frontend logic.
- For list endpoints, prefer `200` with empty `items` for "no data" searches; reserve `404` for direct-id lookups (`/users/{id}`, `/transactions/{id}`, `/cards/{cardNum}`).

## 7.10 Frontend error handling matrix (Angular)

Use this matrix in a shared HTTP interceptor + form error utility so every page handles backend errors consistently.

| API `code` | HTTP | Angular UI behavior | User action | Route/session behavior |
|---|---:|---|---|---|
| `VALIDATION_ERROR` | 400 | Show field-level inline errors from `details`; show top form banner with `message` | Correct inputs and resubmit | Stay on current page; preserve entered values |
| `UNAUTHORIZED` | 401 | Show global warning toast: "Session expired" or auth error text | Click **Sign in** | Clear client session state; redirect to `/signon` |
| `FORBIDDEN` | 403 | Show page-level access banner (not toast-only) | Click **Back to Menu** | Navigate to `/menu`; keep session |
| `NOT_FOUND` | 404 (detail endpoints) | Show inline page message (e.g., "User ID NOT found...") near search/id field | Retry with different id/filter | Stay on page |
| `CONFLICT` | 409 | Show inline conflict error on relevant key field (e.g., `userId`) | Update conflicting value and retry | Stay on page |
| `SYSTEM_ERROR` | 500/503 | Show non-dismissable error banner with correlation id; optional retry button | Retry once, else contact support | Stay on page unless unrecoverable |

### Page-level rendering rules

- Sign-on (`/signon`):
  - `VALIDATION_ERROR`: inline under `userId`/`password`.
  - `UNAUTHORIZED`: inline at top of sign-on form; do not route.

- Menu/Admin (`/menu`, `/admin`):
  - `FORBIDDEN`: route to `/menu` with banner.

- CRUD Forms (`/users/new`, `/users/:id/edit`, `/accounts/edit`, `/cards/edit`, `/transactions/new`, `/billing/payment`, `/reports/transactions`):
  - Always map `details[].field` to reactive form controls.
  - Keep dirty state and current values after error response.
  - Show confirm-related errors (`Y/N`) near confirm control.
  - Bill payment supports card details (`cardNum`, `expirationDate`, `secretCode`) with masked secret code + show/hide toggle.
  - If account id is present, billing page auto-loads saved card details and allows overwrite before submit.

- List pages (`/users`, `/accounts/view`, `/cards`, `/transactions`):
  - Empty search/list result should render empty grid state (not error dialog) when API returns `200` + empty `items`.
  - Use inline not-found hint only when endpoint is id-specific detail fetch and returns `404`.
  - `/accounts/view` renders table-first, opens detail panel only after `View` click, and exposes `Pay Selected Account` in detail mode.
  - If selected account has multiple cards, show card dropdown; if no cards, show `Add Card & Pay` option.
  - No detail page should render raw JSON dumps; use structured tables/cards for all view screens (account/card/transaction).

### Angular implementation guidance

- Implement `ApiErrorInterceptor` to normalize backend payload to:
  - `code`, `message`, `details`, `correlationId`.
- Implement `FormErrorMapperService`:
  - maps `details[].field` -> `FormControl.setErrors({ server: message })`.
- Implement `GlobalErrorBannerComponent`:
  - used for `SYSTEM_ERROR`, `FORBIDDEN`, and cross-page auth events.
- Log client-side error telemetry with:
  - route, endpoint, status, `code`, correlation id.

Common error model:
```json
{
  "code": "VALIDATION_ERROR|NOT_FOUND|CONFLICT|UNAUTHORIZED|FORBIDDEN|SYSTEM_ERROR",
  "message": "...",
  "details": [{ "field": "...", "message": "..." }]
}
```

---

## 8) Business Rules (deterministic extraction)

## 8.1 Authentication/authorization
- User must exist in `USRSEC`
- Password must match
- Role drives available menu options and admin access

## 8.2 User maintenance
- Add: all fields mandatory; user id unique
- Update: target user must exist; required fields mandatory
- Delete: explicit fetch + confirm action (PF5 equivalent)

## 8.3 Account/card maintenance
- Mandatory and format checks on account/card/customer fields
- Date validity checks for open/expiry/reissue/DOB
- Confirmation stage before write (`F5` equivalent)
- Persist via rewrite semantics (optimistic conflict handling in web API)

## 8.4 Transaction list/detail/add
- List supports browse/paging
- Detail requires transaction id
- Add transaction requires all business fields + valid dates
- Confirm must be `Y/N`

## 8.5 Bill payment
- Account id required and must exist
- Confirm `Y` required to post
- Posting creates transaction and updates account balance

## 8.6 Reporting request
- Monthly/yearly/custom selection controls date requirements
- Start/end date parts required for selected modes
- Date validity checked via utility (`CSUTLDTC` in COBOL)
- On success, request is queued (CICS TDQ equivalent)

---

## 9) Security and Session Behavior (Node equivalent)

Recommended approach:
- **Server-side sessions** (preferred for CICS COMMAREA parity)
  - `express-session` with SQLite store
  - store `userId`, `userType`, last route/context
- Alternative: JWT + server-side context cache

Role checks:
- Middleware `requireAuth`, `requireRole('A')`

Security controls:
- Password hashing (bcrypt/argon2)
- CSRF protection for cookie sessions
- Input validation/sanitization
- Audit log on login/user-change/account/card/transaction/report actions

COMMAREA mapping:
- `CARDDEMO-COMMAREA` -> session context object (`fromProgram`, `toProgram`, `user`, `contextFlags`, selected ids)

---

## 10) Non-Functional Requirements

- **Logging/Audit:** structured logs with correlation id per request; audit table for mutating operations
- **Performance:**
  - list endpoints P95 < 500 ms for default page size 20
  - detail endpoints P95 < 300 ms
  - indexed lookup by user/account/card/transaction ids
- **Validation/UX:**
  - deterministic server validation matching COBOL messages/rules
  - field-level errors returned and displayed inline
  - no hidden keyboard-only actions; all actions clickable
  - all date inputs use date picker

---

## 11) Build Instructions for Full Stack Engineer

## 11.0 Execution handoff docs
- ONLINE/full-stack implementation prompt guide: `copilot_build_instructions.md`
- BATCH reverse-engineering specification: `batch_specs.md`
- BATCH implementation prompt guide: `copilot_batch_build_instructions.md`

## 11.1 Recommended project structure

```
frontend/                 # Angular app
  src/app/
    core/                 # auth/session/http interceptors
    layout/               # header + nav menu
    pages/
      signon/
      menu-main/
      menu-admin/
      users-list/
      user-add/
      user-edit/
      user-delete/
      account-view/
      account-edit/
      cards-list/
      card-view/
      card-edit/
      transactions-list/
      transaction-view/
      transaction-add/
      bill-payment/
      report-transactions/
backend/
  src/
    app.ts
    routes/
    controllers/
    services/
    repositories/
    middleware/
    validation/
    db/
      migrations/
      seeds/
```

## 11.2 Key libraries
- Frontend: Angular Router, Reactive Forms, Angular Material Datepicker
- Backend: Express, `better-sqlite3` (or `sqlite3`), `zod`/`joi`, `express-session`, `helmet`, `pino`

## 11.2.1 Angular component blueprint (web-native bank template)

### App shell and layout
- `AppComponent`
  - mounts global router outlet
  - mounts global error banner outlet
- `AuthenticatedLayoutComponent`
  - wraps all authenticated routes
  - renders `HeaderComponent` + left/inline nav + content container
- `HeaderComponent`
  - left: bank brand title
  - center/right: full navigation menu from section 5.2
  - brand visual: credit card image/icon (asset path example: `frontend/src/assets/images/header-credit-card.png`)
  - user panel: signed-in user id/role + sign-out action

### Shared UI components
- `PageContainerComponent`
  - standard page title, subtitle, action area
- `SearchPanelComponent`
  - filter controls + Search/Clear buttons
- `DataGridComponent`
  - table, sort, pagination, empty-state template
- `ConfirmActionBarComponent`
  - standardized Confirm/Cancel/Back actions for save/delete/submit flows
- `InlineFieldErrorComponent`
  - displays form control + backend validation message
- `GlobalErrorBannerComponent`
  - handles `SYSTEM_ERROR`, `FORBIDDEN`, session errors

### Route-to-component map (Angular pages)
- `/signon` -> `SignOnPageComponent`
- `/menu` -> `MainMenuPageComponent`
- `/admin` -> `AdminMenuPageComponent`
- `/users` -> `UsersListPageComponent`
- `/users/new` -> `UserCreatePageComponent`
- `/users/:userId/edit` -> `UserEditPageComponent`
- `/users/:userId/delete` -> `UserDeletePageComponent`
- `/accounts/view` -> `AccountViewPageComponent`
- `/accounts/edit` -> `AccountEditPageComponent`
- `/cards` -> `CardsListPageComponent`
- `/cards/view` -> `CardViewPageComponent`
- `/cards/edit` -> `CardEditPageComponent`
- `/transactions` -> `TransactionsListPageComponent`
- `/transactions/view` -> `TransactionViewPageComponent`
- `/transactions/new` -> `TransactionCreatePageComponent`
- `/billing/payment` -> `BillPaymentPageComponent`
- `/reports/transactions` -> `TransactionReportRequestPageComponent`

### Feature services (frontend)
- `AuthApiService`: login/logout/me/session state hydration
- `MenuApiService`: main/admin menu options
- `UsersApiService`: list/get/create/update/delete
- `AccountsApiService`: account list/get/update
- `CardsApiService`: list/get/update
- `TransactionsApiService`: list/get/create
- `BillingApiService`: post payment
- `ReportsApiService`: queue report + history list

### State and error handling helpers
- `SessionStoreService`
  - active user, role, permissions, session expiry state
- `ApiErrorInterceptor`
  - normalize backend error payloads
  - route handling for 401/403 per section 7.10
- `FormErrorMapperService`
  - maps `details[].field` to reactive form controls

### Form model guidance
- Use strongly typed Reactive Forms for all input screens.
- Date fields (`origDate`, `procDate`, report dates, account/card dates, DOB) must use Material datepicker controls.
- Date fields (`origDate`, `procDate`, report dates, account/card dates, DOB, billing card expiry) must use date picker controls.
- Confirm flags (`Y/N`) should be rendered as web-native radio/toggle controls, not free-text single-char fields.

### Bank theme template guidance
- Use a shared `BankThemeModule`/style layer for consistent:
  - header/nav style
  - form field spacing and label hierarchy
  - table zebra/hover states
  - action button priority (primary/secondary/destructive)
- Keep visual treatment enterprise-banking oriented (clean, structured, low-noise) and consistent across all pages.

### Definition of done (component layer)
- Every route in section 5.1 has a concrete Angular page component.
- All pages render in authenticated shell (except sign-on).
- Header displays full nav + credit card image on every authenticated page.
- All actions are clickable controls with equivalent behavior to mapped CICS keys.
- Shared error and form-validation components are reused (no duplicate ad-hoc error UIs).
- View pages use structured presentation (tables/cards), not raw JSON output.
- Account View includes all-accounts list + paging and supports detail-first payment flow with selected account.

## 11.2.2 Backend blueprint (Node.js/Express + SQLite)

### Runtime architecture
- `ExpressApp` with layered design:
  - `routes` (transport)
  - `controllers` (request/response orchestration)
  - `services` (business rules and flow orchestration)
  - `repositories` (SQLite access)
  - `middleware` (auth/session/error/logging)
- Keep endpoint behavior aligned to sections 7, 7.8, 7.9, and 7.10.

### Recommended backend folder details
- `backend/src/app.ts` (express bootstrap)
- `backend/src/server.ts` (runtime entry)
- `backend/src/routes/`
  - `auth.routes.ts`
  - `menu.routes.ts`
  - `users.routes.ts`
  - `accounts.routes.ts`
  - `cards.routes.ts`
  - `transactions.routes.ts`
  - `billing.routes.ts`
  - `reports.routes.ts`
- `backend/src/controllers/`
  - `AuthController`, `MenuController`, `UsersController`, `AccountsController`, `CardsController`, `TransactionsController`, `BillingController`, `ReportsController`
- `backend/src/services/`
  - `AuthService`, `MenuService`, `UsersService`, `AccountsService`, `CardsService`, `TransactionsService`, `BillingService`, `ReportsService`
  - `SessionContextService` (COMMAREA-equivalent context persistence)
  - `ValidationMessageService` (COBOL-style message normalization)
- `backend/src/repositories/`
  - `UserSecurityRepository`, `CustomersRepository`, `AccountsRepository`, `CardsRepository`, `CardXrefRepository`, `TransactionsRepository`, `ReportRequestsRepository`, `SessionsRepository`
- `backend/src/validation/`
  - zod/joi schemas per endpoint
- `backend/src/middleware/`
  - `requireAuth.ts`, `requireRole.ts`, `errorHandler.ts`, `requestLogger.ts`, `correlationId.ts`
- `backend/src/db/`
  - `sqlite.ts`, `migrations/`, `seeds/`

### Controller contract blueprint
- Controllers should:
  - parse params/query/body
  - call schema validation
  - invoke service method
  - map service result to HTTP response/status
  - never embed SQL
- Example mapping:
  - `UsersController.create` -> `UsersService.createUser` -> `UserSecurityRepository.insert`
  - `AccountsController.update` -> `AccountsService.updateAccountAggregate` -> `AccountsRepository.update` + `CustomersRepository.update` (transactional)

### Service-layer business responsibilities
- `AuthService`
  - validate credentials against `user_security`
  - initialize session context (`userId`, `userType`, route/program context)
- `MenuService`
  - derive menu options by role using spec mappings
- `UsersService`
  - enforce required fields, uniqueness, CRUD behavior parity
- `AccountsService` / `CardsService`
  - enforce date and field edit rules
  - enforce confirmation semantics for update operations
- `TransactionsService`
  - list/detail/add with deterministic validations
- `BillingService`
  - enforce confirm `Y`
  - atomically create payment transaction + update account balance
- `ReportsService`
  - validate date windows and confirmation
  - persist queued request (TDQ equivalent via `report_requests`)

### Repository contract examples
- `UserSecurityRepository`
  - `findByUserId(userId)`
  - `list({ search, page, pageSize, sort })`
  - `insert(user)`
  - `update(userId, user)`
  - `delete(userId)`
- `TransactionsRepository`
  - `findByTranId(tranId)`
  - `list(filters)`
  - `insert(transaction)`
- `AccountsRepository`
  - `findAggregateByAcctId(acctId)`
  - `updateAccount(acctId, patch)`
  - `updateBalancesForPayment(acctId, amount)`

### Middleware and API standards
- `correlationId` middleware:
  - generate/propagate `x-correlation-id`
- `requestLogger` middleware:
  - structured logs (route, method, status, duration, userId, correlationId)
- `requireAuth` middleware:
  - enforce active session on protected routes
- `requireRole('A')` middleware:
  - enforce admin-only operations
- `errorHandler` middleware:
  - normalize to common error model (`code`, `message`, `details`)
  - map COBOL-like messages using section 7.9 table

### SQLite transaction boundaries
- Use DB transactions for multi-write operations:
  - account update aggregate (`accounts` + `customers` and optional related records)
  - bill payment (`transactions` insert + `accounts` balance update)
  - any future cross-table consistency operations

### Definition of done (backend layer)
- Every endpoint in section 7 is implemented with controller/service/repository separation.
- Validation and error mapping conform to sections 7.8/7.9/7.10.
- Auth/session and role checks enforced on all protected/admin routes.
- Multi-write flows are atomic via SQLite transactions.
- API responses include correlation id in headers for troubleshooting.

## 11.3 Local run scripts
- Root (run from workspace root; no nested `Set-Location frontend` / `Set-Location backend` chains):
  - `npm run dev:full` (alias of full-stack dev)
  - `npm run dev` (concurrently FE+BE)
  - `npm run dev:fe`
  - `npm run dev:be`
  - `npm run start:be`
  - `npm run start:fe`
  - `npm run db:migrate`
  - `npm run db:seed`
  - `npm run build:fe`
  - `npm run db:import-legacy` (replace-all import from `Src/aws-mainframe-modernization-carddemo-main/app/data/ASCII` into `customers`, `accounts`, `cards`, `card_xref`, `transactions`)
  - `npm run db:import-legacy:keep` (keep-existing import mode; inserts only missing rows and ignores duplicates)

## 11.3.1 API documentation endpoints (Swagger/OpenAPI)
- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Notes:
  - backend must be running (`npm run start:be` or `npm run dev:be` / `npm run dev:full`)
  - authenticated endpoints require a valid session cookie from login

## 11.4 Environment variables
- `PORT`
- `API_BASE_URL`
- `SQLITE_DB_PATH`
- `SESSION_SECRET`
- `LOG_LEVEL`

## 11.5 Seed data approach
- Seed minimum realistic entities:
  - admin + standard users
  - 10 customers, 10 accounts, related cards/xrefs
  - 100 transactions across categories
  - sample report requests

## 11.6 Acceptance criteria by journey
- Sign-on: valid credentials open menu; invalid shows deterministic error
- Menu/Admin: options rendered by role; unauthorized routes blocked
- User CRUD: list paging, add/update/delete complete with validation parity
- Account/Card: view/update flows with confirmation and persisted changes
- Transactions: list/detail/add with date validation and confirm behavior
- Bill payment: creates transaction and updates account balance atomically
- Reports: request accepted and persisted as queued record

## 11.7 Error UX and web-native UI acceptance checklist
- Header is visible on every authenticated page and includes full navigation + credit card image.
- Header includes user-selectable `High Contrast` toggle persisted for subsequent sessions/browser reload.
- All pages render as native responsive web layouts (desktop + tablet baseline), not terminal-style fixed coordinates.
- `VALIDATION_ERROR` responses show inline field messages mapped from `details[]` and preserve entered values.
- `UNAUTHORIZED` forces redirect to `/signon`; `FORBIDDEN` routes to `/menu` with clear banner.
- `CONFLICT` and `NOT_FOUND` are shown in context (field/page), not as generic modal-only failures.
- `SYSTEM_ERROR` shows banner with retry guidance and correlation id.
- List pages show empty-state UX for `200` with empty result sets.
- Card and transaction admin lists support explicit `Search` and `All` actions plus paging navigation.
- Every date input in forms uses a date picker.
- Monetary values are displayed with consistent currency formatting and 2-decimal precision across account/payment screens.
- Account view first-click `View` action scrolls to details panel and renders correctly in high-contrast mode.
- Card/transaction detail pages provide explicit in-page Back navigation (not browser-back dependent).

---

## 12) Traceability Matrix

| COBOL Program | BMS Map | Angular Page | API Endpoint(s) | SQLite Table(s) |
|---|---|---|---|---|
| COSGN00C | COSGN00 | `/signon` | `POST /auth/login` | `user_security`, `sessions` |
| COMEN01C | COMEN01 | `/menu` | `GET /menu/main` | `user_security` |
| COADM01C | COADM01 | `/admin` | `GET /menu/admin` | `user_security` |
| COUSR00C | COUSR00 | `/users` | `GET /users` | `user_security` |
| COUSR01C | COUSR01 | `/users/new` | `POST /users` | `user_security` |
| COUSR02C | COUSR02 | `/users/:userId/edit` | `GET/PUT /users/{userId}` | `user_security` |
| COUSR03C | COUSR03 | `/users/:userId/delete` | `DELETE /users/{userId}` | `user_security` |
| COACTVWC | COACTVW | `/accounts/view` | `GET /accounts/{acctId}` | `accounts`, `customers`, `cards`, `card_xref` |
| COACTUPC | COACTUP | `/accounts/edit` | `PUT /accounts/{acctId}` | `accounts`, `customers`, `cards`, `card_xref` |
| COCRDLIC | COCRDLI | `/cards` | `GET /cards` | `cards`, `card_xref` |
| COCRDSLC | COCRDSL | `/cards/view` | `GET /cards/{cardNum}` | `cards`, `accounts`, `customers`, `card_xref` |
| COCRDUPC | COCRDUP | `/cards/edit` | `PUT /cards/{cardNum}` | `cards` |
| COTRN00C | COTRN00 | `/transactions` | `GET /transactions` | `transactions` |
| COTRN01C | COTRN01 | `/transactions/view` | `GET /transactions/{tranId}` | `transactions` |
| COTRN02C | COTRN02 | `/transactions/new` | `POST /transactions` | `transactions`, `accounts`, `card_xref` |
| COBIL00C | COBIL00 | `/billing/payment` | `POST /billing/payments` | `transactions`, `accounts`, `cards`, `card_xref` |
| CORPT00C | CORPT00 | `/reports/transactions` | `POST /reports/transactions` | `report_requests` |

---

## 13) Open Questions / Gaps

1. **`COCRDSEC` missing source**
   - Evidence: `app/csd/CARDDEMO.CSD` has `DEFINE TRANSACTION(CDV1) PROGRAM(COCRDSEC)`; no `app/cbl/COCRDSEC.cbl` found.
   - Impact: cannot fully specify CDV1 flow.

2. **Dependency report artifacts absent**
   - `carddemo_dependencies.json` and Blu Insights PDF were not found in repository.
   - Inventory here is from CSD + source scan patterns only.

3. **Menu options point to programs not in base online scope**
   - Evidence in `app/cpy/COMEN02Y.cpy` and `app/cpy/COADM02Y.cpy` includes options like `COPAUS0C`, `COTRTLIC`, `COTRTUPC`.
   - These are variant-specific/out-of-scope for this ONLINE base app and need confirmation for target release.

4. **Some list/detail error texts are indirect constants**
   - Several messages are from common message copybooks (`CSMSG01Y`, `CSMSG02Y`) rather than hard-coded literals.
   - Exact wording for every branch should be finalized during implementation by tracing those copybooks and runtime mapping.

5. **Report execution is asynchronous beyond online layer**
   - Evidence: `CORPT00C` uses `WRITEQ TD` to queue `JOBS`.
   - Batch consumer contract (job name, output storage) is out-of-scope and should be defined with operations team.

---

## 14) Assumptions

- Target rebuild preserves online behavior semantics, not 3270 UI layout.
- RESTful operations replace CICS conversational state while preserving flow outcomes.
- Date fields are rendered as date pickers and exchanged as `YYYY-MM-DD`.
