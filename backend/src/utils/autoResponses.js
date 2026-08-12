// backend/src/utils/autoResponses.js

/**
 * VexaTrade Blockchain Ecosystem - Premium AI Knowledge Base
 * 
 * This file powers the AI assistant with comprehensive knowledge
 * about the VexaTrade platform. Responses are crafted to be
 * helpful, conversational, and include direct links to relevant pages.
 */

const knowledgeBase = {
  ecosystem: {
    keywords: ['ecosystem', 'blockchain ecosystem', 'decentralized', 'automated', 'smart contract', 'web3', 'defi'],
    response: `🌐 **Welcome to the VexaTrade Blockchain Ecosystem**

VexaTrade is a fully autonomous, decentralized trading ecosystem powered by smart contracts. No human intervention – everything is automated, transparent, and secure.

**🔹 Key Features:**
- **Automated Trading** – AI‑driven market analysis and order execution.
- **Smart Contract Deposits/Withdrawals** – Instant, trustless transactions.
- **Decentralized Governance** – Community voting on platform upgrades.
- **24/7/365 Operation** – The ecosystem never sleeps.

**📌 Quick Links:**
- [Dashboard](/dashboard) – View your portfolio.
- [Deposit](/deposit) – Add funds via smart contract.
- [Trade](/trade) – Start trading now.

*Ask me about deposits, withdrawals, trading, KYC, loans, or anything else!*`
  },

  greetings: {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'sup', 'yo', 'how are you', 'whats up'],
    response: `👋 **Hello! I'm your VexaTrade AI Assistant.**

I'm here to help you navigate the Blockchain Ecosystem. Whether you need to deposit, trade, or verify your identity, I've got you covered.

**💡 Popular Topics:**
- **Deposits** – How to add funds.
- **Withdrawals** – Cash out your earnings.
- **Trading** – Market orders, limit orders, and more.
- **KYC** – Verify your identity for full access.
- **Joint Accounts** – Share wallets with partners.

**🔗 Quick Actions:**
- [Go to Dashboard](/dashboard)
- [Start a Deposit](/deposit)
- [View Your Assets](/assets)

What would you like to do today?`
  },

  deposits: {
    keywords: ['deposit', 'deposited', 'fund', 'add money', 'add funds', 'deposit funds', 'wallet address', 'send funds'],
    response: `💰 **Deposits – Powered by Smart Contracts**

Depositing is simple and fully automated:

1. **Generate Address** – Get a unique wallet address.
2. **Send Funds** – Transfer crypto to that address.
3. **Automatic Credit** – Funds appear in your balance after blockchain confirmations.

**📊 Details:**
- Minimum: $10 USDT
- Processing: 15–30 minutes
- Supported: USDT (ERC20/BEP20), BTC, ETH, BNB, SOL, ADA

**🔗 [Start a Deposit Now](/deposit)**

*Tip: Always double‑check the network and address before sending!*`
  },

  withdrawals: {
    keywords: ['withdraw', 'withdrawal', 'withdrawals', 'cash out', 'withdraw funds', 'payout'],
    response: `💸 **Withdrawals – Automated & Secure**

Withdrawals are processed by smart contracts:

1. **Submit Request** – Enter amount and wallet address.
2. **Smart Contract Validation** – Verifies your balance and address.
3. **Automatic Execution** – Funds are sent to your wallet.

**📊 Details:**
- Minimum: $10 USDT
- Processing: 24–48 hours (network dependent)
- Fee: 0.1% ecosystem fee

**🔗 [Request a Withdrawal](/withdraw)**

*Ensure your wallet address is correct – transactions are irreversible!*`
  },

  trading: {
    keywords: ['trade', 'trading', 'buy', 'sell', 'order', 'market', 'limit', 'stop loss', 'take profit', 'leverage'],
    response: `📊 **Trading – AI‑Powered & Automated**

VexaTrade's trading engine uses smart contracts and oracles for real‑time execution.

**🔹 Order Types:**
- **Market Order** – Instant execution at current price.
- **Limit Order** – Set your own entry price.
- **Stop Loss / Take Profit** – Automate risk management.

**📊 Trading Pairs:**
BTC/USDT, ETH/USDT, BNB/USDT, SOL/USDT, ADA/USDT, and more.

**🔗 [Start Trading Now](/trade)**

*Use Stop Loss to protect your capital!*`
  },

  kyc: {
    keywords: ['kyc', 'verify', 'verification', 'verify identity', 'id verification', 'document', 'proof of address', 'submit documents', 'approve kyc'],
    response: `📋 **KYC – Blockchain Identity Verification**

Complete your KYC to unlock full platform features:

1. **Upload Documents** – Government ID, selfie, proof of address.
2. **Encrypted Storage** – Your data is safe and private.
3. **Smart Contract Review** – Automated verification (1–2 days).

**🔗 [Start KYC](/kyc)**

*Verified users get higher withdrawal limits and governance rights.*`
  },

  jointAccounts: {
    keywords: ['joint account', 'partner', 'joint', 'shared account', 'family account', 'shared wallet'],
    response: `👥 **Joint Accounts – Shared Multi‑Sig Wallets**

Manage funds together with a partner or family member.

**How it works:**
1. Send a joint account request.
2. Partner approves.
3. Both control the shared wallet – transactions require both signatures.

**🔗 [Set Up Joint Account](/profile)**

*Perfect for shared investments and family finances.*`
  },

  loans: {
    keywords: ['loan', 'borrow', 'lend', 'credit', 'loan request', 'payback', 'repay', 'interest'],
    response: `🏦 **Loans – Smart Contract Lending**

Borrow against your assets with competitive rates:

- **Amount:** $100 – $10,000 USDT
- **Duration:** 7–30 days
- **Interest:** From 5% per month

**🔗 [Apply for a Loan](/loan)**

*Only borrow what you can repay – monitor your collateral ratio.*`
  },

  conversions: {
    keywords: ['convert', 'conversion', 'exchange', 'swap', 'conversion rate', 'exchange rate', 'convert crypto'],
    response: `🔄 **Token Conversions – Instant Swaps**

Convert between cryptocurrencies instantly via AMMs:

- **Supported Pairs:** USDT↔BTC, USDT↔ETH, BTC↔ETH, and more.
- **Fee:** 0.5% (standard), 0.3% (VIP)
- **Instant Execution** – No waiting.

**🔗 [Convert Now](/convert)**

*Check the conversion rate before confirming.*`
  },

  security: {
    keywords: ['security', '2fa', 'two factor', 'authenticator', 'password', 'change password', 'secure account'],
    response: `🔐 **Security – Blockchain‑Grade Protection**

- **2FA** – Google Authenticator or SMS.
- **Private Keys** – You control them.
- **Smart Contract Audits** – Code verified by top firms.

**🔗 [Manage Security Settings](/profile/user-center)**

*Enable 2FA to protect your account.*`
  },

  assets: {
    keywords: ['assets', 'balance', 'portfolio', 'holdings', 'my assets', 'total balance'],
    response: `📊 **Your Assets – Blockchain‑Verified**

View your total portfolio and individual holdings:

- **Total Balance** – Combined value.
- **Asset Distribution** – Breakdown by coin.
- **Profit/Loss** – Performance tracking.

**🔗 [View Assets](/assets)**

*Diversify to manage risk.*`
  },

  transactions: {
    keywords: ['transaction', 'history', 'transaction history', 'order history', 'activity', 'log'],
    response: `📋 **Transaction History – Immutable Records**

Every transaction is permanently recorded on the blockchain:

- **Deposits & Withdrawals** – All movements.
- **Trades & Conversions** – Complete history.
- **Status** – Pending, Confirmed, Completed.

**🔗 [View Transactions](/transactions)**

*Check your transaction hash on the blockchain for verification.*`
  },

  governance: {
    keywords: ['governance', 'vote', 'proposal', 'dao', 'decision', 'community'],
    response: `🗳️ **Governance – Community‑Driven Decisions**

Hold ecosystem tokens to vote on proposals:

- **Fee Adjustments**
- **New Asset Listings**
- **Feature Development**

**🔗 [Participate in Governance](/profile)**

*Your voice matters!*`
  },

  support: {
    keywords: ['support', 'help', 'contact', 'issue', 'problem', 'question', 'complain', 'report', 'assistance'],
    response: `🆘 **Support – Here to Help**

- **AI Assistant** – 24/7 (that's me!).
- **Human Support** – 9 AM – 9 PM EST, Mon–Fri.
- **Email** – support@vexatrade.com

**🔗 [Submit a Ticket](/support)**

*Most issues auto‑resolve via smart contracts.*`
  },

  default: {
    response: `🤖 **VexaTrade AI Assistant**

I'm here to help with anything about the VexaTrade Blockchain Ecosystem.

**🌐 Quick Links:**
- [Dashboard](/dashboard)
- [Deposit](/deposit)
- [Withdraw](/withdraw)
- [Trade](/trade)
- [Assets](/assets)
- [Transactions](/transactions)

**💡 Try asking:**
- "How do I deposit?"
- "What is the withdrawal fee?"
- "How does trading work?"
- "Where is my KYC status?"

I'm always learning – feel free to ask anything!`
  }
};

