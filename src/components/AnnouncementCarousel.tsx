import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/supabase';
import { ChevronRight, ChevronLeft, Calendar, Info } from 'lucide-react';

interface Announcement {
  id: number;
  title: string;
  content: string;
  image_url: string;
  media_type: 'image' | 'video';
  type: 'announcement' | 'pre_launch' | 'update';
  created_at: string;
}

const AnnouncementCarousel: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (data && data.length > 0) {
      setAnnouncements(data as any);
    } else {
      // Default placeholder if empty
      setAnnouncements([{
        id: 0,
        title: "Tradify Protocol 2.0",
        content: "New neural liquidity engine is now live. Experience 0% fee on spot trades during this week.",
        image_url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=1200",
        media_type: 'image',
        type: 'announcement',
        created_at: new Date().toISOString()
      }]);
    }
  };

  useEffect(() => {
    if (announcements.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [announcements]);

  if (announcements.length === 0) return null;

  const active = announcements[activeIndex];

  return (
    <div className="relative h-56 md:h-80 rounded-2xl md:rounded-[2.5rem] overflow-hidden group shadow-2xl glass-card border-white/5">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {active.media_type === 'video' ? (
            <video
              src={active.image_url}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover brightness-[0.4] transition-transform duration-1000 group-hover:scale-105"
            />
          ) : (
            <img 
              src={active.image_url} 
              alt={active.title} 
              className="w-full h-full object-cover brightness-[0.4] transition-transform duration-1000 group-hover:scale-105" 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent flex flex-col justify-center px-8 md:px-20">
            <div className="flex items-center space-x-3 mb-4">
              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] italic ${
                active.type === 'pre_launch' ? 'bg-amber-500/20 text-amber-500' : 
                active.type === 'update' ? 'bg-primary/20 text-primary' : 
                'bg-accent/20 text-accent'
              }`}>
                {active.type.replace('_', ' ')}
              </span>
              <div className="flex items-center text-slate-500 space-x-2 text-[9px] font-bold uppercase italic">
                <Calendar size={12} />
                <span>{new Date(active.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            
            <h2 className="text-xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-tight mb-4 md:mb-6 max-w-2xl">
              {active.title}
            </h2>
            
            <p className="text-slate-400 text-[10px] md:text-sm font-medium italic max-w-md leading-relaxed mb-6 md:mb-8 line-clamp-2 md:line-clamp-none">
              {active.content}
            </p>

            <div className="flex items-center space-x-3 md:space-x-4">
              <button className="px-6 md:px-8 py-2 md:py-3 bg-primary text-black font-black uppercase tracking-widest text-[8px] md:text-[10px] italic rounded-lg md:rounded-xl hover:bg-white transition-all transform hover:-translate-y-1 shadow-xl shadow-primary/20">
                Explore
              </button>
              <button className="p-2 md:p-3 bg-white/5 hover:bg-white/10 rounded-lg md:rounded-xl text-white transition-all border border-white/5">
                <Info className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {announcements.length > 1 && (
        <div className="absolute bottom-10 right-12 flex items-center space-x-3">
          {announcements.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${activeIndex === i ? 'w-8 bg-primary shadow-[0_0_10px_#F3BA2F]' : 'w-2 bg-white/20'}`}
            />
          ))}
        </div>
      )}

      {/* Nav Controls */}
      <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setActiveIndex(prev => (prev - 1 + announcements.length) % announcements.length)}
          className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-primary hover:text-black transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <button 
          onClick={() => setActiveIndex(prev => (prev + 1) % announcements.length)}
          className="p-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full text-white hover:bg-primary hover:text-black transition-all"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementCarousel;
