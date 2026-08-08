// backend/src/services/vexaccount.js
const axios = require('axios');

const VEXACCOUNT_URL = process.env.VEXACCOUNT_URL || 'https://api-vexaaccount.onrender.com';

// ──────────────────────────────────────────────────────────────
// ✅ NEW: Get user profile from VexaAccount
// ──────────────────────────────────────────────────────────────
async function getUserProfile(email) {
  try {
    const response = await axios.get(`${VEXACCOUNT_URL}/api/auth/profile-by-email`, {
      params: { email }
    });
    return response.data;
  } catch (error) {
    console.error('❌ [getUserProfile] Error:', error.message);
    throw error;
  }
}

module.exports = {
  register: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/register`, data);
    return response.data;
  },
  login: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/login`, data);
    return response.data;
  },
  verifyOtp: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/verify-otp`, data);
    return response.data;
  },
  resendOtp: async (email) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/resend-otp`, { email });
    return response.data;
  },
  verifyEmail2fa: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/verify-email-2fa`, data);
    return response.data;
  },
  resendEmail2fa: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/resend-email-2fa`, data);
    return response.data;
  },
  verifyTwoFactor: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/twofa/verify`, data);
    return response.data;
  },
  forgotPassword: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/forgot-password`, data);
    return response.data;
  },
  resetPassword: async (data) => {
    const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/reset-password`, data);
    return response.data;
  },
  getUserProfile, // ⬅️ NEW
};
