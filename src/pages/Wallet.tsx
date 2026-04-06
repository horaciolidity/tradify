import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Check, 
  RefreshCcw,
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
      // Intentamos llamar a la API de Vercel
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
      setGenError('Error de conexión con el servidor de pagos. Asegúrate de que las variables de entorno estén configuradas en Vercel.');
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

  const notifyAdmin = async (title: string, message: string) => {
    try {
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .single();
      if (adminProfile) {
        await supabase.from('notifications').insert({
          user_id: adminProfile.id,
          title,
          message,
          type: 'transaction'
        });
      }
    } catch (e) {
      console.warn('Could not notify admin:', e);
    }
  };

  const handleWithdrawSubmit = async () => {
    setWithdrawError('');
    const amount = parseFloat(withdrawAmount);

    if (!amount || amount <= 0) { setWithdrawError('Ingrese una cantidad válida.'); return; }
    if (!withdrawAddress.match(/^0x[0-9a-fA-F]{40}$/) && !withdrawAddress.match(/^[T][a-zA-Z0-9]{33}$/)) { 
      setWithdrawError('Dirección de billetera inválida.'); return; 
    }
    if (!wallet || amount > wallet.balance_usdc) { setWithdrawError(`Margen insuficiente. Tiene ${(wallet?.balance_usdc || 0).toFixed(4)} USDC disponibles.`); return; }
    if (amount < 10) { setWithdrawError('El retiro mínimo es 10 USDC.'); return; }

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

      await notifyAdmin(
        '🏧 Nueva Solicitud de Retiro',
        `Usuario ${profile?.email} solicitó un retiro de ${amount.toFixed(2)} USDC a ${withdrawAddress.slice(0, 12)}... vía ${withdrawNetwork.label}.`
      );

      setWithdrawModal(false);
      setWithdrawAmount('');
      setWithdrawAddress('');
      fetchTransactions();
    } catch (err: any) {
      console.error('Withdraw error:', err);
      setWithdrawError('Error al procesar retiro. ' + (err.message || 'Inténtelo de nuevo.'));
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
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Secured by Protocol v2.5</span>
             </div>
            </div>
            <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center backdrop-blur-2xl border border-white/10 shadow-2xl">
              <Building2 className="text-primary" size={32} />
            </div>
          </div>
          <div className="relative z-10 flex flex-wrap gap-4 mt-10">
             <button 
               onClick={() => setDepositModal(true)}
               className="flex items-center space-x-3 px-8 py-4 bg-primary text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20"
             >
                <Plus size={18} />
                <span>Depositar Fondos</span>
             </button>
             <button 
               onClick={() => setWithdrawModal(true)}
               className="flex items-center space-x-3 px-8 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-inter"
             >
                <ArrowUpRight size={18} />
                <span>Retirar Capital</span>
             </button>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-8 flex flex-col justify-between border-white/10 relative overflow-hidden"
        >
          <div className="absolute bottom-0 right-0 p-8 opacity-5"><QrCode size={120} /></div>
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white uppercase tracking-tighter text-lg">Depósitos OxaPay</h3>
              <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Automático</span>
              </div>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed font-bold">
              Utiliza tu dirección personal única para cada red. Los fondos se acreditan automáticamente tras la confirmación de la red (1-5 min).
            </p>

            <div className="space-y-3">
               {[
                 '⚡ Sin esperas de aprobación manual',
                 '🛡️ Fondos protegidos por custodia OxaPay',
                 '🌍 Soporte para redes Tron, BSC y ETH'
               ].map(t => (
                 <div key={t} className="flex items-center space-x-2">
                   <div className="w-1 h-1 rounded-full bg-primary" />
                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">{t}</span>
                 </div>
               ))}
            </div>

            <button
               onClick={() => setDepositModal(true)}
               className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
               Ver mis direcciones
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── DEPOSIT MODAL (ONLY OXAPAY) ────────────────────────────────────────── */}
      <AnimatePresence>
        {depositModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDepositModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card w-full max-w-xl p-6 md:p-10 relative z-10 border-white/10 max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setDepositModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white">
                <X size={28} />
              </button>

              <div className="flex items-center space-x-4 mb-10">
                <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                  <ArrowDownLeft size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Cargar Activos</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Depósito Automático vía OxaPay</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Network selection */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">1. Seleccionar Red de Depósito (USDT)</label>
                  <div className="grid grid-cols-3 gap-3">
                    {DEPOSIT_NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setSelectedDepNetwork(n)}
                        className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center space-y-1 ${selectedDepNetwork.id === n.id ? 'border-opacity-60' : 'bg-white/3 border-white/10 text-slate-500 hover:bg-white/5'}`}
                        style={selectedDepNetwork.id === n.id ? { background: n.color + '15', borderColor: n.color + '50', color: n.color } : {}}
                      >
                        <span>{n.name}</span>
                        <span className="text-[8px] opacity-60 font-bold">{n.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Address Display */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">2. Enviar fondos a tu dirección personal</label>
                  
                  {genError ? (
                    <div className="p-6 bg-error/10 border border-error/20 rounded-2xl text-center">
                       <AlertCircle className="text-error mx-auto mb-3" size={32} />
                       <p className="text-xs text-error font-bold mb-4">{genError}</p>
                       <button onClick={getPersonalAddress} className="px-4 py-2 bg-error/20 text-error rounded-lg text-[10px] font-black uppercase tracking-widest">Reintentar</button>
                    </div>
                  ) : (
                    <div className="bg-black/40 border border-primary/30 rounded-2xl p-8 flex flex-col items-center space-y-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><QrCode size={100} /></div>
                      
                      <div className="flex items-center justify-between w-full mb-2">
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                           <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Dirección Activa</span>
                         </div>
                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedDepNetwork.label} Network</span>
                      </div>

                      <div className="w-full bg-black/60 border border-white/5 rounded-2xl p-5 flex items-center justify-between group/addr">
                        <span className={`text-sm md:text-base font-mono text-primary font-black truncate mr-4 ${isGeneratingAddress ? 'animate-pulse opacity-50' : ''}`}>
                          {personalAddress || (isGeneratingAddress ? 'Sincronizando...' : 'Conectando con OxaPay...')}
                        </span>
                        {personalAddress && (
                          <button onClick={() => copyText(personalAddress)} className="p-3 bg-primary/10 text-primary rounded-xl shrink-0 hover:scale-110 transition-all">
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                          </button>
                        )}
                      </div>

                      <div className="bg-white/5 rounded-xl p-4 w-full">
                         <p className="text-[10px] text-center text-slate-500 font-bold leading-relaxed">
                            ⚠️ Envía solo <span className="text-white">USDT</span> a través de la red <span className="text-white" style={{color: selectedDepNetwork.color}}>{selectedDepNetwork.name}</span>. 
                            El envío a redes incorrectas resultará en pérdida definitiva.
                         </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl">
                  <div className="flex items-start space-x-3">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      Este sistema es automático. No necesitas enviar capturas ni hashes de transacción. El balance se acreditará en cuanto se detecte el pago en la blockchain.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── WITHDRAWAL MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {withdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setWithdrawModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="glass-card w-full max-w-lg p-10 relative z-10 border-white/10"
            >
              <button onClick={() => setWithdrawModal(false)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><X size={28} /></button>

              <div className="flex items-center space-x-4 mb-8">
                <div className="w-14 h-14 bg-rose-500/20 rounded-2xl flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <ArrowUpRight size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Retiro de Activos</h3>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Margen Disponible: {(wallet?.balance_usdc || 0).toFixed(4)} USDC</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Network Selector */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Seleccionar Red de Retiro</label>
                  <div className="grid grid-cols-3 gap-3">
                    {WITHDRAW_NETWORKS.map(n => (
                      <button key={n.id} onClick={() => setWithdrawNetwork(n)}
                        className={`py-3 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center space-y-1 ${withdrawNetwork.id === n.id ? 'border-opacity-60' : 'bg-white/3 border-white/10 text-slate-500'}`}
                        style={withdrawNetwork.id === n.id ? { background: n.color + '15', borderColor: n.color + '50', color: n.color } : {}}
                      >
                        <span className="text-lg">{n.name === 'BSC' ? '⚡' : n.name === 'OP' ? '🔴' : '💎'}</span>
                        <span>{n.name}</span>
                        <span className="text-[8px] opacity-60 normal-case font-bold">{n.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination Address */}
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center gap-2">
                    <Wallet2 size={12} /> Dirección de Billetera
                  </label>
                  <input type="text" value={withdrawAddress}
                    onChange={(e) => { setWithdrawAddress(e.target.value); setWithdrawError(''); }}
                    placeholder="0x..."
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-mono text-xs focus:border-primary/50 transition-all outline-none" />
                  <p className="text-[10px] text-slate-600 mt-1 font-bold">Verifica que la dirección sea compatible con la red {withdrawNetwork.label}</p>
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cantidad USDC</label>
                    <button onClick={() => setWithdrawAmount(wallet?.balance_usdc.toFixed(4) || '')}
                      className="text-[10px] font-black text-primary uppercase tracking-widest">MÁX</button>
                  </div>
                  <div className="relative">
                    <input type="number" value={withdrawAmount}
                      onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(''); }}
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white font-black text-lg focus:border-primary/50 transition-all outline-none pr-20" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-primary">USDC</span>
                  </div>
                </div>

                {withdrawError && (
                  <div className="flex items-start space-x-3 bg-error/10 border border-error/20 rounded-xl p-4">
                    <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                    <p className="text-xs text-error font-bold">{withdrawError}</p>
                  </div>
                )}

                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-1">
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-widest">Procesamiento</p>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-bold">Los retiros se procesan en un margen de 24 horas. Verifique siempre el destino.</p>
                </div>

                <button onClick={handleWithdrawSubmit} disabled={withdrawSubmitting || !withdrawAmount || !withdrawAddress}
                  className="w-full py-5 bg-rose-500 text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-xl shadow-rose-500/30 hover:scale-[1.02] transition-all disabled:opacity-40 flex items-center justify-center space-x-2">
                  <ArrowUpRight size={18} />
                  <span>{withdrawSubmitting ? 'Procesando...' : `Retirar ${withdrawAmount || '0'} USDC`}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Transactions Table ─────────────────────────────────────────────── */}
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20"><History size={24} className="text-primary" /></div>
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Historial de Transacciones</h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Toda la actividad · Tiempo real</p>
            </div>
          </div>
          <div className="flex bg-white/2 p-1.5 rounded-2xl border border-white/5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'deposits', label: 'Depositos' },
              { id: 'withdrawals', label: 'Retiros' }
            ].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card overflow-hidden border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/2">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Tipo</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Cantidad</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Descripción</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Estado</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.length > 0 ? transactions.map((tx, i) => {
                  const isPositive = ['deposit', 'profit', 'reward', 'referral', 'cashback'].includes(tx.type);
                  return (
                    <motion.tr key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }} className="hover:bg-white/2 transition-all">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`p-3 rounded-xl border ${isPositive ? 'bg-accent/10 text-accent border-accent/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {isPositive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <span className="text-xs font-black uppercase tracking-widest text-white">{tx.type}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-right">
                          <p className={`text-sm font-black tracking-tighter ${isPositive ? 'text-accent' : 'text-rose-500'}`}>
                            {isPositive ? '+' : '-'}{tx.amount.toLocaleString()} USDC
                          </p>
                          <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest">{tx.status}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-xs text-slate-500 font-bold">{tx.description}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${tx.status === 'completed' ? 'bg-accent' : tx.status === 'failed' ? 'bg-error' : 'bg-amber-500 animate-pulse'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${tx.status === 'completed' ? 'text-accent' : tx.status === 'failed' ? 'text-error' : 'text-amber-500'}`}>
                            {tx.status === 'completed' ? 'COMPLETADO' : tx.status === 'failed' ? 'FALLIDO' : 'PENDIENTE'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </td>
                    </motion.tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-30">
                        <Database size={48} className="text-slate-500" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Sin historial de transacciones</p>
                      </div>
                    </td>
                  </tr>
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
