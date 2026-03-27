# StellarCade Contracts Reference

This document provides a comprehensive reference for all Soroban smart contracts in the Stellarcade platform, organized by category with backend service mappings.

## 📚 Contract Categories

### Core Infrastructure

| Contract                                      | Purpose                                                | Backend Services                                                                 | Status         |
| --------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- | -------------- |
| [`prize-pool`](prize-pool.md)                 | Manages prize pool deposits, reservations, and payouts | `prizePool.service.js`, `deployment.service.js`, `contractMonitoring.service.js` | ✅ Production  |
| [`treasury`](treasury.md)                     | Platform treasury for fund allocation and release      | `deployment.service.js`, `audit.service.js`                                      | ✅ Production  |
| [`random-generator`](random-generator.md)     | Provably fair randomness generation                    | `stellar.service.js`, `deployment.service.js`                                    | ✅ Production  |
| [`access-control`](access-control.md)         | Role-based access management across contracts          | `deployment.service.js`, `audit.service.js`                                      | ✅ Production  |
| [`balance-management`](balance-management.md) | User balance tracking and transfers                    | `prizePool.service.js`                                                           | 🚧 In Progress |
| [`escrow-vault`](escrow-vault.md)             | Escrowed fund management                               | `prizePool.service.js`                                                           | 🚧 In Progress |

### Game Contracts

| Contract                                    | Purpose                              | Backend Services                         | Status         |
| ------------------------------------------- | ------------------------------------ | ---------------------------------------- | -------------- |
| [`coin-flip`](coin-flip.md)                 | Classic head-or-tails game           | `coinFlip.service.js`, `game.service.js` | ✅ Production  |
| [`daily-trivia`](daily-trivia.md)           | Daily trivia challenges with rewards | `trivia.service.js`, `game.service.js`   | ✅ Production  |
| [`speed-trivia`](speed-trivia.md)           | Fast-paced trivia variant            | `trivia.service.js`, `game.service.js`   | 🚧 In Progress |
| [`trivia-game`](trivia-game.md)             | Generic trivia game logic            | `trivia.service.js`, `game.service.js`   | 🚧 In Progress |
| [`dice-roll`](dice-roll.md)                 | Dice rolling game                    | `game.service.js`                        | 🚧 In Progress |
| [`number-guess`](number-guess.md)           | Number guessing game                 | `game.service.js`                        | 🚧 In Progress |
| [`pattern-puzzle`](pattern-puzzle.md)       | Pattern matching puzzles             | `game.service.js`                        | 🚧 In Progress |
| [`wordle-clone`](wordle-clone.md)           | Wordle-style word game               | `game.service.js`                        | 🚧 In Progress |
| [`color-prediction`](color-prediction.md)   | Color prediction game                | `game.service.js`                        | 🚧 In Progress |
| [`higher-lower`](higher-lower.md)           | Higher/lower guessing game           | `game.service.js`                        | 🚧 In Progress |
| [`price-prediction`](price-prediction.md)   | Price prediction market              | `game.service.js`                        | 🚧 In Progress |
| [`ai-generated-game`](ai-generated-game.md) | AI-generated game instances          | `game.service.js`                        | 🚧 In Progress |

### Platform Features

