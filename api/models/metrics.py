"""
Metrics Models for API Layer

Separate from validator models - these are API-only for tracking calculated metrics.
"""
from tortoise import fields
from tortoise.models import Model


class MetricsSnapshot(Model):
    """
    Time-series snapshots of metrics calculations.

    Stores calculated metrics at specific points in time for historical tracking.
    Does NOT modify any validator models.
    """

    id = fields.IntField(primary_key=True)

    # Timestamp
    snapshot_time = fields.DatetimeField(auto_now_add=True, db_index=True)

    # Subnet-level metrics
    total_tvl_usd = fields.FloatField(default=0.0)
    total_revenue_usd = fields.FloatField(default=0.0)
    total_pnl_usd = fields.FloatField(default=0.0)
    total_emissions_alpha = fields.FloatField(default=0.0)
    total_emissions_usd = fields.FloatField(default=0.0)
    alpha_price_usd = fields.FloatField(default=0.0)

    # Emissions breakdown
    burn_ratio = fields.FloatField(default=0.0)
    miner_ratio = fields.FloatField(default=0.0)
    profit_ratio = fields.FloatField(default=0.0)

    # Calculated data
    metadata = fields.JSONField(default=dict)

    class Meta:
        table = "metrics_snapshots"

    def __str__(self):
        return f"MetricsSnapshot({self.snapshot_time})"


class JobMetrics(Model):
    """
    Calculated metrics per job/vault.

    Stores calculated metrics without modifying validator's Job model.
    """

    id = fields.IntField(primary_key=True)

    # Job reference (string ID, not FK to avoid coupling)
    job_id = fields.CharField(max_length=255, db_index=True)

    # Timestamp
    calculated_at = fields.DatetimeField(auto_now_add=True, db_index=True)

    # TVL metrics
    tvl_token0 = fields.FloatField(default=0.0)
    tvl_token1 = fields.FloatField(default=0.0)
    tvl_usd = fields.FloatField(default=0.0)

    # Price at calculation time
    token0_price_usd = fields.FloatField(default=1.0)
    token1_price_usd = fields.FloatField(default=1.0)

    # Revenue metrics
    revenue_token0 = fields.FloatField(default=0.0)
    revenue_token1 = fields.FloatField(default=0.0)
    revenue_usd = fields.FloatField(default=0.0)

    # PnL metrics
    pnl_token0 = fields.FloatField(default=0.0)
    pnl_token1 = fields.FloatField(default=0.0)
    pnl_usd = fields.FloatField(default=0.0)

    # APY
    apy_percent = fields.FloatField(default=0.0)

    # Round info
    round_count = fields.IntField(default=0)
    last_round_number = fields.IntField(default=0)

    # Additional data
    metadata = fields.JSONField(default=dict)

    class Meta:
        table = "job_metrics"
        indexes = (
            ("job_id", "calculated_at"),
        )

    def __str__(self):
        return f"JobMetrics({self.job_id}, {self.calculated_at})"


class MinerMetrics(Model):
    """
    Calculated metrics per miner.

    Stores earnings, win rate, and performance metrics.
    """

    id = fields.IntField(primary_key=True)

    # Miner reference
    miner_uid = fields.IntField(db_index=True)
    miner_hotkey = fields.CharField(max_length=66, db_index=True)

    # Timestamp
    calculated_at = fields.DatetimeField(auto_now_add=True, db_index=True)

    # Earnings
    estimated_earnings_alpha = fields.FloatField(default=0.0)
    estimated_earnings_usd = fields.FloatField(default=0.0)

    # Performance
    total_score = fields.FloatField(default=0.0)
    win_rate = fields.FloatField(default=0.0)
    total_wins = fields.IntField(default=0)
    total_participations = fields.IntField(default=0)

    # Per-job breakdown
    job_breakdown = fields.JSONField(default=dict)  # {job_id: {earnings, score, wins}}

    # Additional data
    metadata = fields.JSONField(default=dict)

    class Meta:
        table = "miner_metrics"
        indexes = (
            ("miner_uid", "calculated_at"),
        )

    def __str__(self):
        return f"MinerMetrics(uid={self.miner_uid}, {self.calculated_at})"


