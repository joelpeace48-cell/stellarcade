use soroban_sdk::{contracttype, Address, Vec};

/// Royalty configuration set by a creator for their content asset.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyConfig {
    /// Creator who owns this asset.
    pub creator: Address,
    /// Basis-points fee applied to each sale (e.g. 500 = 5%).
    pub rate_bps: u32,
    /// Token address used for payout.
    pub token: Address,
    /// Whether the config has been initialised.
    pub active: bool,
}

/// Accumulated (but not yet paid out) royalty balance for one creator.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccrualRecord {
    /// Owner of the accrual.
    pub creator: Address,
    /// Token this balance is denominated in.
    pub token: Address,
    /// Total royalties accrued, including already-paid amounts.
    pub total_accrued: i128,
    /// Amount already claimed.
    pub total_paid: i128,
    /// Pending (unpaid) balance = total_accrued - total_paid.
    pub pending: i128,
    /// Number of accrual events recorded.
    pub accrual_count: u32,
}

/// Summary returned by `accrual_summary`: safe to read without auth.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccrualSummary {
    pub creator: Address,
    /// True when a RoyaltyConfig exists for this creator.
    pub exists: bool,
    pub rate_bps: u32,
    pub token: Address,
    pub total_accrued: i128,
    pub total_paid: i128,
    pub pending: i128,
    pub accrual_count: u32,
}

/// One entry in a payout schedule.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutScheduleEntry {
    /// Ledger sequence number at which this payout becomes claimable.
    pub claimable_at_ledger: u32,
    /// Amount that will be paid.
    pub amount: i128,
    /// Whether the payout has already been claimed.
    pub claimed: bool,
}

/// Payout schedule accessor response.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutSchedule {
    pub creator: Address,
    /// True when a schedule has been configured.
    pub exists: bool,
    /// Minimum ledger interval between payouts (0 means no restriction).
    pub interval_ledgers: u32,
    /// Pending entries (not yet claimed).
    pub pending_entries: Vec<PayoutScheduleEntry>,
    /// Number of historical paid entries.
    pub paid_count: u32,
}
