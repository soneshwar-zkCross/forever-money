/**
 * Utility for interacting with Substrate browser extensions (Polkadot{.js}, Talisman, etc.)
 */
export class SubstrateWallet {
  private static APP_NAME = 'SN98 Admin Panel';

  /**
   * Initializes connections to available extensions
   * @returns List of available accounts
   */
  static async connect(): Promise<any[]> {
    if (typeof window === 'undefined') return [];

    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');

    // Enable extension
    const extensions = await web3Enable(this.APP_NAME);
    if (extensions.length === 0) {
      console.warn('No Substrate extensions detected');
      return [];
    }

    // Get all accounts
    const allAccounts = await web3Accounts();
    return allAccounts;
  }

  /**
   * Signs a message using a specific account via its connected extension
   * @param address SS58 or EVM address of the account
   * @param message Message string to sign
   * @returns Signature as hex string
   */
  static async signMessage(address: string, message: string): Promise<string> {
    // Check if this is an EVM address - if so, use Ethereum provider directly
    // The Polkadot extension's signRaw creates Substrate signatures (sr25519/ed25519)
    // which cannot be verified using EVM signature verification (ECDSA)
    if (address.startsWith('0x') && address.length === 42) {
      console.log('EVM address detected, using Ethereum provider for ECDSA signature');
      return this.signMessageEVM(address, message);
    }

    // Substrate signing for non-EVM addresses
    const { web3Accounts, web3FromSource } = await import('@polkadot/extension-dapp');

    const allAccounts = await web3Accounts();
    const account = allAccounts.find(acc => acc.address === address);

    if (!account) {
      throw new Error(`Account ${address} not found in connected extensions`);
    }

    // Get the injector for the account source
    const injector = await web3FromSource(account.meta.source);

    const signRaw = injector?.signer?.signRaw;

    if (!signRaw) {
      throw new Error('Signer does not support raw signing');
    }

    const { signature } = await signRaw({
      address: account.address,
      data: message,
      type: 'bytes'
    });

    return signature;
  }

  /**
   * Signs a message using EVM (Ethereum) wallet
   * @param address EVM address
   * @param message Message string to sign
   * @returns Signature as hex string
   */
  private static async signMessageEVM(address: string, message: string): Promise<string> {
    // Check if Talisman ethereum provider is available
    if (typeof window === 'undefined') {
      throw new Error('Window object not available');
    }

    // Try Talisman-specific provider first, then fallback to generic ethereum
    const windowAny = window as any;
    const ethereum = windowAny.talismanEth || windowAny.ethereum;

    if (!ethereum) {
      throw new Error('No Ethereum provider found. Please install Talisman or MetaMask.');
    }

    try {
      console.log('Requesting EVM account access...');

      // First, request account access
      let accounts;
      try {
        accounts = await ethereum.request({
          method: 'eth_requestAccounts'
        });
      } catch (accessError: any) {
        console.error('Failed to request EVM accounts:', accessError);
        throw new Error(
          'Could not access EVM accounts. Please:\n' +
          '1. Open Talisman wallet\n' +
          '2. Enable your EVM account for this site\n' +
          '3. Try again'
        );
      }

      console.log('Connected EVM accounts:', accounts);

      // Check if the requested address is in the connected accounts
      const normalizedAddress = address.toLowerCase();
      const hasAccount = accounts.some((acc: string) => acc.toLowerCase() === normalizedAddress);

      if (!hasAccount) {
        throw new Error(
          `Account ${address} not found in connected EVM accounts.\n\n` +
          'Please connect this EVM account in Talisman:\n' +
          '1. Open Talisman\n' +
          '2. Switch to Ethereum network\n' +
          '3. Enable this account for the site'
        );
      }

      console.log('Requesting signature for address:', address);

      // Use personal_sign for EVM signing (standard for wallet authentication)
      // Message should be plain text - the wallet will handle encoding
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      });

      console.log('Signature received:', signature);

      return signature;
    } catch (error: any) {
      console.error('EVM signing error:', error);
      if (error.code === 4001) {
        throw new Error('User rejected the signature request');
      }
      // If error already has our custom message, rethrow it
      if (error.message && error.message.includes('Please')) {
        throw error;
      }
      throw new Error(`Failed to sign message: ${error.message || error}`);
    }
  }

  /**
   * Formats the challenge message for signing
   */
  static formatChallengeMessage(challenge: string, timestamp: string): string {
    return `Sign this message to authenticate to SN98 Admin Panel:\n\n${challenge}\n\nTimestamp: ${timestamp}`;
  }
}
