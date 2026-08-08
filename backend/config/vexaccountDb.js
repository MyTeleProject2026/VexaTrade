// backend/config/vexaccountDb.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// This should point to the VexaAccount/VexaStore database
const vexaccountPool = mysql.createPool({
  host: process.env.DB_HOST, // same host as VexaStore
  user: process.env.DB_USER, // same user
  password: process.env.DB_PASSWORD,
  database: process.env.VEXA_ACCOUNT_DB_NAME || process.env.DB_NAME || 'vexastore', // ← important: set this to your VexaAccount database name
  port: 4000,
  waitForConnections: true,
  connectionLimit: 5, // small pool, only used for sync
  queueLimit: 0,
  charset: 'utf8mb4',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }
});

async function testVexaAccountConnection() {
  try {
    const connection = await vexaccountPool.getConnection();
    console.log('✅ VexaAccount DB connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ VexaAccount DB connection failed:', error.message);
    return false;
  }
}

module.exports = { vexaccountPool, testVexaAccountConnection };
