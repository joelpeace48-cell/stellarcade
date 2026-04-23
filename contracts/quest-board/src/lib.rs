#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

mod storage;
mod types;

use storage::*;
use types::*;

// Contract

#[contract]
pub struct QuestBoardContract;

#[contractimpl]
impl QuestBoardContract {
    // Initialize
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        set_admin(&env, &admin);
    }

    // Accessor for quest-availability summary
    pub fn get_quest_availability_summary(env: Env) -> QuestAvailabilitySummary {
        let quests = get_quests(&env);
        let available_quests = quests.iter().filter(|q| q.available).count() as u32;
        QuestAvailabilitySummary {
            total_quests: quests.len(),
            available_quests,
            quests,
        }
    }

    // Accessor for reward-budget
    pub fn get_reward_budget(env: Env) -> RewardBudget {
        let total = get_total_budget(&env);
        let allocated = get_allocated_budget(&env);
        RewardBudget {
            total_budget: total,
            allocated_budget: allocated,
            remaining_budget: total - allocated,
        }
    }

    // Write functions
    pub fn add_quest(env: Env, quest: Quest) {
        let mut quests = get_quests(&env);
        quests.push_back(quest);
        set_quests(&env, &quests);
    }

    pub fn set_budget(env: Env, total: i128, allocated: i128) {
        set_total_budget(&env, total);
        set_allocated_budget(&env, allocated);
    }
}