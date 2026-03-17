import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Mail, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

const Auth: React.FC<{ mode: 'login' | 'register' }> = ({ mode }) => {
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-dark flex flex-col md:flex-row overflow-hidden">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary relative items-center justify-center p-20">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-primary to-secondary opacity-90" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
        
        <div className="relative z-10 space-y-8 max-w-lg">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl"
          >
            <TrendingUp size={32} className="text-white" />
          </motion.div>
          
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-6xl font-black text-white leading-none tracking-tighter"
            >
              INVEST IN THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/50">FUTURE.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-primary-lighter text-xl font-medium leading-relaxed opacity-80"
            >
              Access high-yield crypto investment plans with compound interest and guaranteed liquidity.
            </motion.p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-10">
            {[
              { label: 'Users', value: '10K+' },
              { label: 'Volume', value: '$500M+' },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + (i * 0.1) }}
                className="p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10"
              >
                <p className="text-4xl font-black text-white">{stat.value}</p>
                <p className="text-sm font-bold text-white/60 uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-dark relative">
        <div className="max-w-md w-full mx-auto space-y-10">
          <div className="lg:hidden flex items-center space-x-3 mb-12">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <TrendingUp className="text-white w-6 h-6" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-white italic">Tradify</span>
          </div>

          <div className="space-y-2">
            <h2 className="text-4xl font-bold text-white tracking-tight">
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-slate-500 font-medium">
              {mode === 'login' ? 'Enter your credentials to access your dashboard.' : 'Join Tradify and start growing your crypto portfolio.'}
            </p>
          </div>

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    className="input-field w-full pl-12 py-3.5 bg-white/2 hover:bg-white/5"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="input-field w-full pl-12 py-3.5 bg-white/2 hover:bg-white/5"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="input-field w-full pl-12 py-3.5 bg-white/2 hover:bg-white/5"
                />
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full primary-button py-4 text-sm font-bold flex items-center justify-center space-x-2 shadow-2xl shadow-primary/40 group overflow-hidden relative"
            >
              <span className="relative z-10">{mode === 'login' ? 'Sign In' : 'Get Started'}</span>
              <ArrowRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
            </button>
          </form>

          <div className="text-center space-y-6">
            <p className="text-sm font-medium text-slate-500">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"} {' '}
              <Link 
                to={mode === 'login' ? '/register' : '/login'} 
                className="text-primary hover:text-primary-dark font-bold underline underline-offset-4"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Link>
            </p>

            <div className="flex items-center justify-center space-x-3 py-4 bg-white/2 rounded-2xl border border-white/5">
              <ShieldCheck size={18} className="text-accent" />
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Secured by Supabase Auth</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
