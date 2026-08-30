import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-5ycu.onrender.com";
const getToken = () => localStorage.getItem("userToken") || localStorage.getItem("accessToken") || localStorage.getItem("token") || "";

const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000, headers: { "Content-Type": "application/json" } });
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function sendSupportMessage(message, context = {}) {
  const text = String(message || "").trim();
  if (!text) throw new Error("Message is required");
  const response = await client.post("/api/support/tickets", {
    subject: context.subject || "VexaTrade AI Assistant",
    message: text,
    category: context.category || "general",
    metadata: { source: "ai-chat", ...context },
  });
  return response.data;
}

export function createLocalAssistantReply(message) {
  const text = String(message || "").toLowerCase();
  if (/(withdraw|cash out|send crypto)/.test(text)) return "For withdrawals, choose the asset and network carefully, verify the destination address, and complete any required transaction passcode, authenticator, or joint-account approval steps.";
  if (/(deposit|add funds)/.test(text)) return "You can use the Funds or Deposit section to select a supported asset and network. Always verify the network before sending funds.";
  if (/(2fa|authenticator|security)/.test(text)) return "You can strengthen account security with authenticator 2FA, recovery codes, and a transaction passcode.";
  if (/(joint account|joint)/.test(text)) return "Joint-account withdrawals may require authorization from the linked account holder before settlement.";
  if (/(trade|trading|market)/.test(text)) return "Trading information should be reviewed carefully with current market data and your available asset balance.";
  return "I can help with VexaTrade account security, funds, deposits, withdrawals, supported assets, joint accounts, and platform navigation. For account-specific actions, I can guide you to the appropriate secure flow.";
}
