# Frontend Admin Panel - Implementation Plan

> **Goal**: Build a production-ready admin panel for monitoring and managing the SN98 ForeverMoney subnet with real-time updates, analytics, and comprehensive data visualization.

---

## Overview

Create a modern, responsive admin dashboard that provides:
- **Real-time monitoring** of all jobs, rounds, and miners
- **Comprehensive analytics** with charts and metrics
- **Miner leaderboards** with filtering and search
- **Round execution tracking** with detailed performance data
- **Live execution monitoring** for on-chain strategies
- **Job management** interface for validator operators

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query) + Zustand
- **Charts**: Recharts + D3.js for custom visualizations
- **Real-time**: Socket.io-client
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod validation

### Backend API
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (existing Jobs DB)
- **ORM**: Tortoise ORM (already in use)
- **WebSocket**: FastAPI WebSockets / Socket.io
- **Auth**: JWT tokens (future)
- **CORS**: Configured for Next.js origin

### DevOps
- **Hosting**: Vercel (frontend) + Railway/DigitalOcean (backend API)
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry (error tracking) + Vercel Analytics

---

## Proposed Changes

### Backend API Service

#### [NEW] `api/` Directory Structure
```
api/
├── main.py                    # FastAPI app entry point
├── config.py                  # API configuration
├── dependencies.py            # Dependency injection
├── middleware.py              # CORS, logging, error handling
├── models/
│   └── responses.py          # Pydantic response models
├── routers/
│   ├── jobs.py               # Job endpoints
│   ├── rounds.py             # Round endpoints
│   ├── miners.py             # Miner endpoints
│   ├── leaderboard.py        # Leaderboard endpoints
│   └── executions.py         # Live execution endpoints
├── services/
│   ├── jobs_service.py       # Business logic for jobs
│   ├── rounds_service.py     # Business logic for rounds
│   └── stats_service.py      # Aggregated statistics
├── websocket/
│   ├── manager.py            # WebSocket connection manager
│   └── events.py             # Event handlers
└── utils/
    ├── pagination.py         # Pagination helpers
    └── formatters.py         # Data formatting utilities
```

**Key Features**:
- RESTful API endpoints for all data access
- WebSocket server for real-time updates
- Efficient pagination and filtering
- Data aggregation for analytics
- Response caching for performance

---

#### [NEW] `api/main.py`
FastAPI application setup with CORS, middleware, and router registration.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import jobs, rounds, miners, leaderboard, executions
from api.websocket.manager import websocket_endpoint

