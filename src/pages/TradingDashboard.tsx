import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, ISeriesApi } from 'lightweight-charts';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown, Clock, ShieldCheck, Zap, History, ArrowUpRight, ArrowDownLeft, Info, Activity, Waves, ChevronRight, X, PieChart, Database, UserCheck, UserPlus } from 'lucide-react';
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
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [othersActivePositions, setOthersActivePositions] = useState<any[]>([]);
  const [topTraders, setTopTraders] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const settlingIds = useRef<Set<string>>(new Set());
  const latestBarRef = useRef<any>(null);

  // Audio effects logic
  const playSound = (type: 'profit' | 'whale' | 'loss') => {
    if (!soundEnabled) return;
    const sounds = {
      profit: 'https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3',
      whale: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      loss: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.5;
    audio.play().catch(() => {}); 
  };

  // Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#848E9C',
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 500,
      autoSize: true,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
        scaleMargins: { top: 0.2, bottom: 0.2 },
        autoScale: true,
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#0ECB81',
      downColor: '#F6465D',
      borderVisible: false,
      wickUpColor: '#0ECB81',
      wickDownColor: '#F6465D',
    });

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', 
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const emaSeries = chart.addLineSeries({
      color: 'rgba(252, 186, 44, 0.4)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    const loadData = async () => {
      const data = await MarketService.getHistory(selectedSymbol, selectedTimeframe);
      if (candlestickSeriesRef.current && data.length > 0) {
        candlestickSeriesRef.current.setData(data as any);
        
        // Add Volume Data
        const volData = data.map((d: any) => ({
          time: d.time,
          value: Math.random() * 100, 
          color: d.close >= d.open ? 'rgba(14, 203, 129, 0.3)' : 'rgba(246, 70, 93, 0.3)'
        }));
        volumeSeries.setData(volData as any);

        // Add EMA Data (Simple 20-period for visualization)
        const emaData = data.map((d: any, i: number) => {
          if (i < 20) return null;
          const subset = data.slice(i - 20, i);
          const avg = subset.reduce((acc: number, curr: any) => acc + curr.close, 0) / 20;
          return { time: d.time, value: avg };
        }).filter(Boolean);
        emaSeries.setData(emaData as any);

        latestBarRef.current = { ...data[data.length - 1] };
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
          title: `E-${pos.type.toUpperCase()}`,
        });
        priceLinesRef.current[pos.id] = line;
      }
    });

    // Add markers
    // Add markers
    const getVolumeColor = (amount: number, isFollowed: boolean, type: 'long' | 'short') => {
      if (isFollowed) return '#3B82F6'; // Followed: Priority Blue
      if (amount >= 5000) return '#A855F7'; // Whale: Electric Purple
      if (amount >= 1000) return '#F3BA2F'; // Large: Gold
      return type === 'long' ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)';
    };

    const getMarkerSize = (amount: number, isFollowed: boolean) => {
      if (isFollowed) return 2;
      if (amount >= 5000) return 3; 
      if (amount >= 1000) return 2;
      return 1;
    };

    // Helper to snap a timestamp to the nearest bar time (assuming 15m default if not found)
    const snapToBar = (timestamp: string | number) => {
      const timeSec = Math.floor(new Date(timestamp).getTime() / 1000);
      // Snap to 1-minute intervals (the smallest unit in the sim) to ensure markers stick to bars
      return Math.floor(timeSec / 60) * 60;
    };

    const myMarkers = activePositions
      .filter(p => p.symbol === selectedSymbol && p.status === 'active')
      .map(p => {
        const entry = p.price_at_execution;
        const current = tickers.find(t => t.symbol === p.symbol)?.price || currentTicker?.price || entry;
        const pnl = ((current - entry) / entry) * 100 * (p.type === 'long' ? 1 : -1);
        const pnlText = (pnl >= 0 ? '+' : '') + pnl.toFixed(1) + '%';
        
        return {
          time: snapToBar(p.created_at),
          position: p.type === 'long' ? 'belowBar' : 'aboveBar',
          color: p.type === 'long' ? '#0ECB81' : '#F6465D',
          shape: p.type === 'long' ? 'arrowUp' : 'arrowDown',
          text: pnlText,
          size: 1
        };
      });

    const otherMarkers = othersActivePositions
      .filter(p => p.symbol === selectedSymbol)
      .map(p => {
        const isFollowed = followedIds.has(p.user_id);
        const isWhale = p.amount_usdc >= 5000;
        const color = getVolumeColor(p.amount_usdc, isFollowed, p.type);
        const isActive = p.status === 'active';
        const eventTime = isActive ? p.created_at : p.settled_at;
        
        // Calculate PnL for live trades
        let pnlText = '';
        if (isActive) {
          const entry = p.price_at_execution;
          const current = tickers.find(t => t.symbol === p.symbol)?.price || currentTicker?.price || entry;
          const pnl = ((current - entry) / entry) * 100 * (p.type === 'long' ? 1 : -1);
          pnlText = ` ${(pnl >= 0 ? '+' : '')}${pnl.toFixed(1)}%`;
        }

        return {
          time: snapToBar(eventTime),
          position: p.type === 'long' ? 'belowBar' : 'aboveBar',
          color: isActive ? color : 'rgba(255,255,255,0.2)',
          shape: !isActive ? 'square' : (p.type === 'long' ? 'arrowUp' : 'arrowDown'),
          size: 1,
          text: isActive ? pnlText : '🔚',
        };
      });
    
    candlestickSeriesRef.current.setMarkers([...myMarkers, ...otherMarkers].sort((a, b) => a.time - b.time).slice(-50) as any);

  }, [activePositions, othersActivePositions, followedIds, selectedSymbol]);

  // 1. STABLE TICKER SUBSCRIPTION & REAL-TIME CHART UPDATE
  useEffect(() => {
    MarketService.startSimulation();
    const unsubscribeMarket = MarketService.subscribe((allTickers) => {
      setTickers(allTickers);
      const symbolTicker = allTickers.find(t => t.symbol === selectedSymbol);
      if (symbolTicker) {
        setCurrentTicker(symbolTicker);
        
        // Update Chart in Real-Time
        if (candlestickSeriesRef.current && latestBarRef.current) {
          const currentBar = latestBarRef.current;
          currentBar.close = symbolTicker.price;
          currentBar.high = Math.max(currentBar.high, symbolTicker.price);
          currentBar.low = Math.min(currentBar.low, symbolTicker.price);
          candlestickSeriesRef.current.update(currentBar);
        }
      }
    });

    // SOCIAL REAL-TIME: Listen to all active orders
    const ordersChannel = supabase
      .channel('public-active-orders')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: 'status=eq.active'
      }, async (payload) => {
        const newOrder = payload.new as any;
        
        // Fetch profile for the name and sound logic
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', newOrder.user_id)
          .single();
        
        const enrichedOrder = { ...newOrder, profiles: userData };

        if (newOrder.user_id === profile?.id) {
          setActivePositions(prev => [newOrder, ...prev]);
        } else {
          if (newOrder.amount_usdc >= 5000) {
            playSound('whale');
            addNotification(profile?.id || '', 'WHALE ALERT 🐳', `${userData?.full_name || 'A trader'} just opened a $${newOrder.amount_usdc.toLocaleString()} position!`, 'info');
          }
          
          setOthersActivePositions(prev => {
            const isFollowed = followedIds.has(enrichedOrder.user_id);
            const newList = [enrichedOrder, ...prev];
            const followed = newList.filter(p => followedIds.has(p.user_id));
            const publicTrades = newList.filter(p => !followedIds.has(p.user_id));
            return [...followed, ...publicTrades].slice(0, 30);
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders'
      }, async (payload) => {
        const updated = payload.new as any;
        if (updated.status !== 'active') {
          if (updated.user_id === profile?.id) {
            setActivePositions(prev => prev.filter(p => p.id !== updated.id));
          } else {
            // Fetch profile for the name if not present
            const { data: userData } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', updated.user_id)
              .single();
            
            setOthersActivePositions(prev => {
               const filtered = prev.filter(p => p.id !== updated.id);
               return [{ ...updated, profiles: userData }, ...filtered].slice(0, 30);
            });
          }
        }
      })
      .subscribe();

    // POLLING FAILSAFE: Refresh data every 10 seconds to ensure consistency
    const pollInterval = setInterval(() => {
      if (profile) fetchData();
    }, 10000);

    return () => { 
      unsubscribeMarket();
      supabase.removeChannel(ordersChannel);
      clearInterval(pollInterval);
    };
  }, [selectedSymbol, profile?.id, followedIds]);

  const fetchData = async () => {
    if (!profile?.id) return;

    // 1. Fetch Following List
    const { data: followsData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile.id);
    
    const newFollowedIds = new Set(followsData?.map(f => f.following_id) || []);
    setFollowedIds(newFollowedIds);

    // 2. Fetch Personal Orders
    const { data: myOrders } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    
    if (myOrders) {
      setActivePositions(myOrders.filter(o => o.status === 'active'));
      setRecentOrders(myOrders.filter(o => o.status === 'completed').slice(0, 10));
    }

    // 3. Fetch Others' Active Trades (Limited to 30 for performance)
    const { data: otherOrders } = await supabase
      .from('orders')
      .select('*, profiles(full_name, avatar_url)')
      .neq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (otherOrders) {
      setOthersActivePositions(otherOrders);
    }
  };

  const [isSettlingIds, setIsSettlingIds] = useState<Set<string>>(new Set());

  const activePositionsRef = useRef(activePositions);
  useEffect(() => {
    activePositionsRef.current = activePositions;
  }, [activePositions]);

  // Perpetual Mode: Auto-settlement loop has been removed. Users must manually close trades.

  // 3. UPDATE CHART OVERLAYS
  useEffect(() => {
    if (!candlestickSeriesRef.current || !currentTicker) return;

    // Remove old lines
    Object.values(priceLinesRef.current).forEach(line => {
      candlestickSeriesRef.current?.removePriceLine(line);
    });
    priceLinesRef.current = {};

    // MARKET PRICE LINE
    const marketColor = currentTicker.change >= 0 ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)';
    const marketLine = candlestickSeriesRef.current.createPriceLine({
      price: currentTicker.price,
      color: marketColor,
      lineWidth: 1,
      lineStyle: 0,
      axisLabelVisible: true,
      title: 'MARKET',
    });
    priceLinesRef.current['market'] = marketLine;

    // ENTRY LINES & PNL LABELS
    activePositions.forEach(pos => {
      if (pos.symbol === selectedSymbol && pos.status === 'active') {
        const pnl = pos.type === 'long' 
          ? (currentTicker.price - pos.price_at_execution) 
          : (pos.price_at_execution - currentTicker.price);
        
        const line = candlestickSeriesRef.current?.createPriceLine({
          price: pos.price_at_execution,
          color: pos.type === 'long' ? '#0ECB81' : '#F6465D',
          lineWidth: 2,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `ENTRY ${pos.type.toUpperCase()} (${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)})`,
        });
        priceLinesRef.current[pos.id] = line;
      }
    });

    const markers = activePositions
      .filter(p => p.symbol === selectedSymbol && p.status === 'active')
      .map(p => ({
        time: Math.floor(new Date(p.created_at).getTime() / 1000),
        position: p.type === 'long' ? 'belowBar' : 'aboveBar',
        color: p.type === 'long' ? '#0ECB81' : '#F6465D',
        shape: p.type === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'ENTRY NODE',
      }));
    
    candlestickSeriesRef.current.setMarkers(markers as any);
  }, [activePositions, selectedSymbol, currentTicker?.price]);

  const settleOrder = async (order: any, manualPrice?: number) => {
    if (!profile || !wallet || settlingIds.current.has(order.id)) {
       return;
    }

    // Mark as settling immediately in local refs/state to block other calls
    settlingIds.current.add(order.id);
    setIsSettlingIds(prev => new Set(prev).add(order.id));

    try {
      const targetTicker = tickers.find(t => t.symbol === order.symbol);
      const currentPriceForSettle = manualPrice || targetTicker?.price;

      if (!currentPriceForSettle) {
        addNotification(profile.id, 'Syncing Price', `Live price link for ${order.symbol} temporary unavailable. Retrying...`, 'transaction');
        throw new Error('Price missing');
      }

      const entryPrice = order.price_at_execution;
      const amount = order.amount_usdc;
      
      const priceChangePct = (currentPriceForSettle - entryPrice) / entryPrice;
      let profit = 0;
      if (order.type === 'long') {
        profit = amount * (1 + priceChangePct); 
      } else {
        profit = amount * (1 - priceChangePct);
      }
      const pnlRealized = profit - amount;

      // 1. UPDATE ORDER STATUS FIRST (Atomic Switch)
      // This is crucial: only one process will successfully change status from 'active' to 'completed'
      const { error: orderError, count } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          exit_price: currentPriceForSettle,
          pnl_realized: pnlRealized,
          settled_at: new Date().toISOString()
        }, { count: 'exact' })
        .eq('id', order.id)
        .eq('status', 'active'); // Critical: only update if still active
      
      if (orderError) throw orderError;

      // If no rows were updated, it means another process already settled this trade
      if (count === 0) {
        console.warn(`Order ${order.id} already settled or unavailable.`);
        // Clean up state just in case it's still in the active list
        setActivePositions(prev => prev.filter(p => p.id !== order.id));
        return;
      }

      const updatedOrder = {
        ...order,
        status: 'completed', 
        exit_price: currentPriceForSettle,
        pnl_realized: pnlRealized,
        settled_at: new Date().toISOString()
      };

      // 2. FETCH LATEST WALLET AND UPDATE
      // Since we successfully marked the order as completed, we can now credit the profit
      const { data: latestWallet, error: fetchWalletErr } = await supabase
        .from('wallets')
        .select('balance_usdc')
        .eq('user_id', profile.id)
        .single();
      
      if (fetchWalletErr || !latestWallet) {
        // This is a dangerous state: order is closed but wallet not updated.
        // In a real system, use a DB transaction/RPC.
        throw new Error('Atomic split: Order closed but wallet sync failed. Contact Support.');
      }

      const updatedBalance = Number(latestWallet.balance_usdc) + profit;

      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance_usdc: updatedBalance })
        .eq('user_id', profile.id);

      if (walletError) throw walletError;

      // 3. APPLY UI UPDATES
      setActivePositions(prev => prev.filter(p => p.id !== order.id));
      setRecentOrders(prev => [updatedOrder, ...prev].slice(0, 10));

      setWallet({ ...wallet, balance_usdc: updatedBalance });
      
      const isWin = pnlRealized >= 0;
      addNotification(
        profile.id, 
        'Position Settled', 
        `Operation: ${order.type.toUpperCase()} @ ${currentPriceForSettle.toLocaleString()} | Result: ${isWin ? 'PROFIT' : 'LOSS'} of $${Math.abs(pnlRealized).toFixed(2)}`, 
        isWin ? 'success' : 'transaction'
      );

      // Delayed sync for data consistency
      setTimeout(() => fetchData(), 500);

    } catch (err: any) {
      if (err.message !== 'Price missing') {
        import.meta.env.DEV && console.error("Settlement Logic Trace:", {
          orderId: order.id,
          error: err,
          message: err.message
        });
        addNotification(profile.id, 'Settlement Core Error', `Bridge Sync Failed: ${err.message || 'Network Timeout'}`, 'error');
      }
    } finally {
       settlingIds.current.delete(order.id);
       setIsSettlingIds(prev => {
         const next = new Set(prev);
         next.delete(order.id);
         return next;
       });
    }
  };

  const copyTrade = (order: any) => {
    setSelectedSymbol(order.symbol);
    setTradeAmount(order.amount_usdc.toString());
    addNotification(profile?.id || '', 'Signal Copied', `Synchronized parameters for ${order.symbol}. Check the trade panel.`, 'info');
    document.getElementById('trade-panel')?.scrollIntoView({ behavior: 'smooth' });
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
    // Perpetual Contract: Expiration is set to 1 year from now.
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

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

  const toggleFollow = async (userId: string) => {
    if (!profile) return;
    
    if (followedIds.has(userId)) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('following_id', userId);
      
      if (!error) {
        setFollowedIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({
          follower_id: profile.id,
          following_id: userId
        });
      
      if (!error) {
        setFollowedIds(prev => new Set(prev).add(userId));
      }
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
             <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full" />
             <div className="p-2 md:p-3 bg-[#1C2023] rounded-xl border border-white/10 backdrop-blur-xl group cursor-default">
               <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-lg flex items-center justify-center text-black font-black text-sm md:text-base transition-transform group-hover:scale-105">
                 {selectedSymbol.split('/')[0].charAt(0)}
               </div>
             </div>
          </div>
          <div className="flex-1">
             <div className="flex items-center space-x-3 md:space-x-4 mb-0.5 md:mb-1">
                <h1 className="text-xl md:text-3xl font-black uppercase tracking-tighter leading-none">{selectedSymbol}</h1>
                <div className="px-2 py-0.5 md:px-3 md:py-1 bg-primary/10 border border-primary/20 rounded-full flex items-center space-x-1.5 md:space-x-2">
                   <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                   <span className="text-[7px] md:text-[9px] font-black text-primary uppercase tracking-[0.3em]">OPERATIONAL</span>
                </div>
             </div>
             <div className="flex items-center space-x-6 md:space-x-10">
                <div className="flex flex-col">
                  <span className="text-[7px] md:text-[8px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Benchmark //</span>
                  <span className="text-lg md:text-2xl font-black tracking-tighter uppercase leading-none">
                    ${currentTicker?.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </span>
                </div>
                <div className={`px-2 py-0.5 md:px-3 md:py-1 rounded-lg md:rounded-xl text-[10px] md:text-[12px] font-black flex items-center shadow-xl backdrop-blur-md ${(currentTicker?.change || 0) >= 0 ? 'bg-accent/10 text-accent border border-accent/10' : 'bg-rose-500/10 text-rose-500 border border-rose-500/10'}`}>
                   {(currentTicker?.change || 0) >= 0 ? <TrendingUp size={14} className="mr-2" /> : <TrendingDown size={14} className="mr-2" />}
                   {((currentTicker?.change || 0) >= 0 ? '+' : '') + (currentTicker?.change || 0).toFixed(2)}%
                </div>
             </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-3xl border border-white/10 relative z-10 overflow-x-auto no-scrollbar backdrop-blur-xl">
          {timeframes.map(tf => (
             <button
               key={tf} onClick={() => setSelectedTimeframe(tf)}
               className={`px-3 md:px-5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] transition-all shrink-0 ${selectedTimeframe === tf ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
             >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 md:gap-8 overflow-visible">
        {/* Main Content: Chart + Lists (3 Columns on Desktop) */}
        <div className="lg:col-span-3 space-y-6 md:space-y-8">
          
          {/* Main Visual Terminal / CHART */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 md:p-8 h-[500px] md:h-[700px] flex flex-col relative group overflow-hidden border-white/5 bg-[#0B0E11]/80 shadow-[0_40px_100px_rgba(0,0,0,0.6)]"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[150px] pointer-events-none" />
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
               <div className="flex items-center space-x-12">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest mb-1 block">Live Price Stream</span>
                     <div className="flex items-center space-x-3">
                        <Activity size={16} className="text-primary animate-pulse" />
                        <span className="text-xs font-black text-white italic tracking-widest uppercase">STABLE SYNC</span>
                     </div>
                  </div>
                  <div className="hidden md:flex flex-col">
                     <span className="text-[10px] font-black text-slate-600 uppercase italic tracking-widest mb-1 block">Visual Strategy</span>
                     <div className="flex items-center space-x-3 text-accent">
                        <Waves size={16} />
                        <span className="text-xs font-black italic tracking-widest uppercase">AUTO-INDICATORS ACTIVE</span>
                     </div>
                  </div>
               </div>
               <div className="flex items-center space-x-4">
                  <div className="px-4 py-1 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
                     <span className="text-[8px] font-black text-primary italic tracking-widest uppercase uppercase">U-ID: {profile?.id?.substring(0,6)}</span>
                  </div>
               </div>
            </div>
            
            <div ref={chartContainerRef} className="flex-1 w-full" />

            {/* LIVE PNL FLOATING CARD */}
            <AnimatePresence>
               {activePositions.filter(p => p.symbol === selectedSymbol).length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                    className="absolute top-24 right-8 z-[50]"
                  >
                     <div className={`p-6 rounded-3xl border backdrop-blur-3xl shadow-2xl transition-all duration-500 bg-[#0B0E11]/80 ${
                        activePositions.reduce((acc, p) => {
                           if (p.symbol !== selectedSymbol) return acc;
                           const entry = p.price_at_execution;
                           const curr = tickers.find(t => t.symbol === p.symbol)?.price || currentTicker?.price || entry;
                           const diff = (curr - entry) / entry;
                           return acc + (p.type === 'long' ? diff : -diff);
                        }, 0) >= 0 ? 'border-accent/40 shadow-accent/10' : 'border-error/40 shadow-error/10'
                     }`}>
                        <div className="flex flex-col items-end">
                           <span className="text-[8px] font-black uppercase tracking-[0.3em] mb-1 text-slate-500 italic">Live Deployment PnL</span>
                           <div className="flex items-center space-x-2">
                              <span className={`text-4xl font-black italic tracking-tighter ${
                                activePositions.reduce((acc, p) => {
                                  if (p.symbol !== selectedSymbol) return acc;
                                  const entry = p.price_at_execution;
                                  const curr = tickers.find(t => t.symbol === p.symbol)?.price || currentTicker?.price || entry;
                                  const diff = (curr - entry) / entry;
                                  const gain = p.type === 'long' ? p.amount_usdc * diff : -p.amount_usdc * diff;
                                  return acc + gain;
                                }, 0) >= 0 ? 'text-accent' : 'text-error'
                              }`}>
                                 {activePositions.reduce((acc, p) => {
                                    if (p.symbol !== selectedSymbol) return acc;
                                    const entry = p.price_at_execution;
                                    const curr = tickers.find(t => t.symbol === p.symbol)?.price || currentTicker?.price || entry;
                                    const diff = (curr - entry) / entry;
                                    const gain = p.type === 'long' ? p.amount_usdc * diff : -p.amount_usdc * diff;
                                    return acc + gain;
                                 }, 0).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                              </span>
                              <span className="text-[12px] font-black italic text-slate-500 tracking-widest mt-1">USDC</span>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
          </motion.div>

          <div className="lg:hidden block mb-8">
            <FlashTradePanel tradeAmount={tradeAmount} setTradeAmount={setTradeAmount} wallet={wallet} processing={processing} onOpen={openFlashTrade} />
          </div>

          <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 md:gap-10">
            <div className="2xl:col-span-8 space-y-6 md:space-y-8">
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center space-x-4">
                    <h3 className="terminal-label">Active Trades //</h3>
                    <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
                      <span className="text-[8px] font-black text-primary uppercase tracking-widest">{activePositions.length}</span>
                    </div>
                 </div>
                  <button 
                    disabled={activePositions.some(p => isSettlingIds.has(p.id))}
                    onClick={async () => {
                      for (const p of activePositions) {
                        if (!isSettlingIds.has(p.id)) {
                          await settleOrder(p);
                        }
                      }
                    }}
                    className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 border border-rose-500/30 rounded-full text-[8px] font-black text-rose-500 uppercase italic tracking-widest transition-all"
                  >
                    {activePositions.some(p => isSettlingIds.has(p.id)) ? 'Syncing...' : 'Close All'}
                  </button>
              </div>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {activePositions.map((pos) => (
                    <LiveFlashPositionRow 
                      key={pos.id} 
                      position={pos} 
                      currentPrice={tickers.find(t => t.symbol === pos.symbol)?.price || currentTicker?.price || 0} 
                      isSettling={isSettlingIds.has(pos.id)} 
                      onClose={() => settleOrder(pos, tickers.find(t => t.symbol === pos.symbol)?.price)}
                    />
                  ))}
                </AnimatePresence>
                {activePositions.length === 0 && (
                  <div className="glass-card p-12 flex flex-col items-center justify-center text-slate-700 bg-[#0B0E11]/40 border-white/5 border-dashed">
                     <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4"><Database size={24} className="opacity-20" /></div>
                     <p className="terminal-label text-center leading-loose">Awaiting tactical signals. Deploy your first node above.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="2xl:col-span-4 shrink-0">
               <div className="flex items-center space-x-4 mb-8 px-2 border-b border-white/5 pb-4">
                  <h3 className="terminal-label">Social Trading Feed //</h3>
               </div>
               <OtherTradersLive othersActivePositions={othersActivePositions} onCopy={copyTrade} onFollow={toggleFollow} followedIds={followedIds} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
               <TopTradersSidebar topTraders={topTraders} onFollow={toggleFollow} followedIds={followedIds} />
            </div>
            <div className="lg:col-span-3">
               <TradingChat 
                 activePositions={activePositions} 
                 tickers={tickers} 
                 followedIds={followedIds} 
                 onToggleFollow={toggleFollow} 
               />
            </div>
          </div>
          
          <GlobalNodeTable tickers={tickers} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
        </div>

        {/* Sidebar: Trade Panel (Sticky on PC) */}
        <div className="hidden lg:block space-y-8 lg:sticky lg:top-8 self-start overflow-visible pb-10">
          <FlashTradePanel 
            tradeAmount={tradeAmount} 
            setTradeAmount={setTradeAmount} 
            wallet={wallet} 
            processing={processing} 
            onOpen={openFlashTrade} 
          />
          <TopTradersSidebar topTraders={topTraders} onFollow={toggleFollow} followedIds={followedIds} />
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
               <TrendingUp size={20} className="text-primary" />
            </div>
            <h3 className="font-black text-[9px] uppercase tracking-[0.3em] text-white">Trade Console</h3>
         </div>
         <div className="bg-primary text-black px-3 py-1 rounded-full text-[7px] font-black tracking-widest shadow-md shadow-primary/20 uppercase">Core Sync</div>
      </div>
      <div className="p-4 md:p-6 space-y-6">
         <div className="space-y-3">
            <div className="flex justify-between items-end px-1">
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Margin Amount</span>
               </div>
               <div className="text-right">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block mb-0.5">Liquidity Available</span>
                  <span className="text-[10px] font-bold text-primary tracking-widest">${(wallet?.balance_usdc || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
            </div>
            
            <div className="relative group">
               <input 
                 type="number" value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)}
                 className="relative w-full bg-[#0B0E11] p-4 pr-16 rounded-xl border border-white/5 text-lg font-black text-white focus:border-primary/50 transition-all outline-none placeholder:text-slate-800"
                 placeholder="0.00"
               />
               <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary tracking-widest">USDC</span>
            </div>
         </div>

         <div className="grid grid-cols-4 gap-2">
            {[25, 50, 75, 100].map(pct => (
              <button 
                key={pct} onClick={() => setPercentage(pct)}
                className="py-2.5 bg-white/2 hover:bg-white/5 rounded-lg border border-white/5 text-[9px] font-black text-slate-500 hover:text-primary transition-all uppercase tracking-widest active:scale-95"
              >
                {pct === 100 ? 'MAX' : `${pct}%`}
              </button>
            ))}
         </div>

         <div className="grid grid-cols-2 gap-4 pt-0">
            <button 
              onClick={() => onOpen('long')} disabled={processing}
              className="group flex items-center justify-center space-x-3 py-3.5 bg-accent hover:bg-[#12e291] text-black rounded-xl shadow-lg shadow-accent/10 transition-all hover:scale-[1.02] active:scale-95"
            >
               <TrendingUp size={18} />
               <span className="text-[9px] font-black tracking-widest uppercase">BUY (UP)</span>
            </button>
            <button 
              onClick={() => onOpen('short')} disabled={processing}
              className="group flex items-center justify-center space-x-3 py-3.5 bg-rose-500 hover:bg-[#ff5d72] text-white rounded-xl shadow-lg shadow-rose-500/10 transition-all hover:scale-[1.02] active:scale-95"
            >
               <TrendingDown size={18} />
               <span className="text-[9px] font-black tracking-widest uppercase">SELL (DOWN)</span>
            </button>
         </div>

         <div className="p-8 bg-gradient-to-b from-white/2 to-transparent rounded-[2rem] border border-white/5 space-y-5 backdrop-blur-sm">
            <div className="flex justify-between items-center text-[10px] font-black tracking-[0.2em]">
               <div className="flex items-center space-x-3 text-slate-500">
                  <Clock size={14} />
                  <span className="uppercase">Contract Type</span>
               </div>
               <span className="text-primary italic bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">PERPETUAL</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black italic tracking-[0.2em]">
               <div className="flex items-center space-x-3 text-slate-500">
                  <Activity size={14} />
                  <span className="uppercase">Feed Status</span>
               </div>
               <span className="text-accent italic flex items-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent mr-2 animate-ping" />
                  ACTIVE
               </span>
            </div>
         </div>
      </div>
    </div>
  );
}

function LiveFlashPositionRow({ position, currentPrice, isSettling, onClose }: any) {
  const entryPrice = position.price_at_execution;
  const isLong = position.type === 'long';
  const priceChange = (currentPrice - entryPrice) / entryPrice;
  const pnlPct = isLong ? priceChange * 100 : -priceChange * 100;
  const pnlUsdc = position.amount_usdc * (pnlPct / 100);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="group transition-all hover:bg-white/[0.03] relative border-b border-white/5 last:border-0"
    >
      {(pnlPct > 5) && (
        <div className="absolute inset-0 bg-accent/5 blur-xl pointer-events-none" />
      )}
      
      {/* PROFESSIONAL PC LAYOUT (Table-like density) */}
      <div className="hidden lg:grid grid-cols-[1.5fr,1fr,2fr,1.5fr,1.2fr,1.2fr] gap-4 px-8 py-5 items-center">
         {/* Asset & Direction */}
         <div className="flex items-center space-x-4">
            <div className={`p-2.5 rounded-xl ${isLong ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'bg-error/10 text-error ring-1 ring-error/20'} transition-all group-hover:scale-105`}>
               {isLong ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
            </div>
            <div className="min-w-0">
               <p className="text-sm font-black text-white uppercase tracking-tighter truncate">{position.symbol}</p>
               <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isLong ? 'text-accent' : 'text-error'}`}>{isLong ? 'LONG-NODE' : 'SHORT-NODE'}</span>
            </div>
         </div>

         {/* Position Size */}
         <div className="flex flex-col">
            <span className="terminal-label !text-[8px] opacity-40 mb-1">MARGIN //</span>
            <p className="text-sm font-mono font-bold text-white tracking-tighter">${position.amount_usdc.toFixed(2)}</p>
         </div>

         {/* Price Flow */}
         <div className="flex items-center space-x-4">
            <div className="flex flex-col">
               <span className="terminal-label !text-[8px] opacity-40 mb-1">ENTRY //</span>
               <p className="text-xs font-mono font-bold text-slate-500">{entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <ChevronRight size={14} className="text-slate-800 mt-2" />
            <div className="flex flex-col">
               <span className="terminal-label !text-[8px] opacity-40 mb-1">MARK //</span>
               <p className="text-xs font-mono font-black text-white">{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
         </div>

         {/* PnL Engine */}
         <div className="flex flex-col items-end text-right px-4">
            <div className="flex items-center space-x-2">
               <p className={`text-base font-mono font-black tracking-tighter ${(pnlPct || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                  {(pnlPct || 0) >= 0 ? '+' : ''}${(pnlPct || 0).toFixed(2)}%
               </p>
               <div className={`w-1.5 h-1.5 rounded-full ${(pnlPct || 0) >= 0 ? 'bg-accent shadow-[0_0_10px_#4ade80]' : 'bg-error shadow-[0_0_10px_#fb7185]'} animate-pulse`} />
            </div>
            <p className={`text-[9px] font-mono font-black tracking-wider ${(pnlUsdc || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
               {(pnlUsdc || 0) >= 0 ? '+' : '-'}${Math.abs(pnlUsdc || 0).toFixed(2)} USDC
            </p>
         </div>

         {/* Mode */}
         <div className="flex justify-center">
            <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
               <Activity size={10} className="text-primary opacity-50" />
               <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">PERPETUAL</span>
            </div>
         </div>

         {/* Action */}
         <div className="text-right">
            <button 
              onClick={onClose}
              disabled={isSettling}
              className="w-full px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-white border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all group-hover:shadow-[0_0_20px_rgba(244,63,94,0.3)] active:scale-95 disabled:opacity-50"
            >
               {isSettling ? 'SYNCING' : 'CLOSE NODE'}
            </button>
         </div>
      </div>

      {/* MOBILE / TABLET LAYOUT (The one that was already working) */}
      <div className="lg:hidden flex flex-col gap-4 p-6 items-center">
         <div className="w-full flex items-center justify-between">
            <div className="flex items-center space-x-4">
               <div className={`p-3 rounded-xl ${isLong ? 'bg-accent/10 text-accent ring-1 ring-accent/20' : 'bg-error/10 text-error ring-1 ring-error/20'}`}>
                  {isLong ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
               </div>
               <div>
                  <p className="text-sm font-black text-white italic tracking-tighter uppercase leading-none mb-1">{position.symbol}</p>
                  <span className={`text-[9px] font-black uppercase italic tracking-[0.2em] ${isLong ? 'text-accent' : 'text-error'}`}>{isLong ? 'BUY' : 'SELL'} OPERATION</span>
               </div>
            </div>
            <div className="text-right">
               <p className={`text-lg font-mono font-black italic tracking-tighter ${(pnlPct || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                  {(pnlPct || 0) >= 0 ? '+' : ''}${(pnlPct || 0).toFixed(2)}%
               </p>
            </div>
         </div>

         <div className="w-full grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
            <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Entry Price</span>
               <p className="text-xs font-mono font-bold text-slate-300">${entryPrice.toLocaleString()}</p>
            </div>
            <div className="space-y-1 text-right">
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Mark Price</span>
               <p className="text-xs font-mono font-bold text-white">${currentPrice.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Margin Value</span>
               <p className="text-xs font-mono font-bold text-slate-300">${position.amount_usdc.toFixed(2)}</p>
            </div>
            <div className="space-y-1 text-right">
               <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">Contract</span>
               <p className="text-[10px] font-black text-primary italic uppercase tracking-widest">PERPETUAL</p>
            </div>
         </div>

         <button 
           onClick={onClose}
           disabled={isSettling}
           className="w-full mt-2 py-3 bg-rose-500/10 hover:bg-rose-500 text-white border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] italic active:scale-95 disabled:opacity-50"
         >
            {isSettling ? 'Settling...' : 'Close Flash Position'}
         </button>
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
               <h3 className="text-lg md:text-xl font-black uppercase tracking-[0.4em] italic text-white font-display leading-none">Global Ledger</h3>
               <p className="text-[8px] md:text-[10px] font-black text-slate-600 uppercase italic tracking-[0.2em] mt-1 md:mt-2">Immutable Protocol Record • Archive</p>
            </div>
         </div>
         <div className="hidden md:flex items-center space-x-3 text-[10px] font-black text-slate-500 uppercase italic bg-black/20 px-4 py-1.5 rounded-full border border-white/5">
            <ShieldCheck size={14} className="text-accent" />
            <span>Node Verified Archive</span>
         </div>
      </div>
      
      <div className="max-h-[600px] overflow-y-auto no-scrollbar">
         {orders.map((order: any) => {
           const pnl = order.pnl_realized || 0;
           const isWin = pnl >= 0;
           const durationSec = order.settled_at ? Math.floor((new Date(order.settled_at).getTime() - new Date(order.created_at).getTime()) / 1000) : 60;
           const pnlPct = (pnl / order.amount_usdc) * 100;

           return (
             <div key={order.id} className="group border-b border-white/5 hover:bg-white/[0.02] transition-all p-4 md:p-8 cursor-default">
                <div className="flex items-center justify-between">
                   <div className="flex items-center space-x-3 md:space-x-8 text-white">
                      <div className={`w-10 h-10 md:w-20 md:h-20 rounded-[1.8rem] flex items-center justify-center font-black italic text-sm md:text-3xl border shadow-2xl transition-all group-hover:scale-105 ${order.type === 'long' ? 'bg-[#0ECB81]/10 text-[#0ECB81] border-[#0ECB81]/20 shadow-[#0ECB81]/20' : 'bg-[#F6465D]/10 text-[#F6465D] border-[#F6465D]/20 shadow-[#F6465D]/20'}`}>
                         {order.type === 'long' ? 'UP' : 'DN'}
                      </div>
                      <div>
                         <div className="flex items-center space-x-4 mb-2">
                            <h5 className="text-sm md:text-3xl font-black italic uppercase tracking-tighter leading-none">{order.symbol}</h5>
                            <span className={`text-[9px] md:text-[11px] font-black uppercase italic transition-colors px-3 py-1 rounded-lg border border-current/20 ${isWin ? 'text-accent bg-accent/5' : 'text-error bg-error/5'}`}>
                                {isWin ? 'QUANTUM PROFIT' : 'VECTOR LOSS'}
                             </span>
                         </div>
                         <div className="flex items-center space-x-3 md:space-x-6 opacity-60">
                            <div className="flex flex-col">
                               <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-1">Entry Value</span>
                               <span className="text-[12px] font-mono font-black text-white italic tracking-tighter">${order.price_at_execution?.toLocaleString()}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-800" />
                            <div className="flex flex-col">
                               <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest mb-1">Exit Value</span>
                               <span className="text-[12px] font-mono font-black text-white italic tracking-tighter">${order.exit_price?.toLocaleString()}</span>
                            </div>
                         </div>
                      </div>
                   </div>
 
                   <div className="flex items-center space-x-4 md:space-x-14">
                      <div className="text-right">
                         <div className="flex items-center justify-end space-x-2 mb-1">
                            <span className={`text-[10px] font-black italic tracking-widest ${isWin ? 'text-accent' : 'text-error'}`}>
                               {isWin ? '+' : ''}{pnlPct.toFixed(2)}%
                            </span>
                         </div>
                         <p className={`text-xl md:text-5xl font-mono font-black italic tracking-tighter leading-none mb-3 ${isWin ? 'text-accent' : 'text-error'}`}>
                            {isWin ? '+' : ''}{pnl.toFixed(2)} <span className="text-xs font-normal opacity-50">USDC</span>
                         </p>
                         <div className="flex items-center justify-end space-x-3">
                            <Clock size={12} className="text-slate-700" />
                            <p className="text-[8px] md:text-[11px] font-black text-slate-600 uppercase italic tracking-[0.2em]">{durationSec}S DURATION</p>
                         </div>
                      </div>
                      
                      <button 
                        onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                        className={`p-3 md:p-5 rounded-2xl transition-all active:scale-95 border ${selectedOrder === order.id ? 'bg-primary text-black border-primary shadow-primary/20' : 'bg-white/2 hover:bg-white/5 text-slate-600 border-white/10'}`}
                      >
                         <Info size={24} />
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
                      <div className="mt-10 pt-10 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8 pb-4">
                         <div className="space-y-3">
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] flex items-center">
                               <Clock className="mr-2" size={12} /> Execution Timestamp
                            </p>
                            <p className="text-[13px] text-slate-300 font-black italic tracking-widest">{new Date(order.created_at).toLocaleString()} UTC</p>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] flex items-center">
                               <X className="mr-2" size={12} /> Maturity Timestamp
                            </p>
                             <p className="text-[13px] text-slate-300 font-black italic tracking-widest">{order.settled_at ? new Date(order.settled_at).toLocaleString() : 'EXPIRED'} UTC</p>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] flex items-center">
                               <PieChart className="mr-2" size={12} /> Capital Allocation
                            </p>
                            <p className="text-[13px] text-primary font-black italic tracking-[0.2em]">${order.amount_usdc.toFixed(2)} USDC</p>
                         </div>
                         <div className="space-y-3">
                            <p className="text-[8px] font-black text-slate-700 uppercase tracking-[0.3em] flex items-center">
                               <Database className="mr-2" size={12} /> Protocol Reference
                            </p>
                            <p className="text-[11px] text-slate-600 font-mono tracking-tighter">NODE_{order.id.split('-')[0].toUpperCase()}</p>
                         </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
           );
         })}
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
    <div className="bg-[#1C2023] rounded-3xl border border-white/10 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
      <div className="p-5 bg-[#252930] flex items-center justify-between border-b border-white/10">
         <div className="flex items-center space-x-3">
            <h3 className="terminal-label !text-white opacity-80">Market Assets //</h3>
            <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-full">
               <span className="text-[8px] font-black text-primary uppercase tracking-widest">{tickers.length} NODE PAIRS</span>
            </div>
         </div>
         <div className="flex items-center space-x-1.5">
            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">REAL-TIME FEED ACTIVE</span>
         </div>
      </div>
      <div className="max-h-[500px] overflow-y-auto no-scrollbar divide-y divide-white/[0.02]">
        {/* Table Header for Desktop */}
        <div className="hidden md:grid grid-cols-[1.5fr,1.2fr,1.2fr] gap-4 px-6 py-2 bg-black/10 border-b border-white/5">
           <span className="terminal-label !text-slate-600">Asset Node</span>
           <span className="terminal-label !text-slate-600 text-right">Market Value</span>
           <span className="terminal-label !text-slate-600 text-right">24h Vector</span>
        </div>
        {tickers.map((ticker: any) => {
          const isSelected = selectedSymbol === ticker.symbol;
          return (
            <button
              key={ticker.symbol} onClick={() => onSelect(ticker.symbol)}
              className={`w-full grid grid-cols-[1.2fr,1.2fr,1fr] md:grid-cols-[1.5fr,1.2fr,1.2fr] gap-4 px-6 py-3.5 hover:bg-white/[0.03] transition-all relative group items-center ${isSelected ? 'bg-primary/5' : ''}`}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_20px_#F3BA2F]" />
              )}
              <div className="flex items-center space-x-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border transition-all ${isSelected ? 'bg-primary text-black border-primary' : 'bg-white/5 text-white border-white/10 group-hover:border-primary/40'}`}>
                  {ticker.symbol.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-white tracking-tighter leading-none mb-1">{ticker.symbol}</p>
                  <div className="flex items-center space-x-1.5">
                     <div className="w-1.5 h-0.5 bg-slate-800 rounded-full" />
                     <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">NODE_LINK ACTIVE</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold tracking-tighter leading-none transition-all ${isSelected ? 'text-primary' : 'text-white'}`}>
                   ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <div className={`flex items-center justify-end space-x-1.5 transition-colors ${(ticker.change || 0) >= 0 ? 'text-accent' : 'text-error'}`}>
                   {(ticker.change || 0) >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                   <span className="text-[10px] font-black tracking-widest uppercase">{(ticker.change || 0) >= 0 ? '+' : ''}{(ticker.change || 0).toFixed(2)}%</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TopTradersSidebar({ topTraders, onFollow, followedIds }: any) {
  return (
    <div className="glass-card p-8 bg-[#0B0E11]/40 border-white/5 flex flex-col space-y-6">
      <div className="flex items-center space-x-4 border-b border-white/5 pb-6">
        <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
          <TrendingUp className="text-primary" size={20} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.3em] italic text-white font-display">Master Entities</h3>
      </div>
      <div className="space-y-4">
        {topTraders.map((trader: any, index: number) => {
          const isFollowed = followedIds.has(trader.id);
          return (
            <div key={trader.id} className="flex items-center justify-between group p-2 hover:bg-white/5 rounded-2xl transition-all">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black italic border text-xs shadow-lg ${index === 0 ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {trader.avatar ? <img src={trader.avatar} className="w-full h-full rounded-xl object-cover" /> : trader.name.charAt(0)}
                  </div>
                  {index === 0 && <div className="absolute -top-2 -right-2 bg-primary text-black text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg">#1</div>}
                </div>
                <div>
                  <p className="text-[11px] font-black text-white italic tracking-widest uppercase">{trader.name}</p>
                  <p className="text-[10px] font-mono font-bold text-accent">+${trader.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <button 
                onClick={() => onFollow(trader.id)}
                className={`p-2 rounded-xl border transition-all ${isFollowed ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-white/5 border-white/10 text-slate-600 hover:text-white'}`}
              >
                {isFollowed ? <UserCheck size={16} /> : <UserPlus size={16} />}
              </button>
            </div>
          );
        })}
        {topTraders.length === 0 && <p className="text-[9px] text-slate-600 italic text-center p-4">Calculating elite rankings...</p>}
      </div>
    </div>
  );
}

function OtherTradersLive({ othersActivePositions, onCopy, onFollow, followedIds }: any) {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 px-2">
        <h3 className="text-[10px] font-black text-white italic tracking-[0.4em] uppercase font-display">Live Signal Feed</h3>
        <div className="h-0.5 flex-1 bg-white/5" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
        {othersActivePositions.map((pos: any) => {
          const isFollowed = followedIds.has(pos.user_id);
          const isWhale = pos.amount_usdc >= 1000;
          return (
            <motion.div 
              key={pos.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className={`p-5 rounded-[1.8rem] border backdrop-blur-xl transition-all hover:translate-y-[-4px] ${isWhale ? 'bg-[#A855F7]/5 border-[#A855F7]/20 shadow-[0_20px_40px_rgba(168,85,247,0.1)]' : 'bg-[#1C2023]/60 border-white/5'}`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black italic text-[10px] border ${isFollowed ? 'bg-accent/20 border-accent/40 text-accent' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                    {pos.profiles?.full_name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[9px] font-black text-white uppercase italic tracking-widest">{pos.profiles?.full_name?.split(' ')[0] || 'Unknown'}</span>
                      {isWhale && <span className="animate-pulse">🔥</span>}
                    </div>
                    <span className={`text-[7px] font-black italic tracking-widest ${pos.type === 'long' ? 'text-accent' : 'text-error'}`}>{pos.type.toUpperCase()} SIGNAL</span>
                  </div>
                </div>
                <button 
                  onClick={() => onFollow(pos.user_id)}
                  className={`p-1.5 rounded-lg border transition-all ${isFollowed ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-white/5 border-white/10 text-slate-700'}`}
                >
                  {isFollowed ? <UserCheck size={12} /> : <UserPlus size={12} />}
                </button>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block mb-1">Asset Node</span>
                  <p className="text-sm font-black text-white font-mono italic tracking-tighter">{pos.symbol}</p>
                </div>
                <button 
                  onClick={() => onCopy(pos)}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary hover:bg-white text-black rounded-xl text-[8px] font-black italic tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-primary/20"
                >
                  <Zap size={12} />
                  <span>COPY NODE</span>
                </button>
              </div>
            </motion.div>
          );
        })}
        {othersActivePositions.length === 0 && (
          <div className="col-span-full p-10 border border-dashed border-white/5 rounded-[2rem] flex items-center justify-center">
            <p className="text-[9px] font-black text-slate-700 uppercase italic tracking-widest">Awaiting external signals...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TradingDashboard;
