import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  icon: Icon, 
  change, 
  trend = 'neutral',
  delay = 0 
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card p-6 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary border border-primary/10">
          <Icon size={20} />
        </div>
        {change && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-accent/20 text-accent' : 
            trend === 'down' ? 'bg-rose-500/20 text-rose-500' : 
            'bg-white/5 text-slate-400'
          }`}>
            {change}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{label}</p>
        <h3 className="text-2xl font-bold text-white mt-1 tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );
};
