const fs = require('fs');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { db } = require('./db');

const outputRoot = process.env.BATCH_OUTPUT_DIR || path.join(__dirname, '..', 'output');
const acctfileDefaultInputPath = process.env.ACCTFILE_INPUT_FILE || 'data/input/acctdata.txt';
const custfileDefaultInputPath = process.env.CUSTFILE_INPUT_FILE || 'data/input/custdata.txt';
const cardfileDefaultInputPath = process.env.CARDFILE_INPUT_FILE || 'data/input/carddata.txt';
const cardxrefDefaultInputPath = process.env.CARDXREF_INPUT_FILE || 'data/input/cardxref.txt';
const legacyAsciiInputDir = path.join(__dirname, '..', '..', 'Src', 'aws-mainframe-modernization-carddemo-main', 'app', 'data', 'ASCII');
fs.mkdirSync(outputRoot, { recursive: true });

const runningJobRuns = new Set();

function nowIso() {
  return new Date().toISOString();
}

function generateJobRunId() {
  const now = new Date();
  const y = String(now.getUTCFullYear());
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const suffix = randomUUID().slice(0, 6).toUpperCase();
  return `JR_${y}${m}${d}_${hh}${mm}${ss}_${suffix}`;
}

function generateStepRunId() {
  return `SR_${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
}

function generateArtifactId() {
  return `AR_${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function toStepTypeLabel(stepType) {
  const normalized = String(stepType || '').toLowerCase();
  if (normalized === 'program') return 'PGM';
  if (normalized === 'proc') return 'PROC';
  return 'UTILITY';
}

function parseSimpleCondition(conditionExpr) {
  const expr = String(conditionExpr || '').trim().replace(/\s+/g, '');
  const match = expr.match(/^RC(<=|>=|=|!=|<|>)(\d+)$/i);
  if (!match) return null;
  return {
    operator: match[1],
    value: Number(match[2])
  };
}

function shouldSkipStep(conditionExpr, previousRc) {
  if (!conditionExpr) return false;
  if (previousRc === null || previousRc === undefined) return false;
  const parsed = parseSimpleCondition(conditionExpr);
  if (!parsed) return false;

  switch (parsed.operator) {
    case '<=': return !(previousRc <= parsed.value);
    case '>=': return !(previousRc >= parsed.value);
    case '=': return !(previousRc === parsed.value);
    case '!=': return !(previousRc !== parsed.value);
    case '<': return !(previousRc < parsed.value);
    case '>': return !(previousRc > parsed.value);
    default: return false;
  }
}

function getStepRetryPolicy(step) {
  const maxAttemptsRaw = Number(step?.retry?.maxAttempts ?? 1);
  const backoffRaw = Number(step?.retry?.backoffMs ?? 0);
  return {
    maxAttempts: Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0 ? Math.floor(maxAttemptsRaw) : 1,
    backoffMs: Number.isFinite(backoffRaw) && backoffRaw >= 0 ? Math.floor(backoffRaw) : 0
  };
}

function checksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

function writeArtifactFile(runDir, fileName, content) {
  const filePath = path.join(runDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
  const stat = fs.statSync(filePath);
  return {
    storagePath: filePath,
    sizeBytes: stat.size,
    checksumSha256: checksum(content)
  };
}

function normalizeDateText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  return text;
}

function toNumberOrDefault(value, defaultValue) {
  if (value === undefined || value === null || String(value).trim() === '') return defaultValue;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function toIntegerOrDefault(value, defaultValue = 0) {
  if (value === undefined || value === null || String(value).trim() === '') return defaultValue;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function parseOverpunchSignedNumber(value, scale = 2) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;

  const lastChar = text.slice(-1);
  const body = text.slice(0, -1);
  const positiveMap = { '{': '0', A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7', H: '8', I: '9' };
  const negativeMap = { '}': '0', J: '1', K: '2', L: '3', M: '4', N: '5', O: '6', P: '7', Q: '8', R: '9' };

  let sign = 1;
  let lastDigit = null;
  if (Object.prototype.hasOwnProperty.call(positiveMap, lastChar)) {
    lastDigit = positiveMap[lastChar];
  } else if (Object.prototype.hasOwnProperty.call(negativeMap, lastChar)) {
    sign = -1;
    lastDigit = negativeMap[lastChar];
  }

  if (lastDigit === null) {
    const plainParsed = Number(text.replace(/,/g, ''));
    return Number.isFinite(plainParsed) ? plainParsed : null;
  }

  const digits = `${body}${lastDigit}`.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const numeric = Number(digits);
  if (!Number.isFinite(numeric)) return null;
  return (sign * numeric) / (10 ** scale);
}

function parseAccountFixedWidthLine(line) {
  const addrZip = line.slice(102, 112).trim();
  const groupId = line.slice(112).trim();

  const fields = [
    line.slice(0, 11),
    line.slice(11, 12),
    line.slice(12, 24),
    line.slice(24, 36),
    line.slice(36, 48),
    line.slice(48, 58),
    line.slice(58, 68),
    line.slice(68, 78),
    line.slice(78, 90),
    line.slice(90, 102),
    addrZip,
    groupId
  ].map((value) => value.trim());

  return {
    acct_id: fields[0],
    active_status: fields[1],
    curr_bal: fields[2],
    credit_limit: fields[3],
    cash_credit_limit: fields[4],
    open_date: fields[5],
    expiration_date: fields[6],
    reissue_date: fields[7],
    curr_cyc_credit: fields[8],
    curr_cyc_debit: fields[9],
    addr_zip: fields[10],
    group_id: fields[11]
  };
}

function mapAccountRecord(rawRecord) {
  const record = rawRecord || {};
  const acctId = Number(record.acct_id ?? record.acctId ?? record.account_id ?? record.accountId);
  if (!Number.isFinite(acctId) || acctId <= 0) {
    throw new Error('Invalid acct_id in input record');
  }

  const activeStatus = String(record.active_status ?? record.activeStatus ?? 'Y').trim().toUpperCase() || 'Y';

  const currBalOverpunch = parseOverpunchSignedNumber(record.curr_bal ?? record.currBal);
  const creditLimitOverpunch = parseOverpunchSignedNumber(record.credit_limit ?? record.creditLimit);
  const cashCreditLimitOverpunch = parseOverpunchSignedNumber(record.cash_credit_limit ?? record.cashCreditLimit);
  const currCycCreditOverpunch = parseOverpunchSignedNumber(record.curr_cyc_credit ?? record.currCycCredit);
  const currCycDebitOverpunch = parseOverpunchSignedNumber(record.curr_cyc_debit ?? record.currCycDebit);

  return {
    acctId,
    activeStatus: activeStatus === 'N' ? 'N' : 'Y',
    currBal: currBalOverpunch ?? toNumberOrDefault(record.curr_bal ?? record.currBal, 0),
    creditLimit: creditLimitOverpunch ?? toNumberOrDefault(record.credit_limit ?? record.creditLimit, 0),
    cashCreditLimit: cashCreditLimitOverpunch ?? toNumberOrDefault(record.cash_credit_limit ?? record.cashCreditLimit, 0),
    openDate: normalizeDateText(record.open_date ?? record.openDate),
    expirationDate: normalizeDateText(record.expiration_date ?? record.expirationDate),
    reissueDate: normalizeDateText(record.reissue_date ?? record.reissueDate),
    currCycCredit: currCycCreditOverpunch ?? toNumberOrDefault(record.curr_cyc_credit ?? record.currCycCredit, 0),
    currCycDebit: currCycDebitOverpunch ?? toNumberOrDefault(record.curr_cyc_debit ?? record.currCycDebit, 0),
    addrZip: String(record.addr_zip ?? record.addrZip ?? '').trim() || null,
    groupId: String(record.group_id ?? record.groupId ?? '').trim() || null
  };
}

function parseDelimitedRecords(fileContent, delimiter) {
  const lines = fileContent.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const headerParts = lines[0].split(delimiter).map((value) => value.trim());
  const hasHeader = headerParts.some((value) => /[A-Za-z_]/.test(value));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const headers = hasHeader
    ? headerParts
    : ['acct_id', 'active_status', 'curr_bal', 'credit_limit', 'cash_credit_limit', 'open_date', 'expiration_date', 'reissue_date', 'curr_cyc_credit', 'curr_cyc_debit', 'addr_zip', 'group_id'];

  return dataLines.map((line) => {
    const parts = line.split(delimiter).map((value) => value.trim());
    const row = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = parts[index] ?? '';
    }
    return row;
  });
}

function sliceField(line, start, length) {
  return line.slice(start, start + length);
}

function readFixedWidthLines(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  return fileContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function resolveFirstExistingPath(candidates) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = resolveInputFilePath(candidate);
    if (resolved && fs.existsSync(resolved)) {
      return resolved;
    }
  }
  return candidates.length > 0 ? resolveInputFilePath(candidates[0]) : null;
}

function parseCustfileInput(inputFilePath) {
  const resolvedPath = resolveFirstExistingPath([
    inputFilePath,
    path.join(legacyAsciiInputDir, 'custdata.txt')
  ]);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found: ${resolvedPath}`);
  }

  const records = readFixedWidthLines(resolvedPath).map((line) => ({
    cust_id: sliceField(line, 0, 9).trim(),
    first_name: sliceField(line, 9, 25).trim(),
    middle_name: sliceField(line, 34, 25).trim(),
    last_name: sliceField(line, 59, 25).trim(),
    addr_line_1: sliceField(line, 84, 50).trim(),
    addr_line_2: sliceField(line, 134, 50).trim(),
    addr_line_3: sliceField(line, 184, 50).trim(),
    state_cd: sliceField(line, 234, 2).trim(),
    country_cd: sliceField(line, 236, 3).trim(),
    zip: sliceField(line, 239, 10).trim(),
    phone_1: sliceField(line, 249, 15).trim(),
    phone_2: sliceField(line, 264, 15).trim(),
    ssn: sliceField(line, 279, 9).trim(),
    govt_id: sliceField(line, 288, 20).trim(),
    dob: sliceField(line, 308, 10).trim(),
    eft_account_id: sliceField(line, 318, 10).trim(),
    primary_holder_ind: sliceField(line, 328, 1).trim(),
    fico_score: sliceField(line, 329, 3).trim()
  }));

  const mappedRecords = records.map((record) => {
    const custId = toIntegerOrDefault(record.cust_id, NaN);
    if (!Number.isFinite(custId) || custId <= 0) {
      throw new Error('Invalid cust_id in input record');
    }

    return {
      custId,
      firstName: record.first_name || 'UNKNOWN',
      middleName: record.middle_name || null,
      lastName: record.last_name || 'UNKNOWN',
      addrLine1: record.addr_line_1 || null,
      addrLine2: record.addr_line_2 || null,
      addrLine3: record.addr_line_3 || null,
      stateCd: record.state_cd || null,
      countryCd: record.country_cd || null,
      zip: record.zip || null,
      phone1: record.phone_1 || null,
      phone2: record.phone_2 || null,
      ssn: record.ssn || null,
      govtId: record.govt_id || null,
      dob: normalizeDateText(record.dob),
      eftAccountId: record.eft_account_id || null,
      primaryHolderInd: (record.primary_holder_ind || '').toUpperCase() === 'Y' ? 'Y' : 'N',
      ficoScore: toIntegerOrDefault(record.fico_score, 0)
    };
  });

  return { resolvedPath, mappedRecords };
}

function parseCardfileInput(cardInputFilePath) {
  const resolvedPath = resolveFirstExistingPath([
    cardInputFilePath,
    path.join(legacyAsciiInputDir, 'carddata.txt')
  ]);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found: ${resolvedPath}`);
  }

  const records = readFixedWidthLines(resolvedPath).map((line) => ({
    card_num: sliceField(line, 0, 16).trim(),
    acct_id: sliceField(line, 16, 11).trim(),
    cvv_cd: sliceField(line, 27, 3).trim(),
    embossed_name: sliceField(line, 30, 50).trim(),
    expiration_date: sliceField(line, 80, 10).trim(),
    active_status: sliceField(line, 90, 1).trim()
  }));

  const mappedRecords = records.map((record) => {
    const acctId = toIntegerOrDefault(record.acct_id, NaN);
    if (!record.card_num) {
      throw new Error('Invalid card_num in input record');
    }
    if (!Number.isFinite(acctId) || acctId <= 0) {
      throw new Error('Invalid acct_id in card input record');
    }

    return {
      cardNum: record.card_num,
      acctId,
      cvvCd: record.cvv_cd || null,
      embossedName: record.embossed_name || null,
      expirationDate: normalizeDateText(record.expiration_date),
      activeStatus: (record.active_status || '').toUpperCase() === 'N' ? 'N' : 'Y'
    };
  });

  return { resolvedPath, mappedRecords };
}

