const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'carddemo.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Merchant data for realistic transactions
const merchants = [
  { name: 'WHOLE FOODS MARKET', city: 'AUSTIN', state: 'TX', zip: '78701', category: '5411', type: 'PURCH' },
  { name: 'SHELL GAS STATION', city: 'DALLAS', state: 'TX', zip: '75201', category: '5541', type: 'PURCH' },
  { name: 'AMAZON.COM', city: 'SEATTLE', state: 'WA', zip: '98109', category: '5999', type: 'PURCH' },
  { name: 'STARBUCKS COFFEE', city: 'AUSTIN', state: 'TX', zip: '78702', category: '5814', type: 'PURCH' },
  { name: 'HOME DEPOT', city: 'HOUSTON', state: 'TX', zip: '77002', category: '5211', type: 'PURCH' },
  { name: 'WALMART SUPERCENTER', city: 'SAN ANTONIO', state: 'TX', zip: '78201', category: '5411', type: 'PURCH' },
  { name: 'TARGET STORE', city: 'AUSTIN', state: 'TX', zip: '78703', category: '5310', type: 'PURCH' },
  { name: 'CHIPOTLE MEXICAN GRILL', city: 'AUSTIN', state: 'TX', zip: '78704', category: '5812', type: 'PURCH' },
  { name: 'CVS PHARMACY', city: 'DALLAS', state: 'TX', zip: '75202', category: '5912', type: 'PURCH' },
  { name: 'UBER TRIP', city: 'AUSTIN', state: 'TX', zip: '78701', category: '4121', type: 'PURCH' },
  { name: 'NETFLIX SUBSCRIPTION', city: 'LOS GATOS', state: 'CA', zip: '95032', category: '4899', type: 'PURCH' },
  { name: 'BEST BUY', city: 'HOUSTON', state: 'TX', zip: '77003', category: '5732', type: 'PURCH' },
  { name: 'HOTEL MARRIOTT', city: 'DALLAS', state: 'TX', zip: '75203', category: '7011', type: 'PURCH' },
  { name: 'DELTA AIRLINES', city: 'ATLANTA', state: 'GA', zip: '30320', category: '4511', type: 'PURCH' },
  { name: 'APPLE STORE', city: 'AUSTIN', state: 'TX', zip: '78705', category: '5732', type: 'PURCH' },
  { name: 'ATM CASH WITHDRAWAL', city: 'AUSTIN', state: 'TX', zip: '78701', category: '6011', type: 'CASH' },
  { name: 'EXXON MOBIL', city: 'HOUSTON', state: 'TX', zip: '77004', category: '5541', type: 'PURCH' },
  { name: 'LOWES HOME IMPROVEMENT', city: 'DALLAS', state: 'TX', zip: '75204', category: '5211', type: 'PURCH' },
  { name: 'PETSMART', city: 'AUSTIN', state: 'TX', zip: '78706', category: '5995', type: 'PURCH' },
  { name: 'KOHLS DEPARTMENT STORE', city: 'SAN ANTONIO', state: 'TX', zip: '78202', category: '5311', type: 'PURCH' }
];

// Response codes: 00=Approved, 51=Insufficient Funds, 54=Expired Card, 05=Do Not Honor
const responseCodes = ['00', '00', '00', '00', '00', '00', '51', '54', '05'];

