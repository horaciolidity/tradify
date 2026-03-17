import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Settings, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  EyeOff, 
  DollarSign, 
  Database,
  RefreshCcw,
  Zap
} from 'lucide-react';
import { StatCard } from '../components/StatCard';

const CustomTokens: React.FC = () => {
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Custom Token Ecosystem</h1>
          <p className="text-slate-400 mt-1">Manage and monitor the internal protocol currency.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2 rounded-xl transition-all border border-white/5 shadow-2xl">
            <RefreshCcw size={18} />
            <span>Sync Market</span>
          </button>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center space-x-2 bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-primary/20"
          >
            <Settings size={18} />
            <span>Protocol Settings</span>
          </button>
        </div>
      </div>

      {/* Main Token Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Token Price" value="$1.4285" icon={DollarSign} change="+12.4%" trend="up" delay={0.1} />
        <StatCard label="24h Volume" value="$2.14M" icon={Activity} change="+45.2%" trend="up" delay={0.2} />
        <StatCard label="Total Liquidity" value="$8.50M" icon={Database} change="-2.1%" trend="down" delay={0.3} />
        <StatCard label="Holders" value="12,842" icon={TrendingUp} change="+540" trend="up" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Management Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 glass-card overflow-hidden"
        >
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold">T</div>
              <div>
                <h3 className="font-bold text-white">Tradify Token (TRY)</h3>
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-2 py-0.5 rounded-full">Active</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase">Manual Price</p>
                <div className="flex items-center text-accent font-bold">
                  <TrendingUp size={14} className="mr-1" />
                  <span>ENABLED</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Price Control</h4>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-2 block">Set Current Price (USDC)</label>
                  <div className="relative">
                    <input type="number" className="input-field w-full text-lg font-bold pr-12" defaultValue="1.4285" />
                    <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">USDC</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <button className="flex-1 py-3 text-sm font-bold secondary-button">Reset to Auto</button>
                  <button className="flex-1 py-3 text-sm font-bold primary-button">Update Price</button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Market Simulation</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-500 font-bold">Volatility Index</span>
                      <span className="text-primary font-bold">High (85%)</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[85%]" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-500 font-bold">Liquidity Pressure</span>
                      <span className="text-accent font-bold">Optimal</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent w-[60%]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-white/2 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Max Supply</p>
                <p className="text-lg font-bold text-white tracking-tight">1,000,000,000</p>
              </div>
              <div className="p-4 bg-white/2 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Circulating</p>
                <p className="text-lg font-bold text-white tracking-tight">452,102,400</p>
              </div>
              <div className="p-4 bg-white/2 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Burned</p>
                <p className="text-lg font-bold text-rose-500 tracking-tight">12,500,200</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Sidebar Controls */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-6"
          >
            <h3 className="font-bold text-white mb-4 flex items-center">
              <Zap size={18} className="mr-2 text-primary" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-rose-500/10 text-rose-500 rounded-lg group-hover:scale-110 transition-transform">
                    <EyeOff size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-300">Delist Token</span>
                </div>
                <Plus size={16} className="text-slate-600 rotate-45" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-accent/10 text-accent rounded-lg group-hover:scale-110 transition-transform">
                    <Database size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-300">Inject Liquidity</span>
                </div>
                <Plus size={16} className="text-slate-600" />
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 group">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg group-hover:scale-110 transition-transform">
                    <Activity size={16} />
                  </div>
                  <span className="text-sm font-bold text-slate-300">Airdrop Holders</span>
                </div>
                <Plus size={16} className="text-slate-600" />
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <h3 className="font-bold text-white mb-4">Risk Parameters</h3>
            <div className="space-y-6">
              {[
                { label: 'Slippage Tolerance', value: '0.5%' },
                { label: 'Max Transaction', value: '50,000 TRY' },
                { label: 'Listing Fee', value: '1,000 USDC' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500 font-bold uppercase">{item.label}</span>
                    <span className="text-xs text-white font-bold">{item.value}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full" />
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 text-xs font-bold text-slate-500 hover:text-white transition-colors border border-white/5 rounded-xl uppercase tracking-widest">
              View Audit Logs
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CustomTokens;