function parseCardXrefInput(xrefInputFilePath) {
  const resolvedPath = resolveFirstExistingPath([
    xrefInputFilePath,
    path.join(legacyAsciiInputDir, 'cardxref.txt')
  ]);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found: ${resolvedPath}`);
  }

  const records = readFixedWidthLines(resolvedPath).map((line) => ({
    card_num: sliceField(line, 0, 16).trim(),
    cust_id: sliceField(line, 16, 9).trim(),
    acct_id: sliceField(line, 25, 11).trim()
  }));

  const mappedRecords = records.map((record) => {
    const custId = toIntegerOrDefault(record.cust_id, NaN);
    const acctId = toIntegerOrDefault(record.acct_id, NaN);
    if (!record.card_num) {
      throw new Error('Invalid card_num in xref input record');
    }
    if (!Number.isFinite(custId) || custId <= 0) {
      throw new Error('Invalid cust_id in xref input record');
    }
    if (!Number.isFinite(acctId) || acctId <= 0) {
      throw new Error('Invalid acct_id in xref input record');
    }

    return {
      cardNum: record.card_num,
      custId,
      acctId
    };
  });

  return { resolvedPath, mappedRecords };
}

function parseAcctfileInput(inputFilePath) {
  const resolvedPath = resolveInputFilePath(inputFilePath);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found: ${resolvedPath}`);
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const ext = path.extname(resolvedPath).toLowerCase();
  let rawRecords = [];

  if (ext === '.json') {
    const parsed = JSON.parse(fileContent);
    rawRecords = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.accounts) ? parsed.accounts : []);
  } else if (fileContent.includes('|')) {
    rawRecords = parseDelimitedRecords(fileContent, '|');
  } else if (fileContent.includes(',')) {
    rawRecords = parseDelimitedRecords(fileContent, ',');
  } else {
    const lines = fileContent.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
    rawRecords = lines.map((line) => parseAccountFixedWidthLine(line));
  }

  const mappedRecords = rawRecords.map((record) => mapAccountRecord(record));
  return { resolvedPath, mappedRecords };
}

