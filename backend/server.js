require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');
const crypto = require('crypto');

const fromName = process.env.MAIL_FROM_NAME || "CryptoPulse";

const app = express();

/* =========================
   FILE UPLOAD CONFIG
========================= */

[
  "uploads",
  "uploads/deposits",
  "uploads/qrcodes",
  "uploads/kyc",
  "uploads/profiles",
  "uploads/legal",
  "uploads/qr_codes",
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: function (_req, file, cb) {
    if (file.fieldname === "receipt") {
      cb(null, "uploads/deposits");
    } else if (file.fieldname === "qr") {
      cb(null, "uploads/qrcodes");
    } else if (file.fieldname === "front" || file.fieldname === "back") {
      cb(null, "uploads/kyc");
    } else if (file.fieldname === "profile_picture") {
      cb(null, "uploads/profiles");
    } else if (file.fieldname === "legal_file") {
      cb(null, "uploads/legal");
    } else if (file.fieldname === "user_qr") {
      cb(null, "uploads/qr_codes");
    } else {
      cb(null, "uploads");
    }
  },
  filename: function (_req, file, cb) {
    cb(
      null,
      `${Date.now()}-${String(file.originalname || "file").replace(/\s+/g, "-")}`
    );
  },
});

const upload = multer({ storage });

/* =========================
   APP CONFIG
========================= */
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.FRONTEND_USER_URL,
  process.env.FRONTEND_ADMIN_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
 
  // ✅ ADD YOUR CUSTOM DOMAINS:
  "https://www.vexatrade-v.2bd.net",
  "https://vexatrade-v.2bd.net",
  "https://admin.vexatrade-v.2bd.net",
  // ✅ ADD THIS - Your frontend's Render URL:
  "https://vexatrade.onrender.com"     // <-- THIS IS WHAT'S MISSING!
].filter(Boolean);


const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("Blocked by CORS:", origin);
    return callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "cryptopulse_secret_key";
const DB_NAME = process.env.DB_NAME;

const BINANCE_PRICE_API = "https://api.binance.com/api/v3/ticker/price";
const BINANCE_24H_API = "https://api.binance.com/api/v3/ticker/24hr";
const BYBIT_TICKERS_API = "https://api.bybit.com/v5/market/tickers?category=spot";
const KUCOIN_ALL_TICKERS_API = "https://api.kucoin.com/api/v1/market/allTickers";

/* =========================
   KEPLERS MAIL SERVICE
========================= */

function getMailTransporter() {
  // Priority: Keplers SMTP if configured, fallback to Gmail
  if (process.env.KEPLERS_SMTP_HOST && process.env.KEPLERS_EMAIL && process.env.KEPLERS_PASSWORD) {
    return nodemailer.createTransport({
      host: process.env.KEPLERS_SMTP_HOST,
      port: parseInt(process.env.KEPLERS_SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.KEPLERS_EMAIL,
        pass: process.env.KEPLERS_PASSWORD,
      },
    });
  }
  
  // Fallback to Gmail
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
      },
    });
  }
  
  console.error("❌ No mail service configured. Please set KEPLERS_* or GMAIL_* environment variables.");
  return null;
}

async function sendEmail({ to, subject, html }) {
  const transporter = getMailTransporter();
  
  if (!transporter) {
    console.error(`❌ Mail service not configured. Cannot send email to ${to}.`);
    return false;
  }

  const fromName = process.env.MAIL_FROM_NAME || "CryptoPulse";
  const fromEmail = process.env.KEPLERS_EMAIL || process.env.GMAIL_USER;

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return false;
  }
}

async function sendOtpEmail({ to, code }) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">VexaTrade Verification</h2>
      <p style="margin:0 0 16px;">Your 6-digit verification code is:</p>
      <div style="font-size:32px; font-weight:700; letter-spacing:8px; color:#a3e635; margin:16px 0;">
        ${code}
      </div>
      <p style="margin:16px 0 0; color:#cbd5e1;">This code expires in 10 minutes.</p>
    </div>
  `;
  
  return sendEmail({ to, subject: 'VexaTrade Email Verification Code', html });
}

async function sendPasswordResetEmail({ to, resetLink }) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0b0b; color: #ffffff;">
      <h2 style="margin:0 0 16px;">Reset Your Password</h2>
      <p style="margin:0 0 16px;">Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background: #a3e635; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 12px; font-weight: bold; margin: 16px 0;">
        Reset Password
      </a>
      <p style="margin:16px 0 0; color:#cbd5e1;">If you didn't request this, please ignore this email.</p>
    </div>
  `;
  
  return sendEmail({ to, subject: 'VexaTrade Password Reset', html });
}

/* =========================
   HELPERS
========================= */

function createError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function generateUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: "user",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function generateAdminToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: "admin",
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function normalizeTradingFeeTier(value) {
  const allowed = [
    "Regular user",
    "VIP 1",
    "VIP 2",
    "VIP 3",
    "Market Maker",
    "Institutional",
  ];

  const input = String(value || "").trim();
  return allowed.includes(input) ? input : "Regular user";
}

function normalizeUserStatus(value) {
  const allowed = ["pending", "under_review", "active", "disabled", "frozen"];
  const input = String(value || "").trim().toLowerCase();
  return allowed.includes(input) ? input : "pending";
}

function getAuthToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice(7).trim();
}

function authenticateUser(req, res, next) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "User token missing" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "user") {
      return res
        .status(403)
        .json({ success: false, message: "Invalid user token" });
    }

    req.user = decoded;
    next();
  } catch (_error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired user token" });
  }
}

function authenticateAdmin(req, res, next) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Admin token missing" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Invalid admin token" });
    }

    req.admin = decoded;
    next();
  } catch (_error) {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired admin token" });
  }
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function splitSymbol(symbol) {
  const upper = String(symbol || "").toUpperCase().trim();

  const knownQuotes = [
    "USDT",
    "USDC",
    "BTC",
    "ETH",
    "BNB",
    "BUSD",
    "EUR",
    "TRY",
    "FDUSD",
  ];

  for (const quote of knownQuotes) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return {
        base: upper.slice(0, upper.length - quote.length),
        quote,
      };
    }
  }

  return {
    base: upper,
    quote: "",
  };
}

function formatMarketRow(row) {
  return {
    symbol: String(row.symbol || "").toUpperCase(),
    price: toNumber(row.lastPrice || row.price || 0),
    lastPrice: toNumber(row.lastPrice || row.price || 0),
    highPrice: toNumber(row.highPrice || 0),
    lowPrice: toNumber(row.lowPrice || 0),
    volume: toNumber(row.volume || 0),
    priceChangePercent: toNumber(row.priceChangePercent || 0),
  };
}

function buildEmptyMarketRow(symbol) {
  return {
    symbol,
    price: 0,
    lastPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    volume: 0,
    priceChangePercent: 0,
  };
}

function normalizeLegalStatus(status) {
  return String(status || "active").trim().toLowerCase() === "inactive"
    ? "inactive"
    : "active";
}

function normalizeNewsActive(value) {
  return Number(value) === 0 ? 0 : 1;
}

function getLegalFileUrl(file) {
  if (!file) return null;
  return `/uploads/legal/${file.filename}`;
}

function getSupportedConvertCoins() {
  return ["USDT", "BTC", "ETH", "BNB", "SOL", "XRP"];
}

function removeUploadedFile(fileUrl) {
  try {
    if (!fileUrl) return;

    const cleanPath = String(fileUrl).replace(/^\/+/, "");
    const fullPath = path.join(__dirname, cleanPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error("Failed to remove uploaded file:", error.message);
  }
}

function generateSixDigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isOtpExpired(expiresAt) {
  if (!expiresAt) return true;
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) || date.getTime() < Date.now();
}

function randomRate(min, max) {
  const minNum = toNumber(min);
  const maxNum = toNumber(max);

  if (maxNum <= minNum) return Number(minNum.toFixed(4));

  return Number((Math.random() * (maxNum - minNum) + minNum).toFixed(4));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

async function getBinancePrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();

  // Try multiple endpoints
  const endpoints = [
    "https://api.binance.us/api/v3/ticker/price",   // US endpoint
    "https://data.binance.com/api/v3/ticker/price", // CDN endpoint
    BINANCE_PRICE_API                                // Original endpoint
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(endpoint, {
        params: { symbol: upperSymbol },
        timeout: 10000,
      });
      const price = response.data?.price;
      if (price && Number(price) > 0) {
        return toNumber(price);
      }
    } catch (error) {
      continue; // Try next endpoint
    }
  }

  // Fallback to Bybit
  try {
    const bybitPrice = await getBybitPrice(upperSymbol);
    if (bybitPrice > 0) return bybitPrice;
  } catch (_error) {}

  // Fallback to KuCoin
  try {
    const kucoinPrice = await getKucoinPrice(upperSymbol);
    if (kucoinPrice > 0) return kucoinPrice;
  } catch (_error) {}

  return 0;
}

async function getBybitPrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();

  const response = await axios.get(BYBIT_TICKERS_API, { timeout: 10000 });
  const list = response.data?.result?.list || [];
  const row = list.find(
    (item) => String(item.symbol || "").toUpperCase() === upperSymbol
  );

  return toNumber(row?.lastPrice || 0);
}

async function getKucoinPrice(symbol) {
  const upperSymbol = String(symbol || "").toUpperCase().trim();
  const { base, quote } = splitSymbol(upperSymbol);

  if (!base || !quote) return 0;

  const response = await axios.get(KUCOIN_ALL_TICKERS_API, { timeout: 10000 });
  const list = response.data?.data?.ticker || [];
  const kucoinSymbol = `${base}-${quote}`;
  const row = list.find(
    (item) => String(item.symbol || "").toUpperCase() === kucoinSymbol
  );

  return toNumber(row?.last || 0);
}

async function getBinanceHomeMarkets(symbols) {
  const safeSymbols = Array.isArray(symbols)
    ? symbols
        .map((item) => String(item || "").toUpperCase().trim())
        .filter(Boolean)
    : [];

  // Try multiple Binance endpoints (US-friendly first)
  const binanceEndpoints = [
    "https://api.binance.us/api/v3/ticker/24hr",   // US endpoint (works in US)
    "https://data.binance.com/api/v3/ticker/24hr", // CDN endpoint
    BINANCE_24H_API                                 // Original endpoint
  ];
  
  let response = null;
  for (const endpoint of binanceEndpoints) {
    try {
      response = await axios.get(endpoint, { timeout: 10000 });
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log(`✅ Binance market data fetched from: ${endpoint}`);
        break;
      }
    } catch (error) {
      console.log(`Binance endpoint failed: ${endpoint} - ${error.message}`);
      continue;
    }
  }
  
  if (response?.data && Array.isArray(response.data)) {
    const rows = response.data;
    const map = new Map(
      rows.map((row) => [String(row.symbol || "").toUpperCase(), row])
    );

    const result = safeSymbols
      .map((symbol) => map.get(symbol))
      .filter(Boolean)
      .map(formatMarketRow);

    if (result.length) return result;
  }

  // Fallback to Bybit
  try {
    const response = await axios.get(BYBIT_TICKERS_API, { timeout: 10000 });
    const list = response.data?.result?.list || [];
    const map = new Map(
      list.map((row) => [String(row.symbol || "").toUpperCase(), row])
    );

    const result = safeSymbols.map((symbol) => {
      const row = map.get(symbol);

      if (!row) return buildEmptyMarketRow(symbol);

      return {
        symbol,
        price: toNumber(row.lastPrice || 0),
        lastPrice: toNumber(row.lastPrice || 0),
        highPrice: toNumber(row.highPrice24h || 0),
        lowPrice: toNumber(row.lowPrice24h || 0),
        volume: toNumber(row.volume24h || 0),
        priceChangePercent: toNumber(row.price24hPcnt || 0) * 100,
      };
    });

    if (result.some((item) => item.lastPrice > 0)) return result;
    throw new Error("Bybit returned empty market rows");
  } catch (error) {
    console.error("Bybit market list fetch failed:", error.message);
  }

  // Fallback to KuCoin
  try {
    const response = await axios.get(KUCOIN_ALL_TICKERS_API, { timeout: 10000 });
    const list = response.data?.data?.ticker || [];
    const map = new Map(
      list.map((row) => [String(row.symbol || "").toUpperCase(), row])
    );

    const result = safeSymbols.map((symbol) => {
      const { base, quote } = splitSymbol(symbol);
      const kucoinSymbol = `${base}-${quote}`;
      const row = map.get(kucoinSymbol);

      if (!row) return buildEmptyMarketRow(symbol);

      return {
        symbol,
        price: toNumber(row.last || 0),
        lastPrice: toNumber(row.last || 0),
        highPrice: toNumber(row.high || 0),
        lowPrice: toNumber(row.low || 0),
        volume: toNumber(row.vol || 0),
        priceChangePercent: toNumber(row.changeRate || 0) * 100,
      };
    });

    if (result.some((item) => item.lastPrice > 0)) return result;
    throw new Error("KuCoin returned empty market rows");
  } catch (error) {
    console.error("KuCoin market list fetch failed:", error.message);
  }

  // Final fallback: fetch each symbol individually
  const result = [];
  for (const symbol of safeSymbols) {
    try {
      const price = await getBinancePrice(symbol);
      result.push({
        symbol,
        price,
        lastPrice: price,
        highPrice: 0,
        lowPrice: 0,
        volume: 0,
        priceChangePercent: 0,
      });
    } catch (_error) {
      result.push(buildEmptyMarketRow(symbol));
    }
  }

  return result;
}

