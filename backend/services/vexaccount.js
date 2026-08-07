// backend/services/vexaccount.js
const axios = require('axios');

const ACCOUNT_URL = process.env.VEXA_ACCOUNT_URL || 'https://api-vexaaccount.onrender.com';

const register = async (userData) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/register`, userData);
  return res.data;
};

const login = async (credentials) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/login`, credentials);
  return res.data;
};

const verifyOtp = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/verify-otp`, data);
  return res.data;
};

const resendOtp = async (email) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/resend-otp`, { email });
  return res.data;
};

const verifyEmail2fa = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/verify-email-2fa`, data);
  return res.data;
};

const resendEmail2fa = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/resend-email-2fa`, data);
  return res.data;
};

const verifyTwoFactor = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/twofa/verify`, data);
  return res.data;
};

const getProfile = async (token) => {
  const res = await axios.get(`${ACCOUNT_URL}/api/auth/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const updateProfile = async (token, data) => {
  const res = await axios.put(`${ACCOUNT_URL}/api/auth/profile/full`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const changePassword = async (token, data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/change-password`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const deleteAccount = async (token, data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/delete-account`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const forgotPassword = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/forgot-password`, data);
  return res.data;
};

const resetPassword = async (data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/reset-password`, data);
  return res.data;
};

const getConnectedApps = async (token) => {
  const res = await axios.get(`${ACCOUNT_URL}/api/auth/connected-apps`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const connectApp = async (token, data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/connect-app`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

const disconnectApp = async (token, data) => {
  const res = await axios.post(`${ACCOUNT_URL}/api/auth/disconnect-app`, data, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.data;
};

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  verifyEmail2fa,
  resendEmail2fa,
  verifyTwoFactor,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword,
  resetPassword,
  getConnectedApps,
  connectApp,
  disconnectApp,
};
