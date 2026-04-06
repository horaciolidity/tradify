import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  X, 
  ShieldCheck, 
  Database,
  History,
  Building2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../services/supabase';

const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<any[]>([]);

  const [depositModal, setDepositModal] = useState(false);
  const [personalAddress, setPersonalAddress] = useState<string | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState('TRC20');

  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  React.useEffect(() => {
    if (profile?.id) {
      fetchTransactions();
      if (depositModal) getPersonalAddress();
    }
  }, [profile, activeTab, selectedNetwork, depositModal]);

  const getPersonalAddress = async () => {
    if (!profile?.id) return;
    setPersonalAddress(null);
    setGenError(null);
    setIsGeneratingAddress(true);
    try {
      const resp = await fetch(`/api/oxapay?user_id=${profile.id}&network=${selectedNetwork}&currency=USDT`);
      const data = await resp.json();
      if (data.address) setPersonalAddress(data.address);
      else setGenError(data.error || 'Error al obtener dirección');
    } catch (e) {
      setGenError('Error de red.');
    } finally {
      setIsGeneratingAddress(false);
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

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawSubmit = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !wallet || amount > wallet.balance_usdc) {
      setWithdrawError('Monto inválido o insuficiente.');
      return;
    }
    setWithdrawSubmitting(true);
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
      setWithdrawError('Error al retirar.');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-2 glass-card p-10 flex flex-col justify-between bg-gradient-to-br from-primary/10 border-white/10 min-h-[250px]">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Balance Disponible</span>
            <h2 className="text-5xl font-black text-white mt-1">{(wallet?.balance_usdc || 0).toLocaleString()} <span className="text-primary text-xl">USDC</span></h2>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setDepositModal(true)} className="px-10 py-4 bg-primary text-black font-black rounded-xl uppercase text-[10px]">Depositar</button>
            <button onClick={() => setWithdrawModal(true)} className="px-10 py-4 bg-white/5 text-white border border-white/10 font-black rounded-xl uppercase text-[10px]">Retirar</button>
          </div>
        </motion.div>

        <div className="glass-card p-8 border-white/10">
          <h3 className="text-white font-black uppercase mb-4">Estado OxaPay</h3>
          <div className="flex items-center gap-2 mb-4 text-emerald-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Conectado</span>
          </div>
          <p className="text-xs text-slate-500 font-bold mb-6 italic">Direcciones personales permanentes vinculadas a tu cuenta.</p>
          <button onClick={() => setDepositModal(true)} className="w-full py-4 border border-white/5 hover:bg-white/5 transition-all text-white font-black text-[10px] uppercase rounded-xl">Configurar</button>
        </div>
      </div>

      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDepositModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10">
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
              <h2 className="text-2xl font-black text-white uppercase mb-8">Depositar USDT</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  {['TRC20', 'BEP20', 'ERC20'].map(n => (
                    <button key={n} onClick={() => setSelectedNetwork(n)} className={`py-4 rounded-xl border text-[10px] font-black ${selectedNetwork === n ? 'border-primary bg-primary/10 text-primary' : 'bg-white/3 border-white/10 text-slate-500'}`}>{n}</button>
                  ))}
                </div>

                <div className="bg-black/40 border border-primary/20 rounded-xl p-6 text-center">
                   <div className="bg-black/60 rounded-lg p-4 mb-4 flex items-center justify-between">
                     <span className="text-xs font-mono text-primary font-black truncate">{personalAddress || (isGeneratingAddress ? 'Sincronizando...' : 'Conectando...')}</span>
                     {personalAddress && <button onClick={() => copyText(personalAddress)} className="p-2 border border-primary/20 text-primary rounded-lg">{copied ? <Check size={18} /> : <Copy size={18} />}</button>}
                   </div>
                   {genError && <p className="text-xs text-error font-bold mb-4">{genError}</p>}
                   <p className="text-[10px] text-slate-500 font-bold uppercase">Solo depósitos vía red {selectedNetwork}</p>
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
              <h2 className="text-2xl font-black text-white uppercase mb-8">Retirar</h2>
              <div className="space-y-4">
                <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="Dirección Destino" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white outline-none" />
                <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00 USDC" className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white outline-none" />
                {withdrawError && <p className="text-xs text-error font-bold">{withdrawError}</p>}
                <button onClick={handleWithdrawSubmit} disabled={withdrawSubmitting} className="w-full py-5 bg-rose-500 text-white font-black rounded-xl uppercase">Confirmar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
           <History className="text-primary" size={24} />
           <h3 className="text-xl font-black text-white uppercase tracking-tighter">Historial de Red</h3>
        </div>
        <div className="glass-card overflow-hidden border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/2 border-b border-white/10">
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Operación</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Monto</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="px-8 py-6 text-xs text-white font-black uppercase">{tx.type}</td>
                  <td className={`px-8 py-6 text-sm font-black ${tx.type === 'deposit' ? 'text-accent' : 'text-rose-500'}`}>{tx.amount} USDC</td>
                  <td className="px-8 py-6 uppercase font-black text-[10px] text-slate-600">{tx.status}</td>
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