| Contract                                            | Purpose                                   | Backend Services                                   | Status         |
| --------------------------------------------------- | ----------------------------------------- | -------------------------------------------------- | -------------- |
| [`leaderboard`](leaderboard.md)                     | Global player rankings and scores         | `game.service.js`, `contractMonitoring.service.js` | ✅ Production  |
| [`achievement-badge`](achievement-badge.md)         | NFT achievement badges                    | `deployment.service.js`, `audit.service.js`        | 🚧 In Progress |
| [`governance-token`](governance-token.md)           | Governance and voting token               | `deployment.service.js`                            | 🚧 In Progress |
| [`governance`](governance.md)                       | Governance proposal and voting system     | `deployment.service.js`                            | 🚧 In Progress |
| [`staking`](staking.md)                             | Token staking with rewards                | `deployment.service.js`, `audit.service.js`        | 🚧 In Progress |
| [`referral-system`](referral-system.md)             | Referral tracking and rewards             | `game.service.js`                                  | 🚧 In Progress |
| [`reward-distribution`](reward-distribution.md)     | Automated reward distribution             | `prizePool.service.js`                             | 🚧 In Progress |
| [`revenue-split`](revenue-split.md)                 | Revenue sharing mechanism                 | `audit.service.js`                                 | 🚧 In Progress |
| [`fee-management`](fee-management.md)               | Platform fee configuration and collection | `audit.service.js`                                 | 🚧 In Progress |
| [`settlement-queue`](settlement-queue.md)           | Queued settlement processing              | `contractMonitoring.service.js`                    | 🚧 In Progress |
| [`tournament-system`](tournament-system.md)         | Tournament creation and management        | `game.service.js`                                  | 🚧 In Progress |
| [`matchmaking-queue`](matchmaking-queue.md)         | Player matchmaking for multiplayer        | `game.service.js`                                  | 🚧 In Progress |
| [`multiplayer-room`](multiplayer-room.md)           | Multiplayer room management               | `game.service.js`                                  | 🚧 In Progress |
| [`vip-subscription`](vip-subscription.md)           | VIP subscription management               | `audit.service.js`                                 | 🚧 In Progress |
| [`reward-vesting`](reward-vesting.md)               | Token vesting schedules                   | `audit.service.js`                                 | 🚧 In Progress |
| [`streak-bonus`](streak-bonus.md)                   | Streak-based bonus calculations           | `game.service.js`                                  | 🚧 In Progress |
| [`daily-reward-emission`](daily-reward-emission.md) | Daily reward claims                       | `game.service.js`                                  | 🚧 In Progress |
| [`nft-reward`](nft-reward.md)                       | NFT reward distribution                   | `achievement-badge` service                        | 🚧 In Progress |

### Cross-Contract & Utilities

| Contract                                                      | Purpose                                 | Backend Services                                     | Status         |
| ------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- | -------------- |
| [`cross-chain-bridge`](cross-chain-bridge.md)                 | Cross-chain asset transfers             | `stellar.service.js`                                 | 🚧 In Progress |
| [`cross-contract-handler`](cross-contract-handler.md)         | Coordinates cross-contract calls        | `stellar.service.js`                                 | 🚧 In Progress |
| [`cross-contract-call-guard`](cross-contract-call-guard.md)   | Validates cross-contract callers        | `stellar.service.js`                                 | 🚧 In Progress |
| [`contract-address-registry`](contract-address-registry.md)   | Central contract address lookup         | `deployment.service.js`                              | ✅ Production  |
| [`contract-metadata-registry`](contract-metadata-registry.md) | Contract metadata storage               | `deployment.service.js`                              | ✅ Production  |
| [`contract-health-registry`](contract-health-registry.md)     | Aggregates contract health status       | `contractMonitoring.service.js`, `health.service.js` | ✅ Production  |
| [`contract-monitoring`](contract-monitoring.md)               | Central monitoring hub                  | `contractMonitoring.service.js`                      | ✅ Production  |
| [`contract-circuit-breaker`](contract-circuit-breaker.md)     | Emergency circuit breaker               | `contractMonitoring.service.js`                      | ✅ Production  |
| [`contract-upgrade-timelock`](contract-upgrade-timelock.md)   | Manages contract upgrades with timelock | `deployment.service.js`                              | ✅ Production  |
| [`contract-role-registry`](contract-role-registry.md)         | Role management across contracts        | `deployment.service.js`                              | ✅ Production  |
| [`oracle-integration`](oracle-integration.md)                 | Oracle data requests                    | `stellar.service.js`                                 | 🚧 In Progress |
| [`emergency-pause`](emergency-pause.md)                       | Emergency pause system                  | `contractMonitoring.service.js`                      | ✅ Production  |
| [`exploit-prevention`](exploit-prevention.md)                 | Exploit detection and prevention        | `contractMonitoring.service.js`                      | 🚧 In Progress |
| [`penalty-slashing`](penalty-slashing.md)                     | Penalty and slashing logic              | `audit.service.js`                                   | 🚧 In Progress |
| [`dynamic-fee-policy`](dynamic-fee-policy.md)                 | Dynamic fee calculations                | `audit.service.js`                                   | 🚧 In Progress |
| [`epoch-scheduler`](epoch-scheduler.md)                       | Epoch transition scheduling             | `contractMonitoring.service.js`                      | 🚧 In Progress |
| [`session-nonce-manager`](session-nonce-manager.md)           | Session management for auth             | `stellar.service.js`                                 | ✅ Production  |

### Deployment & Tooling

