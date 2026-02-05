/**
 * Utility for interacting with EVM browser extensions (MetaMask, Coinbase Wallet, etc.)
 */
export class EvmWallet {
    /**
     * Detects if an EVM wallet (like MetaMask) is installed
     */
    static isAvailable(): boolean {
        return typeof window !== 'undefined' && !!(window as any).ethereum;
    }

    /**
     * Connects to the EVM wallet and returns the active account
     */
    static async connect(): Promise<string[]> {
        if (!this.isAvailable()) return [];

        try {
            const accounts = await (window as any).ethereum.request({
                method: 'eth_requestAccounts'
            });
            return accounts;
        } catch (error) {
            console.error('MetaMask connection error:', error);
            return [];
        }
    }

    /**
     * Signs a message using the active EVM account
     * @param address Ethereum address
     * @param message Message to sign
     */
    static async signMessage(address: string, message: string): Promise<string> {
        if (!this.isAvailable()) throw new Error('EVM Wallet not found');

        try {
            const signature = await (window as any).ethereum.request({
                method: 'personal_sign',
                params: [message, address],
            });
            return signature;
        } catch (error) {
            console.error('MetaMask signing error:', error);
            throw error;
        }
    }
}
