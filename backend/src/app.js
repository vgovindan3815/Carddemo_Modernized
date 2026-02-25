const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const swaggerUi = require('swagger-ui-express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { db, migrate, seed } = require('./db');
const { submitJob, getJobs, restartJobRun, cancelJobRun } = require('./batch-runner');
const { apiError, errorResponse } = require('./errors');
const { mainMenuOptions, adminMenuOptions, errorCatalog } = require('./constants');
const { openApiSpec } = require('./openapi');

migrate();
seed();

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use((req, res, next) => {
  const cid = req.headers['x-correlation-id'] || randomUUID();
  req.correlationId = cid;
  res.setHeader('x-correlation-id', cid);
  next();
});

app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(cors({ origin: ['http://localhost:4200'], credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'carddemo-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 }
}));

app.get('/api-docs.json', (_req, res) => {
  res.json(openApiSpec);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
  explorer: true,
  customSiteTitle: 'CardDemo API Docs'
}));

const loginSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(1)
});

const userSchema = z.object({
  userId: z.string().min(1).max(8).optional(),
  firstName: z.string().min(1).max(20),
  lastName: z.string().min(1).max(20),
  password: z.string().min(1).max(64),
  userType: z.enum(['A', 'U'])
});

const accountUpdateSchema = z.object({
  confirm: z.enum(['Y', 'N']),
  account: z.object({
    activeStatus: z.string().min(1),
    creditLimit: z.number(),
    cashCreditLimit: z.number(),
    openDate: z.string(),
    expirationDate: z.string(),
    reissueDate: z.string(),
    currBal: z.number(),
    currCycCredit: z.number(),
    currCycDebit: z.number(),
    groupId: z.string().optional()
  }),
  customer: z.object({
    custId: z.number(),
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    lastName: z.string().min(1),
    ssn: z.string().min(1),
    dob: z.string(),
    ficoScore: z.number(),
    address: z.object({
      line1: z.string().min(1),
      line2: z.string().optional(),
      line3: z.string().optional(),
      state: z.string().min(1),
      country: z.string().min(1),
      zip: z.string().min(1)
    }),
    phone1: z.string().optional(),
    phone2: z.string().optional(),
    govtId: z.string().optional(),
    eftAccountId: z.string().optional(),
    primaryHolderInd: z.string().optional()
  })
});

const cardUpdateSchema = z.object({
  confirm: z.enum(['Y', 'N']),
  embossedName: z.string().min(1),
  activeStatus: z.string().min(1),
  expirationDate: z.string().min(1)
});

const transactionCreateSchema = z.object({
  confirm: z.enum(['Y', 'N']),
  acctId: z.number(),
  cardNum: z.string().min(1),
  tranTypeCd: z.string().min(1),
  tranCatCd: z.number(),
  source: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  origDate: z.string().min(1),
  procDate: z.string().min(1),
  merchantId: z.number(),
  merchantName: z.string().min(1),
  merchantCity: z.string().min(1),
  merchantZip: z.string().min(1)
});

const billingSchema = z.object({
  acctId: z.number(),
  confirm: z.enum(['Y', 'N']),
  amount: z.number().positive(),
  card: z.object({
    cardNum: z.string().min(1),
    expirationDate: z.string().min(1),
    secretCode: z.string().min(1)
  }).optional()
});

const reportSchema = z.object({
  reportType: z.enum(['MONTHLY', 'YEARLY', 'CUSTOM']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  confirm: z.enum(['Y', 'N'])
});

function requireAuth(req, _res, next) {
  if (!req.session.user) {
    return next(apiError('UNAUTHORIZED', 'Authentication required', 401));
  }
  next();
}

function requireRole(role) {
  return (req, _res, next) => {
    if (!req.session.user) {
      return next(apiError('UNAUTHORIZED', 'Authentication required', 401));
    }
    if (req.session.user.userType !== role) {
      return next(apiError('FORBIDDEN', 'Admin role is required', 403));
    }
    next();
  };
}

function parseOrThrow(schema, data) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const legacyFieldMessages = {
      firstName: errorCatalog.requiredFirstName,
      lastName: errorCatalog.requiredLastName,
      password: errorCatalog.requiredPasswordField,
      userType: errorCatalog.requiredUserType,
      acctId: errorCatalog.requiredAcctId,
      tranTypeCd: errorCatalog.requiredTranType,
      tranCatCd: errorCatalog.requiredTranCategory,
      description: errorCatalog.requiredDescription,
      amount: errorCatalog.requiredAmount,
      confirm: errorCatalog.invalidConfirm
    };
    const details = parsed.error.issues.map((issue) => {
      const field = issue.path.join('.');
      const isTypeOrMissing = issue.code === 'invalid_type' || issue.code === 'too_small' || issue.code === 'invalid_value';
      const mapped = isTypeOrMissing ? legacyFieldMessages[field] : undefined;
      return { field, message: mapped || issue.message };
    });
    throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, details);
  }
  return parsed.data;
}

function toUserDto(row) {
  return {
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    userType: row.user_type
  };
}

function listQuery(req, defaults = { page: 1, pageSize: 10 }) {
  const pageRaw = Number(req.query.page ?? defaults.page);
  const pageSizeRaw = Number(req.query.pageSize ?? defaults.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : defaults.page;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1 ? Math.min(100, Math.floor(pageSizeRaw)) : defaults.pageSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function resolveSort(sort, allow, fallback) {
  if (!sort) return fallback;
  const [field, dirRaw] = String(sort).split(':');
  const dir = String(dirRaw || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const mapped = allow[field];
  if (!mapped) return fallback;
  return `${mapped} ${dir}`;
}

function parseStrictIsoDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr))) return null;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function collectUserRequiredErrors(body) {
  const details = [];
  if (isBlank(body?.firstName)) details.push({ field: 'firstName', message: errorCatalog.requiredFirstName });
  if (isBlank(body?.lastName)) details.push({ field: 'lastName', message: errorCatalog.requiredLastName });
  if (isBlank(body?.password)) details.push({ field: 'password', message: errorCatalog.requiredPasswordField });
  if (isBlank(body?.userType)) details.push({ field: 'userType', message: errorCatalog.requiredUserType });
  return details;
}

app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/v1/auth/login', (req, res, next) => {
  try {
    const body = parseOrThrow(loginSchema, req.body);
    if (!body.userId) throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'userId', message: errorCatalog.requiredUserId }]);
    if (!body.password) throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'password', message: errorCatalog.requiredPassword }]);

    const user = db.prepare('SELECT * FROM user_security WHERE user_id = ?').get(body.userId);
    if (!user) {
      throw apiError('UNAUTHORIZED', errorCatalog.wrongPassword, 401, [{ field: 'password', message: 'Password does not match' }]);
    }
    const ok = bcrypt.compareSync(body.password, user.password_hash);
    if (!ok) {
      throw apiError('UNAUTHORIZED', errorCatalog.wrongPassword, 401, [{ field: 'password', message: 'Password does not match' }]);
    }

    req.session.user = { userId: user.user_id, userType: user.user_type };
    res.json({
      sessionId: req.session.id,
      userId: user.user_id,
      userType: user.user_type,
      displayName: `${user.first_name} ${user.last_name}`,
      nextRoute: '/menu'
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/auth/logout', requireAuth, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(apiError('SYSTEM_ERROR', 'Unable to logout', 500));
    }
    res.status(204).send();
  });
});

