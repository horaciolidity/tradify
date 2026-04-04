import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Send, User, MessageSquare, UserPlus, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    email: string;
    full_name: string;
    avatar_url?: string;
  };
}

interface TradingChatProps {
  activePositions?: any[];
  tickers?: { symbol: string, price: number }[];
  followedIds?: Set<string>;
  onToggleFollow?: (userId: string) => void;
}

const TradingChat: React.FC<TradingChatProps> = ({ 
  activePositions = [], 
  tickers = [], 
  followedIds = new Set(), 
  onToggleFollow 
}) => {
  const { profile } = useAuthStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('public:chat_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const { data: userData } = await supabase
            .from('profiles')
            .select('email, full_name, avatar_url')
            .eq('id', payload.new.user_id)
            .single();

          const fullMsg = { ...payload.new, profile: userData } as ChatMessage;
          setMessages((prev) => [...prev, fullMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profile:profiles(email, full_name, avatar_url)')
      .order('created_at', { ascending: true })
      .limit(50);
    
    if (data) setMessages(data as any);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    setLoading(true);

    let finalMessage = newMessage.trim();
    if (activePositions.length > 0) {
       const pos = activePositions[0]; // Take most recent
       const currentPrice = tickers.find(t => t.symbol === pos.symbol)?.price || pos.price_at_execution;
       const diff = (currentPrice - pos.price_at_execution) / pos.price_at_execution;
       const pnlPct = pos.type === 'long' ? diff * 100 : -diff * 100;
       
       const prefix = `[${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}% ${pos.symbol.split('/')[0]}]`;
       finalMessage = `${prefix} ${finalMessage}`;
    }

    const { error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: profile.id,
        message: finalMessage
      });

    if (error) {
      console.error(error);
    } else {
      setNewMessage('');
    }
    setLoading(false);
  };

  return (
    <div className="glass-card flex flex-col h-[500px] overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/2">
        <div className="flex items-center space-x-2">
          <MessageSquare size={18} className="text-primary" />
          <h3 className="font-black text-xs uppercase tracking-widest italic">Signal Terminal</h3>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Live</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.map((msg) => {
          const isMe = msg.user_id === profile?.id;
          const isFollowed = followedIds.has(msg.user_id);

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed ${
                isMe 
                  ? 'bg-primary/10 border border-primary/20 text-white rounded-tr-none' 
                  : 'bg-white/5 border border-white/5 text-slate-300 rounded-tl-none'
              }`}>
                <div className="flex items-center justify-between space-x-4 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-[9px] uppercase tracking-tighter text-primary">
                      {msg.profile?.full_name || msg.profile?.email.split('@')[0] || 'Entity'}
                    </span>
                    <span className="text-[8px] text-slate-600 font-bold uppercase italic opacity-50">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {!isMe && onToggleFollow && (
                    <button 
                      onClick={() => onToggleFollow(msg.user_id)}
                      className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border transition-all ${
                        isFollowed 
                          ? 'bg-accent/20 border-accent/40 text-accent' 
                          : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'
                      }`}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck size={10} />
                          <span className="text-[7px] font-black italic">FOLLOWING</span>
                        </>
                      ) : (
                        <>
                          <UserPlus size={10} />
                          <span className="text-[7px] font-black italic">FOLLOW</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div>
                   {msg.message.match(/^\[([+-][\d.]+% \w+)\]\s(.*)$/) ? (
                      <>
                         <span className={`font-mono font-black italic tracking-tighter mr-2 ${msg.message.startsWith('[+') ? 'text-accent' : msg.message.startsWith('[-') ? 'text-error' : 'text-primary'}`}>
                            {msg.message.match(/^\[([+-][\d.]+% \w+)\]\s(.*)$/)?.[1] && `[${msg.message.match(/^\[([+-][\d.]+% \w+)\]\s(.*)$/)?.[1]}]`}
                         </span>
                         <span className="break-words">{msg.message.match(/^\[([+-][\d.]+% \w+)\]\s(.*)$/)?.[2]}</span>
                      </>
                   ) : (
                      <span className="break-words">{msg.message}</span>
                   )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-white/2 border-t border-white/5">
        <div className="relative">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={loading}
            placeholder="Broadcast signal..."
            className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-xs font-bold text-white focus:border-primary/50 focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className="absolute right-2 top-1.5 p-2 text-primary hover:text-white disabled:opacity-30 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default TradingChat;
