import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, ShieldCheck, Zap, History, ArrowUpRight, ArrowDownLeft, Info, Activity, Waves } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TradingChat from '../components/TradingChat';
import AnnouncementCarousel from '../components/AnnouncementCarousel';
import MarketTicker from '../components/MarketTicker';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

const TradingDashboard: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<{ [key: string]: any }>({});
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDC');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { profile, wallet, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [currentTicker, setCurrentTicker] = useState<TickerData | null>(null);
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const settlingIds = useRef<Set<string>>(new Set());

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontFamily: 'JetBrains Mono',
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
        scaleMargins: { top: 0.1, bottom: 0.2 },
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

  // Update Price Lines on Chart
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    // Remove old lines
    Object.values(priceLinesRef.current).forEach(line => {
      candlestickSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = {};

    // Add lines for active positions
    activePositions.forEach(pos => {
      if (pos.symbol === selectedSymbol && pos.status === 'active') {
        const line = candlestickSeriesRef.current?.createPriceLine({
          price: pos.price_at_execution,
          color: pos.type === 'long' ? '#0ECB81' : '#F6465D',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `ENTRY ${pos.type.toUpperCase()}`,
        });
        priceLinesRef.current[pos.id] = line;
      }
    });

    // Add markers
    const markers = activePositions
      .filter(p => p.symbol === selectedSymbol && p.status === 'active')
      .map(p => ({
        time: Math.floor(new Date(p.created_at).getTime() / 1000),
        position: p.type === 'long' ? 'belowBar' : 'aboveBar',
        color: p.type === 'long' ? '#0ECB81' : '#F6465D',
        shape: p.type === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'OPEN NODE',
      }));
    
    candlestickSeriesRef.current.setMarkers(markers as any);

  }, [activePositions, selectedSymbol]);

  // Subscribe to Tickers
  useEffect(() => {
    MarketService.startSimulation();
    const unsubscribe = MarketService.subscribe((data) => {
      setTickers(data);
    });
    return () => { unsubscribe(); };
  }, []);

  // Update currentTicker
  useEffect(() => {
    const active = tickers.find(t => t.symbol === selectedSymbol);
    if (active) setCurrentTicker(active);
  }, [tickers, selectedSymbol]);

  // Data Fetching
  useEffect(() => {
    if (profile && selectedSymbol) {
      fetchData();
    }
  }, [profile, selectedSymbol]);

  const fetchData = async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });
    
    if (ordersData) {
      setActivePositions(ordersData.filter(o => o.status === 'active'));
      setRecentOrders(ordersData.filter(o => o.status === 'completed').slice(0, 10));
    }
  };

  // --- AUTO-SETTLEMENT & PURGE ---
  useEffect(() => {
    const settlementInterval = setInterval(async () => {
      const now = new Date();
      
      for (const pos of activePositions) {
        const expiry = new Date(pos.expires_at);
        // Auto-settle if expired
        if (now >= expiry && pos.status === 'active' && !settlingIds.current.has(pos.id)) {
           await settleOrder(pos);
        }
      }
    }, 1000);

    return () => clearInterval(settlementInterval);
  }, [activePositions, tickers, wallet, profile]);

  // Initial Purge of dead trades
  useEffect(() => {
    if (activePositions.length > 0 && tickers.length > 0) {
      const now = new Date();
      activePositions.forEach(pos => {
        const expiry = new Date(pos.expires_at);
        if (now > new Date(expiry.getTime() + 2000)) { // 2s Grace period
          settleOrder(pos);
        }
      });
    }
  }, [tickers.length > 0]);

  const settleOrder = async (order: any, manualPrice?: number) => {
    if (!profile || !wallet || settlingIds.current.has(order.id)) {
       return;
    }

    const targetTicker = tickers.find(t => t.symbol === order.symbol);
    const currentPriceForSettle = manualPrice || targetTicker?.price;

    if (!currentPriceForSettle) {
      console.warn(`Price stream for ${order.symbol} not established. Delaying settlement.`);
      return;
    }

    settlingIds.current.add(order.id);
    const entryPrice = order.price_at_execution;
    const amount = order.amount_usdc;
    
    const priceChangePct = (currentPriceForSettle - entryPrice) / entryPrice;
    let profit = 0;
    if (order.type === 'long') {
      profit = amount * (1 + priceChangePct); 
    } else {
      profit = amount * (1 - priceChangePct);
    }

    try {
      const newBalance = wallet.balance_usdc + profit;
      
      const { error: walletError } = await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      if (walletError) throw walletError;

      const { error: orderError } = await supabase.from('orders').update({
        status: 'completed',
        exit_price: currentPriceForSettle,
        pnl_realized: profit - amount
      }).eq('id', order.id);
      if (orderError) throw orderError;

      setWallet({ ...wallet, balance_usdc: newBalance });
      
      const isWin = profit >= amount;
      addNotification(profile.id, 'Position Settled', `Result: ${isWin ? 'PROFIT' : 'LOSS'} of $${Math.abs(profit - amount).toFixed(2)}`, isWin ? 'success' : 'transaction');

      await fetchData();
    } catch (err) {
      console.error("Settlement error:", err);
    } finally {
       settlingIds.current.delete(order.id);
    }
  };

  const openFlashTrade = async (type: 'long' | 'short') => {
    if (!profile || !wallet || !currentTicker || !tradeAmount || processing) return;
    
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0 || amount > (wallet?.balance_usdc || 0)) {
      addNotification(profile.id, 'Calibration Error', 'Insufficient USDC balance for this trade unit.', 'error');
      return;
    }

    if (!currentTicker) {
      addNotification(profile.id, 'Sync Error', 'Satellite price link not established.', 'error');
      return;
    }

    setProcessing(true);
    const entryPrice = currentTicker.price;
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    try {
      const newBalance = wallet.balance_usdc - amount;
      await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      setWallet({ ...wallet, balance_usdc: newBalance });

      const { error } = await supabase.from('orders').insert({
        user_id: profile.id,
        symbol: selectedSymbol,
        type: type,
        amount_usdc: amount,
        amount_asset: amount / entryPrice,
        price_at_execution: entryPrice,
        status: 'active',
        expires_at: expiresAt
      }).select();

      if (error) throw error;

      addNotification(profile.id, 'Flash Position Initialized', `Entry confirmed @ $${entryPrice.toLocaleString()}`, 'success');
      setTradeAmount('');
      await fetchData();
    } catch (err: any) {
      addNotification(profile.id, 'Critical Link Failure', err.message || 'Network synchrony lost.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 -mt-2 md:mt-0">
      <div className="hidden md:block -mx-12">
        <MarketTicker />
      </div>

      {/* Institutional Asset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-[#0B0E11] p-4 md:p-10 rounded-3xl md:rounded-[2.5rem] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden text-white">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-full h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        
        <div className="flex items-center space-x-8 relative z-10">
          <div className="relative">
             <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
             <div className="p-3 md:p-6 bg-[#1C2023] rounded-2xl md:rounded-3xl border border-white/10 backdrop-blur-xl group cursor-default">
               <div className="w-10 h-10 md:w-20 md:h-20 bg-primary rounded-xl flex items-center justify-center text-black font-black text-xl md:text-3xl italic shadow-[0_10px_40px_rgba(252,186,44,0.3)] transition-transform group-hover:scale-105">
                 {selectedSymbol.split('/')[0].charAt(0)}
               </div>
             </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center space-x-3 md:space-x-6 mb-1 md:mb-2">
                <h1 className="text-2xl md:text-7xl font-black italic uppercase tracking-tighter font-display leading-none">{selectedSymbol}</h1>
                <div className="px-3 py-1 md:px-5 md:py-2 bg-primary/20 border border-primary/40 rounded-full flex items-center space-x-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                   <span className="text-[8px] md:text-[12px] font-black text-primary uppercase tracking-[0.4em] italic">ACTIVE TERMINAL</span>
                </div>
             </div>
             <div className="flex items-center space-x-12">
                  <div className="flex flex-col">
                    <span className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase italic tracking-[0.3em] mb-0.5 md:mb-1">Market Benchmark</span>
                    <span className="text-xl md:text-5xl font-mono font-black italic tracking-tighter font-display">
                      ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </span>
                 </div>
                <div className={`px-3 py-1 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl text-[12px] md:text-[16px] font-black flex items-center italic shadow-2xl backdrop-blur-md ${(currentTicker?.change || 0) >= 0 ? 'bg-accent/20 text-accent border border-accent/20' : 'bg-error/20 text-error border border-error/20'}`}>
                   {(currentTicker?.change || 0) >= 0 ? <TrendingUp size={20} className="mr-3" /> : <TrendingDown size={20} className="mr-3" />}
                   {((currentTicker?.change || 0) >= 0 ? '+' : '') + (currentTicker?.change || 0).toFixed(2)}%
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-3xl border border-white/10 relative z-10 overflow-x-auto no-scrollbar backdrop-blur-xl">
          {timeframes.map(tf => (
             <button
               key={tf} onClick={() => setSelectedTimeframe(tf)}
               className={`px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] italic transition-all shrink-0 ${selectedTimeframe === tf ? 'bg-primary text-black shadow-[0_10px_30px_rgba(252,186,44,0.3)]' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
             >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 md:gap-8">
        <div className="lg:col-span-3 space-y-6 md:space-y-8 order-1">
          {/* Main Visual Terminal */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 md:p-10 h-[400px] md:h-[800px] flex flex-col relative group overflow-hidden border-white/5 bg-[#0B0E11]/60 shadow-[0_40px_100px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[150px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-10">
               <div className="flex space-x-16">
                  <div>
                     <span className="text-[12px] font-black text-slate-600 uppercase italic tracking-widest mb-2 block">Alpha Stream V4</span>
                     <div className="flex items-center space-x-3">
                        <Activity size={16} className="text-primary animate-pulse" />
                        <span className="text-sm font-black text-white italic tracking-widest uppercase">LATENCY: 12MS</span>
                     </div>
                  </div>
                  <div className="hidden md:block">
                     <span className="text-[12px] font-black text-slate-600 uppercase italic tracking-widest mb-2 block">Protocol Security</span>
                     <div className="flex items-center space-x-3 text-accent">
                        <ShieldCheck size={16} />
                        <span className="text-sm font-black italic tracking-widest uppercase">AES-256 ACTIVE</span>
                     </div>
                  </div>
               </div>
               <div className="flex items-center space-x-6">
                  <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                     <span className="text-[10px] font-black text-primary italic tracking-[0.3em] uppercase tracking-tighter">TRADIFY_ID: {profile?.id?.substring(0,8)}</span>
                  </div>
               </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          {/* ACTIVE FLASH POSITIONS */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center space-x-4">
                  <h3 className="text-sm md:text-lg font-black text-white italic tracking-[0.4em] uppercase font-display">Live Synchronizations</h3>
                  <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                    <span className="text-[8px] md:text-[10px] font-black text-primary uppercase italic tracking-widest">{activePositions.length} TERMINALS</span>
                  </div>
               </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => activePositions.forEach(p => settleOrder(p))}
                    className="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-full text-[8px] font-black text-rose-500 uppercase italic tracking-widest transition-all hover:scale-105 active:scale-95"
                  >
                    Purge All Cycles
                  </button>
                  <Waves size={16} className="text-slate-700 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-600 italic uppercase tracking-widest">Auto-Settlement Core v2.1</span>
               </div>
            </div>

            <div className="glass-card overflow-hidden border-white/5 bg-[#0B0E11]/40 shadow-2xl">
               <div className="hidden md:grid grid-cols-6 gap-4 px-8 py-4 bg-white/5 border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Instrument</span>
                  <span>Position Value</span>
                  <span>Exchange Index</span>
                  <span>Unrealized PnL</span>
                  <span>Time Vector</span>
                  <span className="text-right">Operation</span>
               </div>
               
               <div className="divide-y divide-white/5">
                 <AnimatePresence>
                   {activePositions.map((pos) => (
                     <LiveFlashPositionRow 
                       key={pos.id} 
                       position={pos} 
                       currentPrice={tickers.find(t => t.symbol === pos.symbol)?.price || currentTicker?.price || 0} 
                       onClose={() => settleOrder(pos, tickers.find(t => t.symbol === pos.symbol)?.price)}
                     />
                   ))}
                 </AnimatePresence>
                 {activePositions.length === 0 && (
                   <div className="p-24 flex flex-col items-center justify-center text-slate-700">
                      <div className="relative mb-6">
                        <Zap size={60} className="opacity-5 animate-pulse" />
                        <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
                      </div>
                      <p className="text-[10px] font-black uppercase italic tracking-[0.5em] text-center max-w-xs leading-loose">Matrix empty. Initiate a trade unit to begin neural synchronization.</p>
                   </div>
                 )}
               </div>
            </div>
          </div>

          <div className="block lg:hidden">
            <FlashTradePanel tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} wallet={wallet} processing={processing} onOpen={openFlashTrade} />
          </div>

          <SettlementArchive orders={recentOrders} />
        </div>

        <div className="hidden lg:block space-y-8 lg:sticky lg:top-8 self-start order-2">
          <FlashTradePanel tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} wallet={wallet} processing={processing} onOpen={openFlashTrade} />
          <TradingChat />
          <GlobalNodeTable tickers={tickers} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
        </div>
      </div>
    </div>
  );
};

