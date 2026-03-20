import React from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { motion } from 'framer-motion';
import { User, Mail, Shield, LogOut, Camera, Wallet as WalletIcon, Calendar } from 'lucide-react';

const Profile: React.FC = () => {
  const { profile, wallet, signOut } = useAuthStore();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent border-b border-white/5" />
        <div className="px-8 pb-10">
          <div className="relative -mt-16 flex items-end justify-between mb-8">
            <div className="flex items-end space-x-6">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[2rem] bg-slate-800 border-4 border-dark flex items-center justify-center overflow-hidden shadow-2xl">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={64} className="text-primary/40" />
                  )}
                </div>
                <button className="absolute bottom-2 right-2 p-2 bg-primary rounded-xl text-black shadow-xl opacity-0 group-hover:opacity-100 transition-all">
                  <Camera size={16} />
                </button>
              </div>
              <div className="pb-2">
                <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">{profile?.full_name || 'Member Account'}</h1>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs flex items-center">
                  <Shield size={12} className="mr-2 text-primary" />
                  Security Level: Protected
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => signOut()}
              className="px-8 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center shadow-xl mb-2 group"
            >
              <LogOut size={16} className="mr-3 group-hover:-translate-x-1 transition-transform" />
              Sign Out
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/5">
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic mb-4">Personal Nexus</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white/5 rounded-lg">
                      <Mail size={16} className="text-slate-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Email Address</span>
                  </div>
                  <span className="text-sm font-bold text-white italic">{profile?.email}</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-white/5 rounded-lg">
                      <Calendar size={16} className="text-slate-400" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Joined Date</span>
                  </div>
                  <span className="text-sm font-bold text-white italic">{new Date(profile?.created_at || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] italic mb-4">Financial Core</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/2 rounded-2xl border border-white/5">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <WalletIcon size={16} className="text-accent" />
                    </div>
                    <span className="text-xs font-bold text-slate-400">Total Balance</span>
                  </div>
                  <span className="text-xl font-black text-accent italic">{(wallet?.balance_usdc || 0).toLocaleString()} <span className="text-xs font-normal opacity-40">USDC</span></span>
                </div>

                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Referral Code</p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-black text-white italic tracking-[0.2em]">{profile?.referral_code || 'N/A'}</span>
                    <button className="text-[10px] font-black text-primary uppercase border-b border-primary/20">Copy Code</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Security Settings', desc: 'Secure your trade nodes', icon: Shield },
          { label: 'Market Preferences', desc: 'Adjust execution speeds', icon: LogOut },
          { label: 'Notification Hub', desc: 'Manage neural signals', icon: User }
        ].map((item, i) => (
          <div key={i} className="glass-card p-6 border border-white/5 hover:border-primary/20 transition-all group cursor-pointer">
            <div className="p-3 bg-white/2 rounded-xl w-fit mb-4 group-hover:bg-primary/10 transition-colors">
              <item.icon size={20} className="text-slate-500 group-hover:text-primary transition-colors" />
            </div>
            <h4 className="font-black text-white italic text-sm mb-1">{item.label}</h4>
            <p className="text-xs text-slate-500 font-medium">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;