app.get('/api/v1/auth/me', requireAuth, (req, res) => {
  const user = req.session.user;
  res.json({
    userId: user.userId,
    userType: user.userType,
    permissions: user.userType === 'A' ? ['admin', 'user'] : ['user']
  });
});

app.get('/api/v1/menu/main', requireAuth, (_req, res) => {
  res.json({ title: 'Main Menu', options: mainMenuOptions });
});

app.get('/api/v1/menu/admin', requireRole('A'), (_req, res) => {
  res.json({ title: 'Admin Menu', options: adminMenuOptions });
});

app.get('/api/v1/users', requireRole('A'), (req, res) => {
  const search = req.query.search ? String(req.query.search) : '';
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 10 });
  const orderBy = resolveSort(req.query.sort, {
    userId: 'user_id',
    firstName: 'first_name',
    lastName: 'last_name',
    userType: 'user_type'
  }, 'user_id ASC');
  const where = search ? 'WHERE user_id LIKE ? OR first_name LIKE ? OR last_name LIKE ?' : '';
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`, pageSize, offset] : [pageSize, offset];
  const rows = db.prepare(`SELECT user_id, first_name, last_name, user_type FROM user_security ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...params);
  const total = db.prepare(`SELECT COUNT(*) as count FROM user_security ${where}`).get(...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [])).count;
  res.json({ items: rows.map(toUserDto), page, pageSize, total });
});

app.get('/api/v1/users/:userId', requireRole('A'), (req, res, next) => {
  const row = db.prepare('SELECT user_id, first_name, last_name, user_type FROM user_security WHERE user_id = ?').get(req.params.userId);
  if (!row) return next(apiError('NOT_FOUND', errorCatalog.userNotFound, 404, [{ field: 'userId', message: 'No user exists for supplied userId' }]));
  res.json(toUserDto(row));
});

app.post('/api/v1/users', requireRole('A'), (req, res, next) => {
  try {
    const requiredFieldErrors = collectUserRequiredErrors(req.body);
    if (requiredFieldErrors.length) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, requiredFieldErrors);
    }
    const body = parseOrThrow(userSchema.extend({ userId: z.string().min(1).max(8) }), req.body);
    const exists = db.prepare('SELECT user_id FROM user_security WHERE user_id = ?').get(body.userId);
    if (exists) throw apiError('CONFLICT', errorCatalog.duplicateUserId, 409, [{ field: 'userId', message: 'User ID must be unique' }]);
    const hash = bcrypt.hashSync(body.password, 10);
    db.prepare('INSERT INTO user_security (user_id, first_name, last_name, password_hash, user_type) VALUES (?, ?, ?, ?, ?)')
      .run(body.userId, body.firstName, body.lastName, hash, body.userType);
    res.status(201).json({ userId: body.userId, firstName: body.firstName, lastName: body.lastName, userType: body.userType, created: true });
  } catch (error) {
    next(error);
  }
});

app.put('/api/v1/users/:userId', requireRole('A'), (req, res, next) => {
  try {
    const requiredFieldErrors = collectUserRequiredErrors(req.body);
    if (requiredFieldErrors.length) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, requiredFieldErrors);
    }
    const body = parseOrThrow(userSchema, req.body);
    const existing = db.prepare('SELECT user_id FROM user_security WHERE user_id = ?').get(req.params.userId);
    if (!existing) throw apiError('NOT_FOUND', errorCatalog.userNotFound, 404, [{ field: 'userId', message: 'No user exists for supplied userId' }]);
    const hash = bcrypt.hashSync(body.password, 10);
    db.prepare('UPDATE user_security SET first_name = ?, last_name = ?, password_hash = ?, user_type = ? WHERE user_id = ?')
      .run(body.firstName, body.lastName, hash, body.userType, req.params.userId);
    res.json({ userId: req.params.userId, firstName: body.firstName, lastName: body.lastName, userType: body.userType, updated: true });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/v1/users/:userId', requireRole('A'), (req, res, next) => {
  const row = db.prepare('SELECT user_id FROM user_security WHERE user_id = ?').get(req.params.userId);
  if (!row) return next(apiError('NOT_FOUND', errorCatalog.userNotFound, 404, [{ field: 'userId', message: 'No user exists for supplied userId' }]));
  db.prepare('DELETE FROM user_security WHERE user_id = ?').run(req.params.userId);
  res.status(204).send();
});

app.get('/api/v1/accounts/:acctId', requireAuth, (req, res, next) => {
  const acct = db.prepare('SELECT * FROM accounts WHERE acct_id = ?').get(Number(req.params.acctId));
  if (!acct) return next(apiError('NOT_FOUND', 'Account not found', 404, [{ field: 'acctId', message: 'No account exists for supplied acctId' }]));
  const xref = db.prepare('SELECT * FROM card_xref WHERE acct_id = ?').get(acct.acct_id);
  const customer = xref ? db.prepare('SELECT * FROM customers WHERE cust_id = ?').get(xref.cust_id) : null;
  const cards = db.prepare('SELECT card_num as cardNum, active_status as activeStatus FROM cards WHERE acct_id = ?').all(acct.acct_id);
  res.json({
    account: {
      acctId: acct.acct_id,
      activeStatus: acct.active_status,
      currBal: acct.curr_bal,
      currCycCredit: acct.curr_cyc_credit,
      currCycDebit: acct.curr_cyc_debit,
      creditLimit: acct.credit_limit,
      cashCreditLimit: acct.cash_credit_limit,
      insertedAt: acct.created_at,
      openDate: acct.open_date,
      expirationDate: acct.expiration_date,
      reissueDate: acct.reissue_date,
      groupId: acct.group_id
    },
    customer: customer ? {
      custId: customer.cust_id,
      firstName: customer.first_name,
      middleName: customer.middle_name,
      lastName: customer.last_name,
      ssn: customer.ssn,
      dob: customer.dob,
      ficoScore: customer.fico_score,
      address: {
        line1: customer.addr_line_1,
        line2: customer.addr_line_2,
        line3: customer.addr_line_3,
        state: customer.state_cd,
        country: customer.country_cd,
        zip: customer.zip
      },
      phone1: customer.phone_1,
      phone2: customer.phone_2,
      govtId: customer.govt_id,
      eftAccountId: customer.eft_account_id,
      primaryHolderInd: customer.primary_holder_ind
    } : null,
    cards
  });
});

