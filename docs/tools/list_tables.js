const Database = require('better-sqlite3');
const db = new Database('backend/data/database.sqlite');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));
