# System Architecture

This document describes the high-level architecture of the Stellarcade platform.

## 🏗 High-Level Diagram

```ascii
      +-------------------+
      |      Frontend     | (React/Vite)
      +---------+---------+
                |
                v
      +---------+---------+
      |    Backend API    | (Node.js/Express)
      +----+----+----+----+
           |    |    |
           |    |    +------------------------+
           v    v                             v
      +----+----+----+                +-------+-------+
      |  PostgreSQL  |                |     Redis     |
      +--------------+                +-------+-------+
                                              |
                                              v
      +---------------------------------------+-------+
      |           Stellar Network / Soroban           |
      +----+------------------+------------------+----+
           |                  |                  |
           v                  v                  v
    +------+------+    +------+------+    +------+------+
    |  Prize Pool |    |     RNG      |    |  Coin Flip  |
    |   Contract  |    |   Contract   |    |   Contract  |
    +-------------+    +--------------+    +-------------+
```

## 🔗 Backend-Contract Interaction Matrix

This matrix maps backend services to the smart contracts they interact with, showing the type of interaction and purpose.

### Legend

| Symbol | Meaning                             |
| ------ | ----------------------------------- |
| **R**  | Read-only (view/get methods)        |
| **W**  | Write (state-changing transactions) |
| **M**  | Monitoring (event listening)        |
| **D**  | Deployment-related                  |

### Core Infrastructure Contracts

| Contract Crate     | Backend Service                 | Interaction Type | Methods/Endpoints                                        | Description                                            |
| ------------------ | ------------------------------- | ---------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| `prize-pool`       | `prizePool.service.js`          | R, W             | `fund`, `reserve`, `release`, `payout`, `get_pool_state` | Manages prize pool deposits, reservations, and payouts |
| `prize-pool`       | `deployment.service.js`         | D                | Contract deployment & address registry                   | Deploys and tracks prize pool contract addresses       |
| `prize-pool`       | `contractMonitoring.service.js` | M                | Event ingestion, metrics                                 | Monitors pool events for analytics                     |
| `treasury`         | `deployment.service.js`         | D                | Contract deployment                                      | Deploys treasury contract                              |
| `treasury`         | `audit.service.js`              | R                | `treasury_state`                                         | Audits treasury holdings                               |
| `random-generator` | `stellar.service.js`            | W                | `request_random`, `get_result`                           | Submits randomness requests, retrieves results         |
| `random-generator` | `deployment.service.js`         | D                | Contract deployment & authorization                      | Deploys and manages RNG contract                       |
| `access-control`   | `deployment.service.js`         | D, W             | `add_admin`, `remove_admin`                              | Manages admin roles across contracts                   |
| `access-control`   | `audit.service.js`              | R                | Permission checks                                        | Verifies access control state                          |

### Game Contracts

| Contract Crate     | Backend Service                 | Interaction Type | Methods/Endpoints                               | Description                  |
| ------------------ | ------------------------------- | ---------------- | ----------------------------------------------- | ---------------------------- |
| `coin-flip`        | `coinFlip.service.js`           | W, R             | `place_bet`, `resolve_bet`, `get_game`          | Handles coin flip game logic |
| `coin-flip`        | `game.service.js`               | R                | `getRecentGames`                                | Lists recent game results    |
| `coin-flip`        | `contractMonitoring.service.js` | M                | Event ingestion                                 | Monitors game events         |
| `daily-trivia`     | `trivia.service.js`             | W, R             | `start_game`, `submit_answer`, `get_game_state` | Handles trivia game flow     |
| `daily-trivia`     | `game.service.js`               | R                | `getRecentGames`                                | Lists recent trivia games    |
| `speed-trivia`     | `trivia.service.js`             | W, R             | `start_game`, `submit_answer`                   | Fast-paced trivia variant    |
| `dice-roll`        | `game.service.js`               | W, R             | `roll_dice`, `get_roll_result`                  | Dice rolling game logic      |
| `number-guess`     | `game.service.js`               | W, R             | `guess_number`, `get_game_result`               | Number guessing game         |
| `pattern-puzzle`   | `game.service.js`               | W, R             | `submit_pattern`, `verify_pattern`              | Pattern matching puzzles     |
| `wordle-clone`     | `game.service.js`               | W, R             | `start_wordle`, `submit_guess`                  | Wordle-style word game       |
| `color-prediction` | `game.service.js`               | W, R             | `predict_color`, `get_result`                   | Color prediction game        |
| `higher-lower`     | `game.service.js`               | W, R             | `guess_higher_lower`, `get_result`              | Higher/lower guessing game   |
| `price-prediction` | `game.service.js`               | W, R             | `submit_prediction`, `settle_prediction`        | Price prediction market      |

