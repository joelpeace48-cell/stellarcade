#![no_std]

use soroban_sdk::{contracttype, Address, Env, String, Vec};

// Types for quest-board contract

#[contracttype]
pub struct Quest {
    pub id: u32,
    pub title: String,
    pub reward: i128,
    pub available: bool,
}

#[contracttype]
pub struct QuestAvailabilitySummary {
    pub total_quests: u32,
    pub available_quests: u32,
    pub quests: Vec<Quest>,
}

#[contracttype]
pub struct RewardBudget {
    pub total_budget: i128,
    pub allocated_budget: i128,
    pub remaining_budget: i128,
}