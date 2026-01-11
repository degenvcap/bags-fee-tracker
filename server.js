require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3001;

const BAGS_API_KEY = process.env.BAGS_API_KEY;

app.use(cors());
app.use(express.json());

let requestCount = 0;
let resetTime = Date.now() + 24 * 60 * 60 * 1000;

function checkRateLimit() {
  if (Date.now() > resetTime) {
    requestCount = 0;
    resetTime = Date.now() + 24 * 60 * 60 * 1000;
  }
  if (requestCount >= 1000) {
    return false;
  }
  requestCount++;
  return true;
}

app.get('/api/wallet/:username', async (req, res) => {
  try {
    if (!checkRateLimit()) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Try again later.',
        remaining: 0,
        resetTime: new Date(resetTime).toISOString()
      });
    }
    const { username } = req.params;
    const response = await fetch(
      `https://public-api-v2.bags.fm/api/v1/token-launch/fee-share/wallet/v2?provider=twitter&username=${username}`,
      {
        headers: {
          'x-api-key': BAGS_API_KEY
        }
      }
    );
    const data = await response.json();
    res.json({
      ...data,
      rateLimit: {
        used: requestCount,
        remaining: 1000 - requestCount,
        resetTime: new Date(resetTime).toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/token/:mintAddress', async (req, res) => {
  try {
    if (!checkRateLimit()) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Try again later.',
        remaining: 0,
        resetTime: new Date(resetTime).toISOString()
      });
    }
    const { mintAddress } = req.params;
    const response = await fetch(
      `https://public-api-v2.bags.fm/api/v1/token-launch/creator/v3?tokenMint=${mintAddress}`,
      {
        headers: {
          'x-api-key': BAGS_API_KEY
        }
      }
    );
    const data = await response.json();
    
    const formattedData = {
      success: data.success,
      response: {
        tokenName: mintAddress.slice(0, 8) + '...',
        creators: data.response || []
      },
      rateLimit: {
        used: requestCount,
        remaining: 1000 - requestCount,
        resetTime: new Date(resetTime).toISOString()
      }
    };
    
    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get token info including name and symbol
app.get('/api/token-info/:mintAddress', async (req, res) => {
  try {
    const { mintAddress } = req.params;
    
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [
          mintAddress,
          {
            encoding: 'jsonParsed'
          }
        ]
      })
    });

    const data = await response.json();
    
    // Try to get metadata from Jupiter or other sources
    try {
      const jupiterResponse = await fetch(`https://token.jup.ag/strict/${mintAddress}`);
      const jupiterData = await jupiterResponse.json();
      
      res.json({
        success: true,
        name: jupiterData.name || 'Unknown Token',
        symbol: jupiterData.symbol || mintAddress.slice(0, 8),
        decimals: jupiterData.decimals || 9
      });
    } catch {
      res.json({
        success: true,
        name: 'Unknown Token',
        symbol: mintAddress.slice(0, 8),
        decimals: 9
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// IMPROVED: Check WSOL fee claims for a specific token
app.get('/api/check-claim/:wallet/:tokenMint', async (req, res) => {
  try {
    const { wallet, tokenMint } = req.params;
    
    const WSOL_MINT = 'So11111111111111111111111111111111111111112';
    const FEE_PROGRAM = 'FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK'; // Meteora fee program
    
    // Use Helius RPC with your API key for much better rate limits
    const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
    
    console.log(`\n=== Checking WSOL claims for wallet: ${wallet.slice(0, 8)}... ===`);
    console.log(`Looking for fees from token: ${tokenMint.slice(0, 8)}...`);
    
    // Get transaction signatures for this wallet
    const signaturesResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          wallet,
          {
            limit: 50 // Helius can handle this easily
          }
        ]
      })
    });

    const signaturesData = await signaturesResponse.json();
    
    if (!signaturesData.result || signaturesData.result.length === 0) {
      console.log('No transactions found for this wallet');
      return res.json({
        wallet,
        tokenMint,
        hasClaimed: false,
        claimHistory: [],
        totalClaimed: 0,
        claimCount: 0,
        lastChecked: new Date().toISOString()
      });
    }

    console.log(`Found ${signaturesData.result.length} transactions to check`);
    console.log(`First 3 signatures:`);
    signaturesData.result.slice(0, 3).forEach((sig, i) => {
      console.log(`  ${i + 1}. ${sig.signature} (slot: ${sig.slot})`);
    });
    
    // Check if the known claim transaction is in the list
    const knownClaimSig = '3T5YeC1JHaYHNtrS7MjniXQtindeHsUAaAVdPbbbMiNQW33mupCFRxz9FN9U5H2vCRUxxFxDBkn8cDRJrizHwLRW';
    const hasKnownClaim = signaturesData.result.some(sig => sig.signature === knownClaimSig);
    console.log(`Known claim tx (3T5YeC1JHa...) in list: ${hasKnownClaim}`);

    const claimHistory = [];
    let totalClaimed = 0;
    let checkedCount = 0;

    // Check each transaction
    let feeClaimCount = 0;
    let hasWalletSignerCount = 0;
    let hasTokenCount = 0;
    
    for (const sig of signaturesData.result) {
      try {
        checkedCount++;
        const txResponse = await fetch(RPC_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [
              sig.signature,
              {
                encoding: 'jsonParsed',
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
              }
            ]
          })
        });

        const txData = await txResponse.json();
        
        if (txData.error) {
          if (checkedCount <= 5) console.log(`TX ${checkedCount}: RPC Error - ${txData.error.message || JSON.stringify(txData.error)}`);
          continue;
        }
        
        if (!txData.result) {
          if (checkedCount <= 5) console.log(`TX ${checkedCount}: No result returned (sig: ${sig.signature.slice(0, 12)}...)`);
          continue;
        }
        
        if (!txData.result.meta) {
          if (checkedCount <= 5) console.log(`TX ${checkedCount}: No meta in result`);
          continue;
        }

        // Get account keys
        const accountKeys = txData.result.transaction.message.accountKeys || [];
        
        // Check if our wallet is involved in this transaction (as signer OR as any participant)
        const walletInvolved = accountKeys.some(acc => {
          const pubkey = typeof acc === 'string' ? acc : acc.pubkey;
          return pubkey === wallet;
        });

        if (!walletInvolved) {
          if (checkedCount <= 5) console.log(`TX ${checkedCount}: Wallet not involved`);
          continue;
        }
        
        hasWalletSignerCount++; // Rename this variable later to hasWalletInvolvedCount

        // Check if this is a fee claim transaction
        const logMessages = txData.result.meta.logMessages || [];
        const isFeeClaimTx = logMessages.some(log => 
          log.includes('Instruction: ClaimDammV2') || 
          log.includes('Instruction: ClaimUser')
        );

        // Also check if fee program is involved
        const hasFeeProgram = accountKeys.some(account => {
          const pubkey = typeof account === 'string' ? account : account.pubkey;
          return pubkey === FEE_PROGRAM;
        });

        if (!isFeeClaimTx && !hasFeeProgram) {
          if (checkedCount <= 5) console.log(`TX ${checkedCount}: Not a fee claim transaction`);
          continue;
        }
        
        feeClaimCount++;

        console.log(`\n📋 Checking tx ${feeClaimCount}: ${sig.signature.slice(0, 12)}...`);
        console.log(`  - Has ClaimDammV2/ClaimUser instruction: ${isFeeClaimTx}`);
        console.log(`  - Has fee program (${FEE_PROGRAM.slice(0, 8)}...): ${hasFeeProgram}`);

        // Check if our token is involved - MUST check account keys!
        // The token mint appears in accountKeys for fee claims, not necessarily in balances
        const hasTokenInAccountKeys = accountKeys.some(account => {
          const pubkey = typeof account === 'string' ? account : account.pubkey;
          return pubkey === tokenMint;
        });

        const preTokenBalances = txData.result.meta.preTokenBalances || [];
        const postTokenBalances = txData.result.meta.postTokenBalances || [];
        
        const hasTokenInBalances = [...preTokenBalances, ...postTokenBalances].some(
          balance => balance.mint === tokenMint
        );

        const hasOurToken = hasTokenInAccountKeys || hasTokenInBalances;

        console.log(`  - Looking for token: ${tokenMint.slice(0, 8)}...`);
        console.log(`  - Token in account keys: ${hasTokenInAccountKeys}`);
        console.log(`  - Token in balances: ${hasTokenInBalances}`);
        console.log(`  - Involves our token: ${hasOurToken}`);

        if (!hasOurToken) {
          console.log(`  ❌ Skipping - doesn't involve token ${tokenMint.slice(0, 8)}...`);
          continue;
        }
        
        hasTokenCount++;

        console.log(`  ✅ This is a fee claim for our token!`);

        // Calculate WSOL received
        let wsolReceived = 0;

        // Method 1: Check WSOL token balance changes
        for (const postBalance of postTokenBalances) {
          if (postBalance.mint === WSOL_MINT && postBalance.owner === wallet) {
            const preBalance = preTokenBalances.find(
              b => b.accountIndex === postBalance.accountIndex
            );
            
            const postAmount = parseFloat(postBalance.uiTokenAmount.uiAmount || 0);
            const preAmount = preBalance ? parseFloat(preBalance.uiTokenAmount.uiAmount || 0) : 0;
            const received = postAmount - preAmount;

            if (received > 0) {
              console.log(`  💰 WSOL token increase: ${received} (from ${preAmount} to ${postAmount})`);
              wsolReceived += received;
            }
          }
        }

        // Method 2: Check SOL balance changes (wrapped SOL gets unwrapped)
        const preBalances = txData.result.meta.preBalances || [];
        const postBalances = txData.result.meta.postBalances || [];
        
        // Find wallet's account index
        const walletIndex = accountKeys.findIndex(account => {
          const pubkey = typeof account === 'string' ? account : account.pubkey;
          return pubkey === wallet;
        });

        if (walletIndex !== -1) {
          const preSol = preBalances[walletIndex] / 1e9;
          const postSol = postBalances[walletIndex] / 1e9;
          const solChange = postSol - preSol;
          
          console.log(`  💵 SOL balance: ${preSol.toFixed(4)} → ${postSol.toFixed(4)} (change: ${solChange.toFixed(4)})`);
          
          // Add to total if we received SOL (but account for tx fees)
          // We look for increases > 0.01 SOL to filter out dust and fee refunds
          if (solChange > 0.01) {
            console.log(`  💰 SOL balance increase detected: ${solChange}`);
            wsolReceived += solChange;
          }
        }

        // Record the claim if any WSOL/SOL was received
        if (wsolReceived > 0) {
          const timestamp = txData.result.blockTime 
            ? new Date(txData.result.blockTime * 1000).toISOString()
            : sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null;
          
          claimHistory.push({
            signature: sig.signature,
            amount: wsolReceived,
            timestamp: timestamp,
            tokenMint: tokenMint,
            currency: 'SOL',
            txUrl: `https://solscan.io/tx/${sig.signature}`,
            slot: txData.result.slot
          });
          
          totalClaimed += wsolReceived;
          console.log(`  ✅ RECORDED: ${wsolReceived} SOL claimed at ${timestamp}`);
        } else {
          console.log(`  ⚠️ No WSOL/SOL received in this tx`);
        }

      } catch (txError) {
        console.error(`Error fetching transaction ${sig.signature}:`, txError.message);
        continue;
      }
    }

    // Sort by timestamp (newest first)
    claimHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total transactions checked: ${checkedCount}`);
    console.log(`Transactions where wallet was involved: ${hasWalletSignerCount}`);
    console.log(`Fee claim transactions found: ${feeClaimCount}`);
    console.log(`Fee claims involving our token: ${hasTokenCount}`);
    console.log(`Total claims recorded: ${claimHistory.length}`);
    console.log(`Total SOL claimed: ${totalClaimed}`);
    console.log(`===============\n`);

    res.json({
      wallet,
      tokenMint,
      hasClaimed: claimHistory.length > 0,
      claimHistory: claimHistory,
      totalClaimed: totalClaimed,
      claimCount: claimHistory.length,
      currency: 'SOL',
      lastChecked: new Date().toISOString()
    });

  } catch (error) {
    console.error('Check claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rate-limit', (req, res) => {
  res.json({
    used: requestCount,
    remaining: 1000 - requestCount,
    total: 1000,
    resetTime: new Date(resetTime).toISOString()
  });
});

// Test endpoint to verify we can fetch a specific transaction
app.get('/api/test-tx/:signature', async (req, res) => {
  try {
    const { signature } = req.params;
    console.log(`\n=== Testing transaction fetch for ${signature.slice(0, 12)}... ===`);
    
    const txResponse = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          signature,
          {
            encoding: 'jsonParsed',
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed'
          }
        ]
      })
    });

    const txData = await txResponse.json();
    
    if (txData.error) {
      console.log(`Error fetching transaction: ${JSON.stringify(txData.error)}`);
      return res.status(500).json({ error: txData.error });
    }
    
    if (!txData.result) {
      console.log(`No result returned for transaction`);
      return res.json({ found: false, message: 'Transaction not found or pruned' });
    }
    
    console.log(`Transaction found! Block time: ${txData.result.blockTime}`);
    console.log(`Has meta: ${!!txData.result.meta}`);
    console.log(`Account keys: ${txData.result.transaction.message.accountKeys.length}`);
    
    res.json({
      found: true,
      blockTime: txData.result.blockTime,
      slot: txData.result.slot,
      hasMeta: !!txData.result.meta,
      accountKeysCount: txData.result.transaction.message.accountKeys.length
    });
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Bags Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Rate limit: ${1000 - requestCount}/1000 requests remaining`);
  console.log(`🔄 Resets at: ${new Date(resetTime).toLocaleString()}`);
});