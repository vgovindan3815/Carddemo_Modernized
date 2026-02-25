# CardDemo Batch Modernization Specification (`batch_specs.md`)

## 1) System Overview (Batch scope only)

## 1.1 Scope boundary: Batch vs Online
This document covers **batch processing only** from `app/jcl`, `app/proc`, `app/cbl`, `app/cpy`, `app/ctl`, and scheduler definitions.

- **In scope (batch):**
  - JCL jobs and step orchestration
  - Cataloged procedures (`PROC`)
  - Batch COBOL programs invoked by JCL (e.g., `CBTRN02C`, `CBACT04C`, `CBTRN03C`, `CBEXPORT`, `CBIMPORT`, `CBSTM03A`)
  - Utility steps (`IDCAMS`, `SORT`, `IEBGENER`, `IEFBR14`, `SDSF`, `FTP`, `IKJEFT1B`)
  - Dataset movement/report outputs and scheduler chains
- **Out of scope (online):**
  - CICS conversational flows, BMS maps, online menu/auth/user transaction screens

## 1.2 Batch data interaction model (legacy → modern)
Legacy batch jobs read/write VSAM and sequential datasets (DD-based). Modernized representation:

- **Business data representation:**
  - Normalize stable entities to SQLite tables (`accounts`, `customers`, `cards`, `card_xref`, `transactions`, `tran_type`, `tran_category`, `tran_cat_balance`, `disc_group`, `user_security`)
- **File-like/operational artifact representation:**
  - Preserve report/extract semantics as files under `output/{jobRunId}/...`
  - Persist file metadata in SQLite `artifacts` table
- **Control-card behavior:**
  - Externalize control cards as managed templates (e.g., `REPROCT` behavior) and store effective parameterization per run

## 1.3 Evidence sources used
- JCL members: `Src/aws-mainframe-modernization-carddemo-main/app/jcl/*`
- PROC members: `Src/aws-mainframe-modernization-carddemo-main/app/proc/*`
- COBOL programs: `Src/aws-mainframe-modernization-carddemo-main/app/cbl/*`
- Copybooks/layouts: `Src/aws-mainframe-modernization-carddemo-main/app/cpy/*`
- Control cards: `Src/aws-mainframe-modernization-carddemo-main/app/ctl/REPROCT.ctl`
- Scheduler topology: `Src/aws-mainframe-modernization-carddemo-main/app/scheduler/CardDemo.ca7`, `.../CardDemo.controlm`

## 1.4 Implemented modernization deltas (as-built on 2026-02-24)

- `ACCTFILE` is implemented as a file-driven ingest job in the modern runner (no longer metadata-only validation).
  - Supports fixed-width legacy records and delimited/json variants.
  - Uses overpunch signed-decimal decoding for amount fields.
  - Maps trailing legacy group token (example `A000000000`) to `accounts.group_id`.
  - Default input path: `data/input/acctdata.txt`.
- `CUSTFILE` is implemented as file-driven ingest from legacy customer file.
  - Default input path: `data/input/custdata.txt`.
- `CARDFILE` is implemented as file-driven ingest for both cards and xref linkage.
  - Card input default: `data/input/carddata.txt`.
  - Xref input default: `data/input/cardxref.txt`.
- `TRANBKP` remains a backup utility and now supports configurable output folder.
  - Parameter: `outputDirPath`.
  - Default output folder: `data/backup`.
- `POSTTRAN` remains non-file-driven in modernization.
  - It posts from DB `transactions` to `accounts` with idempotent markers in `batch_txn_postings`.
- Batch Submit UI was updated to accept runtime file/path parameters for:
  - `ACCTFILE` (`inputFilePath`)
  - `CUSTFILE` (`inputFilePath`)
  - `CARDFILE` (`cardInputFilePath`, `xrefInputFilePath`)
  - `TRANBKP` (`outputDirPath`)
- Account view parity enhancements tied to batch data were completed:
  - `insertedAt` now represents true table insert timestamp (`accounts.created_at` trigger-based behavior).
  - Timestamp is rendered in local-time format on account detail.

---

## 2) Discovered Batch Inventory (repo evidence)

## 2.1 JCL inventory (all discovered members in `app/jcl`)

