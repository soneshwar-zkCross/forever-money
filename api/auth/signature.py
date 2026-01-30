import bittensor as bt
from eth_account.messages import encode_defunct
from eth_account import Account


def verify_signature(
    wallet_address: str,
    message: str,
    signature: str
) -> bool:
    """
    Verify Bittensor wallet signature
    
    Args:
        wallet_address: SS58 wallet address
        message: Original message that was signed
        signature: Signature to verify
        
    Returns:
        True if signature is valid, False otherwise
    """
    try:
        # Create keypair from address
        keypair = bt.Keypair(ss58_address=wallet_address)
        
        # Standardize signature: ensure hex string starts with 0x
        # bittensor's keypair.verify expects bytes or a 0x-prefixed hex string
        if isinstance(signature, str) and not signature.startswith("0x"):
            signature = f"0x{signature}"
            
        # Verify signature
        is_valid = keypair.verify(message, signature)
        
        return is_valid
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False


def verify_evm_signature(
    wallet_address: str,
    message: str,
    signature: str
) -> bool:
    """
    Verify EVM (Ethereum) signature
    
    Args:
        wallet_address: 0x... Ethereum address
        message: Original message string
        signature: 0x... Signature string
        
    Returns:
        True if valid
    """
    try:
        # Standard EVM message formatting
        msg = encode_defunct(text=message)
        # Recover address from signature
        recovered_address = Account.recover_message(msg, signature=signature)
        return recovered_address.lower() == wallet_address.lower()
    except Exception as e:
        print(f"EVM Signature verification error: {e}")
        return False


def verify_any_signature(
    wallet_address: str,
    message: str,
    signature: str
) -> bool:
    """
    Detects wallet type (EVM or Substrate) and verifies signature
    """
    if wallet_address.startswith("0x"):
        return verify_evm_signature(wallet_address, message, signature)
    else:
        return verify_signature(wallet_address, message, signature)


def verify_challenge_signature(
    wallet_address: str,
    challenge: str,
    signature: str
) -> bool:
    """
    Verify signature for authentication challenge
    
    Args:
        wallet_address: Wallet address that signed
        challenge: Challenge string
        signature: Signature to verify
        
    Returns:
        True if valid
    """
    # Standard challenge message format
    message = f"Sign this message to authenticate to SN98 Admin Panel:\n\n{challenge}\n\nTimestamp: {challenge.split('-')[2]}"
    
    return verify_any_signature(wallet_address, message, signature)


def sign_message(wallet: bt.Wallet, message: str) -> str:
    """
    Sign a message with Bittensor wallet
    
    Args:
        wallet: Bittensor wallet instance
        message: Message to sign
        
    Returns:
        Signature string
    """
    try:
        signature = wallet.hotkey.sign(message)
        return signature.hex()
    except Exception as e:
        print(f"Error signing message: {e}")
        raise