### Platform Feature Contracts

| Contract Crate          | Backend Service                 | Interaction Type | Methods/Endpoints                                              | Description                       |
| ----------------------- | ------------------------------- | ---------------- | -------------------------------------------------------------- | --------------------------------- |
| `leaderboard`           | `game.service.js`               | R                | `get_leaderboard`, `get_player_rank`                           | Retrieves player rankings         |
| `leaderboard`           | `contractMonitoring.service.js` | M                | Score update events                                            | Monitors leaderboard changes      |
| `achievement-badge`     | `deployment.service.js`         | D                | NFT contract deployment                                        | Deploys achievement NFT contracts |
| `achievement-badge`     | `audit.service.js`              | R                | `get_badge_ownership`                                          | Verifies badge ownership          |
| `governance-token`      | `deployment.service.js`         | D                | Token contract deployment                                      | Deploys governance token          |
| `governance`            | `deployment.service.js`         | D, W             | `create_proposal`, `vote`                                      | Governance proposal management    |
| `staking`               | `deployment.service.js`         | D                | Staking contract deployment                                    | Deploys staking contract          |
| `staking`               | `audit.service.js`              | R                | `get_stake_balance`, `get_rewards`                             | Audits staking state              |
| `referral-system`       | `game.service.js`               | W, R             | `register_referral`, `get_referral_rewards`                    | Tracks referrals and rewards      |
| `reward-distribution`   | `prizePool.service.js`          | W                | `distribute_rewards`                                           | Distributes rewards to winners    |
| `revenue-split`         | `audit.service.js`              | R                | `get_split_state`                                              | Audits revenue distribution       |
| `fee-management`        | `audit.service.js`              | R                | `get_fee_config`, `get_collected_fees`                         | Audits fee collection             |
| `balance-management`    | `prizePool.service.js`          | R, W             | `get_balance`, `transfer`                                      | Manages user balances             |
| `escrow-vault`          | `prizePool.service.js`          | W                | `deposit_to_escrow`, `release_from_escrow`                     | Manages escrowed funds            |
| `settlement-queue`      | `contractMonitoring.service.js` | M                | Settlement events                                              | Monitors settlement queue         |
| `tournament-system`     | `game.service.js`               | W, R             | `create_tournament`, `join_tournament`, `get_tournament_state` | Tournament management             |
| `matchmaking-queue`     | `game.service.js`               | W, R             | `join_queue`, `leave_queue`, `get_queue_status`                | Player matchmaking                |
| `multiplayer-room`      | `game.service.js`               | W, R             | `create_room`, `join_room`, `get_room_state`                   | Multiplayer room management       |
| `vip-subscription`      | `audit.service.js`              | R                | `get_subscription_status`                                      | Verifies VIP subscriptions        |
| `reward-vesting`        | `audit.service.js`              | R                | `get_vesting_schedule`, `get_vested_amount`                    | Tracks vesting schedules          |
| `streak-bonus`          | `game.service.js`               | R                | `get_streak_bonus`, `claim_streak_bonus`                       | Streak bonus calculations         |
| `daily-reward-emission` | `game.service.js`               | W, R             | `claim_daily_reward`, `get_next_reward_time`                   | Daily reward claims               |
| `epoch-scheduler`       | `contractMonitoring.service.js` | M                | Epoch events                                                   | Monitors epoch transitions        |
| `session-nonce-manager` | `stellar.service.js`            | W                | `generate_nonce`, `validate_nonce`                             | Session management for auth       |

### Cross-Contract & Utility Contracts

