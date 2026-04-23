#![no_std]

use soroban_sdk::{contracttype, Address, Env, String, Vec};

// Types for achievements contract

#[contracttype]
pub struct Achievement {
    pub id: u32,
    pub category: String,
    pub title: String,
    pub unlocked: bool,
}

#[contracttype]
pub struct CategoryCompletionSummary {
    pub category: String,
    pub total_achievements: u32,
    pub unlocked_achievements: u32,
    pub completion_percentage: u32,
}

#[contracttype]
pub struct NextUnlock {
    pub user: Address,
    pub next_achievement: Option<Achievement>,
    pub progress: u32,
}