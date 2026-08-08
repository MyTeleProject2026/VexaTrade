// backend/services/vexaccount.js
const axios = require('axios');

// VexaAccount base URL – configure in .env
const VEXACCOUNT_URL = process.env.VEXACCOUNT_URL || 'https://api-vexaaccount.onrender.com';

/**
 * Get user profile from VexaAccount by email
 * Used by /sync-user (fallback if userData is missing)
 */
async function getUserProfile(email) {
  try {
    const response = await axios.get(`${VEXACCOUNT_URL}/api/auth/profile-by-email`, {
      params: { email: email.trim().toLowerCase() },
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.error('❌ [getUserProfile] Error:', error.message);
    throw error;
  }
}

module.exports = {
  register: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/register`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  login: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/login`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyOtp: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/verify-otp`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resendOtp: async (email) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/resend-otp`, { email }, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyEmail2fa: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/verify-email-2fa`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resendEmail2fa: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/resend-email-2fa`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  verifyTwoFactor: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/twofa/verify`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  forgotPassword: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/forgot-password`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  resetPassword: async (data) => {
    try {
      const response = await axios.post(`${VEXACCOUNT_URL}/api/auth/reset-password`, data, {
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },
  getUserProfile,
};
