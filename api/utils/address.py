"""
Address normalization utilities.

The reader DB stores evt_address WITHOUT the 0x prefix (lowercase).
The validator Job model stores pair_address WITH the 0x prefix.
This module bridges the gap.
"""


def normalize_evt_address(addr: str) -> str:
    """
    Normalize an address for querying evt_address columns in the reader DB.

    Strips the '0x' prefix and lowercases, matching the format used in
    the swaps/mints/burns/collects tables.
    """
    return (addr or "").strip().lower().removeprefix("0x")
