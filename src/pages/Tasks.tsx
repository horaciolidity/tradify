import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Star, Zap, Users, Wallet, Trophy, ChevronRight, Check } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

const initialTasks = [
  { id: 1, title: 'Daily Login', reward: 0.10, description: 'Log in to your account every day.', icon: Zap, status: 'claim', progress: [1, 1] },
  { id: 2, title: 'Invite 3 Friends', reward: 5.00, description: 'Get 3 users to register with your link.', icon: Users, status: 'ongoing', progress: [1, 3] },
  { id: 3, title: 'First Investment', reward: 2.00, description: 'Start any investment plan.', icon: Wallet, status: 'completed', progress: [1, 1] },
  { id: 4, title: 'Reach $1000 Portfolio', reward: 10.00, description: 'Maintain a balance of $1000 in plans.', icon: Trophy, status: 'ongoing', progress: [500, 1000] },
];

import { supabase } from '../services/supabase';

const Tasks: React.FC = () => {
  const { profile, wallet, setWallet } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  React.useEffect(() => {
    if (profile) fetchTasks();
  }, [profile]);

  const fetchTasks = async () => {
    const { data: allTasks } = await supabase.from('tasks').select('*').eq('is_active', true);
    const { data: userTasks } = await supabase.from('user_tasks').select('task_id').eq('user_id', profile?.id);

    if (allTasks) {
      const mapped = allTasks.map(t => ({
        ...t,
        status: userTasks?.find(ut => ut.task_id === t.id) ? 'completed' : (t.task_type === 'daily_login' ? 'claim' : 'ongoing'),
        progress: [0, 1], // Default progress display logic
        icon: t.task_type === 'daily_login' ? Zap : t.task_type === 'referral' ? Users : t.task_type === 'investment' ? Wallet : Trophy
      }));
      setTasks(mapped);
    }
  };

  const handleClaim = async (id: number, reward: number) => {
    if (!profile || !wallet) return;
    setClaimingId(id);
    
    try {
      // 1. Mark task as completed
      await supabase.from('user_tasks').insert({ user_id: profile.id, task_id: id });

      // 2. Update wallet
      const newBalance = wallet.balance_usdc + reward;
      await supabase.from('wallets').update({ balance_usdc: newBalance }).eq('user_id', profile.id);

      // 3. Record transaction
      await supabase.from('transactions').insert({
        user_id: profile.id,
        type: 'reward',
        amount: reward,
        description: 'Task Reward',
        status: 'completed'
      });

      setWallet({ ...wallet, balance_usdc: newBalance });
      
      // 4. Send Notification
      await addNotification(
        profile.id,
        'Reward Claimed',
        `Successfully claimed ${reward} USDC from task. Network confirmed.`,
        'success'
      );

      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t));
    } catch (error) {
      console.error('Claim error:', error);
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Reward Tasks</h1>
          <p className="text-slate-400 mt-1">Complete daily activities to grow your USDC balance.</p>
        </div>
        <div className="bg-primary/20 rounded-2xl px-4 py-2 border border-primary/20 flex items-center space-x-2">
          <Star size={18} className="text-primary fill-primary" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">Rewards Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card p-6 flex items-center space-x-6 relative transition-all duration-500 overflow-hidden ${
              task.status === 'completed' ? 'opacity-70 grayscale-[0.5]' : 'hover:border-primary/30 group'
            }`}
          >
            {/* Completion particles placeholder or background glow */}
            <AnimatePresence>
              {claimingId === task.id && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-primary/10 backdrop-blur-sm flex items-center justify-center z-10"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 ${
              task.status === 'completed' ? 'bg-accent/10 text-accent' : 'bg-primary/20 text-primary'
            }`}>
              <task.icon size={28} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white truncate">{task.title}</h3>
                {task.status === 'completed' && <Check size={14} className="text-accent" />}
              </div>
              <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{task.description}</p>
              
              <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Progress</span>
                  <span className="text-[10px] font-bold text-white uppercase tracking-tighter">{task.progress[0]} / {task.progress[1]}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(task.progress[0] / task.progress[1] * 100)}%` }}
                    className={`h-full transition-all duration-1000 ${task.status === 'completed' ? 'bg-accent' : 'bg-primary'}`}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 pl-4 border-l border-white/5 ml-4 h-16 flex items-center">
              {task.status === 'claim' ? (
                <button 
                  onClick={() => handleClaim(task.id, task.reward_amount)}
                  className="px-4 py-2 bg-accent text-dark font-black text-[10px] rounded-xl hover:scale-105 transition-all shadow-xl shadow-accent/20 uppercase tracking-widest whitespace-nowrap"
                >
                  Claim {task.reward_amount}
                </button>
              ) : task.status === 'completed' ? (
                <div className="flex flex-col items-center justify-center text-accent">
                  <CheckSquare size={20} />
                  <span className="text-[8px] font-black uppercase mt-1 tracking-widest">Claimed</span>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Reward</p>
                  <p className="text-sm font-black text-white whitespace-nowrap">{task.reward_amount} <span className="text-[8px] font-normal text-slate-500">USDC</span></p>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Tasks;
