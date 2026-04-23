#![no_std]

use soroban_sdk::{contracttype, Address, Env, String, Vec};

use crate::types::*;

// Storage keys

#[contracttype]
pub enum DataKey {
    Admin,
    Achievements(Address), // per user achievements
    NextUnlock(Address),
}

// Storage functions

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_achievements(env: &Env, user: &Address) -> Vec<Achievement> {
    env.storage().persistent().get(&DataKey::Achievements(user.clone())).unwrap_or(Vec::new(&env))
}

pub fn set_achievements(env: &Env, user: &Address, achievements: &Vec<Achievement>) {
    env.storage().persistent().set(&DataKey::Achievements(user.clone()), achievements);
    env.storage().persistent().bump(&DataKey::Achievements(user.clone()), 518400);
}

pub fn get_next_unlock(env: &Env, user: &Address) -> Option<NextUnlock> {
    env.storage().persistent().get(&DataKey::NextUnlock(user.clone()))
}

pub fn set_next_unlock(env: &Env, user: &Address, unlock: &NextUnlock) {
    env.storage().persistent().set(&DataKey::NextUnlock(user.clone()), unlock);
    env.storage().persistent().bump(&DataKey::NextUnlock(user.clone()), 518400);
}