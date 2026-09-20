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
    .then((response) => {
      // One successful financial action produces one browser event. Pages that
      // own affected data can refresh only that data set instead of polling or
      // reloading the whole application.
      if (typeof window !== "undefined") {
        const responseData = response?.data?.data ?? response?.data ?? {};
        window.dispatchEvent(new CustomEvent("vexa:financial-action-complete", {
          detail: { action: key, data: responseData },
        }));

        const actionMap = {
          "convert-submit": "convert",
          "transfer-submit": "transfer",
          "trade-submit": "trade",
          "funds-submit": "funds",
          "loan-submit": "loan",
          "profit-withdrawal-submit": "profit-withdrawal",
        };
        const receiptAction = actionMap[key];
        if (receiptAction) {
          window.dispatchEvent(new CustomEvent("vexa:transaction-complete", {
            detail: {
              action: receiptAction,
              status: String(responseData?.status || "completed"),
              data: responseData,
            },
          }));
        }
      }
      return response;
    })
    .finally(() => {
      if (inFlightActions.get(key) === promise) inFlightActions.delete(key);
    });

  inFlightActions.set(key, promise);
  return promise;
}

export function isUserActionInFlight(actionName) {
  return inFlightActions.has(String(actionName || "action"));
}
