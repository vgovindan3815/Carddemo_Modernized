# Copilot One-Sprint Build Instructions (Single-Shot)

## Implemented Deltas (2026-02-24)

- Added account overview list endpoint and UI (`GET /accounts`) with paging, selection, and detail-first Pay action.
- Enhanced bill payment to support card details capture (`cardNum`, `expirationDate`, `secretCode`) with persistence/upsert for future reuse.
- Added billing UX enhancements: masked secret code with Show/Hide, date picker expiry input, and auto-populate by account id.
- Replaced remaining raw JSON output screens with structured table/card layouts (notably account/card/transaction detail views).
- Added account-view pagination controls and routed pay-from-account behavior into billing flow.
- Aligned validation/error payload behavior and legacy-style messaging for user/transaction/billing/report scenarios.
- Added admin list UX for cards/transactions with explicit `Search` + `All` actions and paging controls.
- Added explicit in-page Back navigation on card and transaction view pages.
- Added global user-selectable High Contrast mode toggle with persisted preference.
- Added backend Swagger/OpenAPI documentation routes (`/api-docs`, `/api-docs.json`).

## Implemented Deltas (2026-02-25)

- **Added CPVD/CPVS Authorization Module**:
  - Implemented Pending Authorizations list page (`/authorizations`) with filtering, pagination, and status badges.
  - Implemented Authorization Details view page (`/authorizations/view/:authId`) with comprehensive transaction/merchant information.
  - Added `authorization_summary` and `authorization_details` database tables with proper indexes and foreign keys.
  - Added 3 authorization API endpoints: list (with filters), detail, and mark-as-fraud.
  - Created sample data generation script producing 61 realistic authorizations across 15 active cards.
  - Added menu option 11 (Pending Authorizations) with COPAUS0C program reference.
  - Implemented back button navigation on authorization detail page.
  - Authorization list displays: auth ID, date/time, masked card number, merchant, amount, status, fraud badge.
  - Authorization detail shows three sections: Authorization Info, Transaction Details, Merchant Info.
  - Mark as Fraud button (PF5 equivalent) for flagging suspicious authorizations.
  - Match status filter dropdown: Pending (P), Matched (M), Declined (D), Error (E).

### Batch-related implemented notes (cross-reference)

- Batch job as-built behavior is documented in `batch_specs.md` and `copilot_batch_build_instructions.md`.
- Key completed batch updates include:
   - file-driven `ACCTFILE`, `CUSTFILE`, and `CARDFILE` ingestion with legacy ASCII defaults under `data/input`.
   - `TRANBKP` configurable backup output path (`outputDirPath`, default `data/backup`).
   - Batch Submit UI support for these job-specific input/output path parameters.
   - `POSTTRAN` retained as DB-driven posting (non-file-ingest).

This guide is designed so you can run GitHub Copilot in VS Code Agent mode and have it build the application from `specs.md` in one implementation cycle.

## 1) Preconditions

- Workspace root contains `specs.md`.
- You allow Copilot to create and edit files, run terminal commands, install dependencies, and run migrations/seeds.
- Target stack (must match spec):
  - Frontend: Angular
  - Backend: Node.js + Express
  - Database: SQLite
  - FE-BE integration: REST only

## 2) How to run in VS Code Copilot

1. Open this workspace in VS Code.
2. Open Copilot Chat.
3. Switch to Agent mode (not Ask mode).
4. Paste the **Master Build Prompt** below.
5. Let Copilot complete end-to-end work (scaffold, implement, run, fix, verify).
6. If Copilot pauses, reply with: `continue and finish all remaining tasks per specs.md`.

## 2.1 Root-safe local commands

Run these from workspace root (avoid nested `Set-Location frontend` / `Set-Location backend` chains):

- `npm run dev:full` (same as `npm run dev`)
- `npm run dev`
- `npm run dev:fe`
- `npm run dev:be`
- `npm run start:fe`
- `npm run start:be`
- `npm run db:migrate`
- `npm run db:seed`
- `npm run build:fe`
- `npm run build`

## 2.2 API docs (Swagger/OpenAPI)

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Start backend first using one of:
   - `npm run start:be`
   - `npm run dev:be`
   - `npm run dev:full`

## 3) Master Build Prompt (copy/paste as-is)

Build the complete CardDemo ONLINE modernization application from specs.md in this workspace in one end-to-end implementation run.

Hard requirements:
- Follow specs.md as source of truth.
- Implement only ONLINE scope and mapped pages/routes/APIs/tables.
- Do not invent screens or flows beyond specs.md.
- Stack must be Angular + Node/Express + SQLite.
- All FE↔BE interactions are REST APIs.
- All pages are native web pages (responsive), bank-themed template.
- Header must appear on all authenticated pages and include:
  - complete navigation menu (Home, Accounts, Cards, Transactions, Billing, Authorizations, Reports, Admin, Sign out)
  - brand/title
  - credit card image/icon
