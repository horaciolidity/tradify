import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Mail, Shield, LogOut, Camera, 
  Wallet as WalletIcon, Calendar, Zap, 
  ChevronRight, Star, Trophy, ArrowUpRight, 
  Activity, Award, Lock, Loader2 
} from 'lucide-react';
import { supabase } from '../services/supabase';

const TIERS = [
  { level: 1, name: 'Novice Node', min: 0, color: '#94a3b8', icon: Activity, benefits: ['Standard Referral 5%', 'Basic Neural Access'] },
  { level: 2, name: 'Operator', min: 1000, color: '#f59e0b', icon: Zap, benefits: ['Enhanced Referral 7%', 'Priority Withdrawals', 'Alpha Signals'] },
  { level: 3, name: 'Ambassador', min: 5000, color: '#10b981', icon: Star, benefits: ['Elite Referral 10%', 'Fee Waiver', 'Beta Access to Tokens'] },
  { level: 4, name: 'Sovereign', min: 25000, color: '#facc15', icon: Trophy, benefits: ['Master Referral 15%', 'Private Account Manager', 'Neural Sync Max'] },
];

const Profile: React.FC = () => {
  const { profile, wallet, signOut, setProfile } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [totalInvested, setTotalInvested] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) fetchGrowthData();
  }, [profile]);

  const fetchGrowthData = async () => {
    const { data } = await supabase
      .from('investments')
      .select('amount')
      .eq('user_id', profile?.id)
      .eq('status', 'active');
    
    if (data) {
      const total = data.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      setTotalInvested(total);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) return;
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile?.id}/${Math.random()}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Profile in DB
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile?.id);

      if (updateError) throw updateError;

      // 4. Update local state
      if (profile) setProfile({ ...profile, avatar_url: publicUrl });
      alert('Avatar synchronized successfully.');
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Tier Calculation
  const currentTier = [...TIERS].reverse().find(t => totalInvested >= t.min) || TIERS[0];
  const nextTierIndex = TIERS.findIndex(t => t.level === currentTier.level) + 1;
  const nextTier = nextTierIndex < TIERS.length ? TIERS[nextTierIndex] : null;

  const progress = nextTier 
    ? ((totalInvested - currentTier.min) / (nextTier.min - currentTier.min)) * 100 
    : 100;

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
                <div className="w-32 h-32 rounded-[2rem] bg-slate-800 border-4 border-dark flex items-center justify-center overflow-hidden shadow-2xl relative">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={64} className="text-primary/40" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-2 right-2 p-2 bg-primary rounded-xl text-black shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
                >
                  <Camera size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              <div className="pb-2">
                <div className="flex items-center space-x-3 mb-1">
                  <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">{profile?.full_name || 'Member Account'}</h1>
                  <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[9px] font-black uppercase italic tracking-widest">{currentTier.name}</span>
                </div>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs flex items-center">
                  <Shield size={12} className="mr-2 text-primary" />
                  Security Level: 4.8 Neural Link
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

      {/* ── USER GROWTH & TIERS PANEL ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Tier Progress Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 border-primary/10 bg-gradient-to-br from-primary/5 to-transparent"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <currentTier.icon size={28} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Growth Node</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Level Progression</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Power</p>
              <p className="text-2xl font-black text-white italic tracking-tighter">${totalInvested.toLocaleString()} <span className="text-xs font-normal text-slate-500">USDC</span></p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em] mb-3">
                <span className="text-primary">{currentTier.name}</span>
                <span className="text-slate-500">{nextTier ? `Next: ${nextTier.name}` : 'MAX LEVEL'}</span>
              </div>
              <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                  className="h-full bg-primary rounded-full shadow-[0_0_20px_rgba(243,186,47,0.4)]"
                />
              </div>
              {nextTier && (
                <p className="text-[9px] text-slate-500 mt-3 font-bold uppercase tracking-widest text-center">
                  Invest <span className="text-white">${(nextTier.min - totalInvested).toLocaleString()} more</span> to unlock <span className="text-primary">{nextTier.name}</span>
                </p>
              )}
            </div>

            <div className="h-px bg-white/5" />

            {/* Current Perks */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Current Active Benefits ⚡</p>
              <div className="flex flex-wrap gap-2">
                {currentTier.benefits.map(b => (
                  <span key={b} className="px-3 py-1.5 bg-primary/5 border border-primary/20 rounded-xl text-[9px] font-black text-primary uppercase tracking-widest italic">
                    ✓ {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Higher Tiers / Craftable Progression */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          {TIERS.map((tier) => {
            const isUnlocked = totalInvested >= tier.min;
            const isCurrent = tier.level === currentTier.level;
            return (
              <div 
                key={tier.level}
                className={`glass-card p-5 border transition-all duration-500 ${
                  isCurrent ? 'border-primary/40 bg-primary/10' : 
                  isUnlocked ? 'border-accent/20 bg-accent/5' : 'border-white/5 opacity-40grayscale'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      isUnlocked ? 'bg-primary/20 text-primary border-primary/30' : 'bg-white/5 text-slate-600 border-white/10'
                    }`}>
                      <tier.icon size={20} />
                    </div>
                    <div>
                      <h4 className={`font-black text-sm italic uppercase tracking-tighter ${isUnlocked ? 'text-white' : 'text-slate-600'}`}>{tier.name}</h4>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Requirement: ${tier.min.toLocaleString()} USDC</p>
                    </div>
                  </div>
                  {isUnlocked ? (
                    <div className="flex items-center space-x-2 text-accent">
                      <Award size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Unlocked</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-slate-700">
                      <Lock size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Locked</span>
                    </div>
                  )}
                </div>
                {isCurrent && (
                  <div className="mt-4 pt-4 border-t border-primary/20 flex items-center justify-between">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest animate-pulse">● System Node Active</span>
                    <button className="flex items-center space-x-1 text-[9px] font-black text-white hover:text-primary transition-colors">
                      <span>View Full Tree</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

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
