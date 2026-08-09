// src/routes/transferRoutes.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const pool = require('../../db');
const { authUser } = require('../middleware/auth');
const { createError, createTransactionLog, createUserNotification } = require('../utils/helpers');

router.get('/user/qr-code', authUser, async (req, res, next) => {
  // same as original
});

router.get('/user/by-uid/:uid', authUser, async (req, res, next) => {
  // same as original
});

router.post('/user/transfer', authUser, async (req, res, next) => {
  // same as original
});

router.get('/user/transfers', authUser, async (req, res, next) => {
  // same as original
});

module.exports = router;
