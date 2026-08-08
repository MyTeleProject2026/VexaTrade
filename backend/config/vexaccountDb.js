/**
 * backend/config/vexaccountDb.js
 *
 * Database connection template supporting MongoDB, PostgreSQL, and MySQL.
 * - Select DB with environment variable DB_TYPE: 'mongodb' | 'postgres' | 'mysql'
 * - Provide connection details via common env vars (see below).
 *
 * Usage:
 *   const db = require('../config/vexaccountDb');
 *   await db.connect();
 *   const client = db.getClient();
 *   // use client depending on DB_TYPE (mongoose instance, pg Pool, or mysql2 pool)
 *
 * Environment variables (examples):
 *   DB_TYPE=mongodb
 *   MONGODB_URI=mongodb://user:pass@host:27017/vexadb
 *
 *   DB_TYPE=postgres
 *   DATABASE_URL=postgresql://user:pass@host:5432/vexadb
 *
 *   DB_TYPE=mysql
 *   DB_HOST=localhost
 *   DB_USER=root
 *   DB_PASS=
 *   DB_NAME=vexadb
 *   DB_PORT=3306
 */

const dotenv = require('dotenv');
dotenv.config();

const DB_TYPE = (process.env.DB_TYPE || 'mongodb').toLowerCase();
let client = null;

async function connect() {
  if (client) return client;

  if (DB_TYPE === 'mongodb') {
    // MongoDB via mongoose
    const mongoose = require('mongoose');
    const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/vexadb';
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    await mongoose.connect(uri, opts);
    client = mongoose;
    return client;
  }

  if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql') {
    // PostgreSQL via pg Pool
    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION || 'postgresql://postgres:postgres@localhost:5432/vexadb';
    const pool = new Pool({ connectionString });
    // quick connectivity check
    await pool.query('SELECT 1');
    client = pool;
    return client;
  }

  if (DB_TYPE === 'mysql') {
    // MySQL via mysql2/promise
    const mysql = require('mysql2/promise');
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'vexadb',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
    const pool = mysql.createPool(config);
    // quick connectivity check
    await pool.query('SELECT 1');
    client = pool;
    return client;
  }

  throw new Error(`Unsupported DB_TYPE: ${DB_TYPE}. Supported types: mongodb, postgres, mysql`);
}

function getClient() {
  if (!client) throw new Error('Database not connected. Call connect() first.');
  return client;
}

async function disconnect() {
  if (!client) return;
  try {
    if (DB_TYPE === 'mongodb') {
      await client.disconnect();
    } else if (DB_TYPE === 'postgres' || DB_TYPE === 'postgresql') {
      await client.end();
    } else if (DB_TYPE === 'mysql') {
      await client.end();
    }
  } finally {
    client = null;
  }
}

module.exports = {
  connect,
  getClient,
  disconnect,
  DB_TYPE,
};
