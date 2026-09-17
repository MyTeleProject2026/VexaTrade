// frontend-user/src/services/actionRequest.js
// Centralized user-action request controls.
// Each intentional click gets one stable idempotency key. The key is not
// regenerated while the same action is in progress, which prevents duplicate
// financial submissions without introducing automatic retries.

const inFlightActions = new Map();

export function createActionIdempotencyKey(action = "action") {
  const prefix = String(action || "action").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`.slice(0, 128);
}

export function runSingleUserAction(actionName, operation) {
  const key = String(actionName || "action");
  const existing = inFlightActions.get(key);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(operation)
    .finally(() => {
      if (inFlightActions.get(key) === promise) inFlightActions.delete(key);
    });

  inFlightActions.set(key, promise);
  return promise;
}

export function isUserActionInFlight(actionName) {
  return inFlightActions.has(String(actionName || "action"));
}