// --- FLASH COMPONENTS ---

function FlashTradePanel({ tradeAmount, setTradeAmount, wallet, processing, onOpen }: any) {
  const setPercentage = (pct: number) => {
    if (wallet?.balance_usdc) {
      const amount = (wallet.balance_usdc * (pct / 100)).toFixed(2);
      setTradeAmount(amount);
    }
  };

  return (
    <div className="bg-[#1C2023] rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Zap size={60} />
      </div>
      <div className="p-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between border-b border-white/5">
         <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/20 rounded-xl border border-primary/30 shadow-[0_0_20px_rgba(252,186,44,0.3)]">
               <Zap size={20} className="text-primary" />
            </div>
            <h3 className="font-black text-[12px] uppercase tracking-[0.4em] italic text-white font-display">Execution Center</h3>
         </div>
         <div className="bg-primary/95 text-black px-4 py-1.5 rounded-full text-[9px] font-black italic tracking-widest shadow-lg shadow-primary/20">REAL-TIME SYNC</div>
      </div>
      <div className="p-4 md:p-10 space-y-8">
         <div className="space-y-4">
            <div className="flex justify-between items-end px-2">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-1">Position Size</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase italic px-2 py-0.5 bg-white/5 rounded border border-white/5">USDC ASSET</span>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest block mb-1">Available Liquidity</span>
                  <span className="text-sm font-bold text-primary italic tracking-widest">${(wallet?.balance_usdc || 0).toLocaleString()}</span>
               </div>
            </div>
            
            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity blur-lg rounded-2xl" />
               <input 
                 type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)}
                 className="relative w-full bg-[#0B0E11] p-6 pr-20 rounded-2xl border border-white/10 text-2xl font-black italic font-display focus:border-primary/50 text-white focus:ring-0 transition-all shadow-inner outline-none placeholder:text-slate-800"
                 placeholder="0.00"
               />
               <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary italic tracking-[0.3em]">USDC</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
               {[25, 50, 75, 100].map(pct => (
                 <button 
                   key={pct} onClick={() => setPercentage(pct)}
                   className="py-2.5 bg-white/2 hover:bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-slate-500 hover:text-primary transition-all uppercase italic tracking-widest active:scale-95"
                 >
                   {pct === 100 ? 'MAX' : `${pct}%`}
                 </button>
               ))}
            </div>
         </div>

         <div className="grid grid-cols-2 gap-8 pt-2">
            <button 
              onClick={() => onOpen('long')} disabled={processing}
              className="group relative flex flex-col items-center justify-center p-8 bg-[#0ECB81] hover:bg-[#12e291] text-black rounded-3xl shadow-[0_20px_40px_rgba(14,203,129,0.3)] transition-all hover:translate-y-[-6px] active:translate-y-0 overflow-hidden"
            >
               <div className="absolute inset-0 bg-white/30 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <TrendingUp size={28} className="mb-2 relative z-10" />
                <span className="text-xs font-black italic tracking-[0.3em] uppercase relative z-10">Neural Long</span>
             </button>
             <button 
               onClick={() => onOpen('short')} disabled={processing}
               className="group relative flex flex-col items-center justify-center p-8 bg-[#F6465D] hover:bg-[#ff5d72] text-white rounded-3xl shadow-[0_20px_40px_rgba(246,70,93,0.3)] transition-all hover:translate-y-[-6px] active:translate-y-0 overflow-hidden"
             >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <TrendingDown size={28} className="mb-2 relative z-10" />
                <span className="text-xs font-black italic tracking-[0.3em] uppercase relative z-10">Neural Short</span>
             </button>
         </div>

         <div className="p-8 bg-gradient-to-b from-white/2 to-transparent rounded-[2rem] border border-white/5 space-y-5 backdrop-blur-sm">
            <div className="flex justify-between items-center text-[10px] font-black italic tracking-[0.2em]">
               <div className="flex items-center space-x-3 text-slate-500">
                  <Clock size={14} />
                  <span className="uppercase">Vector Window</span>
               </div>
               <span className="text-primary italic bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">60s CYCLE</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black italic tracking-[0.2em]">
               <div className="flex items-center space-x-3 text-slate-500">
                  <Activity size={14} />
                  <span className="uppercase">Link Status</span>
               </div>
               <span className="text-accent italic flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mr-2 animate-ping" />
                  STABLE.V4
               </span>
            </div>
         </div>
      </div>
    </div>
  );
}

