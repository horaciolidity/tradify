import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, Maximize2, Settings, ShieldCheck, Zap, Activity, ChevronRight, History, PieChart, ArrowUpRight, ArrowDownLeft, Target, PlayCircle, StopCircle, Info, LayoutDashboard } from 'lucide-react';
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
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTC/USDC');
  const [selectedTimeframe, setSelectedTimeframe] = useState('15m');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { profile, wallet, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [currentTicker, setCurrentTicker] = useState<TickerData | null>(null);
  const [assetBalance, setAssetBalance] = useState(0);
  const [activePositions, setActivePositions] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
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
    });
    return () => { unsubscribe(); };
  }, []);

  // Update currentTicker
  useEffect(() => {
    const active = tickers.find(t => t.symbol === selectedSymbol);
    if (active) setCurrentTicker(active);
  }, [tickers, selectedSymbol]);

  // Fetch Position and Data
  useEffect(() => {
    if (profile && selectedSymbol) {
      fetchData();
    }
  }, [profile, selectedSymbol]);

  const fetchData = async () => {
    const { data: assetData } = await supabase
      .from('user_assets')
      .select('balance')
      .eq('user_id', profile?.id)
      .eq('symbol', symbolOnly)
      .maybeSingle();
    
    setAssetBalance(assetData?.balance || 0);

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

  // --- AUTO-SETTLEMENT LOGIC (1 MIN FLASH) ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      activePositions.forEach(async (pos) => {
        const expiry = new Date(pos.expires_at);
        if (now >= expiry && pos.status === 'active' && currentTicker) {
          await settleOrder(pos);
        }
      });
    }, 1000); // Check every second
    return () => clearInterval(interval);
  }, [activePositions, currentTicker]);

  const settleOrder = async (order: any) => {
    if (!currentTicker || !profile || !wallet) return;

    const entryPrice = order.price_at_execution;
    const exitPrice = currentTicker.price;
    const amount = order.amount_usdc;
    
    // Profit Calculation: If it went UP and you went LONG
    const priceChangePct = (exitPrice - entryPrice) / entryPrice;
    let profit = 0;
    
    if (order.type === 'long') {
      profit = amount * (1 + priceChangePct); // Long wins if direction is positive
    } else {
      profit = amount * (1 - priceChangePct); // Short wins if direction is negative
    }

    // Update Wallet
    const newBalance = wallet.balance_usdc + profit;
    await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
    setWallet({ ...wallet, balance_usdc: newBalance });

    // Mark order as completed
    await supabase.from('orders').update({
      status: 'completed',
      exit_price: exitPrice,
      pnl_realized: profit - amount
    }).eq('id', order.id);

    // Notification
    const isWin = profit >= amount;
    addNotification(profile.id, 'Flash Trade Expired', `Realized ${isWin ? 'profit' : 'loss'} of $${Math.abs(profit - amount).toFixed(2)}`, isWin ? 'success' : 'transaction');

    fetchData();
  };

  const openFlashTrade = async (type: 'long' | 'short') => {
    if (!profile || !wallet || !currentTicker || !tradeAmount || processing) return;
    
    const amount = parseFloat(tradeAmount);
    if (isNaN(amount) || amount <= 0 || amount > wallet.balance_usdc) {
      alert('Insufficient funds or invalid amount');
      return;
    }

    setProcessing(true);
    const entryPrice = currentTicker.price;
    const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 1 Minute

    try {
      // 1. Deduct cost from wallet
      const newBalance = wallet.balance_usdc - amount;
      await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      setWallet({ ...wallet, balance_usdc: newBalance });

      // 2. Create Order
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

      addNotification(profile.id, 'Synchronization Active', `Synchronized ${type.toUpperCase()} node for 60s.`, 'success');
      setTradeAmount('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Node Error: Transmission Interrupted');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 -mt-2 md:mt-0">
      <div className="hidden md:block -mx-12">
        <MarketTicker />
      </div>

      {/* Asset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-[#0B0E11]/80 backdrop-blur-3xl p-4 md:p-8 rounded-[1.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="flex items-center space-x-6 relative z-10">
          <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
            <div className="w-10 h-10 md:w-16 md:h-16 bg-primary rounded-xl flex items-center justify-center text-black font-black text-2xl italic shadow-2xl">
              {selectedSymbol.split('/')[0].charAt(0)}
            </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center space-x-4 mb-1">
                <h1 className="text-3xl md:text-6xl font-black text-white italic uppercase tracking-tighter font-display leading-none">{selectedSymbol}</h1>
                <div className="flex space-x-2">
                   <span className="text-[10px] font-black px-4 py-1.5 bg-accent/20 text-accent rounded-full border border-accent/30 uppercase tracking-[0.2em] italic">Instant Execution</span>
                   <span className="text-[10px] font-black px-4 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/30 uppercase tracking-[0.2em] italic">High Liquidity</span>
                </div>
             </div>
             <div className="flex items-center space-x-8">
                <span className="text-3xl md:text-5xl font-mono font-black text-white italic tracking-tighter font-display">
                  ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
                <span className={`px-4 py-1.5 rounded-xl text-[14px] font-black flex items-center italic shadow-lg ${(currentTicker?.change || 0) >= 0 ? 'bg-accent/20 text-accent' : 'bg-error/20 text-error'}`}>
                   {(currentTicker?.change || 0) >= 0 ? <TrendingUp size={18} className="mr-2" /> : <TrendingDown size={18} className="mr-2" />}
                   {(currentTicker?.change || 0) >= 0 ? '+' : ''}{currentTicker?.change?.toFixed(2) || '0.00'}%
                </span>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 md:space-x-3 bg-white/2 p-2 rounded-2xl border border-white/5 relative z-10">
          {timeframes.map(tf => (
            <button
              key={tf} onClick={() => setSelectedTimeframe(tf)}
              className={`px-6 py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] italic transition-all shrink-0 ${selectedTimeframe === tf ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 md:gap-8">
        <div className="lg:col-span-3 space-y-6 md:space-y-8 order-1">
          {/* Main Chart with Bybit-style Floating Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 md:p-8 h-[450px] md:h-[750px] flex flex-col relative group"
          >
            <div className="absolute top-8 right-8 z-20 flex flex-col items-end space-y-4">
               {activePositions.length > 0 && (
                 <div className="bg-primary/90 text-black p-4 rounded-2xl shadow-2xl backdrop-blur-md border border-white/20 animate-pulse">
                    <div className="flex items-center space-x-3 mb-1">
                       <Clock size={16} className="animate-spin-slow" />
                       <span className="text-[10px] font-black uppercase tracking-widest italic">Node Active (60s)</span>
                    </div>
                    <p className="text-sm font-black italic">AUTO-SETTLE SEQUENCE INITIALIZED</p>
                 </div>
               )}
            </div>

            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-8">
               <div className="flex space-x-12">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest mb-1">Index Price</span>
                     <span className="text-xl font-mono font-black text-white italic tracking-tighter">${currentTicker?.price?.toLocaleString() || '0.00'}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest mb-1">24h Vol (USDC)</span>
                     <span className="text-xl font-mono font-black text-slate-300 italic tracking-tighter">${(currentTicker?.volume ? currentTicker.volume / 1e6 : 0).toFixed(2)}M</span>
                  </div>
               </div>
               <div className="flex items-center space-x-4">
                  <Activity size={24} className="text-primary animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Mark Streaming Verified</span>
               </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          {/* Active Positions (The "Flash Trade" View) */}
          <div className="space-y-6">
            <h3 className="text-sm font-black text-white italic tracking-[0.4em] uppercase ml-4">Live Positions ({activePositions.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <AnimatePresence>
                 {activePositions.map((pos) => (
                   <LivePositionCard key={pos.id} position={pos} currentPrice={currentTicker?.price || 0} />
                 ))}
               </AnimatePresence>
               {activePositions.length === 0 && (
                 <div className="md:col-span-2 glass-card p-12 flex flex-col items-center justify-center border-dashed text-slate-600">
                    <LayoutDashboard size={40} className="mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase italic tracking-[0.2em]">No active nodes discovered. Execute a Flash Trade below.</p>
                 </div>
               )}
            </div>
          </div>

          <div className="block lg:hidden">
            <FlashTradePanel tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} wallet={wallet} processing={processing} onOpen={openFlashTrade} />
          </div>

          <OrderHistoryLog orders={recentOrders} />
        </div>

        <div className="hidden lg:block space-y-8 lg:sticky lg:top-8 self-start order-2">
          <FlashTradePanel tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} wallet={wallet} processing={processing} onOpen={openFlashTrade} />
          <TradingChat />
          <MarketPulse tickers={tickers} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
        </div>
      </div>
    </div>
  );
};

