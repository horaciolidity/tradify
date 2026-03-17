export interface TickerData {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

const INITIAL_PRICES: Record<string, number> = {
  'BTC/USDC': 64230.50,
  'ETH/USDC': 3450.25,
  'SOL/USDC': 145.80,
  'BNB/USDC': 580.10,
  'ADA/USDC': 0.45,
  'DOT/USDC': 7.20,
  'MATIC/USDC': 0.68,
  'LINK/USDC': 18.50,
  'AVAX/USDC': 35.20,
  'DOGE/USDC': 0.16,
};

export class MarketService {
  private static subscribers: Set<(data: TickerData[]) => void> = new Set();
  private static prices: Record<string, number> = { ...INITIAL_PRICES };
  private static interval: any = null;

  static startSimulation() {
    if (this.interval) return;
    
    this.interval = setInterval(() => {
      const data: TickerData[] = Object.keys(this.prices).map(symbol => {
        const currentPrice = this.prices[symbol];
        const changePercent = (Math.random() - 0.5) * 0.002; // max 0.1% change
        const newPrice = currentPrice * (1 + changePercent);
        this.prices[symbol] = newPrice;

        return {
          symbol,
          price: newPrice,
          change: changePercent * 100,
          high: newPrice * (1 + Math.random() * 0.01),
          low: newPrice * (1 - Math.random() * 0.01),
          volume: Math.random() * 1000000,
        };
      });

      this.subscribers.forEach(cb => cb(data));
    }, 2000);
  }

  static subscribe(cb: (data: TickerData[]) => void) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  static getHistory(symbol: string, timeframe: string) {
    // Generate mock OHLC data
    const data = [];
    let basePrice = this.prices[symbol] || 50000;
    const now = Math.floor(Date.now() / 1000);
    const intervals: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400,
    };
    
    const step = intervals[timeframe] || 60;
    
    for (let i = 200; i >= 0; i--) {
      const open = basePrice;
      const close = open * (1 + (Math.random() - 0.5) * 0.01);
      const high = Math.max(open, close) * (1 + Math.random() * 0.005);
      const low = Math.min(open, close) * (1 - Math.random() * 0.005);
      
      data.push({
        time: now - (i * step),
        open,
        high,
        low,
        close,
        volume: Math.random() * 100
      });
      
      basePrice = close;
    }
    
    return data;
  }
}
