import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MarketService, TickerData } from '../services/market';
import { TrendingUp, TrendingDown } from 'lucide-react';

const MarketTicker: React.FC = () => {
  const [tickers, setTickers] = useState<TickerData[]>([]);

  useEffect(() => {
    MarketService.startSimulation();
    const unsubscribe = MarketService.subscribe((data) => {
      setTickers(data);
    });
    return () => { unsubscribe(); };
  }, []);

  if (tickers.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden bg-white/2 backdrop-blur-xl border-y border-white/5 py-3 group">
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-dark to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-dark to-transparent z-10" />
      
      <motion.div 
        className="flex whitespace-nowrap"
        animate={{ x: [0, -2000] }}
        transition={{ 
          duration: 30, 
          repeat: Infinity, 
          ease: "linear" 
        }}
      >
        {/* Double tickers for seamless loop */}
        {[...tickers, ...tickers].map((t, i) => (
          <div 
            key={`${t.symbol}-${i}`} 
            className="inline-flex items-center space-x-4 px-8 border-r border-white/5 last:border-none group/item cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5 group-hover/item:text-primary transition-colors">
                {t.symbol}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-mono font-bold text-white italic">
                  ${t.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div className={`flex items-center text-[10px] font-black ${t.change >= 0 ? 'text-accent' : 'text-rose-500'}`}>
                  {t.change >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                  {t.change >= 0 ? '+' : ''}{t.change.toFixed(2)}%
                </div>
              </div>
            </div>
            
            {/* Subtle separator glow */}
            <div className="w-[1px] h-6 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default MarketTicker;