| JCL Member | Steps (order) | Programs / PROC | Key Inputs / Outputs (DD / DSN examples) | Conditions / Restart Evidence |
|---|---|---|---|---|
| `ACCTFILE.jcl` | STEP05, STEP10, STEP15 | `IDCAMS` | `ACCTDATA` (`...ACCTDATA.PS`) → `ACCTVSAM` (`...ACCTDATA.VSAM.KSDS`) | none explicit |
| `CARDFILE.jcl` | CLCIFIL, STEP05, STEP10, STEP15, STEP40, STEP50, STEP60, OPCIFIL | `SDSF`, `IDCAMS` | `CARDDATA` (`...CARDDATA.PS`) → `CARDVSAM` (`...CARDDATA.VSAM.KSDS`) | none explicit |
| `CBADMCDJ.jcl` | STEP1 | `DFHCSDUP` | `DFHCSD`, `SYSIN`, `SYSPRINT` | none explicit |
| `CBEXPORT.jcl` | STEP01, STEP02 | `IDCAMS`, `CBEXPORT` | VSAM inputs (`CUSTFILE`, `ACCTFILE`, `XREFFILE`, `TRANSACT`, `CARDFILE`) → `EXPFILE` (`...EXPORT.DATA`) | none explicit |
| `CBIMPORT.jcl` | STEP01 | `CBIMPORT` | `EXPFILE` → `CUSTOUT`, `ACCTOUT`, `XREFOUT`, `TRNXOUT`, `ERROUT` | none explicit |
| `CLOSEFIL.jcl` | CLCIFIL | `SDSF` | operator/console-oriented `ISF*` DDs | none explicit |
| `COMBTRAN.jcl` | STEP05R, STEP10 | `SORT`, `IDCAMS` | `SORTIN` (`...TRANSACT.BKUP(0)`) → `SORTOUT`; then REPRO to `TRANVSAM` | none explicit |
| `CREASTMT.JCL` | DELDEF01, STEP010, STEP020, STEP030, STEP040 | `IDCAMS`, `SORT`, `IDCAMS`, `IEFBR14`, `CBSTM03A` | `TRANSACT.VSAM.KSDS` sorted to `TRXFL.SEQ`, loaded to `TRXFL.VSAM.KSDS`; outputs `STMTFILE`, `HTMLFILE` | `COND=(0,NE)` on STEP020/030/040 |
| `CUSTFILE.jcl` | CLCIFIL, STEP05, STEP10, STEP15, OPCIFIL | `SDSF`, `IDCAMS` | `CUSTDATA` (`...CUSTDATA.PS`) → `CUSTVSAM` (`...CUSTDATA.VSAM.KSDS`) | none explicit |
| `DALYREJS.jcl` | STEP05 | `IDCAMS` | GDG setup style SYSIN cards | none explicit |
| `DEFCUST.jcl` | STEP05, STEP05 | `IDCAMS` | duplicate step-name pattern in file | none explicit |
| `DEFGDGB.jcl` | STEP05 | `IDCAMS` | GDG base definition via SYSIN | none explicit |
| `DEFGDGD.jcl` | STEP10, STEP20, STEP30, STEP40, STEP50, STEP60 | `IDCAMS`, `IEBGENER`, `IDCAMS`, `IEBGENER`, `IDCAMS`, `IEBGENER` | backup/refresh for `TRANTYPE`, `TRANCATG`, `DISCGRP` datasets | `COND=(0,NE)` on STEP20/30/40/60; comment `RESTART=STEP30` |
| `DISCGRP.jcl` | STEP05, STEP10, STEP15 | `IDCAMS` | `DISCGRP.PS` → `DISCVSAM` (`...DISCGRP.VSAM.KSDS`) | none explicit |
| `DUSRSECJ.jcl` | PREDEL, STEP01, STEP02, STEP03 | `IEFBR14`, `IEBGENER`, `IDCAMS`, `IDCAMS` | create/load `USRSEC.PS` then into `USRSEC.VSAM.KSDS` | none explicit |
| `ESDSRRDS.jcl` | PREDEL, STEP01, STEP02, STEP03, STEP04, STEP05 | `IEFBR14`, `IEBGENER`, `IDCAMS`, `IDCAMS`, `IDCAMS`, `IDCAMS` | creates/loads ESDS and RRDS variants | none explicit |
| `FTPJCL.JCL` | STEP1 | `FTP` | FTP script via `SYSIN` | none explicit |
| `INTCALC.jcl` | STEP15 | `CBACT04C` | `TCATBALF`, `XREFFILE`, `ACCTFILE`, `DISCGRP`, `TRANSACT` | PARM passed (`'2022071800'`) |
| `INTRDRJ1.JCL` | IDCAMS, STEP01 | `IDCAMS`, `IEBGENER` | internal reader feed (`SYSUT2` etc.) for `INTRDRJ2` | none explicit |
| `INTRDRJ2.JCL` | IDCAMS | `IDCAMS` | backup-to-internal-reader style copy | none explicit |
| `OPENFIL.jcl` | OPCIFIL | `SDSF` | operator/console-oriented `ISF*` DDs | none explicit |
| `POSTTRAN.jcl` | STEP15 | `CBTRN02C` | `DALYTRAN` + `XREFFILE` + `ACCTFILE` + `TCATBALF` → `TRANFILE` + reject/update outputs | none explicit |
| `PRTCATBL.jcl` | DELDEF, STEP05R, STEP10R | `IEFBR14`, `PROC=REPROC`, `SORT` | unload `TCATBALF.VSAM.KSDS` to backup GDG and sort for print-style output | none explicit |
| `READACCT.jcl` | PREDEL, STEP05 | `IEFBR14`, `CBACT01C` | input `ACCTDATA.VSAM.KSDS` → `OUTFILE`, `ARRYFILE`, `VBRCFILE` | none explicit |
| `READCARD.jcl` | STEP05 | `CBACT02C` | read `CARDDATA.VSAM.KSDS` | none explicit |
| `READCUST.jcl` | STEP05 | `CBCUS01C` | read `CUSTDATA.VSAM.KSDS` | none explicit |
| `READXREF.jcl` | STEP05 | `CBACT03C` | read `CARDXREF.VSAM.KSDS` | none explicit |
| `REPTFILE.jcl` | STEP05 | `IDCAMS` | report GDG setup style SYSIN | none explicit |
| `TCATBALF.jcl` | STEP05, STEP10, STEP15 | `IDCAMS` | `TCATBALF.PS` → `TCATBALF.VSAM.KSDS` | none explicit |
| `TRANBKP.jcl` | STEP05R, STEP05, STEP10 | `PROC=REPROC`, `IDCAMS`, `IDCAMS` | unload `TRANSACT.VSAM.KSDS` to backup GDG then delete/define operations | `COND=(4,LT)` on STEP10 |
| `TRANCATG.jcl` | STEP05, STEP10, STEP15 | `IDCAMS` | `TRANCATG.PS` → `TRANCATG.VSAM.KSDS` | none explicit |
| `TRANFILE.jcl` | CLCIFIL, STEP05, STEP10, STEP15, STEP20, STEP25, STEP30, OPCIFIL | `SDSF`, `IDCAMS` | initial `DALYTRAN.PS.INIT` → `TRANSACT.VSAM.KSDS`, plus AIX/path operations | none explicit |
| `TRANIDX.jcl` | STEP20, STEP25, STEP30 | `IDCAMS` | index/path definitions for transaction master | none explicit |
| `TRANREPT.jcl` | STEP05R, STEP05R, STEP10R | `PROC=REPROC`, `SORT`, `CBTRN03C` | unload/sort transaction backup then produce `TRANREPT(+1)` from `TRANSACT.DALY(+1)` + reference files | sort INCLUDE condition in SYSIN |
| `TRANTYPE.jcl` | STEP05, STEP10, STEP15 | `IDCAMS` | `TRANTYPE.PS` → `TRANTYPE.VSAM.KSDS` | none explicit |
| `TXT2PDF1.JCL` | TXT2PDF | `IKJEFT1B` | input statement text (`STATEMNT.PS`) to PDF pipeline via exec libs | step condition line present (`COND=(0,NE)`) |
| `WAITSTEP.jcl` | WAIT | `COBSWAIT` | `STEPLIB`, `SYSIN`, `SYSOUT` | none explicit |
| `XREFFILE.jcl` | STEP05, STEP10, STEP15, STEP20, STEP25, STEP30 | `IDCAMS` | `CARDXREF.PS` → `CARDXREF.VSAM.KSDS`, with index/path steps | none explicit |