function LiveFlashPositionRow({ position, currentPrice, onClose }: any) {
  const [timeLeft, setTimeLeft] = useState(60);
  const entryPrice = position.price_at_execution;
  const isLong = position.type === 'long';
  const priceChange = (currentPrice - entryPrice) / entryPrice;
  const pnlPct = isLong ? priceChange * 100 : -priceChange * 100;
  const pnlUsdc = position.amount_usdc * (pnlPct / 100);

  useEffect(() => {
    const expiry = new Date(position.expires_at).getTime();
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((expiry - Date.now()) / 1000)));
    }, 100);
    return () => clearInterval(timer);
  }, [position]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group transition-all hover:bg-white/[0.03] relative"
    >
      {(pnlPct > 5) && (
        <div className="absolute inset-0 bg-accent/5 blur-xl pointer-events-none" />
      )}
      <div className="flex flex-col md:grid md:grid-cols-6 gap-4 p-6 md:px-8 md:py-6 items-center">
         <div className="w-full md:w-auto flex items-center space-x-4">
            <div className={`p-3 rounded-xl ${isLong ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'bg-error/10 text-error ring-1 ring-error/20'} transition-all group-hover:scale-110 shadow-lg`}>
               {isLong ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
            </div>
            <div>
               <p className="text-sm font-black text-white italic tracking-tighter uppercase leading-none mb-1">{position.symbol}</p>
               <span className={`text-[9px] font-black uppercase italic tracking-[0.2em] ${isLong ? 'text-accent' : 'text-error'}`}>{position.type} UNIT</span>
            </div>
         </div>

         <div className="w-full md:w-auto flex justify-between md:block px-2">
            <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">Size</span>
            <p className="text-sm font-mono font-bold text-slate-300 italic opacity-80">${position.amount_usdc.toFixed(2)}</p>
         </div>

         <div className="w-full md:w-auto flex justify-between md:block px-2">
            <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">Indices</span>
            <div className="text-right md:text-left">
               <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter opacity-50">{entryPrice.toLocaleString()}</p>
               <p className="text-sm font-mono font-black text-white italic tracking-tighter">{currentPrice.toLocaleString()}</p>
            </div>
         </div>

         <div className="w-full md:w-auto flex justify-between md:block px-2">
            <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">Vectors</span>
            <div className="text-right md:text-left">
               <div className="flex items-center md:justify-start justify-end space-x-3">
                  <p className={`text-base font-mono font-black italic tracking-tighter ${(pnlPct || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                     {(pnlPct || 0) >= 0 ? '+' : ''}${(pnlPct || 0).toFixed(2)}%
                  </p>
                  <div className={`w-1.5 h-1.5 rounded-full ${(pnlPct || 0) >= 0 ? 'bg-accent shadow-[0_0_10px_#4ade80]' : 'bg-error shadow-[0_0_10px_#fb7185]'} animate-pulse`} />
               </div>
               <p className={`text-[10px] font-mono font-bold italic tracking-wide ${(pnlUsdc || 0) >= 0 ? 'text-accent/60' : 'text-error/60'}`}>
                  {(pnlUsdc || 0) >= 0 ? '+' : ''}${(pnlUsdc || 0).toFixed(2)} USDC
               </p>
            </div>
         </div>

         <div className="w-full md:w-auto flex justify-between md:block px-2">
            <span className="md:hidden text-[9px] font-black text-slate-600 uppercase tracking-widest">Cycle</span>
            <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 w-fit shadow-inner">
               <Clock size={12} className="text-primary animate-spin-slow" />
               <span className="text-sm font-mono font-black text-white italic tracking-widest">{timeLeft}S</span>
            </div>
         </div>

         <div className="w-full md:w-auto text-right">
            <button 
              onClick={onClose}
              className="w-full md:w-auto px-6 py-2 bg-rose-500/10 hover:bg-rose-500 text-white border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] italic transition-all group-hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] active:scale-95"
            >
               Close Loop
            </button>
         </div>
      </div>
    </motion.div>
  );
}

function SettlementArchive({ orders }: any) {
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  return (
    <div className="glass-card overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-[#0B0E11]/40 border-white/5 shadow-2xl transition-all">
      <div className="p-6 md:p-10 bg-gradient-to-r from-[#252930] to-transparent flex items-center justify-between border-b border-white/5">
         <div className="flex items-center space-x-4 md:space-x-6">
            <div className="p-3 md:p-4 bg-primary/10 rounded-2xl border border-primary/20 shadow-[inset_0_0_20px_rgba(252,186,44,0.1)]">
               <History className="text-primary" size={24} />
            </div>
            <div>
               <h3 className="text-lg md:text-xl font-black uppercase tracking-[0.4em] italic text-white font-display leading-none">History Vector</h3>
               <p className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase italic tracking-[0.2em] mt-1 md:mt-2">Immutable Protocol Ledger Ledger v1</p>
            </div>
         </div>
         <div className="hidden md:flex items-center space-x-3 text-[10px] font-black text-slate-500 uppercase italic bg-black/20 px-4 py-1.5 rounded-full border border-white/5">
            <ShieldCheck size={14} className="text-accent" />
            <span>Encrypted Protocol</span>
         </div>
      </div>
      
      <div className="max-h-[600px] overflow-y-auto no-scrollbar">
         {orders.map((order: any) => (
           <div key={order.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-all p-4 md:p-8 cursor-default">
              <div className="flex items-center justify-between">
                 <div className="flex items-center space-x-3 md:space-x-6 text-white">
                    <div className={`w-10 h-10 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-black italic text-sm md:text-2xl border shadow-xl transition-transform group-hover:scale-105 ${(order.pnl_realized || 0) >= 0 ? 'bg-accent/10 text-accent border-accent/20' : 'bg-error/10 text-error border-error/20'}`}>
                       {order.type === 'long' ? 'L' : 'S'}
                    </div>
                    <div>
                       <div className="flex items-center space-x-3">
                          <h5 className="text-sm md:text-2xl font-black italic uppercase tracking-tighter leading-none">{order.symbol}</h5>
                          <span className={`text-[9px] md:text-[10px] font-black uppercase italic transition-colors px-2 py-0.5 rounded-lg border border-current/20 ${(order.pnl_realized || 0) >= 0 ? 'text-accent bg-accent/5' : 'text-error bg-error/5'}`}>
                             {Number(order.pnl_realized) >= 0 ? 'Vector Profit' : 'Vector Loss'}
                          </span>
                       </div>
                       <div className="flex items-center space-x-3 mt-2 md:mt-3 opacity-60">
                          <span className="text-[10px] font-mono font-medium text-slate-500 italic">Entry Index: ${order.price_at_execution?.toLocaleString()}</span>
                          <span className="text-slate-700 font-black">|</span>
                          <span className="text-[10px] font-mono font-medium text-slate-500 italic">Exit Index: ${order.exit_price?.toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 <div className="flex items-center space-x-4 md:space-x-12">
                    <div className="text-right">
                       <p className={`text-xl md:text-4xl font-mono font-black italic tracking-tighter leading-none mb-2 ${(order.pnl_realized || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                          {(order.pnl_realized || 0) >= 0 ? '+' : ''}${(order.pnl_realized || 0).toFixed(2)}
                       </p>
                       <p className="text-[9px] md:text-[12px] font-black text-slate-600 uppercase italic tracking-[0.2em]">{new Date(order.created_at).toLocaleDateString()} CYCLE</p>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                      className={`p-3 md:p-4 rounded-2xl transition-all active:scale-95 ${selectedOrder === order.id ? 'bg-primary text-black' : 'hover:bg-white/5 text-slate-600'}`}
                    >
                       <Info size={20} />
                    </button>
                 </div>
              </div>

              <AnimatePresence>
                {selectedOrder === order.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-6 pb-2">
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Entry Synchrony</p>
                          <p className="text-[12px] text-slate-300 font-medium italic">{new Date(order.created_at).toLocaleTimeString()} UTC</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Protocol Settle</p>
                           <p className="text-[12px] text-slate-300 font-medium italic">{new Date(order.created_at).toLocaleTimeString()} UTC</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Asset Value</p>
                          <p className="text-[12px] text-primary font-black italic tracking-widest">${order.amount_usdc.toFixed(2)} USDC</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.3em]">Ledger Hash</p>
                          <p className="text-[10px] text-slate-500 font-mono tracking-tighter opacity-40">TXN-{order.id.substring(0,16).toUpperCase()}</p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
           </div>
         ))}
         {orders.length === 0 && (
           <div className="p-32 flex flex-col items-center justify-center text-slate-700 grayscale opacity-20">
              <History size={60} className="mb-6" />
              <p className="text-[11px] font-black uppercase italic tracking-[0.5em]">No archival records detected</p>
           </div>
         )}
      </div>
    </div>
  );
}

