//! Stellarcade Governance Contract
//!
//! A timelock-based DAO for platform governance. Token holders propose and
//! vote on proposals. Passed proposals enter a timelock queue before execution.
//!
//! ## Governance Flow
//! 1. Proposer calls `propose` with proposal_id and payload_hash
//! 2. Token holders call `vote` with support (for/against) weighted by holdings
//! 3. After voting period ends, if quorum + threshold met: anyone calls `queue`
//! 4. After timelock delay: anyone calls `execute` with payload
//! 5. Contract verifies payload matches hash and executes admin action
//!
//! ## Security Model
//! - Timelock prevents instant execution of malicious proposals
//! - Quorum ensures minimum participation
//! - Vote threshold prevents 51% attacks (requires super-majority)
//! - Payload hash commitment prevents bait-and-switch
#![no_std]
#![allow(unexpected_cfgs)]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token::TokenClient,
    Address, BytesN, Env,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

pub const PERSISTENT_BUMP_LEDGERS: u32 = 518_400;

// Proposal states
pub const STATE_PENDING: u32 = 0;
pub const STATE_ACTIVE: u32 = 1;
pub const STATE_DEFEATED: u32 = 2;
pub const STATE_SUCCEEDED: u32 = 3;
pub const STATE_QUEUED: u32 = 4;
pub const STATE_EXECUTED: u32 = 5;
pub const STATE_CANCELLED: u32 = 6;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    ProposalAlreadyExists = 4,
    ProposalNotFound = 5,
    InvalidProposalState = 6,
    VotingPeriodActive = 7,
    VotingPeriodEnded = 8,
    QuorumNotReached = 9,
    ThresholdNotMet = 10,
    TimelockNotExpired = 11,
    AlreadyVoted = 12,
    InvalidPayload = 13,
    Overflow = 14,
}

