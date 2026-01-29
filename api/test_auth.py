"""
Simple test script for authentication flow
"""
import requests
import bittensor as bt

# Configuration
API_BASE = "http://localhost:8000"

def test_auth_flow():
    """Test complete authentication flow"""
    
    print("=== Testing SN98 API Authentication ===\n")
    
    # Step 1: Request challenge
    print("1. Requesting authentication challenge...")
    wallet_address = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
    
    response = requests.post(
        f"{API_BASE}/auth/challenge",
        json={"wallet_address": wallet_address}
    )
    
    if response.status_code != 200:
        print(f"   ❌ Failed: {response.json()}")
        return
    
    challenge_data = response.json()
    print(f"   ✅ Challenge: {challenge_data['challenge']}")
    print(f"   Expires: {challenge_data['expires_at']}\n")
    
    # Step 2: Sign challenge (requires real wallet)
    print("2. Signing challenge (requires wallet hotkey)...")
    print("   ⚠️  This requires a configured Bittensor wallet\n")
    
    # Example with wallet (uncomment if you have wallet configured):
    # wallet = bt.wallet(name="your_wallet", hotkey="your_hotkey")
    # signature = wallet.hotkey.sign(challenge_data['message']).hex()
    
    # For testing without wallet, you'd need to use a pre-signed message
    # or manually sign with btcli
    
    print("   To complete this flow:")
    print(f"   1. Sign this message with your wallet:")
    print(f"      {challenge_data['message']}\n")
    print("   2. Send POST to /auth/verify with:")
    print("      {")
    print(f"        \"wallet_address\": \"{wallet_address}\",")
    print(f"        \"challenge\": \"{challenge_data['challenge']}\",")
    print("        \"signature\": \"<your_signature>\"")
    print("      }\n")
    
    return challenge_data


def test_admin_endpoint(token):
    """Test protected endpoint"""
    print("\n3. Testing protected endpoint...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{API_BASE}/admin/wallets",
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Admin wallets: {data['total']}")
        for admin in data['admins']:
            print(f"      - {admin['name']}: {admin['wallet_address'][:20]}...")
    else:
        print(f"   ❌ Failed: {response.json()}")


def test_public_endpoints():
    """Test that public endpoints still work"""
    print("\n4. Testing public endpoints (should work without auth)...")
    
    response = requests.get(f"{API_BASE}/health")
    if response.status_code == 200:
        print("   ✅ Health check: OK")
    
    response = requests.get(f"{API_BASE}/api/jobs")
    if response.status_code == 200:
        print("   ✅ Jobs endpoint: OK")


if __name__ == "__main__":
    # Test challenge request
    challenge_data = test_auth_flow()
    
    # Test public endpoints
    test_public_endpoints()
    
    print("\n=== Test Complete ===")
    print("\nNext steps:")
    print("1. Configure your wallet (btcli wallet create)")
    print("2. Add your wallet to api/config/admin_wallets.json")
    print("3. Complete the authentication flow to get a JWT token")
    print("4. Use the token to access protected endpoints")
