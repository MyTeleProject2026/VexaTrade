import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isVexaBanksAddressRef, isVexaScanTxId } from './vexaBanksModel.js';
import {
  Activity, ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Blocks, Check, ChevronRight,
  CircleDollarSign, Clock3, Database, ExternalLink, FileSearch, Fingerprint, Lock,
  LockKeyhole, RefreshCw, Search, ShieldCheck, UnlockKeyhole, Wallet, X, AlertTriangle,
} from 'lucide-react';

const NETWORKS = [
  ['VEXA-TRON-SIM', 'VexaTRON Simulated Network'],
  ['VEXA-ETHEREUM-SIM', 'VexaETH Simulated Network'],
  ['VEXA-BNB-SIM', 'VexaBNB Simulated Network'],
  ['VEXA-SOLANA-SIM', 'VexaSOL Simulated Network'],
  ['VEXA-DOGE-SIM', 'VexaDOGE Simulated Network'],
  ['VEXA-AVALANCHE-SIM', 'VexaAVAX Simulated Network'],
];
const panelTabs = ['Overview', 'Deposit queue', 'Withdrawal queue', 'Vault accounts', 'Tokens & networks', 'VexaScan'];
const fmt = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(value ?? '0');
};
const short = (value, left = 14, right = 9) => {
  const text = String(value || '');
  return text.length > left + right + 2 ? text.slice(0, left) + '…' + text.slice(-right) : text || '—';
};
const date = (value) => value ? new Date(value).toLocaleString() : '—';

