"""
API Server Runner

Starts the FastAPI server without uvloop to avoid conflicts with bittensor's nest_asyncio.
"""
import os
from pathlib import Path

# Load environment variables from .env
env_file = Path(__file__).parent / '.env'
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
    print(f"✅ Loaded environment variables from {env_file}")
else:
    print(f"⚠️  No .env file found at {env_file}")

# Verify READER_DB_URL
if 'READER_DB_URL' in os.environ:
    print("✅ READER_DB_URL is configured")
else:
    print("⚠️  READER_DB_URL not found in environment")

if __name__ == "__main__":
    import uvicorn
    import sys
    from pathlib import Path

    # Change to parent directory so api module can be imported
    parent_dir = Path(__file__).parent.parent
    os.chdir(parent_dir)
    if str(parent_dir) not in sys.path:
        sys.path.insert(0, str(parent_dir))

    print("\n🚀 Starting Forever Money API Server...")
    print(f"📂 Working directory: {os.getcwd()}")
    print("📍 Server: http://0.0.0.0:8000")
    print("📊 API Docs: http://localhost:8000/docs")
    print("💚 Health Check: http://localhost:8000/health")
    print("\nPress CTRL+C to quit\n")

    # Start without uvloop to avoid conflict with bittensor
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        loop="asyncio"  # Use standard asyncio instead of uvloop
    )
