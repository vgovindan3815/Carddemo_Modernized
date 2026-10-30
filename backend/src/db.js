const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required. See .env.example');
}

const sqlClient = neon(process.env.DATABASE_URL);

function toPositional(query) {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

async function sqlOne(query, params = []) {
  const rows = await sqlClient.unsafe(toPositional(query), params);
  return rows[0] ?? null;
}

async function sqlAll(query, params = []) {
  return await sqlClient.unsafe(toPositional(query), params);
}

async function sqlRun(query, params = []) {
  return await sqlClient.unsafe(toPositional(query), params);
}

async function sqlTx(fn) {
  return await sqlClient.transaction(async (txSql) => {
    const helpers = {
      txRun: (q, p = []) => txSql.unsafe(toPositional(q), p),
      txOne: (q, p = []) => txSql.unsafe(toPositional(q), p).then((r) => r[0] ?? null)
    };
    return await fn(helpers);
  });
}

const defaultBatchJobs = [
  {
    jobName: 'POSTTRAN',
    displayName: 'Post Daily Transactions',
    category: 'business',
    defaultParams: { processingDate: '', runMode: 'manual' },
    definition: {
      jobName: 'POSTTRAN',
      steps: [{ name: 'STEP15', type: 'program', target: 'CBTRN02C', condition: null, retry: { maxAttempts: 2, backoffMs: 300 } }]
    }
  },
  {
    jobName: 'INTCALC',
    displayName: 'Interest Calculation',
    category: 'business',
    defaultParams: { processingDate: '', runMode: 'manual' },
    definition: {
      jobName: 'INTCALC',
      steps: [{ name: 'STEP10', type: 'program', target: 'CBACT04C', condition: null, retry: { maxAttempts: 2, backoffMs: 300 } }]
    }
  },
  {
    jobName: 'TRANREPT',
    displayName: 'Transaction Report',
    category: 'reporting',
    defaultParams: { startDate: '', endDate: '', runMode: 'manual' },
    definition: {
      jobName: 'TRANREPT',
      steps: [
        { name: 'STEP05R', type: 'proc', target: 'REPROC', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } },
        { name: 'STEP05R_SORT', type: 'utility', target: 'SORT', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 200 } },
        { name: 'STEP10R', type: 'program', target: 'CBTRN03C', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 300 } }
      ]
    }
  },
  {
    jobName: 'CREASTMT',
    displayName: 'Create Statements',
    category: 'reporting',
    defaultParams: { processingDate: '', runMode: 'manual' },
    definition: {
      jobName: 'CREASTMT',
      steps: [
        { name: 'STEP05', type: 'utility', target: 'IDCAMS', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } },
        { name: 'STEP10', type: 'utility', target: 'SORT', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 200 } },
        { name: 'STEP20', type: 'program', target: 'CBSTM03A', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 300 } }
      ]
    }
  },
  {
    jobName: 'CBEXPORT',
    displayName: 'Export CardDemo Entities',
    category: 'extract',
    defaultParams: { processingDate: '', runMode: 'manual' },
    definition: {
      jobName: 'CBEXPORT',
      steps: [
        { name: 'STEP05', type: 'utility', target: 'IDCAMS', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } },
        { name: 'STEP10', type: 'program', target: 'CBEXPORT', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 300 } }
      ]
    }
  },
  {
    jobName: 'CBIMPORT',
    displayName: 'Import CardDemo Entities',
    category: 'extract',
    defaultParams: { processingDate: '', runMode: 'manual' },
    definition: {
      jobName: 'CBIMPORT',
      steps: [{ name: 'STEP10', type: 'program', target: 'CBIMPORT', condition: null, retry: { maxAttempts: 2, backoffMs: 300 } }]
    }
  },
  {
    jobName: 'ACCTFILE',
    displayName: 'Account File Setup',
    category: 'utility',
    defaultParams: { runMode: 'manual', inputFilePath: 'data/input/acctdata.txt' },
    definition: {
      jobName: 'ACCTFILE',
      steps: [{ name: 'STEP05', type: 'utility', target: 'IDCAMS', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } }]
    }
  },
  {
    jobName: 'CARDFILE',
    displayName: 'Card File Setup',
    category: 'utility',
    defaultParams: { runMode: 'manual', cardInputFilePath: 'data/input/carddata.txt', xrefInputFilePath: 'data/input/cardxref.txt' },
    definition: {
      jobName: 'CARDFILE',
      steps: [{ name: 'STEP05', type: 'utility', target: 'IDCAMS', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } }]
    }
  },
  {
    jobName: 'CUSTFILE',
    displayName: 'Customer File Setup',
    category: 'utility',
    defaultParams: { runMode: 'manual', inputFilePath: 'data/input/custdata.txt' },
    definition: {
      jobName: 'CUSTFILE',
      steps: [{ name: 'STEP05', type: 'utility', target: 'IDCAMS', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } }]
    }
  },
  {
    jobName: 'TRANBKP',
    displayName: 'Transaction Backup',
    category: 'utility',
    defaultParams: { processingDate: '', runMode: 'manual', outputDirPath: 'data/backup' },
    definition: {
      jobName: 'TRANBKP',
      steps: [
        { name: 'STEP05', type: 'proc', target: 'REPROC', condition: null, retry: { maxAttempts: 1, backoffMs: 0 } },
        { name: 'STEP10', type: 'utility', target: 'IDCAMS', condition: 'RC<=4', retry: { maxAttempts: 2, backoffMs: 250 } }
      ]
    }
  }
];