export default function VexaBanksOwnerConsole({ apiBase, token, onToast }) {
  const [tab, setTab] = useState('Overview');
  const [overview, setOverview] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [issueForm, setIssueForm] = useState({ userId: '', assetCode: 'USDT', networkCode: 'VEXA-TRON-SIM', amount: '', note: 'VexaBanks internal virtual test allocation' });
  const [explorerQuery, setExplorerQuery] = useState('');
  const [explorerResult, setExplorerResult] = useState(null);
  const [explorerBusy, setExplorerBusy] = useState(false);
  const [integrity, setIntegrity] = useState(null);
  const [integrityBusy, setIntegrityBusy] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(apiBase + path, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: 'Bearer ' + token,
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) throw new Error(payload.message || ('Request failed (' + response.status + ')'));
    return payload.data ?? payload;
  }, [apiBase, token]);

  const load = useCallback(async (quiet = false) => {
    if (!token) return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [summary, depositRows, withdrawalRows, accountRows, tokenRows, blockRows, priceRows] = await Promise.all([
        request('/api/vexabanks/admin/overview'),
        request('/api/vexabanks/admin/requests?kind=deposit&status=PENDING_REVIEW'),
        request('/api/vexabanks/admin/requests?kind=withdrawal&status=PENDING_REVIEW'),
        request('/api/vexabanks/admin/accounts'),
        request('/api/vexascan/tokens'),
        request('/api/vexascan/blocks?limit=12'),
        request('/api/vexabanks/market-prices'),
      ]);
      setOverview(summary);
      setDeposits(Array.isArray(depositRows) ? depositRows : []);
      setWithdrawals(Array.isArray(withdrawalRows) ? withdrawalRows : []);
      setAccounts(Array.isArray(accountRows) ? accountRows : []);
      setAssets(Array.isArray(tokenRows) ? tokenRows : []);
      setBlocks(Array.isArray(blockRows) ? blockRows : []);
      setPrices(Array.isArray(priceRows) ? priceRows : []);
    } catch (e) {
      setError(e.message || 'Unable to load VexaBanks owner data.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [request, token]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const availableAccounts = useMemo(() => accounts.filter((row) => row.owner_type === 'USER' && row.account_role === 'AVAILABLE'), [accounts]);
  const ownerHoldAccounts = useMemo(() => accounts.filter((row) => row.owner_type === 'OWNER' && row.account_role === 'HOLD'), [accounts]);

  async function review(kind, id, decision) {
    const label = kind === 'deposit' ? 'deposit' : 'withdrawal';
    let note = '';
    if (decision === 'reject') {
      note = window.prompt('Enter the reason for rejecting this simulated ' + label + ' request:') || '';
      if (!note.trim()) return;
    } else if (!window.confirm('Confirm ' + label + ' ' + decision + ' in the VexaBanks internal ledger? No public blockchain transfer will occur.')) {
      return;
    }
    const key = kind === 'deposit' ? 'deposits' : 'withdrawals';
    setActionId(key + ':' + id);
    setError('');
    try {
      await request('/api/vexabanks/admin/' + key + '/' + id + '/' + (decision === 'approve' ? 'approve' : 'reject'), {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setMessage('VexaBanks simulated ' + label + ' request #' + id + ' was ' + (decision === 'approve' ? (kind === 'withdrawal' ? 'settled internally' : 'approved') : 'rejected') + '.');
      await load(true);
    } catch (e) {
      setError(e.message || 'Unable to review request.');
    } finally {
      setActionId('');
    }
  }

  async function issueVirtualAssets(event) {
    event.preventDefault();
    setActionId('issue');
    setError('');
    setMessage('');
    try {
      const result = await request('/api/vexabanks/admin/users/' + encodeURIComponent(issueForm.userId) + '/issue', {
        method: 'POST',
        body: JSON.stringify({
          assetCode: issueForm.assetCode,
          networkCode: issueForm.networkCode,
          amount: issueForm.amount,
          note: issueForm.note,
        }),
      });
      setMessage('Virtual ' + result.amount + ' ' + result.assetCode + ' issued to user #' + issueForm.userId + '. Internal TXID: ' + result.txid);
      setIssueForm((v) => ({ ...v, amount: '' }));
      await load(true);
    } catch (e) {
      setError(e.message || 'Unable to issue virtual assets.');
    } finally {
      setActionId('');
    }
  }

  async function freezeUser(userId, frozen) {
    if (!window.confirm((frozen ? 'Freeze' : 'Unfreeze') + ' all VexaBanks simulated accounts for user #' + userId + '?')) return;
    setActionId('freeze:' + userId);
    try {
      await request('/api/vexabanks/admin/users/' + userId + '/freeze', {
        method: 'POST',
        body: JSON.stringify({ frozen }),
      });
      setMessage('VexaBanks accounts for user #' + userId + ' were ' + (frozen ? 'frozen' : 'unfrozen') + '.');
      await load(true);
    } catch (e) {
      setError(e.message || 'Unable to update account status.');
    } finally {
      setActionId('');
    }
  }

  async function verifyInternalChain() {
    setIntegrityBusy(true);
    setError('');
    try {
      const result = await request('/api/vexascan/verify');
      setIntegrity(result);
      if (!result.valid) setError(result.failure?.reason || 'The internal ledger verification did not pass or the full chain could not be checked.');
    } catch (e) {
      setError(e.message || 'Unable to verify VexaScan chain integrity.');
    } finally {
      setIntegrityBusy(false);
    }
  }

  async function lookupExplorer(event) {
    event.preventDefault();
    const query = explorerQuery.trim();
    if (!query) return;
    setExplorerBusy(true);
    setExplorerResult(null);
    setError('');
    try {
      const isTx = isVexaScanTxId(query);
      const isAddress = isVexaBanksAddressRef(query);
      const isBlock = /^\d+$/.test(query);
      if (isTx) setExplorerResult({ type: 'Transaction', data: await request('/api/vexascan/tx/' + encodeURIComponent(query)) });
      else if (isAddress) setExplorerResult({ type: 'Internal address', data: await request('/api/vexascan/address/' + encodeURIComponent(query)) });
      else if (isBlock) setExplorerResult({ type: 'Block', data: await request('/api/vexascan/blocks/' + encodeURIComponent(query)) });
      else throw new Error('Enter a VXB-TX- internal transaction ID, VXB1_ internal address, or block height.');
    } catch (e) {
      setError(e.message || 'VexaScan lookup failed.');
    } finally {
      setExplorerBusy(false);
    }
  }

  const kpis = [
    ['Latest internal block', overview?.chain?.latestBlock ?? '—', 'VexaBanks simulated ledger'],
    ['Internal transactions', fmt(overview?.transactionCount), 'VexaScan indexed records'],
    ['Pending deposits', fmt(overview?.pendingDeposits?.count), 'Owner HOLD queue'],
    ['Pending withdrawals', fmt(overview?.pendingWithdrawals?.count), 'User reserved queue'],
  ];

  return (
    <div className="vxb-console">
      <div className="vxb-sim-banner"><ShieldCheck size={18}/><div><b>VEXABANKS INTERNAL SIMULATED NETWORK</b><span>Virtual balances · internal token references · simulated addresses, TXIDs and blocks only · no public-chain transfers</span></div><span className="vxb-sim-badge">SIMULATED</span></div>
      <div className="vxb-console-head">
        <div><span className="vxb-eyebrow">VEXABLANK · OWNER CONTROL CENTER</span><h2>VexaBanks</h2><p>VexaBlank owner vault, user asset ledger, holds, approvals and VexaScan explorer</p></div>
        <button className="secondary" type="button" onClick={() => load()} disabled={loading}>{loading ? <RefreshCw className="spin" size={14}/> : <RefreshCw size={14}/>} Refresh</button>
      </div>
      <div className="vxb-tabs">{panelTabs.map(item => <button type="button" key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</div>
      {error && <div className="vxb-alert error"><AlertTriangle size={15}/>{error}<button onClick={() => setError('')}><X size={13}/></button></div>}
      {message && <div className="vxb-alert success"><Check size={15}/>{message}<button onClick={() => setMessage('')}><X size={13}/></button></div>}

      {tab === 'Overview' && <>
        <div className="vxb-kpis">{kpis.map(([label, value, hint]) => <div className="vxb-kpi" key={label}><small>{label}</small><b>{value}</b><span>{hint}</span></div>)}</div>
        <div className="vxb-grid-two">
          <section className="vxb-card"><div className="vxb-card-title"><Lock size={16}/><div><b>Owner HOLD balances</b><small>Virtual deposits held before owner approval</small></div></div>
            {ownerHoldAccounts.length ? ownerHoldAccounts.map(row => <div className="vxb-list-row" key={row.account_ref}><div><b>{row.asset_code} · {row.network_code}</b><small>{row.account_ref}</small></div><strong>{row.balance}</strong></div>) : <p className="vxb-empty">No virtual deposits are currently held in the owner vault.</p>}
          </section>
          <section className="vxb-card"><div className="vxb-card-title"><Activity size={16}/><div><b>Market reference prices</b><small>Public price feed only; not a VexaBanks balance</small></div></div>
            <div className="vxb-price-grid">{prices.map(row => <div className="vxb-price" key={row.symbol}><small>{row.symbol}</small><b>{fmt(row.price)}</b><span className={Number(row.change24hPercent) >= 0 ? 'up' : 'down'}>{Number(row.change24hPercent) >= 0 ? '+' : ''}{fmt(row.change24hPercent)}%</span></div>)}</div>
          </section>
        </div>
        <section className="vxb-card"><div className="vxb-card-title"><Blocks size={16}/><div><b>Latest VexaScan blocks</b><small>Internal hash chain linked to simulated ledger transactions</small></div><button className="vxb-link-button" onClick={() => setTab('VexaScan')}>Open explorer <ChevronRight size={14}/></button><button className="vxb-link-button" type="button" onClick={verifyInternalChain} disabled={integrityBusy}>{integrityBusy ? 'Checking…' : 'Verify chain'}</button></div>
          {blocks.slice(0,6).map(row => <div className="vxb-list-row" key={row.height}><div><b>Block #{row.height}</b><small>{short(row.block_hash, 24, 12)} · previous {short(row.previous_hash, 18, 8)}</small></div><span>{row.transaction_count} tx</span><span>{date(row.created_at)}</span></div>)}
        </section>
      </>}

      {tab === 'Deposit queue' && <section className="vxb-card">
        <div className="vxb-card-title"><ArrowDownCircle size={16}/><div><b>Pending simulated deposits</b><small>Amounts are minted into owner HOLD until reviewed; no public transaction is verified.</small></div><span className="vxb-count">{deposits.length}</span></div>
        {deposits.length ? deposits.map(row => <article className="vxb-request" key={row.id}>
          <div className="vxb-request-top"><b>Deposit #{row.id} · User #{row.user_id} · {row.asset_code} {row.amount}</b><span className="vxb-status pending">{row.status}</span></div>
          <p>{row.network_code} · {row.email || row.uid || row.name || 'User'} · submitted {date(row.created_at)}</p>
          <div className="vxb-mono">Internal address: {row.deposit_address_ref || '—'}<br/>Internal TXID: {row.txid || 'Pending'}<br/>User reference: {row.user_reference || 'Not supplied'}</div>
          {row.proof_url && <a className="vxb-external" href={row.proof_url} target="_blank" rel="noreferrer">Open uploaded reference <ExternalLink size={12}/></a>}
          <div className="vxb-actions"><button className="primary" disabled={!!actionId} onClick={() => review('deposit', row.id, 'approve')}>Approve to user ledger</button><button className="secondary" disabled={!!actionId} onClick={() => review('deposit', row.id, 'reject')}>Reject & reverse hold</button></div>
        </article>) : <p className="vxb-empty">No pending simulated deposits.</p>}
      </section>}

      {tab === 'Withdrawal queue' && <section className="vxb-card">
        <div className="vxb-card-title"><ArrowUpCircle size={16}/><div><b>Pending simulated withdrawals</b><small>Approval moves virtual value between VexaBanks internal accounts only.</small></div><span className="vxb-count">{withdrawals.length}</span></div>
        {withdrawals.length ? withdrawals.map(row => <article className="vxb-request" key={row.id}>
          <div className="vxb-request-top"><b>Withdrawal #{row.id} · User #{row.user_id} · {row.asset_code} {row.amount}</b><span className="vxb-status pending">{row.status}</span></div>
          <p>{row.network_code} · {row.email || row.uid || row.name || 'User'} · submitted {date(row.created_at)}</p>
          <div className="vxb-mono">Destination internal address: {row.destination_address_ref || '—'}<br/>Internal TXID: {row.txid || 'Pending'}</div>
          <div className="vxb-actions"><button className="primary" disabled={!!actionId} onClick={() => review('withdrawal', row.id, 'approve')}>Approve internal transfer</button><button className="secondary" disabled={!!actionId} onClick={() => review('withdrawal', row.id, 'reject')}>Reject & release reserve</button></div>
        </article>) : <p className="vxb-empty">No pending simulated withdrawals.</p>}
      </section>}

      {tab === 'Vault accounts' && <>
        <section className="vxb-card">
          <div className="vxb-card-title"><Wallet size={16}/><div><b>Owner and user ledger accounts</b><small>Amounts are internal virtual units; no private or public wallet is connected.</small></div></div>
          {accounts.map(row => <div className="vxb-list-row" key={row.account_ref}>
            <div><b>{row.owner_type} · {row.owner_id || 'Owner'} · {row.account_role}</b><small>{row.asset_code}/{row.network_code} · {row.email || row.uid || row.account_ref}</small></div>
            <strong>{row.balance} {row.asset_code}</strong>
            {row.owner_type === 'USER' && row.account_role === 'AVAILABLE' && <button className="vxb-icon-button" title={row.status === 'FROZEN' ? 'Unfreeze user accounts' : 'Freeze user accounts'} onClick={() => freezeUser(row.owner_id, row.status !== 'FROZEN')} disabled={!!actionId}>{row.status === 'FROZEN' ? <UnlockKeyhole size={14}/> : <LockKeyhole size={14}/>}</button>}
          </div>)}
        </section>
        <section className="vxb-card">
          <div className="vxb-card-title"><CircleDollarSign size={16}/><div><b>Owner-issued virtual asset allocation</b><small>Test allocation only; every issuance creates a VexaScan transaction and admin audit record.</small></div></div>
          <form className="vxb-issue-form" onSubmit={issueVirtualAssets}>
            <label>User ID<input required type="number" min="1" value={issueForm.userId} onChange={e => setIssueForm(v => ({ ...v, userId: e.target.value }))} placeholder="e.g. 180001"/></label>
            <label>Asset / network<select value={issueForm.assetCode + '|' + issueForm.networkCode} onChange={e => { const [assetCode, networkCode] = e.target.value.split('|'); setIssueForm(v => ({ ...v, assetCode, networkCode })); }}>{assets.map(a => <option key={a.internal_token_ref} value={a.asset_code + '|' + a.network_code}>{a.token_symbol} · {a.network_code}</option>)}</select></label>
            <label>Amount<input required inputMode="decimal" value={issueForm.amount} onChange={e => setIssueForm(v => ({ ...v, amount: e.target.value }))} placeholder="0.00"/></label>
            <label>Audit note<input maxLength="500" value={issueForm.note} onChange={e => setIssueForm(v => ({ ...v, note: e.target.value }))}/></label>
            <button className="primary" type="submit" disabled={actionId === 'issue' || !issueForm.userId || !issueForm.amount}>{actionId === 'issue' ? 'Issuing…' : 'Issue virtual assets'}</button>
          </form>
        </section>
      </>}

      {tab === 'Tokens & networks' && <section className="vxb-card">
        <div className="vxb-card-title"><Database size={16}/><div><b>Internal token registry</b><small>Original VexaBanks identifiers. These are not copied public token contracts.</small></div></div>
        {assets.map(row => <div className="vxb-list-row" key={row.internal_token_ref}>
          <div><b>{row.token_symbol} · {row.network_code}</b><small>{row.display_name} · {row.decimals} decimals · market reference {row.market_symbol || '—'}</small><code>{row.internal_token_ref}</code></div>
          <span className="vxb-status active">INTERNAL</span>
        </div>)}
        <div className="vxb-network-grid">{NETWORKS.map(([code, name]) => <div key={code}><b>{name}</b><small>{code}</small></div>)}</div>
      </section>}

      {tab === 'VexaScan' && <section className="vxb-card">
        <div className="vxb-card-title"><FileSearch size={16}/><div><b>VexaScan internal explorer</b><small>Search internal VexaBanks TXIDs, addresses and block heights.</small></div><button className="vxb-link-button" type="button" onClick={verifyInternalChain} disabled={integrityBusy}>{integrityBusy ? 'Verifying…' : 'Verify chain integrity'}</button></div>
        {integrity && <div className={`vxb-integrity ${integrity.valid ? 'valid' : 'invalid'}`}><b>{integrity.valid ? 'Internal chain integrity verified' : 'Internal chain verification failed'}</b><span>{integrity.checkedBlocks} / {integrity.totalBlocks} blocks checked · latest #{integrity.latestBlock ?? '—'}</span>{integrity.failure && <small>Block #{integrity.failure.height}: {integrity.failure.reason}</small>}<small>This verifies the local simulated block link and double-entry journal only; it is not public blockchain consensus.</small></div>}
        <form className="vxb-explorer-search" onSubmit={lookupExplorer}><input value={explorerQuery} onChange={e => setExplorerQuery(e.target.value)} placeholder="VXB-TX-… · VXB1_… · block height"/><button className="primary" type="submit" disabled={explorerBusy}>{explorerBusy ? <RefreshCw className="spin" size={14}/> : <Search size={14}/>} Search</button></form>
        {explorerResult && <div className="vxb-explorer-result"><b>{explorerResult.type} result</b><pre>{JSON.stringify(explorerResult.data, null, 2)}</pre></div>}
        <div className="vxb-card-title vxb-block-heading"><Blocks size={16}/><div><b>Recent blocks</b><small>Newest first · SHA-256 linked internal blocks</small></div></div>
        {blocks.map(block => <button className="vxb-block-row" type="button" key={block.height} onClick={() => { setExplorerQuery(String(block.height)); request('/api/vexascan/blocks/' + block.height).then(data => setExplorerResult({ type: 'Block', data })).catch(e => setError(e.message)); }}>
          <span>#{block.height}</span><code>{short(block.block_hash, 24, 12)}</code><small>{block.transaction_count} transaction(s)</small><small>{date(block.created_at)}</small>
        </button>)}
        <p className="vxb-footnote">VexaScan is an internal simulated ledger explorer. It does not query TRONSCAN, Etherscan, BscScan, Solana Explorer or another public-chain indexer. A VexaScan TXID cannot be used as a public-chain transaction hash.</p>
      </section>}
      <p className="vxb-footer-note"><ShieldCheck size={13}/> All values in this workspace are virtual simulator funds. VexaBanks records are separate from the public-chain ledger, public wallet balances and real token contracts.</p>
    </div>
  );
}
