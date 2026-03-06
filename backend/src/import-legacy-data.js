const fs = require('fs');
const path = require('path');
const { db, migrate } = require('./db');

const dataDir = process.env.LEGACY_DATA_DIR || path.join(
  __dirname,
  '..',
  '..',
  'Src',
  'aws-mainframe-modernization-carddemo-main',
  'app',
  'data',
  'ASCII'
);

function readLines(fileName) {
  const fullPath = path.join(dataDir, fileName);
  const content = fs.readFileSync(fullPath, 'utf8');
  return content.split(/\r?\n/).filter((line) => line.trim().length > 0);
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
  if (!raw) {
    return 0;
  }

  const lastChar = raw[raw.length - 1];
  const prefix = raw.slice(0, -1);

  const positiveMap = {
    '{': '0',
    A: '1',
    B: '2',
    C: '3',
    D: '4',
    E: '5',
    F: '6',
    G: '7',
    H: '8',
    I: '9'
  };

  const negativeMap = {
    '}': '0',
    J: '1',
    K: '2',
    L: '3',
    M: '4',
    N: '5',
    O: '6',
    P: '7',
    Q: '8',
    R: '9'
  };

  if (Object.prototype.hasOwnProperty.call(positiveMap, lastChar)) {
    const digits = `${prefix}${positiveMap[lastChar]}`;
    return parseInt(digits, 10) / 100;
  }

  if (Object.prototype.hasOwnProperty.call(negativeMap, lastChar)) {
    const digits = `${prefix}${negativeMap[lastChar]}`;
    return -(parseInt(digits, 10) / 100);
  }

  return parseInt(raw, 10) / 100;
}

function parseDate(value) {
  const date = value.trim();
  return date || null;
}

function parseTimestamp(value) {
  const timestamp = value.trim();
  return timestamp || null;
}

function clearTargetTables() {
  db.exec(`
    DELETE FROM transactions;
    DELETE FROM card_xref;
    DELETE FROM cards;
    DELETE FROM accounts;
    DELETE FROM customers;
  `);
}

function buildInsertVerb(keepExisting) {
  return keepExisting ? 'INSERT OR IGNORE' : 'INSERT';
}

function importCustomers(keepExisting) {
  const lines = readLines('custdata.txt');
  const insertVerb = buildInsertVerb(keepExisting);
  const insert = db.prepare(`
    ${insertVerb} INTO customers (
      cust_id, first_name, middle_name, last_name,
      addr_line_1, addr_line_2, addr_line_3,
      state_cd, country_cd, zip,
      phone_1, phone_2, ssn, govt_id, dob,
      eft_account_id, primary_holder_ind, fico_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const line of lines) {
    const result = insert.run(
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
    );
    inserted += result.changes;
  }

  return {
    processed: lines.length,
    inserted,
    ignored: lines.length - inserted
  };
}

function importAccounts(keepExisting) {
  const lines = readLines('acctdata.txt');
  const insertVerb = buildInsertVerb(keepExisting);
  const insert = db.prepare(`
    ${insertVerb} INTO accounts (
      acct_id, active_status, curr_bal, credit_limit, cash_credit_limit,
      open_date, expiration_date, reissue_date,
      curr_cyc_credit, curr_cyc_debit,
      addr_zip, group_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const line of lines) {
    const result = insert.run(
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
    );
    inserted += result.changes;
  }

  return {
    processed: lines.length,
    inserted,
    ignored: lines.length - inserted
  };
}

function importCards(keepExisting) {
  const lines = readLines('carddata.txt');
  const insertVerb = buildInsertVerb(keepExisting);
  const insert = db.prepare(`
    ${insertVerb} INTO cards (
      card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const line of lines) {
    const result = insert.run(
      field(line, 0, 16).trim(),
      parseIntField(field(line, 16, 11)),
      field(line, 27, 3).trim(),
      field(line, 30, 50).trim(),
      parseDate(field(line, 80, 10)),
      field(line, 90, 1).trim()
    );
    inserted += result.changes;
  }

  return {
    processed: lines.length,
    inserted,
    ignored: lines.length - inserted
  };
}

function importCardXref(keepExisting) {
  const lines = readLines('cardxref.txt');
  const insertVerb = buildInsertVerb(keepExisting);
  const insert = db.prepare(`
    ${insertVerb} INTO card_xref (card_num, cust_id, acct_id)
    VALUES (?, ?, ?)
  `);

  let inserted = 0;
  for (const line of lines) {
    const result = insert.run(
      field(line, 0, 16).trim(),
      parseIntField(field(line, 16, 9)),
      parseIntField(field(line, 25, 11))
    );
    inserted += result.changes;
  }

  return {
    processed: lines.length,
    inserted,
    ignored: lines.length - inserted
  };
}

function importTransactions(keepExisting) {
  const lines = readLines('dailytran.txt');
  const insertVerb = buildInsertVerb(keepExisting);
  const insert = db.prepare(`
    ${insertVerb} INTO transactions (
      tran_id, tran_type_cd, tran_cat_cd,
      source, description, amount,
      merchant_id, merchant_name, merchant_city, merchant_zip,
      card_num, orig_ts, proc_ts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  for (const line of lines) {
    const origTs = parseTimestamp(field(line, 298, 26));
    const procTs = parseTimestamp(field(line, 324, 26)) || origTs;

    const result = insert.run(
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
    );
    inserted += result.changes;
  }

  return {
    processed: lines.length,
    inserted,
    ignored: lines.length - inserted
  };
}

function readOptions(argv = process.argv.slice(2)) {
  return {
    keepExisting: argv.includes('--keep-existing')
  };
}

function runImport(options = readOptions()) {
  migrate();
  const keepExisting = Boolean(options.keepExisting);

  // Clear tables outside of transaction if needed
  if (!keepExisting) {
    db.pragma('foreign_keys = OFF');
    clearTargetTables();
    db.pragma('foreign_keys = ON');
  }

  const results = db.transaction(() => {
    return {
      mode: keepExisting ? 'keep-existing' : 'replace-all',
      customers: importCustomers(keepExisting),
      accounts: importAccounts(keepExisting),
      cards: importCards(keepExisting),
      cardXref: importCardXref(keepExisting),
      transactions: importTransactions(keepExisting)
    };
  })();

  console.log('Legacy data imported successfully.');
  console.log(JSON.stringify(results, null, 2));
}

if (require.main === module) {
  runImport();
}

module.exports = {
  runImport
};
