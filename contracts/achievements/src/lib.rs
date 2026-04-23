#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod storage;
mod types;

use storage::*;
use types::*;

// Contract

#[contract]
pub struct AchievementsContract;

#[contractimpl]
impl AchievementsContract {
    // Initialize
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        set_admin(&env, &admin);
    }

    // Accessor for category completion summary
    pub fn get_category_completion_summary(env: Env, user: Address, category: String) -> CategoryCompletionSummary {
        let achievements = get_achievements(&env, &user);
        let category_achievements: Vec<Achievement> = achievements.iter().filter(|a| a.category == category).collect();
        let unlocked = category_achievements.iter().filter(|a| a.unlocked).count() as u32;
        let total = category_achievements.len();
        let percentage = if total > 0 { (unlocked * 100) / total } else { 0 };
        CategoryCompletionSummary {
            category,
            total_achievements: total,
            unlocked_achievements: unlocked,
            completion_percentage: percentage,
        }
    }

    // Accessor for next-unlock
    pub fn get_next_unlock(env: Env, user: Address) -> Option<NextUnlock> {
        get_next_unlock(&env, &user)
    }

    // Write functions
    pub fn add_achievement(env: Env, user: Address, achievement: Achievement) {
        let mut achs = get_achievements(&env, &user);
        achs.push_back(achievement);
        set_achievements(&env, &user, &achs);
    }

    pub fn set_next_unlock(env: Env, user: Address, unlock: NextUnlock) {
        set_next_unlock(&env, &user, &unlock);
    }
}