app.get('/api/v1/accounts', requireAuth, (req, res) => {
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 20 });
  const orderBy = resolveSort(req.query.sort, {
    acctId: 'a.acct_id',
    currBal: 'a.curr_bal',
    activeStatus: 'a.active_status'
  }, 'a.acct_id ASC');
  const search = req.query.search ? String(req.query.search) : '';
  const where = search ? 'WHERE CAST(a.acct_id as TEXT) LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?' : '';
  const baseQuery = `
    SELECT
      a.acct_id as acctId,
      a.active_status as activeStatus,
      a.curr_bal as currBal,
      a.credit_limit as creditLimit,
      a.expiration_date as expirationDate,
      c.cust_id as custId,
      c.first_name as firstName,
      c.last_name as lastName
    FROM accounts a
    LEFT JOIN card_xref x ON x.acct_id = a.acct_id
    LEFT JOIN customers c ON c.cust_id = x.cust_id
    ${where}
    GROUP BY a.acct_id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `;
  const countQuery = `
    SELECT COUNT(DISTINCT a.acct_id) as count
    FROM accounts a
    LEFT JOIN card_xref x ON x.acct_id = a.acct_id
    LEFT JOIN customers c ON c.cust_id = x.cust_id
    ${where}
  `;
  const params = search ? [`%${search}%`, `%${search}%`, `%${search}%`, pageSize, offset] : [pageSize, offset];
  const rows = db.prepare(baseQuery).all(...params);
  const totalParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
  const total = db.prepare(countQuery).get(...totalParams).count;
  res.json({ items: rows, page, pageSize, total });
});

app.put('/api/v1/accounts/:acctId', requireAuth, (req, res, next) => {
  try {
    const body = parseOrThrow(accountUpdateSchema, req.body);
    if (body.confirm !== 'Y') throw apiError('VALIDATION_ERROR', errorCatalog.invalidConfirm, 400, [{ field: 'confirm', message: errorCatalog.invalidConfirm }]);
    const acctId = Number(req.params.acctId);
    const existingAcct = db.prepare('SELECT acct_id FROM accounts WHERE acct_id = ?').get(acctId);
    if (!existingAcct) throw apiError('NOT_FOUND', 'Account not found', 404, [{ field: 'acctId', message: 'No account exists for supplied acctId' }]);
    const tx = db.transaction(() => {
      const accountResult = db.prepare(`UPDATE accounts SET active_status=?, credit_limit=?, cash_credit_limit=?, open_date=?, expiration_date=?, reissue_date=?, curr_bal=?, curr_cyc_credit=?, curr_cyc_debit=?, group_id=? WHERE acct_id=?`)
        .run(body.account.activeStatus, body.account.creditLimit, body.account.cashCreditLimit, body.account.openDate, body.account.expirationDate, body.account.reissueDate, body.account.currBal, body.account.currCycCredit, body.account.currCycDebit, body.account.groupId || null, acctId);
      if (!accountResult.changes) throw apiError('NOT_FOUND', 'Account not found', 404, [{ field: 'acctId', message: 'No account exists for supplied acctId' }]);
      const customerResult = db.prepare(`UPDATE customers SET first_name=?, middle_name=?, last_name=?, ssn=?, dob=?, fico_score=?, addr_line_1=?, addr_line_2=?, addr_line_3=?, state_cd=?, country_cd=?, zip=?, phone_1=?, phone_2=?, govt_id=?, eft_account_id=?, primary_holder_ind=? WHERE cust_id=?`)
        .run(body.customer.firstName, body.customer.middleName || null, body.customer.lastName, body.customer.ssn, body.customer.dob, body.customer.ficoScore, body.customer.address.line1, body.customer.address.line2 || null, body.customer.address.line3 || null, body.customer.address.state, body.customer.address.country, body.customer.address.zip, body.customer.phone1 || null, body.customer.phone2 || null, body.customer.govtId || null, body.customer.eftAccountId || null, body.customer.primaryHolderInd || null, body.customer.custId);
      if (!customerResult.changes) throw apiError('NOT_FOUND', 'Customer not found', 404, [{ field: 'customer.custId', message: 'No customer exists for supplied custId' }]);
    });
    tx();
    res.json({ acctId, updated: true, message: 'Account and customer details updated' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/cards', requireAuth, (req, res) => {
  const acctId = req.query.acctId ? Number(req.query.acctId) : null;
  const cardNum = req.query.cardNum ? String(req.query.cardNum) : null;
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 10 });
  const orderBy = resolveSort(req.query.sort, {
    cardNum: 'card_num',
    acctId: 'acct_id',
    expirationDate: 'expiration_date'
  }, 'card_num ASC');
  const whereParts = [];
  const whereParams = [];
  if (Number.isFinite(acctId)) {
    whereParts.push('acct_id = ?');
    whereParams.push(acctId);
  }
  if (cardNum) {
    whereParts.push('card_num = ?');
    whereParams.push(cardNum);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT card_num as cardNum, acct_id as acctId, embossed_name as embossedName, expiration_date as expirationDate, cvv_cd as secretCode, active_status as activeStatus FROM cards ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...whereParams, pageSize, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM cards ${where}`).get(...whereParams).count;
  res.json({ items: rows, page, pageSize, total });
});

app.get('/api/v1/cards/:cardNum', requireAuth, (req, res, next) => {
  const card = db.prepare('SELECT * FROM cards WHERE card_num = ?').get(req.params.cardNum);
  if (!card) return next(apiError('NOT_FOUND', 'Card not found', 404, [{ field: 'cardNum', message: 'No card exists for supplied card number' }]));
  const acct = db.prepare('SELECT acct_id, curr_bal FROM accounts WHERE acct_id = ?').get(card.acct_id);
  const xref = db.prepare('SELECT cust_id FROM card_xref WHERE card_num = ?').get(card.card_num);
  const customer = xref ? db.prepare('SELECT cust_id, first_name, last_name FROM customers WHERE cust_id = ?').get(xref.cust_id) : null;
  res.json({
    card: { cardNum: card.card_num, embossedName: card.embossed_name, activeStatus: card.active_status, expirationDate: card.expiration_date, secretCode: card.cvv_cd },
    account: acct ? { acctId: acct.acct_id, currBal: acct.curr_bal } : null,
    customer: customer ? { custId: customer.cust_id, firstName: customer.first_name, lastName: customer.last_name } : null
  });
});

app.put('/api/v1/cards/:cardNum', requireAuth, (req, res, next) => {
  try {
    const body = parseOrThrow(cardUpdateSchema, req.body);
    if (body.confirm !== 'Y') throw apiError('VALIDATION_ERROR', errorCatalog.invalidConfirm, 400, [{ field: 'confirm', message: errorCatalog.invalidConfirm }]);
    const result = db.prepare('UPDATE cards SET embossed_name = ?, active_status = ?, expiration_date = ? WHERE card_num = ?')
      .run(body.embossedName, body.activeStatus, body.expirationDate, req.params.cardNum);
    if (!result.changes) throw apiError('NOT_FOUND', 'Card not found', 404, [{ field: 'cardNum', message: 'No card exists for supplied card number' }]);
    res.json({ cardNum: req.params.cardNum, updated: true, message: 'Card updated' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/transactions', requireAuth, (req, res) => {
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 10 });
  const orderBy = resolveSort(req.query.sort, {
    tranId: 'tran_id',
    procTs: 'proc_ts',
    amount: 'amount'
  }, 'proc_ts DESC');
  const cardNum = req.query.cardNum ? String(req.query.cardNum) : null;
  const acctId = req.query.acctId ? Number(req.query.acctId) : null;
  const whereParts = [];
  const whereParams = [];
  if (cardNum) {
    whereParts.push('card_num = ?');
    whereParams.push(cardNum);
  }
  if (Number.isFinite(acctId)) {
    whereParts.push('card_num IN (SELECT card_num FROM cards WHERE acct_id = ?)');
    whereParams.push(acctId);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT tran_id as tranId, tran_type_cd as tranTypeCd, tran_cat_cd as tranCatCd, amount, merchant_name as merchantName, card_num as cardNum, orig_ts as origTs, proc_ts as procTs FROM transactions ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...whereParams, pageSize, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM transactions ${where}`).get(...whereParams).count;
  res.json({ items: rows, page, pageSize, total });
});

app.get('/api/v1/transactions/:tranId', requireAuth, (req, res, next) => {
  const row = db.prepare('SELECT * FROM transactions WHERE tran_id = ?').get(req.params.tranId);
  if (!row) return next(apiError('NOT_FOUND', 'Transaction not found', 404, [{ field: 'tranId', message: 'No transaction exists for supplied tranId' }]));
  res.json({
    tranId: row.tran_id,
    tranTypeCd: row.tran_type_cd,
    tranCatCd: row.tran_cat_cd,
    source: row.source,
    description: row.description,
    amount: row.amount,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    merchantCity: row.merchant_city,
    merchantZip: row.merchant_zip,
    cardNum: row.card_num,
    origTs: row.orig_ts,
    procTs: row.proc_ts
  });
});

app.post('/api/v1/transactions', requireAuth, (req, res, next) => {
  try {
    if (isBlank(req.body?.tranTypeCd)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'tranTypeCd', message: errorCatalog.requiredTranType }]);
    }
    if (isBlank(req.body?.tranCatCd)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'tranCatCd', message: errorCatalog.requiredTranCategory }]);
    }
    if (isBlank(req.body?.amount)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'amount', message: errorCatalog.requiredAmount }]);
    }
    if (isBlank(req.body?.description)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'description', message: errorCatalog.requiredDescription }]);
    }
    const body = parseOrThrow(transactionCreateSchema, req.body);
    if (body.confirm !== 'Y') throw apiError('VALIDATION_ERROR', errorCatalog.invalidConfirm, 400, [{ field: 'confirm', message: errorCatalog.invalidConfirm }]);
    const card = db.prepare('SELECT card_num, acct_id FROM cards WHERE card_num = ?').get(body.cardNum);
    if (!card) throw apiError('NOT_FOUND', 'Card not found', 404, [{ field: 'cardNum', message: 'No card exists for supplied card number' }]);
    if (Number(card.acct_id) !== Number(body.acctId)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'acctId', message: 'Card/account relation is invalid' }]);
    }
    const origTs = parseStrictIsoDate(body.origDate);
    const procTs = parseStrictIsoDate(body.procDate);
    if (!origTs || !procTs) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'origDate', message: 'Start Date - Not a valid date...' }, { field: 'procDate', message: 'End Date - Not a valid date...' }]);
    }
    const tranId = `TXN${Date.now()}`;
    db.prepare('INSERT INTO transactions (tran_id, tran_type_cd, tran_cat_cd, source, description, amount, merchant_id, merchant_name, merchant_city, merchant_zip, card_num, orig_ts, proc_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(tranId, body.tranTypeCd, body.tranCatCd, body.source, body.description, body.amount, body.merchantId, body.merchantName, body.merchantCity, body.merchantZip, body.cardNum, `${body.origDate}T00:00:00Z`, `${body.procDate}T00:00:00Z`);
    res.status(201).json({ tranId, created: true, message: 'Transaction added' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/authorizations', requireAuth, (req, res) => {
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 10 });
  const orderBy = resolveSort(req.query.sort, {
    authId: 'auth_id',
    authDate: 'auth_date',
    amount: 'transaction_amt'
  }, 'auth_date DESC, auth_time DESC');
  const acctId = req.query.acctId ? Number(req.query.acctId) : null;
  const cardNum = req.query.cardNum ? String(req.query.cardNum) : null;
  const matchStatus = req.query.status ? String(req.query.status) : null;
  const whereParts = [];
  const whereParams = [];
  if (Number.isFinite(acctId)) {
    whereParts.push('acct_id = ?');
    whereParams.push(acctId);
  }
  if (cardNum) {
    whereParts.push('card_num = ?');
    whereParams.push(cardNum);
  }
  if (matchStatus) {
    whereParts.push('match_status = ?');
    whereParams.push(matchStatus);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT auth_id as authId, acct_id as acctId, auth_date as authDate, auth_time as authTime, card_num as cardNum, auth_type as authType, auth_resp_code as authRespCode, transaction_amt as transactionAmt, approved_amt as approvedAmt, merchant_name as merchantName, merchant_city as merchantCity, match_status as matchStatus, auth_fraud as authFraud FROM authorization_details ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...whereParams, pageSize, offset);
  const total = db.prepare(`SELECT COUNT(*) as count FROM authorization_details ${where}`).get(...whereParams).count;
  res.json({ items: rows, page, pageSize, total });
});

