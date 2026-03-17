export interface TickerData {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 
  'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOGEUSDT',
  'XRPUSDT', 'LTCUSDT', 'SHIBUSDT', 'TRXUSDT', 'UNIUSDT'
];

export class MarketService {
  private static subscribers: Set<(data: TickerData[]) => void> = new Set();
  private static interval: any = null;
  private static lastData: TickerData[] = [];

  static async startSimulation() {
    if (this.interval) return;

    const fetchData = async () => {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const allTickers = await response.json();
        
        const filtered = allTickers
          .filter((t: any) => SYMBOLS.includes(t.symbol))
          .map((t: any) => ({
            symbol: t.symbol.replace('USDT', '/USDC'),
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
            volume: parseFloat(t.volume) * parseFloat(t.lastPrice)
          }));

        this.lastData = filtered;
        this.subscribers.forEach(cb => cb(filtered));
      } catch (error) {
        console.error('Error fetching real market data:', error);
      }
    };

    fetchData();
    this.interval = setInterval(fetchData, 5000); // Update every 5 seconds
  }

  static stopSimulation() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  static subscribe(cb: (data: TickerData[]) => void) {
    this.subscribers.add(cb);
    if (this.lastData.length > 0) cb(this.lastData);
    return () => this.subscribers.delete(cb);
  }

  static async getHistory(symbol: string, timeframe: string) {
    const binanceSymbol = symbol.replace('/USDC', 'USDT');
    const intervalMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
    };

    const interval = intervalMap[timeframe] || '15m';
    
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=500`);
      const klines = await response.json();
      
      return klines.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  }
}