app = FastAPI(
    title="SN98 ForeverMoney API",
    version="1.0.0",
    description="API for SN98 subnet admin panel"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(rounds.router, prefix="/api/rounds", tags=["rounds"])
app.include_router(miners.router, prefix="/api/miners", tags=["miners"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["leaderboard"])
app.include_router(executions.router, prefix="/api/executions", tags=["executions"])

# WebSocket endpoint
app.websocket("/ws")(websocket_endpoint)
```

---

#### [NEW] `api/routers/jobs.py`
Job-related endpoints: list jobs, get job details, get job stats.

**Endpoints**:
- `GET /api/jobs` - List all jobs (with filters)
- `GET /api/jobs/{job_id}` - Get job details
- `GET /api/jobs/{job_id}/stats` - Get aggregated statistics

---

#### [NEW] `api/routers/leaderboard.py`
Leaderboard endpoints with filtering, sorting, and pagination.

**Endpoints**:
- `GET /api/jobs/{job_id}/leaderboard` - Get ranked miners
- `GET /api/jobs/{job_id}/leaderboard/top` - Get top N miners

---

#### [NEW] `api/routers/rounds.py`
Round-related endpoints: history, current round, round details.

**Endpoints**:
- `GET /api/jobs/{job_id}/rounds` - Round history with pagination
- `GET /api/jobs/{job_id}/rounds/current` - Active round
- `GET /api/rounds/{round_id}` - Round details with all scores

---

#### [NEW] `api/routers/miners.py`
Miner profile and performance endpoints.

**Endpoints**:
- `GET /api/miners/{uid}` - Miner profile across all jobs
- `GET /api/miners/{uid}/jobs/{job_id}` - Miner performance on job
- `GET /api/miners/{uid}/jobs/{job_id}/history` - Score history

---

#### [NEW] `api/routers/executions.py`
Live execution monitoring endpoints.

**Endpoints**:
- `GET /api/jobs/{job_id}/executions` - Live execution history
- `GET /api/executions/{execution_id}` - Execution details

---

#### [NEW] `api/websocket/manager.py`
WebSocket connection manager for real-time updates.

**Events Emitted**:
- `round_started` - New round begins
- `round_completed` - Round finishes
- `score_updated` - Miner score changes
- `live_execution` - Strategy executed on-chain

**Subscriptions**:
- Clients subscribe to specific job IDs
- Broadcast events to subscribed clients only

---

### Frontend Application

#### [NEW] `frontend/` Directory Structure
```
frontend/
├── app/
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home/redirect
│   ├── dashboard/
│   │   ├── page.tsx              # Main dashboard
│   │   └── [jobId]/
│   │       ├── page.tsx          # Job-specific dashboard
│   │       ├── leaderboard/
│   │       │   └── page.tsx      # Leaderboard page
│   │       ├── rounds/
│   │       │   └── page.tsx      # Round history
│   │       └── executions/
│   │           └── page.tsx      # Live executions
│   └── miners/
│       └── [uid]/
│           └── page.tsx          # Miner profile
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/
│   │   ├── JobCard.tsx
│   │   ├── StatsGrid.tsx
│   │   ├── CurrentRoundCard.tsx
│   │   └── RecentActivity.tsx
│   ├── leaderboard/
│   │   ├── LeaderboardTable.tsx
│   │   ├── LeaderboardFilters.tsx
│   │   ├── RankBadge.tsx
│   │   └── MinerQuickView.tsx
│   ├── rounds/
│   │   ├── RoundTimeline.tsx
│   │   ├── RoundCard.tsx
│   │   └── RoundDetailsModal.tsx
│   ├── miners/
│   │   ├── MinerHeader.tsx
│   │   ├── ScoreChart.tsx
│   │   ├── ParticipationCalendar.tsx
│   │   └── PredictionHistory.tsx
│   ├── executions/
│   │   ├── ExecutionFeed.tsx
│   │   ├── PositionVisualizer.tsx
│   │   └── TransactionExplorer.tsx
│   └── shared/
│       ├── Navbar.tsx
│       ├── Sidebar.tsx
│       ├── LoadingSpinner.tsx
│       └── ErrorBanner.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts            # Axios/Fetch client
│   │   ├── jobs.ts              # Job API calls
│   │   ├── rounds.ts            # Round API calls
│   │   ├── miners.ts            # Miner API calls
│   │   └── leaderboard.ts       # Leaderboard API calls
│   ├── hooks/
│   │   ├── useJobs.ts
│   │   ├── useLeaderboard.ts
│   │   ├── useRounds.ts
│   │   ├── useWebSocket.ts
│   │   └── useMinerProfile.ts
│   ├── types/
│   │   ├── job.ts
│   │   ├── round.ts
│   │   ├── miner.ts
│   │   └── execution.ts
│   └── utils/
│       ├── formatting.ts        # Date, number formatting
│       ├── calculations.ts      # Win rate, percentile
│       └── constants.ts         # Config constants
└── public/
    └── logo.svg
```

---

### Component Details

#### Dashboard Page (`app/dashboard/page.tsx`)

**Purpose**: Overview of all jobs with key metrics

**Features**:
- Grid of job cards with status indicators
- System-wide statistics (total jobs, miners, rounds)
- Recent activity feed across all jobs
- Quick navigation to job-specific dashboards

**Data Fetching**:
```typescript
const { data: jobs } = useQuery({
  queryKey: ['jobs'],
  queryFn: fetchJobs,
  refetchInterval: 60000
})
```

---

#### Job Dashboard (`app/dashboard/[jobId]/page.tsx`)

**Purpose**: Detailed view of a specific job

**Sections**:
1. **Job Header** - Pair name, vault address, job status
2. **Stats Grid** - Total rounds, active miners, avg participation
3. **Current Round Card** - Real-time round progress with countdown
4. **Top Miners Preview** - Top 5 from leaderboard
5. **Recent Rounds** - Last 10 rounds with winners
6. **Activity Feed** - Real-time events (rounds, scores, executions)

**Real-time Updates**:
```typescript
useWebSocket(['round_started', 'round_completed'], (event) => {
  if (event.data.job_id === jobId) {
    queryClient.invalidateQueries(['job', jobId])
  }
})
```

---

#### Leaderboard Page (`app/dashboard/[jobId]/leaderboard/page.tsx`)

**Purpose**: Ranked list of miners with filtering and search

**Features**:
- Sortable table (score, participation, win rate)
- Filter by live eligibility
- Search by miner UID or hotkey
- Pagination (50 per page)
- Real-time score updates
- Click row to view miner profile

**Columns**:
- Rank (with trend indicators ↑↓)
- Miner UID + Hotkey (truncated)
- Combined Score
- Evaluation Score
- Live Score
- Participation Days
- Eligible badge (✓/✗)
- Win Rate (%)
- Actions (View Profile)

---

#### Round History (`app/dashboard/[jobId]/rounds/page.tsx`)

**Purpose**: Timeline of all rounds with performance data

**Features**:
- Timeline visualization of rounds
- Filter by round type (evaluation/live)
- Search by round number
- Expandable round cards showing:
  - Winner info
  - Top 3 miners
  - Participation count
  - Duration
  - Performance metrics

---

#### Live Executions (`app/dashboard/[jobId]/executions/page.tsx`)

**Purpose**: Monitor on-chain strategy executions

**Features**:
- Real-time feed of executions
- Transaction status indicators
- Position visualizer (tick ranges on price axis)
- Link to block explorer
- Performance comparison (predicted vs actual)

---

#### Miner Profile (`app/miners/[uid]/page.tsx`)

**Purpose**: Comprehensive miner analytics

**Sections**:
1. **Header** - UID, hotkey, global stats
2. **Per-Job Performance** - Cards for each job
3. **Score History Chart** - Line chart of score evolution
4. **Participation Calendar** - Heatmap of daily participation
5. **Prediction History** - Recent rebalancing decisions

**Charts**:
- Score over time (3 lines: eval, live, combined)
- Win rate trend
- Participation consistency

---

## Verification Plan

### Frontend Testing
1. **Component Tests** - Jest + React Testing Library
2. **E2E Tests** - Playwright for critical flows
3. **Visual Regression** - Chromatic for UI changes
4. **Performance** - Lighthouse scores >90

### API Testing
1. **Unit Tests** - pytest for service logic
2. **Integration Tests** - FastAPI TestClient
3. **Load Tests** - Locust for API performance
4. **WebSocket Tests** - Test connection/disconnection/events

### Manual Testing
1. **Responsiveness** - Test on mobile, tablet, desktop
2. **Real-time Updates** - Verify WebSocket events update UI
3. **Error Handling** - Test offline, slow network, API errors
4. **Data Accuracy** - Compare with database queries

---

## User Review Required

> [!IMPORTANT]
> **Technology Stack Confirmation**
> 
> Please confirm the following technology choices:
> - **Backend**: FastAPI (Python) - Reuses existing database models
> - **Frontend**: Next.js 14 + TypeScript - Modern, fast, SEO-friendly
> - **Styling**: Tailwind CSS + shadcn/ui - Professional, customizable
> - **State**: TanStack Query - Optimal for server state
> - **Charts**: Recharts - Easy to use, performant
> 
> Alternative considerations:
> - Vue/Nuxt instead of React/Next.js?
> - GraphQL instead of REST?
> - Different chart library (Chart.js, D3.js only)?

> [!IMPORTANT]
> **Deployment Strategy**
> 
> Proposed hosting:
> - **Frontend**: Vercel (free tier, auto-deploy from GitHub)
> - **Backend API**: Railway or DigitalOcean App Platform
> 
> This requires:
> - Backend API to be accessible from public internet
> - WebSocket support on hosting platform
> - PostgreSQL connection from API server
> 
> Please confirm this works with your infrastructure or suggest alternatives.

> [!WARNING]
> **Database Access**
> 
> The API will read from the existing Jobs database. This means:
> - API server needs PostgreSQL credentials
> - Read-only access is sufficient (no writes from API)
> - Consider connection pooling for performance
> 
> Do you want to create a read-only database user for the API?

---

## Implementation Phases

### Phase 1: Backend API Foundation (Week 1)
- [ ] Set up FastAPI project structure
- [ ] Implement database connection with Tortoise ORM
- [ ] Create Pydantic response models
- [ ] Build job endpoints (list, details, stats)
- [ ] Build leaderboard endpoint
- [ ] Add CORS and error handling middleware
- [ ] Write API documentation (auto-generated with FastAPI)

### Phase 2: Backend Real-time & Additional Endpoints (Week 1-2)
- [ ] Implement WebSocket connection manager
- [ ] Add round endpoints (history, current, details)
- [ ] Add miner endpoints (profile, performance, history)
- [ ] Add execution endpoints
- [ ] Implement event broadcasting logic
- [ ] Add pagination and filtering utilities
- [ ] Write integration tests

### Phase 3: Frontend Setup & Core Components (Week 2)
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Tailwind CSS + shadcn/ui
- [ ] Configure TanStack Query
- [ ] Create type definitions (Job, Round, Miner, etc.)
- [ ] Build API client wrapper
- [ ] Implement shared components (Navbar, Sidebar, LoadingSpinner)
- [ ] Create layout structure

### Phase 4: Dashboard Implementation (Week 2-3)
- [ ] Build main dashboard page (all jobs)
- [ ] Build job-specific dashboard
- [ ] Implement StatsGrid component
- [ ] Implement CurrentRoundCard with countdown
- [ ] Add RecentActivity feed
- [ ] Integrate WebSocket for real-time updates
- [ ] Add responsive design

### Phase 5: Leaderboard & Miners (Week 3)
- [ ] Build LeaderboardTable component
- [ ] Implement filtering and sorting
- [ ] Add pagination
- [ ] Create MinerQuickView modal
- [ ] Build full Miner Profile page
- [ ] Implement ScoreChart with Recharts
- [ ] Add ParticipationCalendar heatmap
- [ ] Real-time score updates

### Phase 6: Rounds & Executions (Week 3-4)
- [ ] Build RoundTimeline component
- [ ] Implement RoundCard with expandable details
- [ ] Add round filtering and search
- [ ] Build ExecutionFeed component
- [ ] Implement PositionVisualizer
- [ ] Add TransactionExplorer with block explorer links
- [ ] Real-time execution updates

### Phase 7: Polish & Optimization (Week 4)
- [ ] Add loading skeletons
- [ ] Implement error boundaries
- [ ] Add toast notifications
- [ ] Optimize bundle size
- [ ] Add animations with Framer Motion
- [ ] Improve mobile responsiveness
- [ ] Performance testing and optimization

### Phase 8: Testing & Deployment (Week 4)
- [ ] Write component tests
- [ ] Write E2E tests for critical flows
- [ ] Load test API endpoints
- [ ] Deploy backend to Railway/DigitalOcean
- [ ] Deploy frontend to Vercel
- [ ] Set up CI/CD pipeline
- [ ] Monitor errors with Sentry

---

## Success Criteria

### Performance
- [ ] Page load time < 2s
- [ ] API response time < 200ms (p95)
- [ ] WebSocket latency < 100ms
- [ ] Lighthouse score > 90

### Functionality
- [ ] All endpoints working correctly
- [ ] Real-time updates functioning
- [ ] Mobile responsive design
- [ ] Error handling gracefully
- [ ] Data accuracy verified

### User Experience
- [ ] Intuitive navigation
- [ ] Clear data visualization
- [ ] Fast interactions
- [ ] Helpful error messages
- [ ] Professional design

---

## Future Enhancements (Post-MVP)

### Phase 9: Advanced Features
- [ ] Authentication (validator login)
- [ ] Job creation/management from UI
- [ ] Email/Telegram alerts for events
- [ ] Export data to CSV/JSON
- [ ] Custom dashboards (drag-and-drop widgets)
- [ ] Dark mode support

### Phase 10: Analytics
- [ ] Historical trend analysis
- [ ] Miner clustering/segmentation
- [ ] Strategy pattern detection
- [ ] Performance predictions
- [ ] Anomaly detection

### Phase 11: Integrations
- [ ] Grafana dashboard integration
- [ ] Prometheus metrics export
- [ ] Webhook support for external services
- [ ] API rate limiting and keys
- [ ] Public readonly API for community

---

## Estimated Timeline

**Total Duration**: 10 days (accelerated sprint)

**Team Composition**:
- 1 Python Backend Developer
- 2 Frontend Developers (FE1 + FE2)
- 1 Coordinator/PM

| Days | Backend | Frontend 1 | Frontend 2 | Coordinator |
|------|---------|------------|------------|-------------|
| Day 1-2 | API Foundation | Setup + Components | Design System | Planning + Documentation |
| Day 3-4 | WebSocket + Endpoints | Dashboard | Leaderboard | Testing + Integration |
| Day 5-6 | Testing + Polish | Rounds | Miners + Executions | Code Review |
| Day 7-8 | Deployment Prep | Testing + Polish | Testing + Polish | QA + Documentation |
| Day 9-10 | Deploy + Monitor | Deploy | Deploy | Final QA + Handoff |

**Parallel Workstreams**: Backend and frontend work in parallel with daily syncs

---

## Team Responsibilities

### Backend Developer
**Focus**: Build complete API layer and WebSocket server

**Days 1-2**: API Foundation
- FastAPI project setup and structure
- Database connection with Tortoise ORM
- Pydantic response models
- Jobs endpoints (list, details, stats)
- Leaderboard endpoint with filtering
- CORS and middleware setup

**Days 3-4**: Real-time & Additional Endpoints
- WebSocket connection manager
- Round endpoints (history, current, details)
- Miner endpoints (profile, performance, history)
- Execution endpoints
- Event broadcasting logic
- Pagination and filtering utilities

**Days 5-6**: Testing & Polish
- Write integration tests (pytest)
- API documentation (auto-generated)
- Performance optimization
- Error handling improvements
- Load testing with sample data

**Days 7-10**: Deployment & Support
- Deploy to Railway/DigitalOcean
- Set up database connection
- Monitor API performance
- Support frontend integration issues
- Fix bugs as they arise

---

### Frontend Developer 1
**Focus**: Core dashboard and infrastructure

**Days 1-2**: Setup & Foundation
- Initialize Next.js 14 project with TypeScript
- Configure Tailwind CSS + shadcn/ui
- Set up TanStack Query
- Create type definitions (Job, Round, Miner, etc.)
- Build API client wrapper
- Implement shared components (Navbar, Sidebar, LoadingSpinner, ErrorBanner)
- Create layout structure

**Days 3-4**: Dashboard Implementation
- Build main dashboard page (all jobs overview)
- Build job-specific dashboard
- Implement StatsGrid component
- Implement CurrentRoundCard with real-time countdown
- Add RecentActivity feed
- Integrate WebSocket for real-time updates
- Responsive design for dashboard

**Days 5-6**: Rounds Pages
- Build RoundTimeline component
- Implement RoundCard with expandable details
- Add round filtering and search
- Build round history page
- Add pagination

**Days 7-8**: Testing & Polish
- Write component tests (Jest + React Testing Library)
- Add loading skeleton states
- Implement error boundaries
- Add toast notifications
- Performance optimization (code splitting, lazy loading)

**Days 9-10**: Deployment
- Deploy to Vercel
- Configure environment variables
- Set up CI/CD with GitHub Actions
- Monitor performance
- Fix production issues

---

### Frontend Developer 2
**Focus**: Leaderboard, miners, and executions

**Days 1-2**: Design System & Shared Components
- Set up design tokens (colors, spacing, typography)
- Build reusable UI components with shadcn/ui
- Create RankBadge component
- Build data table component (reusable)
- Implement chart components with Recharts
- Create modal components

**Days 3-4**: Leaderboard Implementation
- Build LeaderboardTable component with sorting
- Implement LeaderboardFilters (eligibility, type)
- Add search functionality (by UID or hotkey)
- Implement pagination
- Create MinerQuickView modal
- Real-time score updates via WebSocket
- Responsive design for leaderboard

**Days 5-6**: Miner Profiles & Executions
- Build Miner Profile page
- Implement MinerHeader component
- Create ScoreChart (line chart with 3 series)
- Build ParticipationCalendar heatmap
- Add PredictionHistory component
- Build ExecutionFeed component
- Implement PositionVisualizer
- Add TransactionExplorer with block explorer links

**Days 7-8**: Testing & Polish
- Write component tests
- Add animations with Framer Motion
- Improve mobile responsiveness
- Cross-browser testing
- Accessibility improvements (ARIA labels, keyboard navigation)

**Days 9-10**: Final Integration
- Integration testing with FE1's work
- Fix any UI/UX issues
- Performance testing
- Final polish and bug fixes

---

### Coordinator/Project Manager
**Focus**: Planning, integration, testing, and documentation

**Days 1-2**: Planning & Setup
- Finalize requirements and scope
- Set up project tracking (GitHub Projects or Jira)
- Create detailed task assignments
- Set up development environment for team
- Document API contracts and TypeScript interfaces
- Create staging environment

**Days 3-4**: Integration & Testing
- Daily standups with team
- API integration testing between backend and frontend
- Set up testing frameworks (Jest, Playwright)
- Create test data in database
- Document any blockers or changes
- Code review for backend API

**Days 5-6**: QA & Documentation
- Manual testing of all features
- Create test scenarios and checklists
- Write user documentation
- Code review for frontend components
- Performance testing (Lighthouse, WebPageTest)
- Security review

**Days 7-8**: Deployment Preparation
- Set up production environment
- Configure deployment pipelines (Vercel, Railway)
- Set up monitoring (Sentry for errors)
- Create deployment checklist
- Coordinate backend and frontend deployments
- Load testing

**Days 9-10**: Launch & Handoff
- Final QA on production
- Monitor deployments
- Fix critical bugs
- Create handoff documentation
- Post-launch retrospective
- Plan for next iteration

---

## Dependencies & Risks

### Dependencies
- PostgreSQL Jobs database must be accessible from API server
- Existing Tortoise ORM models must be reusable
- WebSocket hosting support required

### Risks
- **Database performance**: Large datasets may slow queries
  - *Mitigation*: Add indexes, implement caching, paginate everything
- **Real-time scalability**: Many concurrent WebSocket connections
  - *Mitigation*: Use Redis for pub/sub, load balance if needed
- **Data consistency**: API reads while validator writes
  - *Mitigation*: Use read replicas if available, accept eventual consistency

---

## Next Steps

1. **Review this plan** - Confirm tech stack and approach
2. **Address review items** - Database access, deployment, alternatives
3. **Set up repositories** - Create separate repos or monorepo
4. **Start Phase 1** - Begin backend API implementation

Ready to proceed?
