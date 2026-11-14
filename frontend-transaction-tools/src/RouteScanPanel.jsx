import React, { useState } from 'react';
import { Activity, Blocks, ExternalLink, Globe2, RefreshCw, Search, ShieldCheck, Wallet } from 'lucide-react';

const explorerTx = (chainId, hash) => {
  const bases = { '56':'https://bscscan.com/tx/', '137':'https://polygonscan.com/tx/', '8453':'https://basescan.org/tx/', '42161':'https://arbiscan.io/tx/', '10':'https://optimistic.etherscan.io/tx/', '43114':'https://snowtrace.io/tx/', '2222':'https://kavascan.io/tx/', '42220':'https://celoscan.io/tx/', '8217':'https://www.kaiascan.io/tx/' };
  return (bases[chainId] || 'https://etherscan.io/tx/') + hash;
};
const short = (value) => { const s = String(value || ''); return s.length > 24 ? s.slice(0, 12) + '…' + s.slice(-8) : s || 'Not available'; };
const amount = (raw, decimals) => {
  try { const d = Number(decimals ?? 18); const n = BigInt(String(raw ?? '0')); const scale = 10n ** BigInt(Math.max(0, Math.min(30, d))); const whole = n / scale; const frac = (n % scale).toString().padStart(d, '0').slice(0, 6).replace(/0+$/, ''); return whole.toLocaleString() + (frac ? '.' + frac : ''); } catch { return String(raw ?? '—'); }
};

export default function RouteScanPanel({ apiBase }) {
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState('1');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function load(e) {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) { setError('Enter a valid 0x-prefixed EVM wallet address.'); return; }
    setLoading(true); setError(''); setData(null);
    const base = apiBase + '/api/public-chain/evm/address/' + encodeURIComponent(address.trim());
    try {
      const kinds = ['erc20-transfers', 'erc20-holdings', 'erc20-approvals'];
      const rows = await Promise.all(kinds.map(async kind => {
        const response = await fetch(base + '/' + kind + '?chainid=' + encodeURIComponent(chainId) + '&limit=25', { headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.success === false) throw Error(payload?.message || (kind + ' lookup failed.'));
        return [kind, payload];
      }));
      setData(Object.fromEntries(rows));
    } catch (err) { setError(err.message || 'RouteScan lookup failed. Retry shortly.'); }
    finally { setLoading(false); }
  }
  const transfers = data?.['erc20-transfers']?.data?.items || [];
  const holdings = data?.['erc20-holdings']?.data?.items || [];
  const approvals = data?.['erc20-approvals']?.data?.items || [];
  return <section className="panel wide route-scan-panel">
    <div className="panel-title"><Globe2 size={18}/><div><b>RouteScan · EVM token activity</b><small>Indexed ERC-20 transfers, token holdings and approvals for a public address.</small></div><span className="pill">READ ONLY</span></div>
    <form onSubmit={load} className="route-scan-form">
      <label>Public EVM address<input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x… wallet address" spellCheck="false" autoCapitalize="none" required /></label>
      <label>Network<select value={chainId} onChange={e => setChainId(e.target.value)}><option value="1">Ethereum Mainnet</option><option value="56">BNB Smart Chain</option><option value="137">Polygon</option><option value="8453">Base</option><option value="42161">Arbitrum One</option><option value="10">Optimism</option><option value="43114">Avalanche C-Chain</option><option value="2222">Kava EVM</option><option value="42220">Celo</option><option value="8217">Kaia</option></select></label>
      <button className="primary" disabled={loading}>{loading ? <><RefreshCw className="spin" size={15}/> Loading RouteScan…</> : <><Search size={15}/> Fetch transfers, holdings & approvals</>}</button>
    </form>
    {error && <p className="error-text">{error}</p>}
    {data && <><p className="muted-note">RouteScan indexed public chain data · {new Date(data['erc20-transfers']?.checkedAt || Date.now()).toLocaleString()}. Token labels are provider metadata, not independent proof that a token is genuine. A transfer record does not prove an exchange credited a deposit.</p>
      <div className="route-scan-grid">
        <section className="panel inset-panel"><div className="panel-title"><Activity size={16}/><div><b>ERC-20 transfers</b><small>{data['erc20-transfers']?.data?.count ?? transfers.length} indexed result(s)</small></div></div>
          {!transfers.length ? <p className="muted-note">No transfer rows returned for this address and network.</p> : transfers.map((item, i) => <div className="activity-row" key={(item.txHash || 'tx') + '-' + (item.logIndex ?? i)}><div className="activity-icon"><Blocks size={15}/></div><div className="activity-main"><b>{amount(item.amount, item.tokenDecimals)} {item.tokenSymbol || item.tokenName || 'Token'}</b><small>From {short(item.from)} → To {short(item.to)}</small><small>{item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Timestamp unavailable'} · Block {item.blockNumber ?? 'not indexed'}</small><a href={explorerTx(chainId, item.txHash)} target="_blank" rel="noreferrer">TXID {short(item.txHash)} <ExternalLink size={12}/></a><small>Token contract: {short(item.tokenAddress)}</small></div></div>)}</section>
        <section className="panel inset-panel"><div className="panel-title"><Wallet size={16}/><div><b>ERC-20 holdings</b><small>Indexed token balances</small></div></div>
          {!holdings.length ? <p className="muted-note">No holding rows returned. Verify a specific balance through the chain RPC or official explorer.</p> : holdings.map((item, i) => <div className="activity-row" key={(item.tokenAddress || item.id || 'holding') + '-' + i}><div className="activity-icon"><Wallet size={15}/></div><div className="activity-main"><b>{item.tokenSymbol || item.tokenName || item.name || 'Token'}</b><small>Contract {short(item.tokenAddress || item.contractAddress || item.id)}</small><small>Balance: {String(item.balance ?? item.amount ?? item.quantity ?? 'Provider field not supplied')}</small></div></div>)}</section>
        <section className="panel inset-panel"><div className="panel-title"><ShieldCheck size={16}/><div><b>Token approvals</b><small>Allowance is not a transfer</small></div></div>
          {!approvals.length ? <p className="muted-note">No approval rows returned for this address and network.</p> : approvals.map((item, i) => <div className="activity-row" key={(item.txHash || item.tokenAddress || 'approval') + '-' + i}><div className="activity-icon"><ShieldCheck size={15}/></div><div className="activity-main"><b>{item.tokenSymbol || item.tokenName || 'Token'} · allowance</b><small>Spender: {short(item.spender?.id || item.spender)}</small><small>Current allowance (raw units): {String(item.currentAllowance ?? 'Not supplied')}</small><small>Token contract: {short(item.tokenAddress)}</small>{item.txHash && <a href={explorerTx(chainId, item.txHash)} target="_blank" rel="noreferrer">Approval TXID <ExternalLink size={12}/></a>}</div></div>)}</section>
      </div><p className="footnote"><ShieldCheck size={14}/> Read-only data only. This panel cannot send funds, create a valid TXID, change a recipient wallet balance, or set a third-party exchange deposit to pending. Only a transaction actually broadcast on the selected network can produce on-chain evidence.</p></>}
  </section>;
}