| Contract Crate                 | Backend Service                 | Interaction Type | Methods/Endpoints                            | Description                       |
| ------------------------------ | ------------------------------- | ---------------- | -------------------------------------------- | --------------------------------- |
| `cross-chain-bridge`           | `stellar.service.js`            | W                | `bridge_assets`, `get_bridge_status`         | Cross-chain asset transfers       |
| `cross-contract-handler`       | `stellar.service.js`            | W                | Multi-contract calls                         | Coordinates cross-contract calls  |
| `cross-contract-call-guard`    | `stellar.service.js`            | R                | `validate_caller`                            | Validates cross-contract callers  |
| `contract-address-registry`    | `deployment.service.js`         | R, D             | `get_contract_address`, `register_contract`  | Central contract address lookup   |
| `contract-metadata-registry`   | `deployment.service.js`         | R, D             | `get_metadata`, `update_metadata`            | Contract metadata storage         |
| `contract-health-registry`     | `contractMonitoring.service.js` | M, R             | Health check aggregation                     | Aggregates contract health status |
| `contract-monitoring`          | `contractMonitoring.service.js` | M                | All monitoring events                        | Central monitoring hub            |
| `contract-circuit-breaker`     | `contractMonitoring.service.js` | M, W             | `trigger_breaker`, `reset_breaker`           | Emergency circuit breaker         |
| `contract-upgrade-timelock`    | `deployment.service.js`         | D, W             | `schedule_upgrade`, `execute_upgrade`        | Manages contract upgrades         |
| `contract-role-registry`       | `deployment.service.js`         | R, W             | `get_role`, `assign_role`                    | Role management across contracts  |
| `oracle-integration`           | `stellar.service.js`            | W                | `request_oracle_data`, `get_oracle_response` | Oracle data requests              |
| `emergency-pause`              | `contractMonitoring.service.js` | M, W             | `pause_all`, `unpause_all`                   | Emergency pause system            |
| `exploit-prevention`           | `contractMonitoring.service.js` | M                | Exploit detection events                     | Monitors for exploit patterns     |
| `penalty-slashing`             | `audit.service.js`              | R, W             | `get_penalty`, `apply_slashing`              | Penalty and slashing logic        |
| `dynamic-fee-policy`           | `audit.service.js`              | R                | `get_current_fee`, `get_fee_history`         | Dynamic fee calculations          |
| `gas-optimization-analysis`    | `stellar.service.js`            | R                | `analyze_gas_usage`, `get_optimization_tips` | Gas optimization analysis         |
| `ai-generated-game`            | `game.service.js`               | W, R             | `generate_game`, `play_ai_game`              | AI-generated game instances       |
| `nft-reward`                   | `achievement-badge` service     | W, R             | `mint_reward`, `get_reward_nft`              | NFT reward distribution           |
| `comprehensive-test-suite`     | (Testing only)                  | -                | All test utilities                           | Test utilities and fixtures       |
| `contract-doc-generator`       | (Documentation)                 | -                | Doc generation                               | Generates contract documentation  |
| `contract-interaction-library` | `stellar.service.js`            | R                | Shared interaction utilities                 | Common interaction patterns       |
| `deployment-scripts`           | `deployment.service.js`         | D                | All deployment scripts                       | Automated deployment              |
| `upgrade-mechanism`            | `deployment.service.js`         | D, W             | `propose_upgrade`, `execute_upgrade`         | Contract upgrade mechanism        |
| `trivia-game`                  | `trivia.service.js`             | W, R             | Generic trivia game logic                    | Base trivia game implementation   |

### Backend Services Summary

