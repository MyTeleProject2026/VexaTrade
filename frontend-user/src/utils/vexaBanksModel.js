export function isVexaBanksAddressRef(value) {
  return /^VXB1_[A-F0-9]{48}$/.test(String(value || '').trim());
}

export function isVexaScanTxId(value) {
  return /^VXB-TX-[a-f0-9]{64}$/i.test(String(value || '').trim());
}

export function isVexaScanBlockHash(value) {
  return /^VXB-BLOCK-[a-f0-9]{64}$/i.test(String(value || '').trim());
}

export function normalizeVexaBanksNetwork(value) {
  const network = String(value || '').trim().toUpperCase();
  return network.endsWith('-SIM') && network.startsWith('VEXA-') ? network : '';
}

export function normalizeVexaBanksBalance(row) {
  if (!row || typeof row !== 'object') return null;
  const assetCode = String(row.assetCode || '').trim().toUpperCase();
  const networkCode = normalizeVexaBanksNetwork(row.networkCode);
  if (!assetCode || !networkCode) return null;
  const fields = ['available', 'reserved', 'hold', 'total'];
  const amounts = {};
  for (const field of fields) {
    const text = String(row[field] ?? '0').trim();
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return null;
    amounts[field] = text;
  }
  return {
    ...row,
    assetCode,
    networkCode,
    symbol: String(row.symbol || assetCode),
    decimals: Math.max(0, Math.min(36, Number(row.decimals) || 0)),
    ...amounts,
    simulated: true,
  };
}