function generateRandomAmount(max = 500) {
  return Math.round((Math.random() * max + 5) * 100) / 100;
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}${minutes}${seconds}`;
}

function generateAuthorizations() {
  console.log('Fetching cards and accounts...');
  
  // Get active cards with their account info
  const cardsWithAccounts = db.prepare(`
    SELECT 
      c.card_num,
      c.acct_id,
      c.embossed_name,
      c.expiration_date,
      a.credit_limit,
      a.cash_credit_limit,
      a.curr_bal,
      a.addr_zip
    FROM cards c
    JOIN accounts a ON c.acct_id = a.acct_id
    WHERE c.active_status = 'Y'
    LIMIT 15
  `).all();

  console.log(`Found ${cardsWithAccounts.length} active cards`);

  // Clear existing authorization data (except the original seed)
  console.log('Clearing existing authorization details (keeping seed data)...');
  db.prepare(`DELETE FROM authorization_details WHERE auth_id NOT LIKE 'AUTH%001' AND auth_id NOT LIKE 'AUTH%002' AND auth_id NOT LIKE 'AUTH%003'`).run();
  
  // First, create or update authorization_summary for each account
  console.log('Creating authorization summary records...');
  const summaryInsert = db.prepare(`
    INSERT OR REPLACE INTO authorization_summary (
      acct_id, cust_id, auth_status, credit_limit, cash_limit,
      credit_balance, cash_balance, approved_auth_count, declined_auth_count,
      approved_auth_amount, declined_auth_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
  `);

  // Get customer IDs for each account
  const accountCustomers = db.prepare(`
    SELECT DISTINCT cx.acct_id, cx.cust_id
    FROM card_xref cx
    WHERE cx.acct_id IN (${cardsWithAccounts.map(() => '?').join(',')})
  `).all(...cardsWithAccounts.map(c => c.acct_id));

  const accountCustomerMap = {};
  accountCustomers.forEach(ac => {
    accountCustomerMap[ac.acct_id] = ac.cust_id;
  });

  cardsWithAccounts.forEach(card => {
    const custId = accountCustomerMap[card.acct_id];
    if (custId) {
      summaryInsert.run(
        card.acct_id,
        custId,
        'Y',
        card.credit_limit,
        card.cash_credit_limit,
        card.curr_bal,
        0
      );
    }
  });

  console.log('Authorization summary records created');
  
  const authInsert = db.prepare(`
    INSERT INTO authorization_details (
      auth_id, acct_id, auth_date, auth_time, auth_orig_date, auth_orig_time,
      card_num, auth_type, card_expiry_date, message_type, message_source,
      auth_id_code, auth_resp_code, auth_resp_reason, processing_code,
      transaction_amt, approved_amt, merchant_category_code, acqr_country_code,
      pos_entry_mode, merchant_id, merchant_name, merchant_city, merchant_state,
      merchant_zip, transaction_id, match_status, auth_fraud, fraud_rpt_date, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let authCount = 0;
  const now = Date.now();

  // Generate 3-5 authorizations per card
  cardsWithAccounts.forEach((cardData, cardIndex) => {
    const numAuths = Math.floor(Math.random() * 3) + 3; // 3-5 authorizations
    
    for (let i = 0; i < numAuths; i++) {
      const daysAgo = Math.floor(Math.random() * 7); // Within last week
      const authDate = getDateDaysAgo(daysAgo);
      const authDateStr = formatDate(authDate);
      const authTimeStr = formatTime(authDate);
      
      const merchant = merchants[Math.floor(Math.random() * merchants.length)];
      const amount = merchant.type === 'CASH' 
        ? generateRandomAmount(cardData.cash_credit_limit * 0.5)
        : generateRandomAmount(cardData.credit_limit * 0.3);
      
      const respCode = responseCodes[Math.floor(Math.random() * responseCodes.length)];
      const isApproved = respCode === '00';
      
      let respReason = null;
      let matchStatus = 'P'; // Pending by default
      
      if (!isApproved) {
        matchStatus = 'D'; // Declined
        if (respCode === '51') respReason = 'INSF';
        else if (respCode === '54') respReason = 'EXPR';
        else if (respCode === '05') respReason = 'DENY';
      } else {
        // Some approved auths are matched (M) or in error (E)
        const statusRand = Math.random();
        if (statusRand > 0.7) matchStatus = 'M'; // 30% matched
        else if (statusRand < 0.05) matchStatus = 'E'; // 5% error
      }
      
      const authId = `AUTH${now + authCount}${String(cardIndex + 1).padStart(3, '0')}${String(i + 1).padStart(2, '0')}`;
      const merchantId = `MER${100000 + Math.floor(Math.random() * 900000)}`;
      const txnId = `TXN${now + authCount}${String(cardIndex + 1).padStart(3, '0')}${String(i + 1).padStart(2, '0')}`;
      
      const expiryDate = cardData.expiration_date.substring(0, 7); // YYYY-MM format
      
      authInsert.run(
        authId,
        cardData.acct_id,
        authDateStr,
        authTimeStr,
        authDateStr,
        authTimeStr,
        cardData.card_num,
        merchant.type,
        expiryDate,
        'REQAUT',
        'POS',
        `AUTH${String(authCount).padStart(6, '0')}`,
        respCode,
        respReason,
        merchant.type === 'CASH' ? '010000' : '001000',
        amount,
        isApproved ? amount : 0,
        merchant.category,
        'USA',
        '051',
        merchantId,
        merchant.name,
        merchant.city,
        merchant.state,
        merchant.zip,
        txnId,
        matchStatus,
        '',
        null,
        authDate.toISOString()
      );
      
      authCount++;
    }
  });

  console.log(`Generated ${authCount} authorization records`);

  // Update authorization_summary for each account
  console.log('Updating authorization summary...');
  
  const summaryUpdate = db.prepare(`
    INSERT OR REPLACE INTO authorization_summary (
      acct_id, cust_id, auth_status, credit_limit, cash_limit,
      credit_balance, cash_balance, approved_auth_count, declined_auth_count,
      approved_auth_amount, declined_auth_amount
    )
    SELECT 
      a.acct_id,
      cx.cust_id,
      a.active_status,
      a.credit_limit,
      a.cash_credit_limit,
      a.curr_bal,
      0 as cash_balance,
      COALESCE(SUM(CASE WHEN ad.auth_resp_code = '00' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ad.auth_resp_code != '00' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ad.auth_resp_code = '00' THEN ad.approved_amt ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN ad.auth_resp_code != '00' THEN ad.transaction_amt ELSE 0 END), 0)
    FROM accounts a
    LEFT JOIN authorization_details ad ON a.acct_id = ad.acct_id
    LEFT JOIN card_xref cx ON a.acct_id = cx.acct_id
    WHERE a.acct_id IN (SELECT DISTINCT acct_id FROM authorization_details)
    GROUP BY a.acct_id
  `);
  
  summaryUpdate.run();
  
  console.log('Authorization summary updated');
  console.log('\nSummary:');
  
  const summary = db.prepare(`
    SELECT 
      COUNT(DISTINCT acct_id) as accounts_with_auths,
      COUNT(*) as total_auths,
      SUM(CASE WHEN auth_resp_code = '00' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN auth_resp_code != '00' THEN 1 ELSE 0 END) as declined,
      SUM(CASE WHEN match_status = 'P' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN match_status = 'M' THEN 1 ELSE 0 END) as matched,
      SUM(CASE WHEN match_status = 'D' THEN 1 ELSE 0 END) as declined_status,
      SUM(CASE WHEN match_status = 'E' THEN 1 ELSE 0 END) as error
    FROM authorization_details
  `).get();
  
  console.log(`  Accounts with authorizations: ${summary.accounts_with_auths}`);
  console.log(`  Total authorizations: ${summary.total_auths}`);
  console.log(`  Approved: ${summary.approved}`);
  console.log(`  Declined: ${summary.declined}`);
  console.log(`  Status - Pending: ${summary.pending}, Matched: ${summary.matched}, Declined: ${summary.declined_status}, Error: ${summary.error}`);
  
  db.close();
  console.log('\nDone!');
}

generateAuthorizations();