| Backend Service                 | Primary Contracts                                                         | Interaction Types | Purpose                                            |
| ------------------------------- | ------------------------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| `stellar.service.js`            | All contracts                                                             | W, R              | Core Stellar transaction submission and monitoring |
| `prizePool.service.js`          | `prize-pool`, `balance-management`, `escrow-vault`, `reward-distribution` | R, W              | Prize pool and fund management                     |
| `coinFlip.service.js`           | `coin-flip`, `random-generator`, `prize-pool`                             | W, R              | Coin flip game logic                               |
| `trivia.service.js`             | `daily-trivia`, `speed-trivia`, `trivia-game`                             | W, R              | Trivia game logic                                  |
| `game.service.js`               | All game contracts, `leaderboard`, `tournament-system`                    | W, R              | Central game management service                    |
| `deployment.service.js`         | All contracts                                                             | D, W              | Contract deployment and address management         |
| `contractMonitoring.service.js` | All contracts                                                             | M                 | Event monitoring and metrics aggregation           |
| `audit.service.js`              | `treasury`, `staking`, `fee-management`, `revenue-split`                  | R                 | Auditing and compliance checks                     |
| `health.service.js`             | `contract-health-registry`, all contracts                                 | R                 | Health check aggregation                           |

## 🔄 Data Flow with Contract Interactions

### Example: Coin Flip Game Flow

```
┌────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend  │────▶│ Backend API │────▶│stellar.svc.js│────▶│  Horizon/   │
│            │◀────│             │◀────│              │◀────│  Soroban RPC│
└────────────┘     └──────┬──────┘     └──────────────┘     └─────────────┘
                          │
                          │ 1. POST /api/games/play (coin-flip)
                          │ 2. Validate request, check balance
                          │
                          ├─────────────────────────────────────────┐
                          │                                         │
                          ▼                                         ▼
                   ┌─────────────┐                          ┌──────────────┐
                   │coinFlip.svc │                          │prizePool.svc │
                   │             │                          │              │
                   │ place_bet() │                          │ reserve()    │
                   └──────┬──────┘                          └──────┬───────┘
                          │                                        │
                          └──────────────────┬─────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │random-generator │
                                    │  contract       │
                                    │ request_random()│
                                    └─────────────────┘
```

### Step-by-Step Flow

1. **Frontend** submits game request to Backend API
2. **Backend API** validates request (auth, balance, input validation)
3. **game.service** routes to appropriate game service (e.g., `coinFlip.service`)
4. **stellar.service** submits transaction to Soroban RPC
5. **Contract execution**:
   - `coin-flip` contract calls `prize-pool.reserve()` to lock wager
   - `coin-flip` contract calls `random-generator.request_random()` for RNG
6. **Backend** listens for contract events via `contractMonitoring.service`
7. **Oracle** fulfills randomness via `random-generator.fulfill_random()`
8. **Backend** or anyone calls `coin-flip.resolve_bet()` to settle game
9. **Contract** emits result event, updates prize pool
10. **contractMonitoring.service** ingests event, updates metrics
11. **Backend** updates PostgreSQL with game result
12. **Frontend** polls or receives notification of result

## 🛠 Component Overview

### 1. Smart Contracts (Soroban)

- **Prize Pool**: Manages the accumulation and distribution of tokens.
- **RNG**: A provably fair random number generator.
- **Game Contracts**: Specific logic for games like Coin Flip.

### 2. Backend (Node.js)

- Acts as a gateway between the frontend and the Stellar network.
- Manages user sessions, game history, and off-chain data.
- Submits transactions to the network and listens for events.

### 3. Database (PostgreSQL)

- Stores user profiles, transaction logs, and game results for quick retrieval and analytics.

### 4. Cache (Redis)

- Used for session management and rate limiting.
- Caches contract states to reduce load on Horizon/RPC.

## 🔄 Data Flow

1. **Player Interaction**: Player initiates a game from the frontend.
2. **Backend Submission**: Backend validates the request and prepares a Soroban transaction.
3. **Stellar Network**: Transaction is submitted to the Stellar network.
4. **Contract Execution**: The specific Game Contract executed, interacting with the RNG and Prize Pool.
5. **Event Emission**: The contract emits an event with the game result.
6. **Backend Tracking**: Backend listens for the event, updates the PostgreSQL database, and notifies the player.

## 🔒 Security Architecture

- **JWT Authentication**: Secure communication between frontend and backend.
- **Input Validation**: Strict schema validation for all API requests.
- **Contract Safety**: Use of `Result` types, access control, and thorough unit testing.
- **RNG Integrity**: Provably fair implementation using cryptographic seeds.