- All date inputs must use date picker components.
- No detail page may render raw JSON; all outputs must be structured UI (tables/cards/forms).
- Account View must include an all-accounts grid (paged) with table-only initial state and account selection.
- Account detail panel must open only after explicit `View` click.
- Payment action must be detail-first (`Pay Selected Account` from detail panel), not row-level in list.
- Card-on-file rules in account detail:
   - if multiple cards exist, show a card dropdown
   - if no cards exist, show `Add Card & Pay`
- Bill Payment must support credit-card details (`cardNum`, `expirationDate`, `secretCode`) where:
   - secret code is masked with Show/Hide toggle
   - expiry uses a date picker
   - account-id entry auto-loads saved card details when available
   - user edits/overrides are persisted for future use
- Implement deterministic error handling mapped to specs sections 7.8, 7.9, and 7.10.
- Implement auth/session, role checks, and admin restrictions exactly as specified.

Execution tasks:
1) Read specs.md fully and derive implementation checklist.
2) Scaffold project structure for frontend and backend as defined in specs.
3) Implement backend:
   - routes, controllers, services, repositories
   - SQLite migrations + seed scripts
   - session/auth middleware, role guards
   - common error model and correlation id
4) Implement frontend:
   - authenticated shell, bank-themed UI, header with credit card image
   - all routes/pages from specs
   - shared components/services/interceptors/form error mapper
   - date picker controls on all date fields
   - structured rendering for account/card/transaction detail pages (no JSON dumps)
   - account list paging controls and detail-first pay flow
   - cards-on-file dropdown/add-card-pay behavior in account detail
   - bill-payment card auto-populate + save/update behavior
5) Wire FE to BE using environment-based API base URL.
6) Run migrations and seed data.
7) Run app(s), fix compile/runtime issues, and re-run until clean.
8) Validate acceptance criteria in specs section 11 (including 11.7 UI/error checklist).
9) Produce final report with:
   - files created/updated
   - run commands
   - known gaps (if any)
   - exact steps to launch locally.

Delivery constraints:
- Use clear, maintainable code and typed DTO/schema validation.
- Keep API paths and payloads aligned with specs section 7.
- Keep monetary fields in API payloads numeric decimals (no currency symbols/formatting); apply currency formatting only in UI rendering.
- Use reusable shared UI components for consistency.
- If any ambiguity appears, choose the simplest behavior consistent with specs and document it in final report.

## 4) Follow-up Prompt (if Copilot stops early)

continue and finish all remaining tasks to fully satisfy specs.md, including:
- unresolved compile/runtime errors
- incomplete routes/pages/endpoints
- migration/seed/run verification
- acceptance checklist validation

## 5) Verification Checklist (you can ask Copilot to self-check)

- All routes from specs section 5.1 exist and are navigable.
- Header with full menu and credit card image is visible on authenticated pages.
- User, account, card, transaction, billing, authorization, and report journeys work.
- Date fields use date picker controls.
- Account View displays all accounts in structured paged table, opens detail only on `View`, and exposes pay from detail section.
- Account detail shows card dropdown when multiple cards are on file and `Add Card & Pay` when no cards exist.
- Bill Payment supports masked secret code with Show/Hide, auto-populates card by account id, and persists overrides.
- Monetary values in Account View, Account Update, and Bill Payment are rendered with consistent currency formatting and 2-decimal precision.
- Card View and Transaction View render structured tables/cards (not JSON output).
- Backend endpoints from specs section 7 are implemented.
- Error behavior matches sections 7.8/7.9/7.10.
- SQLite schema/migrations/seeds align with section 6.
- App runs locally with documented commands.

## 6) Optional strict prompt addition

If you want stronger enforcement, append this to the Master Build Prompt:

Do not stop after scaffolding. Continue until implementation, run, verification, and issue fixes are complete, then provide a final completion report.

## 7) Legacy Data Import Commands

Use these when you want to load legacy fixed-width source files from `Src/aws-mainframe-modernization-carddemo-main/app/data/ASCII` into SQLite (`customers`, `accounts`, `cards`, `card_xref`, `transactions`):

- Full replace import (clears those five tables first):
   - `npm run db:import-legacy`
- Keep-existing import (non-destructive; inserts only missing rows and ignores duplicates):
   - `npm run db:import-legacy:keep`

Notes:
- Default mode is replace-all.
- Keep-existing mode is idempotent for already-loaded records.
