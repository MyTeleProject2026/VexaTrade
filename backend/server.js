// server.js
require("./initSync");
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const http = require("http");
const socketIo = require("socket.io");
const pool = require("./db");
const { authAdmin, authUser } = require('./src/middleware/auth');

// ─── Import all route files ─────────────────────────────────────────
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/userRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const transferRoutes = require('./src/routes/transferRoutes');
const depositRoutes = require('./src/routes/depositRoutes');
const withdrawalRoutes = require('./src/routes/withdrawalRoutes');
const tradeRoutes = require('./src/routes/tradeRoutes');
const fundsRoutes = require('./src/routes/fundsRoutes');
const loanRoutes = require('./src/routes/loanRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const legalRoutes = require('./src/routes/legalRoutes');
const supportRoutes = require('./src/routes/supportRoutes');
const jointAccountRoutes = require('./src/routes/jointAccountRoutes');
const marketRoutes = require('./src/routes/marketRoutes');
const convertRoutes = require('./src/routes/convertRoutes');
const employeeRoutes = require("./employeeRoutes");
const newsRoutes = require("./newsRoutes");
const maintenanceRoutes = require("./maintenanceRoutes");
const adminFundRoutes = require("./adminFundRoutes");
const adminNetworkRoutes = require("./adminNetworkRoutes");
const overrideFundsPlans = require("./overrideFundsPlans");

const app = express();
const PORT = process.env.PORT || 5000;
const DB_NAME = process.env.DB_NAME;

// ─── CORS & Middleware ──────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  process.env.FRONTEND_USER_URL,
  process.env.FRONTEND_ADMIN_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "https://vexatrade-6nhs.onrender.com",
  "https://www.vexatrade-v.2bd.net",
  "https://vexatrade-v.2bd.net",
  "https://vexatrade-admin-n36m.onrender.com",
  "https://admin.vexatrade-v.2bd.net",
  "https://vexatrade-all-adminmonitor-user-activity.onrender.com",
  "https://employee-admin-monitor-vexatrade.onrender.com",
  "https://vexatrade-5ycu.onrender.com",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.log("Blocked by CORS:", origin);
    return callback(new Error(`CORS not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ──────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── Mount Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', walletRoutes);
app.use('/api', transferRoutes);
app.use('/api', depositRoutes);
app.use('/api', withdrawalRoutes);
app.use('/api', tradeRoutes);
app.use('/api', fundsRoutes);
app.use('/api', loanRoutes);
app.use('/api', adminRoutes);
app.use('/api', legalRoutes);
app.use('/api', supportRoutes);
app.use('/api', jointAccountRoutes);
app.use('/api', marketRoutes);
app.use('/api', convertRoutes);
app.use("/api/funds/plans", overrideFundsPlans);
app.use("/api/admin/network-verification-settings", adminNetworkRoutes);
app.use("/api/admin/fund-rules", adminFundRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/maintenance", maintenanceRoutes);

// ─── Health ────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ success: true, message: "VexaTrade backend running", database: DB_NAME });
  } catch (_) {
    res.status(500).json({ success: false, message: "Database connection failed" });
  }
});

app.get('/', (req, res) => res.json({ success: true, message: "VexaTrade backend running" }));

// ─── 404 & Error Handler ──────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "API route not found" });
  }
  res.status(404).send("Not found");
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error" });
});

// ─── Socket.io ─────────────────────────────────────────────────────
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// ... socket.io logic (same as original, moved to separate file if needed)

server.listen(PORT, async () => {
  console.log(`✅ VexaTrade backend running on port ${PORT}`);
});

module.exports = { app, server, io };
