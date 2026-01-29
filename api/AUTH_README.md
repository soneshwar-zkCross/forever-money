# API Authentication System

## Quick Start

### 1. Install Dependencies

```bash
cd api
pip install -r requirements.txt
```

### 2. Configure Admin Wallet

Edit `api/config/admin_wallets.json` to add your wallet:

```json
{
  "admins": [
    {
      "wallet_address": "YOUR_WALLET_ADDRESS_HERE",
      "name": "Your Name",
      "added_by": "system",
      "added_at": "2026-01-27T00:00:00Z",
      "permissions": ["read", "write", "manage_admins"]
    }
  ]
}
```

### 3. Set JWT Secret

```bash
# Copy example env file
cp .env.auth.example .env.local

# Edit and set a strong secret
JWT_SECRET=your-random-secret-key-generate-this
```

### 4. Start API

```bash
python main.py
```

---

## Authentication Flow

### Step 1: Request Challenge

```bash
curl -X POST http://localhost:8000/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"}'
```

Response:
```json
{
  "challenge": "SN98-AUTH-1706400000-abc123",
  "expires_at": "2026-01-27T12:05:00Z",
  "message": "Sign this message to authenticate to SN98 Admin Panel:\n\nSN98-AUTH-1706400000-abc123\n\nTimestamp: 1706400000"
}
```

### Step 2: Sign Challenge

Using `btcli`:
```bash
# Sign the message
btcli wallet sign --message "Sign this message to authenticate to SN98 Admin Panel:

SN98-AUTH-1706400000-abc123

Timestamp: 1706400000" 
```

Or using Python:
```python
import bittensor as bt

wallet = bt.wallet(name="your_wallet", hotkey="your_hotkey")
signature = wallet.hotkey.sign(message).hex()
```

### Step 3: Verify Signature & Get Token

```bash
curl -X POST http://localhost:8000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "challenge": "SN98-AUTH-1706400000-abc123",
    "signature": "0x..."
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400,
  "wallet_address": "5GrwvaEF...",
  "permissions": ["read", "write", "manage_admins"]
}
```

### Step 4: Use Token

```bash
curl http://localhost:8000/api/jobs \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## API Endpoints

### Public (No Auth)
- `GET /health` - Health check
- `GET /docs` - API documentation
- `POST /auth/challenge` - Request auth challenge
- `POST /auth/verify` - Verify signature & get token

### Protected (Requires Auth)
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout (revoke token)
- `GET /api/jobs` - List jobs
- `GET /api/jobs/{id}` - Job details
- `GET /api/jobs/{id}/leaderboard` - Leaderboard
- (All other data endpoints...)

### Admin Only (Requires `manage_admins`)
- `GET /admin/wallets` - List admin wallets
- `POST /admin/wallets` - Add admin wallet
- `DELETE /admin/wallets/{address}` - Remove admin
- `PATCH /admin/wallets/{address}/permissions` - Update permissions

---

## Permissions

### Available Permissions
- `read` - View data endpoints
- `write` - Future: Modify jobs/settings
- `manage_admins` - Add/remove admin wallets

### Default Permissions
New admins get `["read", "write"]` by default.

---

## Security Notes

1. **JWT Secret**: Must be cryptographically secure in production
2. **HTTPS**: Always use HTTPS in production
3. **Challenge Expiry**: 5 minutes (configurable)
4. **Token Expiry**: 24 hours (configurable)
5. **Signature Verification**: Uses Bittensor's built-in verification

---

## Testing

### Run Test Script

```bash
python api/test_auth.py
```

### Manual Testing

1. Request challenge
2. Sign with your wallet
3. Verify and get token
4. Test protected endpoints

---

## Troubleshooting

### "Wallet not authorized"
- Check `api/config/admin_wallets.json`
- Ensure your wallet address is in the list

### "Invalid signature"
- Verify you signed the exact challenge message
- Check signature format (should be hex string)

### "Challenge expired"
- Request a new challenge
- Complete flow within 5 minutes

### "Token expired"
- Tokens last 24 hours
- Request new challenge to re-authenticate

---

## Files Created

```
api/
├── auth/
│   ├── __init__.py           # Auth package
│   ├── config.py             # JWT & challenge config
│   ├── admin_manager.py      # Whitelist management
│   ├── signature.py          # Bittensor verification
│   └── dependencies.py       # FastAPI middleware
├── routers/
│   ├── auth.py              # Auth endpoints
│   └── admin.py             # Admin management
├── config/
│   └── admin_wallets.json   # Admin whitelist
└── test_auth.py             # Test script
```

---

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# Auth Configuration
CHALLENGE_EXPIRY_MINUTES=5
ADMIN_WALLETS_FILE=api/config/admin_wallets.json
```

---

**Status**: ✅ Implementation Complete  
**Branch**: `api-systems`  
**Next**: Test with live validator wallet