function GlobalNodeTable({ tickers, selectedSymbol, onSelect }: any) {
  return (
    <div className="bg-[#1C2023] rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
      <div className="p-8 bg-[#252930] flex items-center justify-between border-b border-white/10">
         <div className="flex items-center space-x-4">
            <h3 className="font-black text-[12px] uppercase tracking-[0.4em] italic text-white font-display">Global Streams</h3>
            <div className="px-3 py-1 bg-accent/20 border border-accent/40 rounded-full">
               <span className="text-[8px] font-black text-accent uppercase tracking-widest italic">{tickers.length} AGENTS</span>
            </div>
         </div>
         <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            <span className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">LIVE DATA FEED</span>
         </div>
      </div>
      <div className="max-h-[600px] overflow-y-auto no-scrollbar divide-y divide-white/[0.02]">
        {tickers.map((ticker: any) => {
          const isSelected = selectedSymbol === ticker.symbol;
          return (
            <button
              key={ticker.symbol} onClick={() => onSelect(ticker.symbol)}
              className={`w-full flex items-center justify-between px-10 py-8 hover:bg-white/5 transition-all relative group ${isSelected ? 'bg-primary/10' : ''}`}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_30px_#F3BA2F]" />
              )}
              <div className="flex items-center space-x-6">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-xl font-black italic border transition-all font-display ${isSelected ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 group-hover:border-primary/40'}`}>
                  {ticker.symbol.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-2xl font-black text-white italic leading-none mb-2 tracking-tighter">{ticker.symbol}</p>
                  <div className="flex items-center space-x-2">
                     <span className="text-[9px] font-black text-slate-600 uppercase italic tracking-widest">STREAM LOAD</span>
                     <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-700" style={{ width: `${Math.random() * 100}%` }} />
                     </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-2xl font-mono font-bold italic tracking-tighter leading-none mb-2 transition-all ${isSelected ? 'text-primary scale-110' : 'text-white'}`}>
                   ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <div className={`flex items-center justify-end space-x-2 transition-colors ${(ticker.change || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                   {(ticker.change || 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                   <span className="text-[12px] font-black italic tracking-widest uppercase">{(ticker.change || 0) >= 0 ? '+' : ''}{(ticker.change || 0).toFixed(2)}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TradingDashboard;
