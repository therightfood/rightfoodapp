/**
 * OneSignal Push Notification Context (native)
 *
 * Provides push notification management for iOS/Android via OneSignal SDK.
 * Reads OneSignal App ID from app.json (expo.extra) automatically.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { OneSignal, NotificationWillDisplayEvent } from 'react-native-onesignal';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { authClient } from '@/lib/auth';

const extra = Constants.expoConfig?.extra || {};
const ONESIGNAL_APP_ID = extra.oneSignalAppId || '';

const isWeb = Platform.OS === 'web';

interface NotificationContextType {
  hasPermission: boolean;
  permissionDenied: boolean;
  loading: boolean;
  isWeb: boolean;
  requestPermission: () => Promise<boolean>;
  sendTag: (key: string, value: string) => void;
  deleteTag: (key: string) => void;
  lastNotification: Record<string, unknown> | null;
  showPrimingModal: boolean;
  setShowPrimingModal: (show: boolean) => void;
  saveTimezone: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

async function saveOneSignalId(onesignalId: string) {
  try {
    console.log('[Notifications] Saving OneSignal ID to backend');
    const session = await authClient.getSession();
    const token = (session?.data?.session as any)?.token;
    if (!token) return;
    const res = await fetch(
      'https://kpfycbf2n3wy2nx3my6e5m8dypgb5z5y.app.specular.dev/api/profile/onesignal-id',
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ onesignal_id: onesignalId }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error('[Notifications] saveOneSignalId failed:', res.status, text);
    } else {
      console.log('[Notifications] OneSignal ID saved successfully');
    }
  } catch (err) {
    console.error('[Notifications] saveOneSignalId error:', err);
  }
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const auth = useAuth() as unknown as Record<string, unknown> | null;
  const session = auth?.session as Record<string, unknown> | undefined;
  const user = (auth?.user ?? session?.user ?? null) as { id?: string } | null;

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);
  const [showPrimingModal, setShowPrimingModal] = useState(false);

  useEffect(() => {
    if (isWeb) {
      setLoading(false);
      return;
    }

    if (!ONESIGNAL_APP_ID) {
      console.warn('[OneSignal] App ID not provided. Please add oneSignalAppId to app.json extra.');
      setLoading(false);
      return;
    }

    let cleanup: (() => void) | undefined;
    try {
      OneSignal.initialize(ONESIGNAL_APP_ID);

      if (__DEV__) {
        console.log('[OneSignal] Initialized with App ID:', ONESIGNAL_APP_ID.substring(0, 8) + '...');
      }

      const permissionStatus = OneSignal.Notifications.hasPermission();
      setHasPermission(permissionStatus);

      const foregroundHandler = (event: NotificationWillDisplayEvent) => {
        event.getNotification().display();
        const notification = event.getNotification();
        setLastNotification({
          title: notification.title,
          body: notification.body,
          additionalData: notification.additionalData,
        });
      };
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', foregroundHandler);

      const permissionHandler = (granted: boolean) => {
        setHasPermission(granted);
        setPermissionDenied(!granted);
      };
      OneSignal.Notifications.addEventListener('permissionChange', permissionHandler);

      cleanup = () => {
        OneSignal.Notifications.removeEventListener('foregroundWillDisplay', foregroundHandler);
        OneSignal.Notifications.removeEventListener('permissionChange', permissionHandler);
      };
    } catch (error) {
      console.error('[OneSignal] Failed to initialize:', error);
    } finally {
      setLoading(false);
    }
    return cleanup;
  }, []);

  useEffect(() => {
    if (isWeb || !ONESIGNAL_APP_ID) return;
    try {
      if (user?.id) {
        OneSignal.login(user.id);
        if (__DEV__) {
          console.log('[OneSignal] Linked user ID:', user.id);
        }
      } else {
        OneSignal.logout();
      }
    } catch (error) {
      console.error('[OneSignal] Failed to update user:', error);
    }
  }, [user?.id]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (isWeb) return false;
    console.log('[Notifications] Requesting push notification permission');
    try {
      const granted = await OneSignal.Notifications.requestPermission(true);
      console.log('[Notifications] Permission result:', granted);
      setHasPermission(granted);
      setPermissionDenied(!granted);
      if (granted) {
        const subId = (OneSignal.User.pushSubscription as any).id as string | undefined;
        if (subId) await saveOneSignalId(subId);
      }
      return granted;
    } catch (error) {
      console.error('[OneSignal] Permission request failed:', error);
      return false;
    }
  }, []);

  const saveTimezone = useCallback(async () => {
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      console.log('[Notifications] Saving timezone:', timezone);
      const session = await authClient.getSession();
      const token = (session?.data?.session as any)?.token;
      if (!token) return;
      const res = await fetch(
        'https://kpfycbf2n3wy2nx3my6e5m8dypgb5z5y.app.specular.dev/api/profile/reminders',
        {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error('[Notifications] saveTimezone failed:', res.status, text);
      } else {
        console.log('[Notifications] Timezone saved successfully');
      }
    } catch (err) {
      console.error('[Notifications] saveTimezone error:', err);
    }
  }, []);

  const sendTag = useCallback((key: string, value: string) => {
    if (isWeb) return;
    try {
      OneSignal.User.addTag(key, value);
    } catch (error) {
      console.error('[OneSignal] Failed to send tag:', error);
    }
  }, []);

  const deleteTag = useCallback((key: string) => {
    if (isWeb) return;
    try {
      OneSignal.User.removeTag(key);
    } catch (error) {
      console.error('[OneSignal] Failed to delete tag:', error);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        hasPermission,
        permissionDenied,
        loading,
        isWeb,
        requestPermission,
        sendTag,
        deleteTag,
        lastNotification,
        showPrimingModal,
        setShowPrimingModal,
        saveTimezone,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
