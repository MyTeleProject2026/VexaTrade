import axios from "axios";
import { requestTransactionSecurity } from "./transactionSecurity";

const ACTIONS = {
  "/api/deposits/request": ["deposit", "Deposit authorization"],
  "/api/withdrawals/request": ["withdrawal", "Withdrawal authorization"],
  "/api/convert/execute": ["convert", "Conversion authorization"],
  "/api/user/transfer": ["transfer", "Transfer authorization"],
  "/api/trades/place": ["trade", "Trade authorization"],
  "/api/funds/apply": ["funds", "Funds authorization"],
  "/api/loans/apply": ["loan", "Loan authorization"],
  "/api/withdraw/profit-request": ["profit-withdrawal", "Profit withdrawal authorization"],
};

function actionFor(url) {
  const path = String(url || "").split("?")[0];
  return ACTIONS[path] || null;
}

let installed = false;
export function installGlobalTransactionSecurityInterceptor() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalRequest = axios.Axios.prototype.request;
  axios.Axios.prototype.request = async function securedRequest(configOrUrl, maybeConfig) {
    const config = typeof configOrUrl === "string" ? { ...(maybeConfig || {}), url: configOrUrl } : { ...(configOrUrl || {}) };
    const method = String(config.method || "get").toLowerCase();
    const security = ["post", "put", "patch", "delete"].includes(method) ? actionFor(config.url) : null;
    if (security && !config.headers?.["X-Transaction-Security"] && !config.__vexaSecurityHandled) {
      const result = await requestTransactionSecurity(security[0], security[1]);
      if (!result?.transactionSecurityToken) throw new Error("Transaction security authorization was not completed");
      config.headers = { ...(config.headers || {}), "X-Transaction-Security": result.transactionSecurityToken };
      if (config.data && typeof config.data === "object" && !(config.data instanceof FormData)) {
        config.data = { ...config.data, transactionPasscode: result.transactionPasscode || "", twoFactorCode: result.twoFactorCode || "" };
      }
      config.__vexaSecurityHandled = true;
    }
    return originalRequest.call(this, config);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const method = String(init.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
    const security = ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? actionFor(url) : null;
    if (security) {
      const headers = new Headers(init.headers || (typeof input !== "string" ? input?.headers : undefined));
      if (!headers.get("X-Transaction-Security")) {
        const result = await requestTransactionSecurity(security[0], security[1]);
        if (!result?.transactionSecurityToken) throw new Error("Transaction security authorization was not completed");
        headers.set("X-Transaction-Security", result.transactionSecurityToken);
        if (typeof init.body === "string") {
          try {
            const body = JSON.parse(init.body);
            body.transactionPasscode = result.transactionPasscode || body.transactionPasscode || "";
            body.twoFactorCode = result.twoFactorCode || body.twoFactorCode || "";
            init = { ...init, body: JSON.stringify(body), headers };
          } catch {
            init = { ...init, headers };
          }
        } else init = { ...init, headers };
      }
    }
    return originalFetch(input, init);
  };
}
