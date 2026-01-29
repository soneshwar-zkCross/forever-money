"""
Bootstrap script to auto-register the first validator as an admin
"""
import sys
import os
from pathlib import Path

# Add project root to sys.path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from api.auth.admin_manager import admin_manager
import bittensor as bt

def bootstrap():
    print("=== SN98 Admin Bootstrap ===")
    
    # Load default wallet from environment or use standard paths
    wallet_name = os.getenv("SUBTENSOR_WALLET_NAME", "default")
    hotkey_name = os.getenv("SUBTENSOR_HOTKEY_NAME", "default")
    
    try:
        wallet = bt.wallet(name=wallet_name, hotkey=hotkey_name)
        if not wallet.hotkey_file.exists_on_device():
            print(f"❌ Error: Wallet '{wallet_name}:{hotkey_name}' not found.")
            return

        address = wallet.hotkey.ss58_address
        print(f"✅ Found wallet: {wallet_name}:{hotkey_name} -> {address}")

        # Check if already admin
        if admin_manager.is_admin(address):
            print("ℹ️ Wallet is already an admin.")
            return

        # Add as super admin
        print(f"🚀 Registering {address} as the primary administrator...")
        admin_manager.add_admin(
            wallet_address=address,
            name="Primary Admin (Bootstrap)",
            added_by="system",
            permissions=["read", "write", "manage_admins"]
        )
        print("✅ Success! Wallet added to api/config/admin_wallets.json")

    except Exception as e:
        print(f"❌ Error during bootstrap: {str(e)}")

if __name__ == "__main__":
    bootstrap()
