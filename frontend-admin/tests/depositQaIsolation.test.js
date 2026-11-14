import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = new URL("../", import.meta.url);
const readSource = (relativePath) => readFileSync(new URL(relativePath, repoRoot), "utf8");

const qaSources = {
  page: readSource("src/pages/admin/AdminDepositQaPage.jsx"),
  state: readSource("src/pages/admin/depositQaState.js"),
  diagnostics: readSource("src/pages/admin/depositVerifierQaDiagnostics.js"),
};

test("Deposit QA modules do not import live API clients or network libraries", () => {
  const forbiddenImport = /(?:from\s*|import\s*\()\s*["'](?:[^"']*\/services\/api(?:\.js)?|axios|node:https?|https?)["']/;
  for (const [name, source] of Object.entries(qaSources)) {
    assert.doesNotMatch(source, forbiddenImport, `${name} must remain independent of live API and network clients`);
  }
});

test("Deposit QA page does not invoke network or browser transport APIs", () => {
  const forbiddenTransport = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|\baxios\s*\.|\bnavigator\s*\.\s*sendBeacon\s*\(/;
  assert.doesNotMatch(qaSources.page, forbiddenTransport);
  assert.doesNotMatch(qaSources.state, forbiddenTransport);
  assert.doesNotMatch(qaSources.diagnostics, forbiddenTransport);
});

test("Deposit QA page is wired only to its local state and static diagnostics helpers", () => {
  assert.match(qaSources.page, /from\s*["']\.\/depositQaState\.js["']/);
  assert.match(qaSources.page, /from\s*["']\.\/depositVerifierQaDiagnostics\.js["']/);
  assert.doesNotMatch(qaSources.page, /adminApi\s*\./);
});

test("QA state and diagnostics helpers contain no persistent browser storage access", () => {
  for (const name of ["state", "diagnostics"]) {
    assert.doesNotMatch(qaSources[name], /\b(?:localStorage|sessionStorage|indexedDB)\b/);
  }
});
