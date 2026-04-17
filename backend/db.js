const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "cryptopulse_v3",
  ssl: {
    rejectUnauthorized: false  // Simplified for TiDB Cloud
  },
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log("✅ TiDB Cloud connected successfully");
  } catch (error) {
    console.error("❌ TiDB Cloud connection failed:", error.message);
  }
}

testConnection();

module.exports = pool;