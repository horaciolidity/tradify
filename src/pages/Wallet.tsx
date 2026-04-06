import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  History,
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
import { supabase } from '../services/supabase';

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

const Wallet: React.FC = () => {
  const { wallet, profile } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all');
  const [transactions, setTransactions] = useState<any[]>([]);

  const [depositModal, setDepositModal] = useState(false);
  const [personalAddress, setPersonalAddress] = useState<string | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [selectedDepNetwork, setSelectedDepNetwork] = useState(DEPOSIT_NETWORKS[0]);

  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawNetwork, setWithdrawNetwork] = useState(WITHDRAW_NETWORKS[0]);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  React.useEffect(() => {
    if (profile) {
      fetchTransactions();
      if (depositModal) getPersonalAddress();
    }
  }, [profile, activeTab, selectedDepNetwork, depositModal]);

  const getPersonalAddress = async () => {
    if (!profile?.id) return;
    setPersonalAddress(null);
    setGenError(null);
    setIsGeneratingAddress(true);
    try {
      const resp = await fetch(`/api/oxapay?user_id=${profile.id}&network=${selectedDepNetwork.id}&currency=${selectedDepNetwork.currency}`);
      const data = await resp.json();
      if (data.address) setPersonalAddress(data.address);
      else setGenError(data.error || 'Error al obtener dirección');
    } catch (e) {
      setGenError('Error de red al conectar con el servidor.');
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
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { setWithdrawError('Cantidad inválida'); return; }
    if (!wallet || amount > wallet.balance_usdc) { setWithdrawError('Saldo insuficiente'); return; }

    setWithdrawSubmitting(true);
    try {
      const { error } = await supabase.from('transactions').insert({
        user_id: profile?.id,
        type: 'withdrawal',
        amount,
        description: `Retiro ${withdrawNetwork.name} a ${withdrawAddress.slice(0, 8)}...`,
        status: 'pending',
        tx_hash: withdrawAddress
      });
      if (error) throw error;
      setWithdrawModal(false);
      fetchTransactions();
    } catch {
      setWithdrawError('Error al procesar el retiro');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass-card bg-gradient-to-br from-primary/20 p-10 flex flex-col justify-between min-h-[250px] border-white/10">
          <div>
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Balance de Cuenta</span>
            <h2 className="text-4xl md:text-6xl font-black text-white mt-2">{(wallet?.balance_usdc || 0).toLocaleString()} <span className="text-primary text-2xl">USDC</span></h2>
          </div>
          <div className="flex gap-4 mt-8">
            <button onClick={() => setDepositModal(true)} className="px-10 py-4 bg-primary text-black rounded-2xl font-black text-xs uppercase hover:scale-105 transition-all">Depositar</button>
            <button onClick={() => setWithdrawModal(true)} className="px-10 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-xs uppercase hover:bg-white/10 transition-all">Retirar</button>
          </div>
        </motion.div>

        <div className="glass-card p-8 border-white/10">
          <h3 className="font-black text-white uppercase text-lg mb-4">Estado OxaPay</h3>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Sincronizado</span>
          </div>
          <p className="text-xs text-slate-500 font-bold leading-relaxed mb-6">Tu cuenta está vinculada a OxaPay para depósitos automáticos en múltiples redes.</p>
          <button onClick={() => setDepositModal(true)} className="w-full py-4 border border-white/10 rounded-xl text-[10px] font-black uppercase hover:bg-white/5 transition-all">Ver Direcciones</button>
        </div>
      </div>

      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDepositModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-xl p-10 relative z-10 border-white/10">
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
              <h3 className="text-2xl font-black text-white uppercase mb-8">Depositar Fondos</h3>
              
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-4">Selecciona Red (USDT)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DEPOSIT_NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setSelectedDepNetwork(n)} className={`py-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${selectedDepNetwork.id === n.id ? 'border-primary bg-primary/10 text-primary' : 'bg-white/3 border-white/10 text-slate-500'}`}>{n.label}</button>
                    ))}
                  </div>
                </div>

                <div className="bg-black/40 border border-primary/20 rounded-2xl p-8 flex flex-col items-center">
                  <div className="w-full bg-black/60 rounded-xl p-5 mb-4 flex items-center justify-between">
                    <span className="text-sm font-mono text-primary font-black truncate">{personalAddress || (isGeneratingAddress ? 'Sincronizando...' : 'Conectando...')}</span>
                    {personalAddress && <button onClick={() => copyText(personalAddress)} className="p-2 bg-primary/10 text-primary rounded-lg">{copied ? <Check size={18} /> : <Copy size={18} />}</button>}
                  </div>
                  {genError && <p className="text-xs text-error font-bold mb-4">{genError}</p>}
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center">Envía USDT por red {selectedDepNetwork.name}</p>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10">
              <button onClick={() => setWithdrawModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={24} /></button>
              <h3 className="text-2xl font-black text-white uppercase mb-8">Retirar USDC</h3>
              <div className="space-y-6">
                <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="Dirección 0x... / T..." className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-white font-mono text-xs outline-none" />
                <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00 USDC" className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-white font-black outline-none" />
                {withdrawError && <p className="text-xs text-error font-bold">{withdrawError}</p>}
                <button onClick={handleWithdrawSubmit} disabled={withdrawSubmitting} className="w-full py-5 bg-rose-500 text-white font-black rounded-xl uppercase tracking-widest disabled:opacity-50">{withdrawSubmitting ? 'Procesando...' : 'Retirar Cripto'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <h3 className="text-2xl font-black text-white uppercase">Actividad</h3>
        <div className="glass-card overflow-hidden border-white/5">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/2 border-b border-white/5">
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">Tipo</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">Cantidad</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map(tx => (
                <tr key={tx.id}>
                  <td className="px-8 py-6 text-xs font-black uppercase text-white">{tx.type}</td>
                  <td className={`px-8 py-6 text-sm font-black ${tx.type === 'deposit' ? 'text-accent' : 'text-rose-500'}`}>{tx.amount} USDC</td>
                  <td className="px-8 py-6 text-[10px] font-black uppercase text-slate-500">{tx.status}</td>
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
