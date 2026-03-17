import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, Maximize2, Settings } from 'lucide-react';
import { motion } from 'framer-motion';

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

const TradingDashboard: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDC');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [currentTicker, setCurrentTicker] = useState<TickerData | null>(null);

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    const loadData = async () => {
      const data = await MarketService.getHistory(selectedSymbol, selectedTimeframe);
      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.setData(data as any);
      }
    };

    loadData();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [selectedSymbol, selectedTimeframe]);

  // Subscribe to Tickers
  useEffect(() => {
    MarketService.startSimulation();
    const unsubscribe = MarketService.subscribe((data) => {
      setTickers(data);
      const active = data.find(t => t.symbol === selectedSymbol);
      if (active) setCurrentTicker(active);
    });
    return () => { unsubscribe(); };
  }, [selectedSymbol]);

  return (
    <div className="space-y-6">
      {/* Asset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
              {selectedSymbol.split('/')[0].charAt(0)}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-white">{selectedSymbol}</h1>
              <span className="text-sm font-medium px-2 py-0.5 bg-accent/20 text-accent rounded-full">Crypto</span>
            </div>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-xl font-mono font-semibold text-slate-300">
                ${currentTicker?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`text-sm font-medium flex items-center ${currentTicker && currentTicker.change >= 0 ? 'text-accent' : 'text-rose-500'}`}>
                {currentTicker && currentTicker.change >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                {currentTicker?.change.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-xl border border-white/10">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTimeframe === tf ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-3 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 h-[600px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-xs text-slate-500 font-medium space-x-1">
                  <Clock size={14} />
                  <span>Real-time</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center space-x-4 text-xs">
                  <span className="text-slate-500">H: <span className="text-white">${currentTicker?.high.toLocaleString()}</span></span>
                  <span className="text-slate-500">L: <span className="text-white">${currentTicker?.low.toLocaleString()}</span></span>
                  <span className="text-slate-500">V: <span className="text-white">{(currentTicker?.volume || 0 / 1e6).toFixed(2)}M</span></span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><Settings size={18} /></button>
                <button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><Maximize2 size={18} /></button>
              </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Market Cap', value: '$1.2T', change: '+2.4%' },
              { label: '24h Volume', value: '$84.2B', change: '-1.2%' },
              { label: 'Circulating Supply', value: '19.6M BTC', change: '' },
              { label: 'All Time High', value: '$73,737', change: '-14.2%' },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-4"
              >
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <div className="flex items-end justify-between mt-2">
                  <span className="text-lg font-bold text-white">{stat.value}</span>
                  {stat.change && (
                    <span className={`text-xs font-medium ${stat.change.startsWith('+') ? 'text-accent' : 'text-rose-500'}`}>
                      {stat.change}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          {/* Order Book / Trading Widget */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-5 border-b border-white/5">
              <h3 className="font-bold text-lg">Spot Trading</h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex bg-white/5 p-1 rounded-xl">
                <button className="flex-1 py-2 text-sm font-bold bg-accent text-white rounded-lg shadow-lg shadow-accent/20">Buy</button>
                <button className="flex-1 py-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">Sell</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase mb-1.5 block">Amount (USDC)</label>
                  <div className="relative">
                    <input type="number" className="input-field w-full pr-12" placeholder="0.00" />
                    <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-500">USDC</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase mb-1.5 block">Amount ({selectedSymbol.split('/')[0]})</label>
                  <div className="relative">
                    <input type="number" className="input-field w-full pr-12" placeholder="0.00" />
                    <span className="absolute right-4 top-2.5 text-xs font-bold text-slate-500">{selectedSymbol.split('/')[0]}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-500">Transaction Fee</span>
                  <span className="text-white">0.1 USDC</span>
                </div>

                <button className="w-full primary-button py-3 text-sm font-bold mt-2">
                  Place Order
                </button>
              </div>
            </div>
          </motion.div>

          {/* Markets List */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold">Markets</h3>
              <button className="text-xs font-bold text-primary hover:text-primary-dark">View All</button>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {tickers.map((ticker) => (
                <button
                  key={ticker.symbol}
                  onClick={() => setSelectedSymbol(ticker.symbol)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-none ${selectedSymbol === ticker.symbol ? 'bg-white/5' : ''}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-xs font-bold">
                      {ticker.symbol.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{ticker.symbol}</p>
                      <p className="text-[10px] text-slate-500">Volume: ${(ticker.volume / 1000).toFixed(1)}k</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-white">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className={`text-[10px] font-bold ${ticker.change >= 0 ? 'text-accent' : 'text-rose-500'}`}>
                      {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;
