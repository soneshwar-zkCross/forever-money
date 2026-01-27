# SN98 Admin Panel API

Backend API for the SN98 ForeverMoney subnet admin panel.

## Features

- **RESTful API** with FastAPI
- **Database Connection** using Tortoise ORM
- **CORS Support** for frontend integration
- **Auto-generated Documentation** at `/docs`
- **Request Logging** with timing metrics
- **Error Handling** with proper HTTP status codes

## Setup

### 1. Install Dependencies

```bash
cd api
pip install -r requirements.txt
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
JOBS_POSTGRES_HOST=localhost
JOBS_POSTGRES_PORT=5432
JOBS_POSTGRES_DB=sn98_jobs
JOBS_POSTGRES_USER=sn98_user
JOBS_POSTGRES_PASSWORD=your_password
```

### 3. Run the API

```bash
python main.py
```

Or with uvicorn:

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## API Endpoints

### Jobs

- `GET /api/jobs` - List all jobs
  - Query params: `is_active` (boolean)
- `GET /api/jobs/{job_id}` - Get job details with stats
- `GET /api/jobs/{job_id}/stats` - Get job statistics

### Leaderboard

- `GET /api/jobs/{job_id}/leaderboard` - Get ranked miners
  - Query params: `limit`, `offset`, `eligible_only`, `sort_by`
- `GET /api/jobs/{job_id}/leaderboard/top` - Get top N miners
  - Query param: `n` (default: 10)

### Health

- `GET /health` - Health check endpoint

## Example Requests

### Get All Active Jobs

```bash
curl http://localhost:8000/api/jobs?is_active=true
```

### Get Job Details

```bash
curl http://localhost:8000/api/jobs/job_eth_usdc_001
```

### Get Leaderboard

```bash
curl "http://localhost:8000/api/jobs/job_eth_usdc_001/leaderboard?limit=50&sort_by=combined"
```

### Get Top 10 Miners

```bash
curl http://localhost:8000/api/jobs/job_eth_usdc_001/leaderboard/top?n=10
```

## Response Examples

### Job List Response

```json
{
  "jobs": [
    {
      "job_id": "job_eth_usdc_001",
      "sn_liquditiy_manager_address": "0x123...",
      "pair_address": "0x456...",
      "fee_rate": 0.03,
      "target": "PoL",
      "target_ratio": 0.5,
      "chain_id": 8453,
      "is_active": true,
      "round_duration_seconds": 900,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z",
      "metadata": {
        "pair_name": "ETH/USDC"
      }
    }
  ],
  "total": 1
}
```

### Leaderboard Response

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
      "refusals": 4,
      "win_rate": 0.973,
      "avg_response_time_ms": 145.3,
      "first_seen": "2024-01-01T00:00:00Z",
      "last_active": "2024-01-15T10:25:00Z"
    }
  ]
}
```

## Development

### Code Structure

```
api/
├── main.py                    # FastAPI app entry point
├── config.py                  # Configuration settings
├── requirements.txt           # Python dependencies
├── models/
│   └── responses.py          # Pydantic response models
├── routers/
│   ├── jobs.py               # Job endpoints
│   └── leaderboard.py        # Leaderboard endpoints
└── services/
    ├── jobs_service.py       # Job business logic
    └── leaderboard_service.py # Leaderboard business logic
```

### Adding New Endpoints

1. Create a new router in `routers/`
2. Create service logic in `services/`
3. Define response models in `models/responses.py`
4. Register router in `main.py`

### Testing

Access the interactive API documentation at http://localhost:8000/docs to test all endpoints.

## Deployment

See deployment guide in the main project documentation.

## License

Part of the SN98 ForeverMoney project.
