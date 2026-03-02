"""
Identity Service

Resolves on-chain miner identities from Bittensor delegate registry.
"""
import asyncio
import logging
import time
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Cache TTL in seconds
CACHE_TTL = 300  # 5 minutes


class IdentityService:
    """Resolves on-chain identity names for miners via Bittensor subtensor."""

    _cache: Optional[Dict[int, Dict[str, str]]] = None
    _cache_timestamp: float = 0

    @classmethod
    def _is_cache_valid(cls) -> bool:
        return cls._cache is not None and (time.time() - cls._cache_timestamp) < CACHE_TTL

    @classmethod
    def _fetch_identities_sync(cls) -> Dict[int, Dict[str, str]]:
        """Blocking call to resolve identities — run via asyncio.to_thread()."""
        from api.utils.bittensor_client import BittensorClient

        subtensor = BittensorClient.get_subtensor()
        metagraph = BittensorClient.get_metagraph()

        # get_delegate_identities returns dict[coldkey_ss58, ChainIdentity]
        delegate_identities = subtensor.get_delegate_identities()

        # Build coldkey → UID mapping from metagraph
        coldkey_to_uid: Dict[str, int] = {}
        for uid, coldkey in enumerate(metagraph.coldkeys):
            coldkey_to_uid[coldkey] = uid

        result: Dict[int, Dict[str, str]] = {}
        for coldkey_ss58, identity in delegate_identities.items():
            uid = coldkey_to_uid.get(coldkey_ss58)
            if uid is None:
                continue

            info: Dict[str, str] = {}
            name = getattr(identity, "name", None) or getattr(identity, "display", None)
            if name:
                info["name"] = str(name)
            for field in ("url", "github", "discord"):
                val = getattr(identity, field, None)
                if val:
                    info[field] = str(val)

            if info:
                result[uid] = info

        return result

    @classmethod
    async def get_all_identities(cls) -> Dict[int, Dict[str, str]]:
        """Return uid → identity info dict, using a 5-min cached value when possible."""
        if cls._is_cache_valid():
            return cls._cache  # type: ignore[return-value]

        try:
            identities = await asyncio.to_thread(cls._fetch_identities_sync)
            cls._cache = identities
            cls._cache_timestamp = time.time()
            logger.info(f"IdentityService: resolved {len(identities)} on-chain identities")
            return identities
        except Exception as e:
            logger.warning(f"IdentityService: RPC failed ({e}), falling back to stale cache")
            if cls._cache is not None:
                return cls._cache
            return {}

    @classmethod
    def get_name_for_uid(cls, uid: int, identities: Dict[int, Dict[str, str]]) -> Optional[str]:
        """Extract miner name for a given UID from the identities dict."""
        info = identities.get(uid)
        if info:
            return info.get("name")
        return None
