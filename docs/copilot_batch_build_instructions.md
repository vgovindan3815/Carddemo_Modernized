# Copilot Phase-2 Build Instructions (Batch Modernization)

## Implemented Deltas (2026-02-24)

- `ACCTFILE` moved from validation-only behavior to real file ingestion/upsert.
  - Default input: `data/input/acctdata.txt`.
  - Fixed-width parsing corrected; signed overpunch numeric decoding added.
  - Legacy tail mapping added for `accounts.group_id`.
- `CUSTFILE` implemented as file-driven customer ingest/upsert.
  - Default input: `data/input/custdata.txt`.
- `CARDFILE` implemented as file-driven card + xref ingest/upsert.
  - Defaults: `cardInputFilePath=data/input/carddata.txt`, `xrefInputFilePath=data/input/cardxref.txt`.
- `TRANBKP` enhanced with configurable backup output folder.
  - Parameter/default: `outputDirPath` (`data/backup`).
- Batch Submit UI now exposes file/path fields by job:
  - `ACCTFILE`: `inputFilePath`
  - `CUSTFILE`: `inputFilePath`
  - `CARDFILE`: `cardInputFilePath`, `xrefInputFilePath`
  - `TRANBKP`: `outputDirPath`
  - UI helper text clarifies relative-path resolution against backend workspace root.
- `POSTTRAN` remains DB-driven posting and is explicitly non-file-ingest in modernization.

This guide is for implementing **batch modernization only** from `batch_specs.md`.

## Source of Truth

- Online/full-stack baseline spec: `specs.md`
- Batch reverse-engineering and target design: `batch_specs.md`
- Online implementation prompt guide: `copilot_build_instructions.md`
- Batch implementation prompt guide (this file): `copilot_batch_build_instructions.md`

## 1) Preconditions

- Workspace contains `batch_specs.md`.
- You allow Copilot Agent to create/edit files, run commands, and install dependencies.
- Scope is **batch only** (no CICS online pages/flows in this phase).

## 2) Target implementation choices

Implement **one runtime first** (Node.js preferred for this workspace), but keep structure extensible for both documented options:
- Option A: Spring Boot + Spring Batch
- Option B: Node.js job runner + REST API

For this repo, execute Option B first unless user explicitly requests Spring first.

## 3) Master Build Prompt (copy/paste)

Build the complete CardDemo **BATCH** modernization from `batch_specs.md` in one end-to-end run.

Hard requirements:
- Follow `batch_specs.md` as source of truth.
- Implement batch scope only; exclude online/CICS UI flows.
- Submission/viewing must be REST-only (no direct DB access from UI).
- Persist run metadata and artifacts in predictable storage:
  - SQLite metadata tables (`jobs`, `job_runs`, `job_run_steps`, `artifacts`)
  - output files under `output/{jobRunId}/...` with artifact metadata rows
- Implement these APIs:
  - `POST /api/jobs/{jobName}/submit`
  - `GET /api/jobs`
  - `GET /api/job-runs`
  - `GET /api/job-runs/{jobRunId}`
  - `GET /api/job-runs/{jobRunId}/logs`
  - `GET /api/job-runs/{jobRunId}/artifacts`
  - `GET /api/job-runs/{jobRunId}/artifacts/{artifactId}`
- Implement web pages:
  - Submit Batch Job
  - Job Runs
  - Run Detail
  - shared header navigation across all pages
- Date parameters must use date picker controls.
- Preserve legacy step orchestration semantics from JCL:
  - step order
  - condition handling (`COND`-equivalent)
  - per-step RC/exit mapping
- Include traceability in code/config comments or docs from job definitions to source JCL members.

Execution tasks:
1) Read `batch_specs.md` fully and derive implementation checklist.
2) Scaffold batch runtime (Node.js runner + API + SQLite + minimal web UI).
3) Create SQLite migrations for operational tables:
   - `jobs`, `job_runs`, `job_run_steps`, `artifacts`
4) Seed job definitions discovered from JCL inventory.
5) Implement job engine:
   - job definition loading
   - step execution pipeline
   - condition evaluator
   - status/RC mapping
   - log/artifact capture
6) Implement API endpoints and validation/error model.
7) Implement UI pages for submit/runs/detail + logs/artifacts actions.
8) Add local run scripts and env config.
9) Run, verify, and fix until clean.
10) Provide final report with:
   - files changed
   - commands run
   - endpoint verification results
   - known gaps/unknowns explicitly tied to `batch_specs.md` open questions.

Delivery constraints:
- Keep APIs and schemas aligned with `batch_specs.md`.
- Do not invent unsupported batch business rules.
- Where legacy detail is unknown, implement configurable adapters and mark TODO with source gap reference.
- Keep monetary payload values numeric (if present); UI formatting only.

## 4) Follow-up Prompt (if Copilot stops early)

continue and finish all remaining tasks for batch modernization per `batch_specs.md`, including:
- unresolved compile/runtime errors
- incomplete job definitions or step mappings
- missing API endpoints
- missing UI pages
- run verification and artifact retrieval checks

## 5) Verification Checklist

- `GET /api/jobs` returns seeded job definitions.
- Submitting a job returns `jobRunId` and creates `job_runs` + `job_run_steps` rows.
- Run status transitions are visible in `GET /api/job-runs` and run detail endpoint.
- Step-level logs/artifacts are retrievable through APIs.
- UI supports submit, list runs, view run detail, logs, and artifacts.
- Output files are created under `output/{jobRunId}/...` and tracked in `artifacts`.
- Condition/restart behavior is documented and reflected in runner logic.

## 6) Suggested local commands (Node.js option)

- Install deps: `npm install`
- Run migrations: `npm run batch:db:migrate`
- Seed jobs: `npm run batch:db:seed`
- Start API/runner UI: `npm run batch:dev`
- Build (if applicable): `npm run batch:build`

## 7) Environment variables

- `BATCH_SQLITE_DB_PATH`
- `BATCH_OUTPUT_DIR`
- `BATCH_LOG_LEVEL`
- `BATCH_MAX_PARALLEL_RUNS`
- `BATCH_DEFAULT_TIMEZONE`

## 8) Notes on unknowns

Implement unknown/externally referenced items (from `batch_specs.md` open questions) as:
- configurable placeholders
- explicit `To confirm` notes in final report
- non-blocking adapters where possible
