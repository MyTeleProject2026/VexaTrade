const SUPPORTED_TRON_NETWORKS = new Set(["TRC20", "TRON"]);

/**
 * Static QA model of the checked-in approval route. This intentionally does
 * not inspect environment variables, database rows, provider availability,
 * wallet addresses, transactions, or account balances.
 */
export function getVerifierQaDiagnostics(coin, network) {
  const normalizedCoin = String(coin || "").trim().toUpperCase();
  const normalizedNetwork = String(network || "").trim().toUpperCase();
  const routeSupportsPair = normalizedCoin === "USDT" && SUPPORTED_TRON_NETWORKS.has(normalizedNetwork);

  return {
    mode: "repository-code-only",
    coin: normalizedCoin || "UNSPECIFIED",
    network: normalizedNetwork || "UNSPECIFIED",
    routeStatus: routeSupportsPair ? "route-supported" : "blocked-by-route",
    creditEnabled: false,
    runtimeChecks: [
      { key: "treasury-wallet", label: "Active treasury deposit wallet", status: "not-checked" },
      { key: "solidified-transaction", label: "Solidified transaction and successful receipt", status: "not-checked" },
      { key: "transfer-event", label: "Confirmed USDT Transfer event to the configured recipient", status: "not-checked" },
      { key: "exact-amount", label: "Exact six-decimal amount match", status: "not-checked" },
      { key: "duplicate-claim", label: "Unique blockchain transaction claim", status: "not-checked" },
    ],
    notice: routeSupportsPair
      ? "The approval route recognizes this asset/network pair. Runtime configuration and transaction eligibility have not been checked."
      : "The approval route rejects this asset/network pair before the verifier or credit operation is reached.",
  };
}
