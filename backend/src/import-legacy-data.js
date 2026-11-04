const fs = require('fs');
const path = require('path');
const { sqlRun, migrate } = require('./db');

// Default to the data/input directory; override with LEGACY_DATA_DIR env var.
const dataDir = process.env.LEGACY_DATA_DIR || path.join(__dirname, '..', '..', 'data', 'input');

function readLines(fileName) {
  const fullPath = path.join(dataDir, fileName);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8').split(/\r?\n/).filter((l) => l.trim().length > 0);
}

function field(line, start, length) {
  return line.slice(start, start + length);
}

function parseIntField(value) {
  const cleaned = value.trim();
  return cleaned.length ? parseInt(cleaned, 10) : 0;
}

function parseSignedCents(value) {
  const raw = value.trim();
  if (!raw) return 0;

  const lastChar = raw[raw.length - 1];
  const prefix = raw.slice(0, -1);

  const positiveMap = { '{': '0', A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7', H: '8', I: '9' };
  const negativeMap = { '}': '0', J: '1', K: '2', L: '3', M: '4', N: '5', O: '6', P: '7', Q: '8', R: '9' };

  if (Object.prototype.hasOwnProperty.call(positiveMap, lastChar)) {
    return parseInt(`${prefix}${positiveMap[lastChar]}`, 10) / 100;
  }
  if (Object.prototype.hasOwnProperty.call(negativeMap, lastChar)) {
    return -(parseInt(`${prefix}${negativeMap[lastChar]}`, 10) / 100);
  }
  return parseInt(raw, 10) / 100;
}

function parseDate(value) {
  const date = value.trim();
  return date || null;
}

function parseTimestamp(value) {
  const ts = value.trim();
  return ts || null;
}

async function clearTargetTables() {
  // Delete in FK-safe order — most dependent tables first
  await sqlRun('DELETE FROM authorization_details', []);
  await sqlRun('DELETE FROM authorization_summary', []);
  await sqlRun('DELETE FROM transactions', []);
  await sqlRun('DELETE FROM card_xref', []);
  await sqlRun('DELETE FROM cards', []);
  await sqlRun('DELETE FROM accounts', []);
  await sqlRun('DELETE FROM customers', []);
}

async function importCustomers(keepExisting) {
  const lines = readLines('custdata.txt');
  if (!lines) return { processed: 0, inserted: 0, ignored: 0, error: 'custdata.txt not found' };

  let inserted = 0;
  for (const line of lines) {
    const conflict = keepExisting ? 'ON CONFLICT DO NOTHING' : '';
    const rows = await sqlRun(`
      INSERT INTO customers (
        cust_id, first_name, middle_name, last_name,
        addr_line_1, addr_line_2, addr_line_3,
        state_cd, country_cd, zip,
        phone_1, phone_2, ssn, govt_id, dob,
        eft_account_id, primary_holder_ind, fico_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${conflict}
      RETURNING cust_id
    `, [
      parseIntField(field(line, 0, 9)),
      field(line, 9, 25).trim(),
      field(line, 34, 25).trim(),
      field(line, 59, 25).trim(),
      field(line, 84, 50).trim(),
      field(line, 134, 50).trim(),
      field(line, 184, 50).trim(),
      field(line, 234, 2).trim(),
      field(line, 236, 3).trim(),
      field(line, 239, 10).trim(),
      field(line, 249, 15).trim(),
      field(line, 264, 15).trim(),
      field(line, 279, 9).trim(),
      field(line, 288, 20).trim(),
      parseDate(field(line, 308, 10)),
      field(line, 318, 10).trim(),
      field(line, 328, 1).trim(),
      parseIntField(field(line, 329, 3))
    ]);
    inserted += rows.length;
  }

  return { processed: lines.length, inserted, ignored: lines.length - inserted };
}

async function importAccounts(keepExisting) {
  const lines = readLines('acctdata.txt');
  if (!lines) return { processed: 0, inserted: 0, ignored: 0, error: 'acctdata.txt not found' };

  let inserted = 0;
  for (const line of lines) {
    const conflict = keepExisting ? 'ON CONFLICT DO NOTHING' : '';
    const rows = await sqlRun(`
      INSERT INTO accounts (
        acct_id, active_status, curr_bal, credit_limit, cash_credit_limit,
        open_date, expiration_date, reissue_date,
        curr_cyc_credit, curr_cyc_debit,
        addr_zip, group_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${conflict}
      RETURNING acct_id
    `, [
      parseIntField(field(line, 0, 11)),
      field(line, 11, 1).trim(),
      parseSignedCents(field(line, 12, 12)),
      parseSignedCents(field(line, 24, 12)),
      parseSignedCents(field(line, 36, 12)),
      parseDate(field(line, 48, 10)),
      parseDate(field(line, 58, 10)),
      parseDate(field(line, 68, 10)),
      parseSignedCents(field(line, 78, 12)),
      parseSignedCents(field(line, 90, 12)),
      field(line, 102, 10).trim(),
      field(line, 112, 10).trim()
    ]);
    inserted += rows.length;
  }

  return { processed: lines.length, inserted, ignored: lines.length - inserted };
}

async function importCards(keepExisting) {
  const lines = readLines('carddata.txt');
  if (!lines) return { processed: 0, inserted: 0, ignored: 0, error: 'carddata.txt not found' };

  let inserted = 0;
  for (const line of lines) {
    const conflict = keepExisting ? 'ON CONFLICT DO NOTHING' : '';
    const rows = await sqlRun(`
      INSERT INTO cards (card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status)
      VALUES (?, ?, ?, ?, ?, ?)
      ${conflict}
      RETURNING card_num
    `, [
      field(line, 0, 16).trim(),
      parseIntField(field(line, 16, 11)),
      field(line, 27, 3).trim(),
      field(line, 30, 50).trim(),
      parseDate(field(line, 80, 10)),
      field(line, 90, 1).trim()
    ]);
    inserted += rows.length;
  }

  return { processed: lines.length, inserted, ignored: lines.length - inserted };
}

async function importCardXref(keepExisting) {
  const lines = readLines('cardxref.txt');
  if (!lines) return { processed: 0, inserted: 0, ignored: 0, error: 'cardxref.txt not found' };

  let inserted = 0;
  for (const line of lines) {
    const conflict = keepExisting ? 'ON CONFLICT DO NOTHING' : '';
    const rows = await sqlRun(`
      INSERT INTO card_xref (card_num, cust_id, acct_id)
      VALUES (?, ?, ?)
      ${conflict}
      RETURNING card_num
    `, [
      field(line, 0, 16).trim(),
      parseIntField(field(line, 16, 9)),
      parseIntField(field(line, 25, 11))
    ]);
    inserted += rows.length;
  }

  return { processed: lines.length, inserted, ignored: lines.length - inserted };
}

async function importTransactions(keepExisting) {
  const lines = readLines('dailytran.txt');
  if (!lines) return { processed: 0, inserted: 0, ignored: 0, error: 'dailytran.txt not found (skipped)' };

  let inserted = 0;
  for (const line of lines) {
    const conflict = keepExisting ? 'ON CONFLICT DO NOTHING' : '';
    const origTs = parseTimestamp(field(line, 298, 26));
    const procTs = parseTimestamp(field(line, 324, 26)) || origTs;
    const rows = await sqlRun(`
      INSERT INTO transactions (
        tran_id, tran_type_cd, tran_cat_cd,
        source, description, amount,
        merchant_id, merchant_name, merchant_city, merchant_zip,
        card_num, orig_ts, proc_ts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ${conflict}
      RETURNING tran_id
    `, [
      field(line, 0, 16).trim(),
      field(line, 16, 2).trim(),
      parseIntField(field(line, 18, 4)),
      field(line, 22, 10).trim(),
      field(line, 32, 100).trim(),
      parseSignedCents(field(line, 132, 11)),
      parseIntField(field(line, 143, 9)),
      field(line, 152, 50).trim(),
      field(line, 202, 50).trim(),
      field(line, 252, 10).trim(),
      field(line, 262, 16).trim(),
      origTs,
      procTs
    ]);
    inserted += rows.length;
  }

  return { processed: lines.length, inserted, ignored: lines.length - inserted };
}

async function runImport(options = {}) {
  const keepExisting = Boolean(options.keepExisting);
  await migrate();

  if (!keepExisting) {
    console.log('Clearing existing data...');
    await clearTargetTables();
  }

  console.log(`Importing from: ${dataDir}`);
  console.log(`Mode: ${keepExisting ? 'keep-existing (skip duplicates)' : 'replace-all'}`);

  const results = {
    mode: keepExisting ? 'keep-existing' : 'replace-all',
    customers: await importCustomers(keepExisting),
    accounts: await importAccounts(keepExisting),
    cards: await importCards(keepExisting),
    cardXref: await importCardXref(keepExisting),
    transactions: await importTransactions(keepExisting)
  };

  console.log('Legacy data imported successfully.');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

if (require.main === module) {
  const keepExisting = process.argv.includes('--keep-existing');
  runImport({ keepExisting })
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { runImport };
