import { supabase } from './supabase';

export interface TickerData {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
  type?: 'real' | 'custom';
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 
  'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOGEUSDT',
  'XRPUSDT', 'LTCUSDT', 'SHIBUSDT', 'TRXUSDT', 'UNIUSDT',
  'NEARUSDT', 'ATOMUSDT', 'BCHUSDT', 'ETCUSDT', 'PEPEUSDT'
];

export class MarketService {
  private static subscribers: Set<(data: TickerData[]) => void> = new Set();
  private static interval: any = null;
  private static lastData: TickerData[] = [];
  private static customTrackers: Map<string, any> = new Map();

  static async startSimulation() {
    if (this.interval) return;

    const fetchData = async () => {
      try {
        // 1. Fetch Real Market Data
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        const allTickers = await response.json();
        
        const realFiltered = allTickers
          .filter((t: any) => SYMBOLS.includes(t.symbol))
          .map((t: any) => ({
            symbol: t.symbol.replace('USDT', '/USDC'),
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
            volume: parseFloat(t.volume) * parseFloat(t.lastPrice),
            type: 'real'
          }));

        // 2. Fetch Custom Tokens From Supabase
        const { data: customTokens } = await supabase
          .from('custom_tokens')
          .select('*')
          .eq('is_listed', true)
          .eq('token_type', 'custom');

        const simulatedCustom = (customTokens || []).map(token => {
          // Internal simulation logic
          const tracker = this.customTrackers.get(token.symbol) || {
            price: parseFloat(token.current_price),
            high: parseFloat(token.current_price),
            low: parseFloat(token.current_price),
            vol: token.volatility || 0.05
          };

          // Apply move
          let move = (Math.random() - 0.5) * tracker.vol;
          
          if (token.simulation_type === 'pump') move = Math.abs(move) * 1.5;
          if (token.simulation_type === 'dump') move = -Math.abs(move) * 1.5;
          if (token.trend_direction === 'up') move += 0.001;
          if (token.trend_direction === 'down') move -= 0.001;

          tracker.price *= (1 + move);
          if (tracker.price > tracker.high) tracker.high = tracker.price;
          if (tracker.price < tracker.low) tracker.low = tracker.price;

          this.customTrackers.set(token.symbol, tracker);

          return {
            symbol: `${token.symbol}/USDC`,
            price: tracker.price,
            change: ((tracker.price / parseFloat(token.current_price)) - 1) * 100,
            high: tracker.high,
            low: tracker.low,
            volume: parseFloat(token.liquidity || '0'),
            type: 'custom'
          };
        });

        const merged = [...realFiltered, ...simulatedCustom];
        this.lastData = merged;
        this.subscribers.forEach(cb => cb(merged));
      } catch (error) {
        console.error('Error fetching market data:', error);
      }
    };

    fetchData();
    this.interval = setInterval(fetchData, 2000); 
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
    const isCustom = !SYMBOLS.some(s => symbol.replace('/USDC', '').replace('/', '') === s.replace('USDT', ''));
    
    if (isCustom) {
      const { data: token } = await supabase
        .from('custom_tokens')
        .select('current_price, volatility')
        .eq('symbol', symbol.replace('/USDC', ''))
        .single();
      
      return this.generateSimulatedHistory(symbol, parseFloat(token?.current_price || '100'), token?.volatility || 0.05);
    }

    const binanceSymbol = symbol.replace('/USDC', 'USDT');
    // ... (rest of binance logic)
    const intervalMap: Record<string, string> = {
      '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h', '1d': '1d',
    };

    const interval = intervalMap[timeframe] || '15m';
    
    try {
      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=500`);
      const klines = await response.json();
      
      if (!Array.isArray(klines)) throw new Error('Invalid klines format');

      return klines.map((k: any) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
    } catch (error) {
      return this.generateSimulatedHistory(symbol);
    }
  }

  private static generateSimulatedHistory(symbol: string, startPrice: number = 100, vol: number = 0.05) {
    const data = [];
    let price = startPrice;
    const now = Math.floor(Date.now() / 1000);
    
    for (let i = 0; i < 300; i++) {
      const open = price;
      const move = (Math.random() - 0.5) * (vol * (price / 10)); // Scaled movement
      const close = open + move;
      const high = Math.max(open, close) + (Math.random() * (vol * price / 15));
      const low = Math.min(open, close) - (Math.random() * (vol * price / 15));
      
      data.push({
        time: now - (300 - i) * 300, // 5 min intervals roughly
        open, high, low, close
      });
      price = close;
    }
    return data;
  }
}
