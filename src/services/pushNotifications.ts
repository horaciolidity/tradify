import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * Service to handle Firebase Push Notifications using Capacitor
 */
export const initializePushNotifications = async () => {
  // Push Notifications only work on native platforms (iOS/Android)
  if (Capacitor.getPlatform() === 'web') {
    console.log('Push Notifications not supported on web platform.');
    return;
  }

  console.log('Initializing Push Notifications...');

  try {
    // 1. Request permissions if not already granted
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission NOT granted');
      return;
    }

    // 2. Register device for push notifications
    await PushNotifications.register();

    // 3. Listeners for registration and notification events
    
    // Captured when the device successfully registers for FCM
    await PushNotifications.addListener('registration', (token) => {
      console.log('🚀 FCM Token:', token.value);
      // Logic to send token to backend (Supabase/Custom API) would go here
    });

    // Handle registration errors
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Registration Error:', JSON.stringify(error));
    });

    // Handle incoming notifications while the app is in foreground
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 Push Notification Received:', notification);
      // You can trigger local UI updates here if needed
    });

    // Handle notification click events (when app is in background or foreground)
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('👆 Push Notification Action:', notification.actionId, notification.notification);
      
      // Handle navigation or deep linking here
      if (notification.actionId === 'tap') {
        console.log('User tapped on notification');
      }
    });

    console.log('Push Notifications service initialized successfully.');
  } catch (error) {
    console.error('❌ Push Notifications Initialization Failed:', error);
  }
};