app.get('/api/v1/authorizations/:authId', requireAuth, (req, res, next) => {
  const row = db.prepare('SELECT * FROM authorization_details WHERE auth_id = ?').get(req.params.authId);
  if (!row) return next(apiError('NOT_FOUND', 'Authorization not found', 404, [{ field: 'authId', message: 'No authorization exists for supplied authId' }]));
  res.json({
    authId: row.auth_id,
    acctId: row.acct_id,
    authDate: row.auth_date,
    authTime: row.auth_time,
    authOrigDate: row.auth_orig_date,
    authOrigTime: row.auth_orig_time,
    cardNum: row.card_num,
    authType: row.auth_type,
    cardExpiryDate: row.card_expiry_date,
    messageType: row.message_type,
    messageSource: row.message_source,
    authIdCode: row.auth_id_code,
    authRespCode: row.auth_resp_code,
    authRespReason: row.auth_resp_reason,
    processingCode: row.processing_code,
    transactionAmt: row.transaction_amt,
    approvedAmt: row.approved_amt,
    merchantCategoryCode: row.merchant_category_code,
    acqrCountryCode: row.acqr_country_code,
    posEntryMode: row.pos_entry_mode,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    merchantCity: row.merchant_city,
    merchantState: row.merchant_state,
    merchantZip: row.merchant_zip,
    transactionId: row.transaction_id,
    matchStatus: row.match_status,
    authFraud: row.auth_fraud,
    fraudRptDate: row.fraud_rpt_date,
    createdAt: row.created_at
  });
});