// ─── Response generation ──────────────────────────────────────────
function generateAutoResponse(userMessage) {
  if (!userMessage || userMessage.trim().length === 0) {
    return knowledgeBase.default.response;
  }

  const message = userMessage.toLowerCase().trim();

  // Category matching (same as before but with enhanced scoring)
  const categories = [
    { name: 'ecosystem', data: knowledgeBase.ecosystem },
    { name: 'greetings', data: knowledgeBase.greetings },
    { name: 'deposits', data: knowledgeBase.deposits },
    { name: 'withdrawals', data: knowledgeBase.withdrawals },
    { name: 'trading', data: knowledgeBase.trading },
    { name: 'kyc', data: knowledgeBase.kyc },
    { name: 'jointAccounts', data: knowledgeBase.jointAccounts },
    { name: 'loans', data: knowledgeBase.loans },
    { name: 'conversions', data: knowledgeBase.conversions },
    { name: 'security', data: knowledgeBase.security },
    { name: 'assets', data: knowledgeBase.assets },
    { name: 'transactions', data: knowledgeBase.transactions },
    { name: 'governance', data: knowledgeBase.governance },
    { name: 'support', data: knowledgeBase.support }
  ];

  let bestMatch = null;
  let highestScore = 0;

  for (const category of categories) {
    let score = 0;
    const keywords = category.data.keywords || [];
    for (const keyword of keywords) {
      if (message.includes(keyword)) {
        score += message.includes(` ${keyword} `) ? 3 : 2;
      }
    }
    const wordCount = message.split(' ').length;
    score += Math.min(wordCount * 0.5, 5);
    if (message.includes('?')) score += 2;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = category;
    }
  }

  if (bestMatch && highestScore > 3) {
    return bestMatch.data.response;
  }

  // Quick‑match single words
  const singleWordMap = {
    'ecosystem': knowledgeBase.ecosystem.response,
    'blockchain': knowledgeBase.ecosystem.response,
    'deposit': knowledgeBase.deposits.response,
    'withdraw': knowledgeBase.withdrawals.response,
    'trade': knowledgeBase.trading.response,
    'kyc': knowledgeBase.kyc.response,
    'loan': knowledgeBase.loans.response,
    'convert': knowledgeBase.conversions.response,
    'security': knowledgeBase.security.response,
    'support': knowledgeBase.support.response,
    'help': knowledgeBase.default.response,
    'assets': knowledgeBase.assets.response,
    'balance': knowledgeBase.assets.response,
    'transactions': knowledgeBase.transactions.response,
    'history': knowledgeBase.transactions.response,
    'joint': knowledgeBase.jointAccounts.response,
    'governance': knowledgeBase.governance.response,
    'vote': knowledgeBase.governance.response,
  };
  for (const [word, response] of Object.entries(singleWordMap)) {
    if (message === word || message.startsWith(word + ' ')) {
      return response;
    }
  }

  return knowledgeBase.default.response;
}

module.exports = { generateAutoResponse, knowledgeBase };
