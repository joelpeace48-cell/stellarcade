#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Env as _};
use soroban_sdk::{vec, Address, Env, String};

#[test]
fn test_get_category_completion_summary() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AchievementsContract);
    let client = AchievementsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let ach1 = Achievement {
        id: 1,
        category: String::from_str(&env, "combat"),
        title: String::from_str(&env, "First Win"),
        unlocked: true,
    };
    let ach2 = Achievement {
        id: 2,
        category: String::from_str(&env, "combat"),
        title: String::from_str(&env, "Second Win"),
        unlocked: false,
    };
    client.add_achievement(&user, &ach1);
    client.add_achievement(&user, &ach2);

    let summary = client.get_category_completion_summary(&user, &String::from_str(&env, "combat"));
    assert_eq!(summary.total_achievements, 2);
    assert_eq!(summary.unlocked_achievements, 1);
    assert_eq!(summary.completion_percentage, 50);
}

#[test]
fn test_get_next_unlock_none() {
    let env = Env::default();
    let contract_id = env.register_contract(None, AchievementsContract);
    let client = AchievementsContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let user = Address::generate(&env);
    let unlock = client.get_next_unlock(&user);
    assert!(unlock.is_none());
}