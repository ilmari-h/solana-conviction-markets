# Concurrency Issue in `buySharesBatch` for Same-User Purchases

## Summary

When the same user makes multiple share purchases in a single `buySharesBatch` call, the MPC computations produce garbage data due to a race condition between transaction submission and MPC callback execution.

## Affected Code

**File:** `tests/utils/test-runner.ts`
**Method:** `buySharesBatch` (lines 607-693)

## Symptoms

- Share accounts have `encrypted_state` as all zeros
- `revealedAmount` contains garbage values like `17118052317019531365n` (should be small amounts like `25000000n`)
- `revealedOption` contains garbage values like `44435` (should be small indices like `0`, `1`, `2`)

## Root Cause

The `buySharesBatch` method sends all stake transactions sequentially, then awaits all MPC computations in batch:

```typescript
// Send stake transactions sequentially
for (const data of purchaseData) {
  await sendTransaction(...);  // Transaction confirmed = included in block
}

// Await all computations in batch
await awaitBatchComputationFinalization(...);
```

### The Race Condition

When the **same user** has multiple purchases in the batch:

1. **Stake tx 1** sent & confirmed → queues MPC computation 1, reads VTA with nonce `N`
2. **Stake tx 2** sent & confirmed → queues MPC computation 2, **also reads VTA with nonce `N`** (callback 1 hasn't run yet!)
3. MPC computation 1 completes → callback 1 updates VTA to nonce `N+1` with new ciphertext
4. MPC computation 2 processes → tries to decrypt VTA using nonce `N`, but the ciphertext was updated by callback 1
5. **Result:** Garbage decryption → garbage computation output → share account gets garbage/zero values

### Why Different Users Work Fine

When different users buy shares in the same batch, each user has their own VTA (Vote Token Account). The transactions don't conflict because they read/write independent account state.

## Affected Test

**Test:** `"allows users to vote for multiple options"` in `tests/market.test.ts:273`

This test has a single user who:
1. Adds 2 options via `addMarketOption` (creates share accounts 0 and 1) - works fine (awaited individually)
2. Buys shares for both options via `buySharesBatch` (creates share accounts 2 and 3) - **fails due to race condition**

## Working Test (for reference)

**Test:** `"passes full opportunity market flow"` in `tests/market.test.ts:43`

This test has different users buying shares, so no VTA conflicts occur.

## Proposed Fix

Modify `buySharesBatch` to detect when the same user appears multiple times and process their transactions sequentially (send + await) rather than batching:

```typescript
async buySharesBatch(purchases: SharePurchase[]): Promise<number[]> {
  // Group purchases by user
  const purchasesByUser = new Map<string, typeof purchases>();
  for (const p of purchases) {
    const key = p.userId.toString();
    if (!purchasesByUser.has(key)) {
      purchasesByUser.set(key, []);
    }
    purchasesByUser.get(key)!.push(p);
  }

  // Check if any user has multiple purchases
  const hasMultiPurchaseUser = [...purchasesByUser.values()].some(p => p.length > 1);

  if (hasMultiPurchaseUser) {
    // Process ALL purchases sequentially to avoid race conditions
    const shareAccountIds: number[] = [];
    for (const purchase of purchases) {
      const [id] = await this.buySharesBatchInternal([purchase]);
      shareAccountIds.push(id);
    }
    return shareAccountIds;
  }

  // Original batch logic for different users (safe to parallelize)
  return this.buySharesBatchInternal(purchases);
}
```

Alternatively, for the simplest fix, just process sequentially when same user detected:

```typescript
// In buySharesBatch, after sending each stake tx for a user who has multiple purchases,
// await its computation before sending the next one for that user
```

## Technical Details

### Arcium MPC Flow

1. Client sends transaction that calls `queue_computation` with `ArgBuilder` args
2. Transaction is confirmed (included in block)
3. MPC nodes read the account data specified in `ArgBuilder.account()` calls
4. MPC nodes perform encrypted computation
5. MPC nodes send callback transaction with computation output
6. Callback updates on-chain state (VTA balance, market shares, share account)

### Key Insight

The `.account(pubkey, offset, size)` call in `ArgBuilder` tells MPC nodes to read account data **at computation time**, not at queue time. If another callback modifies that account between queue and computation, the MPC reads inconsistent state.

### Affected Account State

Both of these are read by the stake instruction and modified by callbacks:

1. **VTA (Vote Token Account):** `encrypted_state` and `state_nonce`
2. **Market:** `encrypted_available_shares` and `state_nonce`

## Related Files

- `programs/opportunity_market/src/instructions/stake.rs` - Stake instruction with ArgBuilder
- `encrypted-ixs/src/lib.rs` - MPC circuits (`buy_opportunity_market_shares`)
- `js/src/instructions/stake.ts` - JS instruction builder
- `tests/market.test.ts` - Test cases