## 2.2 PROC inventory (`app/proc`)

| PROC member | Procedure name discovered | Purpose | Used by JCL |
|---|---|---|---|
| `REPROC.prc` | `REPROC` | Generic IDCAMS REPRO (`FILEIN` → `FILEOUT`) with control-card member `&CNTLLIB(REPROCT)` | `PRTCATBL.jcl`, `TRANBKP.jcl`, `TRANREPT.jcl` |
| `TRANREPT.prc` | `REPROC` (contains full multi-step transaction report flow) | Composite flow: REPRO unload + SORT filter + `CBTRN03C` report generation | Not invoked as `PROC=TRANREPT` in `app/jcl`; logic duplicates `TRANREPT.jcl` patterns (to confirm intended usage) |

## 2.3 COBOL batch programs referenced by JCL

| Program | Referenced by JCL | Purpose summary (from source comments/logic) | Main DD/file inputs | Main DD/file outputs | Key copybooks/layouts |
|---|---|---|---|---|---|
| `CBACT01C` | `READACCT.jcl` | Read account VSAM and write multiple output formats (print/array/VB) | `ACCTFILE` | `OUTFILE`, `ARRYFILE`, `VBRCFILE` | `CVACT01Y`, `CODATECN` |
| `CBACT02C` | `READCARD.jcl` | Read/print card data | `CARDFILE` | report-style SYSOUT | `CVACT02Y` |
| `CBACT03C` | `READXREF.jcl` | Read/print card cross-reference | `XREFFILE` | report-style SYSOUT | `CVACT03Y` |
| `CBACT04C` | `INTCALC.jcl` | Interest/charge related processing, updates account and category balances, writes transactions | `TCATBALF`, `XREFFILE`, `DISCGRP`, `ACCTFILE` | `TRANSACT` and account/category updates | `CVTRA01Y`, `CVTRA02Y`, `CVTRA05Y`, `CVACT03Y`, `CVACT01Y` |
| `CBCUS01C` | `READCUST.jcl` | Read/print customer data | `CUSTFILE` | report-style SYSOUT | `CVCUS01Y` |
| `CBTRN02C` | `POSTTRAN.jcl` | Post daily transactions, reject invalid, update account and category balances | `DALYTRAN`, `XREFFILE`, `ACCTFILE`, `TCATBALF` | `TRANFILE`, `DALYREJS`, rewritten balances | `CVTRA06Y`, `CVTRA05Y`, `CVACT03Y`, `CVACT01Y`, `CVTRA01Y` |
| `CBTRN03C` | `TRANREPT.jcl` | Produce transaction report with type/category enrichment and date filtering | `TRANFILE`, `CARDXREF`, `TRANTYPE`, `TRANCATG`, `DATEPARM` | `TRANREPT` | `CVTRA05Y`, `CVACT03Y`, `CVTRA03Y`, `CVTRA04Y`, `CVTRA07Y` |
| `CBSTM03A` | `CREASTMT.JCL` | Generate statement text/HTML outputs from transaction/account/customer/xref data | `TRNXFILE`, `XREFFILE`, `ACCTFILE`, `CUSTFILE` | `STMTFILE`, `HTMLFILE` | `COSTM01`, `CVACT03Y`, `CUSTREC`, `CVACT01Y` |
| `CBEXPORT` | `CBEXPORT.jcl` | Export customer/account/xref/transaction/card records to unified export file | VSAM source files | `EXPFILE` | `CVCUS01Y`, `CVACT01Y`, `CVACT03Y`, `CVTRA05Y`, `CVACT02Y`, `CVEXPORT` |
| `CBIMPORT` | `CBIMPORT.jcl` | Import export stream into entity-specific output files + error file | `EXPFILE` | `CUSTOUT`, `ACCTOUT`, `XREFOUT`, `TRNXOUT`, `CARDOUT`, `ERROUT` | `CVEXPORT`, `CVCUS01Y`, `CVACT01Y`, `CVACT03Y`, `CVTRA05Y`, `CVACT02Y` |
| `COBSWAIT` | `WAITSTEP.jcl` | Wait/hold utility batch program | `SYSIN` | `SYSOUT` | n/a |