async function ensureUserExists(connection, userId) {
  const [rows] = await connection.execute(
    "SELECT id, uid, name, first_name, last_name, email, balance, status, kyc_status, email_verified FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  if (!rows.length) throw createError(404, "User not found");
  return rows[0];
}

async function getNextOutcomeQueueItem(
  connection,
  { pair, direction, timerSeconds }
) {
  const [rows] = await connection.execute(
    `SELECT *
     FROM trade_outcome_queue
     WHERE pair = ?
       AND direction = ?
       AND timer_seconds = ?
       AND is_active = 1
       AND is_used = 0
     ORDER BY id ASC
     LIMIT 1
     FOR UPDATE`,
    [pair, direction, timerSeconds]
  );

  return rows[0] || null;
}

async function getTradeRuleByTimer(connection, timerSeconds) {
  const [rows] = await connection.execute(
    `SELECT id, timer_seconds, payout_percent, status
     FROM trade_rules
     WHERE timer_seconds = ?
       AND status = 'active'
     LIMIT 1`,
    [timerSeconds]
  );

  return rows[0] || null;
}

async function getSupportSettings() {
  try {
    const [rows] = await pool.execute(
      `SELECT id, channel, contact, link, note, updated_at
       FROM support_settings
       ORDER BY id ASC
       LIMIT 1`
    );

    return rows[0] || {
      channel: "Customer Service",
      contact: "Support not configured yet",
      link: "",
      note: "",
    };
  } catch (_error) {
    return {
      channel: "Customer Service",
      contact: "Support not configured yet",
      link: "",
      note: "",
    };
  }
}

async function getWithdrawalFeeConfig(connection, coin, network) {
  try {
    const [rows] = await connection.execute(
      `SELECT coin, network, fee_amount, fee_type, status
       FROM withdrawal_fees
       WHERE coin = ?
         AND network = ?
         AND status = 'active'
       LIMIT 1`,
      [String(coin || "").toUpperCase(), String(network || "").toUpperCase()]
    );

    if (!rows.length) {
      return {
        coin: String(coin || "").toUpperCase(),
        network: String(network || "").toUpperCase(),
        fee_amount: 0,
        fee_type: "fixed",
        status: "inactive",
      };
    }

    return rows[0];
  } catch (_error) {
    return {
      coin: String(coin || "").toUpperCase(),
      network: String(network || "").toUpperCase(),
      fee_amount: 0,
      fee_type: "fixed",
      status: "inactive",
    };
  }
}

function calculateWithdrawalFee(amount, feeConfig) {
  const requestAmount = Number(amount || 0);
  const feeAmount = Number(feeConfig?.fee_amount || 0);
  const feeType = String(feeConfig?.fee_type || "fixed").toLowerCase();

  if (!Number.isFinite(requestAmount) || requestAmount <= 0) return 0;
  if (!Number.isFinite(feeAmount) || feeAmount <= 0) return 0;

  if (feeType === "percent") {
    return Number(((requestAmount * feeAmount) / 100).toFixed(8));
  }

  return Number(feeAmount.toFixed(8));
}

async function createTransactionLog(connection, payload) {
  const {
    userId,
    type,
    amount,
    status = "completed",
    note = null,
    referenceId = null,
  } = payload;

  try {
    await connection.execute(
      `INSERT INTO transactions
       (user_id, type, amount, status, reference_id, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, type, amount, status, referenceId, note]
    );
    return;
  } catch (_error) {}

  try {
    await connection.execute(
      `INSERT INTO transactions
       (user_id, type, amount, status, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, type, amount, status, note]
    );
    return;
  } catch (_error) {}

  try {
    await connection.execute(
      `INSERT INTO transactions
       (user_id, type, amount, note, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, type, amount, note]
    );
  } catch (_error) {}
}

async function createUserNotification(connection, payload) {
  const { userId, title, message, type = "general" } = payload;

  await connection.execute(
    `INSERT INTO user_notifications
     (user_id, title, message, type, is_read, created_at)
     VALUES (?, ?, ?, ?, 0, NOW())`,
    [userId, title, message, type]
  );
}

async function createAuditLog(connection, payload) {
  const {
    adminId,
    action,
    targetUserId = null,
    referenceId = null,
    note = null,
  } = payload;

  try {
    await connection.execute(
      `INSERT INTO admin_audit_logs
       (admin_id, action, target_user_id, reference_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [adminId, action, targetUserId, referenceId, note]
    );
  } catch (_error) {}
}

async function settleExpiredTrades() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM trades
       WHERE status = 'open'
         AND end_time <= NOW()
         AND assigned_result IS NOT NULL
       ORDER BY id ASC
       LIMIT 100
       FOR UPDATE`
    );

    for (const trade of rows) {
      const result = String(trade.assigned_result || "").toLowerCase();
      if (!["win", "loss"].includes(result)) continue;

      let exitPrice = Number(trade.entry_price || 0);
      try {
        exitPrice = await getBinancePrice(trade.pair);
      } catch (_error) {}

      const amount = Number(trade.amount || 0);
      const payoutPercent = Number(trade.payout_percent || 0);

      let profit = 0;

      if (result === "win") {
        profit = Number((amount * (payoutPercent / 100)).toFixed(2));
        const creditAmount = Number((amount + profit).toFixed(2));

        await connection.execute(
          `UPDATE users
           SET balance = balance + ?
           WHERE id = ?`,
          [creditAmount, trade.user_id]
        );

        await createTransactionLog(connection, {
          userId: trade.user_id,
          type: "trade_win",
          amount: creditAmount,
          status: "completed",
          referenceId: trade.id,
          note: `${trade.pair} ${trade.direction} trade settled as win`,
        });
      } else {
        profit = Number((-amount).toFixed(2));

        await createTransactionLog(connection, {
          userId: trade.user_id,
          type: "trade_loss",
          amount,
          status: "completed",
          referenceId: trade.id,
          note: `${trade.pair} ${trade.direction} trade settled as loss`,
        });
      }

      try {
        await connection.execute(
          `UPDATE trades
           SET status = ?, result = ?, close_price = ?, exit_price = ?, profit = ?, settled_at = NOW()
           WHERE id = ?`,
          [result, result, exitPrice, exitPrice, profit, trade.id]
        );
      } catch (_error) {
        await connection.execute(
          `UPDATE trades
           SET status = ?, result = ?, exit_price = ?, profit = ?, settled_at = NOW()
           WHERE id = ?`,
          [result, result, exitPrice, profit, trade.id]
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    console.error("settleExpiredTrades error:", error.message);
  } finally {
    connection.release();
  }
}

async function settleDailyFunds() {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [activeFunds] = await connection.execute(
      `
      SELECT
        uf.id,
        uf.user_id,
        uf.plan_id,
        uf.amount,
        uf.locked_principal,
        uf.selected_daily_profit_percent,
        uf.total_days,
        uf.current_day,
        uf.earned_profit,
        uf.status,
        uf.started_at,
        uf.ends_at,
        uf.last_profit_at,
        uf.completed_at,
        uf.created_at,
        fp.name AS plan_name
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.status = 'active'
      ORDER BY uf.id ASC
      `
    );

    const now = new Date();
    let creditedCount = 0;
    let completedCount = 0;

    for (const fund of activeFunds) {
      const totalDays = Number(fund.total_days || 0);
      const currentDay = Number(fund.current_day || 0);

      if (totalDays <= 0) {
        continue;
      }

      const lastCreditBase = fund.last_profit_at
        ? new Date(fund.last_profit_at)
        : new Date(fund.started_at);

      const nextCreditAt = addDays(lastCreditBase, 1);

      if (now < nextCreditAt) {
        continue;
      }

      if (currentDay >= totalDays) {
        continue;
      }

      const dailyRate = toNumber(fund.selected_daily_profit_percent);
      const principal = toNumber(fund.locked_principal);
      const dailyProfit = Number(((principal * dailyRate) / 100).toFixed(10));
      const nextDay = currentDay + 1;
      const nextEarnedProfit = Number(
        (toNumber(fund.earned_profit) + dailyProfit).toFixed(10)
      );

      await connection.execute(
        `
        UPDATE user_funds
        SET
          current_day = ?,
          earned_profit = ?,
          last_profit_at = ?,
          updated_at = NOW()
        WHERE id = ?
        `,
        [nextDay, nextEarnedProfit, now, fund.id]
      );

      await connection.execute(
        `
        INSERT INTO fund_profit_logs (
          user_fund_id,
          user_id,
          day_number,
          profit_percent,
          profit_amount,
          credited_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [fund.id, fund.user_id, nextDay, dailyRate, dailyProfit, now]
      );

      creditedCount += 1;

      try {
        await createUserNotification(connection, {
          userId: fund.user_id,
          title: "Daily Fund Profit",
          message: `${fund.plan_name}: Day ${nextDay} profit of ${dailyProfit.toFixed(2)} USDT credited.`,
          type: "funds",
        });
      } catch (_notificationError) {}

      if (nextDay >= totalDays) {
        const totalReturn = Number((principal + nextEarnedProfit).toFixed(10));

        await connection.execute(
          `
          UPDATE users
          SET balance = balance + ?
          WHERE id = ?
          `,
          [totalReturn, fund.user_id]
        );

        await connection.execute(
          `
          UPDATE user_funds
          SET
            status = 'completed',
            completed_at = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [now, fund.id]
        );

        completedCount += 1;

        try {
          await createUserNotification(connection, {
            userId: fund.user_id,
            title: "Fund Completed",
            message: `${fund.plan_name} completed. Principal ${principal.toFixed(2)} USDT + profit ${dailyProfit.toFixed(2)} USDT = total ${totalReturn.toFixed(2)} USDT returned to main wallet.`,
            type: "funds",
          });
        } catch (_notificationError) {}
      }
    }

    await connection.commit();

    return {
      success: true,
      creditedCount,
      completedCount,
      processedAt: now,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/* =========================
   USER QR CODE FOR TRANSFERS
========================= */

// Generate or get user's QR code
app.get("/api/user/qr-code", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user's UID
    const [userRows] = await pool.execute(
      "SELECT uid FROM users WHERE id = ?",
      [userId]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const userUid = userRows[0].uid;
    
    // Check if QR code exists
    let [qrRows] = await pool.execute(
      "SELECT * FROM user_qr_codes WHERE user_id = ?",
      [userId]
    );
    
    let qrCodeUrl = null;
    
    if (!qrRows.length) {
      // Generate new QR code
      const qrData = JSON.stringify({
        type: "VexaTrade_transfer",
        uid: userUid,
        name: req.user.email || "User",
      });
      
      // Generate QR code image
      const qrFileName = `qr_${userId}_${Date.now()}.png`;
      const qrFilePath = path.join(__dirname, "uploads/qr_codes", qrFileName);
      
      await QRCode.toFile(qrFilePath, qrData, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      
      qrCodeUrl = `/uploads/qr_codes/${qrFileName}`;
      
      // Save to database
      await pool.execute(
        `INSERT INTO user_qr_codes (user_id, qr_data, qr_code_url)
         VALUES (?, ?, ?)`,
        [userId, qrData, qrCodeUrl]
      );
      
      [qrRows] = await pool.execute(
        "SELECT * FROM user_qr_codes WHERE user_id = ?",
        [userId]
      );
    }
    
    const qrCode = qrRows[0];
    
    res.json({
      success: true,
      data: {
        qr_code_url: qrCode.qr_code_url,
        qr_data: qrCode.qr_data,
      },
    });
  } catch (error) {
    console.error("QR code generation error:", error);
    next(error);
  }
});

// Get user by UID (for scanning)
app.get("/api/user/by-uid/:uid", authenticateUser, async (req, res, next) => {
  try {
    const { uid } = req.params;
    
    const [rows] = await pool.execute(
      "SELECT id, uid, name, email FROM users WHERE uid = ?",
      [uid]
    );
    
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    res.json({
      success: true,
      data: {
        id: rows[0].id,
        uid: rows[0].uid,
        name: rows[0].name,
        email: rows[0].email,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Transfer funds between users (direct, no admin approval)
app.post("/api/user/transfer", authenticateUser, async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    // Line 1169 - CORRECT
    const { recipientUid, amount, note } = req.body;
    const senderId = req.user.id;
    
    if (!recipientUid) {
      return res.status(400).json({ success: false, message: "Recipient UID is required" });
    }
    
    const transferAmount = Number(amount);
    if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid transfer amount" });
    }
    
    if (transferAmount < 1) {
      return res.status(400).json({ success: false, message: "Minimum transfer amount is 1 USDT" });
    }
    
    await connection.beginTransaction();
    
    // Get sender
    const [senderRows] = await connection.execute(
      "SELECT id, uid, name, email, balance FROM users WHERE id = ? FOR UPDATE",
      [senderId]
    );
    
    if (!senderRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Sender not found" });
    }
    
    const sender = senderRows[0];
    
    // Get recipient
    const [recipientRows] = await connection.execute(
      "SELECT id, uid, name, email, balance FROM users WHERE uid = ? FOR UPDATE",
      [recipientUid]
    );
    
    if (!recipientRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: "Recipient not found" });
    }
    
    const recipient = recipientRows[0];
    
    // Prevent self-transfer
    if (sender.id === recipient.id) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Cannot transfer to yourself" });
    }
    
    // Check sender balance
    const senderBalance = Number(sender.balance || 0);
    if (senderBalance < transferAmount) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Insufficient balance" });
    }
    
    // Perform transfer
    await connection.execute(
      "UPDATE users SET balance = balance - ?, updated_at = NOW() WHERE id = ?",
      [transferAmount, sender.id]
    );
    
    await connection.execute(
      "UPDATE users SET balance = balance + ?, updated_at = NOW() WHERE id = ?",
      [transferAmount, recipient.id]
    );
    
    // Log transaction for sender
    await createTransactionLog(connection, {
      userId: sender.id,
      type: "transfer_sent",
      amount: transferAmount,
      status: "completed",
      referenceId: recipient.id,
      note: `Transfer to ${recipient.uid} (${recipient.email})${note ? ` - ${note}` : ""}`,
    });
    
    // Log transaction for recipient
    await createTransactionLog(connection, {
      userId: recipient.id,
      type: "transfer_received",
      amount: transferAmount,
      status: "completed",
      referenceId: sender.id,
      note: `Transfer from ${sender.uid} (${sender.email})${note ? ` - ${note}` : ""}`,
    });
    
    // Save transfer record
    const [transferResult] = await connection.execute(
      `INSERT INTO user_transfers (sender_id, receiver_id, amount, currency, status, note, created_at, completed_at)
       VALUES (?, ?, ?, 'USDT', 'completed', ?, NOW(), NOW())`,
      [sender.id, recipient.id, transferAmount, note || null]
    );
    
    // Notify recipient
    await createUserNotification(connection, {
      userId: recipient.id,
      title: "Transfer Received",
      message: `You received ${transferAmount} USDT from ${sender.name || sender.email}`,
      type: "funds",
    });
    
    // Notify sender
    await createUserNotification(connection, {
      userId: sender.id,
      title: "Transfer Sent",
      message: `You sent ${transferAmount} USDT to ${recipient.name || recipient.email}`,
      type: "funds",
    });
    
    await connection.commit();
    
    res.json({
      success: true,
      message: "Transfer completed successfully",
      data: {
        transfer_id: transferResult.insertId,
        from: sender.uid,
        to: recipient.uid,
        amount: transferAmount,
        remaining_balance: senderBalance - transferAmount,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Get transfer history
app.get("/api/user/transfers", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const [rows] = await pool.execute(
      `SELECT 
        ut.*,
        s.uid as sender_uid,
        s.name as sender_name,
        s.email as sender_email,
        r.uid as receiver_uid,
        r.name as receiver_name,
        r.email as receiver_email
       FROM user_transfers ut
       LEFT JOIN users s ON s.id = ut.sender_id
       LEFT JOIN users r ON r.id = ut.receiver_id
       WHERE ut.sender_id = ? OR ut.receiver_id = ?
       ORDER BY ut.created_at DESC
       LIMIT 100`,
      [userId, userId]
    );
    
    const formattedTransfers = rows.map(transfer => ({
      id: transfer.id,
      amount: Number(transfer.amount),
      currency: transfer.currency,
      status: transfer.status,
      note: transfer.note,
      created_at: transfer.created_at,
      is_sent: transfer.sender_id === userId,
      sender: {
        uid: transfer.sender_uid,
        name: transfer.sender_name,
        email: transfer.sender_email,
      },
      receiver: {
        uid: transfer.receiver_uid,
        name: transfer.receiver_name,
        email: transfer.receiver_email,
      },
    }));
    
    res.json({
      success: true,
      data: formattedTransfers,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    res.json({
      success: true,
      message: "VexaTrade backend running",
      database: DB_NAME,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "VexaTrade backend is running",
  });
});

/* =========================
   USER AUTH
========================= */

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const name = String(req.body.name || `${firstName} ${lastName}`).trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const gender = String(req.body.gender || "").trim();
    const dob = req.body.dob || null;
    const country = String(req.body.country || "").trim();

    if (!name) throw createError(400, "Name is required");
    if (!email) throw createError(400, "Email is required");
    if (!password || password.length < 6) {
      throw createError(400, "Password must be at least 6 characters");
    }

    const [existingRows] = await pool.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingRows.length) throw createError(409, "Email already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO users (
        name,
        email,
        password,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        balance,
        status,
        email_verified,
        kyc_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', 0, 'not_submitted', NOW(), NOW())`,
      [
        name,
        email,
        hashedPassword,
        firstName || null,
        lastName || null,
        gender || null,
        dob || null,
        country || null,
      ]
    );

    const uid = `CP${String(result.insertId).padStart(8, "0")}`;

    await pool.execute(`UPDATE users SET uid = ? WHERE id = ?`, [
      uid,
      result.insertId,
    ]);

    const [userRows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        email,
        balance,
        status,
        email_verified,
        kyc_status,
        approved_at
      FROM users
      WHERE id = ?
      LIMIT 1`,
      [result.insertId]
    );

    const user = userRows[0];
    const token = generateUserToken(user);

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email) throw createError(400, "Email is required");
    if (!password) throw createError(400, "Password is required");

    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!rows.length) throw createError(404, "User not found");

    const user = rows[0];
    const matched = await bcrypt.compare(password, user.password);

    if (!matched) throw createError(401, "Invalid email or password");

    const userStatus = String(user.status || "").toLowerCase();
    if (["disabled", "frozen"].includes(userStatus)) {
      throw createError(403, "User account is not active");
    }

    const token = generateUserToken(user);

    res.json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: user.id,
        uid: user.uid || null,
        name: user.name,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        gender: user.gender || null,
        date_of_birth: user.date_of_birth || null,
        country: user.country || null,
        email: user.email,
        balance: Number(user.balance || 0),
        status: user.status,
        email_verified: Number(user.email_verified || 0),
        kyc_status: user.kyc_status || "not_submitted",
        approved_at: user.approved_at || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   FORGOT PASSWORD & RESET
========================= */

app.post("/api/auth/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const [rows] = await pool.execute(
      "SELECT id, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (!rows.length) {
      return res.json({
        success: true,
        message: "If this email exists, password reset instructions will be sent."
      });
    }

    const user = rows[0];
    const resetToken = jwt.sign(
      { id: user.id, email: user.email, purpose: "password_reset" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    await pool.execute(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())
       ON DUPLICATE KEY UPDATE token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)`,
      [user.id, resetToken, resetToken]
    );

    const resetLink = `${process.env.FRONTEND_USER_URL || "https://vexatrade-server.onrender.com"}/reset-password?token=${resetToken}`;

    await sendPasswordResetEmail({ to: email, resetLink });

    res.json({
      success: true,
      message: "If this email exists, password reset instructions will be sent."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.json({
      success: true,
      message: "If this email exists, password reset instructions will be sent."
    });
  }
});

app.get("/api/auth/reset-password/verify", async (req, res, next) => {
  try {
    const token = req.query.token;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const [rows] = await pool.execute(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }

    res.json({ success: true, message: "Token is valid" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/reset-password", async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    await connection.beginTransaction();

    const [tokenRows] = await connection.execute(
      `SELECT * FROM password_reset_tokens 
       WHERE token = ? AND expires_at > NOW()`,
      [token]
    );

    if (!tokenRows.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: "Invalid or expired reset link" });
    }

    const resetToken = tokenRows[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      `UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?`,
      [hashedPassword, resetToken.user_id]
    );

    await connection.execute(
      `DELETE FROM password_reset_tokens WHERE token = ?`,
      [token]
    );

    await connection.commit();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/user/profile", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        email,
        balance,
        status,
        email_verified,
        kyc_status,
        approved_at,
        avatar_url,
        trading_fee_tier
      FROM users
      WHERE id = ?
      LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) throw createError(404, "User not found");

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/user/profile", authenticateUser, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();

    if (!name) throw createError(400, "Name is required");

    await pool.execute(
      `UPDATE users
       SET name = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, req.user.id]
    );

    const [rows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        email,
        balance,
        status,
        email_verified,
        kyc_status,
        approved_at,
        avatar_url,
        trading_fee_tier
      FROM users
      WHERE id = ?
      LIMIT 1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/user/profile/upload-picture",
  authenticateUser,
  upload.single("profile_picture"),
  async (req, res, next) => {
    try {
      if (!req.file) throw createError(400, "Profile picture is required");

      const [existingRows] = await pool.execute(
        `SELECT avatar_url
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.user.id]
      );

      const oldAvatarUrl = existingRows[0]?.avatar_url || null;
      const avatarUrl = `/uploads/profiles/${req.file.filename}`;

      await pool.execute(
        `UPDATE users
         SET avatar_url = ?, updated_at = NOW()
         WHERE id = ?`,
        [avatarUrl, req.user.id]
      );

      if (oldAvatarUrl && oldAvatarUrl !== avatarUrl) {
        removeUploadedFile(oldAvatarUrl);
      }

      res.json({
        success: true,
        message: "Profile picture uploaded successfully",
        data: {
          avatar_url: avatarUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   USER SECURITY
========================= */

app.post("/api/user/set-passcode", authenticateUser, async (req, res, next) => {
  try {
    const { passcode } = req.body;

    if (!passcode || String(passcode).trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Passcode must be at least 4 digits",
      });
    }

    await pool.execute(
      "UPDATE users SET passcode = ?, updated_at = NOW() WHERE id = ?",
      [String(passcode).trim(), req.user.id]
    );

    res.json({
      success: true,
      message: "Passcode saved successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/user/security-status",
  authenticateUser,
  async (req, res, next) => {
    try {
      const [rows] = await pool.execute(
        `SELECT
          passcode,
          twofa_enabled,
          email_verified,
          kyc_status,
          status,
          approved_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.user.id]
      );

      const user = rows[0] || {};

      res.json({
        success: true,
        data: {
          hasPasscode: !!user?.passcode,
          passcode_enabled: !!user?.passcode,
          twofaEnabled: !!user?.twofa_enabled,
          twofa_enabled: !!user?.twofa_enabled,
          email_verified: Number(user?.email_verified || 0),
          kyc_status: user?.kyc_status || "not_submitted",
          status: user?.status || "pending",
          approved_at: user?.approved_at || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   EMAIL VERIFICATION
========================= */

app.post(
  "/api/user/send-email-verification-code",
  authenticateUser,
  async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `SELECT id, email, email_verified
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
        [req.user.id]
      );

      if (!rows.length) throw createError(404, "User not found");

      const user = rows[0];

      if (Number(user.email_verified || 0) === 1) {
        await connection.commit();
        return res.json({
          success: true,
          message: "Email is already verified",
        });
      }

      const code = generateSixDigitOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await connection.execute(
        `UPDATE user_email_otps
       SET is_used = 1, updated_at = NOW()
       WHERE user_id = ?
         AND purpose = 'email_verification'
         AND is_used = 0`,
        [req.user.id]
      );

      await connection.execute(
        `INSERT INTO user_email_otps (user_id, email, otp_code, purpose, is_used, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, 'email_verification', 0, ?, NOW(), NOW())`,
        [req.user.id, user.email, code, expiresAt]
      );

      await createUserNotification(connection, {
        userId: req.user.id,
        title: "Email verification code",
        message: `Your CryptoPulse verification code is ${code}. It expires in 10 minutes.`,
        type: "verification_code",
      });

      await createAuditLog(connection, {
        adminId: null,
        action: "user_requested_email_verification_code",
        targetUserId: req.user.id,
        referenceId: req.user.id,
        note: `User ${req.user.id} requested email verification code`,
      });

      await connection.commit();

      // Send email via Keplers
      sendOtpEmail({ to: user.email, code })
        .then(success => {
          console.log(`Email sending result for ${user.email}: ${success}`);
        })
        .catch(err => console.error("Background email error:", err));

      res.json({
        success: true,
        message: `Your verification code is: ${code}`,
        code: code,
        emailSent: false
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  }
);

app.post(
  "/api/user/verify-email-code",
  authenticateUser,
  async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      const code = String(req.body.code || "").trim();

      if (!/^\d{6}$/.test(code)) {
        throw createError(400, "Valid 6-digit code is required");
      }

      await connection.beginTransaction();

      const [userRows] = await connection.execute(
        `SELECT id, email, email_verified, kyc_status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
        [req.user.id]
      );

      if (!userRows.length) throw createError(404, "User not found");

      const user = userRows[0];

      if (Number(user.email_verified || 0) === 1) {
        await connection.commit();
        return res.json({
          success: true,
          message: "Email is already verified",
        });
      }

      const [otpRows] = await connection.execute(
        `SELECT id, otp_code, expires_at, is_used
       FROM user_email_otps
       WHERE user_id = ?
         AND email = ?
         AND purpose = 'email_verification'
         AND is_used = 0
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
        [req.user.id, user.email]
      );

      if (!otpRows.length) {
        throw createError(400, "No active verification code found");
      }

      const otp = otpRows[0];

      if (String(otp.otp_code) !== code) {
        throw createError(400, "Invalid verification code");
      }

      if (isOtpExpired(otp.expires_at)) {
        throw createError(400, "Verification code has expired");
      }

      await connection.execute(
        `UPDATE user_email_otps
       SET is_used = 1, updated_at = NOW()
       WHERE id = ?`,
        [otp.id]
      );

      const nextStatus =
        String(user.kyc_status || "").toLowerCase() === "pending"
          ? "under_review"
          : "pending";

      await connection.execute(
        `UPDATE users
       SET email_verified = 1, status = ?, updated_at = NOW()
       WHERE id = ?`,
        [nextStatus, req.user.id]
      );

      await createUserNotification(connection, {
        userId: req.user.id,
        title: "Email verified",
        message: "Your email address has been successfully verified.",
        type: "security",
      });

      await createAuditLog(connection, {
        adminId: null,
        action: "user_verified_email",
        targetUserId: req.user.id,
        referenceId: req.user.id,
        note: `User ${req.user.id} verified email successfully`,
      });

      await connection.commit();

      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  }
);

app.get("/api/user/notifications", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, message, type, is_read, created_at
       FROM user_notifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 100`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/user/notifications/:id/read",
  authenticateUser,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        throw createError(400, "Invalid notification id");
      }

      await pool.execute(
        `UPDATE user_notifications
       SET is_read = 1
       WHERE id = ?
         AND user_id = ?`,
        [id, req.user.id]
      );

      res.json({
        success: true,
        message: "Notification marked as read",
      });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/user/notifications/:id",
  authenticateUser,
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isFinite(id) || id <= 0) {
        throw createError(400, "Invalid notification id");
      }

      const [result] = await pool.execute(
        `DELETE FROM user_notifications
       WHERE id = ?
         AND user_id = ?`,
        [id, req.user.id]
      );

      if (result.affectedRows === 0) {
        throw createError(404, "Notification not found");
      }

      res.json({
        success: true,
        message: "Notification deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   PASSCODE VERIFY
========================= */

app.post(
  "/api/user/verify-passcode",
  authenticateUser,
  async (req, res, next) => {
    try {
      const passcode = String(req.body.passcode || "").trim();

      if (!passcode) {
        throw createError(400, "Passcode is required");
      }

      const [rows] = await pool.execute(
        `SELECT id, passcode
       FROM users
       WHERE id = ?
       LIMIT 1`,
        [req.user.id]
      );

      if (!rows.length) throw createError(404, "User not found");

      const user = rows[0];

      if (!user.passcode) {
        throw createError(400, "No passcode has been set");
      }

      if (String(user.passcode) !== passcode) {
        throw createError(401, "Incorrect passcode");
      }

      res.json({
        success: true,
        message: "Passcode verified successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   USER KYC
========================= */

app.post(
  "/api/kyc/upload",
  authenticateUser,
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const country = String(req.body.country || "").trim();
      const documentType = String(req.body.document_type || "").trim();
      const documentNumber = String(req.body.document_number || "").trim();

      if (!country) throw createError(400, "Country is required");
      if (!documentType) throw createError(400, "Document type is required");

      const frontFile = req.files?.front?.[0];
      const backFile = req.files?.back?.[0];

      if (!frontFile)
        throw createError(400, "Front document image is required");

      const frontUrl = `/uploads/kyc/${frontFile.filename}`;
      const backUrl = backFile ? `/uploads/kyc/${backFile.filename}` : null;

      try {
        await pool.execute(
          `UPDATE user_kyc
           SET verification_status = 'replaced', updated_at = NOW()
           WHERE user_id = ?
             AND verification_status = 'pending'`,
          [req.user.id]
        );
      } catch (_error) {}

      await pool.execute(
        `INSERT INTO user_kyc
         (
           user_id,
           residence_country,
           document_type,
           document_number,
           document_front_url,
           document_back_url,
           verification_status,
           submitted_at,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW(), NOW())`,
        [
          req.user.id,
          country,
          documentType,
          documentNumber || null,
          frontUrl,
          backUrl,
        ]
      );

      const [userRows] = await pool.execute(
        `SELECT email_verified
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.user.id]
      );

      const emailVerified = Number(userRows?.[0]?.email_verified || 0) === 1;
      const nextStatus = emailVerified ? "under_review" : "pending";

      await pool.execute(
        `UPDATE users
         SET kyc_status = 'pending',
             status = ?,
             country = COALESCE(NULLIF(?, ''), country),
             updated_at = NOW()
         WHERE id = ?`,
        [nextStatus, country, req.user.id]
      );

      res.json({
        success: true,
        message: "KYC submitted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
);

/* =========================
   PLATFORM
========================= */

app.get("/api/platform/public-settings", async (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  try {
    const [settingRows] = await pool.execute(
      `SELECT setting_key, setting_value
       FROM platform_settings
       WHERE setting_key IN ('wallet_label', 'default_convert_fee_percent')
       ORDER BY id ASC`
    );

    const map = {};
    for (const row of settingRows) {
      map[String(row.setting_key || "")] = row.setting_value;
    }

    res.json({
      success: true,
      data: {
        wallet_label: map.wallet_label || "Main Wallet",
        default_convert_fee_percent: Number(
          map.default_convert_fee_percent || 0.2
        ),
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN AUTH
========================= */

app.post("/api/admin/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email) throw createError(400, "Email is required");
    if (!password) throw createError(400, "Password is required");

    const [rows] = await pool.execute(
      "SELECT * FROM admins WHERE email = ? LIMIT 1",
      [email]
    );

    if (!rows.length) throw createError(404, "Admin not found");

    const admin = rows[0];
    const matched = await bcrypt.compare(password, admin.password);

    if (!matched) throw createError(401, "Invalid email or password");

    const token = generateAdminToken(admin);

    res.json({
      success: true,
      message: "Admin login successful",
      token,
      data: {
        id: admin.id,
        email: admin.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN DASHBOARD STATS
========================= */

app.get("/api/admin/dashboard-stats", authenticateAdmin, async (req, res, next) => {
  try {
    const [usersRow] = await pool.execute("SELECT COUNT(*) AS total FROM users");
    const [activeUsersRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE email_verified = 1 AND status = 'active'"
    );
    const [emailVerifiedRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE email_verified = 1"
    );
    const [pendingKycRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM user_kyc WHERE verification_status = 'pending'"
    );
    const [depositsRow] = await pool.execute(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM deposits WHERE status = 'approved'"
    );
    const [pendingDepositsRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM deposits WHERE status = 'pending'"
    );
    const [withdrawalsRow] = await pool.execute(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM withdrawals WHERE status = 'approved'"
    );
    const [pendingWithdrawalsRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM withdrawals WHERE status = 'pending'"
    );
    const [tradesRow] = await pool.execute("SELECT COUNT(*) AS total FROM trades");
    const [todayTradesRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM trades WHERE DATE(created_at) = CURDATE()"
    );
    const [balanceRow] = await pool.execute(
      "SELECT COALESCE(SUM(balance), 0) AS total FROM users"
    );
    const [pendingLoansRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM loans WHERE status = 'pending'"
    );
    const [pendingJointRow] = await pool.execute(
      "SELECT COUNT(*) AS total FROM joint_account_requests WHERE status = 'pending'"
    );

    res.json({
      success: true,
      data: {
        totalUsers: Number(usersRow[0]?.total || 0),
        activeUsers: Number(activeUsersRow[0]?.total || 0),
        emailVerifiedUsers: Number(emailVerifiedRow[0]?.total || 0),
        pendingKyc: Number(pendingKycRow[0]?.total || 0),
        totalDeposits: Number(depositsRow[0]?.total || 0),
        pendingDeposits: Number(pendingDepositsRow[0]?.total || 0),
        totalWithdrawals: Number(withdrawalsRow[0]?.total || 0),
        pendingWithdrawals: Number(pendingWithdrawalsRow[0]?.total || 0),
        totalTrades: Number(tradesRow[0]?.total || 0),
        todayTrades: Number(todayTradesRow[0]?.total || 0),
        totalBalance: Number(balanceRow[0]?.total || 0),
        pendingLoans: Number(pendingLoansRow[0]?.total || 0),
        pendingJointAccounts: Number(pendingJointRow[0]?.total || 0),
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   NEWS
========================= */

app.get("/api/news", async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE is_active = 1
       ORDER BY id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/news/admin/all", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       ORDER BY id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/news", authenticateAdmin, async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const imageUrl = String(req.body.image_url || "").trim();
    const isActive = normalizeNewsActive(req.body.is_active);

    if (!title) {
      throw createError(400, "Title is required");
    }

    const [result] = await pool.execute(
      `INSERT INTO news
       (title, content, image_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [title, content || null, imageUrl || null, isActive]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "create_news",
      referenceId: result.insertId,
      note: `Created news: ${title}`,
    });

    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE id = ?
       LIMIT 1`,
      [result.insertId]
    );

    res.json({
      success: true,
      message: "News created successfully",
      data: rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/news/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const imageUrl = String(req.body.image_url || "").trim();
    const isActive = normalizeNewsActive(req.body.is_active);

    if (!Number.isFinite(id) || id <= 0) {
      throw createError(400, "Invalid news id");
    }

    if (!title) {
      throw createError(400, "Title is required");
    }

    const [exists] = await pool.execute(
      `SELECT id
       FROM news
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!exists.length) {
      throw createError(404, "News not found");
    }

    await pool.execute(
      `UPDATE news
       SET title = ?,
           content = ?,
           image_url = ?,
           is_active = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [title, content || null, imageUrl || null, isActive, id]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_news",
      referenceId: id,
      note: `Updated news #${id}`,
    });

    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         image_url,
         is_active,
         created_at,
         updated_at
       FROM news
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    res.json({
      success: true,
      message: "News updated successfully",
      data: rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/news/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw createError(400, "Invalid news id");
    }

    const [rows] = await pool.execute(
      `SELECT id, title
       FROM news
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      throw createError(404, "News not found");
    }

    await pool.execute(
      `DELETE FROM news
       WHERE id = ?`,
      [id]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "delete_news",
      referenceId: id,
      note: `Deleted news #${id}${rows[0].title ? ` (${rows[0].title})` : ""}`,
    });

    res.json({
      success: true,
      message: "News deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   MARKET
========================= */

app.get("/api/market/home", async (_req, res, next) => {
  try {
    const symbols = [
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "XRPUSDT",
      "DOGEUSDT",
      "ADAUSDT",
      "TRXUSDT",
      "AVAXUSDT",
      "LINKUSDT",
      "TONUSDT",
      "LTCUSDT",
    ];

    const rows = await getBinanceHomeMarkets(symbols);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/market/list", async (_req, res, next) => {
  try {
    const symbols = [
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "BNBUSDT",
      "XRPUSDT",
      "DOGEUSDT",
      "ADAUSDT",
      "TRXUSDT",
      "AVAXUSDT",
      "LINKUSDT",
      "TONUSDT",
      "LTCUSDT",
    ];

    const rows = await getBinanceHomeMarkets(symbols);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/market/price", async (req, res, next) => {
  try {
    const symbol = String(req.query.symbol || "BTCUSDT")
      .toUpperCase()
      .trim();
    const price = await getBinancePrice(symbol);

    res.json({
      success: true,
      data: {
        symbol,
        price,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   WALLET
========================= */

app.get("/api/wallet/summary", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        email,
        balance,
        status,
        kyc_status,
        email_verified
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (!rows.length) throw createError(404, "User not found");

    const user = rows[0];

    let walletLabel = "Main Wallet";
    try {
      const [settingRows] = await pool.execute(
        `SELECT setting_value
         FROM platform_settings
         WHERE setting_key = 'wallet_label'
         LIMIT 1`
      );
      if (settingRows.length) {
        walletLabel = settingRows[0].setting_value || "Main Wallet";
      }
    } catch (_error) {}

    res.json({
      success: true,
      data: {
        balance: Number(user.balance || 0),
        walletLabel,
        user: {
          id: user.id,
          uid: user.uid || null,
          name: user.name,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          email: user.email,
          status: user.status,
          kyc_status: user.kyc_status || "not_submitted",
          email_verified: Number(user.email_verified || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   portfolio-assets
========================= */

app.get("/api/user/portfolio-assets", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const priceMap = new Map();
    priceMap.set("USDTUSDT", 1);

    try {
      const marketSymbols = [
        "BTCUSDT",
        "ETHUSDT",
        "BNBUSDT",
        "SOLUSDT",
        "XRPUSDT",
      ];

      const marketRows = await getBinanceHomeMarkets(marketSymbols);
      for (const row of marketRows) {
        const symbol = String(row.symbol || "").toUpperCase();
        const price = Number(row.lastPrice || row.price || 0);
        if (symbol && price > 0) {
          priceMap.set(symbol, price);
        }
      }
    } catch (_error) {}

    const [userRows] = await pool.execute(
      `
      SELECT balance
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const userBalance = Number(userRows?.[0]?.balance || 0);

    const holdingsMap = new Map();

    holdingsMap.set("USDT", {
      symbol: "USDT",
      amount: userBalance,
      avg_price: 1,
    });

    let convertRows = [];
    try {
      const [rows] = await pool.execute(
        `
        SELECT
          from_coin,
          to_coin,
          from_amount,
          receive_amount,
          to_amount,
          amount_received,
          created_at
        FROM convert_transactions
        WHERE user_id = ?
        ORDER BY id ASC
        `,
        [userId]
      );
      convertRows = rows;
    } catch (_error) {
      convertRows = [];
    }

    for (const row of convertRows) {
      const fromCoin = String(row.from_coin || "").toUpperCase();
      const toCoin = String(row.to_coin || "").toUpperCase();
      const toAmount = Number(
        row.receive_amount || row.to_amount || row.amount_received || 0
      );

      if (!toCoin || toCoin === "USDT" || toAmount <= 0) continue;

      if (!holdingsMap.has(toCoin)) {
        holdingsMap.set(toCoin, {
          symbol: toCoin,
          amount: 0,
          avg_price: Number(priceMap.get(`${toCoin}USDT`) || 0),
        });
      }

      const existing = holdingsMap.get(toCoin);
      existing.amount = Number((Number(existing.amount || 0) + toAmount).toFixed(8));

      if (fromCoin !== "USDT" && holdingsMap.has(fromCoin)) {
        const fromExisting = holdingsMap.get(fromCoin);
        const spentAmount = Number(row.from_amount || 0);
        fromExisting.amount = Number(
          (Number(fromExisting.amount || 0) - spentAmount).toFixed(8)
        );
      }
    }

    const assets = Array.from(holdingsMap.values())
      .filter((item) => Number(item.amount || 0) > 0.00000001)
      .map((item) => {
        const symbol = item.symbol;
        const currentPrice =
          symbol === "USDT"
            ? 1
            : Number(priceMap.get(`${symbol}USDT`) || 0);

        const avgPrice = Number(item.avg_price || currentPrice || 0);
        const amount = Number(item.amount || 0);
        const usdtValue = amount * currentPrice;
        const spotPnl = (currentPrice - avgPrice) * amount;
        const invested = avgPrice * amount;
        const spotPnlPercent = invested > 0 ? (spotPnl / invested) * 100 : 0;

        return {
          symbol,
          amount,
          current_price: currentPrice,
          avg_price: avgPrice,
          usdt_value: usdtValue,
          spot_pnl: spotPnl,
          spot_pnl_percent: spotPnlPercent,
        };
      })
      .sort((a, b) => Number(b.usdt_value || 0) - Number(a.usdt_value || 0));

    res.json({
      success: true,
      data: {
        assets,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   CONVERT
========================= */

app.post("/api/convert/execute", authenticateUser, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const fromCoin = String(req.body.fromCoin || "").trim().toUpperCase();
    const toCoin = String(req.body.toCoin || "").trim().toUpperCase();
    const fromAmount = Number(req.body.fromAmount || 0);

    const supportedCoins = getSupportedConvertCoins();

    let convertFeePercent = 0.2;
    try {
      const [settingsRows] = await connection.execute(
        `SELECT setting_value
         FROM platform_settings
         WHERE setting_key = 'default_convert_fee_percent'
         LIMIT 1`
      );
      if (settingsRows.length) {
        convertFeePercent = Number(settingsRows[0].setting_value || 0.2);
      }
    } catch (_error) {}

    if (!fromCoin) throw createError(400, "From coin is required");
    if (!toCoin) throw createError(400, "To coin is required");
    if (!supportedCoins.includes(fromCoin)) {
      throw createError(400, `Unsupported from coin: ${fromCoin}`);
    }
    if (!supportedCoins.includes(toCoin)) {
      throw createError(400, `Unsupported to coin: ${toCoin}`);
    }
    if (fromCoin === toCoin) {
      throw createError(400, "From coin and to coin cannot be the same");
    }
    if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
      throw createError(400, "Invalid convert amount");
    }

    let fromPriceUsdt = 0;
    let toPriceUsdt = 0;

    if (fromCoin === "USDT") {
      fromPriceUsdt = 1;
    } else {
      fromPriceUsdt = await getBinancePrice(`${fromCoin}USDT`);
    }

    if (toCoin === "USDT") {
      toPriceUsdt = 1;
    } else {
      toPriceUsdt = await getBinancePrice(`${toCoin}USDT`);
    }

    if (!Number.isFinite(fromPriceUsdt) || fromPriceUsdt <= 0) {
      throw createError(400, `Price unavailable for ${fromCoin}`);
    }

    if (!Number.isFinite(toPriceUsdt) || toPriceUsdt <= 0) {
      throw createError(400, `Price unavailable for ${toCoin}`);
    }

    const grossUsdtValue = Number((fromAmount * fromPriceUsdt).toFixed(8));
    const feeUsdt = Number((grossUsdtValue * (convertFeePercent / 100)).toFixed(8));
    const netUsdtValue = Number((grossUsdtValue - feeUsdt).toFixed(8));
    const receiveAmount = Number((netUsdtValue / toPriceUsdt).toFixed(8));

    if (receiveAmount <= 0) {
      throw createError(400, "Calculated receive amount is invalid");
    }

    await connection.beginTransaction();

    const [userRows] = await connection.execute(
      `SELECT id, balance, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [req.user.id]
    );

    if (!userRows.length) throw createError(404, "User not found");

    const user = userRows[0];
    const currentBalance = Number(user.balance || 0);
    const userStatus = String(user.status || "").toLowerCase();

    if (["disabled", "frozen"].includes(userStatus)) {
      throw createError(403, "User account is not active");
    }

    if (currentBalance < grossUsdtValue) {
      throw createError(400, `Insufficient balance. Required ${grossUsdtValue.toFixed(2)} USDT`);
    }

    const updatedBalance = Number((currentBalance - grossUsdtValue).toFixed(8));

    await connection.execute(
      `UPDATE users
       SET balance = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [updatedBalance, req.user.id]
    );

    const [columns] = await connection.execute(
      `SHOW COLUMNS FROM convert_transactions`
    );
    const columnNames = columns.map((col) => String(col.Field || "").toLowerCase());

    const valuesMap = {
      user_id: req.user.id,
      from_coin: fromCoin,
      to_coin: toCoin,
      from_amount: fromAmount,
      from_price_usdt: fromPriceUsdt,
      to_price_usdt: toPriceUsdt,
      gross_usdt_value: grossUsdtValue,
      fee_percent: convertFeePercent,
      fee_usdt: feeUsdt,
      net_usdt_value: netUsdtValue,
      receive_amount: receiveAmount,
      status: "completed",
    };

    const insertColumns = [];
    const insertValues = [];
    const placeholders = [];

    for (const [key, value] of Object.entries(valuesMap)) {
      if (columnNames.includes(key)) {
        insertColumns.push(key);
        insertValues.push(value);
        placeholders.push("?");
      }
    }

    if (columnNames.includes("created_at")) {
      insertColumns.push("created_at");
      placeholders.push("NOW()");
    }

    if (columnNames.includes("updated_at")) {
      insertColumns.push("updated_at");
      placeholders.push("NOW()");
    }

    const [result] = await connection.execute(
      `INSERT INTO convert_transactions
       (${insertColumns.join(", ")})
       VALUES (${placeholders.join(", ")})`,
      insertValues
    );

    await createTransactionLog(connection, {
      userId: req.user.id,
      type: "convert",
      amount: grossUsdtValue,
      status: "completed",
      referenceId: result.insertId,
      note: `Converted ${fromAmount} ${fromCoin} to ${receiveAmount} ${toCoin} with ${feeUsdt} USDT fee`,
    });

    await createUserNotification(connection, {
      userId: req.user.id,
      title: "Convert completed",
      message: `You converted ${fromAmount} ${fromCoin} to approximately ${receiveAmount} ${toCoin}. Fee applied: ${feeUsdt} USDT.`,
      type: "funds",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Conversion completed successfully",
      data: {
        id: result.insertId,
        fromCoin,
        toCoin,
        fromAmount,
        fromPriceUsdt,
        toPriceUsdt,
        grossUsdtValue,
        feePercent: convertFeePercent,
        feeUsdt,
        netUsdtValue,
        receiveAmount,
        balanceAfter: updatedBalance,
        walletMode: "single_usdt_balance",
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/convert/history", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM convert_transactions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER DEPOSIT WALLETS
========================= */

app.get("/api/deposit/wallets", authenticateUser, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        coin,
        network,
        display_label AS label,
        address,
        minimum_deposit AS min_deposit,
        qr_image_url AS qr_url,
        instructions
       FROM deposit_wallets
       WHERE status = 'active'
       ORDER BY sort_order ASC, id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER TRANSACTIONS
========================= */

app.get("/api/transactions", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM transactions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER TRADE RULES
========================= */

app.get("/api/trade/rules", authenticateUser, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, timer_seconds, payout_percent, status, created_at
       FROM trade_rules
       WHERE status = 'active'
       ORDER BY timer_seconds ASC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER DEPOSITS
========================= */

app.post(
  "/api/deposits/upload-receipt",
  authenticateUser,
  upload.single("receipt"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    res.json({
      success: true,
      url: `/uploads/deposits/${req.file.filename}`,
    });
  }
);

app.post("/api/deposits/request", authenticateUser, async (req, res, next) => {
  try {
    const { coin, network, amount, txid, note, proof } = req.body;

    if (!coin || !network) throw createError(400, "Invalid wallet");
    if (!amount || Number(amount) <= 0) throw createError(400, "Invalid amount");

    const [result] = await pool.execute(
      `INSERT INTO deposits
       (user_id, coin, network, amount, txid, note, proof, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
      [req.user.id, coin, network, amount, txid || null, note || null, proof || null]
    );

    res.json({
      success: true,
      message: "Deposit submitted successfully",
      data: {
        id: result.insertId,
        status: "pending",
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/deposits", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM deposits
       WHERE user_id = ?
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER WITHDRAWALS
========================= */

app.post(
  "/api/withdrawals/request",
  authenticateUser,
  async (req, res, next) => {
    const connection = await pool.getConnection();

    try {
      const coin = String(req.body.coin || "").trim().toUpperCase();
      const network = String(req.body.network || "").trim().toUpperCase();
      const address = String(
        req.body.wallet_address || req.body.address || ""
      ).trim();
      const amount = Number(req.body.amount || 0);

      if (!coin) throw createError(400, "Coin is required");
      if (!network) throw createError(400, "Network is required");
      if (!address) throw createError(400, "Withdrawal address is required");
      if (!Number.isFinite(amount) || amount <= 0)
        throw createError(400, "Invalid withdrawal amount");

      await connection.beginTransaction();

      const [userRows] = await connection.execute(
        `SELECT id, balance, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
        [req.user.id]
      );

      if (!userRows.length) throw createError(404, "User not found");

      const user = userRows[0];
      const balance = Number(user.balance || 0);

      if (["disabled", "frozen"].includes(String(user.status || "").toLowerCase())) {
        throw createError(403, "User account is not active");
      }

      const feeConfig = await getWithdrawalFeeConfig(connection, coin, network);
      const feeAmount = calculateWithdrawalFee(amount, feeConfig);
      const totalDeduction = Number((amount + feeAmount).toFixed(8));

      if (balance < totalDeduction) {
        throw createError(
          400,
          `Insufficient balance. Required ${totalDeduction} including fee ${feeAmount}`
        );
      }

      await connection.execute(
        `UPDATE users
       SET balance = balance - ?
       WHERE id = ?`,
        [totalDeduction, req.user.id]
      );

      let result;
      try {
        [result] = await connection.execute(
          `INSERT INTO withdrawals
         (user_id, coin, network, address, amount, fee_amount, fee_type, net_amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
          [
            req.user.id,
            coin,
            network,
            address,
            amount,
            feeAmount,
            String(feeConfig?.fee_type || "fixed").toLowerCase(),
            Number((amount - feeAmount).toFixed(8)),
          ]
        );
      } catch (_error) {
        [result] = await connection.execute(
          `INSERT INTO withdrawals
         (user_id, coin, network, address, amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
          [req.user.id, coin, network, address, amount]
        );
      }

      await createTransactionLog(connection, {
        userId: req.user.id,
        type: "withdrawal_request",
        amount: totalDeduction,
        status: "pending",
        referenceId: result.insertId,
        note: `${coin} ${network} withdrawal request created${
          feeAmount > 0 ? ` with fee ${feeAmount}` : ""
        }`,
      });

      await connection.commit();

      res.json({
        success: true,
        message: "Withdrawal request submitted successfully",
        data: {
          id: result.insertId,
          status: "pending",
          amount,
          feeAmount,
          totalDeduction,
        },
      });
    } catch (error) {
      await connection.rollback();
      next(error);
    } finally {
      connection.release();
    }
  }
);

app.get("/api/withdrawals", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM withdrawals
       WHERE user_id = ?
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER QUICK AMOUNT
========================= */

app.post("/api/trades/quick-amount", authenticateUser, async (req, res, next) => {
  try {
    const percentage = Number(req.body.percentage || 0);

    if (![25, 50, 75].includes(percentage)) {
      throw createError(400, "Invalid quick percentage");
    }

    const [rows] = await pool.execute(
      "SELECT balance FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );

    if (!rows.length) throw createError(404, "User not found");

    const balance = Number(rows[0].balance || 0);
    const amount = Number(((balance * percentage) / 100).toFixed(2));

    res.json({
      success: true,
      data: {
        amount,
        percentage,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* ---------------- FUNDS ---------------- */

app.get("/api/funds/plans", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        id,
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        is_active,
        created_at,
        updated_at
      FROM fund_plans
      WHERE is_active = 1
      ORDER BY duration_days ASC
      `
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/funds/summary", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [activeRows] = await pool.execute(
      `
      SELECT
        COALESCE(SUM(locked_principal), 0) AS active_funded_amount,
        COALESCE(SUM(earned_profit), 0) AS active_earned_profit,
        COUNT(*) AS active_count
      FROM user_funds
      WHERE user_id = ? AND status = 'active'
      `,
      [userId]
    );

    const [completedRows] = await pool.execute(
      `
      SELECT
        COALESCE(SUM(earned_profit), 0) AS completed_profit,
        COUNT(*) AS completed_count
      FROM user_funds
      WHERE user_id = ? AND status = 'completed'
      `,
      [userId]
    );

    const [todayRows] = await pool.execute(
      `
      SELECT
        COALESCE(SUM(profit_amount), 0) AS today_profit
      FROM fund_profit_logs
      WHERE user_id = ? AND DATE(credited_at) = CURDATE()
      `,
      [userId]
    );

    res.json({
      success: true,
      data: {
        active_funded_amount: toNumber(activeRows?.[0]?.active_funded_amount),
        active_earned_profit: toNumber(activeRows?.[0]?.active_earned_profit),
        active_count: Number(activeRows?.[0]?.active_count || 0),
        completed_profit: toNumber(completedRows?.[0]?.completed_profit),
        completed_count: Number(completedRows?.[0]?.completed_count || 0),
        today_profit: toNumber(todayRows?.[0]?.today_profit),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/funds/active", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `
      SELECT
        uf.id,
        uf.user_id,
        uf.plan_id,
        uf.amount,
        uf.locked_principal,
        uf.selected_daily_profit_percent,
        uf.total_days,
        uf.current_day,
        uf.earned_profit,
        uf.status,
        uf.started_at,
        uf.ends_at,
        uf.last_profit_at,
        uf.completed_at,
        uf.created_at,
        fp.name AS plan_name,
        fp.min_amount,
        fp.max_amount
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.user_id = ? AND uf.status = 'active'
      ORDER BY uf.created_at DESC
      `,
      [userId]
    );

    const data = rows.map((row) => {
      const totalDays = Number(row.total_days || 0);
      const currentDay = Number(row.current_day || 0);
      const daysLeft = Math.max(0, totalDays - currentDay);

      return {
        ...row,
        days_left: daysLeft,
        total_receive_if_complete:
          toNumber(row.locked_principal) + toNumber(row.earned_profit),
      };
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/funds/history", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `
      SELECT
        uf.id,
        uf.user_id,
        uf.plan_id,
        uf.amount,
        uf.locked_principal,
        uf.selected_daily_profit_percent,
        uf.total_days,
        uf.current_day,
        uf.earned_profit,
        uf.status,
        uf.started_at,
        uf.ends_at,
        uf.last_profit_at,
        uf.completed_at,
        uf.created_at,
        fp.name AS plan_name
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
      `,
      [userId]
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        total_received:
          String(row.status || "").toLowerCase() === "completed"
            ? toNumber(row.locked_principal) + toNumber(row.earned_profit)
            : 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/funds/apply", authenticateUser, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const userId = req.user.id;
    const planId = Number(req.body?.plan_id);
    const amount = toNumber(req.body?.amount);

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan is required",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    await connection.beginTransaction();

    const [planRows] = await connection.execute(
      `
      SELECT
        id,
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        is_active
      FROM fund_plans
      WHERE id = ?
      LIMIT 1
      `,
      [planId]
    );

    const plan = planRows?.[0];

    if (!plan || Number(plan.is_active) !== 1) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Fund plan not found or inactive",
      });
    }

    const minAmount = toNumber(plan.min_amount);
    const maxAmount = plan.max_amount === null ? null : toNumber(plan.max_amount);

    if (amount < minAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Minimum amount for this plan is ${minAmount} USDT`,
      });
    }

    if (maxAmount !== null && amount > maxAmount) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Maximum amount for this plan is ${maxAmount} USDT`,
      });
    }

    if (plan.user_limit_count !== null) {
      const [usageRows] = await connection.execute(
        `
        SELECT COUNT(*) AS total_used
        FROM user_funds
        WHERE user_id = ? AND plan_id = ?
        `,
        [userId, planId]
      );

      const totalUsed = Number(usageRows?.[0]?.total_used || 0);

      if (totalUsed >= Number(plan.user_limit_count)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: "You have reached the usage limit for this fund plan",
        });
      }
    }

    const [userRows] = await connection.execute(
      `
      SELECT id, balance
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const user = userRows?.[0];

    if (!user) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentBalance = toNumber(user.balance);

    if (amount > currentBalance) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    const selectedDailyRate = randomRate(
      plan.min_daily_profit_percent,
      plan.max_daily_profit_percent
    );

    const startedAt = new Date();
    const endsAt = addDays(startedAt, Number(plan.duration_days || 0));

    await connection.execute(
      `
      UPDATE users
      SET balance = balance - ?
      WHERE id = ?
      `,
      [amount, userId]
    );

    const [insertResult] = await connection.execute(
      `
      INSERT INTO user_funds (
        user_id,
        plan_id,
        amount,
        locked_principal,
        selected_daily_profit_percent,
        total_days,
        current_day,
        earned_profit,
        status,
        started_at,
        ends_at,
        last_profit_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'active', ?, ?, NULL)
      `,
      [
        userId,
        planId,
        amount,
        amount,
        selectedDailyRate,
        Number(plan.duration_days || 0),
        startedAt,
        endsAt,
      ]
    );

    try {
      await createUserNotification(connection, {
        userId,
        title: "Fund Applied",
        message: `${plan.name} started with ${amount.toFixed(2)} USDT at ${selectedDailyRate}% daily rate.`,
        type: "funds",
      });
    } catch (_notificationError) {}

    await connection.commit();

    res.json({
      success: true,
      message: "Fund applied successfully",
      data: {
        fund_id: insertResult.insertId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount,
        selected_daily_profit_percent: selectedDailyRate,
        total_days: Number(plan.duration_days || 0),
        started_at: startedAt,
        ends_at: endsAt,
        remaining_balance: currentBalance - amount,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/funds/completed-latest", authenticateUser, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.execute(
      `
      SELECT
        uf.id,
        uf.user_id,
        uf.plan_id,
        uf.locked_principal,
        uf.earned_profit,
        uf.selected_daily_profit_percent,
        uf.total_days,
        uf.current_day,
        uf.status,
        uf.started_at,
        uf.ends_at,
        uf.completed_at,
        fp.name AS plan_name
      FROM user_funds uf
      INNER JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.user_id = ? AND uf.status = 'completed'
      ORDER BY uf.completed_at DESC, uf.id DESC
      LIMIT 1
      `,
      [userId]
    );

    const row = rows?.[0] || null;

    if (!row) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const principal = toNumber(row.locked_principal);
    const profit = toNumber(row.earned_profit);

    res.json({
      success: true,
      data: {
        ...row,
        total_received: principal + profit,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/funds/settle-daily", async (req, res, next) => {
  try {
    const result = await settleDailyFunds();

    res.json({
      success: true,
      message: "Daily fund settlement completed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

setInterval(async () => {
  try {
    const result = await settleDailyFunds();

    if (result.creditedCount > 0 || result.completedCount > 0) {
      console.log(
        `[FUNDS] Daily settlement complete. Credited: ${result.creditedCount}, Completed: ${result.completedCount}`
      );
    }
  } catch (error) {
    console.error("[FUNDS] Daily settlement failed:", error.message);
  }
}, 60 * 1000);

/* =========================
   LOANS
========================= */

app.post("/api/loans/apply", authenticateUser, async (req, res, next) => {
  try {
    const amount = Number(req.body.amount || 0);
    const durationCount = Number(
      req.body.durationCount || req.body.duration_count || 1
    );
    const loanReason = String(
      req.body.reason || req.body.loan_reason || ""
    ).trim();
    const repaymentSource = String(
      req.body.repaymentSource || req.body.repayment_source || ""
    ).trim();
    const additionalNote = String(req.body.note || "").trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      throw createError(400, "Invalid loan amount");
    }

    if (!Number.isFinite(durationCount) || durationCount <= 0) {
      throw createError(400, "Invalid duration count");
    }

    const [settingsRows] = await pool.execute(
      `SELECT interest_rate, interest_type
       FROM loan_settings
       WHERE id = 1
       LIMIT 1`
    );

    const settings = settingsRows[0] || {
      interest_rate: 0,
      interest_type: "weekly",
    };

    const interestRate = Number(settings.interest_rate || 0);
    const interestAmountPerPeriod = Number(
      ((amount * interestRate) / 100).toFixed(2)
    );
    const totalInterest = Number(
      (interestAmountPerPeriod * durationCount).toFixed(2)
    );
    const totalRepayment = Number((amount + totalInterest).toFixed(2));

    const [columns] = await pool.execute(`SHOW COLUMNS FROM loans`);
    const columnNames = columns.map((col) => String(col.Field || "").toLowerCase());

    const valuesMap = {
      user_id: req.user.id,
      amount,
      interest_rate: interestRate,
      interest_amount: totalInterest,
      interest_type: settings.interest_type,
      duration_count: durationCount,
      loan_reason: loanReason || null,
      repayment_source: repaymentSource || null,
      note: additionalNote || null,
      total_repayment: totalRepayment,
      status: "pending",
    };

    const insertColumns = [];
    const insertValues = [];
    const placeholders = [];

    for (const [key, value] of Object.entries(valuesMap)) {
      if (columnNames.includes(key)) {
        insertColumns.push(key);
        insertValues.push(value);
        placeholders.push("?");
      }
    }

    if (columnNames.includes("created_at")) {
      insertColumns.push("created_at");
      placeholders.push("NOW()");
    }

    if (columnNames.includes("updated_at")) {
      insertColumns.push("updated_at");
      placeholders.push("NOW()");
    }

    const [result] = await pool.execute(
      `INSERT INTO loans
       (${insertColumns.join(", ")})
       VALUES (${placeholders.join(", ")})`,
      insertValues
    );

    res.json({
      success: true,
      message: "Loan request submitted",
      data: {
        id: result.insertId,
        amount,
        durationCount,
        interestRate,
        interestAmount: totalInterest,
        interestType: settings.interest_type,
        totalRepayment,
        status: "pending",
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/loans", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM loans
       WHERE user_id = ?
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/loans", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT l.*, u.name, u.email
       FROM loans l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/loans/:id/approve", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const loanId = Number(req.params.id);

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT * FROM loans WHERE id = ? LIMIT 1 FOR UPDATE`,
      [loanId]
    );

    if (!rows.length) throw createError(404, "Loan not found");

    const loan = rows[0];

    if (loan.status !== "pending") throw createError(400, "Already processed");

    await connection.execute(`UPDATE users SET balance = balance + ? WHERE id = ?`, [
      loan.amount,
      loan.user_id,
    ]);

    await connection.execute(
      `UPDATE loans
       SET status = 'approved', approved_at = NOW()
       WHERE id = ?`,
      [loanId]
    );

    await createTransactionLog(connection, {
      userId: loan.user_id,
      type: "loan_credit",
      amount: loan.amount,
      status: "completed",
      referenceId: loan.id,
      note: "Loan approved",
    });

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "approve_loan",
      targetUserId: loan.user_id,
      referenceId: loan.id,
      note: `Approved loan #${loan.id}`,
    });

    await createUserNotification(connection, {
      userId: loan.user_id,
      title: "Loan approved",
      message: `Your loan request for ${loan.amount} has been approved.`,
      type: "general",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Loan approved",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/loans/:id/reject", authenticateAdmin, async (req, res, next) => {
  try {
    const loanId = Number(req.params.id);

    const [rows] = await pool.execute(
      `SELECT * FROM loans WHERE id = ? LIMIT 1`,
      [loanId]
    );
    if (!rows.length) throw createError(404, "Loan not found");

    const loan = rows[0];

    await pool.execute(`UPDATE loans SET status = 'rejected' WHERE id = ?`, [loanId]);

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "reject_loan",
      referenceId: loanId,
      note: `Rejected loan #${loanId}`,
    });

    await createUserNotification(pool, {
      userId: loan.user_id,
      title: "Loan rejected",
      message: `Your loan request has been rejected.`,
      type: "general",
    });

    res.json({
      success: true,
      message: "Loan rejected",
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/loan-settings", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, interest_rate, interest_type, created_at, updated_at
       FROM loan_settings
       WHERE id = 1
       LIMIT 1`
    );

    res.json({
      success: true,
      data: rows[0] || {
        id: 1,
        interest_rate: 0,
        interest_type: "weekly",
      },
    });
  } catch (error) {
    next(error);
  }
});

async function saveLoanSettings(req, res, next) {
  try {
    const rate = Number(req.body.interest_rate || 0);
    const type = String(req.body.interest_type || "weekly")
      .trim()
      .toLowerCase();

    if (!Number.isFinite(rate) || rate < 0) {
      throw createError(400, "Invalid interest rate");
    }

    if (!["daily", "weekly", "monthly", "yearly"].includes(type)) {
      throw createError(400, "Invalid interest type");
    }

    await pool.execute(
      `INSERT INTO loan_settings (id, interest_rate, interest_type, created_at, updated_at)
       VALUES (1, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         interest_rate = VALUES(interest_rate),
         interest_type = VALUES(interest_type),
         updated_at = NOW()`,
      [rate, type]
    );

    const [rows] = await pool.execute(
      `SELECT id, interest_rate, interest_type, created_at, updated_at
       FROM loan_settings
       WHERE id = 1
       LIMIT 1`
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_loan_settings",
      referenceId: 1,
      note: `Updated loan settings to ${rate}% ${type}`,
    });

    res.json({
      success: true,
      message: "Loan settings updated",
      data: rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
}

app.post("/api/admin/loan-settings", authenticateAdmin, saveLoanSettings);
app.put("/api/admin/loan-settings", authenticateAdmin, saveLoanSettings);

/* =========================
   LEGAL DOCUMENTS
========================= */

async function getPublicLegalDocuments(_req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         file_url,
         file_name,
         file_type,
         status,
         created_at,
         updated_at
       FROM legal_documents
       WHERE status = 'active'
       ORDER BY id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
}

app.get("/api/legal-documents", getPublicLegalDocuments);
app.get("/api/legal-docs", getPublicLegalDocuments);

async function getAdminLegalDocuments(_req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT
         id,
         title,
         content,
         file_url,
         file_name,
         file_type,
         status,
         created_at,
         updated_at
       FROM legal_documents
       ORDER BY id DESC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
}

app.get("/api/admin/legal-documents", authenticateAdmin, getAdminLegalDocuments);
app.get("/api/admin/legal-docs", authenticateAdmin, getAdminLegalDocuments);

async function createAdminLegalDocument(req, res, next) {
  try {
    const title = String(req.body.title || "").trim();
    const content = String(req.body.content || "").trim();
    const status = normalizeLegalStatus(req.body.status);

    if (!title) throw createError(400, "Title is required");
    if (!content) throw createError(400, "Content is required");

    const fileUrl = getLegalFileUrl(req.file);
    const fileName = req.file ? req.file.originalname : null;
    const fileType = req.file ? req.file.mimetype : null;

    const [result] = await pool.execute(
      `INSERT INTO legal_documents
       (title, content, file_url, file_name, file_type, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, content, fileUrl, fileName, fileType, status]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "create_legal_document",
      referenceId: result.insertId,
      note: `Created legal document ${title}`,
    });

    res.json({
      success: true,
      message: "Legal document created successfully",
      data: {
        id: result.insertId,
        title,
        content,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
}

app.post(
  "/api/admin/legal-documents",
  authenticateAdmin,
  upload.single("legal_file"),
  createAdminLegalDocument
);

app.post(
  "/api/admin/legal-docs",
  authenticateAdmin,
  upload.single("legal_file"),
  createAdminLegalDocument
);

async function updateAdminLegalDocument(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw createError(400, "Invalid legal document id");
    }

    const [rows] = await pool.execute(
      `SELECT id, title, content, file_url, file_name, file_type, status
       FROM legal_documents
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) throw createError(404, "Legal document not found");

    const current = rows[0];

    const title = String(req.body.title ?? current.title ?? "").trim();
    const content = String(req.body.content ?? current.content ?? "").trim();
    const status =
      req.body.status === undefined
        ? normalizeLegalStatus(current.status)
        : normalizeLegalStatus(req.body.status);

    const removeFile =
      String(req.body.remove_file || "").trim() === "1" ||
      String(req.body.remove_file || "").trim().toLowerCase() === "true";

    if (!title) throw createError(400, "Title is required");
    if (!content) throw createError(400, "Content is required");

    let fileUrl = current.file_url || null;
    let fileName = current.file_name || null;
    let fileType = current.file_type || null;

    if (req.file) {
      removeUploadedFile(current.file_url);
      fileUrl = getLegalFileUrl(req.file);
      fileName = req.file.originalname || null;
      fileType = req.file.mimetype || null;
    } else if (removeFile) {
      removeUploadedFile(current.file_url);
      fileUrl = null;
      fileName = null;
      fileType = null;
    }

    await pool.execute(
      `UPDATE legal_documents
       SET title = ?,
           content = ?,
           file_url = ?,
           file_name = ?,
           file_type = ?,
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [title, content, fileUrl, fileName, fileType, status, id]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_legal_document",
      referenceId: id,
      note: `Updated legal document #${id}`,
    });

    res.json({
      success: true,
      message: "Legal document updated successfully",
      data: {
        id,
        title,
        content,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        status,
      },
    });
  } catch (error) {
    next(error);
  }
}

app.put(
  "/api/admin/legal-documents/:id",
  authenticateAdmin,
  upload.single("legal_file"),
  updateAdminLegalDocument
);

app.put(
  "/api/admin/legal-docs/:id",
  authenticateAdmin,
  upload.single("legal_file"),
  updateAdminLegalDocument
);

async function deleteAdminLegalDocument(req, res, next) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw createError(400, "Invalid legal document id");
    }

    const [rows] = await pool.execute(
      `SELECT id, file_url
       FROM legal_documents
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      throw createError(404, "Legal document not found");
    }

    removeUploadedFile(rows[0].file_url);

    const [result] = await pool.execute(
      `DELETE FROM legal_documents
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      throw createError(404, "Legal document not found");
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "delete_legal_document",
      referenceId: id,
      note: `Deleted legal document #${id}`,
    });

    res.json({
      success: true,
      message: "Legal document deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

app.delete("/api/admin/legal-documents/:id", authenticateAdmin, deleteAdminLegalDocument);
app.delete("/api/admin/legal-docs/:id", authenticateAdmin, deleteAdminLegalDocument);

/* =========================
   SUPPORT
========================= */

app.get("/api/support", async (_req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

app.get("/api/support/contact", async (_req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/support", authenticateAdmin, async (_req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/support-contact", authenticateAdmin, async (_req, res, next) => {
  try {
    const data = await getSupportSettings();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/support", authenticateAdmin, async (req, res, next) => {
  try {
    const channel = String(req.body.channel || "").trim();
    const contact = String(req.body.contact || "").trim();
    const link = String(req.body.link || "").trim();
    const note = String(req.body.note || "").trim();

    const [rows] = await pool.execute(
      `SELECT id FROM support_settings ORDER BY id ASC LIMIT 1`
    );

    if (rows.length) {
      await pool.execute(
        `UPDATE support_settings
         SET channel = ?, contact = ?, link = ?, note = ?, updated_at = NOW()
         WHERE id = ?`,
        [channel, contact, link, note, rows[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO support_settings
         (channel, contact, link, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [channel, contact, link, note]
      );
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_support_settings",
      note: "Updated customer service contact settings",
    });

    res.json({
      success: true,
      message: "Support settings updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/support-contact", authenticateAdmin, async (req, res, next) => {
  try {
    const channel = String(req.body.channel || "").trim();
    const contact = String(req.body.contact || "").trim();
    const link = String(req.body.link || "").trim();
    const note = String(req.body.note || "").trim();

    const [rows] = await pool.execute(
      `SELECT id FROM support_settings ORDER BY id ASC LIMIT 1`
    );

    if (rows.length) {
      await pool.execute(
        `UPDATE support_settings
         SET channel = ?, contact = ?, link = ?, note = ?, updated_at = NOW()
         WHERE id = ?`,
        [channel, contact, link, note, rows[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO support_settings
         (channel, contact, link, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [channel, contact, link, note]
      );
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_support_contact",
      note: "Updated customer service contact settings",
    });

    res.json({
      success: true,
      message: "Support contact updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN SETTINGS
========================= */

app.get("/api/admin/settings", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT setting_key, setting_value
       FROM platform_settings
       ORDER BY setting_key ASC`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/settings/:key", authenticateAdmin, async (req, res, next) => {
  try {
    const key = String(req.params.key || "").trim();
    const value = String(req.body?.value ?? "").trim();

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Setting key is required",
      });
    }

    await pool.execute(
      `INSERT INTO platform_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         setting_value = VALUES(setting_value),
         updated_at = NOW()`,
      [key, value]
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_platform_setting",
      referenceId: null,
      note: `Updated platform setting: ${key}`,
    });

    res.json({
      success: true,
      message: "Setting updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN DASHBOARD
========================= */

app.get("/api/admin/dashboard", authenticateAdmin, async (_req, res, next) => {
  try {
    const [[usersRow]] = await pool.execute("SELECT COUNT(*) AS total FROM users");
    const [[tradesRow]] = await pool.execute("SELECT COUNT(*) AS total FROM trades");
    const [[depositsRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM deposits WHERE LOWER(status) = 'pending'"
    );
    const [[withdrawalsRow]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM withdrawals WHERE LOWER(status) = 'pending'"
    );

    let convertsTotal = 0;
    try {
      const [[convertsRow]] = await pool.execute(
        "SELECT COUNT(*) AS total FROM convert_transactions"
      );
      convertsTotal = Number(convertsRow?.total || 0);
    } catch (_error) {}

    let loansTotal = 0;
    try {
      const [[loansRow]] = await pool.execute("SELECT COUNT(*) AS total FROM loans");
      loansTotal = Number(loansRow?.total || 0);
    } catch (_error) {}

    res.json({
      success: true,
      data: {
        totalUsers: Number(usersRow?.total || 0),
        totalTrades: Number(tradesRow?.total || 0),
        totalDeposits: Number(depositsRow?.total || 0),
        totalWithdrawals: Number(withdrawalsRow?.total || 0),
        totalConverts: convertsTotal,
        totalLoans: loansTotal,
        users: Number(usersRow?.total || 0),
        trades: Number(tradesRow?.total || 0),
        pendingDeposits: Number(depositsRow?.total || 0),
        pendingWithdrawals: Number(withdrawalsRow?.total || 0),
        converts: convertsTotal,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN USERS
========================= */

app.get("/api/admin/users", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        email,
        balance,
        status,
        email_verified,
        kyc_status,
        approved_at,
        trading_fee_tier,
        twofa_enabled,
        avatar_url,
        CASE
          WHEN passcode IS NOT NULL AND TRIM(passcode) <> '' THEN 1
          ELSE 0
        END AS has_passcode,
        created_at,
        updated_at
       FROM users
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw createError(400, "Invalid user id");
    }

    const [rows] = await pool.execute(
      `SELECT
        id,
        uid,
        name,
        first_name,
        last_name,
        gender,
        date_of_birth,
        country,
        email,
        balance,
        status,
        email_verified,
        kyc_status,
        approved_at,
        trading_fee_tier,
        twofa_enabled,
        avatar_url,
        CASE
          WHEN passcode IS NOT NULL AND TRIM(passcode) <> '' THEN 1
          ELSE 0
        END AS has_passcode,
        created_at,
        updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) throw createError(404, "User not found");

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users/:id/security", authenticateAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw createError(400, "Invalid user id");
    }

    const [rows] = await pool.execute(
      `SELECT
        id,
        status,
        trading_fee_tier,
        email_verified,
        twofa_enabled,
        CASE
          WHEN passcode IS NOT NULL AND TRIM(passcode) <> '' THEN 1
          ELSE 0
        END AS has_passcode,
        kyc_status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (!rows.length) throw createError(404, "User not found");

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/users/:id/security", authenticateAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw createError(400, "Invalid user id");
    }

    const status = String(req.body.status || "").trim().toLowerCase();
    const tradingFeeTier = normalizeTradingFeeTier(req.body.trading_fee_tier);
    const twofaEnabled = Number(req.body.twofa_enabled) === 1 ? 1 : 0;
    const emailVerified = Number(req.body.email_verified) === 1 ? 1 : 0;

    if (!["active", "disabled", "frozen"].includes(status)) {
      throw createError(400, "Invalid status");
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET status = ?,
           trading_fee_tier = ?,
           twofa_enabled = ?,
           email_verified = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [status, tradingFeeTier, twofaEnabled, emailVerified, userId]
    );

    if (result.affectedRows === 0) {
      throw createError(404, "User not found");
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_user_security",
      targetUserId: userId,
      referenceId: userId,
      note: `Updated security for user #${userId}`,
    });

    res.json({
      success: true,
      message: "User security updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/users/:id/add-funds", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const note = String(req.body.note || "").trim();

    if (!Number.isFinite(userId) || userId <= 0)
      throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Invalid amount");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, balance, status
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!rows.length) throw createError(404, "User not found");

    await connection.execute(
      `UPDATE users
       SET balance = balance + ?,
           updated_at = NOW()
       WHERE id = ?`,
      [amount, userId]
    );

    await createTransactionLog(connection, {
      userId,
      type: "admin_credit",
      amount,
      status: "completed",
      referenceId: userId,
      note: note || `Manual fund added by admin ${req.admin.id}`,
    });

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "add_user_funds",
      targetUserId: userId,
      referenceId: userId,
      note: note || `Added ${amount} funds to user #${userId}`,
    });

    await createUserNotification(connection, {
      userId,
      title: "Balance updated",
      message: `Admin added ${amount} to your balance.`,
      type: "general",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Funds added successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/users/:id/decrease-funds", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const userId = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const note = String(req.body.note || "").trim();

    if (!Number.isFinite(userId) || userId <= 0)
      throw createError(400, "Invalid user id");
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Invalid amount");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, balance
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!rows.length) throw createError(404, "User not found");

    const currentBalance = Number(rows[0].balance || 0);
    if (currentBalance < amount)
      throw createError(400, "User balance is not enough");

    await connection.execute(
      `UPDATE users
       SET balance = balance - ?,
           updated_at = NOW()
       WHERE id = ?`,
      [amount, userId]
    );

    await createTransactionLog(connection, {
      userId,
      type: "admin_debit",
      amount,
      status: "completed",
      referenceId: userId,
      note: note || `Manual balance deduction by admin ${req.admin.id}`,
    });

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "decrease_user_funds",
      targetUserId: userId,
      referenceId: userId,
      note: note || `Decreased ${amount} funds from user #${userId}`,
    });

    await createUserNotification(connection, {
      userId,
      title: "Balance updated",
      message: `Admin decreased ${amount} from your balance.`,
      type: "security",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Funds decreased successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.put("/api/admin/users/:id/status", authenticateAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const status = String(req.body.status || "").trim().toLowerCase();

    if (!Number.isFinite(userId) || userId <= 0)
      throw createError(400, "Invalid user id");
    if (!["active", "disabled", "frozen"].includes(status)) {
      throw createError(400, "Invalid status");
    }

    const [result] = await pool.execute(
      `UPDATE users
       SET status = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, userId]
    );

    if (result.affectedRows === 0) throw createError(404, "User not found");

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_user_status",
      targetUserId: userId,
      referenceId: userId,
      note: `Changed user #${userId} status to ${status}`,
    });

    await createUserNotification(pool, {
      userId,
      title: "Account status changed",
      message: `Your account status has been changed to ${status}.`,
      type: "security",
    });

    res.json({
      success: true,
      message: "User status updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/users/:id", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const userId = Number(req.params.id);

    if (!Number.isFinite(userId) || userId <= 0)
      throw createError(400, "Invalid user id");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, email
       FROM users
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!rows.length) throw createError(404, "User not found");

    await connection.execute(`DELETE FROM transactions WHERE user_id = ?`, [userId]);
    await connection.execute(`DELETE FROM trades WHERE user_id = ?`, [userId]);
    await connection.execute(`DELETE FROM deposits WHERE user_id = ?`, [userId]);
    await connection.execute(`DELETE FROM withdrawals WHERE user_id = ?`, [userId]);

    try {
      await connection.execute(`DELETE FROM user_kyc WHERE user_id = ?`, [userId]);
    } catch (_error) {}

    try {
      await connection.execute(
        `DELETE FROM user_exchange_profiles WHERE user_id = ?`,
        [userId]
      );
    } catch (_error) {}

    try {
      await connection.execute(
        `DELETE FROM convert_transactions WHERE user_id = ?`,
        [userId]
      );
    } catch (_error) {}

    try {
      await connection.execute(
        `DELETE FROM user_notifications WHERE user_id = ?`,
        [userId]
      );
    } catch (_error) {}

    await connection.execute(`DELETE FROM users WHERE id = ?`, [userId]);

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "delete_user",
      targetUserId: userId,
      referenceId: userId,
      note: `Deleted user #${userId}`,
    });

    await connection.commit();

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* =========================
   ADMIN KYC
========================= */

app.get("/api/admin/kyc", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
        uk.id,
        uk.user_id,
        uk.residence_country,
        uk.document_type,
        uk.document_number,
        uk.document_front_url,
        uk.document_back_url,
        uk.verification_status,
        uk.admin_note,
        uk.submitted_at,
        uk.reviewed_at,
        uk.reviewed_by,
        u.uid,
        u.name,
        u.first_name,
        u.last_name,
        u.email,
        u.kyc_status,
        u.email_verified
       FROM user_kyc uk
       INNER JOIN users u ON u.id = uk.user_id
       ORDER BY uk.id DESC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/kyc/:id/approve", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const kycId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(kycId) || kycId <= 0)
      throw createError(400, "Invalid KYC id");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM user_kyc
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [kycId]
    );

    if (!rows.length) throw createError(404, "KYC submission not found");

    const kyc = rows[0];

    await connection.execute(
      `UPDATE user_kyc
       SET verification_status = 'approved',
           admin_note = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [adminNote || "Approved by admin", req.admin.id, kycId]
    );

    await connection.execute(
      `UPDATE users
       SET kyc_status = 'approved',
           approved_at = NOW(),
           country = COALESCE(NULLIF(?, ''), country),
           updated_at = NOW()
       WHERE id = ?`,
      [kyc.residence_country || "", kyc.user_id]
    );

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "approve_kyc",
      targetUserId: kyc.user_id,
      referenceId: kycId,
      note: adminNote || `Approved KYC #${kycId}`,
    });

    await createUserNotification(connection, {
      userId: kyc.user_id,
      title: "KYC approved",
      message: "Your identity verification has been approved.",
      type: "security",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "KYC approved successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/kyc/:id/reject", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const kycId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(kycId) || kycId <= 0)
      throw createError(400, "Invalid KYC id");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM user_kyc
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [kycId]
    );

    if (!rows.length) throw createError(404, "KYC submission not found");

    const kyc = rows[0];

    await connection.execute(
      `UPDATE user_kyc
       SET verification_status = 'rejected',
           admin_note = ?,
           reviewed_by = ?,
           reviewed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [adminNote || "Rejected by admin", req.admin.id, kycId]
    );

    await connection.execute(
      `UPDATE users
       SET kyc_status = 'rejected',
           updated_at = NOW()
       WHERE id = ?`,
      [kyc.user_id]
    );

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "reject_kyc",
      targetUserId: kyc.user_id,
      referenceId: kycId,
      note: adminNote || `Rejected KYC #${kycId}`,
    });

    await createUserNotification(connection, {
      userId: kyc.user_id,
      title: "KYC rejected",
      message: adminNote || "Your identity verification has been rejected.",
      type: "security",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "KYC rejected successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* =========================
   ADMIN DEPOSITS
========================= */

app.get("/api/admin/deposits", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM deposits
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/deposits/:id/approve", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const depositId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(depositId) || depositId <= 0) {
      throw createError(400, "Invalid deposit id");
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM deposits
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [depositId]
    );

    if (!rows.length) throw createError(404, "Deposit not found");

    const deposit = rows[0];
    const currentStatus = String(deposit.status || "").toLowerCase();

    if (currentStatus !== "pending")
      throw createError(400, "Deposit already processed");

    const amount = Number(deposit.amount || 0);

    await connection.execute(
      `UPDATE users
       SET balance = balance + ?
       WHERE id = ?`,
      [amount, deposit.user_id]
    );

    try {
      await connection.execute(
        `UPDATE deposits
         SET status = 'approved',
             admin_note = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [adminNote || "Approved by admin", depositId]
      );
    } catch (_error) {
      await connection.execute(
        `UPDATE deposits SET status = 'approved' WHERE id = ?`,
        [depositId]
      );
    }

    await createTransactionLog(connection, {
      userId: deposit.user_id,
      type: "deposit_approved",
      amount,
      status: "completed",
      referenceId: deposit.id,
      note: adminNote || `Deposit #${deposit.id} approved by admin`,
    });

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "approve_deposit",
      targetUserId: deposit.user_id,
      referenceId: deposit.id,
      note: adminNote || `Approved deposit #${deposit.id}`,
    });

    await createUserNotification(connection, {
      userId: deposit.user_id,
      title: "Deposit approved",
      message: `Your deposit of ${amount} ${
        deposit.coin || "USDT"
      } has been approved.`,
      type: "general",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Deposit approved successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/deposits/:id/reject", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const depositId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(depositId) || depositId <= 0) {
      throw createError(400, "Invalid deposit id");
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM deposits
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [depositId]
    );

    if (!rows.length) throw createError(404, "Deposit not found");

    const deposit = rows[0];
    const currentStatus = String(deposit.status || "").toLowerCase();

    if (currentStatus !== "pending")
      throw createError(400, "Deposit already processed");

    try {
      await connection.execute(
        `UPDATE deposits
         SET status = 'rejected',
             admin_note = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [adminNote || "Rejected by admin", depositId]
      );
    } catch (_error) {
      await connection.execute(
        `UPDATE deposits SET status = 'rejected' WHERE id = ?`,
        [depositId]
      );
    }

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "reject_deposit",
      targetUserId: deposit.user_id,
      referenceId: deposit.id,
      note: adminNote || `Rejected deposit #${deposit.id}`,
    });

    await createUserNotification(connection, {
      userId: deposit.user_id,
      title: "Deposit rejected",
      message: adminNote || "Your deposit request has been rejected.",
      type: "security",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Deposit rejected successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* =========================
   ADMIN DEPOSIT NETWORKS
========================= */

app.get("/api/admin/deposit-networks", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM deposit_wallets
       ORDER BY
         CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,
         sort_order ASC,
         id DESC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/admin/deposit-networks/upload-qr",
  authenticateAdmin,
  upload.single("qr"),
  (req, res, next) => {
    try {
      if (!req.file) throw createError(400, "QR image file is required");

      res.json({
        success: true,
        url: `/uploads/qrcodes/${req.file.filename}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/admin/deposit-networks", authenticateAdmin, async (req, res, next) => {
  try {
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const displayLabel = String(req.body.display_label || "").trim();
    const address = String(req.body.address || "").trim();
    const minimumDeposit = Number(req.body.minimum_deposit || 0);
    const sortOrder = Number(req.body.sort_order || 0);
    const qrImageUrl = String(req.body.qr_image_url || "").trim();
    const instructions = String(req.body.instructions || "").trim();
    const status = String(req.body.status || "active").trim().toLowerCase();

    if (!coin) throw createError(400, "Coin is required");
    if (!network) throw createError(400, "Network is required");
    if (!address) throw createError(400, "Address is required");
    if (!["active", "inactive"].includes(status))
      throw createError(400, "Invalid status");

    const [columns] = await pool.execute(`SHOW COLUMNS FROM deposit_wallets`);
    const columnNames = columns.map((col) => String(col.Field || "").toLowerCase());

    const valuesMap = {
      coin,
      network,
      display_label: displayLabel || `${coin} ${network}`,
      address,
      minimum_deposit: minimumDeposit,
      sort_order: sortOrder,
      qr_image_url: qrImageUrl || null,
      instructions: instructions || null,
      status,
    };

    const insertColumns = [];
    const insertValues = [];
    const placeholders = [];

    for (const [key, value] of Object.entries(valuesMap)) {
      if (columnNames.includes(key)) {
        insertColumns.push(key);
        insertValues.push(value);
        placeholders.push("?");
      }
    }

    if (columnNames.includes("created_at")) {
      insertColumns.push("created_at");
      placeholders.push("NOW()");
    }

    if (columnNames.includes("updated_at")) {
      insertColumns.push("updated_at");
      placeholders.push("NOW()");
    }

    const [result] = await pool.execute(
      `INSERT INTO deposit_wallets
       (${insertColumns.join(", ")})
       VALUES (${placeholders.join(", ")})`,
      insertValues
    );

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "create_deposit_network",
      referenceId: result.insertId,
      note: `Created deposit network ${coin} ${network}`,
    });

    res.json({
      success: true,
      message: "Deposit network created successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/deposit-networks/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const displayLabel = String(req.body.display_label || "").trim();
    const address = String(req.body.address || "").trim();
    const minimumDeposit = Number(req.body.minimum_deposit || 0);
    const sortOrder = Number(req.body.sort_order || 0);
    const qrImageUrl = String(req.body.qr_image_url || "").trim();
    const instructions = String(req.body.instructions || "").trim();
    const status = String(req.body.status || "active").trim().toLowerCase();

    if (!Number.isFinite(id) || id <= 0)
      throw createError(400, "Invalid network id");
    if (!coin) throw createError(400, "Coin is required");
    if (!network) throw createError(400, "Network is required");
    if (!address) throw createError(400, "Address is required");
    if (!["active", "inactive"].includes(status))
      throw createError(400, "Invalid status");

    const [columns] = await pool.execute(`SHOW COLUMNS FROM deposit_wallets`);
    const columnNames = columns.map((col) => String(col.Field || "").toLowerCase());

    const sets = [];
    const values = [];

    const valuesMap = {
      coin,
      network,
      display_label: displayLabel || `${coin} ${network}`,
      address,
      minimum_deposit: minimumDeposit,
      sort_order: sortOrder,
      qr_image_url: qrImageUrl || null,
      instructions: instructions || null,
      status,
    };

    for (const [key, value] of Object.entries(valuesMap)) {
      if (columnNames.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (columnNames.includes("updated_at")) {
      sets.push("updated_at = NOW()");
    }

    values.push(id);

    const [result] = await pool.execute(
      `UPDATE deposit_wallets
       SET ${sets.join(", ")}
       WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0)
      throw createError(404, "Deposit network not found");

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_deposit_network",
      referenceId: id,
      note: `Updated deposit network #${id}`,
    });

    res.json({
      success: true,
      message: "Deposit network updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/deposit-networks/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0)
      throw createError(400, "Invalid network id");

    const [result] = await pool.execute(
      `DELETE FROM deposit_wallets WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0)
      throw createError(404, "Deposit network not found");

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "delete_deposit_network",
      referenceId: id,
      note: `Deleted deposit network #${id}`,
    });

    res.json({
      success: true,
      message: "Deposit network deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN WITHDRAWAL FEES
========================= */

app.get("/api/admin/withdrawal-fees", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM withdrawal_fees
       ORDER BY coin ASC, network ASC, id DESC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/withdrawal-fees", authenticateAdmin, async (req, res, next) => {
  try {
    const coin = String(req.body.coin || "").trim().toUpperCase();
    const network = String(req.body.network || "").trim().toUpperCase();
    const feeAmount = Number(req.body.fee_amount || 0);
    const feeType = String(req.body.fee_type || "fixed").trim().toLowerCase();
    const status = String(req.body.status || "active").trim().toLowerCase();

    if (!coin) throw createError(400, "Coin is required");
    if (!network) throw createError(400, "Network is required");
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      throw createError(400, "Fee amount must be 0 or greater");
    }
    if (!["fixed", "percent"].includes(feeType))
      throw createError(400, "Invalid fee type");
    if (!["active", "inactive"].includes(status))
      throw createError(400, "Invalid status");

    const [rows] = await pool.execute(
      `SELECT id
       FROM withdrawal_fees
       WHERE coin = ?
         AND network = ?
       LIMIT 1`,
      [coin, network]
    );

    if (rows.length) {
      await pool.execute(
        `UPDATE withdrawal_fees
         SET fee_amount = ?, fee_type = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [feeAmount, feeType, status, rows[0].id]
      );
    } else {
      await pool.execute(
        `INSERT INTO withdrawal_fees
         (coin, network, fee_amount, fee_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [coin, network, feeAmount, feeType, status]
      );
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_withdrawal_fee",
      note: `Updated withdrawal fee for ${coin} ${network}`,
    });

    res.json({
      success: true,
      message: "Withdrawal fee saved successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/withdrawal-fees/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      throw createError(400, "Invalid withdrawal fee id");
    }

    const [result] = await pool.execute(
      `DELETE FROM withdrawal_fees
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      throw createError(404, "Withdrawal fee not found");
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "delete_withdrawal_fee",
      referenceId: id,
      note: `Deleted withdrawal fee #${id}`,
    });

    res.json({
      success: true,
      message: "Withdrawal fee deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN WITHDRAWALS
========================= */

app.get("/api/admin/withdrawals", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM withdrawals
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/withdrawals/:id/approve", authenticateAdmin, async (req, res, next) => {
  try {
    const withdrawalId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      throw createError(400, "Invalid withdrawal id");
    }

    const [rows] = await pool.execute(
      `SELECT *
       FROM withdrawals
       WHERE id = ?
       LIMIT 1`,
      [withdrawalId]
    );

    if (!rows.length) throw createError(404, "Withdrawal not found");

    const withdrawal = rows[0];
    const currentStatus = String(withdrawal.status || "").toLowerCase();

    if (currentStatus !== "pending")
      throw createError(400, "Withdrawal already processed");

    try {
      await pool.execute(
        `UPDATE withdrawals
         SET status = 'approved',
             admin_note = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [adminNote || "Approved by admin", withdrawalId]
      );
    } catch (_error) {
      await pool.execute(
        `UPDATE withdrawals SET status = 'approved' WHERE id = ?`,
        [withdrawalId]
      );
    }

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "approve_withdrawal",
      targetUserId: withdrawal.user_id,
      referenceId: withdrawal.id,
      note: adminNote || `Approved withdrawal #${withdrawal.id}`,
    });

    await createUserNotification(pool, {
      userId: withdrawal.user_id,
      title: "Withdrawal approved",
      message: `Your withdrawal request has been approved.`,
      type: "general",
    });

    res.json({
      success: true,
      message: "Withdrawal approved successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/withdrawals/:id/reject", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const withdrawalId = Number(req.params.id);
    const adminNote = String(req.body?.admin_note || "").trim();

    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      throw createError(400, "Invalid withdrawal id");
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM withdrawals
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [withdrawalId]
    );

    if (!rows.length) throw createError(404, "Withdrawal not found");

    const withdrawal = rows[0];
    const currentStatus = String(withdrawal.status || "").toLowerCase();

    if (currentStatus !== "pending")
      throw createError(400, "Withdrawal already processed");

    const amount = Number(withdrawal.amount || 0);
    const feeAmount = Number(withdrawal.fee_amount || 0);
    const refundAmount = Number((amount + feeAmount).toFixed(8));

    await connection.execute(
      `UPDATE users
       SET balance = balance + ?
       WHERE id = ?`,
      [refundAmount, withdrawal.user_id]
    );

    try {
      await connection.execute(
        `UPDATE withdrawals
         SET status = 'rejected',
             admin_note = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [adminNote || "Rejected by admin", withdrawalId]
      );
    } catch (_error) {
      await connection.execute(
        `UPDATE withdrawals SET status = 'rejected' WHERE id = ?`,
        [withdrawalId]
      );
    }

    await createTransactionLog(connection, {
      userId: withdrawal.user_id,
      type: "withdrawal_rejected_refund",
      amount: refundAmount,
      status: "completed",
      referenceId: withdrawal.id,
      note: adminNote || `Withdrawal #${withdrawal.id} rejected and refunded`,
    });

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "reject_withdrawal",
      targetUserId: withdrawal.user_id,
      referenceId: withdrawal.id,
      note: adminNote || `Rejected withdrawal #${withdrawal.id}`,
    });

    await createUserNotification(connection, {
      userId: withdrawal.user_id,
      title: "Withdrawal rejected",
      message: `Your withdrawal request has been rejected and ${refundAmount} has been refunded to your balance.`,
      type: "security",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Withdrawal rejected and refunded successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* =========================
   ADMIN AUDIT LOGS
========================= */

app.get("/api/admin/audit-logs", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM admin_audit_logs
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/audit-logs", authenticateAdmin, async (_req, res, next) => {
  try {
    await pool.execute(`DELETE FROM admin_audit_logs`);

    res.json({
      success: true,
      message: "Audit logs cleared successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN TRADE RULES
========================= */

app.get("/api/admin/trade-rules", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, timer_seconds, payout_percent, status, created_at
       FROM trade_rules
       ORDER BY timer_seconds ASC`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/trade-rules/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payoutPercent = Number(req.body.payout_percent);
    const status = String(req.body.status || "active").toLowerCase();

    if (!Number.isFinite(id) || id <= 0)
      throw createError(400, "Invalid rule id");
    if (
      !Number.isFinite(payoutPercent) ||
      payoutPercent < 0 ||
      payoutPercent > 100
    ) {
      throw createError(400, "Invalid payout percent");
    }
    if (!["active", "inactive"].includes(status)) {
      throw createError(400, "Invalid trade rule status");
    }

    const [result] = await pool.execute(
      `UPDATE trade_rules
       SET payout_percent = ?, status = ?
       WHERE id = ?`,
      [payoutPercent, status, id]
    );

    if (result.affectedRows === 0)
      throw createError(404, "Trade rule not found");

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "update_trade_rule",
      referenceId: id,
      note: `Updated trade rule #${id}`,
    });

    res.json({
      success: true,
      message: "Trade rule updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN TRADE OUTCOME QUEUE
========================= */

app.get("/api/admin/trade-outcome-queue", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM trade_outcome_queue
       WHERE is_active = 1 AND is_used = 0
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/trade-outcome-queue", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const pair = String(req.body.pair || "").trim().toUpperCase();
    const direction = String(req.body.direction || "").trim().toLowerCase();
    const timerSeconds = Number(req.body.timer_seconds || 0);
    const result = String(req.body.result || "").trim().toLowerCase();
    const quantity = Number(req.body.quantity || 1);

    if (!pair) throw createError(400, "Pair is required");
    if (!["bullish", "bearish"].includes(direction))
      throw createError(400, "Invalid direction");
    if (![60, 180, 300].includes(timerSeconds))
      throw createError(400, "Invalid timer");
    if (!["win", "loss"].includes(result))
      throw createError(400, "Invalid result");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 500) {
      throw createError(400, "Invalid quantity");
    }

    await connection.beginTransaction();

    for (let i = 0; i < quantity; i += 1) {
      await connection.execute(
        `INSERT INTO trade_outcome_queue
         (pair, direction, timer_seconds, result, is_active, is_used, created_by, created_at)
         VALUES (?, ?, ?, ?, 1, 0, ?, NOW())`,
        [pair, direction, timerSeconds, result, req.admin.id]
      );
    }

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "create_trade_outcome_queue",
      note: `Created ${quantity} queue item(s) for ${pair} ${direction} ${timerSeconds}s ${result}`,
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Trade outcome queue added successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.delete("/api/admin/trade-outcome-queue/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0)
      throw createError(400, "Invalid queue id");

    const [result] = await pool.execute(
      `UPDATE trade_outcome_queue
       SET is_active = 0
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0)
      throw createError(404, "Queue item not found");

    await createAuditLog(pool, {
      adminId: req.admin.id,
      action: "remove_trade_outcome_queue",
      referenceId: id,
      note: `Removed queue item #${id}`,
    });

    res.json({
      success: true,
      message: "Queue item removed successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER TRADES
========================= */

app.post("/api/trades/place", authenticateUser, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const pair = String(req.body.pair || "").trim().toUpperCase();
    const direction = String(req.body.direction || "").trim().toLowerCase();
    const timer = Number(req.body.timer || 0);
    const amount = Number(req.body.amount || 0);

    if (!pair) throw createError(400, "Trading pair is required");
    if (!["bullish", "bearish"].includes(direction)) {
      throw createError(400, "Direction must be bullish or bearish");
    }
    if (![60, 180, 300].includes(timer))
      throw createError(400, "Invalid timer");
    if (!Number.isFinite(amount) || amount <= 0)
      throw createError(400, "Invalid trade amount");

    await connection.beginTransaction();

    const user = await ensureUserExists(connection, req.user.id);
    const currentBalance = Number(user.balance || 0);

    if (currentBalance < amount)
      throw createError(400, "Insufficient balance");

    const rule = await getTradeRuleByTimer(connection, timer);
    if (!rule)
      throw createError(400, "No active trade rule found for this timer");

    const queueItem = await getNextOutcomeQueueItem(connection, {
      pair,
      direction,
      timerSeconds: timer,
    });

    if (!queueItem) {
      throw createError(
        400,
        "No prepared admin outcome found for this pair, direction, and timer"
      );
    }

    let entryPrice = 0;
    try {
      entryPrice = await getBinancePrice(pair);
    } catch (_error) {}

    const payoutPercent = Number(rule.payout_percent || 0);
    const endTime = new Date(Date.now() + timer * 1000);

    await connection.execute(
      `UPDATE users
       SET balance = balance - ?
       WHERE id = ?`,
      [amount, req.user.id]
    );

    const [tradeResult] = await connection.execute(
      `INSERT INTO trades
       (
         user_id,
         pair,
         direction,
         timer_seconds,
         amount,
         entry_price,
         payout_percent,
         status,
         result,
         assigned_result,
         queue_id,
         created_at,
         end_time
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, ?, ?, NOW(), ?)`,
      [
        req.user.id,
        pair,
        direction,
        timer,
        amount,
        entryPrice,
        payoutPercent,
        queueItem.result,
        queueItem.id,
        endTime,
      ]
    );

    await connection.execute(
      `UPDATE trade_outcome_queue
       SET is_used = 1, used_at = NOW()
       WHERE id = ?`,
      [queueItem.id]
    );

    await createTransactionLog(connection, {
      userId: req.user.id,
      type: "trade_debit",
      amount,
      status: "completed",
      referenceId: tradeResult.insertId,
      note: `${pair} ${direction} trade opened`,
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Trade placed successfully",
      data: {
        tradeId: tradeResult.insertId,
        pair,
        direction,
        timer,
        amount,
        entryPrice,
        payoutPercent,
        assignedResult: queueItem.result,
        endTime,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.get("/api/trades/open", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM trades
       WHERE user_id = ?
         AND status = 'open'
       ORDER BY id DESC`,
      [req.user.id]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trades/history", authenticateUser, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM trades
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

/* =========================
   USER SUPPORT
========================= */

app.get("/api/support", authenticateUser, async (_req, res, next) => {
  try {
    const support = await getSupportSettings();

    res.json({
      success: true,
      data: {
        channel: support.channel || "Customer Service",
        contact: support.contact || "Not configured",
        link: support.link || "",
        note: support.note || "",
        updated_at: support.updated_at || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN TRADE MONITORING
========================= */

app.get("/api/admin/trades", authenticateAdmin, async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM trades
       ORDER BY id DESC
       LIMIT 500`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/trades/:id/override", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const tradeId = Number(req.params.id);
    const result = String(req.body.result || "").trim().toLowerCase();

    if (!Number.isFinite(tradeId) || tradeId <= 0)
      throw createError(400, "Invalid trade id");
    if (!["win", "loss"].includes(result))
      throw createError(400, "Invalid override result");

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM trades
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [tradeId]
    );

    if (!rows.length) throw createError(404, "Trade not found");

    const trade = rows[0];

    if (
      ["win", "loss", "settled", "completed"].includes(
        String(trade.status || "").toLowerCase()
      )
    ) {
      throw createError(400, "Trade already settled");
    }

    let exitPrice = Number(trade.entry_price || 0);
    try {
      exitPrice = await getBinancePrice(trade.pair);
    } catch (_error) {}

    const amount = Number(trade.amount || 0);
    const payoutPercent = Number(trade.payout_percent || 0);

    let profit = 0;

    if (result === "win") {
      profit = Number((amount * (payoutPercent / 100)).toFixed(2));
      const creditAmount = Number((amount + profit).toFixed(2));

      await connection.execute(
        `UPDATE users
         SET balance = balance + ?
         WHERE id = ?`,
        [creditAmount, trade.user_id]
      );

      await createTransactionLog(connection, {
        userId: trade.user_id,
        type: "trade_win_manual",
        amount: creditAmount,
        status: "completed",
        referenceId: trade.id,
        note: `${trade.pair} ${trade.direction} trade manually overridden to win by admin ${req.admin.id}`,
      });
    } else {
      profit = Number((-amount).toFixed(2));

      await createTransactionLog(connection, {
        userId: trade.user_id,
        type: "trade_loss_manual",
        amount,
        status: "completed",
        referenceId: trade.id,
        note: `${trade.pair} ${trade.direction} trade manually overridden to loss by admin ${req.admin.id}`,
      });
    }

    try {
      await connection.execute(
        `UPDATE trades
         SET status = ?, result = ?, assigned_result = ?, close_price = ?, exit_price = ?, profit = ?, settled_at = NOW()
         WHERE id = ?`,
        [result, result, result, exitPrice, exitPrice, profit, trade.id]
      );
    } catch (_error) {
      await connection.execute(
        `UPDATE trades
         SET status = ?, result = ?, assigned_result = ?, exit_price = ?, profit = ?, settled_at = NOW()
         WHERE id = ?`,
        [result, result, result, exitPrice, profit, trade.id]
      );
    }

    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "manual_trade_override",
      targetUserId: trade.user_id,
      referenceId: trade.id,
      note: `Trade #${trade.id} overridden to ${result}`,
    });

    await createUserNotification(connection, {
      userId: trade.user_id,
      title: "Trade updated",
      message: `Your trade #${trade.id} was manually updated to ${result}.`,
      type: "general",
    });

    await connection.commit();

    res.json({
      success: true,
      message: `Trade overridden to ${result} successfully`,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* ---------------- ADMIN FUNDS ---------------- */

app.get("/api/admin/funds/summary", authenticateAdmin, async (req, res, next) => {
  try {
    const [summaryRows] = await pool.execute(
      `
      SELECT
        COUNT(*) AS total_funds,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_funds,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_funds,
        COALESCE(SUM(locked_principal), 0) AS total_funded_amount,
        COALESCE(SUM(earned_profit), 0) AS total_earned_profit
      FROM user_funds
      `
    );

    res.json({
      success: true,
      data: summaryRows?.[0] || {
        total_funds: 0,
        active_funds: 0,
        completed_funds: 0,
        total_funded_amount: 0,
        total_earned_profit: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/funds", authenticateAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        uf.id,
        uf.user_id,
        uf.plan_id,
        uf.amount,
        uf.locked_principal,
        uf.selected_daily_profit_percent,
        uf.total_days,
        uf.current_day,
        uf.earned_profit,
        uf.status,
        uf.started_at,
        uf.ends_at,
        uf.last_profit_at,
        uf.completed_at,
        uf.created_at,
        fp.name AS plan_name,
        u.name AS user_name,
        u.email AS user_email
      FROM user_funds uf
      LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
      LEFT JOIN users u ON u.id = uf.user_id
      ORDER BY uf.created_at DESC
      `
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/funds/:id/complete", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const fundId = Number(req.params.id);

    if (!fundId) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund id",
      });
    }

    await connection.beginTransaction();

    const [fundRows] = await connection.execute(
      `
      SELECT
        uf.*,
        fp.name AS plan_name
      FROM user_funds uf
      LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.id = ?
      LIMIT 1
      `,
      [fundId]
    );

    const fund = fundRows?.[0];

    if (!fund) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Fund not found",
      });
    }

    if (String(fund.status || "").toLowerCase() === "completed") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Fund already completed",
      });
    }

    const principal = toNumber(fund.locked_principal || fund.amount);
    const profit = toNumber(fund.earned_profit);
    const totalReturn = principal + profit;

    await connection.execute(
      `
      UPDATE users
      SET balance = balance + ?
      WHERE id = ?
      `,
      [totalReturn, fund.user_id]
    );

    await connection.execute(
      `
      UPDATE user_funds
      SET
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [fundId]
    );

    try {
      await connection.execute(
        `
        INSERT INTO notifications (
          user_id,
          title,
          message,
          is_read,
          created_at
        ) VALUES (?, ?, ?, 0, NOW())
        `,
        [
          fund.user_id,
          "Fund Completed",
          `${fund.plan_name || "Fund"} completed. Principal ${principal.toFixed(
            2
          )} USDT + profit ${profit.toFixed(2)} USDT = total ${totalReturn.toFixed(
            2
          )} USDT returned to main wallet.`,
        ]
      );
    } catch (_notificationError) {}

    await createUserNotification(connection, {
      userId: fund.user_id,
      title: "Fund Completed",
      message: `${fund.plan_name} completed. Principal ${principal.toFixed(
        2
      )} USDT + profit ${profit.toFixed(2)} USDT = total ${totalReturn.toFixed(2)} USDT returned to main wallet.`,
      type: "funds",
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Fund completed successfully",
      data: {
        id: fundId,
        total_return: totalReturn,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/funds/:id/cancel", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const fundId = Number(req.params.id);

    if (!fundId) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund id",
      });
    }

    await connection.beginTransaction();

    const [fundRows] = await connection.execute(
      `
      SELECT
        uf.*,
        fp.name AS plan_name
      FROM user_funds uf
      LEFT JOIN fund_plans fp ON fp.id = uf.plan_id
      WHERE uf.id = ?
      LIMIT 1
      `,
      [fundId]
    );

    const fund = fundRows?.[0];

    if (!fund) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Fund not found",
      });
    }

    const status = String(fund.status || "").toLowerCase();

    if (status === "completed") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Completed fund cannot be cancelled",
      });
    }

    if (status === "cancelled") {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: "Fund already cancelled",
      });
    }

    const principal = toNumber(fund.locked_principal || fund.amount);

    await connection.execute(
      `
      UPDATE users
      SET balance = balance + ?
      WHERE id = ?
      `,
      [principal, fund.user_id]
    );

    await connection.execute(
      `
      UPDATE user_funds
      SET
        status = 'cancelled',
        completed_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [fundId]
    );

    try {
      await connection.execute(
        `
        INSERT INTO notifications (
          user_id,
          title,
          message,
          is_read,
          created_at
        ) VALUES (?, ?, ?, 0, NOW())
        `,
        [
          fund.user_id,
          "Fund Cancelled",
          `${fund.plan_name || "Fund"} was cancelled by admin. ${principal.toFixed(
            2
          )} USDT principal returned to main wallet.`,
        ]
      );
    } catch (_notificationError) {}

    await connection.commit();

    res.json({
      success: true,
      message: "Fund cancelled successfully",
      data: {
        id: fundId,
        principal_returned: principal,
      },
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.delete("/api/admin/funds/:id", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const fundId = Number(req.params.id);

    if (!fundId) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund id",
      });
    }

    await connection.beginTransaction();

    const [fundRows] = await connection.execute(
      `
      SELECT id, user_id, status
      FROM user_funds
      WHERE id = ?
      LIMIT 1
      `,
      [fundId]
    );

    const fund = fundRows?.[0];

    if (!fund) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Fund not found",
      });
    }

    await connection.execute(
      `
      DELETE FROM fund_profit_logs
      WHERE user_fund_id = ?
      `,
      [fundId]
    );

    await connection.execute(
      `
      DELETE FROM user_funds
      WHERE id = ?
      `,
      [fundId]
    );

    await connection.commit();

    res.json({
      success: true,
      message: "Fund deleted successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

/* ---------------- ADMIN FUND RULES ---------------- */

app.get("/api/admin/fund-rules", authenticateAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `
      SELECT
        id,
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END AS status,
        created_at,
        updated_at
      FROM fund_plans
      ORDER BY duration_days ASC, id ASC
      `
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/fund-rules", authenticateAdmin, async (req, res, next) => {
  try {
    const {
      name,
      duration_days,
      min_amount,
      max_amount,
      min_daily_profit_percent,
      max_daily_profit_percent,
      user_limit_count,
      status,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Rule name is required",
      });
    }

    const durationDays = Number(duration_days || 0);
    const minAmount = toNumber(min_amount);
    const maxAmount =
      max_amount === null || max_amount === "" || max_amount === undefined
        ? null
        : toNumber(max_amount);
    const minRate = toNumber(min_daily_profit_percent);
    const maxRate = toNumber(max_daily_profit_percent);
    const userLimit =
      user_limit_count === null || user_limit_count === "" || user_limit_count === undefined
        ? null
        : Number(user_limit_count);
    const isActive = String(status || "active").toLowerCase() === "active" ? 1 : 0;

    if (durationDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Duration days must be greater than 0",
      });
    }

    if (minAmount < 0) {
      return res.status(400).json({
        success: false,
        message: "Minimum amount is invalid",
      });
    }

    if (maxAmount !== null && maxAmount < minAmount) {
      return res.status(400).json({
        success: false,
        message: "Maximum amount must be greater than minimum amount",
      });
    }

    if (minRate < 0 || maxRate < 0 || maxRate < minRate) {
      return res.status(400).json({
        success: false,
        message: "Profit rate range is invalid",
      });
    }

    const [result] = await pool.execute(
      `
      INSERT INTO fund_plans (
        name,
        duration_days,
        min_amount,
        max_amount,
        min_daily_profit_percent,
        max_daily_profit_percent,
        user_limit_count,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        String(name).trim(),
        durationDays,
        minAmount,
        maxAmount,
        minRate,
        maxRate,
        userLimit,
        isActive,
      ]
    );

    res.json({
      success: true,
      message: "Fund rule created successfully",
      data: {
        id: result.insertId,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/fund-rules/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const ruleId = Number(req.params.id);

    const {
      name,
      duration_days,
      min_amount,
      max_amount,
      min_daily_profit_percent,
      max_daily_profit_percent,
      user_limit_count,
      status,
    } = req.body || {};

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund rule id",
      });
    }

    const durationDays = Number(duration_days || 0);
    const minAmount = toNumber(min_amount);
    const maxAmount =
      max_amount === null || max_amount === "" || max_amount === undefined
        ? null
        : toNumber(max_amount);
    const minRate = toNumber(min_daily_profit_percent);
    const maxRate = toNumber(max_daily_profit_percent);
    const userLimit =
      user_limit_count === null || user_limit_count === "" || user_limit_count === undefined
        ? null
        : Number(user_limit_count);
    const isActive = String(status || "active").toLowerCase() === "active" ? 1 : 0;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Rule name is required",
      });
    }

    if (durationDays <= 0) {
      return res.status(400).json({
        success: false,
        message: "Duration days must be greater than 0",
      });
    }

    if (maxAmount !== null && maxAmount < minAmount) {
      return res.status(400).json({
        success: false,
        message: "Maximum amount must be greater than minimum amount",
      });
    }

    if (minRate < 0 || maxRate < 0 || maxRate < minRate) {
      return res.status(400).json({
        success: false,
        message: "Profit rate range is invalid",
      });
    }

    const [result] = await pool.execute(
      `
      UPDATE fund_plans
      SET
        name = ?,
        duration_days = ?,
        min_amount = ?,
        max_amount = ?,
        min_daily_profit_percent = ?,
        max_daily_profit_percent = ?,
        user_limit_count = ?,
        is_active = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        String(name).trim(),
        durationDays,
        minAmount,
        maxAmount,
        minRate,
        maxRate,
        userLimit,
        isActive,
        ruleId,
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Fund rule not found",
      });
    }

    res.json({
      success: true,
      message: "Fund rule updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/fund-rules/:id", authenticateAdmin, async (req, res, next) => {
  try {
    const ruleId = Number(req.params.id);

    if (!ruleId) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund rule id",
      });
    }

    const [activeUseRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM user_funds
      WHERE plan_id = ? AND status = 'active'
      `,
      [ruleId]
    );

    const activeUseCount = Number(activeUseRows?.[0]?.total || 0);

    if (activeUseCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a rule with active user funds",
      });
    }

    const [result] = await pool.execute(
      `
      DELETE FROM fund_plans
      WHERE id = ?
      `,
      [ruleId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Fund rule not found",
      });
    }

    res.json({
      success: true,
      message: "Fund rule deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   ADMIN NOTIFICATIONS
========================= */

// Get admin notifications (aggregated from various sources)
app.get("/api/admin/notifications", authenticateAdmin, async (req, res, next) => {
  try {
    const notifications = [];

    // Pending KYC notifications
    const [pendingKyc] = await pool.execute(
      "SELECT COUNT(*) as count FROM user_kyc WHERE verification_status = 'pending'"
    );
    if (pendingKyc[0]?.count > 0) {
      notifications.push({
        id: `kyc-pending-${Date.now()}`,
        type: "kyc",
        title: "Pending KYC Submissions",
        message: `${pendingKyc[0].count} user(s) have pending KYC verification.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Pending Deposits
    const [pendingDeposits] = await pool.execute(
      "SELECT COUNT(*) as count FROM deposits WHERE status = 'pending'"
    );
    if (pendingDeposits[0]?.count > 0) {
      notifications.push({
        id: `deposits-pending-${Date.now()}`,
        type: "deposit",
        title: "Pending Deposits",
        message: `${pendingDeposits[0].count} deposit request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Pending Withdrawals
    const [pendingWithdrawals] = await pool.execute(
      "SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'"
    );
    if (pendingWithdrawals[0]?.count > 0) {
      notifications.push({
        id: `withdrawals-pending-${Date.now()}`,
        type: "withdraw",
        title: "Pending Withdrawals",
        message: `${pendingWithdrawals[0].count} withdrawal request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Pending Loans
    const [pendingLoans] = await pool.execute(
      "SELECT COUNT(*) as count FROM loans WHERE status = 'pending'"
    );
    if (pendingLoans[0]?.count > 0) {
      notifications.push({
        id: `loans-pending-${Date.now()}`,
        type: "loan",
        title: "Pending Loan Requests",
        message: `${pendingLoans[0].count} loan request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Pending Joint Account Requests
    const [pendingJoint] = await pool.execute(
      "SELECT COUNT(*) as count FROM joint_account_requests WHERE status = 'pending'"
    );
    if (pendingJoint[0]?.count > 0) {
      notifications.push({
        id: `joint-pending-${Date.now()}`,
        type: "joint_account",
        title: "Pending Joint Account Requests",
        message: `${pendingJoint[0].count} joint account request(s) awaiting approval.`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }

    // Sort by created_at (newest first)
    notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
});

// Mark notification as read (store in memory or session)
app.put("/api/admin/notifications/:id/read", authenticateAdmin, async (req, res, next) => {
  try {
    // For now, just return success
    // In production, you would store read status in a database table
    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   JOINT ACCOUNT
========================= */

app.get("/api/joint-account/status", authenticateUser, async (req, res, next) => {
  try {
    // First get the user's UID from the database using their ID
    const [userRows] = await pool.execute(
      "SELECT uid FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    
    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    const userUid = userRows[0].uid;
    
    let jointRows = [];
    let pendingRequests = [];
    
    try {
      [jointRows] = await pool.execute(
        `SELECT * FROM joint_accounts 
         WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active'`,
        [userUid, userUid]
      );
    } catch (err) {
      console.error("Joint accounts query error:", err.message);
      // Table might not exist yet
      jointRows = [];
    }
    
    try {
      [pendingRequests] = await pool.execute(
        `SELECT * FROM joint_account_requests 
         WHERE (requester_uid = ? OR partner_uid = ?) AND status = 'pending'`,
        [userUid, userUid]
      );
    } catch (err) {
      console.error("Joint account requests query error:", err.message);
      pendingRequests = [];
    }

    res.json({
      success: true,
      data: {
        hasJointAccount: jointRows.length > 0,
        jointAccount: jointRows[0] || null,
        pendingRequest: pendingRequests[0] || null
      }
    });
  } catch (error) {
    console.error("Joint account status error:", error);
    // Return empty data instead of error
    res.json({
      success: true,
      data: {
        hasJointAccount: false,
        jointAccount: null,
        pendingRequest: null
      }
    });
  }
});

app.post("/api/joint-account/request", authenticateUser, async (req, res, next) => {
  try {
    const { partnerEmail, partnerKycNumber } = req.body;
    
    // FIXED: Get user data from database, not from req.user
    const [requesterRows] = await pool.execute(
      "SELECT id, uid, email FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    
    if (!requesterRows.length) {
      throw createError(404, "User not found");
    }
    
    const requester = requesterRows[0];
    const requesterUid = requester.uid;
    const requesterEmail = requester.email;
    const requesterId = requester.id;

    if (!partnerEmail || !partnerEmail.trim()) {
      throw createError(400, "Partner email is required");
    }

    const [partnerRows] = await pool.execute(
      "SELECT id, uid, email, kyc_status FROM users WHERE email = ? LIMIT 1",
      [partnerEmail.trim()]
    );

    if (!partnerRows.length) {
      throw createError(404, "Partner user not found");
    }

    const partner = partnerRows[0];

    if (partner.uid === requesterUid) {
      throw createError(400, "You cannot request a joint account with yourself");
    }

    if (partner.kyc_status !== "approved") {
      throw createError(400, "Partner must complete KYC verification first");
    }

    // Check for existing pending request
    const [existing] = await pool.execute(
      "SELECT id FROM joint_account_requests WHERE requester_uid = ? AND partner_uid = ? AND status = 'pending'",
      [requesterUid, partner.uid]
    );

    if (existing.length) {
      throw createError(400, "Joint account request already pending");
    }

    // Check for existing active joint account
    const [activeJoint] = await pool.execute(
      "SELECT id FROM joint_accounts WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active'",
      [requesterUid, requesterUid]
    );

    if (activeJoint.length) {
      throw createError(400, "You already have an active joint account");
    }

    // FIXED: Ensure no undefined values - convert undefined to null
    const safePartnerKycNumber = partnerKycNumber && partnerKycNumber.trim() ? partnerKycNumber.trim() : null;
    
    const [result] = await pool.execute(
      `INSERT INTO joint_account_requests 
       (requester_uid, requester_email, partner_uid, partner_email, partner_kyc_number, status, requester_id, partner_id) 
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [
        String(requesterUid), 
        String(requesterEmail), 
        String(partner.uid), 
        String(partner.email), 
        safePartnerKycNumber, 
        Number(requesterId), 
        Number(partner.id)
      ]
    );

    res.json({
      success: true,
      message: "Joint account request sent. Waiting for admin approval.",
      data: { requestId: result.insertId }
    });
  } catch (error) {
    console.error("Joint account request error:", error);
    next(error);
  }
});

/* =========================
   JOINT ACCOUNT COMBINED BALANCE
========================= */

app.get("/api/joint-account/combined-balance", authenticateUser, async (req, res, next) => {
  try {
    // Get current user's UID from database
    const [userRows] = await pool.execute(
      "SELECT id, uid, balance FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    
    if (!userRows.length) {
      return res.json({ success: true, data: { hasJointAccount: false, combinedBalance: 0, userBalance: 0, partnerBalance: 0, partnerName: null } });
    }
    
    const currentUser = userRows[0];
    const currentUid = currentUser.uid;
    const currentBalance = Number(currentUser.balance || 0);
    
    // Check if user has active joint account
    const [jointRows] = await pool.execute(
      `SELECT * FROM joint_accounts 
       WHERE (user1_uid = ? OR user2_uid = ?) AND status = 'active'`,
      [currentUid, currentUid]
    );
    
    if (!jointRows.length) {
      return res.json({ 
        success: true, 
        data: { 
          hasJointAccount: false, 
          combinedBalance: currentBalance,
          userBalance: currentBalance,
          partnerBalance: 0,
          partnerName: null
        } 
      });
    }
    
    const jointAccount = jointRows[0];
    
    // Get partner UID
    let partnerUid = null;
    if (jointAccount.user1_uid === currentUid) {
      partnerUid = jointAccount.user2_uid;
    } else {
      partnerUid = jointAccount.user1_uid;
    }
    
    // Get partner's balance and info
    const [partnerRows] = await pool.execute(
      "SELECT id, uid, name, email, balance FROM users WHERE uid = ? LIMIT 1",
      [partnerUid]
    );
    
    let partnerBalance = 0;
    let partnerName = null;
    
    if (partnerRows.length) {
      partnerBalance = Number(partnerRows[0].balance || 0);
      partnerName = partnerRows[0].name || partnerRows[0].email;
    }
    
    const combinedBalance = currentBalance + partnerBalance;
    
    res.json({
      success: true,
      data: {
        hasJointAccount: true,
        combinedBalance: combinedBalance,
        userBalance: currentBalance,
        partnerBalance: partnerBalance,
        partnerName: partnerName,
        partnerUid: partnerUid,
        accountId: jointAccount.account_id
      }
    });
  } catch (error) {
    console.error("Combined balance error:", error);
    res.json({ 
      success: true, 
      data: { 
        hasJointAccount: false, 
        combinedBalance: 0,
        userBalance: 0,
        partnerBalance: 0,
        partnerName: null
      } 
    });
  }
});

/* =========================
   aDMIN JOINT ACCOUNT REQUESTS
========================= */

app.get("/api/admin/joint-account-requests", authenticateAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM joint_account_requests WHERE status = 'pending' ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/joint-account-requests/:id/approve", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    const requestId = req.params.id;

    await connection.beginTransaction();

    const [requestRows] = await connection.execute(
      `SELECT * FROM joint_account_requests WHERE id = ? AND status = 'pending'`,
      [requestId]
    );

    if (!requestRows.length) {
      throw createError(404, "Request not found");
    }

    const request = requestRows[0];

    // Get the actual user IDs from the UIDs
    const [requesterUser] = await connection.execute(
      `SELECT id FROM users WHERE uid = ? LIMIT 1`,
      [request.requester_uid]
    );

    const [partnerUser] = await connection.execute(
      `SELECT id FROM users WHERE uid = ? LIMIT 1`,
      [request.partner_uid]
    );

    if (!requesterUser.length || !partnerUser.length) {
      throw createError(404, "User not found");
    }

    const accountId = `JA${Date.now()}${Math.floor(Math.random() * 1000)}`;

    await connection.execute(
      `INSERT INTO joint_accounts (account_id, user1_uid, user2_uid, status, approved_at) 
       VALUES (?, ?, ?, 'active', NOW())`,
      [accountId, request.requester_uid, request.partner_uid]
    );

    await connection.execute(
      `UPDATE joint_account_requests SET status = 'approved', updated_at = NOW() WHERE id = ?`,
      [requestId]
    );

    // ✅ FIXED: Use actual user IDs (numbers), not UID strings
    await createUserNotification(connection, {
      userId: requesterUser[0].id,  // ✅ CORRECT - numeric user ID
      title: "Joint Account Approved",
      message: `Your joint account request with ${request.partner_email} has been approved!`,
      type: "joint_account"
    });

    await createUserNotification(connection, {
      userId: partnerUser[0].id,  // ✅ CORRECT - numeric user ID
      title: "Joint Account Approved",
      message: `Your joint account with ${request.requester_email} has been approved!`,
      type: "joint_account"
    });

    await connection.commit();

    res.json({
      success: true,
      message: "Joint account approved successfully"
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/admin/joint-account-requests/:id/reject", authenticateAdmin, async (req, res, next) => {
  try {
    const requestId = req.params.id;
    const { admin_note } = req.body;

    const [requestRows] = await pool.execute(
      `SELECT * FROM joint_account_requests WHERE id = ? AND status = 'pending'`,
      [requestId]
    );

    if (!requestRows.length) {
      throw createError(404, "Request not found");
    }

    const request = requestRows[0];

    await pool.execute(
      `UPDATE joint_account_requests SET status = 'rejected', admin_note = ?, updated_at = NOW() WHERE id = ?`,
      [admin_note || null, requestId]
    );

    res.json({
      success: true,
      message: "Joint account request rejected"
    });
  } catch (error) {
    next(error);
  }
});


/* =========================
   ADMIN DISCONNECT JOINT ACCOUNT
========================= */

app.post("/api/admin/joint-accounts/:id/disconnect", authenticateAdmin, async (req, res, next) => {
  const connection = await pool.getConnection();
  
  try {
    const jointAccountId = Number(req.params.id);
    
    if (!Number.isFinite(jointAccountId) || jointAccountId <= 0) {
      throw createError(400, "Invalid joint account id");
    }
    
    await connection.beginTransaction();
    
    // Get joint account details
    const [jointRows] = await connection.execute(
      `SELECT * FROM joint_accounts WHERE id = ? AND status = 'active'`,
      [jointAccountId]
    );
    
    if (!jointRows.length) {
      throw createError(404, "Joint account not found or already disconnected");
    }
    
    const jointAccount = jointRows[0];
    
    // Update status to 'inactive' (disconnected)
    await connection.execute(
      `UPDATE joint_accounts SET status = 'inactive', updated_at = NOW() WHERE id = ?`,
      [jointAccountId]
    );
    
    // Notify both users
    const [user1Rows] = await connection.execute(
      `SELECT id FROM users WHERE uid = ? LIMIT 1`,
      [jointAccount.user1_uid]
    );
    
    const [user2Rows] = await connection.execute(
      `SELECT id FROM users WHERE uid = ? LIMIT 1`,
      [jointAccount.user2_uid]
    );
    
    if (user1Rows.length) {
      await createUserNotification(connection, {
        userId: user1Rows[0].id,
        title: "Joint Account Disconnected",
        message: `Your joint account with ${jointAccount.user2_uid} has been disconnected by admin.`,
        type: "security",
      });
    }
    
    if (user2Rows.length) {
      await createUserNotification(connection, {
        userId: user2Rows[0].id,
        title: "Joint Account Disconnected",
        message: `Your joint account with ${jointAccount.user1_uid} has been disconnected by admin.`,
        type: "security",
      });
    }
    
    await createAuditLog(connection, {
      adminId: req.admin.id,
      action: "disconnect_joint_account",
      referenceId: jointAccountId,
      note: `Disconnected joint account #${jointAccountId} between ${jointAccount.user1_uid} and ${jointAccount.user2_uid}`,
    });
    
    await connection.commit();
    
    res.json({
      success: true,
      message: "Joint account disconnected successfully",
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

// Get all joint accounts (for admin)
app.get("/api/admin/joint-accounts", authenticateAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ja.*, 
        u1.name as user1_name, u1.email as user1_email,
        u2.name as user2_name, u2.email as user2_email
       FROM joint_accounts ja
       LEFT JOIN users u1 ON u1.uid = ja.user1_uid
       LEFT JOIN users u2 ON u2.uid = ja.user2_uid
       ORDER BY ja.created_at DESC`
    );
    
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/* =========================
   404 API HANDLER
========================= */

app.use((req, res, next) => {
  if (String(req.path || "").startsWith("/api/")) {
    return res.status(404).json({
      success: false,
      message: "API route not found",
    });
  }
  next();
});

/* =========================
   ERROR HANDLER
========================= */

app.use((error, _req, res, _next) => {
  console.error("Server error:", error);

  const status = Number(error.status || 500);
  const message = error.message || "Internal server error";

  res.status(status).json({
    success: false,
    message,
  });
});

/* =========================
   SERVER START
========================= */

app.listen(PORT, async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();

    console.log(`✅ CryptoPulse backend running on port ${PORT}`);
    console.log(`✅ MySQL connected successfully`);
    console.log(`✅ Database: ${DB_NAME}`);
    console.log(`✅ Allowed origins: ${allowedOrigins.join(", ")}`);
    
    // Check mail configuration
    const mailTransporter = getMailTransporter();
    if (mailTransporter) {
      console.log(`✅ Mail service configured (${process.env.KEPLERS_EMAIL || process.env.GMAIL_USER})`);
    } else {
      console.log(`⚠️ Mail service not configured. Email features will not work.`);
    }
  } catch (error) {
    console.error("❌ MySQL connection failed:", error.message);
  }
});

setInterval(() => {
  settleExpiredTrades().catch((error) => {
    console.error("Auto trade settlement failed:", error.message);
  });
}, 1000);
