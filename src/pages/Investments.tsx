import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Info,
  ChevronRight,
  PlusCircle,
  History
} from 'lucide-react';
import type { Plan, Investment } from '../types';
import { useAuthStore } from '../store/useAuthStore';

import { supabase } from '../services/supabase';

const Investments: React.FC = () => {
  const { wallet, profile, setWallet } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'plans' | 'active' | 'history'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchPlans();
    if (profile) fetchActiveInvestments();
  }, [profile]);

  const fetchPlans = async () => {
    const { data, error } = await supabase.from('plans').select('*').eq('is_active', true);
    if (!error && data) setPlans(data);
  };

  const fetchActiveInvestments = async () => {
    const { data, error } = await supabase
      .from('investments')
      .select('*, plan:plans(*)')
      .eq('user_id', profile?.id)
      .eq('status', 'active');
    if (!error && data) setActiveInvestments(data);
  };

  const handleInvest = async () => {
    if (!selectedPlan || !profile || !wallet) return;
    const amount = parseFloat(investmentAmount);
    
    if (amount < selectedPlan.min_amount || amount > selectedPlan.max_amount) {
      alert(`Amount must be between ${selectedPlan.min_amount} and ${selectedPlan.max_amount}`);
      return;
    }

    if (amount > wallet.balance_usdc) {
      alert('Insufficient balance');
      return;
    }

    setLoading(true);
    try {
      // 1. Create investment
      const { data: invData, error: invError } = await supabase
        .from('investments')
        .insert({
          user_id: profile.id,
          plan_id: selectedPlan.id,
          amount: amount,
          status: 'active',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + selectedPlan.duration_days * 24 * 60 * 60 * 1000).toISOString()
        })
        .select()
        .single();

      if (invError) throw invError;

      // 2. Update wallet balance
      const newBalance = wallet.balance_usdc - amount;
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance_usdc: newBalance })
        .eq('user_id', profile.id);

      if (walletError) throw walletError;

      // 3. Record transaction
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'investment',
        amount: amount,
        description: `Investment in ${selectedPlan.name}`,
        status: 'completed'
      });

      setWallet({ ...wallet, balance_usdc: newBalance });
      setSelectedPlan(null);
      setInvestmentAmount('');
      fetchActiveInvestments();
      alert('Investment successful!');
    } catch (error) {
      console.error('Investment error:', error);
      alert('Failed to create investment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Compound Investments</h1>
          <p className="text-slate-400 mt-1">Grow your USDC with our high-yield guaranteed plans.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start">
          <button 
            onClick={() => setActiveTab('plans')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'plans' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <PlusCircle size={18} />
            <span>New Investment</span>
          </button>
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <TrendingUp size={18} />
            <span>Active ({activeInvestments.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <History size={18} />
            <span>History</span>
          </button>
        </div>
      </div>

      {activeTab === 'plans' && (
        <>
          {/* Liquidity Pool Banner */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={120} className="text-primary" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-primary">
                  <ShieldCheck size={20} />
                  <span className="text-sm font-bold uppercase tracking-widest">Guaranteed Safety</span>
                </div>
                <h2 className="text-2xl font-bold text-white">Protocol Liquidity Pool</h2>
                <p className="text-slate-400 max-w-xl">
                  Our 500,000 USDC liquidity pool ensures that all interests and withdrawals are processed instantly and safely for every user.
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm text-slate-500 font-medium">Pool Balance</span>
                <span className="text-4xl font-bold text-white tracking-tight">500,000.00 <span className="text-lg font-normal text-slate-500">USDC</span></span>
                <div className="w-full h-2 bg-white/5 rounded-full mt-4 overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '85%' }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="h-full bg-primary shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className="glass-card p-6 flex flex-col relative group"
              >
                <div className="absolute top-4 right-4 text-xs font-bold px-3 py-1 bg-white/5 rounded-full border border-white/10 group-hover:bg-primary/20 group-hover:text-primary group-hover:border-primary/20 transition-all">
                  T{plan.id}
                </div>
                
                <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline space-x-1 mb-6">
                  <span className="text-3xl font-bold text-primary">{plan.interest_rate}%</span>
                  <span className="text-sm text-slate-500 font-medium">every {plan.interest_period_days} days</span>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center"><Clock size={16} className="mr-2" /> Duration</span>
                    <span className="text-white font-bold">{plan.duration_days} Days</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center"><TrendingUp size={16} className="mr-2" /> Min Amount</span>
                    <span className="text-white font-bold">{plan.min_amount} USDC</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center"><ShieldCheck size={16} className="mr-2" /> Max Amount</span>
                    <span className="text-white font-bold font-mono">{plan.max_amount.toLocaleString()} USDC</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center"><Zap size={16} className="mr-2" /> Limit</span>
                    <span className="text-white font-bold">Max {plan.max_simultaneous} active</span>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedPlan(plan)}
                  className="w-full primary-button py-3 text-sm font-bold flex items-center justify-center space-x-2"
                >
                  <span>Invest Now</span>
                  <ChevronRight size={18} />
                </button>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeInvestments.map((inv) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                  <Zap size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-white">{inv.plan?.name}</h4>
                  <p className="text-xs text-slate-500">Amount: <span className="text-white font-bold">{inv.amount} USDC</span></p>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Daily Profit</p>
                  <p className="text-sm font-bold text-accent">+${(inv.amount * (inv.plan?.interest_rate || 0) / 100 / (inv.plan?.interest_period_days || 15)).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total Payout</p>
                  <p className="text-sm font-bold text-white">${(inv.amount * (1 + (inv.plan?.interest_rate || 0) / 100 * (inv.plan?.duration_days || 60) / (inv.plan?.interest_period_days || 15))).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Next Payout</p>
                  <p className="text-sm font-bold text-white">5 days</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Status</p>
                  <span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-[10px] font-bold">Active</span>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <button className="secondary-button text-xs py-2">Details</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Investment Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-md p-8 relative"
          >
            <button 
              onClick={() => setSelectedPlan(null)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white"
            >
              <PlusCircle size={24} className="rotate-45" />
            </button>
            <h3 className="text-2xl font-bold text-white mb-2">Create Investment</h3>
            <p className="text-slate-400 mb-6 font-medium">{selectedPlan.name} • {selectedPlan.interest_rate}% returns</p>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Investment Amount (USDC)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    className="input-field w-full pr-12 text-lg font-bold" 
                    placeholder="0.00"
                    min={selectedPlan.min_amount}
                    max={selectedPlan.max_amount}
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-500">USDC</span>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-medium uppercase tracking-wider">
                  <span className="text-slate-500">Min: {selectedPlan.min_amount}</span>
                  <span className="text-slate-500">Max: {selectedPlan.max_amount}</span>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Duration</span>
                  <span className="text-white font-bold">{selectedPlan.duration_days} Days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Compound Returns</span>
                  <span className="text-accent font-bold">Yes</span>
                </div>
                <div className="flex justify-between text-sm border-t border-white/5 pt-3">
                  <span className="text-slate-400 font-bold uppercase text-xs">Available Balance</span>
                  <span className="text-white font-bold">{wallet?.balance_usdc || 0} USDC</span>
                </div>
              </div>

              <div className="flex items-start space-x-3 text-xs text-slate-500 leading-relaxed">
                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                <p>Funds will be locked for the duration of the plan. Interests are paid every {selectedPlan.interest_period_days} days to your wallet.</p>
              </div>

              <button 
                onClick={handleInvest}
                disabled={loading}
                className="w-full primary-button py-4 text-sm font-bold shadow-xl shadow-primary/30 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Confirm Investment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Investments;
