const Database = require('better-sqlite3');
const db = new Database('backend/data/database.sqlite');

const customer = db.prepare('SELECT * FROM customers WHERE cust_id = 1').get();
console.log(customer);
