export function formatUsd(value: number | undefined | null): string {
    if (value === undefined || value === null) return '$0';
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
    return `$${value.toFixed(2)}`;
}

export function formatFeeRate(rate: number | undefined | null): string {
    if (!rate) return '0%';
    // Uniswap raw format: 3000 = 0.3%, 500 = 0.05%, 10000 = 1%
    if (rate >= 100) return `${(rate / 10000).toFixed(2)}%`;
    // Already decimal: 0.003 = 0.3%
    return `${(rate * 100).toFixed(2)}%`;
}

export function formatTokenAmount(value: number | undefined | null, symbol: string): string {
    if (value === undefined || value === null || value === 0) return `0 ${symbol}`;
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M ${symbol}`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k ${symbol}`;
    if (Math.abs(value) < 0.01) return `${value.toFixed(6)} ${symbol}`;
    return `${value.toFixed(2)} ${symbol}`;
}
