import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Mail, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabase';

const Auth: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'register') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              referral_code: referralCode,
            },
          },
        });
        if (signUpError) throw signUpError;
        alert('Access Protocol Initialized! Please sign in.');
        navigate('/login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Protocol Failure: Invalid Credentials');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-black flex flex-col md:flex-row overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/20 blur-[150px] rounded-full animate-pulse [animation-delay:2s]" />
      </div>

      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-3/5 relative items-center justify-center p-24">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-black to-black opacity-90" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        
        <div className="relative z-10 space-y-12 max-w-2xl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-24 h-24 bg-white/5 backdrop-blur-3xl rounded-[2rem] flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(139,92,246,0.3)]"
          >
            <TrendingUp size={48} className="text-primary group-hover:rotate-12 transition-transform" />
          </motion.div>
          
          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center space-x-3 text-primary text-sm font-black uppercase tracking-[0.5em]"
            >
              <div className="w-12 h-[2px] bg-primary" />
              <span>Tradify Protocol 1.0.4</span>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl md:text-5xl font-black text-white leading-[0.9] tracking-tighter uppercase"
            >
              The Next <br />
              <span className="text-primary text-2xl md:text-4xl">Generation</span> <br />
              of Trading
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-slate-500 text-lg md:text-xl font-bold leading-relaxed max-w-lg opacity-80"
            >
              Secure high-yield neural assets with the most advanced trading ecosystem on the block.
            </motion.p>
          </div>

          <div className="flex items-center space-x-10 p-8 glass-card border-white/5 bg-white/2 w-fit">
            {[
              { label: 'Uptime', value: '100%' },
              { label: 'Nodes', value: '1,240' },
              { label: 'TVL', value: '$84M' },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (i * 0.1) }}
              >
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-lg font-black text-white tracking-widest uppercase">{stat.value}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24 relative z-10">
        <div className="max-w-md w-full mx-auto space-y-12">
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-14 h-14 bg-primary/20 rounded-[1.2rem] flex items-center justify-center border border-primary/20">
              <TrendingUp className="text-primary w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">Market Assets Management</h3>
              <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">Access Point: Alpha-01</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none uppercase">
              {mode === 'login' ? 'SIGN IN' : 'REGISTER'}
            </h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-wide">
              {mode === 'login' ? 'Access your trading account.' : 'Create your account to start trading and investing.'}
            </p>
          </div>
          <div className="space-y-8">
            <form className="space-y-6" onSubmit={handleAuth}>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-3 animate-pulse" />
                  {error}
                </motion.div>
              )}

              <div className="space-y-6">
                {mode === 'register' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe" 
                        required
                        className="input-field w-full pl-14 py-5 bg-white/2 hover:bg-white/5 border-white/5 rounded-3xl text-sm font-bold placeholder:opacity-30"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com" 
                      required
                      className="input-field w-full pl-14 py-5 bg-white/2 hover:bg-white/5 border-white/5 rounded-3xl text-sm font-bold placeholder:opacity-30"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" 
                      required
                      className="input-field w-full pl-14 py-5 bg-white/2 hover:bg-white/5 border-white/5 rounded-3xl text-sm font-bold placeholder:opacity-30"
                    />
                  </div>
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full primary-button py-6 text-xs font-black flex items-center justify-center space-x-3 shadow-[0_20px_40px_rgba(243,186,47,0.2)] group overflow-hidden relative rounded-3xl"
              >
                <span className="relative z-10">
                  {loading ? 'PROCESSING...' : (mode === 'login' ? 'SIGN IN' : 'SIGN UP')}
                </span>
                {!loading && <ArrowRight size={20} className="relative z-10 group-hover:translate-x-2 transition-transform duration-500" />}
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white opacity-20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-1000" />
              </button>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[9px] font-black uppercase tracking-widest">
                <span className="bg-black px-4 text-slate-600">Secure Access</span>
              </div>
            </div>
          </div>


          <div className="text-center space-y-8 pt-6">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
              {mode === 'login' ? "New to Tradify?" : "Already have an account?"} {' '}
              <Link 
                to={mode === 'login' ? '/register' : '/login'} 
                className="text-primary hover:text-white transition-colors underline underline-offset-8 decoration-primary/30 ml-2"
              >
                {mode === 'login' ? 'CREATE ACCOUNT' : 'LOGIN'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