---

## 3) Data Model (SQLite)

## 3.1 Operational metadata schema (required)

```sql
CREATE TABLE jobs (
  job_name TEXT PRIMARY KEY,
  source_member TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,                 -- business | setup | utility | scheduler
  enabled INTEGER NOT NULL DEFAULT 1,
  default_params_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE job_runs (
  job_run_id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL REFERENCES jobs(job_name),
  submitted_at TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  submitted_by TEXT,
  run_mode TEXT,                          -- manual | scheduled | replay
  parameters_json TEXT,
  status TEXT NOT NULL,                   -- queued | running | succeeded | failed | cancelled
  exit_code INTEGER,
  restart_of_job_run_id TEXT REFERENCES job_runs(job_run_id),
  correlation_id TEXT,
  output_dir TEXT,
  error_summary TEXT
);

CREATE INDEX idx_job_runs_job_name ON job_runs(job_name);
CREATE INDEX idx_job_runs_status ON job_runs(status);
CREATE INDEX idx_job_runs_started_at ON job_runs(started_at);

CREATE TABLE job_run_steps (
  step_run_id TEXT PRIMARY KEY,
  job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
  step_seq INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  legacy_exec_type TEXT NOT NULL,         -- PGM | PROC | UTILITY
  legacy_exec_target TEXT NOT NULL,       -- e.g., CBTRN02C or IDCAMS
  status TEXT NOT NULL,                   -- queued | running | succeeded | failed | skipped
  condition_expr TEXT,
  started_at TEXT,
  ended_at TEXT,
  return_code INTEGER,
  message TEXT,
  UNIQUE(job_run_id, step_seq)
);

CREATE INDEX idx_job_run_steps_job_run_id ON job_run_steps(job_run_id);
CREATE INDEX idx_job_run_steps_status ON job_run_steps(status);

CREATE TABLE artifacts (
  artifact_id TEXT PRIMARY KEY,
  job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
  step_run_id TEXT REFERENCES job_run_steps(step_run_id),
  artifact_type TEXT NOT NULL,            -- stdout | stderr | log | report | extract | control-card
  name TEXT NOT NULL,
  mime_type TEXT,
  storage_kind TEXT NOT NULL,             -- file | sqlite_blob | inline
  storage_path TEXT,
  size_bytes INTEGER,
  checksum_sha256 TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_artifacts_job_run_id ON artifacts(job_run_id);
CREATE INDEX idx_artifacts_step_run_id ON artifacts(step_run_id);
```

## 3.2 Business data schema (batch-focused)

### 3.2.1 Normalized business tables (recommended)
- `customers`, `accounts`, `cards`, `card_xref`, `transactions`, `tran_type`, `tran_category`, `tran_cat_balance`, `disc_group`, `user_security`
- Keep keys consistent with legacy business IDs (acct/card/cust IDs)

### 3.2.2 File-like staging tables (when preserving record fidelity)
Use file-like tables where strict fixed-width replay is required:
- `stage_export_records`
- `stage_import_errors`
- `stage_statement_lines`
- `stage_report_lines`

Include metadata columns:
- `job_run_id`, `source_file`, `record_seq`, `raw_record`, `parsed_json`, `created_at`

### 3.2.3 Constraints and indexes
- Unique business keys on primary identifiers (`acct_id`, `card_num`, etc.)
- Composite index examples:
  - `transactions(card_num, proc_ts)`
  - `tran_cat_balance(acct_id, tran_type_cd, tran_cat_cd)`
- Foreign-key enforcement on all relationship tables

---

## 4) Modern Execution Model (two options)

## 4.1 Option A: Spring Boot + Spring Batch

### Mapping principle
- **JCL Job** → **Spring Batch Job**
- **JCL EXEC Step** → **Spring Batch Step** (`TaskletStep` for utility-like actions, chunk for record processing)

### Step patterns
- `IDCAMS/IEBGENER/IEFBR14/SORT` steps → tasklet adapters:
  - `DatasetCopyTasklet`
  - `DatasetDefineTasklet`
  - `DatasetSortTasklet`
  - `NoopDeleteTasklet`
- COBOL logic steps:
  - If rewritten Java: chunk-oriented reader/processor/writer
  - If transitional: tasklet wrapper around executable bridge

### Restartability / exit mapping
- Map legacy RC to modern statuses:
  - RC=0 → `COMPLETED`
  - RC 1–4 (job-specific tolerance) → `COMPLETED_WITH_WARNINGS`
  - RC>4 or unhandled exception → `FAILED`
- Respect `COND=(...)` semantics by StepExecution decider
- Restart from failed step supported via Spring Batch metadata + `job_runs.restart_of_job_run_id`

### Parameterization
- Runtime parameters include:
  - `processingDate`, `startDate`, `endDate`
  - `inputDatasetAlias`, `outputDatasetAlias`
  - `runMode` (`manual|scheduled|replay`)

## 4.2 Option B: Node.js runner

### Mapping principle
- **JCL Job** → JSON/YAML job definition file
- **JCL Step** → modular worker function (or adapter for sort/copy/report)

Example definition shape:
```json
{
  "jobName": "POSTTRAN",
  "steps": [
    {"name": "STEP15", "type": "program", "target": "CBTRN02C", "condition": null}
  ]
}
```

### Execution strategy
- Sequential step engine with condition evaluator
- Each step emits:
  - `returnCode`
  - stdout/stderr logs
  - artifact entries
