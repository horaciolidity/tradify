import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, Maximize2, Settings, ShieldCheck, Zap, Activity, ChevronRight, History, PieChart, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { profile, wallet, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [currentTicker, setCurrentTicker] = useState<TickerData | null>(null);
  const [assetBalance, setAssetBalance] = useState(0);
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

  // Update currentTicker when tickers or selectedSymbol changes
  useEffect(() => {
    const active = tickers.find(t => t.symbol === selectedSymbol);
    if (active) setCurrentTicker(active);
  }, [tickers, selectedSymbol]);

  // Fetch Asset Balance
  useEffect(() => {
    if (profile && selectedSymbol) {
      fetchAssetBalance();
      fetchOrders();
    }
  }, [profile, selectedSymbol]);

  const fetchAssetBalance = async () => {
    const symbolOnly = selectedSymbol.split('/')[0];
    const { data } = await supabase
      .from('user_assets')
      .select('balance')
      .eq('user_id', profile?.id)
      .eq('symbol', symbolOnly)
      .maybeSingle();
    
    if (data) setAssetBalance(data.balance);
    else setAssetBalance(0);
  };

  const fetchOrders = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setRecentOrders(data);
  };

  const handleTrade = async () => {
    if (!profile || !wallet || !currentTicker || !tradeAmount || processing) return;
    
    const amountUsdc = parseFloat(tradeAmount);
    if (isNaN(amountUsdc) || amountUsdc <= 0) return;

    setProcessing(true);
    const symbolOnly = selectedSymbol.split('/')[0];
    const currentPrice = currentTicker.price;

    try {
      if (tradeType === 'buy') {
        const cost = amountUsdc;
        if (cost > wallet.balance_usdc) throw new Error('Insufficient USDC balance');

        const assetReceived = cost / currentPrice;

        // 1. Log order and transaction first (safety)
        const { error: orderError } = await supabase.from('orders').insert({
          user_id: profile.id,
          symbol: selectedSymbol,
          type: 'buy',
          amount_usdc: cost,
          amount_asset: assetReceived,
          price_at_execution: currentPrice,
          status: 'completed'
        });
        if (orderError) throw orderError;

        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'trade',
          amount: cost,
          description: `Buy ${assetReceived.toFixed(6)} ${symbolOnly} @ $${currentPrice.toLocaleString()}`,
          status: 'completed'
        });

        // 2. Update USDC Balance
        const newUsdcBalance = wallet.balance_usdc - cost;
        await supabase
          .from('wallets')
          .update({ balance_usdc: newUsdcBalance })
          .eq('user_id', profile.id);
        
        setWallet({ ...wallet, balance_usdc: newUsdcBalance });

        // 3. Update Asset Balance
        const { data: existingAsset } = await supabase
          .from('user_assets')
          .select('*')
          .eq('user_id', profile.id)
          .eq('symbol', symbolOnly)
          .maybeSingle();
        
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

        await addNotification(profile.id, 'Order Executed', `Bought ${assetReceived.toFixed(6)} ${symbolOnly}`, 'success');
      } else {
        // SELL
        const assetToSell = amountUsdc / currentPrice;
        if (assetToSell > assetBalance) throw new Error(`Insufficient ${symbolOnly} balance`);

        // 1. Log order and transaction
        const { error: orderError } = await supabase.from('orders').insert({
          user_id: profile.id,
          symbol: selectedSymbol,
          type: 'sell',
          amount_usdc: amountUsdc,
          amount_asset: assetToSell,
          price_at_execution: currentPrice,
          status: 'completed'
        });
        if (orderError) throw orderError;

        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'trade',
          amount: amountUsdc,
          description: `Sell ${assetToSell.toFixed(6)} ${symbolOnly} @ $${currentPrice.toLocaleString()}`,
          status: 'completed'
        });

        // 2. Update Asset Balance
        await supabase
          .from('user_assets')
          .update({ balance: assetBalance - assetToSell })
          .eq('user_id', profile.id)
          .eq('symbol', symbolOnly);

        // 3. Update USDC Balance
        const newUsdcBalance = wallet.balance_usdc + amountUsdc;
        await supabase
          .from('wallets')
          .update({ balance_usdc: newUsdcBalance })
          .eq('user_id', profile.id);

        setWallet({ ...wallet, balance_usdc: newUsdcBalance });

        await addNotification(profile.id, 'Order Executed', `Sold ${assetToSell.toFixed(6)} ${symbolOnly}`, 'success');
      }
      
      setTradeAmount('');
      fetchAssetBalance();
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Transmission Interrupted');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 pb-10 -mt-2 md:mt-0">
      {/* Ticker Tape */}
      <div className="hidden md:block -mx-12">
        <MarketTicker />
      </div>

      {/* Asset Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-dark-lighter/30 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] border border-white/5 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
        
        <div className="flex items-center space-x-4 md:space-x-6 relative z-10">
          <div className="hidden sm:block p-3 md:p-5 bg-primary/20 rounded-2xl md:rounded-[2rem] border border-primary/20">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-primary rounded-xl md:rounded-[1.5rem] flex items-center justify-center text-black font-black text-xl md:text-2xl italic shadow-2xl">
              {selectedSymbol.split('/')[0].charAt(0)}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 md:space-x-4 mb-1">
              <h1 className="text-2xl md:text-5xl font-black text-white italic uppercase tracking-tighter font-display leading-none">{selectedSymbol}</h1>
              <span className="text-[10px] md:text-xs font-black px-3 md:px-5 py-1 bg-primary/10 text-primary rounded-full border border-primary/20 uppercase tracking-[0.2em] italic">Spot Market</span>
            </div>
            <div className="flex items-center space-x-4 md:space-x-8">
              <div className="flex items-center space-x-4">
                <span className="text-2xl md:text-4xl font-mono font-black text-white italic tracking-tighter font-display">
                  ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </span>
                <span className={`px-3 py-1 md:px-5 md:py-2 rounded-lg md:rounded-2xl text-[12px] md:text-base font-black flex items-center italic shadow-lg ${(currentTicker?.change || 0) >= 0 ? 'bg-accent/20 text-accent' : 'bg-error/20 text-error'}`}>
                  {(currentTicker?.change || 0) >= 0 ? <TrendingUp size={16} className="mr-2" /> : <TrendingDown size={16} className="mr-2" />}
                  {(currentTicker?.change || 0) >= 0 ? '+' : ''}{currentTicker?.change?.toFixed(2) || '0.00'}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 md:space-x-3 bg-white/2 p-2 rounded-2xl border border-white/5 relative z-10 overflow-x-auto no-scrollbar">
          {timeframes.map(tf => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-4 md:px-6 py-2 md:py-3 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] italic transition-all shrink-0 ${selectedTimeframe === tf ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-white'}`}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 md:p-8 h-[400px] md:h-[700px] flex flex-col"
          >
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
              <div className="flex items-center space-x-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-600 uppercase italic">High (24h)</span>
                  <span className="text-sm md:text-base font-mono font-bold text-white">${currentTicker?.high?.toLocaleString() || '0.00'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-600 uppercase italic">Low (24h)</span>
                  <span className="text-sm md:text-base font-mono font-bold text-white">${currentTicker?.low?.toLocaleString() || '0.00'}</span>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="hidden sm:flex flex-col items-end">
                   <span className="text-[10px] font-black text-slate-500 uppercase italic">Market Liquidity</span>
                   <span className="text-sm font-bold text-primary italic">SYNCHRONIZED</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Activity size={18} className="text-primary animate-pulse" />
                </div>
              </div>
            </div>
            <div ref={chartContainerRef} className="flex-1 w-full" />
          </motion.div>

          <div className="block lg:hidden">
            <TradePanelWidget 
              tradeType={tradeType} setTradeType={setTradeType}
              tradeAmount={tradeAmount} setTradeAmount={setTradeAmount}
              wallet={wallet} assetBalance={assetBalance}
              currentTicker={currentTicker} symbolOnly={symbolOnly}
              processing={processing} handleTrade={handleTrade}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <OrderHistoryWidget orders={recentOrders} />
            <PortfolioStatsWidget balance={wallet?.balance_usdc} assets={assetBalance} symbol={symbolOnly} />
          </div>

          <AnnouncementCarousel />
        </div>

        <div className="hidden lg:block space-y-8 lg:sticky lg:top-8 self-start order-2">
          <TradingChat />
          <TradePanelWidget 
            tradeType={tradeType} setTradeType={setTradeType}
            tradeAmount={tradeAmount} setTradeAmount={setTradeAmount}
            wallet={wallet} assetBalance={assetBalance}
            currentTicker={currentTicker} symbolOnly={symbolOnly}
            processing={processing} handleTrade={handleTrade}
          />
          <MarketListWidget 
            tickers={tickers} selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol}
          />
        </div>
      </div>
    </div>
  );
};

// --- DATA RECORDING PANELS ---

function OrderHistoryWidget({ orders }: { orders: any[] }) {
  return (
    <div className="glass-card flex flex-col h-[400px]">
      <div className="p-4 md:p-6 border-b border-white/5 bg-white/2 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <History size={18} className="text-primary" />
          <h3 className="font-black text-xs uppercase tracking-[0.2em] italic text-white font-display">Neural Execution Log</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-600">
            <Clock size={32} className="mb-4 opacity-20" />
            <p className="text-[10px] font-bold uppercase italic tracking-widest">No nodes executed yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {orders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-white/2 transition-all group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${order.type === 'buy' ? 'bg-accent shadow-[0_0_8px_var(--accent)]' : 'bg-error shadow-[0_0_8px_var(--error)]'}`} />
                    <span className="text-[10px] font-black uppercase italic text-white tracking-widest">{order.type}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase">{new Date(order.created_at).toLocaleTimeString()}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-white italic tracking-tighter">${order.amount_usdc.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-500 uppercase italic">{order.symbol} @ ${order.price_at_execution.toLocaleString()}</span>
                  <span className="text-[9px] font-black text-primary italic">+{order.amount_asset.toFixed(6)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioStatsWidget({ balance, assets, symbol }: any) {
  return (
    <div className="glass-card p-6 flex flex-col justify-between overflow-hidden relative group">
      <div className="absolute top-0 right-0 p-8 opacity-5 -mr-4 -mt-4 transition-transform group-hover:scale-125 duration-700">
        <PieChart size={120} className="text-primary" />
      </div>
      
      <div>
        <div className="flex items-center space-x-3 mb-8">
          <PieChart size={18} className="text-accent" />
          <h3 className="font-black text-xs uppercase tracking-[0.2em] italic text-white font-display">Synchronized Core</h3>
        </div>
        
        <div className="space-y-6 relative z-10">
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase italic block mb-2 tracking-widest">Available Flux (USDC)</span>
            <span className="text-3xl md:text-4xl font-black text-white italic tracking-tighter font-display">
              ${(balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">Allocated {symbol}</span>
              <span className="text-[10px] font-bold text-accent italic">ACTIVE</span>
            </div>
            <div className="flex items-baseline space-x-3">
              <span className="text-xl font-black text-white italic tracking-tighter font-display">{(assets || 0).toFixed(6)}</span>
              <span className="text-xs font-black text-slate-400 italic">{symbol}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex space-x-4">
           <div className="flex items-center space-x-2">
             <ArrowUpRight size={14} className="text-accent" />
             <span className="text-[10px] font-bold text-white italic tracking-tighter font-display">P/L: +12.5%</span>
           </div>
        </div>
        <span className="text-[8px] font-black text-slate-600 uppercase italic tracking-[0.3em]">Institutional Grade</span>
      </div>
    </div>
  );
}

// --- ESSENTIAL PANELS ---

function TradePanelWidget({ 
  tradeType, setTradeType, tradeAmount, setTradeAmount, 
  wallet, assetBalance, currentTicker, symbolOnly, 
  processing, handleTrade 
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      className="glass-card overflow-hidden"
    >
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
        <h3 className="font-black text-xs uppercase tracking-[0.3em] italic text-white text-trader">Neural Order</h3>
        <div className="flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[8px] font-black text-slate-500 uppercase italic tracking-widest">EXECUTION Ready</span>
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="flex p-1.5 bg-black/40 rounded-[1.25rem] border border-white/5">
          <button 
            onClick={() => setTradeType('buy')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all ${tradeType === 'buy' ? 'bg-accent text-black shadow-xl shadow-accent/20 scale-[1.02]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            BUY {symbolOnly}
          </button>
          <button 
            onClick={() => setTradeType('sell')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all ${tradeType === 'sell' ? 'bg-error text-white shadow-xl shadow-error/20 scale-[1.02]' : 'text-slate-500 hover:text-slate-300'}`}
          >
            SELL {symbolOnly}
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">Amount to Invest</span>
              <span className="text-[9px] font-bold text-white uppercase italic">Max: {tradeType === 'buy' ? (wallet?.balance_usdc || 0).toLocaleString() : (assetBalance * (currentTicker?.price || 0)).toFixed(2)} USDC</span>
            </div>
            <div className="relative group">
              <input 
                type="number" value={tradeAmount}
                onChange={(e) => setTradeAmount(e.target.value)}
                className="input-field w-full pr-20 text-xl font-black italic p-5 bg-white/2 rounded-2xl border border-white/10 group-hover:border-primary/50 transition-all font-display" 
                placeholder="0.00" 
              />
              <div className="absolute right-5 top-5 flex items-center space-x-2">
                 <div className="w-[1px] h-6 bg-white/10" />
                 <span className="text-[10px] font-black text-primary uppercase italic tracking-widest">USDC</span>
              </div>
            </div>
          </div>
          
          <div className="pt-2">
            <div className="bg-white/2 rounded-2xl p-4 border border-white/5 space-y-3 mb-6">
               <div className="flex justify-between items-center text-[10px] font-black italic">
                 <span className="text-slate-500 uppercase tracking-widest">Estimated Yield</span>
                 <span className="text-white">~ {currentTicker ? (parseFloat(tradeAmount || '0') / currentTicker.price).toFixed(6) : '0.000'} {symbolOnly}</span>
               </div>
               <div className="flex justify-between items-center text-[10px] font-black italic">
                 <span className="text-slate-500 uppercase tracking-widest">Slippage Protocol</span>
                 <span className="text-accent text-[9px]">PROTECTED (Neural Match)</span>
               </div>
            </div>
            
            <button 
              onClick={handleTrade} disabled={processing}
              className={`w-full py-6 rounded-2xl font-black text-xs uppercase tracking-[0.6em] italic transition-all flex items-center justify-center space-x-3 shadow-2xl relative overflow-hidden group/btn ${
                tradeType === 'buy' 
                  ? 'bg-accent text-black shadow-accent/20' 
                  : 'bg-error text-white shadow-error/20'
              }`}>
              <div className="absolute inset-0 bg-white opacity-0 group-hover/btn:opacity-10 transition-opacity" />
              <span>{processing ? 'TRANSMITTING...' : `${tradeType === 'buy' ? 'INITIATE PURCHASE' : 'LIQUIDATE POSITION'}`}</span>
              <ChevronRight size={20} className="group-hover/btn:translate-x-2 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MarketListWidget({ tickers, selectedSymbol, setSelectedSymbol }: any) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/2">
        <h3 className="font-black text-xs uppercase tracking-[0.3em] italic text-white flex items-center font-display">
          Market Pulse
        </h3>
        <span className="text-[8px] font-black text-accent uppercase tracking-[0.2em] animate-pulse italic">Connecting Nodes...</span>
      </div>
      <div className="max-h-[450px] overflow-y-auto no-scrollbar py-2">
        {tickers.map((ticker: any) => (
          <button
            key={ticker.symbol}
            onClick={() => setSelectedSymbol(ticker.symbol)}
            className={`w-full flex items-center justify-between px-6 py-5 hover:bg-white/5 transition-all relative group ${selectedSymbol === ticker.symbol ? 'bg-primary/5' : ''}`}
          >
            {selectedSymbol === ticker.symbol && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-sm font-black italic border border-white/5 group-hover:border-primary/20 group-hover:text-primary transition-all">
                {ticker.symbol.charAt(0)}
              </div>
              <div className="text-left">
                <p className="text-base font-black text-white italic leading-tight">{ticker.symbol}</p>
                <div className="flex items-center space-x-2">
                   <div className={`w-1 h-1 rounded-full ${ticker.change >= 0 ? 'bg-accent' : 'bg-error'}`} />
                   <p className="text-[9px] font-black text-slate-500 uppercase italic tracking-widest">${(ticker.volume / 1000).toFixed(1)}k VOL</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-base font-mono font-bold text-white italic tracking-tighter">${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
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
