import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  X, 
  ShieldCheck, 
  History,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';

// Redes de OxaPay
const DEPOSIT_NETWORKS = [
  { id: 'TRC20', name: 'Tron (USDT)', label: 'TRC20', currency: 'USDT' },
  { id: 'BEP20', name: 'BSC (USDT)',  label: 'BEP20', currency: 'USDT' },
  { id: 'ERC20', name: 'Ethereum (USDT)', label: 'ERC20', currency: 'USDT' },
];

const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<any[]>([]);

  // Modales
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);

  // Depósito OxaPay
  const [personalAddress, setPersonalAddress] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedNet, setSelectedNet] = useState(DEPOSIT_NETWORKS[0]);

  // Retiro
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  useEffect(() => {
    if (profile?.id) {
      fetchTransactions();
      if (depositModal) fetchPersonalAddress();
    }
  }, [profile, activeTab, selectedNet, depositModal]);

  const fetchPersonalAddress = async () => {
    if (!profile?.id) return;
    setPersonalAddress(null);
    setGenError(null);
    setIsGenerating(true);
    try {
      const resp = await fetch(`/api/oxapay?user_id=${profile.id}&network=${selectedNet.id}&currency=${selectedNet.currency}`);
      const data = await resp.json();
      if (data.address) setPersonalAddress(data.address);
      else setGenError(data.error || 'Error de sincronización.');
    } catch {
      setGenError('Error de red.');
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchTransactions = async () => {
    if (!profile?.id) return;
    let query = supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    if (activeTab === 'deposits')    query = query.eq('type', 'deposit');
    if (activeTab === 'withdrawals') query = query.eq('type', 'withdrawal');
    const { data } = await query;
    if (data) setTransactions(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !wallet || amount > wallet.balance_usdc) {
      setWithdrawError('Monto insuficiente o inválido.');
      return;
    }
    setWithdrawPending(true);
    try {
      await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'withdrawal',
        amount,
        description: `Retiro a ${withdrawAddress.slice(0, 8)}...`,
        status: 'pending',
        tx_hash: withdrawAddress
      });
      setWithdrawModal(false);
      fetchTransactions();
    } catch {
      setWithdrawError('Error al procesar retiro.');
    } finally {
      setWithdrawPending(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2 glass-card p-10 bg-gradient-to-br from-primary/10 border-white/10 min-h-[250px] flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Balance de Nodo</span>
            <h2 className="text-5xl font-black text-white mt-1">{(wallet?.balance_usdc || 0).toLocaleString()} <span className="text-primary text-xl font-display">USDC</span></h2>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setDepositModal(true)} className="px-10 py-4 bg-primary text-black font-black rounded-xl uppercase text-[10px] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">Depositar</button>
            <button onClick={() => setWithdrawModal(true)} className="px-10 py-4 bg-white/5 text-white border border-white/10 font-black rounded-xl uppercase text-[10px] hover:bg-white/10 transition-all">Retirar</button>
          </div>
        </motion.div>

        <div className="glass-card p-8 border-white/10">
          <h3 className="text-white font-black uppercase mb-4 text-sm tracking-tighter">OxaPay Network</h3>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Sincronización Activa</span>
          </div>
          <p className="text-xs text-slate-500 font-bold mb-6 italic leading-relaxed">Depósitos instantáneos vía TRC20, BEP20 y ERC20.</p>
          <button onClick={() => setDepositModal(true)} className="w-full py-4 border border-white/5 hover:bg-white/5 transition-all text-white font-black text-[10px] uppercase rounded-xl">Gestionar Direcciones</button>
        </div>
      </div>

      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDepositModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10">
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase mb-8 italic">Configurar Depósito</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {DEPOSIT_NETWORKS.map(n => (
                    <button key={n.id} onClick={() => setSelectedNet(n)} className={`py-4 rounded-xl border text-[10px] font-black transition-all ${selectedNet.id === n.id ? 'border-primary bg-primary/10 text-primary' : 'bg-white/3 border-white/10 text-slate-500'}`}>{n.label}</button>
                  ))}
                </div>

                <div className="bg-black/40 border border-primary/20 rounded-xl p-8 text-center flex flex-col items-center">
                   <div className="bg-black/60 rounded-xl p-4 mb-4 flex items-center justify-between w-full border border-white/5">
                     <span className="text-xs font-mono text-primary font-black truncate">{personalAddress || (isGenerating ? 'Enlazando...' : 'Obteniendo...') }</span>
                     {personalAddress && <button onClick={() => copyToClipboard(personalAddress)} className="p-2 border border-primary/20 text-primary rounded-lg hover:bg-primary/20 transition-all">{copied ? <Check size={18} /> : <Copy size={18} />}</button>}
                   </div>
                   {genError && <p className="text-xs text-error font-black mb-4">{genError}</p>}
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Envía USDT exclusivamente por red {selectedNet.name}</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {withdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWithdrawModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="glass-card w-full max-w-md p-10 relative z-10 border-white/10">
              <button onClick={() => setWithdrawModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase mb-8 italic">Retirar USDC</h2>
              <div className="space-y-4">
                <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="Dirección de Billetera" className="w-full bg-black border border-white/5 p-4 rounded-xl text-white outline-none focus:border-primary/50 transition-all font-mono" />
                <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00 USDC" className="w-full bg-black border border-white/5 p-4 rounded-xl text-white outline-none focus:border-primary/50 transition-all font-black" />
                {withdrawError && <p className="text-xs text-error font-black">{withdrawError}</p>}
                <button onClick={handleWithdraw} disabled={withdrawPending} className="w-full py-5 bg-rose-600 text-white font-black rounded-xl uppercase tracking-widest disabled:opacity-50 hover:bg-rose-500 transition-all">{withdrawPending ? 'Procesando...' : 'Confirmar Retiro'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
           <History className="text-primary" size={24} />
           <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Historial de Red</h3>
        </div>
        <div className="glass-card overflow-hidden border-white/10 bg-white/2">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Tipo</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Monto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(tx => (
                <tr key={tx.id} className="hover:bg-white/2 transition-all">
                  <td className="px-8 py-6 text-xs text-white font-black uppercase italic">{tx.type}</td>
                  <td className={`px-8 py-6 text-sm font-black ${tx.type === 'deposit' || tx.type === 'profit' ? 'text-accent' : 'text-rose-500'}`}>{tx.amount} USDC</td>
                  <td className="px-8 py-6 uppercase font-black text-[10px] text-slate-600 tracking-widest">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