class PairMetrics(Model):
    """
    Aggregated metrics per trading pair.

    Aggregates metrics across all jobs/vaults for a specific pair.
    """

    id = fields.IntField(primary_key=True)

    # Pair reference
    pair_address = fields.CharField(max_length=42, db_index=True)
    chain_id = fields.IntField(db_index=True)

    # Timestamp
    calculated_at = fields.DatetimeField(auto_now_add=True, db_index=True)

    # Aggregated metrics
    total_tvl_usd = fields.FloatField(default=0.0)
    total_revenue_usd = fields.FloatField(default=0.0)
    total_pnl_usd = fields.FloatField(default=0.0)
    avg_apy_percent = fields.FloatField(default=0.0)

    # Activity
    active_jobs_count = fields.IntField(default=0)
    total_miners = fields.IntField(default=0)

    # Per-job breakdown
    job_breakdown = fields.JSONField(default=dict)  # {job_id: {tvl, revenue, pnl}}

    # Additional data
    metadata = fields.JSONField(default=dict)

    class Meta:
        table = "pair_metrics"
        indexes = (
            ("pair_address", "calculated_at"),
        )

    def __str__(self):
        return f"PairMetrics({self.pair_address}, {self.calculated_at})"


class VaultBalanceSnapshot(Model):
    """
    Vault balance snapshots for inventory change tracking.
    
    Stores initial and periodic vault balances to calculate inventory changes.
    """
    
    id = fields.IntField(primary_key=True)
    
    # Job reference
    job_id = fields.CharField(max_length=255, db_index=True)
    
    # Timestamp
    timestamp = fields.DatetimeField(auto_now_add=True, db_index=True)
    
    # Balances
    balance_token0 = fields.FloatField(default=0.0)
    balance_token1 = fields.FloatField(default=0.0)
    balance_usd = fields.FloatField(default=0.0)
    
    # Snapshot type: 'initial', 'periodic', 'current'
    snapshot_type = fields.CharField(max_length=20, default="periodic")
    
    # Additional data
    metadata = fields.JSONField(default=dict)
    
    class Meta:
        table = "vault_balance_snapshots"
        indexes = (
            ("job_id", "snapshot_type"),
            ("job_id", "timestamp"),
        )
        unique_together = (("job_id", "snapshot_type"),)  # Only one initial per job
    
    def __str__(self):
        return f"VaultBalanceSnapshot({self.job_id}, {self.snapshot_type}, {self.timestamp})"


class SubnetMetricsSnapshot(Model):
    """
    Subnet-wide metrics snapshot (alias for MetricsSnapshot for clarity).
    
    Stores aggregated metrics across all active vaults.
    """
    
    id = fields.IntField(primary_key=True)
    
    # Timestamp
    snapshot_time = fields.DatetimeField(auto_now_add=True, db_index=True)
    
    # Subnet-level metrics
    total_tvl_usd = fields.FloatField(default=0.0)
    total_revenue_usd = fields.FloatField(default=0.0)
    total_pnl_usd = fields.FloatField(default=0.0)
    total_emissions_alpha = fields.FloatField(default=0.0)
    total_emissions_usd = fields.FloatField(default=0.0)
    alpha_price_usd = fields.FloatField(default=0.0)
    
    # Emissions breakdown
    burn_ratio = fields.FloatField(default=0.0)
    miner_ratio = fields.FloatField(default=0.0)
    profit_ratio = fields.FloatField(default=0.0)
    
    # Calculated data
    metadata = fields.JSONField(default=dict)
    
    class Meta:
        table = "subnet_metrics_snapshots"
    
    def __str__(self):
        return f"SubnetMetricsSnapshot({self.snapshot_time})"
