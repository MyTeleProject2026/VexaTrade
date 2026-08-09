/**
 * utils/helpers.js
 * General-purpose helper utilities for the backend.
 * Created by GitHub Copilot Chat Assistant on user request.
 */

/** Safely parse a JSON string, returning defaultValue on failure */
function tryParseJSON(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

/** Simple delay/timeout helper (returns a promise) */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pick selected keys from an object */
function pick(obj, keys = []) {
  if (!obj || typeof obj !== 'object') return {};
  return keys.reduce((acc, k) => {
    if (k in obj) acc[k] = obj[k];
    return acc;
  }, {});
}

/** Check whether a value is empty (null/undefined/empty string/empty array/object) */
function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value).length === 0) return true;
  return false;
}

/** Parse integer from env or string with fallback */
function parseIntOrDefault(value, defaultValue = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? defaultValue : n;
}

/** Basic email validation (safe, not exhaustive) */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // simple regex for common emails
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Wrap async Express handlers to catch errors */
function asyncHandler(fn) {
  return function asyncUtilWrap(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Format a consistent API response */
function formatResponse({ success = true, data = null, message = '', meta = null } = {}) {
  const payload = { success };
  if (data !== null) payload.data = data;
  if (message) payload.message = message;
  if (meta !== null) payload.meta = meta;
  return payload;
}

/** Create a small Error object with status (for HTTP handlers) */
function createHttpError(message = 'Error', status = 500, details = null) {
  const err = new Error(message);
  err.status = status;
  if (details !== null) err.details = details;
  return err;
}

module.exports = {
  tryParseJSON,
  delay,
  pick,
  isEmpty,
  parseIntOrDefault,
  isValidEmail,
  asyncHandler,
  formatResponse,
  createHttpError,
};
