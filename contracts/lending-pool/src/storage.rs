#![no_std]

use soroban_sdk::{contracttype, Address, Env};

use crate::types::*;

// Storage keys

#[contracttype]
pub enum DataKey {
    Admin,
    TotalBorrowed,
    TotalSupplied,
    LiquidationBuffer(Address),
}

// Storage functions

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn get_total_borrowed(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalBorrowed).unwrap_or(0)
}

pub fn set_total_borrowed(env: &Env, amount: i128) {
    env.storage().instance().set(&DataKey::TotalBorrowed, &amount);
}

pub fn get_total_supplied(env: &Env) -> i128 {
    env.storage().instance().get(&DataKey::TotalSupplied).unwrap_or(0)
}

pub fn set_total_supplied(env: &Env, amount: i128) {
    env.storage().instance().set(&DataKey::TotalSupplied, &amount);
}

pub fn get_liquidation_buffer(env: &Env, user: &Address) -> Option<LiquidationBuffer> {
    env.storage().persistent().get(&DataKey::LiquidationBuffer(user.clone()))
}

pub fn set_liquidation_buffer(env: &Env, user: &Address, buffer: &LiquidationBuffer) {
    env.storage().persistent().set(&DataKey::LiquidationBuffer(user.clone()), buffer);
    env.storage().persistent().bump(&DataKey::LiquidationBuffer(user.clone()), 518400);
}