| Contract                                                          | Purpose                             | Backend Services        | Status         |
| ----------------------------------------------------------------- | ----------------------------------- | ----------------------- | -------------- |
| [`deployment-scripts`](deployment-scripts.md)                     | Automated deployment scripts        | `deployment.service.js` | ✅ Production  |
| [`upgrade-mechanism`](upgrade-mechanism.md)                       | Contract upgrade mechanism          | `deployment.service.js` | ✅ Production  |
| [`comprehensive-test-suite`](comprehensive-test-suite.md)         | Test utilities and fixtures         | (Testing only)          | ✅ Production  |
| [`contract-doc-generator`](contract-doc-generator.md)             | Generates contract documentation    | (Documentation)         | ✅ Production  |
| [`contract-interaction-library`](contract-interaction-library.md) | Shared interaction utilities        | `stellar.service.js`    | ✅ Production  |
| [`gas-optimization-analysis`](gas-optimization-analysis.md)       | Gas usage analysis and optimization | `stellar.service.js`    | 🚧 In Progress |

## 🔗 Backend Service Mappings

### Service → Contract Map

| Backend Service                 | Contracts Interacted                                                                                                                                          | Interaction Types |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `stellar.service.js`            | All contracts                                                                                                                                                 | Write, Read       |
| `prizePool.service.js`          | `prize-pool`, `balance-management`, `escrow-vault`, `reward-distribution`                                                                                     | Read, Write       |
| `coinFlip.service.js`           | `coin-flip`, `random-generator`, `prize-pool`                                                                                                                 | Write, Read       |
| `trivia.service.js`             | `daily-trivia`, `speed-trivia`, `trivia-game`                                                                                                                 | Write, Read       |
| `game.service.js`               | All game contracts, `leaderboard`, `tournament-system`, `matchmaking-queue`, `multiplayer-room`                                                               | Write, Read       |
| `deployment.service.js`         | All contracts                                                                                                                                                 | Deployment, Write |
| `contractMonitoring.service.js` | All contracts                                                                                                                                                 | Monitoring        |
| `audit.service.js`              | `treasury`, `staking`, `fee-management`, `revenue-split`, `vip-subscription`, `reward-vesting`, `penalty-slashing`, `dynamic-fee-policy`, `achievement-badge` | Read              |
| `health.service.js`             | `contract-health-registry`, all contracts                                                                                                                     | Read              |

### Contract → Service Map

| Contract            | Primary Backend Service | Secondary Services                                       |
| ------------------- | ----------------------- | -------------------------------------------------------- |
| `prize-pool`        | `prizePool.service.js`  | `deployment.service.js`, `contractMonitoring.service.js` |
| `coin-flip`         | `coinFlip.service.js`   | `game.service.js`, `contractMonitoring.service.js`       |
| `random-generator`  | `stellar.service.js`    | `deployment.service.js`                                  |
| `treasury`          | `audit.service.js`      | `deployment.service.js`                                  |
| `leaderboard`       | `game.service.js`       | `contractMonitoring.service.js`                          |
| `daily-trivia`      | `trivia.service.js`     | `game.service.js`                                        |
| `tournament-system` | `game.service.js`       | -                                                        |
| `staking`           | `audit.service.js`      | `deployment.service.js`                                  |
| `governance-token`  | `deployment.service.js` | -                                                        |
| `access-control`    | `deployment.service.js` | `audit.service.js`                                       |

## 📖 Detailed Contract Documentation

Each contract has its own detailed documentation page:

### Core Infrastructure

- [prize-pool](prize-pool.md) - Prize pool management
- [treasury](treasury.md) - Treasury management
- [random-generator](random-generator.md) - Provably fair RNG
- [access-control](access-control.md) - Access control system
- [balance-management](balance-management.md) - Balance tracking
- [escrow-vault](escrow-vault.md) - Escrow management

### Game Contracts

- [coin-flip](coin-flip.md) - Coin flip game
- [daily-trivia](daily-trivia.md) - Daily trivia
- [speed-trivia](speed-trivia.md) - Speed trivia
- [trivia-game](trivia-game.md) - Generic trivia
- [dice-roll](dice-roll.md) - Dice roll game
- [number-guess](number-guess.md) - Number guessing
- [pattern-puzzle](pattern-puzzle.md) - Pattern puzzle
- [wordle-clone](wordle-clone.md) - Wordle clone
- [color-prediction](color-prediction.md) - Color prediction
- [higher-lower](higher-lower.md) - Higher/lower game
- [price-prediction](price-prediction.md) - Price prediction
- [ai-generated-game](ai-generated-game.md) - AI games

### Platform Features