app.put('/api/v1/authorizations/:authId/fraud', requireAuth, (req, res, next) => {
  try {
    const { authId } = req.params;
    const row = db.prepare('SELECT * FROM authorization_details WHERE auth_id = ?').get(authId);
    if (!row) return next(apiError('NOT_FOUND', 'Authorization not found', 404, [{ field: 'authId', message: 'No authorization exists for supplied authId' }]));
    const fraudStatus = req.body.fraudStatus || 'F';
    const fraudRptDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    db.prepare('UPDATE authorization_details SET auth_fraud = ?, fraud_rpt_date = ? WHERE auth_id = ?')
      .run(fraudStatus, fraudRptDate, authId);
    res.json({ authId, updated: true, message: 'Authorization marked as fraud' });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/billing/payments', requireAuth, (req, res, next) => {
  try {
    if (isBlank(req.body?.acctId)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'acctId', message: errorCatalog.requiredAcctId }]);
    }
    if (isBlank(req.body?.amount)) {
      throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'amount', message: errorCatalog.requiredAmount }]);
    }
    if (req.body?.card) {
      if (isBlank(req.body?.card?.cardNum)) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'card.cardNum', message: errorCatalog.requiredCardNumber }]);
      }
      if (isBlank(req.body?.card?.expirationDate)) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'card.expirationDate', message: errorCatalog.requiredCardExpiry }]);
      }
      if (isBlank(req.body?.card?.secretCode)) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'card.secretCode', message: errorCatalog.requiredCardCvv }]);
      }
    }
    const body = parseOrThrow(billingSchema, req.body);
    if (body.confirm !== 'Y') throw apiError('VALIDATION_ERROR', errorCatalog.confirmPayment, 400, [{ field: 'confirm', message: 'confirm must be Y to post payment' }]);
    const account = db.prepare('SELECT acct_id FROM accounts WHERE acct_id = ?').get(body.acctId);
    if (!account) throw apiError('NOT_FOUND', 'Account not found', 404, [{ field: 'acctId', message: 'No account exists for supplied acctId' }]);

    let paymentCardNum = null;
    if (body.card) {
      const expiry = parseStrictIsoDate(body.card.expirationDate);
      if (!expiry) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'card.expirationDate', message: 'Expiry Date - Not a valid date...' }]);
      }
      const existingCardByNumber = db.prepare('SELECT card_num, acct_id FROM cards WHERE card_num = ?').get(body.card.cardNum);
      if (existingCardByNumber && Number(existingCardByNumber.acct_id) !== Number(body.acctId)) {
        throw apiError('CONFLICT', 'Card belongs to a different account', 409, [{ field: 'card.cardNum', message: 'Card/account relation is invalid' }]);
      }

      const xref = db.prepare('SELECT cust_id FROM card_xref WHERE acct_id = ? LIMIT 1').get(body.acctId);
      const cust = xref ? db.prepare('SELECT first_name, last_name FROM customers WHERE cust_id = ?').get(xref.cust_id) : null;
      const embossedName = cust ? `${cust.first_name} ${cust.last_name}`.trim() : 'ACCOUNT HOLDER';

      if (existingCardByNumber) {
        db.prepare('UPDATE cards SET cvv_cd = ?, expiration_date = ?, active_status = ? WHERE card_num = ?')
          .run(body.card.secretCode, body.card.expirationDate, 'Y', body.card.cardNum);
      } else {
        db.prepare('INSERT INTO cards (card_num, acct_id, cvv_cd, embossed_name, expiration_date, active_status) VALUES (?, ?, ?, ?, ?, ?)')
          .run(body.card.cardNum, body.acctId, body.card.secretCode, embossedName, body.card.expirationDate, 'Y');
        if (xref) {
          db.prepare('INSERT INTO card_xref (card_num, cust_id, acct_id) VALUES (?, ?, ?)')
            .run(body.card.cardNum, xref.cust_id, body.acctId);
        }
      }

      paymentCardNum = body.card.cardNum;
    }

    if (!paymentCardNum) {
      const existingCardForAcct = db.prepare('SELECT card_num FROM cards WHERE acct_id = ? ORDER BY card_num LIMIT 1').get(body.acctId);
      if (!existingCardForAcct) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'card.cardNum', message: errorCatalog.requiredCardNumber }]);
      }
      paymentCardNum = existingCardForAcct.card_num;
    }

    const tranId = `TXN${Date.now()}`;
    const tx = db.transaction(() => {
      db.prepare('UPDATE accounts SET curr_bal = curr_bal - ? WHERE acct_id = ?').run(body.amount, body.acctId);
      const now = new Date().toISOString();
      db.prepare('INSERT INTO transactions (tran_id, tran_type_cd, tran_cat_cd, source, description, amount, merchant_id, merchant_name, merchant_city, merchant_zip, card_num, orig_ts, proc_ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(tranId, 'PM', 2001, 'BILLPAY', 'Bill payment', body.amount, 100234567, 'UTILITY PAYMENT', 'AUSTIN', '73301', paymentCardNum, now, now);
    });
    tx();
    const acct = db.prepare('SELECT curr_bal FROM accounts WHERE acct_id = ?').get(body.acctId);
    res.json({ paymentTranId: tranId, acctId: body.acctId, newBalance: acct.curr_bal, posted: true });
  } catch (error) {
    next(error);
  }
});

app.post('/api/v1/reports/transactions', requireAuth, (req, res, next) => {
  try {
    const body = parseOrThrow(reportSchema, req.body);
    if (body.confirm !== 'Y') throw apiError('VALIDATION_ERROR', errorCatalog.invalidConfirm, 400, [{ field: 'confirm', message: errorCatalog.invalidConfirm }]);
    if (body.reportType === 'CUSTOM') {
      if (!body.startDate || !body.endDate) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'startDate', message: 'Start Date - Month can NOT be empty...' }, { field: 'endDate', message: 'End Date - Month can NOT be empty...' }]);
      }
      const start = parseStrictIsoDate(body.startDate);
      const end = parseStrictIsoDate(body.endDate);
      if (!start || !end || start > end) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'startDate', message: 'Start Date - Not a valid date...' }, { field: 'endDate', message: 'End Date - Not a valid date...' }]);
      }
    }

    const now = new Date();
    const endDateIso = now.toISOString().slice(0, 10);
    let effectiveStartDate = body.startDate || null;
    let effectiveEndDate = body.endDate || null;

    if (body.reportType === 'MONTHLY') {
      effectiveStartDate = `${endDateIso.slice(0, 8)}01`;
      effectiveEndDate = endDateIso;
    } else if (body.reportType === 'YEARLY') {
      effectiveStartDate = `${endDateIso.slice(0, 4)}-01-01`;
      effectiveEndDate = endDateIso;
    }

    let requestId;
    try {
      const result = db.prepare('INSERT INTO report_requests (requested_by, report_type, start_date, end_date, status, submitted_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.session.user.userId, body.reportType, effectiveStartDate, effectiveEndDate, 'QUEUED', now.toISOString());
      requestId = result.lastInsertRowid;
    } catch (_dbError) {
      throw apiError('SYSTEM_ERROR', errorCatalog.tdqFailure, 503);
    }

    try {
      const submitted = submitJob({
        jobName: 'TRANREPT',
        runMode: 'manual',
        parameters: {
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          reportType: body.reportType,
          requestId
        },
        submittedBy: req.session.user.userId,
        correlationId: `report-request-${requestId}`
      });

      db.prepare('UPDATE report_requests SET status = ?, job_run_id = ? WHERE request_id = ?')
        .run('SUBMITTED', submitted.jobRunId, requestId);

      res.status(202).json({
        requestId,
        jobRunId: submitted.jobRunId,
        status: 'SUBMITTED',
        message: 'Report request submitted to batch runner'
      });
    } catch (error) {
      db.prepare('UPDATE report_requests SET status = ?, error_summary = ?, completed_at = ? WHERE request_id = ?')
        .run('FAILED', error?.message || 'Batch submission failed', new Date().toISOString(), requestId);

      if (error?.code === 'JOB_ALREADY_RUNNING') {
        throw apiError('CONFLICT', error.message, 409, [{ field: 'jobName', message: error.message }]);
      }
      if (error?.statusCode) {
        throw error;
      }
      throw apiError('SYSTEM_ERROR', errorCatalog.tdqFailure, 503);
    }
  } catch (error) {
    next(error);
  }
});