// --- FLASH TRADE UI PANELS ---

function FlashTradePanel({ tradeAmount, setTradeAmount, wallet, processing, onOpen }: any) {
  return (
    <div className="bg-[#1C2023] rounded-[1.5rem] border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 bg-[#252930] flex items-center justify-between border-b border-white/5">
         <h3 className="font-black text-xs uppercase tracking-[0.3em] italic text-primary font-display flex items-center">
            <Zap size={16} className="mr-3" />
            Neural-S Execution
         </h3>
         <div className="px-3 py-1 bg-primary/10 rounded-lg text-[9px] font-black text-primary italic border border-primary/20">60s WINDOW</div>
      </div>
      <div className="p-8 space-y-8">
         <div className="space-y-3">
            <div className="flex justify-between px-1">
               <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Entry Exposure</span>
               <span className="text-[10px] font-bold text-white italic">Available: ${(wallet?.balance_usdc || 0).toLocaleString()} USDC</span>
            </div>
            <div className="relative group">
               <input 
                 type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)}
                 className="w-full bg-[#0B0E11] p-6 pr-20 rounded-2xl border border-white/10 text-xl font-black italic font-display focus:border-primary/50 focus:ring-0 transition-all"
                 placeholder="0.00"
               />
               <span className="absolute right-6 top-6 text-xs font-black text-slate-600 italic tracking-[0.2em]">USDC</span>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-6">
            <button 
              onClick={() => onOpen('long')} disabled={processing}
              className="flex flex-col items-center justify-center p-8 bg-[#0ECB81] hover:bg-[#12e291] text-black rounded-3xl shadow-xl transition-all hover:scale-[1.05] group"
            >
               <TrendingUp size={32} className="mb-2 group-hover:-translate-y-1 transition-transform" />
               <span className="text-sm font-black italic tracking-widest uppercase">Open Long</span>
               <span className="text-[8px] font-black opacity-60 uppercase tracking-widest mt-1">Bullish Node</span>
            </button>
            <button 
              onClick={() => onOpen('short')} disabled={processing}
              className="flex flex-col items-center justify-center p-8 bg-[#F6465D] hover:bg-[#ff5d72] text-white rounded-3xl shadow-xl transition-all hover:scale-[1.05] group"
            >
               <TrendingDown size={32} className="mb-2 group-hover:translate-y-1 transition-transform" />
               <span className="text-sm font-black italic tracking-widest uppercase">Open Short</span>
               <span className="text-[8px] font-black opacity-60 uppercase tracking-widest mt-1">Bearish Node</span>
            </button>
         </div>

         <div className="p-5 bg-white/2 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between text-[10px] font-black italic tracking-widest">
               <span className="text-slate-500 uppercase">Settlement Period</span>
               <span className="text-primary italic">INSTANT 60s T+0</span>
            </div>
            <div className="flex justify-between text-[10px] font-black italic tracking-widest">
               <span className="text-slate-500 uppercase">Flash Protocol</span>
               <span className="text-accent italic">BYBIT ALPHA V4</span>
            </div>
         </div>
      </div>
    </div>
  );
}

