# Bittensor Wallet Authentication - NO BULLSHIT GUIDE

## The Simple Truth

**You can use your VALIDATOR'S HOTKEY (Substrate) OR METAMASK (EVM).**

We support both. Bittensor is native, but MetaMask is supported for convenience if your admin address is an Ethereum-style `0x` address.

---

## 🦊 Method A: MetaMask (EVM)
If you want to use MetaMask, ensure your `0x...` address is in the `admin_wallets.json` whitelist.

1.  **Frontend**: Request challenge.
2.  **MetaMask Popup**: Sign the message when prompted.
3.  **Authentication**: Complete signature verification automatically.

---

## 🔑 Method B: Bittensor Hotkey (Substrate)
This uses your wallet running the subnet. Standard for validators.

### What Wallet Do I Use?

The wallet you use to RUN YOUR VALIDATOR. That's it.

If you're running:
```bash
python validator/validator.py --wallet.name my_validator --wallet.hotkey default
```

Then your wallet is:
- **Name**: `my_validator`
- **Hotkey**: `default`
- **Address**: Whatever `btcli wallet overview` shows for this wallet

---

## Authentication Flow (Simple)

### 1. Frontend Requests Challenge

```javascript
// User clicks "Connect Wallet" button
const response = await fetch('http://localhost:8000/auth/challenge', {
  method: 'POST',
  body: JSON.stringify({
    wallet_address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
  })
});

const { challenge, message } = await response.json();
// message = "Sign this message to authenticate to SN98 Admin Panel:\n\nSN98-AUTH-1706400000-abc123\n\nTimestamp: 1706400000"
```

### 2. User Signs Message

**Option A: Using btcli (Manual)**
```bash
btcli wallet sign \
  --wallet.name my_validator \
  --wallet.hotkey default \
  --message "Sign this message to authenticate to SN98 Admin Panel:

SN98-AUTH-1706400000-abc123

Timestamp: 1706400000"
```

This outputs a signature like: `0x1234abcd...`

**Option B: Using Python (Automated)**
```python
import bittensor as bt

# Load your validator wallet
wallet = bt.wallet(name='my_validator', hotkey='default')

# Sign the challenge
message = "Sign this message..."
signature = wallet.hotkey.sign(message.encode()).hex()
```

**Option C: Browser Extension (Future)**
- Like MetaMask for Ethereum
- User clicks "Sign"
- Extension signs with local wallet
- Returns signature automatically

### 3. Frontend Sends Signature

```javascript
const tokenResponse = await fetch('http://localhost:8000/auth/verify', {
  method: 'POST',
  body: JSON.stringify({
    wallet_address: '5GrwvaEF...',
    challenge: 'SN98-AUTH-1706400000-abc123',
    signature: '0x1234abcd...'
  })
});

const { access_token } = await tokenResponse.json();
// Save token in localStorage
localStorage.setItem('auth_token', access_token);
```

### 4. Use Token for All Requests

```javascript
// Every API call includes the token
fetch('http://localhost:8000/api/jobs', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
});
```

---

## Which Wallet Address to Use?

### Find Your Validator Wallet Address

```bash
# Show your wallet info
btcli wallet overview --wallet.name my_validator --wallet.hotkey default

# This shows your SS58 address like:
# 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

**THAT ADDRESS** is what you:
1. Put in `api/config/admin_wallets.json`
2. Use in the challenge request
3. Sign messages with

---

## Complete Real Example

### Step 1: Add Your Wallet to Admin List

Edit `api/config/admin_wallets.json`:
```json
{
  "admins": [
    {
      "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      "name": "My Validator",
      "added_by": "system",
      "added_at": "2026-01-27T00:00:00Z",
      "permissions": ["read", "write", "manage_admins"]
    }
  ]
}
```

### Step 2: Request Challenge (curl example)

```bash
curl -X POST http://localhost:8000/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
  }'
```

Response:
```json
{
  "challenge": "SN98-AUTH-1706400123-abc123def",
  "expires_at": "2026-01-27T12:05:00Z",
  "message": "Sign this message to authenticate to SN98 Admin Panel:\n\nSN98-AUTH-1706400123-abc123def\n\nTimestamp: 1706400123"
}
```

### Step 3: Sign the Message

**Copy the EXACT message** and sign it:

```bash
btcli wallet sign \
  --wallet.name my_validator \
  --wallet.hotkey default \
  --message "Sign this message to authenticate to SN98 Admin Panel:

SN98-AUTH-1706400123-abc123def

Timestamp: 1706400123"
```

You'll get something like:
```
Signature: 0x3a4f5e6d7c8b9a0f1e2d3c4b5a6978...
```

### Step 4: Verify and Get Token

```bash
curl -X POST http://localhost:8000/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
    "challenge": "SN98-AUTH-1706400123-abc123def",
    "signature": "0x3a4f5e6d7c8b9a0f1e2d3c4b5a6978..."
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 86400,
  "wallet_address": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "permissions": ["read", "write", "manage_admins"]
}
```

### Step 5: Use the Token

```bash
curl http://localhost:8000/api/jobs \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Frontend Implementation (React)

```typescript
// 1. Request challenge
const requestAuth = async (walletAddress: string) => {
  const res = await fetch('/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress })
  });
  return res.json();
};

// 2. User signs message (manually or with extension)
const { challenge, message } = await requestAuth(walletAddress);

// Show message to user
alert(`Please sign this message:\n\n${message}`);

// User signs with btcli or extension
const signature = prompt('Paste your signature:');

// 3. Verify and get token
const verifyAuth = async () => {
  const res = await fetch('/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: walletAddress,
      challenge: challenge,
      signature: signature
    })
  });
  const { access_token } = await res.json();
  
  // Save token
  localStorage.setItem('auth_token', access_token);
};

// 4. Use token for all API calls
const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
});
```

---

## Common Questions

### Q: Do users need their OWN wallet?
**A**: If you're running the validator, you use YOUR validator's wallet. If someone else wants access, they need their own Bittensor wallet address added to the admin list.

### Q: Can I use coldkey instead of hotkey?
**A**: You CAN, but hotkey is recommended because:
- Hotkey is already on the machine running the API
- Less security risk (coldkey should be offline)
- Easier to automate

### Q: How do users sign if they don't have btcli?
**A**: 
1. **Now**: They need btcli (manual signing)
2. **Soon**: Browser extension (like MetaMask)
3. **Best**: WalletConnect-style QR code

### Q: What if I want to add another admin?
**A**: They need:
1. A Bittensor wallet (any wallet)
2. You add their address to `admin_wallets.json`
3. They follow the same auth flow

### Q: Can I use the same wallet for validator AND admin?
**A**: YES! That's the recommended setup. Your validator wallet = your admin access.

---

## Security Notes

1. **Never share your private key** - Only signatures
2. **Challenge expires in 5 minutes** - Must complete auth within this time
3. **Token lasts 24 hours** - Re-authenticate daily
4. **Signature is one-time use** - Can't replay the same signature

---

## Troubleshooting

### "Wallet not authorized"
→ Check `api/config/admin_wallets.json` has your wallet address

### "Invalid signature"
→ Make sure you signed the EXACT message (copy-paste)
→ Check you're using the right wallet

### "Challenge expired"
→ Request a new challenge
→ Sign and submit within 5 minutes

### "Command not found: btcli"
→ Install Bittensor: `pip install bittensor`
→ Or use Python signing method

---

**TLDR**: Use your validator's hotkey wallet. Sign challenges with `btcli wallet sign`. Paste signature. Done.
