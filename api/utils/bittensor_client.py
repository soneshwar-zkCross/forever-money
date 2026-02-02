"""
Bittensor Client Utility

Singleton for managing Bittensor connections and metagraph access.
"""
import logging
import bittensor as bt
from typing import Optional

logger = logging.getLogger(__name__)

# Default values
DEFAULT_NETUID = 98
DEFAULT_NETWORK = "finney"


class BittensorClient:
    """Singleton client for Bittensor metagraph access."""

    _subtensor: Optional[bt.Subtensor] = None
    _metagraph: Optional[bt.Metagraph] = None
    _netuid: int = DEFAULT_NETUID
    _network: str = DEFAULT_NETWORK

    @classmethod
    def initialize(cls, netuid: int = DEFAULT_NETUID, network: str = DEFAULT_NETWORK):
        """
        Initialize the Bittensor client with specified network settings.

        Args:
            netuid: Subnet UID (default: 98)
            network: Network name (default: "finney")
        """
        cls._netuid = netuid
        cls._network = network
        logger.info(f"Initializing BittensorClient for netuid={netuid}, network={network}")

    @classmethod
    def get_subtensor(cls) -> bt.Subtensor:
        """
        Get or create Subtensor instance.

        Returns:
            Bittensor Subtensor instance
        """
        if cls._subtensor is None:
            logger.info(f"Creating Subtensor instance for network={cls._network}")
            cls._subtensor = bt.Subtensor(network=cls._network)
        return cls._subtensor

    @classmethod
    def get_metagraph(cls, refresh: bool = False) -> bt.Metagraph:
        """
        Get or create Metagraph instance.

        Args:
            refresh: If True, force refresh the metagraph from chain

        Returns:
            Bittensor Metagraph instance
        """
        if cls._metagraph is None or refresh:
            logger.info(f"Creating/refreshing Metagraph for netuid={cls._netuid}")
            subtensor = cls.get_subtensor()
            cls._metagraph = subtensor.metagraph(cls._netuid)
            logger.info(f"Metagraph loaded: {len(cls._metagraph.uids)} UIDs")
        return cls._metagraph

    @classmethod
    def get_netuid(cls) -> int:
        """Get the configured netuid."""
        return cls._netuid

    @classmethod
    def reset(cls):
        """Reset the singleton (useful for testing)."""
        cls._subtensor = None
        cls._metagraph = None
        logger.info("BittensorClient reset")