app.get('/api/v1/reports/transactions/requests', requireAuth, (req, res) => {
  const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 20 });
  const orderBy = resolveSort(req.query.sort, {
    submittedAt: 'r.submitted_at',
    requestId: 'r.request_id'
  }, 'r.submitted_at DESC');
  const rows = db.prepare(`
    SELECT
      r.request_id as requestId,
      r.report_type as reportType,
      r.start_date as startDate,
      r.end_date as endDate,
      r.status,
      r.submitted_at as submittedAt,
      r.job_run_id as jobRunId,
      r.completed_at as completedAt,
      r.error_summary as errorSummary,
      jr.status as jobStatus,
      jr.exit_code as jobExitCode,
      jr.error_summary as jobErrorSummary,
      jr.ended_at as jobEndedAt
    FROM report_requests r
    LEFT JOIN job_runs jr ON jr.job_run_id = r.job_run_id
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(pageSize, offset);

  const normalizedRows = rows.map((row) => {
    let status = row.status;
    let completedAt = row.completedAt;
    let errorSummary = row.errorSummary;

    if (row.jobStatus) {
      if (row.jobStatus === 'queued') status = 'QUEUED';
      else if (row.jobStatus === 'running') status = 'RUNNING';
      else if (row.jobStatus === 'succeeded') status = 'COMPLETED';
      else if (row.jobStatus === 'failed') status = 'FAILED';
      else if (row.jobStatus === 'cancelled') status = 'CANCELLED';

      if (row.jobEndedAt) {
        completedAt = row.jobEndedAt;
      }
      if (row.jobErrorSummary) {
        errorSummary = row.jobErrorSummary;
      }
    }

    return {
      requestId: row.requestId,
      reportType: row.reportType,
      startDate: row.startDate,
      endDate: row.endDate,
      status,
      submittedAt: row.submittedAt,
      jobRunId: row.jobRunId,
      completedAt,
      errorSummary,
      jobExitCode: row.jobExitCode
    };
  });

  const updateCompletedStmt = db.prepare('UPDATE report_requests SET status = ?, completed_at = COALESCE(completed_at, ?), error_summary = ? WHERE request_id = ?');
  const updateRunningStmt = db.prepare('UPDATE report_requests SET status = ? WHERE request_id = ?');

  const updateTx = db.transaction(() => {
    for (const row of normalizedRows) {
      if (row.status === 'COMPLETED' || row.status === 'FAILED' || row.status === 'CANCELLED') {
        updateCompletedStmt.run(row.status, row.completedAt || new Date().toISOString(), row.errorSummary || null, row.requestId);
      } else if (row.status === 'QUEUED' || row.status === 'RUNNING') {
        updateRunningStmt.run(row.status, row.requestId);
      }
    }
  });
  updateTx();

  const total = db.prepare('SELECT COUNT(*) as count FROM report_requests').get().count;
  res.json({ items: normalizedRows, page, pageSize, total });
});

function registerBatchRoutes(basePath) {
  app.get(`${basePath}/jobs`, requireRole('A'), (_req, res) => {
    res.json({ items: getJobs() });
  });

  app.get(`${basePath}/jobs/capability-matrix`, requireRole('A'), (req, res) => {
    const previewLimitRaw = Number(req.query.previewChars);
    const previewChars = Number.isFinite(previewLimitRaw)
      ? Math.min(500, Math.max(80, Math.floor(previewLimitRaw)))
      : 160;

    const jobs = getJobs();
    const items = jobs.map((job) => {
      const latestRun = db.prepare(`
        SELECT
          job_run_id as jobRunId,
          status,
          exit_code as exitCode,
          submitted_at as submittedAt,
          ended_at as endedAt
        FROM job_runs
        WHERE job_name = ?
        ORDER BY submitted_at DESC
        LIMIT 1
      `).get(job.jobName);

      if (!latestRun) {
        return {
          jobName: job.jobName,
          classification: 'unknown',
          reason: 'No runs found for this job',
          latestRun: null,
          artifactTypes: [],
          previews: []
        };
      }

      const artifacts = db.prepare(`
        SELECT
          artifact_type as type,
          name,
          storage_kind as storageKind,
          storage_path as storagePath,
          content_inline as contentInline,
          size_bytes as sizeBytes
        FROM artifacts
        WHERE job_run_id = ?
        ORDER BY created_at DESC
      `).all(latestRun.jobRunId);

      const artifactTypes = [...new Set(artifacts.map((artifact) => artifact.type))];
      const reportOrExtractArtifacts = artifacts
        .filter((artifact) => artifact.type === 'report' || artifact.type === 'extract')
        .slice(0, 2);

      const previews = reportOrExtractArtifacts.map((artifact) => {
        let preview = null;
        if (artifact.storageKind === 'inline' && typeof artifact.contentInline === 'string') {
          preview = artifact.contentInline.replace(/\s+/g, ' ').slice(0, previewChars);
        } else if (artifact.storageKind === 'file' && artifact.storagePath && fs.existsSync(artifact.storagePath)) {
          const content = fs.readFileSync(artifact.storagePath, 'utf8');
          preview = content.replace(/\s+/g, ' ').slice(0, previewChars);
        }
        return {
          name: artifact.name,
          type: artifact.type,
          sizeBytes: artifact.sizeBytes,
          preview
        };
      });

      const hasRichArtifacts = artifactTypes.includes('report') || artifactTypes.includes('extract');
      const hasMeaningfulPreview = previews.some((item) => {
        const text = (item.preview || '').toLowerCase();
        return text.length > 20 && !text.includes('simulated') && !text.includes('placeholder');
      });

      let classification = 'mixed';
      let reason = 'Run has partial evidence of real artifacts';
      if (latestRun.status !== 'succeeded') {
        classification = 'needs-attention';
        reason = `Latest run status is ${latestRun.status}`;
      } else if (!hasRichArtifacts) {
        classification = 'simulated/log-only';
        reason = 'No report or extract artifacts detected';
      } else if (hasMeaningfulPreview) {
        classification = 'real-worker';
        reason = 'Report or extract artifacts contain non-placeholder content';
      }

      return {
        jobName: job.jobName,
        classification,
        reason,
        latestRun,
        artifactTypes,
        previews
      };
    });

    const summary = items.reduce((acc, item) => {
      acc[item.classification] = (acc[item.classification] || 0) + 1;
      return acc;
    }, {});

    res.json({
      generatedAt: new Date().toISOString(),
      basedOn: 'latest-run-per-job',
      items,
      summary
    });
  });

  app.post(`${basePath}/jobs/:jobName/submit`, requireRole('A'), (req, res, next) => {
    try {
      const row = db.prepare('SELECT job_name, enabled FROM jobs WHERE job_name = ?').get(req.params.jobName);
      if (!row) {
        throw apiError('NOT_FOUND', 'Unknown batch job', 404, [{ field: 'jobName', message: 'Unknown batch job' }]);
      }
      if (Number(row.enabled) !== 1) {
        throw apiError('VALIDATION_ERROR', 'Batch job is disabled', 400, [{ field: 'jobName', message: 'Batch job is disabled' }]);
      }

      const runMode = req.body?.runMode ? String(req.body.runMode) : 'manual';
      if (!['manual', 'scheduled', 'replay'].includes(runMode)) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'runMode', message: 'runMode must be manual, scheduled, or replay' }]);
      }

      const parameters = req.body?.parameters && typeof req.body.parameters === 'object' ? req.body.parameters : {};
      const dateFields = ['processingDate', 'startDate', 'endDate'];
      for (const field of dateFields) {
        if (parameters[field] !== undefined && parameters[field] !== null) {
          if (!parseStrictIsoDate(String(parameters[field]))) {
            throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: `parameters.${field}`, message: `${field} must be a valid date (YYYY-MM-DD)` }]);
          }
        }
      }

      const result = submitJob({
        jobName: req.params.jobName,
        runMode,
        parameters,
        submittedBy: req.session.user?.userId,
        correlationId: req.correlationId
      });

      if (!result) {
        throw apiError('NOT_FOUND', 'Unknown batch job', 404, [{ field: 'jobName', message: 'Unknown batch job' }]);
      }

      res.status(202).json(result);
    } catch (error) {
      if (error.code === 'JOB_ALREADY_RUNNING') {
        return next(apiError('CONFLICT', error.message, 409, [{ field: 'jobName', message: error.message }]));
      }
      next(error);
    }
  });

  app.get(`${basePath}/job-runs`, requireRole('A'), (req, res) => {
    const { page, pageSize, offset } = listQuery(req, { page: 1, pageSize: 20 });
    const whereParts = [];
    const params = [];

    if (req.query.jobName) {
      whereParts.push('r.job_name = ?');
      params.push(String(req.query.jobName));
    }

    if (req.query.status) {
      whereParts.push('r.status = ?');
      params.push(String(req.query.status));
    }

    const from = req.query.from ? parseStrictIsoDate(String(req.query.from)) : null;
    const to = req.query.to ? parseStrictIsoDate(String(req.query.to)) : null;
    if (from) {
      whereParts.push('DATE(r.submitted_at) >= ?');
      params.push(String(req.query.from));
    }
    if (to) {
      whereParts.push('DATE(r.submitted_at) <= ?');
      params.push(String(req.query.to));
    }

    const hasRetryPolicyRaw = req.query.hasRetryPolicy;
    const hasRetryPolicyFilter = hasRetryPolicyRaw === 'true' ? true : hasRetryPolicyRaw === 'false' ? false : null;
    const minMaxAttemptsRaw = req.query.minMaxAttempts !== undefined ? Number(req.query.minMaxAttempts) : null;
    const minMaxAttempts = Number.isFinite(minMaxAttemptsRaw) && minMaxAttemptsRaw > 0 ? Math.floor(minMaxAttemptsRaw) : null;

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT
        r.job_run_id as jobRunId,
        r.job_name as jobName,
        r.status as status,
        r.submitted_at as submittedAt,
        r.started_at as startedAt,
        r.ended_at as endedAt,
        r.exit_code as exitCode,
        r.submitted_by as submittedBy,
        r.run_mode as runMode,
        r.cancel_requested_at as cancelRequestedAt,
        r.cancel_requested_by as cancelRequestedBy,
        r.cancel_reason as cancelReason,
        j.job_definition_json as jobDefinitionJson
      FROM job_runs r
      LEFT JOIN jobs j ON j.job_name = r.job_name
      ${whereClause}
      ORDER BY r.submitted_at DESC
    `).all(...params);

    const items = rows.map((row) => {
      let retryPolicySummary = 'n/a';
      let retryPolicyDetail = 'No step retry policy found';
      let hasRetryPolicy = false;
      let maxStepAttempts = 1;
      if (row.jobDefinitionJson) {
        try {
          const definition = JSON.parse(row.jobDefinitionJson);
          const steps = Array.isArray(definition.steps) ? definition.steps : [];
          const retryParts = steps.map((step) => {
            const maxAttempts = Number.isFinite(Number(step?.retry?.maxAttempts)) ? Number(step.retry.maxAttempts) : 1;
            const backoffMs = Number.isFinite(Number(step?.retry?.backoffMs)) ? Number(step.retry.backoffMs) : 0;
            if (step?.retry) hasRetryPolicy = true;
            maxStepAttempts = Math.max(maxStepAttempts, maxAttempts);
            return `${step?.name || 'STEP'}: ${maxAttempts}x/${backoffMs}ms`;
          });
          if (retryParts.length > 0) {
            retryPolicySummary = retryParts.join(' | ');
            retryPolicyDetail = retryParts.join('\n');
          }
        } catch (_error) {
          retryPolicySummary = 'invalid policy';
          retryPolicyDetail = 'Unable to parse job retry policy definition';
        }
      }

      return {
        ...row,
        retryPolicySummary,
        retryPolicyDetail,
        hasRetryPolicy,
        maxStepAttempts
      };
    });

    const filteredItems = items.filter((item) => {
      if (hasRetryPolicyFilter !== null && item.hasRetryPolicy !== hasRetryPolicyFilter) {
        return false;
      }
      if (minMaxAttempts !== null && Number(item.maxStepAttempts || 1) < minMaxAttempts) {
        return false;
      }
      return true;
    });

    const pagedItems = filteredItems.slice(offset, offset + pageSize);
    const total = filteredItems.length;

    res.json({ items: pagedItems, page, pageSize, total });
  });

  app.get(`${basePath}/job-runs/:jobRunId`, requireRole('A'), (req, res, next) => {
    const run = db.prepare(`
      SELECT
        job_run_id as jobRunId,
        job_name as jobName,
        status,
        submitted_at as submittedAt,
        started_at as startedAt,
        ended_at as endedAt,
        run_mode as runMode,
        parameters_json as parametersJson,
        exit_code as exitCode,
        error_summary as errorSummary,
        restart_of_job_run_id as restartOfJobRunId,
        cancel_requested_at as cancelRequestedAt,
        cancel_requested_by as cancelRequestedBy,
        cancel_reason as cancelReason
      FROM job_runs
      WHERE job_run_id = ?
    `).get(req.params.jobRunId);

    if (!run) {
      return next(apiError('NOT_FOUND', 'Batch run not found', 404, [{ field: 'jobRunId', message: 'Unknown job run id' }]));
    }

    const steps = db.prepare(`
      SELECT
        step_run_id as stepRunId,
        step_seq as stepSeq,
        step_name as stepName,
        legacy_exec_target as target,
        status,
        return_code as returnCode,
        started_at as startedAt,
        ended_at as endedAt,
        message
      FROM job_run_steps
      WHERE job_run_id = ?
      ORDER BY step_seq ASC
    `).all(req.params.jobRunId);

    const jobDefRow = db.prepare('SELECT job_definition_json as jobDefinitionJson FROM jobs WHERE job_name = ?').get(run.jobName);
    const definitionSteps = jobDefRow?.jobDefinitionJson ? (JSON.parse(jobDefRow.jobDefinitionJson).steps || []) : [];
    const stepsWithRetry = steps.map((step) => {
      const def = definitionSteps[Number(step.stepSeq) - 1] || {};
      const retry = def.retry || {};
      const retryMaxAttempts = Number.isFinite(Number(retry.maxAttempts)) ? Number(retry.maxAttempts) : 1;
      const retryBackoffMs = Number.isFinite(Number(retry.backoffMs)) ? Number(retry.backoffMs) : 0;
      return {
        ...step,
        retryMaxAttempts,
        retryBackoffMs
      };
    });

    res.json({
      ...run,
      parameters: run.parametersJson ? JSON.parse(run.parametersJson) : {},
      steps: stepsWithRetry
    });
  });

  app.post(`${basePath}/job-runs/:jobRunId/restart`, requireRole('A'), (req, res, next) => {
    try {
      const restartMode = req.body?.mode ? String(req.body.mode) : 'resume-from-failed-step';
      if (!['resume-from-failed-step', 'rerun-all'].includes(restartMode)) {
        throw apiError('VALIDATION_ERROR', 'Input validation failed', 400, [{ field: 'mode', message: 'mode must be resume-from-failed-step or rerun-all' }]);
      }

      const result = restartJobRun({
        priorJobRunId: req.params.jobRunId,
        restartMode,
        submittedBy: req.session.user?.userId,
        correlationId: req.correlationId
      });

      if (!result) {
        throw apiError('NOT_FOUND', 'Batch run not found', 404, [{ field: 'jobRunId', message: 'Unknown job run id' }]);
      }

      res.status(202).json({ ...result, restartMode, restartOfJobRunId: req.params.jobRunId });
    } catch (error) {
      if (error.code === 'JOB_ALREADY_RUNNING') {
        return next(apiError('CONFLICT', error.message, 409, [{ field: 'jobName', message: error.message }]));
      }
      if (error.code === 'INVALID_RESTART_STATE') {
        return next(apiError('VALIDATION_ERROR', error.message, 400, [{ field: 'jobRunId', message: error.message }]));
      }
      next(error);
    }
  });

  app.post(`${basePath}/job-runs/:jobRunId/cancel`, requireRole('A'), (req, res, next) => {
    try {
      const reason = req.body?.reason ? String(req.body.reason) : 'Cancelled by user request';
      const result = cancelJobRun({
        jobRunId: req.params.jobRunId,
        requestedBy: req.session.user?.userId,
        reason
      });

      if (!result) {
        throw apiError('NOT_FOUND', 'Batch run not found', 404, [{ field: 'jobRunId', message: 'Unknown job run id' }]);
      }

      res.status(202).json(result);
    } catch (error) {
      if (error.code === 'RUN_COMPLETED') {
        return next(apiError('VALIDATION_ERROR', error.message, 400, [{ field: 'jobRunId', message: error.message }]));
      }
      next(error);
    }
  });

  app.get(`${basePath}/job-runs/:jobRunId/logs`, requireRole('A'), (req, res, next) => {
    const run = db.prepare('SELECT job_run_id FROM job_runs WHERE job_run_id = ?').get(req.params.jobRunId);
    if (!run) {
      return next(apiError('NOT_FOUND', 'Batch run not found', 404, [{ field: 'jobRunId', message: 'Unknown job run id' }]));
    }

    const inlineLog = db.prepare(`
      SELECT content_inline as contentInline
      FROM artifacts
      WHERE job_run_id = ? AND artifact_type = 'log' AND name = 'job.log' AND storage_kind = 'inline'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(req.params.jobRunId);

    if (inlineLog?.contentInline) {
      return res.json({ jobRunId: req.params.jobRunId, combinedLog: inlineLog.contentInline, truncated: false });
    }

    const stepLogs = db.prepare(`
      SELECT step_seq as stepSeq, step_name as stepName, message, return_code as returnCode
      FROM job_run_steps
      WHERE job_run_id = ?
      ORDER BY step_seq ASC
    `).all(req.params.jobRunId);

    const combinedLog = stepLogs
      .map((row) => `STEP ${row.stepSeq} ${row.stepName} RC=${row.returnCode ?? 'N/A'} ${row.message || ''}`)
      .join('\n');

    res.json({ jobRunId: req.params.jobRunId, combinedLog, truncated: false });
  });

  app.get(`${basePath}/job-runs/:jobRunId/artifacts`, requireRole('A'), (req, res, next) => {
    const run = db.prepare('SELECT job_run_id FROM job_runs WHERE job_run_id = ?').get(req.params.jobRunId);
    if (!run) {
      return next(apiError('NOT_FOUND', 'Batch run not found', 404, [{ field: 'jobRunId', message: 'Unknown job run id' }]));
    }

    const items = db.prepare(`
      SELECT
        artifact_id as artifactId,
        name,
        artifact_type as type,
        mime_type as mimeType,
        size_bytes as sizeBytes,
        created_at as createdAt,
        storage_kind as storageKind
      FROM artifacts
      WHERE job_run_id = ?
      ORDER BY created_at DESC
    `).all(req.params.jobRunId);

    res.json({ items });
  });

  app.get(`${basePath}/job-runs/:jobRunId/artifacts/:artifactId`, requireRole('A'), (req, res, next) => {
    const artifact = db.prepare(`
      SELECT *
      FROM artifacts
      WHERE job_run_id = ? AND artifact_id = ?
    `).get(req.params.jobRunId, req.params.artifactId);

    if (!artifact) {
      return next(apiError('NOT_FOUND', 'Artifact not found', 404, [{ field: 'artifactId', message: 'Unknown artifact id' }]));
    }

    res.setHeader('Content-Type', artifact.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);

    if (artifact.storage_kind === 'inline') {
      return res.send(artifact.content_inline || '');
    }

    if (artifact.storage_kind === 'file') {
      if (!artifact.storage_path) {
        return next(apiError('SYSTEM_ERROR', 'Artifact storage path missing', 410, [{ field: 'storagePath', message: 'Artifact file metadata incomplete' }]));
      }
      if (!fs.existsSync(artifact.storage_path)) {
        return next(apiError('SYSTEM_ERROR', 'Artifact file missing', 410, [{ field: 'storagePath', message: 'Artifact file not found on disk' }]));
      }
      return res.sendFile(artifact.storage_path);
    }

    return next(apiError('SYSTEM_ERROR', 'Unsupported artifact storage type', 500));
  });
}

registerBatchRoutes('/api');
registerBatchRoutes('/api/v1');

app.use((error, req, res, _next) => {
  const status = error.status || 500;
  req.log.error({ err: error, correlationId: req.correlationId }, 'Request failed');
  res.status(status).json(errorResponse(error, req.correlationId));
});

module.exports = { app };
