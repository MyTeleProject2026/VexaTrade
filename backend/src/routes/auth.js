const router = require('express').Router();
const { register, login, verifyOtp, resendOtp } = require('../services/vexaccount');

router.post('/register', async (req, res) => {
  try {
    const result = await register(req.body);
    res.json(result);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || { success: false, message: error.message });
  }
});

// Similar for login, verify-otp, etc.
