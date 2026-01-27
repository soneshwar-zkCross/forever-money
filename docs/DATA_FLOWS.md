# SN98 ForeverMoney - Data Flow & Architecture Diagrams

> Visual reference for understanding how data flows through the system

---

## Complete System Data Flow

```mermaid
graph TB
    subgraph External["External Systems"]
        BaseL2[Base L2 Blockchain<br/>Uniswap V3 / Aerodrome]
        Subgraph[Subgraph Indexer]
    end
    
    subgraph Validator["Validator (Jobs Orchestrator)"]
        JobMgr[Job Manager]
        RoundOrch[Round Orchestrator]
        Backtester[Backtester Service]
        Scorer[Scorer Service]
        LiqMgr[Liquidity Manager]
    end
    
    subgraph Data["Data Layer"]
        JobsDB[(Jobs Database<br/>Postgres)]
        PoolDB[(Pool Events DB<br/>Postgres Read-Only)]
    end
    
    subgraph Network["Bittensor Network"]
        Miners[Miners<br/>Strategy Providers]
    end
    
    subgraph Frontend["Frontend Application"]
        Dashboard[Dashboard UI]
        Leaderboard[Leaderboard]
        Charts[Performance Charts]
    end
    
    %% Data flows
    BaseL2 -->|Events| Subgraph
    Subgraph -->|Indexed Data| PoolDB
    
    BaseL2 <-->|Read State| LiqMgr
    LiqMgr -->|Inventory & Positions| RoundOrch
    
    JobMgr -->|Active Jobs| JobsDB
    JobsDB -->|Job Config| RoundOrch
    
    RoundOrch <-->|RebalanceQuery| Miners
    RoundOrch -->|Rebalance History| Backtester
    
    Backtester -->|Pool Events| PoolDB
    Backtester -->|Performance Metrics| Scorer
    
    Scorer -->|Scores| RoundOrch
    RoundOrch -->|Save Results| JobsDB
    
    JobsDB -->|Query Data| Frontend
    Frontend -->|REST API| JobsDB
    
    style BaseL2 fill:#e1f5ff
    style Subgraph fill:#e1f5ff
    style JobsDB fill:#fff4e1
    style PoolDB fill:#fff4e1
    style Miners fill:#e8f5e9
    style Frontend fill:#f3e5f5
```

---

## Evaluation Round Data Flow

```mermaid
sequenceDiagram
    participant RO as Round Orchestrator
    participant LM as Liquidity Manager
    participant M as Miner
    participant BT as Backtester
    participant SC as Scorer
    participant DB as Jobs Database
    participant Pool as Pool Events DB
    
    Note over RO: Round Start
    RO->>DB: Create Round record
    RO->>LM: get_inventory()
    LM->>RO: Inventory(amount0, amount1)
    RO->>LM: get_current_positions()
    LM->>RO: List[Position]
    
    Note over RO: Backtest Simulation
    loop Every N blocks (until deadline)
        RO->>LM: get_current_price()
        LM->>RO: sqrtPriceX96
        
        RO->>M: RebalanceQuery(current_state)
        M->>M: Generate strategy
        M->>RO: desired_positions
        
        alt Miner rebalances
            RO->>RO: Update positions & inventory
            RO->>RO: Append to rebalance_history
        end
    end
    
    Note over RO: Performance Evaluation
    RO->>BT: evaluate_positions_performance(rebalance_history)
    BT->>Pool: get_swap_events(start_block, end_block)
    Pool->>BT: List[SwapEvent]
    BT->>BT: Simulate fees & IL
    BT->>RO: performance_metrics
    
    RO->>SC: score_pol_strategy(performance_metrics)
    SC->>SC: Calculate value gain & penalty
    SC->>RO: final_score
    
    Note over RO: Save Results
    RO->>DB: save_rebalance_decision(prediction_data)
    RO->>DB: update_miner_score(score, EMA)
    RO->>DB: complete_round(winner_uid)
```

---

## Data Entity Relationships

