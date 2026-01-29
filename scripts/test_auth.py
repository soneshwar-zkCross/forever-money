import requests
import time
import json

BASE_URL = "http://localhost:8000/auth"
WALLET_NAME = "sn98_final"
HOTKEY = "default"

def test_login_flow():
    print("--- Testing Multi-Wallet Auth Flow ---")
    
    # 1. Sign message internally to simulate extension signing
    print("1. Signing internal message...")
    sign_payload = {
        "wallet_name": WALLET_NAME,
        "hotkey": HOTKEY,
        "message": "Verify login" # Message doesn't matter for the internal API, it signs exactly this
    }
    
    # Actually, the real login flow requires getting a challenge first
    # So we need to:
    # a. POST /challenge
    # b. Sign the challenge message format
    # c. POST /login
    
    print("a. Requesting challenge...")
    challenge_payload = {
        "wallet_address": "5H3jijYX7QLt1LXtwwVb6SbhNZ81qJmiSPEEgqh9WfaNBbjm"
    }
    resp = requests.post(f"{BASE_URL}/challenge", json=challenge_payload)
    if resp.status_code != 200:
        print(f"❌ Failed to get challenge: {resp.text}")
        return
    
    challenge_data = resp.json()
    challenge = challenge_data["challenge"]
    msg_to_sign = challenge_data["message"]
    wallet_address = "5H3jijYX7QLt1LXtwwVb6SbhNZ81qJmiSPEEgqh9WfaNBbjm"
    
    print(f"b. Signing challenge: {challenge}")
    sign_payload = {
        "wallet_name": WALLET_NAME,
        "hotkey": HOTKEY,
        "message": msg_to_sign
    }
    sign_resp = requests.post(f"{BASE_URL}/sign-internal", json=sign_payload)
    if sign_resp.status_code != 200:
        print(f"❌ Internal signing failed: {sign_resp.text}")
        return
    
    signature = sign_resp.json()["signature"]
    
    print("c. Attempting verify...")
    verify_payload = {
        "wallet_address": wallet_address,
        "challenge": challenge,
        "signature": signature
    }
    verify_resp = requests.post(f"{BASE_URL}/verify", json=verify_payload)
    
    if verify_resp.status_code == 200:
        print("✅ Verification successful!")
        print(f"Token: {verify_resp.json()['access_token'][:20]}...")
    else:
        print(f"❌ Verification failed: {verify_resp.text}")

if __name__ == "__main__":
    test_login_flow()
