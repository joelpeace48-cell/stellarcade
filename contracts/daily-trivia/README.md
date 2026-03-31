# Daily Trivia Contract

Daily Trivia is a one-attempt-per-round game where players submit an answer
payload. The contract verifies the submission against a trusted answer hash
(commitment) and lets correct players claim a share of the round reward.

## Rules

- One submission per player per round.
- Correctness is determined by comparing `sha256(answer_payload)` to the stored
  `answer_commitment`.
- Rewards are split evenly among winners.
- If no winners exist, the reserved reward is released back to the prize pool.

## Public Interface

- `init(admin, prize_pool_contract, balance_contract)`
- `open_round(round_id, answer_commitment, reward_amount)`
- `submit_answer(player, round_id, answer_payload)`
- `close_round(round_id)`
- `claim_reward(player, round_id)`
- `get_round_snapshot()`
- `get_participant_answer_summary()`
- `get_reward_pool_snapshot()`

## Snapshot Reads

- `get_participant_answer_summary` returns deterministic latest-round counters for
  participant, correct, and incorrect submissions.
- `get_reward_pool_snapshot` returns latest-round reward values that align with
  settlement outcomes (`reward_amount`, `winner_count`, and payout totals).
- If no round has been opened, both accessors report an `Uninitialized` status
  with zeroed values.
- Closed rounds are reported as resolved and remain stable across repeated reads.

## Settlement

- On `open_round`, the admin reserves `reward_amount` in the Prize Pool for the
  `round_id`.
- On `claim_reward`, the contract calls Prize Pool payout and credits the winner
  via the User Balance contract.

## Security/Validation

- Only the configured admin can open/close rounds.
- A player can only submit once per round.
- Rewards can only be claimed once per player.
- Round must be closed before rewards are claimed.

## Tests

```bash
cd contracts/daily-trivia
cargo test
```