- Child process adapters for external tools where needed

### Retry/restart
- Retry policy (configurable per step): `maxAttempts`, `backoffMs`
- Restart mode:
  - `resume-from-failed-step`
  - `rerun-all`
- Persist cursor/checkpoint in `job_run_steps.message` JSON payload and/or dedicated checkpoint table

---

## 5) API Contract (REST)

Base path: `/api`

## 5.1 POST `/api/jobs/{jobName}/submit`
Submit a batch job run.

Request:
```json
{
  "runMode": "manual",
  "parameters": {
    "processingDate": "2026-02-24",
    "startDate": "2026-02-01",
    "endDate": "2026-02-24",
    "inputAliases": {"TRANFILE": "transactions_daily"}
  }
}
```

Response `202`:
```json
{
  "jobRunId": "JR_20260224_000123",
  "jobName": "TRANREPT",
  "status": "queued"
}
```

Errors: `400` invalid params, `404` unknown job, `409` already running (if singleton policy), `500` system error

## 5.2 GET `/api/jobs`
List available batch job definitions.

Response `200`:
```json
{
  "items": [
    {"jobName": "POSTTRAN", "category": "business", "enabled": true},
    {"jobName": "INTCALC", "category": "business", "enabled": true}
  ]
}
```

## 5.3 GET `/api/job-runs`
Filterable run list.

Query params: `jobName`, `status`, `from`, `to`, `page`, `pageSize`

