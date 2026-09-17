const jwt = require('jsonwebtoken');

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function transactionSecurity(action) {
  return (req, res, next) => {
    try {
      const token = String(req.get('X-Transaction-Security') || req.body?.transactionSecurityToken || '').trim();
      if (!token) return res.status(401).json({ success: false, message: 'Transaction security verification is required' });
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type !== 'vexatrade_transaction_security' || decoded.userId !== req.user.id) {
        return res.status(401).json({ success: false, message: 'Invalid transaction security verification' });
      }
      if (action && decoded.action !== action) {
        return res.status(401).json({ success: false, message: 'Transaction security verification does not match this action' });
      }
      if (!decoded.emailOtp || !decoded.passcode || (decoded.twoFactorRequired && !decoded.twoFactor)) {
        return res.status(401).json({ success: false, message: 'Transaction security verification is incomplete' });
      }
      req.transactionSecurity = decoded;
      next();
    } catch (_) {
      return res.status(401).json({ success: false, message: 'Transaction security verification expired or is invalid' });
    }
  };
}

module.exports = { transactionSecurity };
