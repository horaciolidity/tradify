import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, Maximize2, Settings, ShieldCheck, Zap, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TradingChat from '../components/TradingChat';
import AnnouncementCarousel from '../components/AnnouncementCarousel';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

const TradingDashboard: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDC');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { profile, wallet, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [currentTicker, setCurrentTicker] = useState<TickerData | null>(null);
  const [assetBalance, setAssetBalance] = useState(0);
  const symbolOnly = selectedSymbol.split('/')[0];

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 450,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
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

  // Fetch Asset Balance
  useEffect(() => {
    if (profile && selectedSymbol) {
      fetchAssetBalance();
    }
  }, [profile, selectedSymbol]);

  const fetchAssetBalance = async () => {
    const symbolOnly = selectedSymbol.split('/')[0];
    const { data } = await supabase
      .from('user_assets')
      .select('balance')
      .eq('user_id', profile?.id)
      .eq('symbol', symbolOnly)
      .single();
    
    if (data) setAssetBalance(data.balance);
    else setAssetBalance(0);
  };

  const handleTrade = async () => {
    if (!profile || !wallet || !currentTicker || !tradeAmount) return;
    
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0) return;

    setProcessing(true);
    const symbolOnly = selectedSymbol.split('/')[0];

    try {
      if (tradeType === 'buy') {
        const cost = amount; // buying 'amount' of USDC value
        if (cost > wallet.balance_usdc) throw new Error('Insufficient USDC balance');

        const assetReceived = cost / currentTicker.price;

        // 1. Update USDC Balance
        const newUsdcBalance = wallet.balance_usdc - cost;
        await supabase
          .from('wallets')
          .update({ balance_usdc: newUsdcBalance })
          .eq('user_id', profile.id);
        
        setWallet({ ...wallet, balance_usdc: newUsdcBalance });

        // 2. Update Asset Balance
        const { data: existingAsset } = await supabase
          .from('user_assets')
          .select('*')
          .eq('user_id', profile.id)
          .eq('symbol', symbolOnly)
          .single();
        
        if (existingAsset) {
          await supabase
            .from('user_assets')
            .update({ balance: existingAsset.balance + assetReceived })
            .eq('id', existingAsset.id);
        } else {
          await supabase
            .from('user_assets')
            .insert({ user_id: profile.id, symbol: symbolOnly, balance: assetReceived });
        }

        // 4. Send Notification
        await addNotification(
          profile.id,
          'Neural Buy Active',
          `Successfully synchronized ${assetReceived.toFixed(6)} ${symbolOnly} into your neural core.`,
          'success'
        );
      } else {
        // SELL
        const assetToSell = amount / currentTicker.price;
        if (assetToSell > assetBalance) throw new Error(`Insufficient ${symbolOnly} balance`);

        const usdcReceived = amount;

        // 1. Update Asset Balance
        await supabase
          .from('user_assets')
          .update({ balance: assetBalance - assetToSell })
          .eq('user_id', profile.id)
          .eq('symbol', symbolOnly);

        // 2. Update USDC Balance
        const newUsdcBalance = wallet.balance_usdc + usdcReceived;
        await supabase
          .from('wallets')
          .update({ balance_usdc: newUsdcBalance })
          .eq('user_id', profile.id);

        setWallet({ ...wallet, balance_usdc: newUsdcBalance });

        // 3. Log Transaction
        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'profit',
          amount: usdcReceived,
          description: `Sell ${assetToSell.toFixed(6)} ${symbolOnly} @ $${currentTicker.price}`,
          status: 'completed'
        });

        // 4. Send Notification
        await addNotification(
          profile.id,
          'Manual Sale Realized',
          `Successfully realized ${usdcReceived.toFixed(2)} USDC profit from ${symbolOnly} liquidation.`,
          'transaction'
        );
      }
      
      setTradeAmount('');
      fetchAssetBalance();
    } catch (err: any) {
      alert(err.message || 'Node Error: Transmission Interrupted');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Ticker Tape */}
      <div className="ticker-wrap -mx-10 px-10">
        <div className="ticker-content flex space-x-12">
          {tickers.map(t => (
            <div key={t.symbol} className="flex items-center space-x-3 group cursor-pointer hover:bg-white/2 px-4 py-1 rounded-xl transition-all">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.symbol}</span>
              <span className="text-xs font-mono font-bold text-white italic">${t.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className={`text-[10px] font-black ${t.change >= 0 ? 'text-accent' : 'text-error'}`}>
                {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Asset Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-[#17153b]/10 p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
        
        <div className="flex items-center space-x-6 relative z-10">
          <div className="p-4 bg-primary/20 rounded-[2rem] border border-primary/20 shadow-xl shadow-primary/10">
            <div className="w-12 h-12 bg-primary rounded-[1.5rem] flex items-center justify-center text-black font-black text-xl italic shadow-2xl">
              {selectedSymbol.split('/')[0].charAt(0)}
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">{selectedSymbol}</h1>
              <span className="text-[10px] font-black px-4 py-1 bg-primary/10 text-primary rounded-full border border-primary/20 uppercase tracking-[0.2em] italic">Spot Protocol</span>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                <span className="text-3xl font-mono font-black text-white italic tracking-tighter">
                  ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
                <span className={`px-4 py-1.5 rounded-xl text-sm font-black flex items-center italic shadow-lg ${currentTicker && currentTicker.change >= 0 ? 'bg-accent/20 text-accent' : 'bg-error/20 text-error'}`}>
                  {currentTicker && currentTicker.change >= 0 ? <TrendingUp size={16} className="mr-2" /> : <TrendingDown size={16} className="mr-2" />}
                  {(currentTicker?.change ?? 0) >= 0 ? '+' : ''}{currentTicker?.change?.toFixed(2) || '0.00'}%
                </span>
              </div>
              <div className="hidden md:flex items-center space-x-6 border-l border-white/10 pl-6 h-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase italic">Neural Volatility</p>
                  <p className="text-xs font-bold text-white">{(currentTicker?.volume ? currentTicker.volume / 1e6 : 0).toFixed(2)}M USDC</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-white/2 p-2 rounded-2xl border border-white/5 relative z-10 self-end">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all ${selectedTimeframe === tf ? 'bg-primary text-black shadow-xl shadow-primary/30 scale-105' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Chart Area */}
        <div className="lg:col-span-3 space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 h-[650px] flex flex-col group/chart"
          >
            <div className="flex items-center justify-between mb-8 px-2 border-b border-white/5 pb-6">
              <div className="flex items-center space-x-8">
                <div className="flex items-center text-[10px] font-black uppercase italic tracking-widest text-slate-500 space-x-2">
                  <Activity size={14} className="text-primary animate-pulse" />
                  <span>Real-time Stream</span>
                </div>
                <div className="hidden md:flex items-center space-x-8">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase italic">Neural High</span>
                    <span className="text-sm font-mono font-bold text-white">${currentTicker?.high?.toLocaleString() || '0.00'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase italic">Neural Low</span>
                    <span className="text-sm font-mono font-bold text-white">${currentTicker?.low?.toLocaleString() || '0.00'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button className="p-3 bg-white/2 hover:bg-white/5 rounded-xl text-slate-500 transition-all border border-white/5"><Settings size={18} /></button>
                <button className="p-3 bg-white/2 hover:bg-white/5 rounded-xl text-slate-500 transition-all border border-white/5"><Maximize2 size={18} /></button>
              </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          <AnnouncementCarousel />

          {/* Detailed Market Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 border-white/5 group hover:border-primary/20 transition-all">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-primary/20 rounded-2xl text-primary"><ShieldCheck size={24} /></div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-widest italic text-white">Security Protocol</h4>
                  <p className="text-[10px] font-bold text-slate-500">Tier 4 Neural Protection Active</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed">
                Platform liquidity is safeguarded by segregated neural assets. All transactions are logged on the private Tradify ledger.
              </p>
            </div>
            <div className="glass-card p-6 border-white/5 group hover:border-accent/20 transition-all">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-accent/20 rounded-2xl text-accent"><Zap size={24} /></div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-widest italic text-white">Execution Engine</h4>
                  <p className="text-[10px] font-bold text-slate-500">High-Frequency Node Selected</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed">
                Millisecond order execution with dynamic routing to ensure zero slippage on all Tradify custom protocol assets.
              </p>
            </div>
            <div className="glass-card p-6 border-white/5 group hover:border-primary/20 transition-all">
              <div className="flex items-center space-x-4 mb-6">
                <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400"><Clock size={24} /></div>
                <div>
                  <h4 className="font-black text-xs uppercase tracking-widest italic text-white">Settlement System</h4>
                  <p className="text-[10px] font-bold text-slate-500">Instant T+0 Neural Matching</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-medium italic leading-relaxed">
                Profit realization is settle instantly to your primary USDC wallet upon order completion. Withdraw anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="space-y-8 lg:sticky lg:top-8 self-start">
          {/* Market Chat */}
          <TradingChat />

          {/* Spot Trading Widget */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 bg-white/2">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] italic text-white">Spot Execution</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
                <button 
                  onClick={() => setTradeType('buy')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest italic rounded-xl transition-all ${tradeType === 'buy' ? 'bg-accent text-black shadow-xl shadow-accent/20 scale-105' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  Buy Spot
                </button>
                <button 
                  onClick={() => setTradeType('sell')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest italic rounded-xl transition-all ${tradeType === 'sell' ? 'bg-error text-white shadow-xl shadow-error/20 scale-105' : 'text-slate-600 hover:text-slate-400'}`}
                >
                  Sell Spot
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1 text-[9px] font-black text-slate-500 uppercase italic">
                    <span>Allocated Volume (USDC)</span>
                    <span className="text-white">Max: {tradeType === 'buy' ? wallet?.balance_usdc : (assetBalance * (currentTicker?.price || 0)).toFixed(2)}</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(e.target.value)}
                      className="input-field w-full pr-16 text-lg font-mono italic" 
                      placeholder="0.00" 
                    />
                    <span className="absolute right-6 top-5 text-[10px] font-black text-primary uppercase italic tracking-widest">USDC</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1 text-[9px] font-black text-slate-500 uppercase italic">
                    <span>Asset Amount ({selectedSymbol.split('/')[0]})</span>
                  </div>
                  <div className="relative">
                    <input type="number" className="input-field w-full pr-16 text-lg font-mono italic" placeholder="0.00" />
                    <span className="absolute right-6 top-5 text-[10px] font-black text-slate-500 uppercase italic tracking-widest">{selectedSymbol.split('/')[0]}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-[11px] font-black italic mb-4">
                    <span className="text-slate-500 uppercase">Protocol Estimation</span>
                    <span className="text-white">~ {currentTicker ? (parseFloat(tradeAmount || '0') / currentTicker.price).toFixed(6) : '0.000'} {symbolOnly}</span>
                  </div>
                  <button 
                    onClick={handleTrade}
                    disabled={processing}
                    className={`w-full py-5 text-xs font-black uppercase tracking-[0.2em] italic rounded-2xl shadow-2xl transition-all transform hover:-translate-y-1 ${
                      tradeType === 'buy' ? 'bg-accent text-black shadow-accent/20' : 'bg-error text-white shadow-error/20'
                    } disabled:opacity-50`}
                  >
                    {processing ? 'EXECUTING...' : `Execute ${tradeType.toUpperCase()} Signal`}
                  </button>
                </div>
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
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
              <h3 className="font-black text-xs uppercase tracking-[0.2em] italic text-white text-trader">Asset Core</h3>
              <div className="flex items-center space-x-1">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Synced</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto scrollbar-hide py-2">
              {tickers.map((ticker) => (
                <button
                  key={ticker.symbol}
                  onClick={() => setSelectedSymbol(ticker.symbol)}
                  className={`w-full flex items-center justify-between px-6 py-5 hover:bg-white/5 transition-all relative group ${selectedSymbol === ticker.symbol ? 'bg-primary/5' : ''}`}
                >
                  {selectedSymbol === ticker.symbol && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-xs font-black italic border border-white/5 group-hover:border-primary/20 group-hover:text-primary transition-all">
                      {ticker.symbol.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black text-white italic">{ticker.symbol}</p>
                      <p className="text-[9px] font-bold text-slate-600 uppercase italic">Vol: ${(ticker.volume / 1000).toFixed(1)}k</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-white italic tracking-tighter">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className={`text-[10px] font-black italic ${ticker.change >= 0 ? 'text-accent' : 'text-error'}`}>
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
