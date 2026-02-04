"""
Price Service

Fetches token prices from CoinGecko API with caching.
"""
import asyncio
import aiohttp
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


# Token address to CoinGecko ID mapping
TOKEN_COINGECKO_IDS = {
    # Ethereum Mainnet
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".lower(): "weth",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48".lower(): "usd-coin",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7".lower(): "tether",
    "0x6B175474E89094C44Da98b954EedeAC495271d0F".lower(): "dai",
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599".lower(): "wrapped-bitcoin",
    
    # Base Chain (if needed)
    "0x4200000000000000000000000000000000000006".lower(): "weth",  # WETH on Base
    
    # Test tokens (fallback to $1.00)
    "test_token0": "usd-coin",
    "test_token1": "tether",
}


class PriceService:
    """Service for fetching token prices"""
    
    _cache: Dict[str, tuple[float, datetime]] = {}
    CACHE_TTL = timedelta(minutes=5)  # Cache prices for 5 minutes
    COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price"
    
    @classmethod
    async def get_token_price(cls, token_address: str) -> float:
        """
        Get USD price for a token address.
        
        Args:
            token_address: Token contract address
            
        Returns:
            Price in USD (float)
        """
        # Normalize address
        normalized_address = token_address.lower().strip()
        
        # Check cache
        if normalized_address in cls._cache:
            price, timestamp = cls._cache[normalized_address]
            if datetime.utcnow() - timestamp < cls.CACHE_TTL:
                logger.debug(f"Using cached price for {token_address}: ${price}")
                return price
        
        # Get CoinGecko ID
        coingecko_id = TOKEN_COINGECKO_IDS.get(normalized_address)
        
        if not coingecko_id:
            logger.warning(
                f"Unknown token {token_address}, using fallback price $1.00. "
                f"Add to TOKEN_COINGECKO_IDS if this is a real token."
            )
            return 1.0
        
        # Fetch from CoinGecko
        try:
            price = await cls._fetch_from_coingecko(coingecko_id)
            
            # Cache the result
            cls._cache[normalized_address] = (price, datetime.utcnow())
            
            return price
            
        except Exception as e:
            logger.error(f"Failed to fetch price for {coingecko_id}: {e}")
            # Return fallback price
            return 1.0
    
    @classmethod
    async def _fetch_from_coingecko(cls, coingecko_id: str) -> float:
        """
        Fetch price from CoinGecko API.
        
        Args:
            coingecko_id: CoinGecko token ID
            
        Returns:
            Price in USD
        """
        params = {
            "ids": coingecko_id,
            "vs_currencies": "usd"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(cls.COINGECKO_API, params=params, timeout=10) as response:
                if response.status != 200:
                    raise Exception(f"CoinGecko API returned status {response.status}")
                
                data = await response.json()
                
                if coingecko_id not in data:
                    raise Exception(f"CoinGecko ID {coingecko_id} not found in response")
                
                if "usd" not in data[coingecko_id]:
                    raise Exception(f"USD price not available for {coingecko_id}")
                
                price = float(data[coingecko_id]["usd"])
                logger.info(f"Fetched price for {coingecko_id}: ${price}")
                
                return price
    
    @classmethod
    async def get_multiple_prices(cls, token_addresses: list[str]) -> Dict[str, float]:
        """
        Get prices for multiple tokens.
        
        Args:
            token_addresses: List of token addresses
            
        Returns:
            Dictionary mapping address -> price
        """
        prices = {}
        
        # Fetch prices concurrently
        tasks = [cls.get_token_price(addr) for addr in token_addresses]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for addr, result in zip(token_addresses, results):
            if isinstance(result, Exception):
                logger.error(f"Error fetching price for {addr}: {result}")
                prices[addr] = 1.0  # Fallback
            else:
                prices[addr] = result
        
        return prices
    
    @classmethod
    def clear_cache(cls):
        """Clear the price cache"""
        cls._cache.clear()
        logger.info("Price cache cleared")
