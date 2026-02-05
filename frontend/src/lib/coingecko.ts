// CoinGecko API integration for price data
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Token ID mappings for CoinGecko
export const COINGECKO_TOKEN_IDS: Record<string, string> = {
    // Ethereum Mainnet
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'ethereum',
    '0x0000000000000000000000000000000000000000': 'ethereum', // Native ETH

    // Stablecoins (Ethereum & Base)
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'usd-coin', // USDC Ethereum
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': 'usd-coin', // USDC Base
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'tether',
    '0x6B175474E89094C44Da98b954EedeAC495271d0F': 'dai',

    // Base Network Tokens
    '0xb99fbe68c8a0cc14be8c1af73dd4dfea8a76add7': 'bittensor', // xTAO on Base (tracks TAO price)
    '0x4200000000000000000000000000000000000006': 'ethereum', // WETH on Base
    '0x9401518f4C1636846940e793e19736E51bbE88Cd': 'aerodrome-finance', // AERO

    // Other popular tokens
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'wrapped-bitcoin',
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': 'chainlink',
    '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': 'uniswap',

    // Add more as needed
};

export interface OHLCDataPoint {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface CoinGeckoMarketData {
    current_price: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    high_24h: number;
    low_24h: number;
    total_volume: number;
}

/**
 * Get CoinGecko token ID from token address
 */
export function getCoingeckoId(tokenAddress: string): string | null {
    const normalizedAddress = tokenAddress.toLowerCase();
    return COINGECKO_TOKEN_IDS[normalizedAddress] || null;
}

/**
 * Fetch OHLC data for a token pair
 * @param token0Id - CoinGecko ID for token0 (e.g., 'ethereum')
 * @param token1Id - CoinGecko ID for token1 (e.g., 'usd-coin')
 * @param days - Number of days of data (1, 7, 14, 30, 90, 180, 365)
 * @returns Price of token0 in terms of token1
 */
export async function fetchOHLCData(
    tokenId: string,
    vsCurrency: string = 'usd',
    days: number = 1
): Promise<OHLCDataPoint[]> {
    try {
        const response = await fetch(
            `${COINGECKO_API_BASE}/coins/${tokenId}/ohlc?vs_currency=${vsCurrency}&days=${days}`,
            { next: { revalidate: 300 } }
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: number[][] = await response.json();

        // Transform OHLC data
        // Data format: [timestamp, open, high, low, close]
        return data.map(([timestamp, open, high, low, close]) => ({
            timestamp,
            open,
            high,
            low,
            close,
        }));
    } catch (error) {
        console.error('Error fetching OHLC data:', error);
        return [];
    }
}

/**
 * Fetch current market data for a token
 */
export async function fetchMarketData(tokenId: string): Promise<CoinGeckoMarketData | null> {
    try {
        const response = await fetch(
            `${COINGECKO_API_BASE}/coins/${tokenId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
            { next: { revalidate: 60 } } // Cache for 1 minute
        );

        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const marketData = data.market_data;

        return {
            current_price: marketData.current_price.usd,
            price_change_24h: marketData.price_change_24h,
            price_change_percentage_24h: marketData.price_change_percentage_24h,
            high_24h: marketData.high_24h.usd,
            low_24h: marketData.low_24h.usd,
            total_volume: marketData.total_volume.usd,
        };
    } catch (error) {
        console.error('Error fetching market data:', error);
        return null;
    }
}

/**
 * Parse pool pair address to get token addresses
 * This is a placeholder - you'll need to implement based on your pool structure
 */
export function parsePoolTokens(pairAddress: string): { token0: string; token1: string } | null {
    // TODO: Implement based on your pool contract structure
    // For now, return common pairs
    const commonPairs: Record<string, { token0: string; token1: string }> = {
        // ETH/USDC
        '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640': {
            token0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
            token1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        },
        // Add more pairs as needed
    };

    return commonPairs[pairAddress] || null;
}