Response `200`:
```json
{
  "items": [
    {
      "jobRunId": "JR_20260224_000123",
      "jobName": "TRANREPT",
      "status": "succeeded",
      "startedAt": "2026-02-24T09:00:03Z",
      "endedAt": "2026-02-24T09:00:18Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

## 5.4 GET `/api/job-runs/{jobRunId}`
Run details + step statuses.

Response `200`:
```json
{
  "jobRunId": "JR_20260224_000123",
  "jobName": "TRANREPT",
  "status": "succeeded",
  "parameters": {"startDate": "2026-02-01", "endDate": "2026-02-24"},
  "steps": [
    {"stepSeq": 1, "stepName": "STEP05R", "target": "REPROC", "status": "succeeded", "returnCode": 0},
    {"stepSeq": 2, "stepName": "STEP05R_SORT", "target": "SORT", "status": "succeeded", "returnCode": 0},
    {"stepSeq": 3, "stepName": "STEP10R", "target": "CBTRN03C", "status": "succeeded", "returnCode": 0}
  ]
}
```

Errors: `404` unknown run

## 5.5 GET `/api/job-runs/{jobRunId}/logs`
Get aggregated logs or references.

Response `200`:
```json
{
  "jobRunId": "JR_20260224_000123",
  "combinedLog": "...",
  "truncated": false
}
```

## 5.6 GET `/api/job-runs/{jobRunId}/artifacts`
List output artifacts.

Response `200`:
```json
{
  "items": [
    {"artifactId": "AR_001", "name": "TRANREPT_20260224.txt", "type": "report", "sizeBytes": 11452},
    {"artifactId": "AR_002", "name": "job.log", "type": "log", "sizeBytes": 9321}
  ]
}
```

## 5.7 GET `/api/job-runs/{jobRunId}/artifacts/{artifactId}`
Stream/download a specific artifact.

Responses:
- `200` with file stream
- `404` run/artifact not found
- `410` metadata exists but file missing

---

## 6) Web UI requirements

## 6.1 Global shell
- Header navigation visible on all pages:
  - `Submit Batch Job`
  - `Job Runs`
  - `Run Detail` (contextual)

## 6.2 Page 1: Submit Batch Job
- Job dropdown (`GET /api/jobs`)
- Dynamic parameter form
  - Date fields use date pickers
- Submit button → `POST /api/jobs/{jobName}/submit`
- Confirmation panel with `jobRunId` and link to detail page

## 6.3 Page 2: Job Runs
- Grid/table columns:
  - `jobName`, `jobRunId`, `start`, `end`, `status`
- Filters: job, status, date range
- Row actions: `View Detail`, `View Logs`, `View Artifacts`

## 6.4 Page 3: Run Detail
- Step timeline/table:
  - step name, legacy target, status, RC, timings
- Buttons: `View Logs`, `View Artifacts`

---

## 7) Traceability matrix (required)

> Each row includes file-path evidence and key strings searched from repo artifacts.

| JCL Job | JCL Steps / Programs | Inputs / Outputs | Modern Job/Step mapping | APIs | UI pages | SQLite tables | Repo evidence (file + key strings) |
|---|---|---|---|---|---|---|---|
| ACCTFILE | STEP05/10/15 `IDCAMS` | `ACCTDATA.PS` → `ACCTDATA.VSAM.KSDS` | `ACCTFILE` job; file-driven account upsert with fixed-width/overpunch decode + `group_id` mapping | submit/runs/detail/logs/artifacts | Submit, Runs, Detail | jobs, job_runs, job_run_steps, artifacts, accounts | `app/jcl/ACCTFILE.jcl`; `backend/src/batch-runner.js` (`executeAcctfileStep`, `parseAccountFixedWidthLine`) |
| CARDFILE | SDSF + multiple `IDCAMS` steps | `CARDDATA.PS` → `CARDDATA.VSAM.KSDS` (+ CARDXREF input) | `CARDFILE` job; file-driven upsert for `cards` and `card_xref` | same | same | same + cards/card_xref | `app/jcl/CARDFILE.jcl`; `backend/src/batch-runner.js` (`executeCardfileStep`) |
| CBADMCDJ | `DFHCSDUP` | CICS catalog defs | utility/admin job wrapper | same | same | metadata tables | `app/jcl/CBADMCDJ.jcl`; `EXEC PGM=DFHCSDUP`, `DD DFHCSD` |
| CBEXPORT | `IDCAMS` + `CBEXPORT` | VSAM entities → `EXPORT.DATA` | `CBEXPORT` extract job | same | same | metadata + stage_export_records/artifacts | `app/jcl/CBEXPORT.jcl`; `EXEC PGM=CBEXPORT`, `DD EXPFILE`; `app/cbl/CBEXPORT.cbl` |
| CBIMPORT | `CBIMPORT` | `EXPORT.DATA` → entity output files + errors | `CBIMPORT` ingest job | same | same | metadata + stage_import_errors/artifacts | `app/jcl/CBIMPORT.jcl`; `EXEC PGM=CBIMPORT`; `app/cbl/CBIMPORT.cbl` |
| CLOSEFIL | SDSF | operator/control interaction | `CLOSEFIL` operational gate tasklet | same | same | metadata tables | `app/jcl/CLOSEFIL.jcl`; `EXEC PGM=SDSF` |
| COMBTRAN | SORT + IDCAMS | transaction backup combine/load | `COMBTRAN` prep job | same | same | metadata + transactions staging | `app/jcl/COMBTRAN.jcl`; `EXEC PGM=SORT`, `DD SORTIN`, `DD TRANVSAM` |
| CREASTMT | IDCAMS/SORT/IEFBR14/CBSTM03A | trx sources → statement text/html | `CREASTMT` statement generation pipeline | same | same | metadata + artifacts (`STMTFILE`,`HTMLFILE`) | `app/jcl/CREASTMT.JCL`; `EXEC PGM=CBSTM03A`, `DD STMTFILE`, `DD HTMLFILE`; `app/cbl/CBSTM03A.CBL` |
| CUSTFILE | SDSF + IDCAMS | `CUSTDATA.PS` → VSAM | file-driven customer upsert job (`customers`) | same | same | metadata + customers | `app/jcl/CUSTFILE.jcl`; `backend/src/batch-runner.js` (`executeCustfileStep`) |
| DALYREJS | IDCAMS | reject GDG base/def | setup tasklet | same | same | metadata | `app/jcl/DALYREJS.jcl`; `EXEC PGM=IDCAMS` |
| DEFCUST | IDCAMS | customer file definition | setup tasklet | same | same | metadata | `app/jcl/DEFCUST.jcl`; `EXEC PGM=IDCAMS` |
| DEFGDGB | IDCAMS | GDG base creation | setup tasklet | same | same | metadata | `app/jcl/DEFGDGB.jcl`; `EXEC PGM=IDCAMS` |
| DEFGDGD | IDCAMS/IEBGENER chain | refresh backups for type/category/disc files | setup/maintenance pipeline with conditional steps | same | same | metadata | `app/jcl/DEFGDGD.jcl`; `COND=(0,NE)`, `RESTART=STEP30`, `SYSUT1/SYSUT2` |
| DISCGRP | IDCAMS | `DISCGRP.PS` → VSAM | setup/load tasklets | same | same | metadata + disc_group | `app/jcl/DISCGRP.jcl`; `DD DISCGRP`, `DD DISCVSAM` |
| DUSRSECJ | IEFBR14/IEBGENER/IDCAMS | create/load user security datasets | setup pipeline | same | same | metadata + user_security | `app/jcl/DUSRSECJ.jcl`; `DD ...USRSEC...` |
| ESDSRRDS | IEFBR14/IEBGENER/IDCAMS chain | ESDS/RRDS setup/load | utility conversion job | same | same | metadata | `app/jcl/ESDSRRDS.jcl`; `DD ...ESDSRRDS...` |
| FTPJCL | FTP | external transfer control | adapter tasklet | same | same | metadata + artifacts | `app/jcl/FTPJCL.JCL`; `EXEC PGM=FTP` |
| INTCALC | `CBACT04C` | account/xref/disc/balance inputs; writes trans and updates balances | `INTCALC` core business job | same | same | metadata + accounts/transactions/tran_cat_balance | `app/jcl/INTCALC.jcl`; `EXEC PGM=CBACT04C`; `app/cbl/CBACT04C.cbl` |
| INTRDRJ1 | IDCAMS + IEBGENER | internal reader feed | adapter utility job | same | same | metadata + artifacts | `app/jcl/INTRDRJ1.JCL`; `SYSUT2`, `INTRDRJ2` |
| INTRDRJ2 | IDCAMS | internal-reader backup manipulation | adapter utility job | same | same | metadata + artifacts | `app/jcl/INTRDRJ2.JCL`; `EXEC PGM=IDCAMS` |
| OPENFIL | SDSF | operator/control interaction | `OPENFIL` operational gate tasklet | same | same | metadata | `app/jcl/OPENFIL.jcl`; `EXEC PGM=SDSF` |
| POSTTRAN | `CBTRN02C` | daily txn input + ref files; outputs posted/reject + balance updates | `POSTTRAN` DB-driven posting job (not file-ingest), idempotent via `batch_txn_postings` | same | same | metadata + transactions/accounts/tran_cat_balance/artifacts + batch_txn_postings | `app/jcl/POSTTRAN.jcl`; `backend/src/batch-runner.js` (`executePosttranStep`) |
| PRTCATBL | IEFBR14 + `PROC=REPROC` + SORT | unload/print category-balance backup | reporting utility pipeline | same | same | metadata + artifacts | `app/jcl/PRTCATBL.jcl`; `EXEC PROC=REPROC`; `SORTIN` |
| READACCT | IEFBR14 + `CBACT01C` | account VSAM read → multiple file outputs | inquiry/export utility | same | same | metadata + artifacts | `app/jcl/READACCT.jcl`; `EXEC PGM=CBACT01C`; `app/cbl/CBACT01C.cbl` |
| READCARD | `CBACT02C` | card VSAM read | inquiry utility | same | same | metadata + artifacts | `app/jcl/READCARD.jcl`; `EXEC PGM=CBACT02C` |
| READCUST | `CBCUS01C` | customer VSAM read | inquiry utility | same | same | metadata + artifacts | `app/jcl/READCUST.jcl`; `EXEC PGM=CBCUS01C` |
| READXREF | `CBACT03C` | card-xref VSAM read | inquiry utility | same | same | metadata + artifacts | `app/jcl/READXREF.jcl`; `EXEC PGM=CBACT03C` |
| REPTFILE | IDCAMS | report GDG setup | setup tasklet | same | same | metadata | `app/jcl/REPTFILE.jcl`; `EXEC PGM=IDCAMS` |
| TCATBALF | IDCAMS | category-balance PS → VSAM | setup/load tasklet | same | same | metadata + tran_cat_balance | `app/jcl/TCATBALF.jcl`; `DD TCATBAL`, `DD TCATBALV` |
| TRANBKP | `PROC=REPROC` + IDCAMS | unload trans VSAM to backup + lifecycle ops | backup pipeline with configurable output directory (`outputDirPath`) | same | same | metadata + artifacts | `app/jcl/TRANBKP.jcl`; `backend/src/batch-runner.js` (`executeTranbkpStep`) |
| TRANCATG | IDCAMS | transaction category PS → VSAM | setup/load tasklet | same | same | metadata + tran_category | `app/jcl/TRANCATG.jcl`; `DD TRANCATG`, `DD TCATVSAM` |
| TRANFILE | SDSF + IDCAMS chain | initialize/load transaction master + indexes | dataset lifecycle pipeline | same | same | metadata + transactions | `app/jcl/TRANFILE.jcl`; `DD TRANSACT`, `DD TRANVSAM` |
| TRANIDX | IDCAMS chain | define AIX/path for transaction master | indexing utility | same | same | metadata | `app/jcl/TRANIDX.jcl`; `STEP20/25/30 EXEC PGM=IDCAMS` |
| TRANREPT | `PROC=REPROC` + SORT + `CBTRN03C` | filtered daily transaction report generation | `TRANREPT` core reporting job | same | same | metadata + artifacts + reporting tables | `app/jcl/TRANREPT.jcl`; `EXEC PGM=CBTRN03C`; `DD DATEPARM`; `app/cbl/CBTRN03C.cbl` |
| TRANTYPE | IDCAMS | transaction type PS → VSAM | setup/load tasklet | same | same | metadata + tran_type | `app/jcl/TRANTYPE.jcl`; `DD TRANTYPE`, `DD TTYPVSAM` |
| TXT2PDF1 | IKJEFT1B | statement text to PDF conversion flow | artifact-conversion tasklet | same | same | metadata + artifacts | `app/jcl/TXT2PDF1.JCL`; `EXEC PGM=IKJEFT1B`; `DD INDD` |
| WAITSTEP | `COBSWAIT` | explicit delay/wait gate | wait tasklet | same | same | metadata | `app/jcl/WAITSTEP.jcl`; `EXEC PGM=COBSWAIT`; `app/cbl/COBSWAIT.cbl` |
| XREFFILE | IDCAMS chain | card-xref PS → VSAM + index/path | setup/load/index pipeline | same | same | metadata + card_xref | `app/jcl/XREFFILE.jcl`; `DD XREFDATA`, `DD XREFVSAM` |

## 7.1 Scheduler-evidenced orchestration (important for modernization)
From scheduler exports, recurring chains are explicit and should be preserved as modern workflows/triggers:

- **Daily Transaction Backup chain:** `CLOSEFIL -> TRANBKP -> WAITSTEP -> OPENFIL`
- **Monthly Interest chain:** `CLOSEFIL -> INTCALC -> COMBTRAN -> WAITSTEP -> OPENFIL`
- **Weekly Disclosure refresh chain:** `CLOSEFIL -> DISCGRP -> WAITSTEP -> OPENFIL`

Evidence:
- `app/scheduler/CardDemo.controlm` (`INCOND`, `OUTCOND`, `JOBNAME`)
- `app/scheduler/CardDemo.ca7` (`TRIGGERED JOBS` sections)

---

## 8) Open Questions / Gaps (Unknown/To confirm)

1. **Dependency artifacts referenced in request not found**
   - `carddemo_dependencies.json` and `bluinsights-carddemo-...pdf` were not located in workspace.
   - Searched: workspace glob `**/carddemo_dependencies.json`, `**/*bluinsights*carddemo*.pdf`.

2. **`TRANREPT.prc` naming/content mismatch**
   - File name suggests `TRANREPT`, but member defines `//REPROC PROC` and includes full report flow.
   - Confirm whether this is intentional duplication, historical backup, or naming error.

3. **Control-card variability**
   - Only `ctl/REPROCT.ctl` discovered (`REPRO INFILE(FILEIN) OUTFILE(FILEOUT)`).
   - Other job-specific control card libraries referenced by DSN could be external to repository.

4. **Scheduler references to jobs not present in `app/jcl`**
   - Example: `MNTTRDB2`, `TRANEXTR`, `CBPAUP0J` appear in scheduler exports.
   - Confirm whether these jobs exist in another repo/lpar library.

5. **Some JCLs are infrastructure/admin utilities rather than business batch**
   - e.g., `CBADMCDJ`, `FTPJCL`, `INTRDRJ*`, `TXT2PDF1`.
   - Confirm modernization inclusion policy (full parity vs business-only execution catalog).

---

## 9) Modernization recommendations (clearly marked)

### 9.1 Dataset abstraction recommendation
- Create a logical dataset alias catalog (e.g., `AWS.M2.CARDDEMO.TRANSACT.VSAM.KSDS` → `transactions_master`) so runtime is environment-neutral.

### 9.2 Idempotency recommendation
- For business jobs (`POSTTRAN`, `INTCALC`, `TRANREPT`, `CREASTMT`):
  - Use idempotency key: `jobName + businessDate + parameter hash`
  - Reject duplicate active runs (`409`) and optionally allow explicit replay mode.

### 9.3 Restart recommendation
- Persist step checkpoints and support resume from failed step where safe.
- Preserve legacy condition semantics (`COND`) in decider logic.

---

## 10) How to Build (implementation guidance)

## 10.1 Option A: Spring Boot + Spring Batch

### Suggested modules
- `batch-api` (REST controllers)
- `batch-core` (job/step definitions)
- `batch-data` (SQLite repositories)
- `batch-workers` (step tasklets/chunk processors)

### Environment variables
- `BATCH_DB_PATH=./data/batch.db`
- `BATCH_OUTPUT_DIR=./output`
- `BATCH_MAX_PARALLEL_RUNS=2`
- `BATCH_LOG_LEVEL=INFO`

### Local run (example)
```bash
./mvnw clean package
./mvnw spring-boot:run
```

## 10.2 Option B: Node.js runner

### Suggested modules
- `api/` (Express/Fastify REST)
- `runner/` (job engine, condition evaluator)
- `jobs/` (job definitions + steps)
- `workers/` (program/utility adapters)
- `storage/` (SQLite + artifact FS)

### Environment variables
- `SQLITE_DB_PATH=./data/batch.db`
- `BATCH_OUTPUT_DIR=./output`
- `BATCH_MAX_PARALLEL_RUNS=2`
- `BATCH_LOG_LEVEL=info`

### Local run (example)
```bash
npm install
npm run migrate
npm run seed:jobs
npm run dev
```

## 10.3 Seed data guidance
- Seed `jobs` from discovered JCL members
- Seed job-step definitions from JCL parsing results
- Seed sample run history for UI demonstration (success/fail/restart scenarios)

## 10.4 Test approach

### Unit tests
- JCL parser correctness (`EXEC`, `DD`, `COND`, PROC expansion)
- Condition evaluator (`COND=(0,NE)`, `COND=(4,LT)` semantics)
- Artifact metadata persistence

### Integration tests
- End-to-end job submission (`POST /submit`) through completion
- Run detail and artifacts retrieval APIs
- Restart/replay scenario for partially failed multi-step jobs

### Non-functional tests
- Concurrent submissions and lock behavior
- Output directory cleanup/retention policy
- Scheduler-trigger simulation (daily/monthly chains)

## 10.5 Operational runbook (as-built sequence)

Use this sequence when restoring or reloading core batch datasets in the modernized runtime.

### Recommended execution order
1. `ACCTFILE`
  - Default: `inputFilePath=data/input/acctdata.txt`
2. `CUSTFILE`
  - Default: `inputFilePath=data/input/custdata.txt`
3. `CARDFILE`
  - Defaults:
    - `cardInputFilePath=data/input/carddata.txt`
    - `xrefInputFilePath=data/input/cardxref.txt`
4. `POSTTRAN`
  - DB-driven posting (no file parameter)
  - Uses unposted rows in `transactions` up to `processingDate`
5. `TRANBKP`
  - Optional backup output path: `outputDirPath` (default `data/backup`)

### Post-run validation checks
- `accounts` should have non-zero balances after `ACCTFILE` (unless source truly contains zeros).
- `customers`, `cards`, and `card_xref` should each have expected row counts (typically 50 in seeded demo).
- `linkedAccounts` (distinct `accounts` joined to `card_xref`) should match account population.
- `POSTTRAN` should create entries in `batch_txn_postings` and adjust account balances for eligible transactions.
- `TRANBKP` should produce:
  - `TRANBKP_YYYYMMDD.json`
  - `TRANBKP_YYYYMMDD_SUMMARY.txt`
  - step log artifact

### UI/operator notes
- Submit page exposes the above input/output paths per job.
- Relative paths are resolved from backend workspace root.
- For data-refresh incidents (for example all-zero balances), re-run `ACCTFILE` first, then `CUSTFILE`/`CARDFILE` for linkage consistency.

---

## 11) Evidence query appendix (key strings searched)

Primary search patterns used while reverse engineering:
- JCL structure: `^//\S+\s+JOB`, `^//\S+\s+EXEC`, `^//\S+\s+DD`, `COND=`, `RESTART`
- PROC usage: `EXEC PROC=`
- COBOL I/O structure: `PROGRAM-ID`, `SELECT`, `FD`, `COPY`, `OPEN`, `READ`, `WRITE`, `REWRITE`
- Scheduler dependency: `INCOND`, `OUTCOND`, `TRIGGERED JOBS`

These patterns were applied to:
- `app/jcl/*`
- `app/proc/*`
- `app/cbl/*`
- `app/cpy/*`
- `app/ctl/*`
- `app/scheduler/*`
