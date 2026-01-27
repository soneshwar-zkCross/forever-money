# SN98 ForeverMoney - Admin Panel Quick Start

> **Complete admin panel for monitoring and managing the SN98 subnet**

## 🚀 Quick Start (All-in-One)

```bash
# One command to rule them all!
./start_full_stack.sh
```

This will:
1. ✅ Set up environment
2. ✅ Generate test data (~16,000 records)
3. ✅ Start API server (port 8000)
4. ✅ Start frontend (port 3000)

Then open http://localhost:3000 in your browser!

---

## 📂 Project Structure

```
forever-money/
├── api/                    # FastAPI Backend
│   ├── main.py            # API entry point
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   └── models/            # Pydantic models
├── frontend/              # Next.js Frontend
│   └── src/
│       ├── app/           # Pages & routes
│       ├── components/    # React components
│       ├── lib/           # Utilities & API client
│       └── types/         # TypeScript types
├── validator/             # Bittensor Validator
├── miner/                # Bittensor Miner
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

---

## 🎯 What's Built

### Backend API (FastAPI)
- ✅ REST API with auto-generated docs
- ✅ All endpoints (jobs, leaderboard, rounds, miners, executions)
- ✅ Database integration (Tortoise ORM)
- ✅ CORS support
- ✅ Error handling & logging

**Endpoints**: http://localhost:8000/docs

### Frontend (Next.js 14)
- ✅ Dark mode UI with Tailwind CSS
- ✅ Real-time data fetching (React Query)
- ✅ Job dashboard with stats
- ✅ Leaderboard view
- ✅ Recent rounds feed
- ✅ Responsive design

**URL**: http://localhost:3000

### Test Data
- ✅ 2 jobs (ETH/USDC, WETH/USDC)
- ✅ 100 miners per job
- ✅ 200 rounds (evaluation + live)
- ✅ ~5,000 predictions
- ✅ ~40 live executions
- ✅ 6,000 participation records

---

## 🔧 Manual Setup

If you prefer step-by-step:

### 1. Generate Test Data

```bash
./generate_test_data.sh
```

### 2. Start API Server

```bash
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📊 Features

### Homepage
- Active jobs overview
- Quick stats (miners, rounds, executions)
- Job cards with metadata

### Job Dashboard
- Real-time stats
- Top 10 miners leaderboard
- Recent 10 rounds
- Current round progress (if active)

### API Documentation
- Interactive Swagger UI
- Request/response examples
- Try endpoints directly

---

## 🧪 Testing

### Test API

```bash
# Health check
curl http://localhost:8000/health

# Get jobs
curl http://localhost:8000/api/jobs | jq

# Get leaderboard
curl http://localhost:8000/api/jobs/job_eth_usdc_001/leaderboard | jq

# Get rounds
curl http://localhost:8000/api/jobs/job_eth_usdc_001/rounds | jq
```

### Test Frontend

Open browser to:
- http://localhost:3000 - Homepage
- http://localhost:3000/jobs/job_eth_usdc_001 - Job Dashboard

---

## 🛑 Stopping Services

```bash
# If you used start_full_stack.sh
cat .pids | xargs kill

# Or manually
pkill -f "python main.py"
pkill -f "next dev"
```

---

## 📝 Environment Configuration

### API (.env)
```env
# Database
JOBS_POSTGRES_HOST=localhost
JOBS_POSTGRES_PORT=5432
JOBS_POSTGRES_DB=sn98_jobs_test
JOBS_POSTGRES_USER=sn98_user
JOBS_POSTGRES_PASSWORD=your_password

# CORS
CORS_ORIGINS=http://localhost:3000
```

### Frontend (frontend/.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## 🎨 Frontend Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Utils**: date-fns

---

## 🔌 API Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: Tortoise ORM
- **Validation**: Pydantic
- **Server**: Uvicorn

---

## 📖 Documentation

- **System Docs**: [docs/README.md](docs/README.md)
- **Schema Validation**: [SCHEMA_VALIDATION.md](SCHEMA_VALIDATION.md)
- **Testnet Setup**: [TESTNET_SETUP.md](TESTNET_SETUP.md)
- **Implementation Plan**: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- **Task Breakdown**: [docs/TASK_BREAKDOWN.md](docs/TASK_BREAKDOWN.md)

---

## 🚀 Next Steps

### Phase 1 (Complete) ✅
- Backend API with all endpoints
- Frontend with homepage & job dashboard
- Test data generation
- Documentation

### Phase 2 (Coming Soon)
- [ ] WebSocket for real-time updates
- [ ] Full leaderboard page
- [ ] Rounds history page
- [ ] Miner profile pages
- [ ] Live executions feed
- [ ] Charts & visualizations

### Phase 3 (Future)
- [ ] Deploy to production
- [ ] Authentication
- [ ] Rate limiting
- [ ] Advanced filtering
- [ ] Export functionality

---

## 💡 Tips

1. **Auto-refresh**: Frontend auto-refreshes data every 30 seconds
2. **API Docs**: Interactive docs at http://localhost:8000/docs
3. **Dark Mode**: UI is dark mode by default
4. **Responsive**: Works on mobile, tablet, and desktop

---

## 🐛 Troubleshooting

### API won't start
```bash
# Check if port 8000 is in use
lsof -i :8000
# Kill process if needed
kill -9 $(lsof -t -i:8000)
```

### Frontend won't start
```bash
# Check if port 3000 is in use
lsof -i :3000
# Kill process if needed
kill -9 $(lsof -t -i:3000)
```

### Database connection error
```bash
# Check PostgreSQL is running
pg_isready
# Verify credentials in .env
```

---

## 📞 Support

For issues or questions:
1. Check [SCHEMA_VALIDATION.md](SCHEMA_VALIDATION.md) for API schema details
2. Review [docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md)
3. See [TESTNET_SETUP.md](TESTNET_SETUP.md) for deployment guide

---

**Built with ❤️ for SN98 ForeverMoney**