async function migrate() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS user_security (
      user_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      user_type TEXT NOT NULL CHECK(user_type IN ('A', 'U'))
    )`,

    `CREATE TABLE IF NOT EXISTS customers (
      cust_id BIGINT PRIMARY KEY,
      first_name TEXT NOT NULL,
      middle_name TEXT,
      last_name TEXT NOT NULL,
      addr_line_1 TEXT,
      addr_line_2 TEXT,
      addr_line_3 TEXT,
      state_cd TEXT,
      country_cd TEXT,
      zip TEXT,
      phone_1 TEXT,
      phone_2 TEXT,
      ssn TEXT UNIQUE,
      govt_id TEXT,
      dob TEXT,
      eft_account_id TEXT,
      primary_holder_ind TEXT,
      fico_score INTEGER
    )`,

    `CREATE TABLE IF NOT EXISTS accounts (
      acct_id BIGINT PRIMARY KEY,
      active_status TEXT NOT NULL,
      curr_bal DOUBLE PRECISION NOT NULL,
      credit_limit DOUBLE PRECISION NOT NULL,
      cash_credit_limit DOUBLE PRECISION NOT NULL,
      open_date TEXT,
      expiration_date TEXT,
      reissue_date TEXT,
      created_at TEXT,
      curr_cyc_credit DOUBLE PRECISION DEFAULT 0,
      curr_cyc_debit DOUBLE PRECISION DEFAULT 0,
      addr_zip TEXT,
      group_id TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS cards (
      card_num TEXT PRIMARY KEY,
      acct_id BIGINT NOT NULL,
      cvv_cd TEXT,
      embossed_name TEXT,
      expiration_date TEXT,
      active_status TEXT NOT NULL,
      FOREIGN KEY(acct_id) REFERENCES accounts(acct_id)
    )`,

    `CREATE TABLE IF NOT EXISTS card_xref (
      card_num TEXT PRIMARY KEY,
      cust_id BIGINT NOT NULL,
      acct_id BIGINT NOT NULL,
      FOREIGN KEY(card_num) REFERENCES cards(card_num),
      FOREIGN KEY(cust_id) REFERENCES customers(cust_id),
      FOREIGN KEY(acct_id) REFERENCES accounts(acct_id)
    )`,

    `CREATE TABLE IF NOT EXISTS transactions (
      tran_id TEXT PRIMARY KEY,
      tran_type_cd TEXT NOT NULL,
      tran_cat_cd INTEGER NOT NULL,
      source TEXT NOT NULL,
      description TEXT NOT NULL,
      amount DOUBLE PRECISION NOT NULL,
      merchant_id BIGINT NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_city TEXT NOT NULL,
      merchant_zip TEXT NOT NULL,
      card_num TEXT NOT NULL,
      orig_ts TEXT NOT NULL,
      proc_ts TEXT NOT NULL,
      FOREIGN KEY(card_num) REFERENCES cards(card_num)
    )`,

    `CREATE TABLE IF NOT EXISTS authorization_summary (
      acct_id BIGINT PRIMARY KEY,
      cust_id BIGINT NOT NULL,
      auth_status TEXT,
      credit_limit DOUBLE PRECISION NOT NULL,
      cash_limit DOUBLE PRECISION NOT NULL,
      credit_balance DOUBLE PRECISION NOT NULL,
      cash_balance DOUBLE PRECISION NOT NULL,
      approved_auth_count INTEGER DEFAULT 0,
      declined_auth_count INTEGER DEFAULT 0,
      approved_auth_amount DOUBLE PRECISION DEFAULT 0,
      declined_auth_amount DOUBLE PRECISION DEFAULT 0,
      FOREIGN KEY(acct_id) REFERENCES accounts(acct_id),
      FOREIGN KEY(cust_id) REFERENCES customers(cust_id)
    )`,

    `CREATE TABLE IF NOT EXISTS authorization_details (
      auth_id TEXT PRIMARY KEY,
      acct_id BIGINT NOT NULL,
      auth_date TEXT NOT NULL,
      auth_time TEXT NOT NULL,
      auth_orig_date TEXT NOT NULL,
      auth_orig_time TEXT NOT NULL,
      card_num TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      card_expiry_date TEXT,
      message_type TEXT,
      message_source TEXT,
      auth_id_code TEXT,
      auth_resp_code TEXT NOT NULL,
      auth_resp_reason TEXT,
      processing_code TEXT,
      transaction_amt DOUBLE PRECISION NOT NULL,
      approved_amt DOUBLE PRECISION NOT NULL,
      merchant_category_code TEXT,
      acqr_country_code TEXT,
      pos_entry_mode TEXT,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      merchant_city TEXT,
      merchant_state TEXT,
      merchant_zip TEXT,
      transaction_id TEXT,
      match_status TEXT DEFAULT 'P',
      auth_fraud TEXT DEFAULT '',
      fraud_rpt_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(acct_id) REFERENCES authorization_summary(acct_id),
      FOREIGN KEY(card_num) REFERENCES cards(card_num)
    )`,

    `CREATE TABLE IF NOT EXISTS report_requests (
      request_id BIGSERIAL PRIMARY KEY,
      requested_by TEXT NOT NULL,
      report_type TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      job_run_id TEXT,
      completed_at TEXT,
      error_summary TEXT,
      FOREIGN KEY(requested_by) REFERENCES user_security(user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_type TEXT NOT NULL,
      context_json TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES user_security(user_id)
    )`,

    `CREATE TABLE IF NOT EXISTS jobs (
      job_name TEXT PRIMARY KEY,
      display_name TEXT,
      category TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      default_params_json TEXT,
      job_definition_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS job_runs (
      job_run_id TEXT PRIMARY KEY,
      job_name TEXT NOT NULL REFERENCES jobs(job_name),
      submitted_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      submitted_by TEXT,
      run_mode TEXT,
      parameters_json TEXT,
      status TEXT NOT NULL,
      exit_code INTEGER,
      restart_of_job_run_id TEXT REFERENCES job_runs(job_run_id),
      correlation_id TEXT,
      output_dir TEXT,
      error_summary TEXT,
      cancel_requested_at TEXT,
      cancel_requested_by TEXT,
      cancel_reason TEXT
    )`,

    `CREATE TABLE IF NOT EXISTS job_run_steps (
      step_run_id TEXT PRIMARY KEY,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      step_seq INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      legacy_exec_type TEXT NOT NULL,
      legacy_exec_target TEXT NOT NULL,
      status TEXT NOT NULL,
      condition_expr TEXT,
      started_at TEXT,
      ended_at TEXT,
      return_code INTEGER,
      message TEXT,
      UNIQUE(job_run_id, step_seq)
    )`,

    `CREATE TABLE IF NOT EXISTS artifacts (
      artifact_id TEXT PRIMARY KEY,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      step_run_id TEXT REFERENCES job_run_steps(step_run_id),
      artifact_type TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT,
      storage_kind TEXT NOT NULL,
      storage_path TEXT,
      size_bytes INTEGER,
      checksum_sha256 TEXT,
      content_inline TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS batch_txn_postings (
      tran_id TEXT PRIMARY KEY REFERENCES transactions(tran_id),
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      posted_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS batch_interest_postings (
      acct_id BIGINT NOT NULL REFERENCES accounts(acct_id),
      processing_date TEXT NOT NULL,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      interest_amount DOUBLE PRECISION NOT NULL,
      posted_at TEXT NOT NULL,
      PRIMARY KEY (acct_id, processing_date)
    )`,

    `CREATE TABLE IF NOT EXISTS stage_export_records (
      id BIGSERIAL PRIMARY KEY,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      source_entity TEXT NOT NULL,
      record_seq INTEGER NOT NULL,
      raw_record TEXT,
      parsed_json TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS stage_import_errors (
      id BIGSERIAL PRIMARY KEY,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      record_seq INTEGER,
      error_message TEXT NOT NULL,
      raw_record TEXT,
      created_at TEXT NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS stage_statement_lines (
      id BIGSERIAL PRIMARY KEY,
      job_run_id TEXT NOT NULL REFERENCES job_runs(job_run_id),
      acct_id BIGINT,
      line_seq INTEGER NOT NULL,
      line_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_users_type ON user_security(user_type)`,
    `CREATE INDEX IF NOT EXISTS idx_cards_acct ON cards(acct_id)`,
    `CREATE INDEX IF NOT EXISTS idx_xref_acct ON card_xref(acct_id)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_card ON transactions(card_num)`,
    `CREATE INDEX IF NOT EXISTS idx_trans_proc ON transactions(proc_ts)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category)`,
    `CREATE INDEX IF NOT EXISTS idx_jobs_enabled ON jobs(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_job_runs_job_name ON job_runs(job_name)`,
    `CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status)`,
    `CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_job_run_steps_job_run_id ON job_run_steps(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_job_run_steps_status ON job_run_steps(status)`,
    `CREATE INDEX IF NOT EXISTS idx_artifacts_job_run_id ON artifacts(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_artifacts_step_run_id ON artifacts(step_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_details_acct ON authorization_details(acct_id)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_details_card ON authorization_details(card_num)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_details_date ON authorization_details(auth_date)`,
    `CREATE INDEX IF NOT EXISTS idx_auth_details_status ON authorization_details(match_status)`,
    `CREATE INDEX IF NOT EXISTS idx_batch_txn_postings_job_run_id ON batch_txn_postings(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batch_interest_postings_job_run_id ON batch_interest_postings(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_batch_interest_postings_processing_date ON batch_interest_postings(processing_date)`,
    `CREATE INDEX IF NOT EXISTS idx_stage_export_job_run_id ON stage_export_records(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stage_export_entity ON stage_export_records(source_entity)`,
    `CREATE INDEX IF NOT EXISTS idx_stage_import_errors_job_run_id ON stage_import_errors(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stage_statement_lines_job_run_id ON stage_statement_lines(job_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stage_statement_lines_acct_id ON stage_statement_lines(acct_id)`,

    `CREATE TABLE IF NOT EXISTS express_sessions (
      sid VARCHAR NOT NULL PRIMARY KEY,
      sess JSONB NOT NULL,
      expire TIMESTAMPTZ NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS express_sessions_expire_idx ON express_sessions (expire)`,

    `CREATE OR REPLACE FUNCTION set_account_created_at()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.created_at IS NULL THEN
        NEW.created_at := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql`,

    `DROP TRIGGER IF EXISTS trg_accounts_set_created_at ON accounts`,

    `CREATE TRIGGER trg_accounts_set_created_at
    BEFORE INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION set_account_created_at()`
  ];

  for (const stmt of stmts) {
    await sqlClient.unsafe(stmt);
  }
}

async function seedBatchJobs() {
  const now = new Date().toISOString();
  for (const job of defaultBatchJobs) {
    await sqlRun(
      `INSERT INTO jobs (job_name, display_name, category, enabled, default_params_json, job_definition_json, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT (job_name) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         category = EXCLUDED.category,
         default_params_json = EXCLUDED.default_params_json,
         job_definition_json = EXCLUDED.job_definition_json,
         updated_at = EXCLUDED.updated_at`,
      [job.jobName, job.displayName, job.category, JSON.stringify(job.defaultParams || {}), JSON.stringify(job.definition || {}), now, now]
    );
  }
}

async function seed() {
  const existing = await sqlOne('SELECT COUNT(*) as count FROM user_security', []);
  if (Number(existing.count) !== 0) {
    await seedBatchJobs();
    return;
  }

  await sqlRun(
    'INSERT INTO user_security (user_id, first_name, last_name, password_hash, user_type) VALUES (?, ?, ?, ?, ?)',
    ['A0000001', 'ADMIN', 'USER', bcrypt.hashSync('Passw0rd', 10), 'A']
  );
  await sqlRun(
    'INSERT INTO user_security (user_id, first_name, last_name, password_hash, user_type) VALUES (?, ?, ?, ?, ?)',
    ['U0000001', 'STANDARD', 'USER', bcrypt.hashSync('Passw0rd', 10), 'U']
  );

  await sqlRun(
    `INSERT INTO customers (cust_id, first_name, middle_name, last_name, addr_line_1, state_cd, country_cd, zip, phone_1, ssn, govt_id, dob, eft_account_id, primary_holder_ind, fico_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [100000001, 'JOHN', 'A', 'SMITH', '10 MAIN ST', 'TX', 'USA', '73301', '5125551111', '123456789', 'DL1234567', '1988-07-21', 'EFT998877', 'Y', 745]
  );

  await sqlRun(
    `INSERT INTO accounts (acct_id, active_status, curr_bal, credit_limit, cash_credit_limit, open_date, expiration_date, reissue_date, created_at, curr_cyc_credit, curr_cyc_debit, addr_zip, group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [10000000001, 'Y', 1250.45, 5000, 1500, '2024-01-10', '2028-01-31', '2026-01-31', new Date().toISOString(), 200, 350, '73301', 'GRP0000001']
  );

  await sqlRun(
    'INSERT INTO cards (card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status) VALUES (?, ?, ?, ?, ?, ?)',
    ['4444333322221111', 10000000001, '123', 'JOHN A SMITH', '2028-01-31', 'Y']
  );

  await sqlRun(
    'INSERT INTO card_xref (card_num, cust_id, acct_id) VALUES (?, ?, ?)',
    ['4444333322221111', 100000001, 10000000001]
  );

  await sqlRun(
    `INSERT INTO transactions (tran_id, tran_type_cd, tran_cat_cd, source, description, amount, merchant_id, merchant_name, merchant_city, merchant_zip, card_num, orig_ts, proc_ts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TXN202602240001', 'PM', 2001, 'BILLPAY', 'Monthly utility payment', 75.00, 100234567, 'UTILITY PAYMENT', 'AUSTIN', '73301', '4444333322221111', '2026-02-24T10:01:00Z', '2026-02-24T10:02:00Z']
  );

  await sqlRun(
    `INSERT INTO authorization_summary (acct_id, cust_id, auth_status, credit_limit, cash_limit, credit_balance, cash_balance, approved_auth_count, declined_auth_count, approved_auth_amount, declined_auth_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [10000000001, 100000001, 'Y', 5000, 1500, 1250.45, 0, 3, 1, 245.75, 50.00]
  );

  const now = new Date();
  const today = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeNow = now.toISOString().split('T')[1].replace(/[:.Z]/g, '').substring(0, 6);

  const authBase = [
    10000000001, today, timeNow, today, timeNow,
    '4444333322221111', 'PURCH', '2028-01', 'REQAUT', 'POS', null, '001000'
  ];

  await sqlRun(
    `INSERT INTO authorization_details (auth_id, acct_id, auth_date, auth_time, auth_orig_date, auth_orig_time, card_num, auth_type, card_expiry_date, message_type, message_source, auth_id_code, auth_resp_code, auth_resp_reason, processing_code, transaction_amt, approved_amt, merchant_category_code, acqr_country_code, pos_entry_mode, merchant_id, merchant_name, merchant_city, merchant_state, merchant_zip, transaction_id, match_status, auth_fraud, fraud_rpt_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['AUTH' + Date.now() + '001', ...authBase, 'AUTH001', '00', null, '001000', 89.99, 89.99, '5411', 'USA', '051', 'MER123456', 'GROCERY STORE', 'AUSTIN', 'TX', '73301', 'TXN' + Date.now() + '001', 'P', '', null, now.toISOString()]
  );

  await sqlRun(
    `INSERT INTO authorization_details (auth_id, acct_id, auth_date, auth_time, auth_orig_date, auth_orig_time, card_num, auth_type, card_expiry_date, message_type, message_source, auth_id_code, auth_resp_code, auth_resp_reason, processing_code, transaction_amt, approved_amt, merchant_category_code, acqr_country_code, pos_entry_mode, merchant_id, merchant_name, merchant_city, merchant_state, merchant_zip, transaction_id, match_status, auth_fraud, fraud_rpt_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['AUTH' + (Date.now() + 1) + '002', ...authBase, 'AUTH002', '00', null, '001000', 45.50, 45.50, '5812', 'USA', '051', 'MER789012', 'RESTAURANT', 'AUSTIN', 'TX', '73301', 'TXN' + (Date.now() + 1) + '002', 'P', '', null, now.toISOString()]
  );

  await sqlRun(
    `INSERT INTO authorization_details (auth_id, acct_id, auth_date, auth_time, auth_orig_date, auth_orig_time, card_num, auth_type, card_expiry_date, message_type, message_source, auth_id_code, auth_resp_code, auth_resp_reason, processing_code, transaction_amt, approved_amt, merchant_category_code, acqr_country_code, pos_entry_mode, merchant_id, merchant_name, merchant_city, merchant_state, merchant_zip, transaction_id, match_status, auth_fraud, fraud_rpt_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['AUTH' + (Date.now() + 2) + '003', ...authBase, 'AUTH003', '51', 'INSF', '001000', 5500.00, 0, '5411', 'USA', '051', 'MER345678', 'ELECTRONICS MEGA STORE', 'HOUSTON', 'TX', '77001', 'TXN' + (Date.now() + 2) + '003', 'D', '', null, now.toISOString()]
  );

  await seedBatchJobs();
}

if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === 'migrate') {
      await migrate();
      console.log('Migrations applied.');
    } else if (cmd === 'seed') {
      await migrate();
      await seed();
      console.log('Seed data applied.');
    } else {
      console.log('Usage: node src/db.js [migrate|seed]');
      process.exit(1);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { sqlOne, sqlAll, sqlRun, sqlTx, migrate, seed };
