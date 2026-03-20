import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi, PriceLineOptions } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, Maximize2, Settings, ShieldCheck, Zap, Activity, ChevronRight, History, PieChart, ArrowUpRight, ArrowDownLeft, Target, LayoutDashboard, AlertCircle, Info } from 'lucide-react';
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

  const symbolOnly = selectedSymbol.split('/')[0];

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

  // --- BULLETPROOF AUTO-SETTLEMENT ---
  useEffect(() => {
    const settlementInterval = setInterval(async () => {
      const now = new Date();
      
      for (const pos of activePositions) {
        const expiry = new Date(pos.expires_at);
        if (now >= expiry && pos.status === 'active' && !settlingIds.current.has(pos.id)) {
           settlingIds.current.add(pos.id);
           await settleOrder(pos);
        }
      }
    }, 1000);

    return () => clearInterval(settlementInterval);
  }, [activePositions, currentTicker, wallet, profile]);

  const settleOrder = async (order: any) => {
    if (!currentTicker || !profile || !wallet) {
       settlingIds.current.delete(order.id);
       return;
    }

    const currentPriceForSettle = currentTicker.price; // Capture current price
    const entryPrice = order.price_at_execution;
    const amount = order.amount_usdc;
    
    // Final PnL logic
    const priceChangePct = (currentPriceForSettle - entryPrice) / entryPrice;
    let profit = 0;
    if (order.type === 'long') {
      profit = amount * (1 + priceChangePct); 
    } else {
      profit = amount * (1 - priceChangePct);
    }

    try {
      // Atomic updates
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
      addNotification(profile.id, 'Flash Node Settled', `Result: ${isWin ? 'PROFIT' : 'LOSS'} of $${Math.abs(profit - amount).toFixed(2)}`, isWin ? 'success' : 'transaction');

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
    if (isNaN(amount) || amount <= 0 || amount > wallet.balance_usdc) {
      alert('Insufficient neural flux');
      return;
    }

    setProcessing(true);
    const entryPrice = currentTicker.price;
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString();

    try {
      const newBalance = wallet.balance_usdc - amount;
      await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      setWallet({ ...wallet, balance_usdc: newBalance });

      const { data, error } = await supabase.from('orders').insert({
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

      addNotification(profile.id, 'Flash Node Synchronized', `Entry @ $${entryPrice.toLocaleString()}`, 'success');
      setTradeAmount('');
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Signal Lost');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 -mt-2 md:mt-0">
      <div className="hidden md:block -mx-12">
        <MarketTicker />
      </div>

      {/* High Fidelity Asset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-[#0B0E11] p-4 md:p-10 rounded-3xl md:rounded-[2rem] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center space-x-8 relative z-10">
          <div className="p-3 md:p-6 bg-primary/10 rounded-2xl md:rounded-3xl border border-primary/20 backdrop-blur-xl">
            <div className="w-10 h-10 md:w-20 md:h-20 bg-primary rounded-xl flex items-center justify-center text-black font-black text-xl md:text-3xl italic shadow-[0_10px_40px_rgba(252,186,44,0.3)]">
              {selectedSymbol.split('/')[0].charAt(0)}
            </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center space-x-3 md:space-x-6 mb-1 md:mb-2">
                <h1 className="text-2xl md:text-7xl font-black text-white italic uppercase tracking-tighter font-display leading-none">{selectedSymbol}</h1>
                <div className="px-3 py-1 md:px-5 md:py-2 bg-primary/20 border border-primary/40 rounded-full animate-pulse">
                   <span className="text-[8px] md:text-[12px] font-black text-primary uppercase tracking-[0.4em] italic">Flash</span>
                </div>
             </div>
             <div className="flex items-center space-x-12">
                 <div className="flex flex-col">
                   <span className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase italic tracking-widest mb-0.5 md:mb-1">Price (INDEX)</span>
                   <span className="text-xl md:text-5xl font-mono font-black text-white italic tracking-tighter font-display">
                     ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                   </span>
                </div>
                <div className={`px-3 py-1 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl text-[12px] md:text-[16px] font-black flex items-center italic shadow-2xl ${(currentTicker?.change || 0) >= 0 ? 'bg-accent/20 text-accent border border-accent/20' : 'bg-error/20 text-error border border-error/20'}`}>
                   {(currentTicker?.change || 0) >= 0 ? <TrendingUp size={20} className="mr-3" /> : <TrendingDown size={20} className="mr-3" />}
                   {((currentTicker?.change || 0) >= 0 ? '+' : '') + (currentTicker?.change || 0).toFixed(2)}%
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-3xl border border-white/10 relative z-10 overflow-x-auto no-scrollbar">
          {timeframes.map(tf => (
             <button
               key={tf} onClick={() => setSelectedTimeframe(tf)}
               className={`px-4 md:px-8 py-2 md:py-4 rounded-xl md:rounded-2xl text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] italic transition-all shrink-0 ${selectedTimeframe === tf ? 'bg-primary text-black shadow-[0_10px_30px_rgba(252,186,44,0.2)]' : 'text-slate-500 hover:text-white'}`}
             >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 md:gap-8">
        <div className="lg:col-span-3 space-y-6 md:space-y-8 order-1">
          {/* Main Chart */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 md:p-10 h-[400px] md:h-[800px] flex flex-col relative group overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[150px] pointer-events-none" />
            
            <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-10">
               <div className="flex space-x-16">
                  <div>
                     <span className="text-[12px] font-black text-slate-600 uppercase italic tracking-widest mb-2 block">Alpha Engine Status</span>
                     <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        <span className="text-sm font-black text-white italic tracking-widest uppercase">Streaming V4</span>
                     </div>
                  </div>
                  <div className="hidden md:block">
                     <span className="text-[12px] font-black text-slate-600 uppercase italic tracking-widest mb-2 block">Mark Liquidity</span>
                     <span className="text-sm font-black text-primary italic tracking-widest uppercase">99.9% DEPTH</span>
                  </div>
               </div>
               <div className="flex items-center space-x-6">
                  <div className="px-6 py-2 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                     <span className="text-[10px] font-black text-primary italic tracking-[0.3em] uppercase">Node ID: {profile?.id?.substring(0,8)}</span>
                  </div>
               </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          {/* ACTIVE FLASH POSITIONS (BYBIT STYLE) */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2 md:px-4">
               <h3 className="text-base md:text-xl font-black text-white italic tracking-[0.4em] uppercase font-display">Active Nodes ({activePositions.length})</h3>
               <div className="flex items-center space-x-2 text-slate-500">
                  <Info size={14} />
                  <span className="text-[10px] font-black italic uppercase tracking-widest">Automatic T+0 Settlement</span>
               </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <AnimatePresence>
                 {activePositions.map((pos) => (
                   <LiveFlashPositionCard key={pos.id} position={pos} currentPrice={currentTicker?.price || 0} />
                 ))}
               </AnimatePresence>
               {activePositions.length === 0 && (
                 <div className="md:col-span-2 glass-card p-20 flex flex-col items-center justify-center border-dashed border-white/10 text-slate-600 transform hover:scale-[1.01] transition-all">
                    <Zap size={64} className="mb-6 opacity-10 animate-pulse" />
                    <p className="text-sm font-black uppercase italic tracking-[0.3em] text-center max-w-md">No Neural Signals detected. Synchronize a trade node above.</p>
                 </div>
               )}
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
  return (
    <div className="bg-[#1C2023] rounded-[2rem] border border-white/10 overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
      <div className="p-8 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between border-b border-white/5">
         <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/20 rounded-xl border border-primary/30">
               <Zap size={20} className="text-primary" />
            </div>
            <h3 className="font-black text-sm uppercase tracking-[0.4em] italic text-white font-display">Flash Core</h3>
         </div>
         <div className="bg-primary/95 text-black px-4 py-1.5 rounded-full text-[10px] font-black italic tracking-widest">HIGH SPEED</div>
      </div>
      <div className="p-4 md:p-10 space-y-6 md:space-y-10">
         <div className="space-y-3 md:space-y-4">
            <div className="flex justify-between px-2">
               <span className="text-[10px] md:text-[12px] font-black text-slate-500 uppercase italic tracking-widest">Input Flux</span>
               <span className="text-[10px] md:text-[12px] font-bold text-white italic tracking-widest">Core: ${(wallet?.balance_usdc || 0).toLocaleString()}</span>
            </div>
            <div className="relative group">
               <input 
                 type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)}
                 className="w-full bg-[#0B0E11] p-6 md:p-8 pr-20 md:pr-24 rounded-2xl md:rounded-3xl border border-white/10 text-2xl md:text-3xl font-black italic font-display focus:border-primary/50 focus:ring-0 transition-all shadow-inner"
                 placeholder="0.00"
               />
               <span className="absolute right-8 top-8 text-sm font-black text-slate-600 italic tracking-[0.3em]">USDC</span>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-8">
            <button 
              onClick={() => onOpen('long')} disabled={processing}
              className="group relative flex flex-col items-center justify-center p-10 bg-[#0ECB81] hover:bg-[#12e291] text-black rounded-[2.5rem] shadow-[0_20px_40px_rgba(14,203,129,0.2)] transition-all hover:translate-y-[-4px] overflow-hidden"
            >
               <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <TrendingUp size={32} className="mb-2 md:mb-4 relative z-10" />
                <span className="text-xs md:text-base font-black italic tracking-[0.2em] uppercase relative z-10">Long-S</span>
             </button>
             <button 
               onClick={() => onOpen('short')} disabled={processing}
               className="group relative flex flex-col items-center justify-center p-6 md:p-10 bg-[#F6465D] hover:bg-[#ff5d72] text-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_20px_40px_rgba(246,70,93,0.2)] transition-all hover:translate-y-[-4px] overflow-hidden"
             >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <TrendingDown size={32} className="mb-2 md:mb-4 relative z-10" />
                <span className="text-xs md:text-base font-black italic tracking-[0.2em] uppercase relative z-10">Short-S</span>
             </button>
         </div>

         <div className="p-6 bg-white/2 rounded-3xl border border-white/5 space-y-4 backdrop-blur-sm">
            <div className="flex justify-between text-[11px] font-black italic tracking-widest">
               <span className="text-slate-500 uppercase">Settlement Window</span>
               <span className="text-primary italic">LOCKED (60s)</span>
            </div>
            <div className="flex justify-between text-[11px] font-black italic tracking-widest">
               <span className="text-slate-500 uppercase">Execution Node</span>
               <span className="text-accent italic">ALPHA v4.2</span>
            </div>
         </div>
      </div>
    </div>
  );
}

function LiveFlashPositionCard({ position, currentPrice }: any) {
  const [timeLeft, setTimeLeft] = useState(60);
  const [pricePulse, setPricePulse] = useState<number[]>([]);
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

  // Record price pulse for visual effect
  useEffect(() => {
    setPricePulse(prev => [...prev.slice(-15), currentPrice]);
  }, [currentPrice]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      className="bg-[#171A1E] p-5 md:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 relative overflow-hidden group shadow-2xl"
    >
      <div className={`absolute top-0 right-0 w-3 h-full ${pnlPct >= 0 ? 'bg-[#0ECB81] shadow-[0_0_30px_#0ECB81]' : 'bg-[#F6465D] shadow-[0_0_30px_#F6465D]'}`} />
      
      <div className="flex justify-between items-start mb-10">
         <div className="flex items-center space-x-6">
            <div className={`p-5 rounded-3xl ${isLong ? 'bg-accent/10 border-accent/20' : 'bg-error/10 border-error/20'} border shadow-inner`}>
               {isLong ? <ArrowUpRight className="text-accent" size={32} /> : <ArrowDownLeft className="text-error" size={32} />}
            </div>
            <div>
               <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">{position.symbol}</h4>
               <div className="flex items-center space-x-3">
                  <span className={`text-[12px] font-black uppercase italic tracking-widest ${isLong ? 'text-accent' : 'text-error'}`}>{position.type.toUpperCase()} NODE</span>
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Entry: ${entryPrice.toLocaleString()}</span>
               </div>
            </div>
         </div>
         <div className="text-right flex flex-col items-end">
             <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
                <Clock size={14} className="text-primary animate-spin-slow" />
                <span className="text-lg md:text-2xl font-mono font-black text-white italic">{timeLeft}s</span>
             </div>
            {timeLeft <= 10 && <span className="text-[10px] font-black text-error animate-pulse uppercase tracking-[0.2em] mt-2 italic">SETTLING SOON...</span>}
         </div>
      </div>

      <div className="space-y-6 relative z-10">
         <div className="grid grid-cols-2 gap-8 bg-black/40 p-8 rounded-[2rem] border border-white/5">
            <div>
               <span className="text-[11px] font-black text-slate-600 uppercase italic tracking-widest block mb-1">Mark Flux (Live)</span>
               <span className="text-3xl font-mono font-black text-white italic tracking-tighter">${currentPrice.toLocaleString()}</span>
            </div>
            <div className="text-right">
               <span className="text-[11px] font-black text-slate-600 uppercase italic tracking-widest block mb-1">Unrealized Edge</span>
               <span className={`text-4xl font-mono font-black italic tracking-tighter ${(pnlPct || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                  {(pnlPct || 0) >= 0 ? '+' : ''}${(pnlPct || 0).toFixed(2)}%
               </span>
            </div>
         </div>

         {/* Price Fluctuation Visualizer (Bybit style) */}
         <div className="flex items-end space-x-1 h-12 px-4 opacity-40">
            {pricePulse.map((p, i) => {
               const height = 10 + ((p - entryPrice) / entryPrice * 1000); // scaled
               return <div key={i} className={`flex-1 rounded-full ${p >= entryPrice ? 'bg-accent' : 'bg-error'}`} style={{ height: `${Math.abs(height)}%`, maxHeight: '100%', minHeight: '10%' }} />;
            })}
         </div>
      </div>

      <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center relative z-10">
         <div className="flex items-center space-x-4">
            <span className="text-[12px] font-black text-slate-500 uppercase italic tracking-widest">Net Realization:</span>
            <span className={`text-2xl font-black italic tracking-tighter font-display ${(pnlUsdc || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
               {(pnlUsdc || 0) >= 0 ? '+' : ''}${(pnlUsdc || 0).toFixed(2)}
            </span>
         </div>
         <div className="flex space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
            <span className="text-[10px] font-black text-primary uppercase italic tracking-widest">TRANSMITTING...</span>
         </div>
      </div>
    </motion.div>
  );
}

function SettlementArchive({ orders }: any) {
  return (
    <div className="glass-card overflow-hidden rounded-[2.5rem]">
      <div className="p-10 bg-[#252930] flex items-center justify-between border-b border-white/10">
         <div className="flex items-center space-x-6">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
               <History className="text-primary" size={24} />
            </div>
            <div>
               <h3 className="text-xl font-black uppercase tracking-[0.4em] italic text-white font-display">Neural Settlement Archive</h3>
               <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] mt-1">Institutional Order Verification active</p>
            </div>
         </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto no-scrollbar bg-[#0B0E11]/40">
         {orders.map((order: any) => (
           <div key={order.id} className="p-10 border-b border-white/5 flex items-center justify-between hover:bg-white/5 transition-all relative group">
              <div className="flex items-center space-x-8">
                 <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black italic text-xl ${(order.pnl_realized || 0) >= 0 ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-error/10 text-error border border-error/20'}`}>
                    {order.type === 'long' ? 'L' : 'S'}
                 </div>
                 <div>
                    <h5 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{order.symbol}</h5>
                    <div className="flex items-center space-x-4">
                       <span className="text-sm font-mono font-bold text-slate-500 uppercase">${order.price_at_execution?.toLocaleString()}</span>
                       <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest">{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                 </div>
              </div>
              <div className="text-right">
                 <div className="mb-2">
                   <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest block">Assettled Result</span>
                   <p className={`text-4xl font-mono font-black italic tracking-tighter ${(order.pnl_realized || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                      {(order.pnl_realized || 0) >= 0 ? '+' : ''}${(order.pnl_realized || 0).toFixed(2)}
                   </p>
                 </div>
                 <div className="px-4 py-1.5 bg-white/5 rounded-full inline-block border border-white/10">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">TRANSACTION VERIFIED</span>
                 </div>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}

function GlobalNodeTable({ tickers, selectedSymbol, onSelect }: any) {
  return (
    <div className="bg-[#1C2023] rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
      <div className="p-8 bg-[#252930] flex items-center justify-between border-b border-white/10">
         <h3 className="font-black text-sm uppercase tracking-[0.4em] italic text-white flex items-center font-display">Neural Streams</h3>
         <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">LIVE FEED</span>
         </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto no-scrollbar">
        {tickers.map((ticker: any) => (
          <button
            key={ticker.symbol} onClick={() => onSelect(ticker.symbol)}
            className={`w-full flex items-center justify-between px-10 py-8 hover:bg-white/5 transition-all relative group ${selectedSymbol === ticker.symbol ? 'bg-primary/10' : ''}`}
          >
            {selectedSymbol === ticker.symbol && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary shadow-[0_0_30px_rgba(252,186,44,0.8)]" />}
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-xl font-black italic border border-white/10 group-hover:border-primary/20 transition-all font-display">
                {ticker.symbol.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-2xl font-black text-white italic leading-none mb-2">{ticker.symbol}</p>
                <p className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest">${((ticker.volume || 0) / 1000).toFixed(1)}k STREAM VOL</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-mono font-bold text-white italic tracking-tighter leading-none mb-2">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <div className={`flex items-center justify-end space-x-2 ${(ticker.change || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                 <span className="text-[12px] font-black italic tracking-widest uppercase">{(ticker.change || 0) >= 0 ? '+' : ''}{(ticker.change || 0).toFixed(2)}%</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TradingDashboard;