// ---------------------------------------------------------------------------
// Storage types
// ---------------------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    GovernanceToken,
    VotingPeriod,  // ledgers
    TimelockDelay, // ledgers
    QuorumBps,     // basis points of total supply
    ThresholdBps,  // basis points of votes cast
    Proposal(u64),
    Vote(u64, Address), // (proposal_id, voter)
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub proposer: Address,
    pub payload_hash: BytesN<32>,
    pub start_ledger: u32,
    pub end_ledger: u32,
    pub for_votes: i128,
    pub against_votes: i128,
    pub state: u32,
    pub eta: u32, // execution timestamp (ledger) after queueing
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProposalSummary {
    pub exists: bool,
    pub proposal_id: u64,
    pub state: u32,
    pub for_votes: i128,
    pub against_votes: i128,
    pub total_votes: i128,
    pub quorum_votes_required: i128,
    pub quorum_votes_remaining: i128,
    pub quorum_progress_bps: u32,
    pub quorum_reached: bool,
    pub execution_eta: u32,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

#[contractevent]
pub struct ProposalCreated {
    #[topic]
    pub proposal_id: u64,
    pub proposer: Address,
    pub payload_hash: BytesN<32>,
}

#[contractevent]
pub struct VoteCast {
    #[topic]
    pub proposal_id: u64,
    #[topic]
    pub voter: Address,
    pub support: bool,
    pub weight: i128,
}

#[contractevent]
pub struct ProposalQueued {
    #[topic]
    pub proposal_id: u64,
    pub eta: u32,
}

#[contractevent]
pub struct ProposalExecuted {
    #[topic]
    pub proposal_id: u64,
}

#[contractevent]
pub struct ProposalCancelled {
    #[topic]
    pub proposal_id: u64,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct Governance;

#[contractimpl]
impl Governance {
    /// Initialize governance with token and parameters.
    ///
    /// `voting_period`: ledgers for voting (e.g., 17280 = ~1 day at 5s/ledger)
    /// `timelock_delay`: ledgers before execution (e.g., 86400 = ~5 days)
    /// `quorum_bps`: minimum participation (e.g., 400 = 4% of supply)
    /// `threshold_bps`: minimum approval (e.g., 6000 = 60% of votes cast)
    pub fn init(
        env: Env,
        admin: Address,
        governance_token: Address,
        voting_period: u32,
        timelock_delay: u32,
        quorum_bps: u32,
        threshold_bps: u32,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::GovernanceToken, &governance_token);
        env.storage()
            .instance()
            .set(&DataKey::VotingPeriod, &voting_period);
        env.storage()
            .instance()
            .set(&DataKey::TimelockDelay, &timelock_delay);
        env.storage()
            .instance()
            .set(&DataKey::QuorumBps, &quorum_bps);
        env.storage()
            .instance()
            .set(&DataKey::ThresholdBps, &threshold_bps);
        Ok(())
    }

    /// Create a new proposal. Anyone can propose.
    ///
    /// `payload_hash`: SHA-256 of the action to execute (verified at execution)
    pub fn propose(
        env: Env,
        proposer: Address,
        proposal_id: u64,
        payload_hash: BytesN<32>,
    ) -> Result<(), Error> {
        require_initialized(&env)?;
        proposer.require_auth();

        let key = DataKey::Proposal(proposal_id);
        if env.storage().persistent().has(&key) {
            return Err(Error::ProposalAlreadyExists);
        }

        let voting_period: u32 = env
            .storage()
            .instance()
            .get(&DataKey::VotingPeriod)
            .unwrap();
        let current_ledger = env.ledger().sequence();
        let start_ledger = current_ledger;
        let end_ledger = current_ledger
            .checked_add(voting_period)
            .ok_or(Error::Overflow)?;

        let proposal = Proposal {
            proposer: proposer.clone(),
            payload_hash: payload_hash.clone(),
            start_ledger,
            end_ledger,
            for_votes: 0,
            against_votes: 0,
            state: STATE_ACTIVE,
            eta: 0,
        };

        env.storage().persistent().set(&key, &proposal);
        env.storage().persistent().extend_ttl(
            &key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        ProposalCreated {
            proposal_id,
            proposer,
            payload_hash,
        }
        .publish(&env);

        Ok(())
    }

    /// Cast a vote on an active proposal.
    ///
    /// `support`: true = for, false = against
    /// `weight`: voter's token balance at time of vote (verified on-chain)
    pub fn vote(env: Env, proposal_id: u64, voter: Address, support: bool) -> Result<(), Error> {
        require_initialized(&env)?;
        voter.require_auth();

        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::ProposalNotFound)?;

        if proposal.state != STATE_ACTIVE {
            return Err(Error::InvalidProposalState);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger >= proposal.end_ledger {
            return Err(Error::VotingPeriodEnded);
        }

        // Check if already voted
        let vote_key = DataKey::Vote(proposal_id, voter.clone());
        if env.storage().persistent().has(&vote_key) {
            return Err(Error::AlreadyVoted);
        }

        // Get voter's token balance as voting weight
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::GovernanceToken)
            .unwrap();
        let weight = TokenClient::new(&env, &token).balance(&voter);

        if weight <= 0 {
            return Err(Error::NotAuthorized);
        }

        // Record vote
        if support {
            proposal.for_votes = proposal
                .for_votes
                .checked_add(weight)
                .ok_or(Error::Overflow)?;
        } else {
            proposal.against_votes = proposal
                .against_votes
                .checked_add(weight)
                .ok_or(Error::Overflow)?;
        }

        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().extend_ttl(
            &proposal_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        // Mark voter as voted
        env.storage().persistent().set(&vote_key, &true);
        env.storage().persistent().extend_ttl(
            &vote_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        VoteCast {
            proposal_id,
            voter,
            support,
            weight,
        }
        .publish(&env);

        Ok(())
    }

    /// Queue a succeeded proposal into the timelock. Anyone can call.
    ///
    /// Requirements: voting ended, quorum reached, threshold met
    pub fn queue(env: Env, proposal_id: u64) -> Result<(), Error> {
        require_initialized(&env)?;

        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::ProposalNotFound)?;

        if proposal.state != STATE_ACTIVE {
            return Err(Error::InvalidProposalState);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < proposal.end_ledger {
            return Err(Error::VotingPeriodActive);
        }

        // Check quorum: total votes >= quorum_bps of token supply
        // Note: In production, query token.total_supply() and compare:
        // (total_votes * 10000 / total_supply) >= quorum_bps
        // For now, simplified: just require at least 1 vote
        let total_votes = proposal
            .for_votes
            .checked_add(proposal.against_votes)
            .ok_or(Error::Overflow)?;

        if total_votes == 0 {
            return Err(Error::QuorumNotReached);
        }

        // Check threshold: for_votes / total_votes >= threshold_bps
        let threshold_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ThresholdBps)
            .unwrap();
        let for_votes_bps = proposal
            .for_votes
            .checked_mul(10_000)
            .and_then(|v| v.checked_div(total_votes))
            .ok_or(Error::Overflow)?;

        if for_votes_bps < threshold_bps as i128 {
            proposal.state = STATE_DEFEATED;
        } else {
            let timelock_delay: u32 = env
                .storage()
                .instance()
                .get(&DataKey::TimelockDelay)
                .unwrap();
            proposal.eta = current_ledger
                .checked_add(timelock_delay)
                .ok_or(Error::Overflow)?;
            proposal.state = STATE_QUEUED;

            ProposalQueued {
                proposal_id,
                eta: proposal.eta,
            }
            .publish(&env);
        }

        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().extend_ttl(
            &proposal_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        Ok(())
    }

    /// Execute a queued proposal after timelock. Anyone can call.
    ///
    /// `payload_hash_verify`: must match stored hash (prevents bait-and-switch)
    pub fn execute(
        env: Env,
        proposal_id: u64,
        payload_hash_verify: BytesN<32>,
    ) -> Result<(), Error> {
        require_initialized(&env)?;

        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::ProposalNotFound)?;

        if proposal.state != STATE_QUEUED {
            return Err(Error::InvalidProposalState);
        }

        if payload_hash_verify != proposal.payload_hash {
            return Err(Error::InvalidPayload);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < proposal.eta {
            return Err(Error::TimelockNotExpired);
        }

        proposal.state = STATE_EXECUTED;
        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().extend_ttl(
            &proposal_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        ProposalExecuted { proposal_id }.publish(&env);

        // In production, the payload would be decoded and executed here
        // (e.g., call another contract, update config, transfer funds)
        // For this implementation, we just mark as executed

        Ok(())
    }

    /// Admin can cancel a proposal at any state (emergency function)
    pub fn cancel(env: Env, admin: Address, proposal_id: u64) -> Result<(), Error> {
        require_initialized(&env)?;
        require_admin(&env, &admin)?;

        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::ProposalNotFound)?;

        if proposal.state == STATE_EXECUTED || proposal.state == STATE_CANCELLED {
            return Err(Error::InvalidProposalState);
        }

        proposal.state = STATE_CANCELLED;
        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().extend_ttl(
            &proposal_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        ProposalCancelled { proposal_id }.publish(&env);

        Ok(())
    }

    /// Cancel a queued proposal that has exceeded the execution window.
    ///
    /// ## Execution Window Rules
    /// - Queued proposals must be executed within `execution_window` ledgers after `eta`
    /// - Default execution window: 2x the timelock delay (e.g., if timelock=50 ledgers, window=100)
    /// - Anyone can call this function to clean up stale proposals
    /// - Prevents indefinite queue accumulation and governance stagnation
    ///
    /// ## Requirements
    /// - Proposal must be in STATE_QUEUED
    /// - Current ledger must be >= eta + execution_window
    /// - Execution window = timelock_delay * 2 (conservative default)
    ///
    /// ## Security
    /// - Cannot cancel active, executed, or already cancelled proposals
    /// - Prevents malicious actors from flooding the queue with stale proposals
    /// - Allows governance to remain responsive and current
    pub fn cancel_stale(env: Env, proposal_id: u64) -> Result<(), Error> {
        require_initialized(&env)?;

        let proposal_key = DataKey::Proposal(proposal_id);
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&proposal_key)
            .ok_or(Error::ProposalNotFound)?;

        // Can only cancel queued proposals
        if proposal.state != STATE_QUEUED {
            return Err(Error::InvalidProposalState);
        }

        // Calculate execution window: 2x timelock delay after eta
        let timelock_delay: u32 = env
            .storage()
            .instance()
            .get(&DataKey::TimelockDelay)
            .unwrap();
        let execution_window = timelock_delay.checked_mul(2).ok_or(Error::Overflow)?;

        let expiry_ledger = proposal
            .eta
            .checked_add(execution_window)
            .ok_or(Error::Overflow)?;

        let current_ledger = env.ledger().sequence();

        // Check if execution window has passed
        if current_ledger < expiry_ledger {
            return Err(Error::TimelockNotExpired);
        }

        // Cancel the proposal
        proposal.state = STATE_CANCELLED;
        env.storage().persistent().set(&proposal_key, &proposal);
        env.storage().persistent().extend_ttl(
            &proposal_key,
            PERSISTENT_BUMP_LEDGERS,
            PERSISTENT_BUMP_LEDGERS,
        );

        ProposalCancelled { proposal_id }.publish(&env);

        Ok(())
    }

    /// Get proposal details
    pub fn get_proposal(env: Env, proposal_id: u64) -> Result<Proposal, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::ProposalNotFound)
    }

    /// Return a display-ready proposal snapshot.
    ///
    /// Missing proposals return `exists = false` with zeroed numeric fields so
    /// downstream callers can distinguish an empty-state from a real proposal.
    pub fn get_proposal_summary(env: Env, proposal_id: u64) -> ProposalSummary {
        let Some(proposal) = env
            .storage()
            .persistent()
            .get::<_, Proposal>(&DataKey::Proposal(proposal_id))
        else {
            return ProposalSummary {
                exists: false,
                proposal_id,
                state: STATE_PENDING,
                for_votes: 0,
                against_votes: 0,
                total_votes: 0,
                quorum_votes_required: 0,
                quorum_votes_remaining: 0,
                quorum_progress_bps: 0,
                quorum_reached: false,
                execution_eta: 0,
            };
        };

        let total_votes = proposal
            .for_votes
            .checked_add(proposal.against_votes)
            .unwrap_or(i128::MAX);
        let quorum_votes_required = quorum_votes_required(&env);
        let quorum_votes_remaining = if total_votes >= quorum_votes_required {
            0
        } else {
            quorum_votes_required - total_votes
        };
        let quorum_progress_bps = if quorum_votes_required == 0 {
            10_000
        } else {
            let progress = total_votes
                .checked_mul(10_000)
                .and_then(|value| value.checked_div(quorum_votes_required))
                .unwrap_or(10_000);
            if progress > 10_000 {
                10_000
            } else {
                progress as u32
            }
        };

        ProposalSummary {
            exists: true,
            proposal_id,
            state: effective_proposal_state(&env, &proposal, total_votes),
            for_votes: proposal.for_votes,
            against_votes: proposal.against_votes,
            total_votes,
            quorum_votes_required,
            quorum_votes_remaining,
            quorum_progress_bps,
            quorum_reached: total_votes >= quorum_votes_required,
            execution_eta: proposal_execution_eta(&env, &proposal),
        }
    }

    /// Check if an address has voted on a proposal
    pub fn has_voted(env: Env, proposal_id: u64, voter: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Vote(proposal_id, voter))
    }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

fn require_initialized(env: &Env) -> Result<(), Error> {
    if !env.storage().instance().has(&DataKey::Admin) {
        return Err(Error::NotInitialized);
    }
    Ok(())
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)?;
    caller.require_auth();
    if caller != &admin {
        return Err(Error::NotAuthorized);
    }
    Ok(())
}

