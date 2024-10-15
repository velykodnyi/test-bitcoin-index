const BitcoinCore = require('bitcoin-core');

// Connect to the Bitcoin node using RPC credentials
const client = new BitcoinCore({
  network: 'testnet',  // use 'regtest' or 'testnet' for testing environments
  host: 'rpc.bitcoind.mutiny.18.215.149.26.sslip.io',  // IP of your Bitcoin node
  port: 443,
  ssl: true,
  username: 'bitcoin',
  password: 'bitcoin',
});

// Address you want to track
const trackedAddress = 'tb1q9pqxppnn7v9c37w8n3qnnfn8vz67kpfm7gafv6';

// Store UTXOs
let utxos = [];

// Function to go through blocks and check transactions
async function scanBlocks(startBlock, endBlock) {
  for (let blockHeight = startBlock; blockHeight <= endBlock; blockHeight++) {
    try {
      // Get block hash from block height
      const blockHash = await client.getBlockHash(blockHeight);
      
      // Fetch block data using the block hash
      const blockData = await client.getBlock(blockHash, 2); // verbosity 2 provides full tx data
      
      console.log(`Scanning block ${blockHeight}...`);

      // Loop through all transactions in the block
      for (const tx of blockData.tx) {
        let txUtxos = [];

        // Check outputs for UTXOs related to the tracked address
        for (let index = 0; index < tx.vout.length; index++) {
          const vout = tx.vout[index];
          if (vout.scriptPubKey.address && vout.scriptPubKey.address.toLowerCase() === trackedAddress.toLowerCase()) {
            console.log(`UTXO found in tx ${tx.txid}, output index ${index}`);
            txUtxos.push({
              txid: tx.txid,
              vout: index,
              value: Math.round(vout.value * 100000000),  // Amount of Bitcoin in this UTXO, converted to satoshis
            });
          }
        }

        // Check inputs to remove spent UTXOs related to the tracked address
        for (let index = 0; index < tx.vin.length; index++) {
          const vin = tx.vin[index];
          if (vin.txid) {
            const inputTx = await client.getRawTransaction(vin.txid, true);
            for (const [inputIndex, inputVout] of inputTx.vout.entries()) {
              if (inputVout.scriptPubKey.address && inputVout.scriptPubKey.address.toLowerCase() === trackedAddress.toLowerCase()) {
                console.log(`Address ${trackedAddress} spent tx ${vin.txid} output ${vin.vout}`);
                // Remove spent UTXO from the list
                utxos = utxos.filter(utxo => !(utxo.txid === vin.txid && utxo.vout === vin.vout));
              }
            }
          }
        }

        // Add new UTXOs to the global UTXO list
        utxos = [...utxos, ...txUtxos];
      }
    } catch (error) {
      console.error(`Error processing block ${blockHeight}:`, error.message);
    }
  }

  return utxos;
}

// Usage: specify the block range to scan
const startBlock = 1518160; // Example start block
const endBlock = 1518180;   // Example end block

scanBlocks(startBlock, endBlock).then(result => {
  console.log('UTXOs for address:', result);
}).catch(error => {
  console.error('Error scanning blocks:', error);
});