const express = require('express');
const router = express.Router();

// Public blockchain data only. This endpoint never signs or broadcasts transactions.
router.get('/public-chain/tron/transaction/:txid', async (req, res) => {
  const txid = String(req.params.txid || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
    return res.status(400).json({ success: false, message: 'A 64-character TRON transaction ID is required.' });
  }
  try {
    const response = await fetch('https://apilist.tronscanapi.com/api/transaction-info?hash=' + encodeURIComponent(txid), {
      headers: { Accept: 'application/json', 'User-Agent': 'VexaTrade-TransactionTools/1.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      return res.status(response.status === 404 ? 404 : 502).json({
        success: false,
        message: response.status === 404 ? 'Transaction not found by TronScan.' : 'TronScan public data provider is temporarily unavailable.'
      });
    }
    const data = await response.json();
    if (!data || (!data.hash && !data.transactionHash && !data.txID && data.confirmed === undefined && data.block === undefined && data.blockNumber === undefined)) {
      return res.status(404).json({ success: false, message: 'TronScan returned no matching transaction.' });
    }
    return res.json({ success: true, source: 'TronScan public API', data });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: error && error.name === 'TimeoutError'
        ? 'TronScan public lookup timed out. Retry or open the official explorer.'
        : 'Unable to reach the TronScan public lookup service right now.'
    });
  }
});

module.exports = router;
