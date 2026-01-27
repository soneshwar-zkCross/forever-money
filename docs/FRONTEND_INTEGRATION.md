# SN98 ForeverMoney - Frontend Integration Guide

> Complete guide for building a frontend dashboard to visualize subnet data

---

## Table of Contents

1. [Overview](#overview)
2. [API Specifications](#api-specifications)
3. [WebSocket Events](#websocket-events)
4. [Component Architecture](#component-architecture)
5. [Data Models](#data-models)
6. [Example Implementations](#example-implementations)
7. [Best Practices](#best-practices)

---

## Overview

### System Architecture

```
┌─────────────────┐
│  Frontend App   │
│  (React/Next)   │
└────────┬────────┘
         │
         ├──── HTTP REST ────► PostgreSQL Jobs DB
         │                     (via API Server)
         │
         └──── WebSocket ────► Real-time Events
                               (round updates, scores)
```

### Key Data Sources

| Data Type | Source | Update Frequency | Method |
|-----------|--------|------------------|--------|
| Jobs list | Jobs DB | 5 minutes | REST poll |
| Leaderboard | Jobs DB | 60 seconds | REST poll |
| Current round | Jobs DB | 5 seconds | WebSocket |
| Round history | Jobs DB | On demand | REST |
| Miner profile | Jobs DB | On demand | REST |
| Live executions | Jobs DB | Real-time | WebSocket |

### Tech Stack Recommendations

**Frontend Framework**: Next.js 14+ (App Router)

**State Management**: 
- TanStack Query (React Query) for server state
- Zustand/Context API for UI state

**Real-time**: 
- Socket.io client or native WebSocket

**Charts**: 
- Recharts or Chart.js for performance graphs
- D3.js for custom visualizations

**Styling**: 
- Tailwind CSS for utility classes
- Framer Motion for animations

---

## API Specifications

### Base Configuration

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'
```

### Authentication (Future)

Currently no auth required. Future versions may use:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

### Endpoint: GET /api/jobs

**Description**: List all jobs (active and inactive)

**Query Parameters**:
```typescript
{
  is_active?: boolean  // Filter by active status
  limit?: number       // Max results
  offset?: number      // Pagination offset
}
```

**Response**:
```typescript
{
  jobs: Array<{
    job_id: string
    sn_liquditiy_manager_address: string
    pair_address: string
    fee_rate: number
    target: string
    target_ratio: number
    chain_id: number
    is_active: boolean
    round_duration_seconds: number
    created_at: string  // ISO 8601
    updated_at: string
    metadata: {
      pair_name?: string     // "ETH/USDC"
      pool_type?: string     // "Uniswap V3"
      tvl?: number
      volume_24h?: number
    }
  }>
  total: number
}
```

**Example**:
```bash
curl http://localhost:8000/api/jobs?is_active=true
```

---

### Endpoint: GET /api/jobs/{job_id}

**Description**: Get detailed job information

**Response**:
```typescript
{
  job_id: string
  sn_liquditiy_manager_address: string
  pair_address: string
  fee_rate: number
  chain_id: number
  is_active: boolean
  round_duration_seconds: number
  
  // Aggregated stats
  stats: {
    total_rounds: number
    total_miners: number
    active_miners_24h: number
    avg_participation_rate: number
    current_round_number: number
  }
  
  // Current round
  current_round: {
    round_id: string
    round_type: "evaluation" | "live"
    round_number: number
    start_time: string
    round_deadline: string
    status: "pending" | "active" | "completed" | "failed"
    time_remaining_seconds: number
    progress_percent: number
  } | null
}
```

---

### Endpoint: GET /api/jobs/{job_id}/leaderboard

**Description**: Get ranked miner scores for a job

**Query Parameters**:
```typescript
{
  limit?: number           // Default: 100
  offset?: number          // Default: 0
  eligible_only?: boolean  // Filter live-eligible miners
  sort_by?: 'combined' | 'evaluation' | 'live'  // Default: combined
}
```

**Response**:
```typescript
{
  job_id: string
  updated_at: string
  total_miners: number
  
  leaderboard: Array<{
    rank: number
    miner_uid: number
    miner_hotkey: string
    
    // Scores
    combined_score: number
    evaluation_score: number
    live_score: number
    
    // Eligibility
    participation_days: number
    is_eligible_for_live: boolean
    
    // Activity stats
    total_evaluations: number
    total_live_rounds: number
    successful_evaluations: number
    successful_live_rounds: number
    refusals: number
    
    // Computed metrics
    win_rate: number            // successful / total
    avg_response_time_ms: number
    
    // Timestamps
    first_seen: string
    last_active: string
  }>
}
```

---

### Endpoint: GET /api/jobs/{job_id}/rounds

**Description**: Get round history for a job

**Query Parameters**:
```typescript
{
  limit?: number               // Default: 50
  offset?: number              // Default: 0
  round_type?: 'evaluation' | 'live'
  status?: 'completed' | 'failed'
  include_scores?: boolean     // Include all miner scores (default: false)
}
```

**Response**:
```typescript
{
  job_id: string
  total_rounds: number
  
  rounds: Array<{
    round_id: string
    round_type: "evaluation" | "live"
    round_number: number
    start_time: string
    round_deadline: string
    end_time: string | null
    status: string
    
    // Winner info
    winner_uid: number | null
    winner_hotkey: string | null
    winner_score: number | null
    
    // Stats
    participants: number
    duration_seconds: number
    
    // Optional: all scores (if include_scores=true)
    scores?: Record<number, {  // Key: miner_uid
      score: number
      rank: number
      accepted: boolean
    }>
  }>
}
```

---

### Endpoint: GET /api/jobs/{job_id}/executions

**Description**: Get live execution history

**Query Parameters**:
```typescript
{
  limit?: number
  offset?: number
  status?: 'pending' | 'success' | 'failed'
}
```

**Response**:
```typescript
{
  job_id: string
  total_executions: number
  
  executions: Array<{
    execution_id: string
    round_id: string
    round_number: number
    miner_uid: number
    miner_hotkey: string
    
    // Strategy details
    strategy_data: {
      positions: Array<{
        tick_lower: number
        tick_upper: number
        allocation0: string
        allocation1: string
      }>
      rebalance_count: number
    }
    
    // Execution details
    tx_hash: string | null
    tx_status: 'pending' | 'success' | 'failed'
    block_number: number | null
    
    // Performance
    actual_performance: {
      fees_earned: number
      value_gain: number
      duration_blocks: number
    } | null
    
    executed_at: string
    updated_at: string
  }>
}
```

---

### Endpoint: GET /api/miners/{uid}

**Description**: Get miner profile across all jobs

**Response**:
```typescript
{
  miner_uid: number
  miner_hotkey: string
  
  // Global stats
  total_jobs: number
  total_rounds: number
  global_win_rate: number
  
  // Per-job performance
  jobs: Array<{
    job_id: string
    pair_name: string
    
    // Scores
    combined_score: number
    evaluation_score: number
    live_score: number
    rank: number
    
    // Activity
    participation_days: number
    is_eligible_for_live: boolean
    total_evaluations: number
    total_live_rounds: number
    wins: number
    
    first_seen: string
    last_active: string
  }>
}
```

---

### Endpoint: GET /api/miners/{uid}/jobs/{job_id}

**Description**: Detailed miner performance on specific job

**Response**:
```typescript
{
  miner_uid: number
  miner_hotkey: string
  job_id: string
  
  // Current scores
  scores: {
    combined_score: number
    evaluation_score: number
    live_score: number
    rank: number
    percentile: number  // Top X%
  }
  
  // Historical performance
  score_history: Array<{
    round_number: number
    timestamp: string
    round_type: "evaluation" | "live"
    round_score: number
    evaluation_score: number
    live_score: number
    combined_score: number
    rank: number
  }>
  
  // Recent predictions
  recent_predictions: Array<{
    round_id: string
    round_number: number
    round_type: string
    accepted: boolean
    refusal_reason: string | null
    response_time_ms: number
    
    // Performance
    simulated_performance: {
      fees_collected: number
      impermanent_loss: number
      value_gain: number
    }
    
    // Strategy summary
    rebalance_count: number
    avg_position_width_ticks: number
    
    submitted_at: string
  }>
  
  // Participation calendar
  participation: Array<{
    date: string  // YYYY-MM-DD
    participated: boolean
    rounds_participated: number
    rounds_refused: number
  }>
}
```

---

## WebSocket Events

### Connection

```typescript
import { io } from 'socket.io-client'

const socket = io(WS_BASE_URL, {
  transports: ['websocket'],
  autoConnect: true
})

// Subscribe to job-specific events
socket.emit('subscribe', { job_id: 'job_eth_usdc_001' })

// Unsubscribe
socket.emit('unsubscribe', { job_id: 'job_eth_usdc_001' })
```

### Event: `round_started`

**Payload**:
```typescript
{
  event: 'round_started'
  timestamp: string
  data: {
    job_id: string
    round_id: string
    round_type: 'evaluation' | 'live'
    round_number: number
    start_block: number
    round_deadline: string
  }
}
```

**Handler**:
```typescript
socket.on('round_started', (payload) => {
  console.log('New round started:', payload.data.round_id)
  // Update UI to show new round is active
})
```

---

### Event: `round_completed`

**Payload**:
```typescript
{
  event: 'round_completed'
  timestamp: string
  data: {
    job_id: string
    round_id: string
    round_type: 'evaluation' | 'live'
    round_number: number
    
    winner: {
      miner_uid: number
      miner_hotkey: string
      score: number
    }
    
    participants: number
    duration_seconds: number
    
    top_3: Array<{
      miner_uid: number
      miner_hotkey: string
      score: number
      rank: number
    }>
  }
}
```

---

### Event: `score_updated`

**Payload**:
```typescript
{
  event: 'score_updated'
  timestamp: string
  data: {
    job_id: string
    miner_uid: number
    miner_hotkey: string
    
    // New scores
    combined_score: number
    evaluation_score: number
    live_score: number
    
    // Ranking changes
    old_rank: number
    new_rank: number
    rank_delta: number  // Positive = moved up
  }
}
```

**Use Case**: Update leaderboard in real-time without full refresh

---

### Event: `live_execution`

**Payload**:
```typescript
{
  event: 'live_execution'
  timestamp: string
  data: {
    job_id: string
    execution_id: string
    miner_uid: number
    miner_hotkey: string
    
    tx_hash: string
    tx_status: 'pending' | 'success' | 'failed'
    
    strategy_summary: {
      position_count: number
      total_liquidity: string
      tick_ranges: Array<[number, number]>
    }
  }
}
```

**Use Case**: Live feed of on-chain executions

---

### Event: `miner_joined`

**Payload**:
```typescript
{
  event: 'miner_joined'
  timestamp: string
  data: {
    job_id: string
    miner_uid: number
    miner_hotkey: string
  }
}
```

---

## Component Architecture

### Recommended Component Tree

```
App
├── Navbar
├── Sidebar
│   ├── JobSelector
│   └── Navigation
└── Pages
    ├── Dashboard
    │   ├── JobHeader
    │   ├── CurrentRoundCard
    │   ├── StatsGrid
    │   └── RecentActivityFeed
    │
    ├── Leaderboard
    │   ├── LeaderboardFilters
    │   ├── LeaderboardTable
    │   └── MinerQuickView (modal)
    │
    ├── Rounds
    │   ├── RoundFilters
    │   ├── RoundTimeline
    │   └── RoundDetailsModal
    │
    ├── LiveExecutions
    │   ├── ExecutionFeed
    │   ├── PositionVisualizer
    │   └── TransactionExplorer
    │
    └── MinerProfile
        ├── MinerHeader
        ├── ScoreChart
        ├── ParticipationCalendar
        └── PredictionHistory
```

---

## Data Models

### TypeScript Interfaces

```typescript
// Job
export interface Job {
  job_id: string
  sn_liquditiy_manager_address: string
  pair_address: string
  fee_rate: number
  target: string
  target_ratio: number
  chain_id: number
  is_active: boolean
  round_duration_seconds: number
  created_at: string
  updated_at: string
  metadata: {
    pair_name?: string
    pool_type?: string
    tvl?: number
    volume_24h?: number
  }
}

// Round
export interface Round {
  round_id: string
  round_type: 'evaluation' | 'live'
  round_number: number
  start_time: string
  round_deadline: string
  end_time: string | null
  status: 'pending' | 'active' | 'completed' | 'failed'
  winner_uid: number | null
  winner_hotkey: string | null
  winner_score: number | null
  participants: number
  duration_seconds: number
}

// MinerScore
export interface MinerScore {
  rank: number
  miner_uid: number
  miner_hotkey: string
  combined_score: number
  evaluation_score: number
  live_score: number
  participation_days: number
  is_eligible_for_live: boolean
  total_evaluations: number
  total_live_rounds: number
  successful_evaluations: number
  successful_live_rounds: number
  refusals: number
  win_rate: number
  avg_response_time_ms: number
  first_seen: string
  last_active: string
}

// LiveExecution
export interface LiveExecution {
  execution_id: string
  round_id: string
  round_number: number
  miner_uid: number
  miner_hotkey: string
  strategy_data: {
    positions: Array<Position>
    rebalance_count: number
  }
  tx_hash: string | null
  tx_status: 'pending' | 'success' | 'failed'
  block_number: number | null
  actual_performance: {
    fees_earned: number
    value_gain: number
    duration_blocks: number
  } | null
  executed_at: string
  updated_at: string
}

// Position
export interface Position {
  tick_lower: number
  tick_upper: number
  allocation0: string
  allocation1: string
  confidence?: number
}
```

---

## Example Implementations

### 1. Dashboard Component

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '@/hooks/useWebSocket'

export function Dashboard({ jobId }: { jobId: string }) {
  // Fetch job details
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetch(`/api/jobs/${jobId}`).then(r => r.json()),
    refetchInterval: 60000 // Refresh every minute
  })
  
  // Real-time round updates
  const { data: roundUpdate } = useWebSocket(['round_started', 'round_completed'])
  
  if (isLoading) return <LoadingSpinner />
  
  return (
    <div className="space-y-6">
      <JobHeader job={job} />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Total Rounds"
          value={job.stats.total_rounds}
          icon={<RoundsIcon />}
        />
        <StatCard 
          label="Active Miners"
          value={job.stats.active_miners_24h}
          icon={<MinersIcon />}
        />
        <StatCard 
          label="Avg Participation"
          value={`${(job.stats.avg_participation_rate * 100).toFixed(1)}%`}
          icon={<ParticipationIcon />}
        />
      </div>
      
      {job.current_round && (
        <CurrentRoundCard round={job.current_round} />
      )}
      
      <RecentActivityFeed jobId={jobId} />
    </div>
  )
}
```

---

### 2. Leaderboard Component

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

export function Leaderboard({ jobId }: { jobId: string }) {
  const [filters, setFilters] = useState({
    eligible_only: false,
    sort_by: 'combined' as const
  })
  
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', jobId, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        eligible_only: filters.eligible_only.toString(),
        sort_by: filters.sort_by
      })
      const res = await fetch(`/api/jobs/${jobId}/leaderboard?${params}`)
      return res.json()
    },
    refetchInterval: 60000
  })
  
  if (isLoading) return <LoadingSpinner />
  
  return (
    <div>
      <LeaderboardFilters filters={filters} onChange={setFilters} />
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Miner
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Combined Score
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Eval Score
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Live Score
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Eligible
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Win Rate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.leaderboard.map((miner) => (
              <tr key={miner.miner_uid} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <RankBadge rank={miner.rank} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="font-medium">UID: {miner.miner_uid}</div>
                    <div className="text-xs text-gray-500 font-mono">
                      {truncateAddress(miner.miner_hotkey)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {miner.combined_score.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {miner.evaluation_score.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {miner.live_score.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {miner.is_eligible_for_live ? (
                    <CheckIcon className="text-green-500" />
                  ) : (
                    <XIcon className="text-gray-300" />
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {(miner.win_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
```

---

### 3. Real-time Score Updates

```typescript
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io } from 'socket.io-client'

export function useRealtimeScores(jobId: string) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!)
    
    socket.emit('subscribe', { job_id: jobId })
    
    // Handle score updates
    socket.on('score_updated', (payload) => {
      // Optimistically update the leaderboard cache
      queryClient.setQueryData(
        ['leaderboard', jobId],
        (old: any) => {
          if (!old) return old
          
          const updated = old.leaderboard.map((miner: MinerScore) => {
            if (miner.miner_uid === payload.data.miner_uid) {
              return {
                ...miner,
                combined_score: payload.data.combined_score,
                evaluation_score: payload.data.evaluation_score,
                live_score: payload.data.live_score,
                rank: payload.data.new_rank
              }
            }
            return miner
          })
          
          // Re-sort by rank
          updated.sort((a, b) => a.rank - b.rank)
          
          return { ...old, leaderboard: updated }
        }
      )
      
      // Show toast notification
      toast.success(
        `Miner ${payload.data.miner_uid} rank: ${payload.data.old_rank} → ${payload.data.new_rank}`
      )
    })
    
    // Handle round completion
    socket.on('round_completed', (payload) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['leaderboard', jobId] })
      queryClient.invalidateQueries({ queryKey: ['rounds', jobId] })
      
      toast.info(`Round ${payload.data.round_number} completed!`)
    })
    
    return () => {
      socket.emit('unsubscribe', { job_id: jobId })
      socket.disconnect()
    }
  }, [jobId, queryClient])
}
```

---

### 4. Position Visualizer

```typescript
import { useMemo } from 'react'

interface PositionVisualizerProps {
  positions: Position[]
  currentPrice: number
  tokenSymbols: [string, string]
}

export function PositionVisualizer({
  positions,
  currentPrice,
  tokenSymbols
}: PositionVisualizerProps) {
  // Convert ticks to prices
  const positionRanges = useMemo(() => {
    return positions.map(pos => ({
      lower: tickToPrice(pos.tick_lower),
      upper: tickToPrice(pos.tick_upper),
      liquidity: BigInt(pos.allocation0) + BigInt(pos.allocation1)
    }))
  }, [positions])
  
  // Find min/max for chart bounds
  const minPrice = Math.min(...positionRanges.map(p => p.lower)) * 0.95
  const maxPrice = Math.max(...positionRanges.map(p => p.upper)) * 1.05
  
  return (
    <div className="relative h-64 bg-gray-50 rounded-lg p-4">
      {/* Price axis */}
      <div className="absolute bottom-0 left-0 right-0 h-8 border-t-2 border-gray-300">
        <div className="flex justify-between text-xs text-gray-500 px-2 pt-1">
          <span>${minPrice.toFixed(2)}</span>
          <span>${currentPrice.toFixed(2)}</span>
          <span>${maxPrice.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Current price indicator */}
      <div 
        className="absolute bottom-8 w-0.5 bg-blue-500 h-full"
        style={{
          left: `${((currentPrice - minPrice) / (maxPrice - minPrice)) * 100}%`
        }}
      >
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
          Current
        </div>
      </div>
      
      {/* Position ranges */}
      {positionRanges.map((range, idx) => {
        const leftPercent = ((range.lower - minPrice) / (maxPrice - minPrice)) * 100
        const widthPercent = ((range.upper - range.lower) / (maxPrice - minPrice)) * 100
        const heightPercent = Number(range.liquidity) / 1e18 * 10 // Normalize
        
        return (
          <div
            key={idx}
            className="absolute bottom-8 bg-green-500/30 border-2 border-green-500 rounded"
            style={{
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              height: `${Math.min(heightPercent, 80)}%`
            }}
            title={`Range: $${range.lower.toFixed(2)} - $${range.upper.toFixed(2)}`}
          />
        )
      })}
    </div>
  )
}

function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick)
}
```

---

## Best Practices

### 1. **Efficient Polling**

```typescript
// Use stale-while-revalidate pattern
const { data } = useQuery({
  queryKey: ['leaderboard', jobId],
  queryFn: fetchLeaderboard,
  staleTime: 30000,      // Consider fresh for 30s
  cacheTime: 300000,     // Keep in cache for 5min
  refetchInterval: 60000, // Refetch every 60s
  refetchOnWindowFocus: true
})
```

### 2. **Optimistic Updates**

When WebSocket event arrives, update cache immediately:

```typescript
queryClient.setQueryData(['leaderboard', jobId], (old) => {
  // Update specific miner without refetching
  return updateMinerInList(old, newMinerData)
})
```

### 3. **Error Handling**

```typescript
const { data, error, isError } = useQuery({
  queryKey: ['job', jobId],
  queryFn: fetchJob,
  retry: 3,
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
})

if (isError) {
  return <ErrorBanner error={error} />
}
```

### 4. **Pagination**

```typescript
const [page, setPage] = useState(0)
const limit = 50

const { data } = useQuery({
  queryKey: ['rounds', jobId, page],
  queryFn: () => fetchRounds(jobId, { limit, offset: page * limit }),
  keepPreviousData: true // Avoid loading state on page change
})
```

### 5. **Performance Monitoring**

Track render performance:

```typescript
import { useEffect } from 'react'

export function LeaderboardTable({ data }: { data: MinerScore[] }) {
  useEffect(() => {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      if (duration > 16) { // 60fps threshold
        console.warn(`Slow render: ${duration.toFixed(2)}ms`)
      }
    }
  })
  
  return <table>...</table>
}
```

### 6. **Responsive Design**

```typescript
// Hide columns on mobile
<table>
  <thead>
    <tr>
      <th>Rank</th>
      <th>Miner</th>
      <th>Score</th>
      <th className="hidden md:table-cell">Eval Score</th>
      <th className="hidden lg:table-cell">Live Score</th>
      <th className="hidden xl:table-cell">Win Rate</th>
    </tr>
  </thead>
</table>
```

---

## Summary

This guide provides:

1. ✅ **Complete API specifications** with TypeScript types
2. ✅ **WebSocket event schemas** for real-time updates
3. ✅ **Component architecture** recommendations
4. ✅ **Example implementations** for common patterns
5. ✅ **Best practices** for performance and UX

### Next Steps for Frontend Development

1. **Set up project**: Initialize Next.js 14 with TypeScript
2. **Install dependencies**: TanStack Query, Socket.io, Recharts
3. **Create API layer**: Implement fetch functions with proper typing
4. **Build core components**: Dashboard, Leaderboard, Rounds
5. **Add real-time**: WebSocket integration for live updates
6. **Polish UX**: Animations, loading states, error handling
7. **Test**: Unit tests for components, integration tests for API

### Backend Requirements

To support this frontend, the backend needs:

- [ ] REST API server (Express/FastAPI)
- [ ] WebSocket server (Socket.io/FastAPI WebSockets)
- [ ] Database connection pooling
- [ ] CORS configuration
- [ ] Rate limiting
- [ ] API documentation (Swagger/OpenAPI)

For detailed backend implementation, see:
- [system_documentation.md](file:///Users/soneshwar/.gemini/antigravity/brain/46507b35-5fec-4ee7-99ae-70c48ad2ece3/system_documentation.md)
- [variable_mapping.md](file:///Users/soneshwar/.gemini/antigravity/brain/46507b35-5fec-4ee7-99ae-70c48ad2ece3/variable_mapping.md)
- [data_flows.md](file:///Users/soneshwar/.gemini/antigravity/brain/46507b35-5fec-4ee7-99ae-70c48ad2ece3/data_flows.md)