- [leaderboard](leaderboard.md) - Leaderboard system
- [achievement-badge](achievement-badge.md) - Achievement NFTs
- [governance-token](governance-token.md) - Governance token
- [governance](governance.md) - Governance system
- [staking](staking.md) - Staking system
- [referral-system](referral-system.md) - Referral tracking
- [reward-distribution](reward-distribution.md) - Reward distribution
- [revenue-split](revenue-split.md) - Revenue sharing
- [fee-management](fee-management.md) - Fee management
- [settlement-queue](settlement-queue.md) - Settlement queue
- [tournament-system](tournament-system.md) - Tournament system
- [matchmaking-queue](matchmaking-queue.md) - Matchmaking
- [multiplayer-room](multiplayer-room.md) - Multiplayer rooms
- [vip-subscription](vip-subscription.md) - VIP subscriptions
- [reward-vesting](reward-vesting.md) - Reward vesting
- [streak-bonus](streak-bonus.md) - Streak bonuses
- [daily-reward-emission](daily-reward-emission.md) - Daily rewards
- [nft-reward](nft-reward.md) - NFT rewards

### Cross-Contract & Utilities

- [cross-chain-bridge](cross-chain-bridge.md) - Cross-chain bridge
- [cross-contract-handler](cross-contract-handler.md) - Cross-contract calls
- [cross-contract-call-guard](cross-contract-call-guard.md) - Call validation
- [contract-address-registry](contract-address-registry.md) - Address registry
- [contract-metadata-registry](contract-metadata-registry.md) - Metadata registry
- [contract-health-registry](contract-health-registry.md) - Health registry
- [contract-monitoring](contract-monitoring.md) - Contract monitoring
- [contract-circuit-breaker](contract-circuit-breaker.md) - Circuit breaker
- [contract-upgrade-timelock](contract-upgrade-timelock.md) - Upgrade timelock
- [contract-role-registry](contract-role-registry.md) - Role registry
- [oracle-integration](oracle-integration.md) - Oracle integration
- [emergency-pause](emergency-pause.md) - Emergency pause
- [exploit-prevention](exploit-prevention.md) - Exploit prevention
- [penalty-slashing](penalty-slashing.md) - Penalty slashing
- [dynamic-fee-policy](dynamic-fee-policy.md) - Dynamic fees
- [epoch-scheduler](epoch-scheduler.md) - Epoch scheduler
- [session-nonce-manager](session-nonce-manager.md) - Session nonces

### Deployment & Tooling

- [deployment-scripts](deployment-scripts.md) - Deployment scripts
- [upgrade-mechanism](upgrade-mechanism.md) - Upgrade mechanism
- [comprehensive-test-suite](comprehensive-test-suite.md) - Test suite
- [contract-doc-generator](contract-doc-generator.md) - Doc generator
- [contract-interaction-library](contract-interaction-library.md) - Interaction library
- [gas-optimization-analysis](gas-optimization-analysis.md) - Gas optimization

## 🔄 Contract Dependencies

### Dependency Graph

```
Core Infrastructure:
  prize-pool ─┬─> token (SEP-41)
              └─> access-control

  coin-flip ──┬─> prize-pool (reserve/payout)
              ├─> random-generator (request_random)
              └─> token (SEP-41)

  random-generator ─> access-control (authorization)

  treasury ─┬─> token (SEP-41)
            └─> access-control

Game Contracts:
  daily-trivia ─┬─> prize-pool
                ├─> random-generator
                └─> leaderboard

  tournament-system ─┬─> prize-pool
                     ├─> leaderboard
                     └─> matchmaking-queue

Platform Features:
  leaderboard ─> (standalone, read by game contracts)

  staking ─┬─> governance-token
           └─> reward-distribution

  governance ─┬─> governance-token
              └─> treasury

Utilities:
  contract-address-registry ─> (all contracts, for address lookup)
  contract-monitoring ─> (all contracts, for event monitoring)
  emergency-pause ─> (all contracts, for emergency shutdown)
```

## 📝 Status Legend

| Status         | Meaning                                            |
| -------------- | -------------------------------------------------- |
| ✅ Production  | Deployed and actively used in production           |
| 🚧 In Progress | Under active development, not yet production-ready |
| ⏳ Planned     | Planned for future development                     |
| 🧪 Testing     | Currently in testing phase                         |

## 🔗 Related Documentation

- [Architecture Overview](../ARCHITECTURE.md) - System architecture with interaction matrix
- [Deployment Guide](../DEPLOYMENT.md) - Contract deployment procedures
- [Security Guidelines](../SECURITY.md) - Security best practices
- [API Documentation](../API_DOCUMENTATION.md) - Backend API reference