function resolveInputFilePath(inputFilePath) {
  if (!inputFilePath) return null;
  if (path.isAbsolute(inputFilePath)) return inputFilePath;

  const candidates = [
    path.resolve(process.cwd(), inputFilePath),
    path.resolve(__dirname, '..', inputFilePath),
    path.resolve(__dirname, '..', '..', inputFilePath)
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function resolveOutputDirectoryPath(outputDirPath) {
  if (!outputDirPath) return null;
  if (path.isAbsolute(outputDirPath)) return outputDirPath;

  const candidates = [
    path.resolve(process.cwd(), outputDirPath),
    path.resolve(__dirname, '..', outputDirPath),
    path.resolve(__dirname, '..', '..', outputDirPath)
  ];

  return candidates[0];
}

function addArtifact({ jobRunId, stepRunId = null, artifactType, name, mimeType = null, storageKind, storagePath = null, sizeBytes = null, checksumSha256 = null, contentInline = null }) {
  db.prepare(`
    INSERT INTO artifacts (
      artifact_id, job_run_id, step_run_id, artifact_type, name, mime_type, storage_kind, storage_path, size_bytes, checksum_sha256, content_inline, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateArtifactId(),
    jobRunId,
    stepRunId,
    artifactType,
    name,
    mimeType,
    storageKind,
    storagePath,
    sizeBytes,
    checksumSha256,
    contentInline,
    nowIso()
  );
}

function isCancelRequested(jobRunId) {
  const row = db.prepare('SELECT cancel_requested_at as cancelRequestedAt FROM job_runs WHERE job_run_id = ?').get(jobRunId);
  return !!row?.cancelRequestedAt;
}

function markRunCancelled(jobRunId, reason = 'Cancelled by user request') {
  db.prepare('UPDATE job_runs SET status = ?, ended_at = ?, error_summary = COALESCE(error_summary, ?), exit_code = COALESCE(exit_code, 16) WHERE job_run_id = ?')
    .run('cancelled', nowIso(), reason, jobRunId);
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function executePosttranStep(jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const stagedRows = db.prepare(`
    SELECT t.tran_id as tranId, t.amount as amount, c.acct_id as acctId
    FROM transactions t
    INNER JOIN cards c ON c.card_num = t.card_num
    LEFT JOIN batch_txn_postings p ON p.tran_id = t.tran_id
    WHERE p.tran_id IS NULL
      AND DATE(t.proc_ts) <= DATE(?)
  `).all(processingDate);

  const summary = {
    processingDate,
    stagedCount: stagedRows.length,
    postedCount: 0,
    totalAmount: 0
  };

  const tx = db.transaction(() => {
    for (const row of stagedRows) {
      db.prepare('UPDATE accounts SET curr_bal = curr_bal + ? WHERE acct_id = ?').run(Number(row.amount || 0), row.acctId);
      db.prepare('INSERT INTO batch_txn_postings (tran_id, job_run_id, posted_at) VALUES (?, ?, ?)')
        .run(row.tranId, jobRunId, nowIso());
      summary.postedCount += 1;
      summary.totalAmount += Number(row.amount || 0);
    }
  });

  tx();

  const reportContent = [
    `POSTTRAN SUMMARY`,
    `processingDate=${summary.processingDate}`,
    `stagedCount=${summary.stagedCount}`,
    `postedCount=${summary.postedCount}`,
    `totalAmount=${summary.totalAmount.toFixed(2)}`,
    `generatedAt=${nowIso()}`
  ].join('\n');

  const reportName = `POSTTRAN_${processingDate.replace(/-/g, '')}.txt`;
  const reportWritten = writeArtifactFile(runDir, reportName, reportContent);

  const logText = `[${nowIso()}] POSTTRAN/${step.name} posted ${summary.postedCount} transactions amount=${summary.totalAmount.toFixed(2)} RC=0`;
  const logName = `POSTTRAN_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Posted ${summary.postedCount} transactions with total ${summary.totalAmount.toFixed(2)}`,
    generatedArtifacts: [
      {
        artifactType: 'report',
        name: reportName,
        mimeType: 'text/plain',
        storagePath: reportWritten.storagePath,
        sizeBytes: reportWritten.sizeBytes,
        checksumSha256: reportWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeIntcalcStep(jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const annualRate = Number(parameters?.annualRate ?? 0.18);
  const dailyRate = annualRate / 365;

  const rows = db.prepare(`
    SELECT a.acct_id as acctId, a.curr_bal as currBal
    FROM accounts a
    LEFT JOIN batch_interest_postings i ON i.acct_id = a.acct_id AND i.processing_date = ?
    WHERE a.curr_bal > 0 AND i.acct_id IS NULL
  `).all(processingDate);

  let accruedCount = 0;
  let accruedTotal = 0;

  const tx = db.transaction(() => {
    for (const row of rows) {
      const interestAmount = Number((Number(row.currBal || 0) * dailyRate).toFixed(2));
      if (interestAmount <= 0) continue;

      db.prepare('UPDATE accounts SET curr_bal = curr_bal + ?, curr_cyc_debit = COALESCE(curr_cyc_debit, 0) + ? WHERE acct_id = ?')
        .run(interestAmount, interestAmount, row.acctId);

      db.prepare('INSERT INTO batch_interest_postings (acct_id, processing_date, job_run_id, interest_amount, posted_at) VALUES (?, ?, ?, ?, ?)')
        .run(row.acctId, processingDate, jobRunId, interestAmount, nowIso());

      const tranId = `TXNINT${Date.now()}${String(row.acctId).slice(-4)}`;
      const anyCard = db.prepare('SELECT card_num as cardNum FROM cards WHERE acct_id = ? ORDER BY card_num LIMIT 1').get(row.acctId);
      if (anyCard?.cardNum) {
        const ts = `${processingDate}T00:00:00Z`;
        db.prepare('INSERT INTO transactions (tran_id, tran_type_cd, tran_cat_cd, source, description, amount, merchant_id, merchant_name, merchant_city, merchant_zip, card_num, orig_ts, proc_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(tranId, 'IN', 3001, 'INTCALC', `Interest accrual ${processingDate}`, interestAmount, 0, 'BANK INTEREST', 'N/A', '00000', anyCard.cardNum, ts, ts);
      }

      accruedCount += 1;
      accruedTotal += interestAmount;
    }
  });

  tx();

  const reportContent = [
    `INTCALC SUMMARY`,
    `processingDate=${processingDate}`,
    `annualRate=${annualRate}`,
    `dailyRate=${dailyRate}`,
    `accountsAccrued=${accruedCount}`,
    `interestTotal=${accruedTotal.toFixed(2)}`,
    `generatedAt=${nowIso()}`
  ].join('\n');

  const reportName = `INTCALC_${processingDate.replace(/-/g, '')}.txt`;
  const reportWritten = writeArtifactFile(runDir, reportName, reportContent);
  const logText = `[${nowIso()}] INTCALC/${step.name} accrued ${accruedCount} accounts total=${accruedTotal.toFixed(2)} RC=0`;
  const logName = `INTCALC_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Accrued interest for ${accruedCount} accounts totaling ${accruedTotal.toFixed(2)}`,
    generatedArtifacts: [
      {
        artifactType: 'report',
        name: reportName,
        mimeType: 'text/plain',
        storagePath: reportWritten.storagePath,
        sizeBytes: reportWritten.sizeBytes,
        checksumSha256: reportWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeTranreptStep(_jobRunId, step, parameters, runDir) {
  await delay(200);

  const startDate = parameters?.startDate || nowIso().slice(0, 10);
  const endDate = parameters?.endDate || startDate;

  const rows = db.prepare(`
    SELECT
      t.tran_id as tranId,
      t.proc_ts as procTs,
      t.card_num as cardNum,
      c.acct_id as acctId,
      t.tran_type_cd as tranTypeCd,
      t.description as description,
      t.amount as amount,
      t.merchant_name as merchantName,
      t.merchant_city as merchantCity
    FROM transactions t
    LEFT JOIN cards c ON c.card_num = t.card_num
    WHERE DATE(t.proc_ts) >= DATE(?) AND DATE(t.proc_ts) <= DATE(?)
    ORDER BY DATE(t.proc_ts) ASC, t.tran_id ASC
  `).all(startDate, endDate);

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const lineItems = rows.map((row) => {
    const procDate = String(row.procTs || '').slice(0, 10);
    return [
      procDate.padEnd(10, ' '),
      String(row.tranId || '').padEnd(18, ' '),
      String(row.acctId || '').padEnd(12, ' '),
      String(row.cardNum || '').slice(-8).padStart(8, '0').padEnd(10, ' '),
      String(row.tranTypeCd || '').padEnd(4, ' '),
      Number(row.amount || 0).toFixed(2).padStart(12, ' '),
      String(row.merchantName || '').slice(0, 18).padEnd(18, ' '),
      String(row.merchantCity || '').slice(0, 12).padEnd(12, ' '),
      String(row.description || '').slice(0, 40)
    ].join(' | ');
  });

  const reportContent = [
    'TRANREPT REPORT',
    `startDate=${startDate}`,
    `endDate=${endDate}`,
    `recordCount=${rows.length}`,
    `totalAmount=${totalAmount.toFixed(2)}`,
    `generatedAt=${nowIso()}`,
    '',
    'PROC-DATE  | TRAN-ID            | ACCT-ID      | CARD(Last8) | TYPE |       AMOUNT | MERCHANT           | CITY         | DESCRIPTION',
    '-----------+--------------------+--------------+-------------+------+--------------+--------------------+--------------+----------------------------------------',
    ...(lineItems.length ? lineItems : ['NO TRANSACTIONS FOUND FOR REQUESTED DATE RANGE'])
  ].join('\n');

  const reportName = `TRANREPT_${endDate.replace(/-/g, '')}.txt`;
  const reportWritten = writeArtifactFile(runDir, reportName, reportContent);
  const logText = `[${nowIso()}] TRANREPT/${step.name} generated ${rows.length} rows total=${totalAmount.toFixed(2)} RC=0`;
  const logName = `TRANREPT_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Generated TRANREPT with ${rows.length} rows and total ${totalAmount.toFixed(2)}`,
    generatedArtifacts: [
      {
        artifactType: 'report',
        name: reportName,
        mimeType: 'text/plain',
        storagePath: reportWritten.storagePath,
        sizeBytes: reportWritten.sizeBytes,
        checksumSha256: reportWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeCbexportStep(jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const exportSnapshot = {
    exportedAt: nowIso(),
    processingDate,
    entities: {
      customers: db.prepare('SELECT * FROM customers ORDER BY cust_id').all(),
      accounts: db.prepare('SELECT * FROM accounts ORDER BY acct_id').all(),
      cards: db.prepare('SELECT * FROM cards ORDER BY card_num').all(),
      cardXref: db.prepare('SELECT * FROM card_xref ORDER BY card_num').all(),
      transactions: db.prepare('SELECT * FROM transactions ORDER BY proc_ts, tran_id').all()
    }
  };

  const counts = Object.fromEntries(
    Object.entries(exportSnapshot.entities).map(([key, rows]) => [key, Array.isArray(rows) ? rows.length : 0])
  );

  const extractName = `CBEXPORT_${processingDate.replace(/-/g, '')}.json`;
  const extractContent = JSON.stringify(exportSnapshot, null, 2);
  const extractWritten = writeArtifactFile(runDir, extractName, extractContent);

  let recordSeq = 0;
  const insertStage = db.prepare(`
    INSERT INTO stage_export_records (job_run_id, source_entity, record_seq, raw_record, parsed_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [entity, rows] of Object.entries(exportSnapshot.entities)) {
      for (const row of rows) {
        recordSeq += 1;
        const raw = JSON.stringify(row);
        insertStage.run(jobRunId, entity, recordSeq, raw, raw, nowIso());
      }
    }
  });
  tx();

  const summaryText = [
    'CBEXPORT SUMMARY',
    `processingDate=${processingDate}`,
    `customers=${counts.customers || 0}`,
    `accounts=${counts.accounts || 0}`,
    `cards=${counts.cards || 0}`,
    `cardXref=${counts.cardXref || 0}`,
    `transactions=${counts.transactions || 0}`,
    `generatedAt=${nowIso()}`
  ].join('\n');
  const summaryName = `CBEXPORT_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, summaryText);

  const logText = `[${nowIso()}] CBEXPORT/${step.name} exported entities: ${JSON.stringify(counts)} RC=0`;
  const logName = `CBEXPORT_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Exported customers=${counts.customers || 0}, accounts=${counts.accounts || 0}, cards=${counts.cards || 0}, transactions=${counts.transactions || 0}`,
    generatedArtifacts: [
      {
        artifactType: 'extract',
        name: extractName,
        mimeType: 'application/json',
        storagePath: extractWritten.storagePath,
        sizeBytes: extractWritten.sizeBytes,
        checksumSha256: extractWritten.checksumSha256
      },
      {
        artifactType: 'report',
        name: summaryName,
        mimeType: 'text/plain',
        storagePath: summaryWritten.storagePath,
        sizeBytes: summaryWritten.sizeBytes,
        checksumSha256: summaryWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeCbimportStep(jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const source = db.prepare(`
    SELECT storage_path as storagePath, name
    FROM artifacts
    WHERE artifact_type = 'extract' AND name LIKE 'CBEXPORT_%' AND storage_kind = 'file'
    ORDER BY created_at DESC
    LIMIT 1
  `).get();

  if (!source || !source.storagePath || !fs.existsSync(source.storagePath)) {
    const errorMsg = 'No CBEXPORT extract available for import';
    db.prepare('INSERT INTO stage_import_errors (job_run_id, record_seq, error_message, raw_record, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(jobRunId, 0, errorMsg, null, nowIso());

    const errorReport = ['CBIMPORT SUMMARY', `processingDate=${processingDate}`, `status=warning`, `error=${errorMsg}`, `generatedAt=${nowIso()}`].join('\n');
    const reportName = `CBIMPORT_${processingDate.replace(/-/g, '')}_ERRORS.txt`;
    const reportWritten = writeArtifactFile(runDir, reportName, errorReport);
    const logText = `[${nowIso()}] CBIMPORT/${step.name} warning: ${errorMsg} RC=4`;
    const logName = `CBIMPORT_${step.name}.log`;
    const logWritten = writeArtifactFile(runDir, logName, logText);

    return {
      returnCode: 4,
      message: `${errorMsg}`,
      generatedArtifacts: [
        {
          artifactType: 'report',
          name: reportName,
          mimeType: 'text/plain',
          storagePath: reportWritten.storagePath,
          sizeBytes: reportWritten.sizeBytes,
          checksumSha256: reportWritten.checksumSha256
        },
        {
          artifactType: 'log',
          name: logName,
          mimeType: 'text/plain',
          storagePath: logWritten.storagePath,
          sizeBytes: logWritten.sizeBytes,
          checksumSha256: logWritten.checksumSha256
        }
      ],
      logLine: logText
    };
  }

  const payloadRaw = fs.readFileSync(source.storagePath, 'utf8');
  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (_error) {
    const errorMsg = 'Invalid CBEXPORT extract payload';
    db.prepare('INSERT INTO stage_import_errors (job_run_id, record_seq, error_message, raw_record, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(jobRunId, 0, errorMsg, payloadRaw.slice(0, 8000), nowIso());
    return {
      returnCode: 8,
      message: errorMsg,
      generatedArtifacts: [],
      logLine: `[${nowIso()}] CBIMPORT/${step.name} failed: ${errorMsg} RC=8`
    };
  }

  const entities = payload?.entities || {};
  const imported = {
    customers: 0,
    accounts: 0,
    cards: 0,
    cardXref: 0,
    transactions: 0,
    errors: 0
  };

  const insertError = db.prepare('INSERT INTO stage_import_errors (job_run_id, record_seq, error_message, raw_record, created_at) VALUES (?, ?, ?, ?, ?)');

  const tx = db.transaction(() => {
    let seq = 0;

    const upsertCustomer = db.prepare(`
      INSERT INTO customers (cust_id, first_name, middle_name, last_name, addr_line_1, addr_line_2, addr_line_3, state_cd, country_cd, zip, phone_1, phone_2, ssn, govt_id, dob, eft_account_id, primary_holder_ind, fico_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cust_id) DO UPDATE SET
        first_name=excluded.first_name,
        middle_name=excluded.middle_name,
        last_name=excluded.last_name,
        addr_line_1=excluded.addr_line_1,
        addr_line_2=excluded.addr_line_2,
        addr_line_3=excluded.addr_line_3,
        state_cd=excluded.state_cd,
        country_cd=excluded.country_cd,
        zip=excluded.zip,
        phone_1=excluded.phone_1,
        phone_2=excluded.phone_2,
        ssn=excluded.ssn,
        govt_id=excluded.govt_id,
        dob=excluded.dob,
        eft_account_id=excluded.eft_account_id,
        primary_holder_ind=excluded.primary_holder_ind,
        fico_score=excluded.fico_score
    `);

    for (const row of entities.customers || []) {
      seq += 1;
      try {
        upsertCustomer.run(
          row.cust_id, row.first_name, row.middle_name ?? null, row.last_name,
          row.addr_line_1 ?? null, row.addr_line_2 ?? null, row.addr_line_3 ?? null,
          row.state_cd ?? null, row.country_cd ?? null, row.zip ?? null,
          row.phone_1 ?? null, row.phone_2 ?? null, row.ssn ?? null,
          row.govt_id ?? null, row.dob ?? null, row.eft_account_id ?? null,
          row.primary_holder_ind ?? null, row.fico_score ?? null
        );
        imported.customers += 1;
      } catch (error) {
        imported.errors += 1;
        insertError.run(jobRunId, seq, error.message, JSON.stringify(row), nowIso());
      }
    }

    const upsertAccount = db.prepare(`
      INSERT INTO accounts (acct_id, active_status, curr_bal, credit_limit, cash_credit_limit, open_date, expiration_date, reissue_date, created_at, curr_cyc_credit, curr_cyc_debit, addr_zip, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(acct_id) DO UPDATE SET
        active_status=excluded.active_status,
        curr_bal=excluded.curr_bal,
        credit_limit=excluded.credit_limit,
        cash_credit_limit=excluded.cash_credit_limit,
        open_date=excluded.open_date,
        expiration_date=excluded.expiration_date,
        reissue_date=excluded.reissue_date,
        curr_cyc_credit=excluded.curr_cyc_credit,
        curr_cyc_debit=excluded.curr_cyc_debit,
        addr_zip=excluded.addr_zip,
        group_id=excluded.group_id
    `);
    for (const row of entities.accounts || []) {
      seq += 1;
      try {
        upsertAccount.run(
          row.acct_id, row.active_status, row.curr_bal, row.credit_limit, row.cash_credit_limit,
          row.open_date ?? null, row.expiration_date ?? null, row.reissue_date ?? null,
          row.created_at ?? nowIso(), row.curr_cyc_credit ?? 0, row.curr_cyc_debit ?? 0, row.addr_zip ?? null, row.group_id ?? null
        );
        imported.accounts += 1;
      } catch (error) {
        imported.errors += 1;
        insertError.run(jobRunId, seq, error.message, JSON.stringify(row), nowIso());
      }
    }

    const upsertCard = db.prepare(`
      INSERT INTO cards (card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_num) DO UPDATE SET
        acct_id=excluded.acct_id,
        cvv_cd=excluded.cvv_cd,
        embossed_name=excluded.embossed_name,
        expiration_date=excluded.expiration_date,
        active_status=excluded.active_status
    `);
    for (const row of entities.cards || []) {
      seq += 1;
      try {
        upsertCard.run(row.card_num, row.acct_id, row.cvv_cd ?? null, row.embossed_name ?? null, row.expiration_date ?? null, row.active_status);
        imported.cards += 1;
      } catch (error) {
        imported.errors += 1;
        insertError.run(jobRunId, seq, error.message, JSON.stringify(row), nowIso());
      }
    }

    const upsertXref = db.prepare(`
      INSERT INTO card_xref (card_num, cust_id, acct_id)
      VALUES (?, ?, ?)
      ON CONFLICT(card_num) DO UPDATE SET
        cust_id=excluded.cust_id,
        acct_id=excluded.acct_id
    `);
    for (const row of entities.cardXref || []) {
      seq += 1;
      try {
        upsertXref.run(row.card_num, row.cust_id, row.acct_id);
        imported.cardXref += 1;
      } catch (error) {
        imported.errors += 1;
        insertError.run(jobRunId, seq, error.message, JSON.stringify(row), nowIso());
      }
    }

    const insertTxn = db.prepare(`
      INSERT OR IGNORE INTO transactions (tran_id, tran_type_cd, tran_cat_cd, source, description, amount, merchant_id, merchant_name, merchant_city, merchant_zip, card_num, orig_ts, proc_ts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of entities.transactions || []) {
      seq += 1;
      try {
        insertTxn.run(
          row.tran_id, row.tran_type_cd, row.tran_cat_cd, row.source, row.description,
          row.amount, row.merchant_id, row.merchant_name, row.merchant_city, row.merchant_zip,
          row.card_num, row.orig_ts, row.proc_ts
        );
        imported.transactions += 1;
      } catch (error) {
        imported.errors += 1;
        insertError.run(jobRunId, seq, error.message, JSON.stringify(row), nowIso());
      }
    }
  });

  tx();

  const summaryText = [
    'CBIMPORT SUMMARY',
    `source=${source.name}`,
    `customers=${imported.customers}`,
    `accounts=${imported.accounts}`,
    `cards=${imported.cards}`,
    `cardXref=${imported.cardXref}`,
    `transactions=${imported.transactions}`,
    `errors=${imported.errors}`,
    `generatedAt=${nowIso()}`
  ].join('\n');

  const summaryName = `CBIMPORT_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, summaryText);
  const logText = `[${nowIso()}] CBIMPORT/${step.name} imported customers=${imported.customers}, accounts=${imported.accounts}, cards=${imported.cards}, transactions=${imported.transactions}, errors=${imported.errors} RC=${imported.errors ? 4 : 0}`;
  const logName = `CBIMPORT_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: imported.errors ? 4 : 0,
    message: `Imported entities with errors=${imported.errors}`,
    generatedArtifacts: [
      {
        artifactType: 'report',
        name: summaryName,
        mimeType: 'text/plain',
        storagePath: summaryWritten.storagePath,
        sizeBytes: summaryWritten.sizeBytes,
        checksumSha256: summaryWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeCreastmtStep(jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const monthStart = `${processingDate.slice(0, 8)}01`;

  const accountRows = db.prepare(`
    SELECT
      a.acct_id as acctId,
      a.curr_bal as currentBalance,
      c.first_name as firstName,
      c.last_name as lastName,
      x.cust_id as custId
    FROM accounts a
    LEFT JOIN card_xref x ON x.acct_id = a.acct_id
    LEFT JOIN customers c ON c.cust_id = x.cust_id
    GROUP BY a.acct_id
    ORDER BY a.acct_id
  `).all();

  const statementLines = [];
  const htmlSections = [];
  let lineSeq = 0;

  for (const acct of accountRows) {
    const txns = db.prepare(`
      SELECT t.tran_id as tranId, t.proc_ts as procTs, t.description as description, t.amount as amount, t.tran_type_cd as tranTypeCd
      FROM transactions t
      INNER JOIN cards cd ON cd.card_num = t.card_num
      WHERE cd.acct_id = ? AND DATE(t.proc_ts) >= DATE(?) AND DATE(t.proc_ts) <= DATE(?)
      ORDER BY t.proc_ts ASC, t.tran_id ASC
    `).all(acct.acctId, monthStart, processingDate);

    const holder = `${acct.firstName || 'N/A'} ${acct.lastName || ''}`.trim();
    const acctTotal = txns.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const header = `STATEMENT ACCT=${acct.acctId} HOLDER=${holder} PERIOD=${monthStart}..${processingDate} TXN_COUNT=${txns.length} TXN_TOTAL=${acctTotal.toFixed(2)} CURR_BAL=${Number(acct.currentBalance || 0).toFixed(2)}`;
    statementLines.push(header);
    lineSeq += 1;
    db.prepare('INSERT INTO stage_statement_lines (job_run_id, acct_id, line_seq, line_text, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(jobRunId, acct.acctId, lineSeq, header, nowIso());

    const detailLines = txns.map((txn) => {
      const line = `${String(txn.procTs || '').slice(0, 10)} | ${String(txn.tranId || '').padEnd(18, ' ')} | ${String(txn.tranTypeCd || '').padEnd(4, ' ')} | ${Number(txn.amount || 0).toFixed(2).padStart(12, ' ')} | ${String(txn.description || '').slice(0, 60)}`;
      lineSeq += 1;
      db.prepare('INSERT INTO stage_statement_lines (job_run_id, acct_id, line_seq, line_text, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(jobRunId, acct.acctId, lineSeq, line, nowIso());
      return line;
    });
    if (!detailLines.length) {
      lineSeq += 1;
      const noneLine = 'NO TRANSACTIONS FOR PERIOD';
      db.prepare('INSERT INTO stage_statement_lines (job_run_id, acct_id, line_seq, line_text, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(jobRunId, acct.acctId, lineSeq, noneLine, nowIso());
      detailLines.push(noneLine);
    }

    statementLines.push(...detailLines, '');

    htmlSections.push(`
      <section>
        <h2>Account ${acct.acctId}</h2>
        <p>Holder: ${holder}</p>
        <p>Period: ${monthStart} to ${processingDate}</p>
        <p>Transactions: ${txns.length} | Total: ${acctTotal.toFixed(2)} | Current Balance: ${Number(acct.currentBalance || 0).toFixed(2)}</p>
        <ul>
          ${txns.map((txn) => `<li>${String(txn.procTs || '').slice(0, 10)} - ${txn.tranId} - ${txn.tranTypeCd} - ${Number(txn.amount || 0).toFixed(2)} - ${txn.description || ''}</li>`).join('') || '<li>No transactions for period</li>'}
        </ul>
      </section>
    `);
  }

  const textContent = [
    'CREASTMT STATEMENT PACKAGE',
    `processingDate=${processingDate}`,
    `accounts=${accountRows.length}`,
    `generatedAt=${nowIso()}`,
    '',
    ...statementLines
  ].join('\n');
  const textName = `CREASTMT_${processingDate.replace(/-/g, '')}.txt`;
  const textWritten = writeArtifactFile(runDir, textName, textContent);

  const htmlContent = `<!doctype html><html><head><meta charset="utf-8"/><title>CREASTMT ${processingDate}</title></head><body><h1>CardDemo Statements</h1><p>Processing Date: ${processingDate}</p>${htmlSections.join('')}</body></html>`;
  const htmlName = `CREASTMT_${processingDate.replace(/-/g, '')}.html`;
  const htmlWritten = writeArtifactFile(runDir, htmlName, htmlContent);

  const logText = `[${nowIso()}] CREASTMT/${step.name} generated statements for ${accountRows.length} accounts RC=0`;
  const logName = `CREASTMT_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Generated statement package for ${accountRows.length} accounts`,
    generatedArtifacts: [
      {
        artifactType: 'report',
        name: textName,
        mimeType: 'text/plain',
        storagePath: textWritten.storagePath,
        sizeBytes: textWritten.sizeBytes,
        checksumSha256: textWritten.checksumSha256
      },
      {
        artifactType: 'report',
        name: htmlName,
        mimeType: 'text/html',
        storagePath: htmlWritten.storagePath,
        sizeBytes: htmlWritten.sizeBytes,
        checksumSha256: htmlWritten.checksumSha256
      },
      {
        artifactType: 'log',
        name: logName,
        mimeType: 'text/plain',
        storagePath: logWritten.storagePath,
        sizeBytes: logWritten.sizeBytes,
        checksumSha256: logWritten.checksumSha256
      }
    ],
    logLine: logText
  };
}

async function executeAcctfileStep(_jobRunId, step, parameters, runDir) {
  await delay(150);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const explicitInputFilePath = parameters?.inputFilePath ? String(parameters.inputFilePath).trim() : '';
  const configuredInputPath = explicitInputFilePath || acctfileDefaultInputPath;
  const resolvedConfiguredPath = resolveInputFilePath(configuredInputPath);
  const shouldUseConfiguredInput = !!resolvedConfiguredPath && fs.existsSync(resolvedConfiguredPath);
  const upsertSummary = {
    sourceFile: null,
    inputRecords: 0,
    insertedAccounts: 0,
    updatedAccounts: 0,
    errors: 0
  };

  if (shouldUseConfiguredInput) {
    const parsedInput = parseAcctfileInput(configuredInputPath);
    upsertSummary.sourceFile = parsedInput.resolvedPath;
    upsertSummary.inputRecords = parsedInput.mappedRecords.length;

    const existsStmt = db.prepare('SELECT acct_id FROM accounts WHERE acct_id = ?');
    const upsertStmt = db.prepare(`
      INSERT INTO accounts (acct_id, active_status, curr_bal, credit_limit, cash_credit_limit, open_date, expiration_date, reissue_date, curr_cyc_credit, curr_cyc_debit, addr_zip, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(acct_id) DO UPDATE SET
        active_status=excluded.active_status,
        curr_bal=excluded.curr_bal,
        credit_limit=excluded.credit_limit,
        cash_credit_limit=excluded.cash_credit_limit,
        open_date=excluded.open_date,
        expiration_date=excluded.expiration_date,
        reissue_date=excluded.reissue_date,
        curr_cyc_credit=excluded.curr_cyc_credit,
        curr_cyc_debit=excluded.curr_cyc_debit,
        addr_zip=excluded.addr_zip,
        group_id=excluded.group_id
    `);

    const tx = db.transaction(() => {
      for (const row of parsedInput.mappedRecords) {
        try {
          const existed = !!existsStmt.get(row.acctId);
          upsertStmt.run(
            row.acctId,
            row.activeStatus,
            row.currBal,
            row.creditLimit,
            row.cashCreditLimit,
            row.openDate,
            row.expirationDate,
            row.reissueDate,
            row.currCycCredit,
            row.currCycDebit,
            row.addrZip,
            row.groupId
          );
          if (existed) {
            upsertSummary.updatedAccounts += 1;
          } else {
            upsertSummary.insertedAccounts += 1;
          }
        } catch (_error) {
          upsertSummary.errors += 1;
        }
      }
    });

    tx();
  } else if (explicitInputFilePath) {
    throw new Error(`Input file not found: ${explicitInputFilePath}`);
  }

  const totalAccounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get().count;
  const activeAccounts = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE active_status = 'Y'").get().count;
  const balanceSummary = db.prepare('SELECT COALESCE(SUM(curr_bal), 0) as totalBalance FROM accounts').get();

  const manifest = {
    utilityJob: 'ACCTFILE',
    processingDate,
    dataset: 'ACCTDATA.VSAM.KSDS',
    checks: {
      totalAccounts,
      activeAccounts,
      totalBalance: Number(balanceSummary.totalBalance || 0),
      inputRecords: upsertSummary.inputRecords,
      insertedAccounts: upsertSummary.insertedAccounts,
      updatedAccounts: upsertSummary.updatedAccounts,
      inputErrors: upsertSummary.errors
    },
    sourceFile: upsertSummary.sourceFile,
    executedAt: nowIso()
  };

  const manifestName = `ACCTFILE_${processingDate.replace(/-/g, '')}_MANIFEST.json`;
  const manifestWritten = writeArtifactFile(runDir, manifestName, JSON.stringify(manifest, null, 2));
  const summaryName = `ACCTFILE_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, [
    'ACCTFILE SUMMARY',
    `processingDate=${processingDate}`,
    `dataset=ACCTDATA.VSAM.KSDS`,
    `totalAccounts=${totalAccounts}`,
    `activeAccounts=${activeAccounts}`,
    `totalBalance=${Number(balanceSummary.totalBalance || 0).toFixed(2)}`,
    `inputFile=${upsertSummary.sourceFile || 'none'}`,
    `inputRecords=${upsertSummary.inputRecords}`,
    `insertedAccounts=${upsertSummary.insertedAccounts}`,
    `updatedAccounts=${upsertSummary.updatedAccounts}`,
    `inputErrors=${upsertSummary.errors}`,
    `generatedAt=${nowIso()}`
  ].join('\n'));
  const returnCode = upsertSummary.errors > 0 ? 4 : 0;
  const logText = `[${nowIso()}] ACCTFILE/${step.name} validated account dataset total=${totalAccounts} inputFile=${upsertSummary.sourceFile || 'none'} inserted=${upsertSummary.insertedAccounts} updated=${upsertSummary.updatedAccounts} errors=${upsertSummary.errors} RC=${returnCode}`;
  const logName = `ACCTFILE_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode,
    message: `ACCTFILE processed ${upsertSummary.inputRecords} input records; inserted=${upsertSummary.insertedAccounts}, updated=${upsertSummary.updatedAccounts}, errors=${upsertSummary.errors}`,
    generatedArtifacts: [
      { artifactType: 'extract', name: manifestName, mimeType: 'application/json', storagePath: manifestWritten.storagePath, sizeBytes: manifestWritten.sizeBytes, checksumSha256: manifestWritten.checksumSha256 },
      { artifactType: 'report', name: summaryName, mimeType: 'text/plain', storagePath: summaryWritten.storagePath, sizeBytes: summaryWritten.sizeBytes, checksumSha256: summaryWritten.checksumSha256 },
      { artifactType: 'log', name: logName, mimeType: 'text/plain', storagePath: logWritten.storagePath, sizeBytes: logWritten.sizeBytes, checksumSha256: logWritten.checksumSha256 }
    ],
    logLine: logText
  };
}

async function executeCardfileStep(_jobRunId, step, parameters, runDir) {
  await delay(150);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const explicitCardInputPath = parameters?.cardInputFilePath
    ? String(parameters.cardInputFilePath).trim()
    : (parameters?.inputFilePath ? String(parameters.inputFilePath).trim() : '');
  const explicitXrefInputPath = parameters?.xrefInputFilePath ? String(parameters.xrefInputFilePath).trim() : '';
  const configuredCardPath = explicitCardInputPath || cardfileDefaultInputPath;
  const configuredXrefPath = explicitXrefInputPath || cardxrefDefaultInputPath;
  const resolvedCardPath = resolveFirstExistingPath([configuredCardPath, path.join(legacyAsciiInputDir, 'carddata.txt')]);
  const resolvedXrefPath = resolveFirstExistingPath([configuredXrefPath, path.join(legacyAsciiInputDir, 'cardxref.txt')]);
  const shouldUseCardInput = !!resolvedCardPath && fs.existsSync(resolvedCardPath);
  const shouldUseXrefInput = !!resolvedXrefPath && fs.existsSync(resolvedXrefPath);

  const upsertSummary = {
    cardSourceFile: null,
    xrefSourceFile: null,
    cardInputRecords: 0,
    xrefInputRecords: 0,
    insertedCards: 0,
    updatedCards: 0,
    insertedXref: 0,
    updatedXref: 0,
    errors: 0
  };

  if (shouldUseCardInput || shouldUseXrefInput) {
    const cardRecords = shouldUseCardInput ? parseCardfileInput(configuredCardPath) : { resolvedPath: null, mappedRecords: [] };
    const xrefRecords = shouldUseXrefInput ? parseCardXrefInput(configuredXrefPath) : { resolvedPath: null, mappedRecords: [] };

    upsertSummary.cardSourceFile = cardRecords.resolvedPath;
    upsertSummary.xrefSourceFile = xrefRecords.resolvedPath;
    upsertSummary.cardInputRecords = cardRecords.mappedRecords.length;
    upsertSummary.xrefInputRecords = xrefRecords.mappedRecords.length;

    const existsCardStmt = db.prepare('SELECT card_num FROM cards WHERE card_num = ?');
    const existsXrefStmt = db.prepare('SELECT card_num FROM card_xref WHERE card_num = ?');

    const upsertCardStmt = db.prepare(`
      INSERT INTO cards (card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(card_num) DO UPDATE SET
        acct_id=excluded.acct_id,
        cvv_cd=excluded.cvv_cd,
        embossed_name=excluded.embossed_name,
        expiration_date=excluded.expiration_date,
        active_status=excluded.active_status
    `);

    const upsertXrefStmt = db.prepare(`
      INSERT INTO card_xref (card_num, cust_id, acct_id)
      VALUES (?, ?, ?)
      ON CONFLICT(card_num) DO UPDATE SET
        cust_id=excluded.cust_id,
        acct_id=excluded.acct_id
    `);

    const tx = db.transaction(() => {
      for (const row of cardRecords.mappedRecords) {
        try {
          const existed = !!existsCardStmt.get(row.cardNum);
          upsertCardStmt.run(row.cardNum, row.acctId, row.cvvCd, row.embossedName, row.expirationDate, row.activeStatus);
          if (existed) {
            upsertSummary.updatedCards += 1;
          } else {
            upsertSummary.insertedCards += 1;
          }
        } catch (_error) {
          upsertSummary.errors += 1;
        }
      }

      for (const row of xrefRecords.mappedRecords) {
        try {
          const existed = !!existsXrefStmt.get(row.cardNum);
          upsertXrefStmt.run(row.cardNum, row.custId, row.acctId);
          if (existed) {
            upsertSummary.updatedXref += 1;
          } else {
            upsertSummary.insertedXref += 1;
          }
        } catch (_error) {
          upsertSummary.errors += 1;
        }
      }
    });

    tx();
  } else if (explicitCardInputPath || explicitXrefInputPath) {
    throw new Error(`Input file not found: ${explicitCardInputPath || explicitXrefInputPath}`);
  }

  const totalCards = db.prepare('SELECT COUNT(*) as count FROM cards').get().count;
  const activeCards = db.prepare("SELECT COUNT(*) as count FROM cards WHERE active_status = 'Y'").get().count;
  const orphanCards = db.prepare('SELECT COUNT(*) as count FROM cards c LEFT JOIN accounts a ON a.acct_id = c.acct_id WHERE a.acct_id IS NULL').get().count;
  const missingXref = db.prepare('SELECT COUNT(*) as count FROM cards c LEFT JOIN card_xref x ON x.card_num = c.card_num WHERE x.card_num IS NULL').get().count;

  const manifest = {
    utilityJob: 'CARDFILE',
    processingDate,
    dataset: 'CARDDATA.VSAM.KSDS',
    checks: {
      totalCards,
      activeCards,
      orphanCards,
      missingXref,
      cardInputRecords: upsertSummary.cardInputRecords,
      xrefInputRecords: upsertSummary.xrefInputRecords,
      insertedCards: upsertSummary.insertedCards,
      updatedCards: upsertSummary.updatedCards,
      insertedXref: upsertSummary.insertedXref,
      updatedXref: upsertSummary.updatedXref,
      inputErrors: upsertSummary.errors
    },
    sourceFiles: {
      cardInputFile: upsertSummary.cardSourceFile,
      xrefInputFile: upsertSummary.xrefSourceFile
    },
    executedAt: nowIso()
  };

  const manifestName = `CARDFILE_${processingDate.replace(/-/g, '')}_MANIFEST.json`;
  const manifestWritten = writeArtifactFile(runDir, manifestName, JSON.stringify(manifest, null, 2));
  const summaryName = `CARDFILE_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, [
    'CARDFILE SUMMARY',
    `processingDate=${processingDate}`,
    `dataset=CARDDATA.VSAM.KSDS`,
    `totalCards=${totalCards}`,
    `activeCards=${activeCards}`,
    `orphanCards=${orphanCards}`,
    `missingXref=${missingXref}`,
    `cardInputFile=${upsertSummary.cardSourceFile || 'none'}`,
    `xrefInputFile=${upsertSummary.xrefSourceFile || 'none'}`,
    `cardInputRecords=${upsertSummary.cardInputRecords}`,
    `xrefInputRecords=${upsertSummary.xrefInputRecords}`,
    `insertedCards=${upsertSummary.insertedCards}`,
    `updatedCards=${upsertSummary.updatedCards}`,
    `insertedXref=${upsertSummary.insertedXref}`,
    `updatedXref=${upsertSummary.updatedXref}`,
    `inputErrors=${upsertSummary.errors}`,
    `generatedAt=${nowIso()}`
  ].join('\n'));
  const returnCode = upsertSummary.errors > 0 ? 4 : 0;
  const logText = `[${nowIso()}] CARDFILE/${step.name} validated card dataset total=${totalCards} cardInput=${upsertSummary.cardSourceFile || 'none'} xrefInput=${upsertSummary.xrefSourceFile || 'none'} insertedCards=${upsertSummary.insertedCards} insertedXref=${upsertSummary.insertedXref} errors=${upsertSummary.errors} RC=${returnCode}`;
  const logName = `CARDFILE_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode,
    message: `CARDFILE processed cards=${upsertSummary.cardInputRecords}, xref=${upsertSummary.xrefInputRecords}; insertedCards=${upsertSummary.insertedCards}, insertedXref=${upsertSummary.insertedXref}, errors=${upsertSummary.errors}`,
    generatedArtifacts: [
      { artifactType: 'extract', name: manifestName, mimeType: 'application/json', storagePath: manifestWritten.storagePath, sizeBytes: manifestWritten.sizeBytes, checksumSha256: manifestWritten.checksumSha256 },
      { artifactType: 'report', name: summaryName, mimeType: 'text/plain', storagePath: summaryWritten.storagePath, sizeBytes: summaryWritten.sizeBytes, checksumSha256: summaryWritten.checksumSha256 },
      { artifactType: 'log', name: logName, mimeType: 'text/plain', storagePath: logWritten.storagePath, sizeBytes: logWritten.sizeBytes, checksumSha256: logWritten.checksumSha256 }
    ],
    logLine: logText
  };
}

async function executeCustfileStep(_jobRunId, step, parameters, runDir) {
  await delay(150);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const explicitInputFilePath = parameters?.inputFilePath ? String(parameters.inputFilePath).trim() : '';
  const configuredInputPath = explicitInputFilePath || custfileDefaultInputPath;
  const resolvedConfiguredPath = resolveFirstExistingPath([configuredInputPath, path.join(legacyAsciiInputDir, 'custdata.txt')]);
  const shouldUseConfiguredInput = !!resolvedConfiguredPath && fs.existsSync(resolvedConfiguredPath);
  const upsertSummary = {
    sourceFile: null,
    inputRecords: 0,
    insertedCustomers: 0,
    updatedCustomers: 0,
    errors: 0
  };

  if (shouldUseConfiguredInput) {
    const parsedInput = parseCustfileInput(configuredInputPath);
    upsertSummary.sourceFile = parsedInput.resolvedPath;
    upsertSummary.inputRecords = parsedInput.mappedRecords.length;

    const existsStmt = db.prepare('SELECT cust_id FROM customers WHERE cust_id = ?');
    const upsertStmt = db.prepare(`
      INSERT INTO customers (cust_id, first_name, middle_name, last_name, addr_line_1, addr_line_2, addr_line_3, state_cd, country_cd, zip, phone_1, phone_2, ssn, govt_id, dob, eft_account_id, primary_holder_ind, fico_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cust_id) DO UPDATE SET
        first_name=excluded.first_name,
        middle_name=excluded.middle_name,
        last_name=excluded.last_name,
        addr_line_1=excluded.addr_line_1,
        addr_line_2=excluded.addr_line_2,
        addr_line_3=excluded.addr_line_3,
        state_cd=excluded.state_cd,
        country_cd=excluded.country_cd,
        zip=excluded.zip,
        phone_1=excluded.phone_1,
        phone_2=excluded.phone_2,
        ssn=excluded.ssn,
        govt_id=excluded.govt_id,
        dob=excluded.dob,
        eft_account_id=excluded.eft_account_id,
        primary_holder_ind=excluded.primary_holder_ind,
        fico_score=excluded.fico_score
    `);

    const tx = db.transaction(() => {
      for (const row of parsedInput.mappedRecords) {
        try {
          const existed = !!existsStmt.get(row.custId);
          upsertStmt.run(
            row.custId,
            row.firstName,
            row.middleName,
            row.lastName,
            row.addrLine1,
            row.addrLine2,
            row.addrLine3,
            row.stateCd,
            row.countryCd,
            row.zip,
            row.phone1,
            row.phone2,
            row.ssn,
            row.govtId,
            row.dob,
            row.eftAccountId,
            row.primaryHolderInd,
            row.ficoScore
          );
          if (existed) {
            upsertSummary.updatedCustomers += 1;
          } else {
            upsertSummary.insertedCustomers += 1;
          }
        } catch (_error) {
          upsertSummary.errors += 1;
        }
      }
    });

    tx();
  } else if (explicitInputFilePath) {
    throw new Error(`Input file not found: ${explicitInputFilePath}`);
  }

  const totalCustomers = db.prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const primaryHolders = db.prepare("SELECT COUNT(*) as count FROM customers WHERE primary_holder_ind = 'Y'").get().count;
  const avgFico = db.prepare('SELECT COALESCE(AVG(fico_score), 0) as avgFico FROM customers').get();
  const linkedCustomers = db.prepare('SELECT COUNT(DISTINCT cust_id) as count FROM card_xref').get().count;

  const manifest = {
    utilityJob: 'CUSTFILE',
    processingDate,
    dataset: 'CUSTDATA.VSAM.KSDS',
    checks: {
      totalCustomers,
      linkedCustomers,
      primaryHolders,
      avgFico: Number(avgFico.avgFico || 0),
      inputRecords: upsertSummary.inputRecords,
      insertedCustomers: upsertSummary.insertedCustomers,
      updatedCustomers: upsertSummary.updatedCustomers,
      inputErrors: upsertSummary.errors
    },
    sourceFile: upsertSummary.sourceFile,
    executedAt: nowIso()
  };

  const manifestName = `CUSTFILE_${processingDate.replace(/-/g, '')}_MANIFEST.json`;
  const manifestWritten = writeArtifactFile(runDir, manifestName, JSON.stringify(manifest, null, 2));
  const summaryName = `CUSTFILE_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, [
    'CUSTFILE SUMMARY',
    `processingDate=${processingDate}`,
    `dataset=CUSTDATA.VSAM.KSDS`,
    `totalCustomers=${totalCustomers}`,
    `linkedCustomers=${linkedCustomers}`,
    `primaryHolders=${primaryHolders}`,
    `avgFico=${Number(avgFico.avgFico || 0).toFixed(2)}`,
    `inputFile=${upsertSummary.sourceFile || 'none'}`,
    `inputRecords=${upsertSummary.inputRecords}`,
    `insertedCustomers=${upsertSummary.insertedCustomers}`,
    `updatedCustomers=${upsertSummary.updatedCustomers}`,
    `inputErrors=${upsertSummary.errors}`,
    `generatedAt=${nowIso()}`
  ].join('\n'));
  const returnCode = upsertSummary.errors > 0 ? 4 : 0;
  const logText = `[${nowIso()}] CUSTFILE/${step.name} validated customer dataset total=${totalCustomers} inputFile=${upsertSummary.sourceFile || 'none'} inserted=${upsertSummary.insertedCustomers} updated=${upsertSummary.updatedCustomers} errors=${upsertSummary.errors} RC=${returnCode}`;
  const logName = `CUSTFILE_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode,
    message: `CUSTFILE processed ${upsertSummary.inputRecords} input records; inserted=${upsertSummary.insertedCustomers}, updated=${upsertSummary.updatedCustomers}, errors=${upsertSummary.errors}`,
    generatedArtifacts: [
      { artifactType: 'extract', name: manifestName, mimeType: 'application/json', storagePath: manifestWritten.storagePath, sizeBytes: manifestWritten.sizeBytes, checksumSha256: manifestWritten.checksumSha256 },
      { artifactType: 'report', name: summaryName, mimeType: 'text/plain', storagePath: summaryWritten.storagePath, sizeBytes: summaryWritten.sizeBytes, checksumSha256: summaryWritten.checksumSha256 },
      { artifactType: 'log', name: logName, mimeType: 'text/plain', storagePath: logWritten.storagePath, sizeBytes: logWritten.sizeBytes, checksumSha256: logWritten.checksumSha256 }
    ],
    logLine: logText
  };
}

async function executeTranbkpStep(_jobRunId, step, parameters, runDir) {
  await delay(200);

  const processingDate = parameters?.processingDate || nowIso().slice(0, 10);
  const outputDirPath = parameters?.outputDirPath ? String(parameters.outputDirPath).trim() : '';
  const rows = db.prepare(`
    SELECT tran_id as tranId, proc_ts as procTs, card_num as cardNum, tran_type_cd as tranTypeCd, amount, description
    FROM transactions
    WHERE DATE(proc_ts) <= DATE(?)
    ORDER BY proc_ts ASC, tran_id ASC
  `).all(processingDate);

  const backupPayload = {
    job: 'TRANBKP',
    processingDate,
    backupTakenAt: nowIso(),
    totalRows: rows.length,
    transactions: rows
  };

  const backupName = `TRANBKP_${processingDate.replace(/-/g, '')}.json`;
  const backupContent = JSON.stringify(backupPayload, null, 2);
  let backupWritten;
  if (outputDirPath) {
    const resolvedOutputDir = resolveOutputDirectoryPath(outputDirPath);
    fs.mkdirSync(resolvedOutputDir, { recursive: true });
    const customBackupPath = path.join(resolvedOutputDir, backupName);
    fs.writeFileSync(customBackupPath, backupContent, 'utf8');
    const stat = fs.statSync(customBackupPath);
    backupWritten = {
      storagePath: customBackupPath,
      sizeBytes: stat.size,
      checksumSha256: checksum(backupContent)
    };
  } else {
    backupWritten = writeArtifactFile(runDir, backupName, backupContent);
  }

  const totals = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const summaryName = `TRANBKP_${processingDate.replace(/-/g, '')}_SUMMARY.txt`;
  const summaryWritten = writeArtifactFile(runDir, summaryName, [
    'TRANBKP SUMMARY',
    `processingDate=${processingDate}`,
    `transactionCount=${rows.length}`,
    `amountTotal=${totals.toFixed(2)}`,
    `backupFile=${backupWritten.storagePath}`,
    `outputDirPath=${outputDirPath || 'default-run-output'}`,
    `generatedAt=${nowIso()}`
  ].join('\n'));

  const logText = `[${nowIso()}] TRANBKP/${step.name} backed up ${rows.length} transactions outputDirPath=${outputDirPath || 'default-run-output'} RC=0`;
  const logName = `TRANBKP_${step.name}.log`;
  const logWritten = writeArtifactFile(runDir, logName, logText);

  return {
    returnCode: 0,
    message: `Backed up ${rows.length} transactions totaling ${totals.toFixed(2)}`,
    generatedArtifacts: [
      { artifactType: 'extract', name: backupName, mimeType: 'application/json', storagePath: backupWritten.storagePath, sizeBytes: backupWritten.sizeBytes, checksumSha256: backupWritten.checksumSha256 },
      { artifactType: 'report', name: summaryName, mimeType: 'text/plain', storagePath: summaryWritten.storagePath, sizeBytes: summaryWritten.sizeBytes, checksumSha256: summaryWritten.checksumSha256 },
      { artifactType: 'log', name: logName, mimeType: 'text/plain', storagePath: logWritten.storagePath, sizeBytes: logWritten.sizeBytes, checksumSha256: logWritten.checksumSha256 }
    ],
    logLine: logText
  };
}

async function executeDefaultStep(jobName, step, parameters, runDir) {
  await delay(200);

  const forceFailStep = parameters?.forceFailStep;
  const forceWarnStep = parameters?.forceWarnStep;
  let returnCode = 0;
  let message = `${jobName}/${step.name} executed via ${step.target}`;

  if (forceFailStep && String(forceFailStep).toUpperCase() === String(step.name).toUpperCase()) {
    returnCode = 8;
    message = `${jobName}/${step.name} simulated failure`;
  } else if (forceWarnStep && String(forceWarnStep).toUpperCase() === String(step.name).toUpperCase()) {
    returnCode = 4;
    message = `${jobName}/${step.name} completed with warnings`;
  }

  const generatedArtifacts = [];

  const logText = `[${nowIso()}] ${message} RC=${returnCode}`;
  const logFileName = `${jobName}_${step.name}.log`;
  const written = writeArtifactFile(runDir, logFileName, logText);
  generatedArtifacts.push({
    artifactType: 'log',
    name: logFileName,
    mimeType: 'text/plain',
    storagePath: written.storagePath,
    sizeBytes: written.sizeBytes,
    checksumSha256: written.checksumSha256
  });

  return { returnCode, message, generatedArtifacts, logLine: logText };
}

async function executeStep(jobRunId, jobName, step, parameters, runDir) {
  if (jobName === 'POSTTRAN' && step.target === 'CBTRN02C') {
    return executePosttranStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'INTCALC' && step.target === 'CBACT04C') {
    return executeIntcalcStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'TRANREPT' && step.target === 'CBTRN03C') {
    return executeTranreptStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CBEXPORT' && step.target === 'CBEXPORT') {
    return executeCbexportStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CBIMPORT' && step.target === 'CBIMPORT') {
    return executeCbimportStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CREASTMT' && step.target === 'CBSTM03A') {
    return executeCreastmtStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CBEXPORT' && step.target === 'CBEXPORT') {
    return executeCbexportStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CBIMPORT' && step.target === 'CBIMPORT') {
    return executeCbimportStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'ACCTFILE' && step.target === 'IDCAMS') {
    return executeAcctfileStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CARDFILE' && step.target === 'IDCAMS') {
    return executeCardfileStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'CUSTFILE' && step.target === 'IDCAMS') {
    return executeCustfileStep(jobRunId, step, parameters, runDir);
  }
  if (jobName === 'TRANBKP' && (step.target === 'REPROC' || step.target === 'IDCAMS')) {
    return executeTranbkpStep(jobRunId, step, parameters, runDir);
  }
  return executeDefaultStep(jobName, step, parameters, runDir);
}

function getJobDefinition(jobName) {
  const row = db.prepare('SELECT * FROM jobs WHERE job_name = ?').get(jobName);
  if (!row) return null;
  const definition = parseJson(row.job_definition_json, { steps: [] });
  return {
    jobName: row.job_name,
    enabled: Number(row.enabled) === 1,
    defaultParams: parseJson(row.default_params_json, {}),
    steps: Array.isArray(definition.steps) ? definition.steps : []
  };
}

function submitJob({ jobName, runMode, parameters, submittedBy, correlationId, restartOfJobRunId = null }) {
  const job = getJobDefinition(jobName);
  if (!job || !job.enabled) {
    return null;
  }

  const hasRunning = db.prepare('SELECT job_run_id FROM job_runs WHERE job_name = ? AND status IN (\'queued\', \'running\')').get(jobName);
  if (hasRunning) {
    const error = new Error(`Job ${jobName} already running`);
    error.code = 'JOB_ALREADY_RUNNING';
    throw error;
  }

  const jobRunId = generateJobRunId();
  const runDir = path.join(outputRoot, jobRunId);
  fs.mkdirSync(runDir, { recursive: true });

  db.prepare(`
    INSERT INTO job_runs (
      job_run_id, job_name, submitted_at, submitted_by, run_mode, parameters_json, status, correlation_id, output_dir, restart_of_job_run_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobRunId,
    jobName,
    nowIso(),
    submittedBy || null,
    runMode || 'manual',
    JSON.stringify(parameters || {}),
    'queued',
    correlationId || null,
    runDir,
    restartOfJobRunId
  );

  queueRunExecution(jobRunId);

  return { jobRunId, jobName, status: 'queued' };
}

function getRestartStartStepSeq(jobRunId, restartOfJobRunId, restartMode) {
  if (!restartOfJobRunId || restartMode !== 'resume-from-failed-step') {
    return 1;
  }
  const failedStep = db.prepare(`
    SELECT step_seq as stepSeq
    FROM job_run_steps
    WHERE job_run_id = ? AND status = 'failed'
    ORDER BY step_seq ASC
    LIMIT 1
  `).get(restartOfJobRunId);
  return failedStep?.stepSeq || 1;
}

function queueRunExecution(jobRunId) {
  setTimeout(() => {
    executeJobRun(jobRunId).catch(() => {
      // Errors are persisted to DB by executeJobRun.
    });
  }, 0);
}

async function executeJobRun(jobRunId) {
  if (runningJobRuns.has(jobRunId)) return;

  const run = db.prepare('SELECT * FROM job_runs WHERE job_run_id = ?').get(jobRunId);
  if (!run || run.status !== 'queued') return;

  if (run.cancel_requested_at) {
    markRunCancelled(jobRunId, run.cancel_reason || 'Cancelled before start');
    return;
  }

  runningJobRuns.add(jobRunId);

  const job = getJobDefinition(run.job_name);
  if (!job) {
    db.prepare('UPDATE job_runs SET status = ?, started_at = ?, ended_at = ?, exit_code = ?, error_summary = ? WHERE job_run_id = ?')
      .run('failed', nowIso(), nowIso(), 16, 'Job definition missing', jobRunId);
    runningJobRuns.delete(jobRunId);
    return;
  }

  const params = parseJson(run.parameters_json, {});
  const runDir = run.output_dir || path.join(outputRoot, jobRunId);
  fs.mkdirSync(runDir, { recursive: true });
  const restartMeta = params?.__restart || {};
  const restartMode = restartMeta.mode || 'rerun-all';
  const startStepSeq = getRestartStartStepSeq(jobRunId, run.restart_of_job_run_id, restartMode);

  db.prepare('UPDATE job_runs SET status = ?, started_at = ? WHERE job_run_id = ?').run('running', nowIso(), jobRunId);

  const combinedLogs = [];
  let highestRc = 0;
  let failed = false;
  let previousRc = null;

  try {
    for (let index = 0; index < job.steps.length; index += 1) {
      const step = job.steps[index];
      const stepRunId = generateStepRunId();
      const stepSeq = index + 1;
      const conditionExpr = step.condition || null;

      if (stepSeq < startStepSeq) {
        db.prepare(`
          INSERT INTO job_run_steps (
            step_run_id, job_run_id, step_seq, step_name, legacy_exec_type, legacy_exec_target,
            status, condition_expr, started_at, ended_at, return_code, message
          ) VALUES (?, ?, ?, ?, ?, ?, 'skipped', ?, ?, ?, 0, ?)
        `).run(
          stepRunId,
          jobRunId,
          stepSeq,
          step.name,
          toStepTypeLabel(step.type),
          step.target,
          conditionExpr,
          nowIso(),
          nowIso(),
          `Restart mode ${restartMode}: skipped before resume step ${startStepSeq}`
        );
        previousRc = 0;
        combinedLogs.push(`[${nowIso()}] ${step.name} skipped due to restart mode ${restartMode}`);
        continue;
      }

      const shouldSkip = shouldSkipStep(conditionExpr, previousRc);
      if (shouldSkip) {
        db.prepare(`
          INSERT INTO job_run_steps (
            step_run_id, job_run_id, step_seq, step_name, legacy_exec_type, legacy_exec_target,
            status, condition_expr, started_at, ended_at, return_code, message
          ) VALUES (?, ?, ?, ?, ?, ?, 'skipped', ?, ?, ?, NULL, ?)
        `).run(
          stepRunId,
          jobRunId,
          stepSeq,
          step.name,
          toStepTypeLabel(step.type),
          step.target,
          conditionExpr,
          nowIso(),
          nowIso(),
          `Skipped by condition ${conditionExpr}`
        );
        combinedLogs.push(`[${nowIso()}] ${step.name} skipped by condition ${conditionExpr}`);
        continue;
      }

      db.prepare(`
        INSERT INTO job_run_steps (
          step_run_id, job_run_id, step_seq, step_name, legacy_exec_type, legacy_exec_target,
          status, condition_expr, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)
      `).run(
        stepRunId,
        jobRunId,
        stepSeq,
        step.name,
        toStepTypeLabel(step.type),
        step.target,
        conditionExpr,
        nowIso()
      );

      const retryPolicy = getStepRetryPolicy(step);
      let result = null;
      let attempts = 0;

      while (attempts < retryPolicy.maxAttempts) {
        if (isCancelRequested(jobRunId)) {
          result = {
            returnCode: 16,
            message: `Step cancelled before execution attempt ${attempts + 1}`,
            generatedArtifacts: [],
            logLine: `[${nowIso()}] ${step.name} cancelled before execution`
          };
          break;
        }

        attempts += 1;
        result = await executeStep(jobRunId, job.jobName, step, params, runDir);
        if (result.returnCode <= 4) {
          break;
        }

        if (attempts < retryPolicy.maxAttempts && retryPolicy.backoffMs > 0) {
          combinedLogs.push(`[${nowIso()}] ${step.name} attempt ${attempts}/${retryPolicy.maxAttempts} failed RC=${result.returnCode}; retrying in ${retryPolicy.backoffMs}ms`);
          await delay(retryPolicy.backoffMs);
        }
      }

      if (!result) {
        result = {
          returnCode: 16,
          message: 'Step did not produce a result',
          generatedArtifacts: [],
          logLine: `[${nowIso()}] ${step.name} missing result`
        };
      }

      result.message = `${result.message} (attempts=${attempts}/${retryPolicy.maxAttempts}, backoffMs=${retryPolicy.backoffMs})`;
      const stepStatus = result.returnCode > 4 ? 'failed' : 'succeeded';
      previousRc = result.returnCode;
      highestRc = Math.max(highestRc, result.returnCode);

      db.prepare('UPDATE job_run_steps SET status = ?, ended_at = ?, return_code = ?, message = ? WHERE step_run_id = ?')
        .run(stepStatus, nowIso(), result.returnCode, result.message, stepRunId);

      combinedLogs.push(result.logLine);

      for (const artifact of result.generatedArtifacts) {
        if (artifact.content !== undefined) {
          const written = writeArtifactFile(runDir, artifact.name, artifact.content);
          addArtifact({
            jobRunId,
            stepRunId,
            artifactType: artifact.artifactType,
            name: artifact.name,
            mimeType: artifact.mimeType,
            storageKind: 'file',
            storagePath: written.storagePath,
            sizeBytes: written.sizeBytes,
            checksumSha256: written.checksumSha256
          });
        } else {
          addArtifact({
            jobRunId,
            stepRunId,
            artifactType: artifact.artifactType,
            name: artifact.name,
            mimeType: artifact.mimeType,
            storageKind: 'file',
            storagePath: artifact.storagePath,
            sizeBytes: artifact.sizeBytes,
            checksumSha256: artifact.checksumSha256
          });
        }
      }

      if (result.returnCode > 4) {
        if (isCancelRequested(jobRunId)) {
          markRunCancelled(jobRunId, 'Cancelled while running');
          failed = false;
          break;
        }
        failed = true;
        break;
      }

      if (isCancelRequested(jobRunId)) {
        markRunCancelled(jobRunId, 'Cancelled while running');
        failed = false;
        break;
      }
    }

    const combinedLogText = combinedLogs.join('\n');
    addArtifact({
      jobRunId,
      artifactType: 'log',
      name: 'job.log',
      mimeType: 'text/plain',
      storageKind: 'inline',
      contentInline: combinedLogText,
      sizeBytes: Buffer.byteLength(combinedLogText, 'utf8'),
      checksumSha256: checksum(combinedLogText)
    });

    const latestRun = db.prepare('SELECT status FROM job_runs WHERE job_run_id = ?').get(jobRunId);
    if (latestRun?.status !== 'cancelled') {
      db.prepare('UPDATE job_runs SET status = ?, ended_at = ?, exit_code = ?, error_summary = ? WHERE job_run_id = ?')
        .run(
          failed ? 'failed' : 'succeeded',
          nowIso(),
          highestRc,
          failed ? `Step failure detected with RC=${highestRc}` : null,
          jobRunId
        );
    }
  } catch (error) {
    db.prepare('UPDATE job_runs SET status = ?, ended_at = ?, exit_code = ?, error_summary = ? WHERE job_run_id = ?')
      .run('failed', nowIso(), 16, error.message || 'System error', jobRunId);
  } finally {
    runningJobRuns.delete(jobRunId);
  }
}

function cancelJobRun({ jobRunId, requestedBy, reason }) {
  const run = db.prepare('SELECT job_run_id, status FROM job_runs WHERE job_run_id = ?').get(jobRunId);
  if (!run) return null;

  if (['succeeded', 'failed', 'cancelled'].includes(run.status)) {
    const err = new Error('Run already completed');
    err.code = 'RUN_COMPLETED';
    throw err;
  }

  const cancelReason = reason || 'Cancelled by user request';
  db.prepare('UPDATE job_runs SET cancel_requested_at = ?, cancel_requested_by = ?, cancel_reason = ? WHERE job_run_id = ?')
    .run(nowIso(), requestedBy || null, cancelReason, jobRunId);

  if (run.status === 'queued') {
    markRunCancelled(jobRunId, cancelReason);
  }

  return { jobRunId, status: run.status === 'queued' ? 'cancelled' : 'cancelling' };
}

function restartJobRun({ priorJobRunId, restartMode = 'resume-from-failed-step', submittedBy, correlationId }) {
  const priorRun = db.prepare('SELECT job_run_id, job_name, status, parameters_json FROM job_runs WHERE job_run_id = ?').get(priorJobRunId);
  if (!priorRun) {
    return null;
  }

  if (!['failed', 'succeeded', 'cancelled'].includes(priorRun.status)) {
    const error = new Error('Only completed runs can be restarted');
    error.code = 'INVALID_RESTART_STATE';
    throw error;
  }

  const priorParams = parseJson(priorRun.parameters_json, {});
  const nextParams = {
    ...priorParams,
    __restart: {
      priorJobRunId,
      mode: restartMode
    }
  };

  return submitJob({
    jobName: priorRun.job_name,
    runMode: 'replay',
    parameters: nextParams,
    submittedBy,
    correlationId,
    restartOfJobRunId: priorJobRunId
  });
}

function getJobs() {
  const rows = db.prepare('SELECT job_name, display_name, category, enabled, default_params_json FROM jobs ORDER BY job_name ASC').all();
  return rows.map((row) => ({
    jobName: row.job_name,
    displayName: row.display_name,
    category: row.category,
    enabled: Number(row.enabled) === 1,
    defaultParameters: parseJson(row.default_params_json, {})
  }));
}

module.exports = {
  submitJob,
  getJobs,
  restartJobRun,
  cancelJobRun
};