```mermaid
erDiagram
    Job ||--o{ Round : "has many"
    Job ||--o{ MinerScore : "tracks"
    Job ||--o{ MinerParticipation : "records"
    
    Round ||--o{ Prediction : "receives"
    Round ||--o| LiveExecution : "triggers"
    
    MinerScore ||--o{ MinerParticipation : "aggregates"
    
    Job {
        int id PK
        string job_id UK "Unique job identifier"
        string vault_address "SNLiquidityManager address"
        string pair_address "Pool address"
        float fee_rate "Pool fee (0.03 = 3%)"
        int chain_id "8453 for Base"
        bool is_active "Job enabled"
        int round_duration "Seconds per round"
    }
    
    Round {
        int id PK
        string round_id UK
        int job_id FK
        enum round_type "evaluation | live"
        int round_number "Sequential #"
        int winner_uid "Winning miner"
        enum status "pending | active | completed"
        json performance_data "All scores"
    }
    
    Prediction {
        int id PK
        string prediction_id UK
        int round_id FK
        int miner_uid "Bittensor UID"
        bool accepted "Job acceptance"
        json prediction_data "Rebalance history"
        json performance "Backtest metrics"
    }
    
    MinerScore {
        int id PK
        int job_id FK
        int miner_uid
        decimal eval_score "EMA evaluation"
        decimal live_score "EMA live"
        decimal combined_score "Weighted average"
        int participation_days "Last 7 days"
        bool is_eligible_for_live "7+ days"
    }
    
    MinerParticipation {
        int id PK
        int job_id FK
        int miner_uid
        date participation_date
        int rounds_participated
    }
    
    LiveExecution {
        int id PK
        string execution_id UK
        int round_id FK
        int miner_uid
        json strategy_data "Winning strategy"
        string tx_hash "On-chain TX"
        json actual_performance "Real results"
    }
```

---

## Backtester Data Pipeline

```mermaid
graph LR
    subgraph Inputs
        RH[Rebalance History]
        Inv[Initial Inventory]
        Pool[Pool Address]
        Blocks[Block Range]
    end
    
    subgraph Backtester
        FetchEvents[Fetch Swap Events<br/>from Pool Events DB]
        SimLoop{For Each<br/>Swap Event}
        GetPos[Get Positions<br/>at Block]
        CalcLiq[Calculate<br/>In-Range Liquidity]
        CalcShare[Calculate<br/>Liquidity Share]
        CalcFees[Calculate<br/>Fees Earned]
        AggFees[Aggregate Fees]
        CalcFinal[Calculate Final<br/>Amounts & IL]
    end
    
    subgraph Outputs
        Metrics[Performance Metrics:<br/>- fees_collected<br/>- impermanent_loss<br/>- in_range_ratio<br/>- holdings]
    end
    
    RH --> GetPos
    Pool --> FetchEvents
    Blocks --> FetchEvents
    Inv --> CalcFinal
    
    FetchEvents --> SimLoop
    SimLoop --> GetPos
    GetPos --> CalcLiq
    CalcLiq --> CalcShare
    CalcShare --> CalcFees
    CalcFees --> AggFees
    AggFees --> CalcFinal
    CalcFinal --> Metrics
    
    style Inputs fill:#e1f5ff
    style Outputs fill:#e8f5e9
    style Backtester fill:#fff4e1
```

**Key Insight**: Backtester uses actual pool liquidity from swap events to calculate precise fee shares, not naive assumptions.

---

## Scorer Algorithm Flow

```mermaid
graph TB
    Start[Performance Metrics<br/>+ Initial Inventory]
    
    CalcValue[Calculate Value Gain<br/>final_value - initial_value]
    
    CalcLoss[Calculate Inventory Loss<br/>loss0 = max(0, init0 - final0)<br/>loss1 = max(0, init1 - final1)]
    
    SmoothMax[Smooth-Max Aggregation<br/>log-sum-exp of loss ratios]
    
    Penalty[Exponential Penalty<br/>exp(-λ × loss_ratio)]
    
    ApplyPenalty{Value Gain<br/>Positive?}
    
    PosScore[score = value_gain × penalty]
    NegScore[score = value_gain / penalty]
    
    FinalScore[Final Score]
    
    Start --> CalcValue
    CalcValue --> CalcLoss
    CalcLoss --> SmoothMax
    SmoothMax --> Penalty
    Penalty --> ApplyPenalty
    ApplyPenalty -->|Yes| PosScore
    ApplyPenalty -->|No| NegScore
    PosScore --> FinalScore
    NegScore --> FinalScore
    
    style Start fill:#e1f5ff
    style FinalScore fill:#e8f5e9
```

**Penalty Examples**:
| Loss % | Penalty Factor | Effect on Score |
|--------|----------------|-----------------|
| 0% | 1.00 | No penalty |
| 5% | 0.61 | -39% |
| 10% | 0.37 | -63% |
| 20% | 0.14 | -86% |
| 50% | 0.007 | -99.3% |

---

## Live Execution Flow