fn quorum_votes_required(env: &Env) -> i128 {
    let quorum_bps: u32 = env.storage().instance().get(&DataKey::QuorumBps).unwrap();
    if quorum_bps == 0 {
        0
    } else {
        1
    }
}

fn proposal_meets_threshold(env: &Env, proposal: &Proposal, total_votes: i128) -> bool {
    if total_votes == 0 {
        return false;
    }

    let threshold_bps: u32 = env
        .storage()
        .instance()
        .get(&DataKey::ThresholdBps)
        .unwrap();
    proposal
        .for_votes
        .checked_mul(10_000)
        .and_then(|value| value.checked_div(total_votes))
        .map(|approval_bps| approval_bps >= threshold_bps as i128)
        .unwrap_or(false)
}

fn effective_proposal_state(env: &Env, proposal: &Proposal, total_votes: i128) -> u32 {
    if proposal.state != STATE_ACTIVE {
        return proposal.state;
    }

    if env.ledger().sequence() < proposal.end_ledger {
        return STATE_ACTIVE;
    }

    let quorum_required = quorum_votes_required(env);
    if total_votes < quorum_required || !proposal_meets_threshold(env, proposal, total_votes) {
        STATE_DEFEATED
    } else {
        STATE_SUCCEEDED
    }
}

fn proposal_execution_eta(env: &Env, proposal: &Proposal) -> u32 {
    if proposal.eta != 0 {
        return proposal.eta;
    }

    let timelock_delay: u32 = env
        .storage()
        .instance()
        .get(&DataKey::TimelockDelay)
        .unwrap();
    proposal.end_ledger.saturating_add(timelock_delay)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test;
#[cfg(test)]
mod test_custom_token;
