require('dotenv').config();

const NETWORKS = {
  'eth-mainnet': {
    host: 'eth-mainnet.g.alchemy.com',
    keyName: 'ALCHEMY_ETH_MAINNET_API_KEY',
    label: 'Ethereum Mainnet'
  },
  'opt-sepolia': {
    host: 'opt-sepolia.g.alchemy.com',
    keyName: 'ALCHEMY_OPTIMISM_SEPOLIA_API_KEY',
    label: 'Optimism Sepolia Testnet'
  }
};

const network = process.env.ALCHEMY_NETWORK || 'opt-sepolia';
const config = NETWORKS[network];
if (!config) {
  console.error('Unsupported ALCHEMY_NETWORK. Use eth-mainnet or opt-sepolia.');
  process.exit(1);
}
const apiKey = process.env[config.keyName] ||
  (process.env.ALCHEMY_NETWORK === network ? process.env.ALCHEMY_API_KEY : '');
if (!apiKey) {
  console.error('Missing API key. Set ' + config.keyName + ' in backend/.env. Do not commit secrets.');
  process.exit(1);
}
const endpoint = 'https://' + config.host + '/v2/' + encodeURIComponent(apiKey);

async function rpc(method, params = []) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload?.error?.message || 'RPC request failed with HTTP ' + response.status);
  }
  return payload.result;
}

async function main() {
  console.log('Alchemy RPC demo · ' + config.label);
  const [chainId, blockNumber] = await Promise.all([
    rpc('eth_chainId'),
    rpc('eth_blockNumber')
  ]);
  console.log('Chain ID:', chainId, '(hex)');
  console.log('Latest block:', BigInt(blockNumber).toString());
  const blockTag = network === 'eth-mainnet' ? 'finalized' : 'latest';
  const block = await rpc('eth_getBlockByNumber', [blockTag, false]);
  console.log(blockTag + ' block:', {
    number: block?.number ? BigInt(block.number).toString() : null,
    hash: block?.hash || null,
    timestamp: block?.timestamp ? new Date(Number(BigInt(block.timestamp)) * 1000).toISOString() : null,
    transactionsReturned: Array.isArray(block?.transactions) ? block.transactions.length : 0
  });

  const address = process.env.ALCHEMY_DEMO_ADDRESS;
  if (address && /^0x[a-fA-F0-9]{40}$/.test(address)) {
    const transfers = await rpc('alchemy_getAssetTransfers', [{
      fromBlock: '0x0',
      toBlock: 'latest',
      toAddress: address,
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: '0x14',
      category: ['external', 'internal', 'erc20']
    }]);
    console.log('Recent indexed incoming transfers:', (transfers.transfers || []).map(tx => ({
      hash: tx.hash,
      asset: tx.asset,
      value: tx.value,
      from: tx.from,
      to: tx.to,
      block: tx.blockNum,
      timestamp: tx.metadata?.blockTimestamp || null,
      explorer: (network === 'eth-mainnet' ? 'https://etherscan.io/tx/' : 'https://sepolia-optimism.etherscan.io/tx/') + tx.hash
    })));
  } else {
    console.log('Set ALCHEMY_DEMO_ADDRESS to an address you are authorized to inspect to test indexed incoming transfers.');
  }
}

main().catch(error => {
  console.error('Alchemy demo failed:', error.message);
  process.exitCode = 1;
});
