"""
Admin wallet whitelist management
"""
import json
import os
from datetime import datetime
from typing import List, Optional, Dict
from pathlib import Path


class AdminWalletManager:
    """Manages admin wallet whitelist"""
    
    def __init__(self, wallets_file: str = "api/config/admin_wallets.json"):
        self.wallets_file = wallets_file
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """Create admin wallets file if it doesn't exist"""
        path = Path(self.wallets_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        if not path.exists():
            # Create default structure
            default_data = {
                "admins": [],
                "version": "1.0.0",
                "last_updated": datetime.utcnow().isoformat()
            }
            with open(self.wallets_file, 'w') as f:
                json.dump(default_data, f, indent=2)
    
    def load_wallets(self) -> dict:
        """Load admin wallets from file"""
        try:
            with open(self.wallets_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading admin wallets: {e}")
            return {"admins": [], "version": "1.0.0", "last_updated": datetime.utcnow().isoformat()}
    
    def save_wallets(self, data: dict):
        """Save admin wallets to file"""
        data["last_updated"] = datetime.utcnow().isoformat()
        with open(self.wallets_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def _normalize_address(self, address: str) -> str:
        """Normalize address for comparison (lowercase if EVM/0x)"""
        if address and address.startswith("0x"):
            return address.lower()
        return address

    def is_admin(self, wallet_address: str) -> bool:
        """Check if wallet is in admin list"""
        data = self.load_wallets()
        normalized_input = self._normalize_address(wallet_address)
        
        return any(
            self._normalize_address(admin["wallet_address"]) == normalized_input
            for admin in data.get("admins", [])
        )
    
    def get_admin(self, wallet_address: str) -> Optional[dict]:
        """Get admin wallet details"""
        data = self.load_wallets()
        normalized_input = self._normalize_address(wallet_address)
        
        for admin in data.get("admins", []):
            if self._normalize_address(admin["wallet_address"]) == normalized_input:
                return admin
        return None
    
    def get_all_admins(self) -> List[dict]:
        """Get all admin wallets"""
        data = self.load_wallets()
        return data.get("admins", [])
    
    def add_admin(
        self,
        wallet_address: str,
        name: str,
        added_by: str,
        permissions: List[str] = None
    ) -> dict:
        """
        Add new admin wallet
        
        Args:
            wallet_address: Wallet address to add
            name: Display name
            added_by: Wallet address of admin who added this
            permissions: List of permissions
            
        Returns:
            Added admin data
        """
        if permissions is None:
            permissions = ["read", "write"]
        
        data = self.load_wallets()
        
        # Check if already exists
        if self.is_admin(wallet_address):
            raise ValueError("Wallet already exists in admin list")
        
        new_admin = {
            "wallet_address": wallet_address,
            "name": name,
            "added_by": added_by,
            "added_at": datetime.utcnow().isoformat(),
            "permissions": permissions
        }
        
        data["admins"].append(new_admin)
        self.save_wallets(data)
        
        return new_admin
    
    def remove_admin(self, wallet_address: str) -> bool:
        """
        Remove admin wallet
        
        Args:
            wallet_address: Wallet to remove
            
        Returns:
            True if removed, False if not found
        """
        data = self.load_wallets()
        original_count = len(data["admins"])
        
        data["admins"] = [
            admin for admin in data["admins"]
            if admin["wallet_address"] != wallet_address
        ]
        
        if len(data["admins"]) < original_count:
            self.save_wallets(data)
            return True
        
        return False
    
    def has_permission(self, wallet_address: str, permission: str) -> bool:
        """Check if admin has specific permission"""
        admin = self.get_admin(wallet_address)
        if not admin:
            return False
        
        return permission in admin.get("permissions", [])
    
    def update_permissions(
        self,
        wallet_address: str,
        permissions: List[str]
    ) -> bool:
        """Update admin permissions"""
        data = self.load_wallets()
        
        for admin in data["admins"]:
            if admin["wallet_address"] == wallet_address:
                admin["permissions"] = permissions
                self.save_wallets(data)
                return True
        
        return False


# Global instance
admin_manager = AdminWalletManager()
