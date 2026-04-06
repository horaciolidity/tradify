import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  History,
  Info,
  CreditCard,
  Building2,
  QrCode,
  X,
  ShieldCheck,
  Database,
  Wallet2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import type { Transaction } from '../types';
import { supabase } from '../services/supabase';

// ──────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const DEPOSIT_NETWORKS = [
  { id: 'TRC20', name: 'Tron (USDT)', label: 'TRC20', currency: 'USDT', color: '#FF0013' },
  { id: 'BEP20', name: 'BSC (USDT)',  label: 'BEP20', currency: 'USDT', color: '#F0B90B' },
  { id: 'ERC20', name: 'Ethereum (USDT)', label: 'ERC20', currency: 'USDT', color: '#627EEA' },
];

const WITHDRAW_NETWORKS = [
  { id: '56',  name: 'BSC',      label: 'BNB Smart Chain',  color: '#F0B90B' },
  { id: '10',  name: 'OP',       label: 'Optimism',         color: '#FF0420' },
  { id: '1',   name: 'ETH',      label: 'Ethereum',         color: '#627EEA' },
];

// ──────────────────────────────────────────────────────────────────────────────
const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Deposit modal
  const [depositModal, setDepositModal] = useState(false);
  const [personalAddress, setPersonalAddress] = useState<string | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedDepNetwork, setSelectedDepNetwork] = useState(DEPOSIT_NETWORKS[0]);

  // Withdrawal modal
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState(WITHDRAW_NETWORKS[0]);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  React.useEffect(() => {
    if (profile) {
      fetchTransactions();
      if (depositModal) {
        getPersonalAddress();
      }
    }
  }, [profile, activeTab, selectedDepNetwork, depositModal]);

  const getPersonalAddress = async () => {
    if (!profile?.id) return;
    setPersonalAddress(null);
    setGenError(null);
    setIsGeneratingAddress(true);
    try {
      const resp = await fetch(`/api/oxapay?user_id=${profile.id}&network=${selectedDepNetwork.id}&currency=${selectedDepNetwork.currency}`);
      
      if (!resp.ok) {
        throw new Error(`Error del servidor: ${resp.status}`);
      }

      const data = await resp.json();
      if (data.address) {
        setPersonalAddress(data.address);
      } else if (data.error) {
        setGenError(data.details || data.error);
      } else {
        setGenError('No se pudo obtener la dirección');
      }
    } catch (e: any) {
      console.error('Failed to get personal address:', e);
      setGenError('Error de conexión con el backend.');
    } finally {
      setIsGeneratingAddress(false);
    }
  };

  const fetchTransactions = async () => {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', profile?.id)
      .order('created_at', { ascending: false });
    if (activeTab === 'deposits')    query = query.eq('type', 'deposit');
    if (activeTab === 'withdrawals') query = query.eq('type', 'withdrawal');
    const { data, error } = await query;
    if (!error && data) setTransactions(data);
  };

  const copyText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawSubmit = async () => {
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) { setWithdrawError('Ingrese una cantidad válida.'); return; }
    if (amount < 10) { setWithdrawError('El retiro mínimo es 10 USDC.'); return; }
    if (!wallet || amount > wallet.balance_usdc) { setWithdrawError(`Margen insuficiente.`); return; }

    setWithdrawSubmitting(true);
    try {
      const { error: txError } = await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'withdrawal',
        amount,
        description: `Retiro vía ${withdrawNetwork.label} a ${withdrawAddress.slice(0, 10)}...`,
        status: 'pending',
        tx_hash: withdrawAddress
      });

      if (txError) throw txError;

      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchTransactions();
    } catch (err: any) {
      console.error('Withdraw error:', err);
      setWithdrawError('Error al procesar retiro.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">

      {/* ── Wallet Hero ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lg:col-span-2 glass-card bg-gradient-to-br from-primary/30 via-indigo-900/40 to-transparent p-10 flex flex-col justify-between min-h-[280px] relative overflow-hidden group border-white/10"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12 group-hover:scale-175 transition-transform duration-1000">
            <CreditCard size={180} />
          </div>
          <div className="relative z-10 flex justify-between items-start">
            <div className="flex-1">
             <span className="terminal-label block mb-2">Available Assets //</span>
             <h2 className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                {(wallet?.balance_usdc || 0).toLocaleString()} <span className="text-primary text-xl md:text-2xl font-black ml-2">USDC</span>
             </h2>
             <div className="flex items-center space-x-2 mt-4 text-accent">
                <ShieldCheck size={12} />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Secured Protocol</span>
             </div>
            </div>
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center backdrop-blur-2xl border border-white/10 shadow-2xl">
              <Building2 className="text-primary" size={32} />
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-4 mt-10">
             <button onClick={() => setDepositModal(true)} className="flex items-center space-x-3 px-8 py-4 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                <Plus size={18} />
                <span>Depositar</span>
             </button>
             <button onClick={() => setWithdrawModal(true)} className="flex items-center space-x-3 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-inter">
                <ArrowUpRight size={18} />
                <span>Retirar</span>
             </button>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-8 border-white/10 relative overflow-hidden">
          <div className="space-y-6 relative z-10">
            <h3 className="font-black text-white uppercase tracking-tighter text-lg">OxaPay Direct</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-bold">Direcciones automáticas y permanentes.</p>
            <div className="space-y-3">
               {['⚡ instantáneo', '🛡️ seguro', '🌍 global'].map(t => (
                 <div key={t} className="flex items-center space-x-2">
                   <div className="w-1 h-1 rounded-full bg-primary" />
                   <span className="text-[10px] text-slate-500 font-bold uppercase">{t}</span>
                 </div>
               ))}
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDepositModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="glass-card w-full max-w-xl p-10 relative z-10 border-white/10">
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={28} /></button>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Cargar Activos</h3>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">Red (USDT)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DEPOSIT_NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setSelectedDepNetwork(n)} className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${selectedDepNetwork.id === n.id ? 'border-primary bg-primary/10 text-primary' : 'bg-white/3 border-white/10 text-slate-500'}`}>
                        {n.label}
                      </button>
                    ))}
                  </div>
                </div>

                {genError ? (
                  <div className="p-6 bg-error/10 border border-error/20 rounded-2xl text-center">
                    <p className="text-xs text-error font-bold mb-4">{genError}</p>
                    <button onClick={getPersonalAddress} className="px-4 py-2 bg-error/20 text-error rounded-lg text-[10px] font-black uppercase tracking-widest">Reintentar</button>
                  </div>
                ) : (
                  <div className="bg-black/40 border border-primary/30 rounded-2xl p-8 flex flex-col items-center space-y-6">
                    <div className="w-full bg-black/60 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                      <span className="text-sm font-mono text-primary font-black truncate mr-4">
                        {personalAddress || (isGeneratingAddress ? 'Sincronizando...' : 'Conectando...')}
                      </span>
                      {personalAddress && (
                        <button onClick={() => copyText(personalAddress)} className="p-3 bg-primary/10 text-primary rounded-xl">
                          {copied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-center text-slate-500 font-bold leading-relaxed">
                      Envía solo <span className="text-white">USDT</span> vía <span className="text-white">{selectedDepNetwork.name}</span>.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Withdrawal Modal (Simplified) ─────────────────────────────────── */}
      <AnimatePresence>
        {withdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWithdrawModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }} className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10">
              <button onClick={() => setWithdrawModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={28} /></button>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-8">Retirar</h3>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Red</label>
                  <div className="grid grid-cols-3 gap-3">
                    {WITHDRAW_NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setWithdrawNetwork(n)} className={`py-3 rounded-2xl border text-[11px] font-black uppercase transition-all ${withdrawNetwork.id === n.id ? 'border-primary text-primary' : 'bg-white/3 border-white/10 text-slate-500'}`}>
                        {n.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Dirección</label>
                  <input type="text" value={withdrawAddress} onChange={(e) => setWithdrawAddress(e.target.value)} placeholder="0x..." className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-mono text-xs outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Cantidad USDC</label>
                  <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="0.00" className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black text-lg outline-none" />
                </div>

                {withdrawError && <p className="text-xs text-error font-bold">{withdrawError}</p>}

                <button onClick={handleWithdrawSubmit} disabled={withdrawSubmitting || !withdrawAmount || !withdrawAddress} className="w-full py-5 bg-rose-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl disabled:opacity-40">
                  {withdrawSubmitting ? 'Procesando...' : 'Confirmar Retiro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Transactions Table (Simplified/Robust) ────────────────────────── */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20"><History size={24} className="text-primary" /></div>
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Historial</h3>
          </div>
          <div className="flex bg-white/2 p-1.5 rounded-2xl border border-white/5">
            {['all', 'deposits', 'withdrawals'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === t ? 'bg-primary text-white' : 'text-slate-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cantidad</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length > 0 ? transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/2 transition-all">
                    <td className="px-8 py-6 text-xs font-black uppercase text-white">{tx.type}</td>
                    <td className={`px-8 py-6 text-sm font-black ${tx.type === 'deposit' ? 'text-accent' : 'text-rose-500'}`}>
                      {tx.amount.toLocaleString()} USDC
                    </td>
                    <td className="px-8 py-6">
                      <span className={`text-[10px] font-black uppercase ${tx.status === 'completed' ? 'text-accent' : 'text-amber-500'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-[10px] font-black text-slate-600">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} className="px-8 py-20 text-center opacity-30 font-black uppercase text-[10px]">Sin transacciones</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Wallet;
