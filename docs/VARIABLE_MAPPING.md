# SN98 ForeverMoney - Variable Mapping Reference

> Complete reference of all variables, configurations, and data fields used throughout the system

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Protocol Variables](#protocol-variables)
3. [Database Fields](#database-fields)
4. [Service Variables](#service-variables)
5. [Smart Contract Variables](#smart-contract-variables)
6. [Frontend Data Points](#frontend-data-points)

---

## Environment Variables

### Network Configuration

#### `NETUID`
- **Type**: `int`
- **Default**: `98`
- **Description**: Bittensor subnet identifier
- **Used In**: [`validator/utils/env.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/env.py#L58-L62)
- **Usage**: Identifies the subnet on the Bittensor network
- **Example**: `98`

#### `SUBTENSOR_NETWORK`
- **Type**: `str`
- **Default**: `"finney"`
- **Description**: Subtensor network endpoint
- **Used In**: [`validator/utils/env.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/env.py#L63-L67)
- **Options**: `"finney"` (mainnet), `"test"` (testnet), `"local"`, or full WebSocket URL
- **Example**: `"finney"` or `"ws://127.0.0.1:9944"`

#### `MAINNET_RPC`
- **Type**: `str`
- **Default**: `"https://eth.llamarpc.com"`
- **Description**: Ethereum mainnet RPC endpoint
- **Used In**: [`validator/utils/env.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/env.py#L46-L50)
- **Usage**: For price feeds and cross-chain data

#### `BASE_RPC`
- **Type**: `str`
- **Default**: `"https://base.llamarpc.com"`
- **Description**: Base L2 RPC endpoint
- **Used In**: [`validator/utils/env.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/env.py#L51-L55)
- **Usage**: Primary blockchain for liquidity operations
- **Chain ID**: `8453`

---

### Validator Configuration

#### `EXECUTOR_BOT_URL`
- **Type**: `str`
- **Default**: `None`
- **Description**: Executor bot API endpoint for live strategy execution
- **Used In**: [`validator/round_orchestrator.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/round_orchestrator.py#L609)
- **Example**: `"https://executor.example.com"`
- **Endpoint Called**: `POST /execute_strategy`

#### `EXECUTOR_BOT_API_KEY`
- **Type**: `str`
- **Default**: `None`
- **Description**: API key for authenticating with executor bot
- **Used In**: [`validator/round_orchestrator.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/round_orchestrator.py#L630)
- **Security**: Should be kept secret

#### `REBALANCE_CHECK_INTERVAL`
- **Type**: `int`
- **Default**: `100`
- **Description**: Number of blocks between rebalance checks during backtesting
- **Used In**: [`validator/round_orchestrator.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/round_orchestrator.py#L64)
- **Impact**: Lower = more frequent miner queries, higher accuracy
- **Recommended Range**: 50-200 blocks

---

### Database Configuration

#### Jobs Database (Read/Write)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `JOBS_POSTGRES_HOST` | str | "localhost" | Database server hostname |
| `JOBS_POSTGRES_PORT` | int | 5432 | Database server port |
| `JOBS_POSTGRES_DB` | str | "sn98_jobs" | Database name |
| `JOBS_POSTGRES_USER` | str | "sn98_user" | Database username |
| `JOBS_POSTGRES_PASSWORD` | str | "" | Database password |

**Used In**: [`validator/utils/env.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/env.py#L85-L109)

**Connection String Format**:
```
postgres://{JOBS_POSTGRES_USER}:{JOBS_POSTGRES_PASSWORD}@{JOBS_POSTGRES_HOST}:{JOBS_POSTGRES_PORT}/{JOBS_POSTGRES_DB}
```

#### Pool Events Database (Read-Only)

Similar structure with prefix `POOL_EVENTS_POSTGRES_*`

**Purpose**: Historical on-chain events from subgraph indexer

---

### Miner Configuration

#### `MINER_VERSION`
- **Type**: `str`
- **Default**: `"0.1.0"`
- **Description**: Miner software version string
- **Used In**: [`miner/miner.py`](file:///Users/soneshwar/Desktop/codes/forever-money/miner/miner.py#L53), protocol responses
- **Format**: Semantic versioning (MAJOR.MINOR.PATCH)

---

## Protocol Variables

### RebalanceQuery Synapse

Located in [`protocol/synapses.py`](file:///Users/soneshwar/Desktop/codes/forever-money/protocol/synapses.py)

#### Request Fields (Validator → Miner)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `job_id` | str | Job identifier | "job_eth_usdc_001" |
| `sn_liquidity_manager_address` | str | Vault contract address | "0x123..." |
| `pair_address` | str | Pool address | "0x456..." |
| `chain_id` | int | EVM Chain ID | 8453 |
| `round_id` | str | Round identifier | "job_eth_usdc_001_evaluation_42_1234567890" |
| `round_type` | str | Round type | "evaluation" or "live" |
| `block_number` | int | Current simulation block | 12345678 |
| `current_price` | float | Current price (sqrtPriceX96) | 79228162514264337593543950336 |
| `current_positions` | List[Position] | Active LP positions | [...] |
| `inventory_remaining` | dict | Available tokens | {"amount0": "1000...", "amount1": "2000..."} |
| `rebalances_so_far` | int | Number of rebalances executed | 3 |

#### Response Fields (Miner → Validator)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `accepted` | bool | Whether miner accepts job | true |
| `refusal_reason` | Optional[str] | Reason if refused | "Only working on ETH pairs" |
| `desired_positions` | Optional[List[Position]] | New positions to deploy | [...] |
| `miner_metadata` | Optional[MinerMetadata] | Miner version info | {"version": "1.0.0", ...} |

---

### Position Model

| Field | Type | Description | Range/Constraints |
|-------|------|-------------|-------------------|
| `tick_lower` | int | Lower tick bound | -887272 to 887272 |
| `tick_upper` | int | Upper tick bound | Must be > tick_lower |
| `allocation0` | str | Token0 amount (wei) | "1000000000000000000" |
| `allocation1` | str | Token1 amount (wei) | "2000000000000000000" |
| `confidence` | Optional[float] | Confidence score | 0.0 to 1.0 |

**Tick to Price Conversion**:
```python
price = 1.0001 ** tick
sqrtPriceX96 = sqrt(price) * 2^96
```

---

### Inventory Model

| Field | Type | Description | Units |
|-------|------|-------------|-------|
| `amount0` | str | Token0 available | wei |
| `amount1` | str | Token1 available | wei |

**Example**:
```python
Inventory(
    amount0="1000000000000000000",  # 1.0 token0 (18 decimals)
    amount1="2000000000",            # 2000.0 token1 (6 decimals for USDC)
)
```

---

## Database Fields

### Job Table

Located in [`validator/models/job.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/models/job.py#L37-L67)

| Field | Type | SQL Type | Indexed | Description |
|-------|------|----------|---------|-------------|
| `id` | int | SERIAL | PK | Auto-increment primary key |
| `job_id` | str | VARCHAR(255) | UNIQUE | Unique identifier |
| `sn_liquditiy_manager_address` | str | VARCHAR(42) | - | Vault contract (0x + 40 chars) |
| `pair_address` | str | VARCHAR(42) | - | Pool contract address |
| `fee_rate` | float | FLOAT | - | Pool fee (e.g., 0.03 = 3%) |
| `target` | str | VARCHAR(50) | - | Scoring target ("PoL") |
| `target_ratio` | float | FLOAT | - | Target ratio (default: 0.5) |
| `chain_id` | int | INTEGER | - | EVM Chain ID (8453 for Base) |
| `is_active` | bool | BOOLEAN | YES | Job enabled/disabled |
| `round_duration_seconds` | int | INTEGER | - | Round duration (default: 900) |
| `created_at` | datetime | TIMESTAMP | - | Job creation time |
| `updated_at` | datetime | TIMESTAMP | - | Last update time |
| `metadata` | dict | JSONB | - | Additional data |

**Relations**:
- One-to-many → `Round`
- One-to-many → `MinerScore`
- One-to-many → `Prediction`

**Frontend Display Fields**:
- `job_id` - Job name/title
- `pair_address` - Trading pair
- `is_active` - Status indicator
- `round_duration_seconds` - Round frequency

---

### Round Table

Located in [`validator/models/job.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/models/job.py#L69-L100)

| Field | Type | SQL Type | Indexed | Description |
|-------|------|----------|---------|-------------|
| `id` | int | SERIAL | PK | Primary key |
| `round_id` | str | VARCHAR(255) | UNIQUE | Unique identifier |
| `job_id` | int | INTEGER | FK | Foreign key to Job |
| `round_type` | RoundType | VARCHAR(20) | YES | "evaluation" or "live" |
| `round_number` | int | INTEGER | - | Sequential number per job+type |
| `start_time` | datetime | TIMESTAMP | - | Round start time |
| `round_deadline` | datetime | TIMESTAMP | - | Round end time |
| `end_time` | datetime | TIMESTAMP | - | Actual completion time |
| `winner_uid` | int | INTEGER | - | Winning miner UID |
| `start_block` | int | INTEGER | - | Blockchain start block |
| `status` | RoundStatus | VARCHAR(20) | YES | "pending", "active", "completed", "failed" |
| `performance_data` | dict | JSONB | - | {"scores": {...}} |
| `created_at` | datetime | TIMESTAMP | - | Record creation time |

**Unique Constraint**: `(job_id, round_number, round_type)`

**Frontend Display Fields**:
- `round_number` - Round sequence
- `round_type` - Evaluation vs Live
- `status` - Current state
- `winner_uid` - Winner (if completed)
- `performance_data.scores` - All miner scores

---

### MinerScore Table

Located in [`validator/models/job.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/models/job.py#L136-L184)

| Field | Type | SQL Type | Indexed | Description |
|-------|------|----------|---------|-------------|
| `id` | int | SERIAL | PK | Primary key |
| `job_id` | int | INTEGER | FK | Foreign key to Job |
| `miner_uid` | int | INTEGER | YES | Bittensor miner UID |
| `miner_hotkey` | str | VARCHAR(66) | - | ss58 hotkey address |
| `evaluation_score` | Decimal | NUMERIC(10,6) | - | EMA from eval rounds |
| `live_score` | Decimal | NUMERIC(10,6) | - | EMA from live rounds |
| `combined_score` | Decimal | NUMERIC(10,6) | YES | Weighted combination |
| `total_evaluations` | int | INTEGER | - | Total eval rounds |
| `total_live_rounds` | int | INTEGER | - | Total live rounds |
| `successful_evaluations` | int | INTEGER | - | Successful eval rounds |
| `successful_live_rounds` | int | INTEGER | - | Successful live rounds |
| `refusals` | int | INTEGER | - | Jobs refused count |
| `first_seen` | datetime | TIMESTAMP | - | First participation |
| `last_active` | datetime | TIMESTAMP | YES | Last activity |
| `participation_days` | int | INTEGER | - | Days participated (7-day window) |
| `is_eligible_for_live` | bool | BOOLEAN | YES | 7+ days eligibility |
| `score_history` | dict | JSONB | - | Historical scores |
| `updated_at` | datetime | TIMESTAMP | - | Last update |

**Unique Constraint**: `(job_id, miner_uid)`

**Composite Indexes**:
- `(job_id, combined_score)` - Leaderboard queries
- `(job_id, is_eligible_for_live, combined_score)` - Live selection

**Frontend Display Fields** (Leaderboard):
- `miner_uid` - Miner identifier
- `miner_hotkey` - Full address (truncate for display)
- `combined_score` - Overall ranking score
- `evaluation_score` - Eval performance
- `live_score` - Live performance
- `participation_days` - Consistency indicator
- `is_eligible_for_live` - Live eligibility badge

---

### Prediction Table

Located in [`validator/models/job.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/models/job.py#L103-L133)

| Field | Type | SQL Type | Description |
|-------|------|----------|-------------|
| `id` | int | SERIAL | Primary key |
| `prediction_id` | str | VARCHAR(255) | Unique identifier |
| `round_id` | int | INTEGER FK | Foreign key to Round |
| `job_id` | int | INTEGER FK | Foreign key to Job |
| `miner_uid` | int | INTEGER | Miner UID (indexed) |
| `miner_hotkey` | str | VARCHAR(66) | Miner hotkey |
| `accepted` | bool | BOOLEAN | Job acceptance |
| `refusal_reason` | str | TEXT | Reason if refused |
| `response_time_ms` | int | INTEGER | Response latency |
| `prediction_data` | dict | JSONB | Rebalance history |
| `submitted_at` | datetime | TIMESTAMP | Submission time |
| `simulated_performance` | dict | JSONB | Backtest metrics |

**Unique Constraint**: `(round_id, miner_uid)`

**`prediction_data` Structure**:
```json
[
    {
        "block": 12345678,
        "price": 79228162514264337593543950336,
        "price_in_query": 79228162514264337593543950336,
        "old_positions": [...],
        "new_positions": [...],
        "inventory": {"amount0": "...", "amount1": "..."}
    }
]
```

**`simulated_performance` Structure**:
```json
{
    "fees_collected": 1000000000000000000,
    "impermanent_loss": 0.05,
    "fees0": 500000000000000000,
    "fees1": 2000000000,
    "in_range_ratio": 0.85,
    "amount0_deployed": 800000000000000000,
    "amount1_deployed": 1600000000,
    "amount0_holdings": 1000000000000000000,
    "amount1_holdings": 2000000000,
    "final_sqrt_price_x96": 79228162514264337593543950336
}
```

---

### SwapEvent Table (Read-Only)

Located in [`validator/models/pool_events.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/models/pool_events.py#L14-L43)

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `evt_address` | str | Pool address (no 0x prefix) |
| `evt_block_number` | int | Block number (indexed) |
| `evt_tx_hash` | str | Transaction hash |
| `evt_block_time` | int | Unix timestamp |
| `sqrt_price_x96` | Decimal | Price after swap (Q96 format) |
| `tick` | int | Tick after swap |
| `amount0` | Decimal | Token0 delta (signed) |
| `amount1` | Decimal | Token1 delta (signed) |
| `liquidity` | Decimal | Active liquidity at swap |
| `sender` | str | Swap initiator |
| `recipient` | str | Swap recipient |

**Indexed**: `(evt_address, evt_block_number)`

**Usage**: Backtester queries for price history and fee calculation

---

## Service Variables

### Backtester Service

Located in [`validator/services/backtester.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/services/backtester.py)

#### Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `pair_address` | str | Pool address to backtest |
| `rebalance_history` | List[Dict] | Rebalancing timeline |
| `start_block` | int | Starting block |
| `end_block` | int | Ending block |
| `initial_inventory` | Inventory | Starting tokens |
| `fee_rate` | float | Pool fee rate (0.003 = 0.3%) |

#### Output Metrics

| Metric | Type | Description | Units |
|--------|------|-------------|-------|
| `fees_collected` | int | Total fees earned | token1 wei |
| `impermanent_loss` | float | IL fraction | 0.0-1.0 |
| `fees0` | float | Token0 fees | token0 wei |
| `fees1` | float | Token1 fees | token1 wei |
| `in_range_ratio` | float | Time in range | 0.0-1.0 |
| `amount0_deployed` | int | Token0 in positions | token0 wei |
| `amount1_deployed` | int | Token1 in positions | token1 wei |
| `amount0_holdings` | int | Total token0 | token0 wei |
| `amount1_holdings` | int | Total token1 | token1 wei |
| `final_sqrt_price_x96` | int | Final price | sqrtPriceX96 |

---

### Scorer Service

Located in [`validator/services/scorer.py`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/services/scorer.py)

#### Input Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `performance_metrics` | Dict | - | Backtester output |
| `initial_inventory` | Dict | - | Initial state |
| `loss_penalty_multiplier` | float | 10.0 | Penalty strength |
| `smooth_beta` | float | 4.0 | Loss aggregation |

#### Output

| Field | Type | Description |
|-------|------|-------------|
| `score` | float | Final strategy score (can be negative) |

---

## Smart Contract Variables

### SNLiquidityManager Contract

#### Read Methods

**`akAddressToPoolManager(address ak) → address`**
- **Purpose**: Get pool manager for AK token
- **Returns**: Pool manager address or 0x0

**`akAddressToPositionManager(address ak) → address`**
- **Purpose**: Get position manager for AK token
- **Returns**: Position manager address or 0x0

**`akToStashedTokens(address ak, address token) → uint256`**
- **Purpose**: Get stashed token amount
- **Returns**: Amount in wei

#### ABI Names

Located in [`validator/utils/abis/`](file:///Users/soneshwar/Desktop/codes/forever-money/validator/utils/abis/)

- `LiquidityManager.json` - SNLiquidityManager contract
- `ICLPool.json` - Uniswap V3 / Aerodrome pool
- `INonfungiblePositionManager.json` - Position NFT manager
- `AeroCLPositionManager.json` - Aerodrome position wrapper

---

### Uniswap V3 Pool Contract

#### Read Methods

**`slot0() → (sqrtPriceX96, tick, observationIndex, ...)`**
- **Returns**: Current pool state
- **Fields Used**: `sqrtPriceX96` (index 0), `tick` (index 1)

**`token0() → address`**
- **Returns**: Token0 address

**`token1() → address`**
- **Returns**: Token1 address

---

## Frontend Data Points

### Dashboard Metrics

| Metric | Data Source | Calculation | Refresh Rate |
|--------|------------|-------------|--------------|
| **Active Jobs** | `Job.filter(is_active=True).count()` | Direct count | 60s |
| **Total Miners** | `MinerScore.filter(job_id=X).count()` | Distinct miners | 60s |
| **Current Round** | `Round.filter(status='active').first()` | Latest active | Real-time |
| **Round Progress** | `(now - start_time) / round_duration` | Percentage | Real-time |

### Leaderboard Data

| Column | Field | Format | Sort |
|--------|-------|--------|------|
| Rank | Calculated | #1, #2, #3 | N/A |
| Miner UID | `miner_uid` | Integer | ASC/DESC |
| Hotkey | `miner_hotkey` | Truncated (0x...1234) | - |
| Score | `combined_score` | 2 decimals | DESC (default) |
| Eval Score | `evaluation_score` | 2 decimals | DESC |
| Live Score | `live_score` | 2 decimals | DESC |
| Days Active | `participation_days` | Integer | DESC |
| Eligible | `is_eligible_for_live` | ✓ or ✗ | Filter |
| Win Rate | `successful_evaluations / total_evaluations` | Percentage | DESC |

### Round History

| Column | Field | Format |
|--------|-------|--------|
| Round # | `round_number` | Integer |
| Type | `round_type` | Badge (Eval/Live) |
| Started | `start_time` | Relative time |
| Duration | `end_time - start_time` | Minutes |
| Winner | `MinerScore.get(uid=winner_uid).miner_hotkey` | Truncated |
| Score | `performance_data.scores[winner_uid].score` | 2 decimals |
| Participants | `len(performance_data.scores)` | Integer |

### Miner Performance Chart

**X-Axis**: Round number or time  
**Y-Axis**: Score value  
**Series**:
1. Evaluation Score (blue line)
2. Live Score (green line)
3. Combined Score (bold black line)

**Data Source**: `MinerScore.score_history` JSONB field

**Structure**:
```json
{
    "history": [
        {
            "round_number": 42,
            "timestamp": "2024-01-15T10:30:00Z",
            "evaluation_score": 1234.56,
            "live_score": 2345.67,
            "combined_score": 1789.12
        }
    ]
}
```

### Position Visualization

**Display**: Tick range on price axis

**Data Source**: `Prediction.prediction_data[].new_positions`

**Visualization**:
```
Price Axis: $1900 ────────── $2000 ────────── $2100
            [────Position 1────]
                  [──Position 2──]
```

**Fields**:
- `tick_lower` → Price lower bound
- `tick_upper` → Price upper bound
- `allocation0` + `allocation1` → Liquidity depth (box height)

---

## Summary Tables

### All Database Tables

| Table | Purpose | Records | Growth Rate |
|-------|---------|---------|-------------|
| `jobs` | Job definitions | ~10 | Slow (manual) |
| `rounds` | Round records | ~1000/day | Fast (per job) |
| `predictions` | Miner responses | ~50,000/day | Very fast |
| `miner_scores` | Reputation tracking | ~500 | Slow (per miner×job) |
| `miner_participation` | Daily participation | ~500/day | Medium |
| `live_executions` | On-chain executions | ~100/day | Slow |
| `swaps` | Swap events (read-only) | Millions | N/A (external) |
| `mints` | Mint events (read-only) | Thousands | N/A (external) |
| `burns` | Burn events (read-only) | Thousands | N/A (external) |
| `collects` | Collect events (read-only) | Thousands | N/A (external) |

### All Configuration Variables

| Category | Count | Required | Optional |
|----------|-------|----------|----------|
| Network Config | 4 | 2 | 2 |
| Validator Config | 3 | 0 | 3 |
| Database Config | 10 | 5 | 5 |
| Miner Config | 1 | 0 | 1 |
| **Total** | **18** | **7** | **11** |

---

## Frontend Integration Checklist

### Required API Endpoints

- [ ] `GET /api/jobs` - List all jobs
- [ ] `GET /api/jobs/{job_id}` - Job details
- [ ] `GET /api/jobs/{job_id}/leaderboard` - Leaderboard
- [ ] `GET /api/jobs/{job_id}/rounds` - Round history
- [ ] `GET /api/jobs/{job_id}/current-round` - Active round
- [ ] `GET /api/miners/{uid}` - Miner profile
- [ ] `GET /api/miners/{uid}/jobs/{job_id}` - Miner on job

### Required WebSocket Events

- [ ] `round_started` - New round begins
- [ ] `round_completed` - Round finishes
- [ ] `score_updated` - Miner score changes
- [ ] `live_execution` - Strategy executed on-chain
- [ ] `miner_joined` - New miner registers
- [ ] `job_created` - New job added

### Data Polling Requirements

| Data | Update Frequency | Method |
|------|------------------|--------|
| Active round progress | 5 seconds | WebSocket or Poll |
| Leaderboard | 60 seconds | Poll |
| Round history | 5 minutes | Poll |
| Job list | 5 minutes | Poll |
| Miner profile | On demand | Poll |
