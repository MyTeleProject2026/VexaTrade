const axios = require('axios');

// VexaAccount is the auth/email authority used by VexaTrade.
const VEXA_ACCOUNT_URL = process.env.VEXA_ACCOUNT_URL || 'https://api-vexaaccount.onrender.com';
const AUTH_TIMEOUT_MS = 15000;
// Email operations may legitimately spend time on SMTP/API fallback ports.
const EMAIL_TIMEOUT_MS = 45000;

/**
 * Get user profile from VexaAccount by email
 * Used by /sync-user to fetch full profile data
 */
async function getUserProfile(email) {
  try {
    const response = await axios.get(`${VEXA_ACCOUNT_URL}/api/auth/profile-by-email`, {
      params: { email: email.trim().toLowerCase() },
      timeout: AUTH_TIMEOUT_MS,
    });
    return response.data;
  } catch (error) {
    console.error('[getUserProfile] Error:', error.message);
    throw error;
  }
}

module.exports = {
  register: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/register`, data, { timeout: EMAIL_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  login: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/login`, data, { timeout: EMAIL_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyOtp: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/verify-otp`, data, { timeout: AUTH_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resendOtp: async (email) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/resend-otp`, { email }, { timeout: EMAIL_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyEmail2fa: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/verify-email-2fa`, data, { timeout: AUTH_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resendEmail2fa: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/resend-email-2fa`, data, { timeout: EMAIL_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyTwoFactor: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/twofa/verify`, data, { timeout: AUTH_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  forgotPassword: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/forgot-password`, data, { timeout: EMAIL_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resetPassword: async (data) => {
    try {
      const response = await axios.post(`${VEXA_ACCOUNT_URL}/api/auth/reset-password`, data, { timeout: AUTH_TIMEOUT_MS });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  getUserProfile,
};