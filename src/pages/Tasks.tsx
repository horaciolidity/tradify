import React from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Star, Zap, Users, Wallet, Trophy, ChevronRight } from 'lucide-react';

const Tasks: React.FC = () => {
  const tasks = [
    { id: 1, title: 'Daily Login', reward: '0.10 USDC', description: 'Log in to your account every day.', icon: Zap, status: 'claim', progress: '1/1' },
    { id: 2, title: 'Invite 3 Friends', reward: '5.00 USDC', description: 'Get 3 users to register with your link.', icon: Users, status: 'ongoing', progress: '1/3' },
    { id: 3, title: 'First Investment', reward: '2.00 USDC', description: 'Start any investment plan.', icon: Wallet, status: 'completed', progress: '1/1' },
    { id: 4, title: 'Reach $1000 Portfolio', reward: '10.00 USDC', description: 'Maintain a balance of $1000 in plans.', icon: Trophy, status: 'ongoing', progress: '500/1000' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Reward Tasks</h1>
        <p className="text-slate-400 mt-1">Complete simple tasks to earn extra USDC every day.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tasks.map((task, i) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center space-x-6 hover:bg-white/10 transition-colors group"
          >
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
              task.status === 'completed' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
            }`}>
              <task.icon size={28} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg text-white truncate">{task.title}</h3>
                {task.status === 'completed' && <Star size={14} className="text-amber-500 fill-amber-500" />}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>
              
              <div className="mt-4 flex items-center space-x-4">
                <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${task.status === 'completed' ? 'bg-accent' : 'bg-primary'}`}
                    style={{ width: task.status === 'completed' ? '100%' : `${(eval(task.progress) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{task.progress}</span>
              </div>
            </div>

            <div className="shrink-0 pl-4">
              {task.status === 'claim' ? (
                <button className="px-4 py-2 bg-accent text-dark font-bold text-xs rounded-lg hover:scale-105 transition-all shadow-lg shadow-accent/20">Claim {task.reward}</button>
              ) : task.status === 'completed' ? (
                <div className="flex items-center text-accent space-x-1">
                  <CheckSquare size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Done</span>
                </div>
              ) : (
                <button className="p-2 text-slate-500 hover:text-white transition-colors">
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Tasks;
