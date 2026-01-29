#!/bin/bash

# SN98 Validator Setup & Testnet Registration Script
# This script handles the end-to-end setup of a validator and the admin panel API.

set -e

# Configuration
PROJECT_ROOT=$(pwd)
API_DIR="$PROJECT_ROOT/api"
VENV_DIR="$API_DIR/venv"
NETWORK="test"
NETUID=98

echo "🚀 Starting SN98 Validator Setup..."

# 1. Check Python and Virtual Environment
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
python3 -m pip install --upgrade pip

# 2. Install Dependencies
echo "📦 Installing requirements (this may take a few minutes)..."

# Ensure common build tools are available
python3 -m pip install --upgrade setuptools wheel

# SPECIFIC FIX FOR PYTHON 3.13: Force a newer numpy
echo "📦 Pre-installing 3.13-friendly dependencies..."
python3 -m pip install --prefer-binary "numpy>=2.1.0" "fastapi>=0.110.0,<0.111.0" "eth-account>=0.11.0"

# Install bittensor without strictly following its numpy constraint
echo "📦 Installing bittensor (with dependency bypass)..."
python3 -m pip install bittensor==8.5.1 --no-deps

# Now install bittensor's other dependencies that it really needs
echo "📦 Installing bittensor's core dependencies..."
python3 -m pip install --prefer-binary aiohttp bittensor-cli bt-decode==0.4.0 colorama munch==2.5.0 pydantic regex substrate-interface==1.7.11 requests loguru
python3 -m pip install --prefer-binary async-property==0.2.2 bittensor-commit-reveal>=0.1.0 msgpack-numpy-opentensor~=0.5.0 nest-asyncio python-Levenshtein python-statemachine~=2.1 retry scalecodec==1.2.11 aiosqlite>=0.21.0 web3


# Install the rest of the requirements
echo "📦 Installing API requirements..."
python3 -m pip install -r "$API_DIR/requirements.txt" --prefer-binary || true



# 3. Wallet Check
echo "👛 Checking wallets..."
BITTENSOR_WALLETS_DIR="$HOME/.bittensor/wallets"

# Ask for wallet details
if [ -z "$WALLET_NAME" ]; then
    read -p "Enter wallet name [default]: " WALLET_NAME
fi
WALLET_NAME=${WALLET_NAME:-default}

if [ -z "$HOTKEY_NAME" ]; then
    read -p "Enter hotkey name [default]: " HOTKEY_NAME
fi
HOTKEY_NAME=${HOTKEY_NAME:-default}

if [ ! -d "$BITTENSOR_WALLETS_DIR/$WALLET_NAME/hotkeys/$HOTKEY_NAME" ]; then
    echo "ℹ️ Wallet '$WALLET_NAME:$HOTKEY_NAME' not found in $BITTENSOR_WALLETS_DIR. Creating a new one..."
    yes "" | btcli wallet create --wallet.name "$WALLET_NAME" --wallet.hotkey "$HOTKEY_NAME" --no-use-password
else
    echo "✅ Wallet '$WALLET_NAME:$HOTKEY_NAME' found at $BITTENSOR_WALLETS_DIR/$WALLET_NAME"
fi

# 4. Testnet Registration
echo "🌐 Checking testnet registration (Network: $NETWORK, Netuid: $NETUID)..."
if [ -z "$REGISTER_VAL" ]; then
    read -p "Do you want to register your validator on testnet $NETUID? (y/n) [n]: " REGISTER_CHOICE
else
    REGISTER_CHOICE="$REGISTER_VAL"
fi

if [[ "$REGISTER_CHOICE" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🚀 Registering on testnet..."
    btcli s register --subtensor.network "$NETWORK" --netuid "$NETUID" --wallet.name "$WALLET_NAME" --wallet.hotkey "$HOTKEY_NAME"
else
    echo "⏭️ Skipping registration."
fi

# 5. Bootstrap Admin List
echo "🔐 Bootstrapping admin list..."
export SUBTENSOR_WALLET_NAME="$WALLET_NAME"
export SUBTENSOR_HOTKEY_NAME="$HOTKEY_NAME"
python3 "$PROJECT_ROOT/scripts/bootstrap_admin.py"

# 6. Start API Server
echo "🚀 Everything is ready!"
if [ -z "$START_API_VAL" ]; then
    read -p "Do you want to start the API server now? (y/n) [y]: " START_API
else
    START_API="$START_API_VAL"
fi

if [[ ! "$START_API" =~ ^([nN][oO]|[nN])$ ]]; then
    echo "🔥 Starting API server on http://localhost:8000"
    cd "$API_DIR"
    export ALLOW_INTERNAL_SIGNING=true
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
fi
