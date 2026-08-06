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

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};