```mermaid
sequenceDiagram
    participant RO as Round Orchestrator
    participant DB as Jobs Database
    participant M as Winning Miner
    participant Exec as Executor Bot
    participant Chain as Base L2 Blockchain
    participant Vault as SNLiquidityManager
    
    Note over RO: Get Previous Winner
    RO->>DB: get_previous_winner(job_id)
    DB->>RO: winner_uid
    
    RO->>DB: check_eligibility(winner_uid)
    DB->>RO: is_eligible_for_live = true
    
    Note over RO: Query Winner for Live Strategy
    RO->>M: RebalanceQuery(round_type="live")
    M->>M: Generate live strategy
    M->>RO: desired_positions
    
    Note over RO: Send to Executor Bot
    RO->>Exec: POST /execute_strategy<br/>{positions, job_id, miner_uid}
    Exec->>Vault: Rebalance positions on-chain
    Vault->>Chain: Mint/Burn NFT positions
    Chain->>Vault: TX confirmed
    Vault->>Exec: Success
    Exec->>RO: {tx_hash, status}
    
    Note over RO: Record Execution
    RO->>DB: create_live_execution(tx_hash, strategy_data)
    
    Note over RO: Track Performance
    loop Monitor Live Round
        RO->>Chain: Read vault state
        Chain->>RO: Current positions & balances
        RO->>RO: Calculate actual performance
    end
    
    RO->>DB: update_live_score(actual_performance)
    RO->>DB: complete_round(winner_uid, performance)
```

---

## Frontend Data Pipeline

```mermaid
graph TB
    subgraph Backend["Backend API"]
        JobsDB[(Jobs Database)]
        API[REST API Server]
        WS[WebSocket Server]
    end
    
    subgraph Frontend["Frontend Application"]
        Requests[HTTP Requests]
        WSClient[WebSocket Client]
        
        subgraph State["State Management"]
            JobsStore[Jobs Store]
            LeaderboardStore[Leaderboard Store]
            RoundsStore[Rounds Store]
        end
        
        subgraph Components["UI Components"]
            Dashboard[Dashboard]
            Leaderboard[Leaderboard Table]
            RoundHistory[Round History]
            MinerProfile[Miner Profile]
            LiveFeed[Live Execution Feed]
        end
    end
    
    JobsDB -->|Query| API
    JobsDB -->|Events| WS
    
    API -->|GET /api/jobs| Requests
    API -->|GET /api/leaderboard| Requests
    API -->|GET /api/rounds| Requests
    
    WS -->|round_started| WSClient
    WS -->|score_updated| WSClient
    WS -->|live_execution| WSClient
    
    Requests -->|Update| JobsStore
    Requests -->|Update| LeaderboardStore
    Requests -->|Update| RoundsStore
    
    WSClient -->|Real-time Update| LeaderboardStore
    WSClient -->|Real-time Update| RoundsStore
    
    JobsStore --> Dashboard
    LeaderboardStore --> Leaderboard
    RoundsStore --> RoundHistory
    RoundsStore --> Dashboard
    
    JobsStore --> MinerProfile
    LeaderboardStore --> MinerProfile
    
    WSClient --> LiveFeed
    
    style Backend fill:#fff4e1
    style Frontend fill:#f3e5f5
    style State fill:#e1f5ff
```

---

## Score Calculation Timeline

```mermaid
gantt
    title Miner Score Evolution (Example Timeline)
    dateFormat X
    axisFormat Day %d
    
    section Evaluation Rounds
    Round 1 (Score: 100)    :0, 1
    Round 2 (Score: 150)    :1, 2
    Round 3 (Score: 120)    :2, 3
    Round 4 (Score: 180)    :3, 4
    
    section Live Rounds
    Not eligible            :0, 7
    First Live (Score: 200) :7, 8
    Live Round 2 (Score: 190):8, 9
    
    section Eligibility
    Participation Days < 7  :crit, 0, 7
    Eligible for Live       :done, 7, 9
```

**Score Evolution Example**:

| Day | Round Type | Round Score | Old Eval | New Eval | Old Live | New Live | Combined |
|-----|------------|-------------|----------|----------|----------|----------|----------|
| 1 | Evaluation | 100 | 0 | **10** | 0 | 0 | **6** |
| 2 | Evaluation | 150 | 10 | **24** | 0 | 0 | **14.4** |
| 3 | Evaluation | 120 | 24 | **33.6** | 0 | 0 | **20.2** |
| 4 | Evaluation | 180 | 33.6 | **48.2** | 0 | 0 | **28.9** |
| ... | ... | ... | ... | ... | ... | ... | ... |
| 8 | Live | 200 | 120 | **120** | 0 | **60** | **96** |
| 9 | Live | 190 | 120 | **120** | 60 | **99** | **111.6** |

**Formulas**:
```python
# Evaluation EMA (α = 0.1)
new_eval = old_eval * 0.9 + round_score * 0.1

# Live EMA (α = 0.3)
new_live = old_live * 0.7 + round_score * 0.3

# Combined
combined = new_eval * 0.6 + new_live * 0.4
```

---

## Database Query Patterns

### Leaderboard Query

```sql
-- Get top 100 miners for a job, ordered by score
SELECT 
    miner_uid,
    miner_hotkey,
    combined_score,
    evaluation_score,
    live_score,
    participation_days,
    is_eligible_for_live,
    total_evaluations,
    total_live_rounds,
    RANK() OVER (ORDER BY combined_score DESC) as rank
FROM miner_scores
WHERE job_id = $1
ORDER BY combined_score DESC
LIMIT 100;
```

