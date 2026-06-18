// adminRoutesServer.js
// This runs on a separate port for admin API routes.
// Run with: node adminRoutesServer.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const adminNetworkRoutes = require("./adminNetworkRoutes");

const app = express();
const PORT = process.env.ADMIN_API_PORT || 5001;

app.use(cors({
  origin: [
    "https://admin.vexatrade-v.2bd.net",
    "https://vexatrade-admin.onrender.com",
    "http://localhost:5173",
  ],
  credentials: true,
}));
app.use(express.json());

// Mount network verification routes
app.use("/api/admin/network-verification-settings", adminNetworkRoutes);

app.listen(PORT, () => {
  console.log(`✅ Admin API server running on port ${PORT}`);
  console.log(`✅ Network verification routes available at /api/admin/network-verification-settings`);
});
