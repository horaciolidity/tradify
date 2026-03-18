import { create } from 'zustand';
import { supabase } from '../services/supabase';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'transaction' | 'referral';
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  addNotification: (userId: string, title: string, message: string, type: Notification['type']) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      const unread = data.filter(n => !n.is_read).length;
      set({ notifications: data, unreadCount: unread, loading: false });
    } else {
      set({ loading: false });
    }
  },

  markAsRead: async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      const updated = get().notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      );
      set({ 
        notifications: updated, 
        unreadCount: Math.max(0, get().unreadCount - 1) 
      });
    }
  },

  markAllAsRead: async (userId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (!error) {
      const updated = get().notifications.map(n => ({ ...n, is_read: true }));
      set({ notifications: updated, unreadCount: 0 });
    }
  },

  addNotification: async (userId, title, message, type) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, title, message, type })
      .select()
      .single();

    if (!error && data) {
      set({ 
        notifications: [data, ...get().notifications],
        unreadCount: get().unreadCount + 1
      });
    }
  }
}));
