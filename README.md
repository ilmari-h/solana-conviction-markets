# Opportunity Markets

Opportunity Markets allow users to influence decision making by staking. Decision makers benefit from opportunity markets by getting access to high-quality signals, helping them make the best choice.

**How it works:**

1. A decision maker creates a market and deposits a reward
2. Participants propose options to vote on
3. The decision maker opens voting
4. Participants stake on their preferred option
5. The decision maker selects a winning option and closes the market
6. All participants withdraw their stake; those who backed the winner split the reward

**Privacy:** While voting is open, individual votes and stake amounts are hidden from everyone except the decision maker. This prevents herd behavior—participants vote based on their own judgment rather than following the crowd.

Devnet address: `bnchws5HhuD2tHCZmr4Qz57VSGXfWorsoYvhr3jS72b`

## Documentation

See [this document](./docs/market-life-cycle.md) for detailed documentation of the protocol.

## Build & Test

Arcium v0.6.3 required.

Before testing, make sure you build without the feature `hosted-compdefs`.
In `programs/opportunity_market/Cargo.toml` make sure it's not in the defaults array.


```bash
yarn install
arcium build
arcium test
```

## Deployment

1. Enable the `hosted-compdefs` feature by adding to the  defaults in `programs/opportunity_market/Cargo.toml`
2. Update the program `declare_id!` macro to use your program keypair's pubkey
3. Run `arcium build with --skip-keys-sync` (last argument ensures step 2. isn't overwritten)
4. Make sure in your Anchor.toml file, the `opportunity_market` address matches address of step 2 (in the `[programs.localnet]` section if you have no devnet config there!)

Run `arcium deploy` with the correct parameters.

```bash
arcium deploy --cluster-offset 456 \
  --recovery-set-size 4 \
  --keypair-path <PAYER KEYPAIR> \
  --rpc-url <YOUR RPC URL> \
  --program-keypair  <PROGRAM KEYPAIR > \
  --program-name "opportunity_market"
```

Run the compute defs script to initialize compute definitions.

```bash
PROGRAM_ID=<YOUR PROGRAM ID> \
ARCIUM_CLUSTER_OFFSET=456 \
KEYPAIR_PATH=<PAYER KEYPAIR> \
RPC_URL=<YOUR RPC URL> \
npx ts-node scripts/compute-defs.ts
```

## Structure

- `programs/opportunity_market/` - Anchor program
- `encrypted-ixs/` - MPC circuits
- `tests/` - Integration tests
- `demo-app/` - A NextJS demo application
