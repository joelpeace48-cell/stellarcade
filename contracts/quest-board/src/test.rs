#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Env as _};
use soroban_sdk::{vec, Address, Env, String};

#[test]
fn test_get_quest_availability_summary() {
    let env = Env::default();
    let contract_id = env.register_contract(None, QuestBoardContract);
    let client = QuestBoardContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    let quest = Quest {
        id: 1,
        title: String::from_str(&env, "Test Quest"),
        reward: 100,
        available: true,
    };
    client.add_quest(&quest);

    let summary = client.get_quest_availability_summary();
    assert_eq!(summary.total_quests, 1);
    assert_eq!(summary.available_quests, 1);
}

#[test]
fn test_get_reward_budget() {
    let env = Env::default();
    let contract_id = env.register_contract(None, QuestBoardContract);
    let client = QuestBoardContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    client.set_budget(&1000, &500);

    let budget = client.get_reward_budget();
    assert_eq!(budget.total_budget, 1000);
    assert_eq!(budget.allocated_budget, 500);
    assert_eq!(budget.remaining_budget, 500);
}