#![no_std]

use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::types::*;

// Storage keys

#[contracttype]
pub enum DataKey {
    Admin,
    Quests,
    TotalBudget,
    AllocatedBudget,
}

// Storage functions

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_quests(env: &Env) -> Vec<Quest> {
    env.storage().instance().get(&DataKey::Quests).unwrap_or(Vec::new(&env))
}

pub fn set_quests(env: &Env, quests: &Vec<Quest>) {
    env.storage().instance().set(&DataKey::Quests, quests);
}

pub fn get_total_budget(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalBudget).unwrap_or(0)
}

pub fn set_total_budget(env: &Env, budget: i128) {
    env.storage().instance().set(&DataKey::TotalBudget, &budget);
}

pub fn get_allocated_budget(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::AllocatedBudget).unwrap_or(0)
}

pub fn set_allocated_budget(env: &Env, budget: i128) {
    env.storage().instance().set(&DataKey::AllocatedBudget, &budget);
}