import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Info,
  ChevronRight,
  PlusCircle,
  History,
  Lock,
  Unlock,
  BarChart3,
  Calendar,
  DollarSign,
  X,
  ChevronDown
} from 'lucide-react';
import type { Plan, Investment } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { supabase } from '../services/supabase';

// --- Helpers ---
function calcCompoundReturn(principal: number, ratePerPeriod: number, periods: number) {
  // r = rate as decimal per period, n = number of periods
  return principal * Math.pow(1 + ratePerPeriod / 100, periods);
}

function calcSimpleReturn(principal: number, ratePerPeriod: number, periods: number) {
  return principal * (1 + (ratePerPeriod / 100) * periods);
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntil(date: string) {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

// --- Active Investment Card ---
function ActiveInvestmentCard({ inv, onWithdraw }: { inv: Investment; onWithdraw: (inv: Investment, partial: boolean) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const plan = inv.plan!;
  const rate = plan.interest_rate;
  const periodDays = plan.interest_period_days;
  const totalPeriods = plan.duration_days / periodDays;
  const periodsSoFar = Math.floor(daysSince(inv.start_date) / periodDays);
  const daysLeft = daysUntil(inv.end_date);
  const nextPayoutDays = periodDays - (daysSince(inv.start_date) % periodDays);
  const isUnlocked = new Date() >= new Date(inv.end_date);

  // Strategy yield per cycle (simple: profit_rate % of margin per cycle)
  const interestPerPeriod = inv.amount * rate / 100;

  // Total yield across all cycles
  const totalInterest = interestPerPeriod * totalPeriods;
  const totalAtMaturity = inv.amount + totalInterest; 

  // Alpha earned to date (how many full cycles have passed)
  const interestEarnedToDate = periodsSoFar * interestPerPeriod;

  // How much alpha is available to withdraw right now (earned - already withdrawn)
  const interestAvailable = Math.max(0, interestEarnedToDate - (inv.withdrawn_amount || 0));

  // For maturity: remaining yield not yet paid + principal
  const maturityPayout = inv.amount + Math.max(0, totalInterest - (inv.withdrawn_amount || 0));

  const progress = Math.min(100, (daysSince(inv.start_date) / plan.duration_days) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden border border-white/5"
    >
      {/* Main Row */}
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Plan Icon */}
          <div className="flex items-center space-x-4 shrink-0">
            <div className="relative">
              <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_20px_rgba(252,186,44,0.2)]">
                <Zap size={28} />
              </div>
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-dark ${isUnlocked ? 'bg-accent' : 'bg-primary'} animate-pulse`} />
            </div>
            <div>
              <h4 className="font-black text-white text-lg italic tracking-tighter">{plan.name}</h4>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">
                {isUnlocked ? '✅ TERMINATED' : `${daysLeft}d left in cycle`}
              </p>
            </div>
          </div>

            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Allocated Margin 🔒</p>
                <p className="text-base font-black text-white italic tracking-tighter">${inv.amount.toFixed(2)}</p>
                <p className="text-[9px] text-slate-600">{isUnlocked ? 'Liquid!' : `locked ${daysLeft}d`}</p>
              </div>
              <div className="bg-accent/5 rounded-xl p-3 border border-accent/10">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Alpha Yield</p>
                <p className="text-base font-black text-accent italic tracking-tighter">+${interestEarnedToDate.toFixed(4)}</p>
                <p className="text-[9px] text-slate-600">{periodsSoFar}/{totalPeriods} cycles</p>
              </div>
              <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Next Settlement</p>
                <p className="text-base font-black text-primary italic tracking-tighter">{nextPayoutDays}d</p>
                <p className="text-[9px] text-slate-600">+${interestPerPeriod.toFixed(2)} due</p>
              </div>
              <div className={`rounded-xl p-3 border ${interestAvailable > 0 ? 'bg-accent/10 border-accent/20' : 'bg-white/3 border-white/5'}`}>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Settled Alpha</p>
                <p className={`text-base font-black italic tracking-tighter ${interestAvailable > 0 ? 'text-accent' : 'text-slate-600'}`}>${interestAvailable.toFixed(4)}</p>
                <p className="text-[9px] text-slate-600">collect now</p>
              </div>
            </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => !withdrawLoading && onWithdraw(inv, true)}
              disabled={interestAvailable <= 0 || withdrawLoading}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest italic transition-all border ${interestAvailable > 0 ? 'bg-accent/10 hover:bg-accent text-accent hover:text-black border-accent/30' : 'bg-white/3 text-slate-700 border-white/5 cursor-not-allowed'}`}
            >
              {interestAvailable > 0 ? <Unlock size={14} /> : <Lock size={14} />}
              <span>{interestAvailable > 0 ? 'Protocol Settlement' : 'Locked'}</span>
            </button>

            <button
              onClick={() => setExpanded(!expanded)}
              className={`p-2.5 rounded-xl border transition-all ${expanded ? 'bg-primary text-black border-primary' : 'bg-white/5 text-slate-500 border-white/10 hover:border-primary/30'}`}
            >
              <ChevronDown size={18} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">
            <span>Progress {Math.round(progress)}%</span>
            <span>Day {daysSince(inv.start_date)} / {plan.duration_days}</span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className={`h-full rounded-full ${isUnlocked ? 'bg-accent shadow-[0_0_10px_#4ade80]' : 'bg-primary shadow-[0_0_10px_rgba(252,186,44,0.5)]'}`}
            />
          </div>
        </div>
      </div>

      {/* Expanded Detail Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="p-6 md:p-8 space-y-8">
              {/* How interest withdrawal works */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Interest withdrawal side */}
                <div className="bg-gradient-to-br from-accent/10 to-transparent rounded-2xl p-6 border border-accent/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={60} /></div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-accent/20 rounded-xl"><Unlock size={16} className="text-accent" /></div>
                    <div>
                      <h5 className="font-black text-accent italic tracking-tighter text-sm">💸 Alpha Performance (Withdrawable)</h5>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">Calculated every {periodDays} days</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Interest per {periodDays}-day period</span>
                      <span className="font-black text-accent italic">+${interestPerPeriod.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total interest ({totalPeriods} periods)</span>
                      <span className="font-black text-accent italic">+${totalInterest.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Already withdrawn</span>
                      <span className="font-black text-white italic">${(inv.withdrawn_amount || 0).toFixed(4)}</span>
                    </div>
                    <div className="h-px bg-white/5" />
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      ✅ Your active margin <strong className="text-white">${inv.amount.toLocaleString()}</strong> remains deployed and returns in full upon cycle completion.
                    </p>
                  </div>
                </div>

                {/* Principal & Maturity side */}
                <div className="bg-gradient-to-br from-primary/10 to-transparent rounded-2xl p-6 border border-primary/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10"><Lock size={60} /></div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-primary/20 rounded-xl"><ShieldCheck size={16} className="text-primary" /></div>
                    <div>
                      <h5 className="font-black text-primary italic tracking-tighter text-sm">🔒 Your Principal (Locked)</h5>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest">Returns at maturity · {new Date(inv.end_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Principal locked</span>
                      <span className="font-black text-white italic">${inv.amount.toFixed(2)} USDC</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Returns in</span>
                      <span className={`font-black italic ${isUnlocked ? 'text-accent' : 'text-primary'}`}>{isUnlocked ? '✅ NOW' : `${daysLeft} days`}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total at maturity</span>
                      <span className="font-black text-white italic">${totalAtMaturity.toFixed(2)} USDC</span>
                    </div>
                    <div className="h-px bg-white/5" />
                    <p className="text-[10px] text-slate-500 italic leading-relaxed">
                      ⚠️ Principal is <strong className="text-primary">never</strong> at risk — it is secured by the Tradify Reserve Fund and returns 100% at plan maturity.
                    </p>
                  </div>
                </div>
              </div>

              {/* Payout Schedule */}
              <div>
                <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-4 flex items-center">
                  <Calendar size={12} className="mr-2" /> Alpha Payout Schedule (every {periodDays} days)
                </h5>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-2">
                  {Array.from({ length: totalPeriods }).map((_, i) => {
                    const periodNum = i + 1;
                    const payoutDate = new Date(new Date(inv.start_date).getTime() + periodNum * periodDays * 24 * 60 * 60 * 1000);
                    const isPast = payoutDate <= new Date();
                    const isWithdrawn = periodNum * interestPerPeriod <= (inv.withdrawn_amount || 0);
                    return (
                      <div key={i} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-all ${
                        isWithdrawn ? 'bg-white/2 border border-white/5 opacity-40' :
                        isPast ? 'bg-accent/5 border border-accent/10' : 'bg-white/2 border border-white/5'
                      }`}>
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${
                            isWithdrawn ? 'bg-white/10 text-slate-500' :
                            isPast ? 'bg-accent text-black' : 'bg-white/10 text-slate-500'
                          }`}>
                            {isWithdrawn ? '✓' : isPast ? '!' : periodNum}
                          </div>
                          <span className={`font-bold ${isPast ? 'text-slate-300' : 'text-slate-600'}`}>
                            {payoutDate.toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`text-[10px] font-black ${isWithdrawn ? 'text-slate-700 line-through' : isPast ? 'text-accent' : 'text-slate-600'}`}>
                            {isWithdrawn ? 'withdrawn' : isPast ? '⚡ available' : 'pending'}
                          </span>
                          <span className={`font-black italic text-sm ${isPast && !isWithdrawn ? 'text-accent' : 'text-slate-600'}`}>
                            +${interestPerPeriod.toFixed(4)} USDC
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Investment Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-t border-white/5 pt-6">
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black mb-1 flex items-center"><Clock size={10} className="mr-1" /> Start Date</p>
                  <p className="text-white font-bold">{new Date(inv.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black mb-1 flex items-center"><Clock size={10} className="mr-1" /> Maturity Date</p>
                  <p className={`font-bold ${isUnlocked ? 'text-accent' : 'text-white'}`}>{new Date(inv.end_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black mb-1">Already Withdrawn</p>
                  <p className="text-white font-bold">${(inv.withdrawn_amount || 0).toFixed(4)} USDC</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest font-black mb-1">Rate / Period</p>
                  <p className="text-primary font-black italic">{rate}% / {periodDays} days</p>
                </div>
              </div>

              {/* Full Withdrawal Button (if unlocked) */}
              {isUnlocked && (
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-gradient-to-r from-accent/20 to-transparent rounded-2xl p-6 border border-accent/30 flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div>
                    <h5 className="font-black text-accent italic text-lg tracking-tighter mb-1">🎉 Strategy Settled!</h5>
                    <p className="text-sm text-slate-400">Your margin <strong className="text-white">${inv.amount.toFixed(2)}</strong> + settled yield is ready.</p>
                    <p className="text-xl font-black text-white italic mt-1">${maturityPayout.toFixed(4)} <span className="text-xs font-normal text-slate-500">USDC total</span></p>
                  </div>
                  <button
                    onClick={() => onWithdraw(inv, false)}
                    className="flex items-center space-x-3 px-8 py-4 bg-accent text-black font-black rounded-2xl text-sm uppercase tracking-widest shadow-[0_10px_40px_rgba(74,222,128,0.4)] hover:shadow-[0_15px_50px_rgba(74,222,128,0.6)] transition-all active:scale-95"
                  >
                    <Unlock size={18} />
                    <span>Reclaim Margin + Alpha</span>
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Main Component ---
const Investments: React.FC = () => {
  const { wallet, profile, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<'plans' | 'active' | 'history'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [poolBalance, setPoolBalance] = useState<number>(500000);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<Investment[]>([]);
  const [historyInvestments, setHistoryInvestments] = useState<Investment[]>([]);
  const [investmentAmount, setInvestmentAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchPlans();
    fetchPoolStats();
    if (profile) {
      fetchActiveInvestments();
      fetchHistoryInvestments();
    }
  }, [profile]);

  const fetchPoolStats = async () => {
    const { data } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'pool_guaranteed')
      .single();
    if (data?.value?.amount) setPoolBalance(data.value.amount);
  };

  const fetchPlans = async () => {
    const { data, error } = await supabase.from('plans').select('*').eq('is_active', true);
    if (!error && data) setPlans(data);
  };

  const fetchActiveInvestments = async () => {
    const { data, error } = await supabase
      .from('investments')
      .select('*, plan:plans(*)')
      .eq('user_id', profile?.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (!error && data) setActiveInvestments(data as Investment[]);
  };

  const fetchHistoryInvestments = async () => {
    const { data, error } = await supabase
      .from('investments')
      .select('*, plan:plans(*)')
      .eq('user_id', profile?.id)
      .neq('status', 'active')
      .order('created_at', { ascending: false });
    if (!error && data) setHistoryInvestments(data as Investment[]);
  };

  const handleWithdraw = async (inv: Investment, partial: boolean) => {
    if (!profile || !wallet || !inv.plan) return;

    const plan = inv.plan;
    const rate = plan.interest_rate;
    const periodDays = plan.interest_period_days;
    const totalPeriods = plan.duration_days / periodDays;
    const periodsSoFar = Math.floor(daysSince(inv.start_date) / periodDays);
    const interestPerPeriod = inv.amount * rate / 100;
    const totalInterest = interestPerPeriod * totalPeriods;
    const interestEarnedToDate = periodsSoFar * interestPerPeriod;
    const interestAvailable = Math.max(0, interestEarnedToDate - (inv.withdrawn_amount || 0));

    // Maturity payout = principal + any interest not yet withdrawn
    const maturityPayout = inv.amount + Math.max(0, totalInterest - (inv.withdrawn_amount || 0));

    // partial = withdraw only available interest (principal stays locked)
    // !partial = plan matured: return principal + remaining interest
    const withdrawAmount = partial ? interestAvailable : maturityPayout;
    if (withdrawAmount <= 0) return;

    setLoading(true);
    try {
      if (!partial) {
        // Full maturity withdrawal — close investment, principal + remaining interest returned
        await supabase.from('investments').update({ 
          status: 'completed',
          withdrawn_amount: (inv.withdrawn_amount || 0) + withdrawAmount
        }).eq('id', inv.id);
      } else {
        // Interest-only withdrawal — track how much interest has been pulled
        await supabase.from('investments')
          .update({ withdrawn_amount: (inv.withdrawn_amount || 0) + withdrawAmount })
          .eq('id', inv.id);
      }

      const newBalance = wallet.balance_usdc + withdrawAmount;
      await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'profit',
        amount: withdrawAmount,
        description: partial 
          ? `Settlement from ${plan.name} Node (${rate}% / ${periodDays}d)`
          : `Final settlement from ${plan.name} — Margin + Alpha`,
        status: 'completed'
      });

      setWallet({ ...wallet, balance_usdc: newBalance });
      addNotification(
        profile.id, 
        partial ? '💸 Yield Settled' : '🎉 Cycle Terminated!', 
        `$${withdrawAmount.toFixed(4)} USDC has been credited to your node.`, 
        'success'
      );
      fetchActiveInvestments();
      fetchHistoryInvestments();
    } catch (err) {
      console.error(err);
      addNotification(profile.id, 'Execution Error', 'Could not process settlement. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInvest = async () => {
    if (!selectedPlan || !profile || !wallet) return;
    const amount = parseFloat(investmentAmount);

    if (isNaN(amount) || amount < selectedPlan.min_amount || amount > selectedPlan.max_amount) {
      addNotification(profile.id, 'Invalid Amount', `Amount must be between $${selectedPlan.min_amount} and $${selectedPlan.max_amount} USDC.`, 'error');
      return;
    }
    if (amount > wallet.balance_usdc) {
      addNotification(profile.id, 'Insufficient Assets', 'You do not have enough USDC available for this allocation.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error: invError } = await supabase
        .from('investments')
        .insert({
          user_id: profile.id,
          plan_id: selectedPlan.id,
          amount,
          status: 'active',
          withdrawn_amount: 0,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + selectedPlan.duration_days * 86400000).toISOString()
        });
      if (invError) throw invError;

      const newBalance = wallet.balance_usdc - amount;
      const { error: walletError } = await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);
      if (walletError) throw walletError;

      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'investment',
        amount,
        description: `Deployment in ${selectedPlan.name}`,
        status: 'completed'
      });

      await handleReferralRewards(profile.id, amount);
      addNotification(profile.id, '🚀 Strategy Active', `$${amount.toFixed(2)} USDC allocated in ${selectedPlan.name}. Logic execution starts now.`, 'success');
      setWallet({ ...wallet, balance_usdc: newBalance });
      setSelectedPlan(null);
      setInvestmentAmount('');
      fetchActiveInvestments();
      setActiveTab('active');
    } catch (error: any) {
      console.error('Deployment error:', error);
      addNotification(profile.id, 'Deployment Failed', error.message || 'An error occurred during execution.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReferralRewards = async (userId: string, amount: number) => {
    try {
      const { data: settings } = await supabase.from('admin_settings').select('value').eq('key', 'referral_commissions').single();
      const rates = settings?.value || { level1: 5, level2: 3, level3: 1 };
      let currentUserId = userId;
      const levels = [{ level: 1, rate: rates.level1 }, { level: 2, rate: rates.level2 }, { level: 3, rate: rates.level3 }];
      for (const lvl of levels) {
        const { data: person } = await supabase.from('profiles').select('referred_by').eq('id', currentUserId).single();
        if (!person?.referred_by) break;
        const referrerId = person.referred_by;
        const commission = (amount * lvl.rate) / 100;
        if (commission > 0) {
          const { data: refWallet } = await supabase.from('wallets').select('balance_usdc').eq('user_id', referrerId).single();
          if (refWallet) {
            await supabase.from('wallets').update({ balance_usdc: refWallet.balance_usdc + commission }).eq('user_id', referrerId);
            await supabase.from('transactions').insert({ user_id: referrerId, type: 'referral', amount: commission, description: `Level ${lvl.level} referral commission`, status: 'completed' });
            await supabase.from('referrals').insert({ referrer_id: referrerId, referred_id: profile?.id, commission_earned: commission, level: lvl.level });
            await addNotification(referrerId, 'Referral Commission', `Level ${lvl.level} commission of $${commission.toFixed(2)} USDC from your network.`, 'success');
          }
        }
        currentUserId = referrerId;
      }
    } catch (err) { console.error('Referral error:', err); }
  };

  // Preview calc helpers
  const previewAmount = parseFloat(investmentAmount) || 0;
  const previewPeriods = selectedPlan ? selectedPlan.duration_days / selectedPlan.interest_period_days : 0;
  const previewCompound = selectedPlan ? calcCompoundReturn(previewAmount, selectedPlan.interest_rate, previewPeriods) : 0;
  const previewSimple = selectedPlan ? calcSimpleReturn(previewAmount, selectedPlan.interest_rate, previewPeriods) : 0;
  const compoundAdvantage = previewCompound - previewSimple;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none">Execution Strategies</h1>
          <p className="text-slate-500 mt-1.5 text-xs font-medium">Monitor and trigger high-frequency algorithmic models.</p>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 self-start">
          {([
            { key: 'plans', icon: PlusCircle, label: 'Add Logic' },
            { key: 'active', icon: TrendingUp, label: `Active (${activeInvestments.length})` },
            { key: 'history', icon: History, label: 'Execution Logs' }
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === key ? 'bg-primary text-black' : 'text-slate-500 hover:text-white'}`}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <>
          {/* Pool Banner */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card bg-gradient-to-r from-primary/20 via-primary/5 to-transparent p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={100} className="text-primary" /></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-primary">
                  <ShieldCheck size={14} />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em]">Strategy Reserve Fund</span>
                </div>
                <h2 className="text-lg md:text-xl font-black text-white tracking-tighter uppercase leading-none">Margin Protection Active</h2>
                <p className="text-slate-500 max-w-xl text-[10px] leading-relaxed font-medium">All models are backed by our security framework. Executed margin is 1:1 asset backed.</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mb-1 leading-none">Pool Balance</span>
                <span className="text-xl md:text-2xl font-black text-white tracking-tighter leading-none">{poolBalance.toLocaleString()} <span className="text-[10px] font-normal text-slate-600 ml-1">USDC</span></span>
                <div className="w-48 h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden border border-white/5">
                  <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ duration: 1.5, ease: 'easeOut' }} className="h-full bg-primary shadow-[0_0_15px_rgba(252,186,44,0.5)] rounded-full" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* === BLACK SOVEREIGN PREMIUM PLAN === */}
          {plans.filter(p => p.id === 6).map(plan => {
            const periods = plan.duration_days / plan.interest_period_days;
            const compoundReturn = calcCompoundReturn(plan.min_amount, plan.interest_rate, periods);
            const simpleReturn = calcSimpleReturn(plan.min_amount, plan.interest_rate, periods);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-[2rem] border border-yellow-500/30 shadow-[0_0_80px_rgba(234,179,8,0.15),0_40px_100px_rgba(0,0,0,0.8)]"
                style={{ background: 'linear-gradient(135deg, #0a0a00 0%, #1a1400 30%, #0d0d00 60%, #050500 100%)' }}
              >
                {/* Animated border glow */}
                <div className="absolute inset-0 rounded-[2rem] pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(234,179,8,0.08) 0%, transparent 50%, rgba(234,179,8,0.05) 100%)' }} />
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

                {/* Corner ornament */}
                <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none">
                  <div className="absolute top-6 right-8 opacity-8"><ShieldCheck size={200} className="text-yellow-600/10" /></div>
                </div>

                <div className="relative z-10 p-8 md:p-12">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                    {/* Left: Identity */}
                    <div className="lg:w-1/3 space-y-5">
                      <div className="flex items-center space-x-3">
                        <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.4em] italic rounded-full border" style={{ background: 'rgba(234,179,8,0.15)', borderColor: 'rgba(234,179,8,0.4)', color: '#facd00' }}>
                          ♛ SOVEREIGN TIER
                        </div>
                        <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] italic rounded-full bg-white/5 border border-white/10 text-slate-400">
                          EXCLUSIVE
                        </div>
                      </div>

                      <div>
                        <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none" style={{ color: '#facd00' }}>
                          Black<br />Sovereign
                        </h3>
                        <p className="text-slate-400 mt-2 text-xs leading-relaxed max-w-xs">
                          Tier 1 execution protocol. Professional-grade algorithmic cycle with high-density output optimization.
                        </p>
                      </div>

                      <div className="flex items-end space-x-2">
                        <span className="text-3xl md:text-4xl font-black" style={{ color: '#facd00' }}>{plan.interest_rate}%</span>
                        <div className="pb-1">
                          <p className="text-slate-400 text-[10px] font-bold leading-tight uppercase">every {plan.interest_period_days} days</p>
                          <p className="text-[8px] text-slate-600 uppercase tracking-widest">cycle efficiency</p>
                        </div>
                      </div>
                    </div>

                    {/* Center: Stats */}
                    <div className="lg:flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: 'Cycle Length', value: `${plan.duration_days} Days`, sub: 'Logic execution term', icon: Clock },
                        { label: 'Payout Cluster', value: `Every ${plan.interest_period_days}d`, sub: 'Distributable alpha', icon: Calendar },
                        { label: 'Min. Margin', value: `$${plan.min_amount.toLocaleString()}`, sub: 'Required to start', icon: DollarSign },
                        { label: 'Max. Cap', value: `$${plan.max_amount.toLocaleString()}`, sub: 'Upper capacity', icon: TrendingUp },
                        { label: 'Cumulative ROI', value: `+${(((compoundReturn - plan.min_amount) / plan.min_amount) * 100).toFixed(1)}%`, sub: `+$${(compoundReturn - plan.min_amount).toLocaleString('en', { maximumFractionDigits: 0 })} projected`, icon: BarChart3 },
                        { label: 'Optimal Delta', value: `+$${(compoundReturn - simpleReturn).toFixed(0)}`, sub: 'Compounded bonus', icon: Zap },
                      ].map(({ label, value, sub, icon: Icon }) => (
                        <div key={label} className="rounded-2xl p-4 border" style={{ background: 'rgba(234,179,8,0.04)', borderColor: 'rgba(234,179,8,0.12)' }}>
                          <div className="flex items-center space-x-2 mb-2">
                            <Icon size={12} style={{ color: '#facd00' }} />
                            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: '#facd00', opacity: 0.6 }}>{label}</p>
                          </div>
                          <p className="text-base font-black text-white tracking-tighter">{value}</p>
                          <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Benefits strip */}
                  <div className="mt-8 pt-6 border-t flex flex-col md:flex-row md:items-center justify-between gap-6" style={{ borderColor: 'rgba(234,179,8,0.12)' }}>
                    <div className="flex flex-wrap gap-3">
                      {['♛ Exclusive Tier Access', '🔒 Capital Guarantee', '📊 Real-Time Compound Meter', '💎 Priority Withdrawals', '🏦 Institutional Grade'].map(b => (
                        <span key={b} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border" style={{ background: 'rgba(234,179,8,0.06)', borderColor: 'rgba(234,179,8,0.2)', color: 'rgba(250,205,0,0.7)' }}>
                          {b}
                        </span>
                      ))}
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPlan(plan)}
                      className="shrink-0 px-8 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-black transition-all"
                      style={{ background: 'linear-gradient(135deg, #facd00, #f59e0b)', boxShadow: '0 10px 40px rgba(234,179,8,0.35)' }}
                    >
                      ♛ Deploy Sovereign Strategy
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Regular Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.filter(p => p.id !== 6).map((plan, i) => {
              const sampleAmount = plan.min_amount;
              const periods = plan.duration_days / plan.interest_period_days;
              const compoundReturn = calcCompoundReturn(sampleAmount, plan.interest_rate, periods);
              const simpleReturn = calcSimpleReturn(sampleAmount, plan.interest_rate, periods);
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="glass-card p-6 flex flex-col relative group border border-white/5 hover:border-primary/20 transition-colors"
                >
                  <div className="absolute top-4 right-4 text-[10px] font-black px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">PLAN {i + 1}</div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1 leading-none">{plan.name}</h3>
                  <div className="flex items-baseline space-x-2 mb-4">
                    <span className="text-2xl font-black text-primary">{plan.interest_rate}%</span>
                    <span className="text-sm text-slate-500">every {plan.interest_period_days} days</span>
                  </div>
                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center"><Clock size={14} className="mr-2" />Duration</span>
                      <span className="text-white font-bold">{plan.duration_days} Days</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400 flex items-center"><TrendingUp size={14} className="mr-2" />Amount Range</span>
                      <span className="text-white font-bold">${plan.min_amount} – ${plan.max_amount.toLocaleString()}</span>
                    </div>
                    <div className="h-px bg-white/5" />
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 text-[10px] uppercase tracking-widest">Compound return on min</span>
                      <span className="text-accent font-black">+${(compoundReturn - sampleAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 text-[10px] uppercase tracking-widest">Simple (withdraw) on min</span>
                      <span className="text-slate-400 font-bold">+${(simpleReturn - sampleAmount).toFixed(2)}</span>
                    </div>
                    <div className="bg-accent/5 rounded-xl p-2 border border-accent/10 text-[10px] text-accent font-bold text-center">
                      🚀 Compound earns ${(compoundReturn - simpleReturn).toFixed(2)} MORE on ${sampleAmount}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full primary-button py-2.5 text-xs font-black flex items-center justify-center space-x-2 uppercase tracking-widest"
                  >
                    <span>Deploy Logic</span>
                    <ChevronRight size={14} />
                  </button>
                </motion.div>
              );
            })}
          </div>

        </>
      )}

      {/* ACTIVE TAB */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeInvestments.length === 0 ? (
            <div className="glass-card p-16 flex flex-col items-center justify-center text-slate-700">
              <Zap size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest text-center">No active strategies. Deploy a node to begin algorithm execution.</p>
              <button onClick={() => setActiveTab('plans')} className="mt-6 primary-button text-sm px-6 py-3">Browse Models</button>
            </div>
          ) : (
            activeInvestments.map(inv => (
              <ActiveInvestmentCard key={inv.id} inv={inv} onWithdraw={handleWithdraw} />
            ))
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyInvestments.length === 0 ? (
            <div className="glass-card p-16 flex flex-col items-center justify-center text-slate-700">
              <History size={48} className="mb-4 opacity-20" />
              <p className="text-sm font-black uppercase tracking-widest">No previous execution logs.</p>
            </div>
          ) : (
            historyInvestments.map((inv) => {
              const plan = inv.plan;
              if (!plan) return null;
              const profit = (inv.withdrawn_amount || 0) - inv.amount;
              const isProfit = profit >= 0;
              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass-card p-6 border border-white/5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border ${inv.status === 'completed' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-error/10 text-error border-error/20'}`}>
                        {inv.status === 'completed' ? '✓' : '✗'}
                      </div>
                      <div>
                        <h4 className="font-black text-white tracking-tighter uppercase text-sm">{plan.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{new Date(inv.start_date).toLocaleDateString()} → {new Date(inv.end_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-6 text-sm">
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1">Allocated</p>
                        <p className="text-white font-black">${inv.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1">Withdrawn</p>
                        <p className="text-white font-black">${(inv.withdrawn_amount || 0).toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1">Net P&L</p>
                        <p className={`font-black ${isProfit ? 'text-accent' : 'text-error'}`}>
                          {isProfit ? '+' : ''}${profit.toFixed(4)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${inv.status === 'completed' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-error/10 text-error border border-error/20'}`}>
                      {inv.status}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Investment Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setSelectedPlan(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Start Strategy</h3>
              <p className="text-slate-400 mb-6 text-sm">{selectedPlan.name} · {selectedPlan.interest_rate}% target alpha every {selectedPlan.interest_period_days} days · {selectedPlan.duration_days} day cycle</p>

              {/* Amount Input */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-3 block">Allocated Margin</label>
                <div className="relative">
                  <input
                    type="number"
                    className="input-field w-full pr-16 text-xl font-black"
                    placeholder="0.00"
                    min={selectedPlan.min_amount}
                    max={selectedPlan.max_amount}
                    value={investmentAmount}
                    onChange={(e) => setInvestmentAmount(e.target.value)}
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-black text-primary italic tracking-widest">USDC</span>
                </div>
                <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  <span>Min: ${selectedPlan.min_amount}</span>
                  <span>Available: ${(wallet?.balance_usdc || 0).toFixed(4)}</span>
                  <span>Max: ${selectedPlan.max_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Comparison Preview */}
              {previewAmount > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-primary/10 rounded-2xl p-4 border border-primary/20">
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">🚀 If you hold ({selectedPlan.duration_days}d)</p>
                    <p className="text-xl font-black text-white italic">${previewCompound.toFixed(2)}</p>
                    <p className="text-xs text-accent font-bold">+${(previewCompound - previewAmount).toFixed(4)} profit</p>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">💸 If you withdraw each {selectedPlan.interest_period_days}d</p>
                    <p className="text-xl font-black text-slate-300 italic">${previewSimple.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 font-bold">+${(previewSimple - previewAmount).toFixed(4)} profit</p>
                  </div>
                  <div className="col-span-2 bg-accent/5 rounded-xl p-3 border border-accent/10 text-center">
                    <p className="text-[10px] text-accent font-black italic">
                      ⚠️ Compound earns <span className="text-lg">${compoundAdvantage.toFixed(4)}</span> MORE than withdrawing periodically
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3 text-[10px] text-slate-500 mb-6 bg-primary/5 p-3 rounded-xl border border-primary/10">
                <Info size={14} className="text-primary mt-0.5 shrink-0" />
                <p>Allocated margin and settled alpha are 100% guarded by the Tradify Strategy Fund. Capital returns to your wallet upon cycle completion.</p>
              </div>

              <button
                onClick={handleInvest}
                disabled={loading || previewAmount <= 0}
                className="w-full primary-button py-4 text-sm font-black uppercase tracking-widest italic shadow-xl shadow-primary/30 disabled:opacity-40"
              >
                {loading ? 'Processing...' : `Execute Strategy · $${previewAmount > 0 ? previewAmount.toFixed(2) : '0.00'} USDC`}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Investments;