function LivePositionCard({ position, currentPrice }: any) {
  const [timeLeft, setTimeLeft] = useState(60);
  const entryPrice = position.price_at_execution;
  const isLong = position.type === 'long';
  const priceChange = (currentPrice - entryPrice) / entryPrice;
  const pnlPct = isLong ? priceChange * 100 : -priceChange * 100;
  const pnlUsdc = position.amount_usdc * (pnlPct / 100);

  useEffect(() => {
    const start = new Date(position.created_at).getTime();
    const expiry = new Date(position.expires_at).getTime();
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, [position]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass-card p-6 border-white/10 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-2 h-full ${pnlPct >= 0 ? 'bg-accent shadow-[0_0_20px_var(--accent)]' : 'bg-error shadow-[0_0_20px_var(--error)]'}`} />
      <div className="flex justify-between items-start mb-6">
         <div className="flex items-center space-x-4">
            <div className={`p-4 rounded-2xl ${isLong ? 'bg-accent/10 border-accent/20' : 'bg-error/10 border-error/20'} border`}>
               {isLong ? <ArrowUpRight className={isLong ? 'text-accent' : 'text-error'} size={24} /> : <ArrowDownLeft className={isLong ? 'text-accent' : 'text-error'} size={24} />}
            </div>
            <div>
               <h4 className="text-base font-black text-white italic uppercase tracking-tighter">{position.symbol} <span className={isLong ? 'text-accent' : 'text-error'}>{position.type.toUpperCase()}</span></h4>
               <p className="text-[10px] font-black text-slate-500 italic uppercase tracking-widest">Entry: ${entryPrice.toLocaleString()}</p>
            </div>
         </div>
         <div className="text-right">
            <div className="flex items-center justify-end space-x-2 text-primary font-black italic">
               <Clock size={14} className="animate-spin-slow" />
               <span className="text-sm font-mono">{timeLeft}s</span>
            </div>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1 italic">TIME REMAINING</p>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-6 bg-black/40 p-5 rounded-2xl border border-white/5">
         <div>
            <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest block mb-1">Exposure</span>
            <span className="text-lg font-mono font-black text-white italic">${position.amount_usdc.toFixed(2)}</span>
         </div>
         <div className="text-right">
            <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest block mb-1">Unrealized PnL</span>
            <span className={`text-lg font-mono font-black italic ${pnlPct >= 0 ? 'text-accent' : 'text-error'}`}>
               {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </span>
         </div>
      </div>

      <div className="mt-6 flex justify-between items-center relative z-10">
         <div className="flex items-center space-x-3 text-[10px] font-black italic uppercase tracking-widest">
            <span className="text-slate-500">Net Return:</span>
            <span className={pnlUsdc >= 0 ? 'text-accent' : 'text-error'}>{pnlUsdc >= 0 ? '+' : ''}${pnlUsdc.toFixed(2)}</span>
         </div>
         <span className="text-[8px] font-black text-primary uppercase italic tracking-[0.3em] animate-pulse">TRANSMITTING...</span>
      </div>
    </motion.div>
  );
}

function OrderHistoryLog({ orders }: any) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 bg-white/2 border-b border-white/5 flex justify-between items-center">
         <div className="flex items-center space-x-3">
            <History className="text-primary" size={18} />
            <h3 className="text-xs font-black uppercase tracking-[0.4em] italic text-white font-display">Neural Settlement Archive</h3>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[350px] no-scrollbar">
         {orders.map((order: any) => (
           <div key={order.id} className="p-6 border-b border-white/5 flex items-center justify-between hover:bg-white/2 transition-all">
              <div className="flex items-center space-x-4">
                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black italic text-[10px] ${order.pnl_realized >= 0 ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-error/10 text-error border border-error/20'}`}>
                    {order.type === 'long' ? 'L' : 'S'}
                 </div>
                 <div>
                    <h5 className="text-sm font-black text-white italic uppercase tracking-tighter">{order.symbol}</h5>
                    <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">{new Date(order.created_at).toLocaleString()}</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className={`text-base font-mono font-black italic tracking-tighter ${order.pnl_realized >= 0 ? 'text-accent' : 'text-error'}`}>
                    {order.pnl_realized >= 0 ? '+' : ''}${order.pnl_realized.toFixed(2)}
                 </p>
                 <p className="text-[9px] font-black text-slate-600 uppercase italic tracking-widest">Entry: ${order.price_at_execution?.toLocaleString()}</p>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}

function MarketPulse({ tickers, selectedSymbol, onSelect }: any) {
  return (
    <div className="glass-card overflow-hidden border-white/10 shadow-2xl">
      <div className="p-6 bg-[#252930] flex items-center justify-between border-b border-white/10">
         <h3 className="font-black text-xs uppercase tracking-[0.3em] italic text-white flex items-center">Market Streaming</h3>
         <div className="flex items-center space-x-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            <span className="text-[8px] font-black text-slate-500 uppercase italic tracking-widest">Live</span>
         </div>
      </div>
      <div className="max-h-[450px] overflow-y-auto no-scrollbar">
        {tickers.map((ticker: any) => (
          <button
            key={ticker.symbol} onClick={() => onSelect(ticker.symbol)}
            className={`w-full flex items-center justify-between px-6 py-5 hover:bg-white/5 transition-all relative group ${selectedSymbol === ticker.symbol ? 'bg-primary/5' : ''}`}
          >
            {selectedSymbol === ticker.symbol && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_var(--primary)]" />}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-sm font-black italic border border-white/5 group-hover:border-primary/20 transition-all font-display">
                {ticker.symbol.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-base font-black text-white italic leading-none mb-1">{ticker.symbol}</p>
                <p className="text-[9px] font-black text-slate-600 uppercase italic tracking-widest">${(ticker.volume / 1000).toFixed(1)}k VOL</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-mono font-bold text-white italic tracking-tighter leading-none mb-1">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              <p className={`text-[10px] font-black italic ${ticker.change >= 0 ? 'text-accent' : 'text-error'}`}>
                {ticker.change >= 0 ? '+' : ''}{ticker.change.toFixed(2)}%
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TradingDashboard;