### Round History Query

```sql
-- Get last 50 completed rounds with winner info
SELECT 
    r.round_id,
    r.round_type,
    r.round_number,
    r.start_time,
    r.end_time,
    r.winner_uid,
    r.status,
    r.performance_data,
    ms.miner_hotkey as winner_hotkey,
    ms.combined_score as winner_score
FROM rounds r
LEFT JOIN miner_scores ms ON (
    r.winner_uid = ms.miner_uid AND 
    r.job_id = ms.job_id
)
WHERE r.job_id = $1 AND r.status = 'completed'
ORDER BY r.round_number DESC
LIMIT 50;
```

### Miner Performance Query

```sql
-- Get miner's recent predictions with performance
SELECT 
    p.round_id,
    p.accepted,
    p.response_time_ms,
    p.prediction_data,
    p.simulated_performance,
    r.round_type,
    r.round_number,
    r.start_time
FROM predictions p
JOIN rounds r ON p.round_id = r.round_id
WHERE 
    p.job_id = $1 AND 
    p.miner_uid = $2 AND 
    p.accepted = true
ORDER BY r.round_number DESC
LIMIT 20;
```

---

## API Response Examples

### GET /api/jobs/{job_id}/leaderboard

```json
{
    "job_id": "job_eth_usdc_001",
    "updated_at": "2024-01-15T10:30:00Z",
    "total_miners": 156,
    "leaderboard": [
        {
            "rank": 1,
            "miner_uid": 42,
            "miner_hotkey": "5F3sa2TJAWMqDhXG6jhV4N8ko9SxwGy8TpaNS1repo5EYjQX",
            "combined_score": 9876.54,
            "evaluation_score": 8234.12,
            "live_score": 12345.67,
            "participation_days": 14,
            "is_eligible_for_live": true,
            "total_evaluations": 142,
            "total_live_rounds": 28,
            "successful_evaluations": 138,
            "successful_live_rounds": 26,
            "win_rate": 0.973
        },
        {
            "rank": 2,
            "miner_uid": 17,
            "miner_hotkey": "5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw",
            "combined_score": 8765.43,
            ...
        }
    ]
}
```

### WebSocket: round_completed

```json
{
    "event": "round_completed",
    "timestamp": "2024-01-15T10:35:00Z",
    "data": {
        "job_id": "job_eth_usdc_001",
        "round_id": "job_eth_usdc_001_evaluation_142_1705318500",
        "round_type": "evaluation",
        "round_number": 142,
        "winner": {
            "miner_uid": 42,
            "miner_hotkey": "5F3sa2...",
            "score": 1234.56
        },
        "participants": 156,
        "top_3": [
            {"miner_uid": 42, "score": 1234.56},
            {"miner_uid": 17, "score": 1198.23},
            {"miner_uid": 89, "score": 1145.78}
        ],
        "duration_seconds": 901
    }
}
```

---

## Appendix: Data Size Estimates

### Daily Data Growth

| Table | Approx Records/Day | Approx Size/Day | Retention |
|-------|-------------------|-----------------|-----------|
| rounds | 96 (per job) | ~10 KB | Forever |
| predictions | 15,000 (per job) | ~50 MB | Forever |
| miner_participation | 156 (per job) | ~5 KB | Forever |
| miner_scores | 0 (updates only) | ~0 | Forever |
| live_executions | ~10 (per job) | ~50 KB | Forever |

**Assumptions**:
- 1 job running
- 156 active miners
- 15 minute rounds = 96 rounds/day
- ~100 miners respond per round

### Database Indexes

**Critical Indexes** (for fast queries):

1. `miner_scores(job_id, combined_score DESC)` - Leaderboard
2. `rounds(job_id, round_number DESC)` - Round history
3. `predictions(job_id, miner_uid, submitted_at DESC)` - Miner history
4. `miner_participation(job_id, miner_uid, participation_date)` - Eligibility
5. `swap_events(evt_address, evt_block_number)` - Backtesting

---

## Summary

This document provides visual and structural references for:

1. **System-wide data flows** from blockchain to frontend
2. **Service interactions** during round execution
3. **Database relationships** and query patterns
4. **Scoring mechanisms** with concrete examples
5. **API contracts** for frontend integration
6. **Data scaling** and performance considerations

For implementation details, see:
- [system_documentation.md](file:///Users/soneshwar/.gemini/antigravity/brain/46507b35-5fec-4ee7-99ae-70c48ad2ece3/system_documentation.md) - Complete technical reference
- [variable_mapping.md](file:///Users/soneshwar/.gemini/antigravity/brain/46507b35-5fec-4ee7-99ae-70c48ad2ece3/variable_mapping.md) - Variable definitions
