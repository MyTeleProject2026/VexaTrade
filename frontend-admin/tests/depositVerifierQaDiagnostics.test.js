import test from "node:test";
import assert from "node:assert/strict";
import { getVerifierQaDiagnostics } from "../src/pages/admin/depositVerifierQaDiagnostics.js";

test("models the USDT TRC20 approval route without claiming live readiness", () => {
  const result = getVerifierQaDiagnostics("usdt", "trc20");
  assert.equal(result.routeStatus, "route-supported");
  assert.equal(result.mode, "repository-code-only");
  assert.equal(result.creditEnabled, false);
  assert.ok(result.runtimeChecks.every((check) => check.status === "not-checked"));
});

test("models USDT ERC20 as blocked before verification", () => {
  const result = getVerifierQaDiagnostics("USDT", "ERC20");
  assert.equal(result.routeStatus, "blocked-by-route");
  assert.equal(result.creditEnabled, false);
  assert.match(result.notice, /rejects this asset\/network pair/i);
});

test("models unknown assets and networks as blocked", () => {
  assert.equal(getVerifierQaDiagnostics("BTC", "TRON").routeStatus, "blocked-by-route");
  assert.equal(getVerifierQaDiagnostics("", "").routeStatus, "blocked-by-route");
});
