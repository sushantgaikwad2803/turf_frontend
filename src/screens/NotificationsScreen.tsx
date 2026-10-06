import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type NotificationType =
  | 'confirmed'
  | 'cancelled'
  | 'reminder'
  | 'promotional';

export type NotificationFilter = 'all' | NotificationType;

export interface NotificationItem {
  id: string;
  _id?: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const COLORS = {
  primary: '#C7F36B',
  primaryDark: '#A8D94F',
  primaryDeep: '#87B936',
  primaryDarker: '#6F9D28',
  primaryLight: '#E8F9B8',
  primarySoft: '#F4FBE6',
  primaryFaint: '#FAFDF4',
  primaryMuted: '#D9EDA4',

  accent: '#8B5CF6',
  accentLight: '#EDE9FE',
  accentSoft: '#F5F3FF',

  white: '#FFFFFF',
  bg: '#F7F8FC',
  bgSoft: '#FBFBFD',
  bgMuted: '#F1F3F8',
  card: '#FFFFFF',
  cardSoft: '#FCFCFE',

  textPrimary: '#0B1220',
  textSecondary: '#5E6677',
  textMuted: '#8A92A3',
  textLight: '#B7BDCA',

  border: '#E6E8EF',
  borderLight: '#ECEEF4',
  borderSoft: '#D9DCE7',
  borderDark: '#C9CDD9',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  offer: '#8B5CF6',
  offerSoft: '#F5F3FF',
  offerBorder: '#DDD6FE',

  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  infoBorder: '#BFDBFE',
};

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const USER_STORAGE_KEY = '@user_data';

const buildApiUrl = (path: string): string => {
  if (!API_BASE_URL) {
    throw new Error(
      'API URL is not configured. Add EXPO_PUBLIC_API_URL to your .env file.',
    );
  }

  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`;

  // The TurfBooking app normally stores EXPO_PUBLIC_API_URL
  // with /api already included, for example:
  // http://192.168.x.x:5000/api
  // Avoid producing /api/api/... when a caller passes /api/... .
  if (
    API_BASE_URL.toLowerCase().endsWith('/api') &&
    cleanPath.toLowerCase().startsWith('/api/')
  ) {
    return `${API_BASE_URL}${cleanPath.slice(4)}`;
  }

  // Also support an API base URL without /api.
  if (
    !API_BASE_URL.toLowerCase().endsWith('/api') &&
    cleanPath.toLowerCase().startsWith('/notifications')
  ) {
    return `${API_BASE_URL}/api${cleanPath}`;
  }

  return `${API_BASE_URL}${cleanPath}`;
};

const getNotificationTimestamp = (createdAt?: string): string => {
  if (!createdAt) return 'Just now';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'promotional', label: 'Offers' },
  { key: 'cancelled', label: 'Cancelled' },
];

export interface NotificationsScreenProps {
  userId?: string;
}

const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ userId: propUserId }) => {
  const [resolvedUserId, setResolvedUserId] = useState<string>(String(propUserId ?? '').trim());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [loading, setLoading] = useState(true);

  const resolveUserId = useCallback(async () => {
    const directId = String(propUserId ?? '').trim();
    if (directId) {
      setResolvedUserId(directId);
      return directId;
    }

    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!stored) {
        setResolvedUserId('');
        return '';
      }

      const parsed = JSON.parse(stored);
      const id = String(
        parsed?._id ??
        parsed?.id ??
        parsed?.user?._id ??
        parsed?.user?.id ??
        '',
      ).trim();

      setResolvedUserId(id);
      return id;
    } catch (error) {
      console.error('Resolve notification user error:', error);
      setResolvedUserId('');
      return '';
    }
  }, [propUserId]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      if (!API_BASE_URL) {
        throw new Error('API URL is not configured. Add EXPO_PUBLIC_API_URL to your .env file.');
      }

      const currentUserId = await resolveUserId();

      if (!currentUserId) {
        throw new Error('Logged-in user ID was not found. Please log in again.');
      }

      const endpoint = `/api/notifications/${currentUserId}`;
      const requestUrl = buildApiUrl(endpoint);

      console.log('[Notifications] GET:', requestUrl);

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const rawText = await response.text();
      let data: any = {};

      if (rawText.trim()) {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = { message: rawText };
        }
      }

      console.log('[Notifications] status:', response.status);

      if (!response.ok || !data?.success) {
        const serverMessage =
          data?.message ||
          data?.error ||
          data?.details ||
          `Failed to load notifications (HTTP ${response.status}).`;

        console.error(
          '[Notifications] API error:',
          serverMessage,
          data,
        );

        throw new Error(serverMessage);
      }

      setNotifications(
        Array.isArray(data.notifications)
          ? data.notifications.map((item: any) => ({
              id: String(item._id ?? item.id),
              _id: String(item._id ?? item.id),
              type: item.type as NotificationType,
              title: String(item.title ?? 'Notification'),
              message: String(item.message ?? ''),
              timestamp: getNotificationTimestamp(item.timestamp ?? item.createdAt),
              read: Boolean(item.read),
            }))
          : [],
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to load notifications right now.';

      console.error(
        'Fetch notifications error:',
        message,
        error,
      );

      Alert.alert(
        'Notifications',
        message,
      );
    } finally {
      setLoading(false);
    }
  }, [resolveUserId]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
    }, [fetchNotifications]),
  );

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const filteredNotifications = useMemo(
    () => activeFilter === 'all' ? notifications : notifications.filter(n => n.type === activeFilter),
    [notifications, activeFilter],
  );

  const getIcon = (type: NotificationType): string => {
    switch (type) {
      case 'confirmed': return '✓';
      case 'cancelled': return '✕';
      case 'reminder': return '⏰';
      case 'promotional': return '🎁';
      default: return '🔔';
    }
  };

  const getIconColor = (type: NotificationType): string => {
    switch (type) {
      case 'confirmed': return COLORS.primaryDarker;
      case 'cancelled': return COLORS.dangerText;
      case 'reminder': return COLORS.warningText;
      case 'promotional': return COLORS.offer;
      default: return COLORS.textSecondary;
    }
  };

  const getIconBackground = (type: NotificationType) => {
    switch (type) {
      case 'confirmed': return { backgroundColor: COLORS.primarySoft, borderColor: COLORS.borderSoft };
      case 'cancelled': return { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerBorder };
      case 'reminder': return { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warningBorder };
      case 'promotional': return { backgroundColor: COLORS.offerSoft, borderColor: COLORS.offerBorder };
      default: return { backgroundColor: COLORS.card, borderColor: COLORS.border };
    }
  };

  // Notifications are derived from bookings, so read/delete state is
  // intentionally kept in this screen instead of a separate collection.
  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n),
    );
  };

  const markAllAsRead = () => {
    if (unreadCount === 0) return;
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true })),
    );
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev =>
      prev.filter(n => n.id !== id),
    );
  };

  const clearAllNotifications = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear Notifications', 'Are you sure you want to remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => setNotifications([]),
      },
    ]);
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    markAsRead(notification.id);
    switch (notification.type) {
      case 'confirmed': Alert.alert('Booking Confirmed', notification.message); break;
      case 'reminder': Alert.alert('Booking Reminder', notification.message); break;
      case 'cancelled': Alert.alert('Booking Cancelled', notification.message); break;
      case 'promotional': Alert.alert('Special Offer', notification.message); break;
    }
  };

  const handleLongPress = (notification: NotificationItem) => {
    Alert.alert('Notification Options', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: notification.read ? 'Mark as Unread' : 'Mark as Read',
        onPress: () => {
          const nextRead = !notification.read;
          setNotifications(prev =>
            prev.map(item =>
              item.id === notification.id
                ? { ...item, read: nextRead }
                : item,
            ),
          );
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNotification(notification.id),
      },
    ]);
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}><Text style={styles.emptyIcon}>🔔</Text></View>
      <Text style={styles.emptyTitle}>No notifications</Text>
      <Text style={styles.emptySubtitle}>You have no notifications in this category right now.</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerBadge}>🔔 ALERTS</Text>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && <View style={styles.unreadCountBadge}><Text style={styles.unreadCountText}>{unreadCount}</Text></View>}
            </View>
            <Text style={styles.headerSubtitle}>Booking updates and offers</Text>
          </View>
          <TouchableOpacity onPress={() => void markAllAsRead()} disabled={unreadCount === 0} activeOpacity={0.7} style={[styles.markReadButton, unreadCount === 0 && styles.markReadButtonDisabled]}>
            <Text style={[styles.markReadText, unreadCount === 0 && styles.disabledText]}>MARK ALL READ</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {FILTERS.map(filter => {
            const isActive = activeFilter === filter.key;
            const filterCount = filter.key === 'all' ? notifications.length : notifications.filter(n => n.type === filter.key).length;
            return (
              <TouchableOpacity key={filter.key} activeOpacity={0.8} onPress={() => setActiveFilter(filter.key)} style={[styles.filterChip, isActive && styles.activeFilterChip]}>
                <Text style={[styles.filterText, isActive && styles.activeFilterText]}>{filter.label}</Text>
                {filterCount > 0 && <View style={[styles.filterCount, isActive && styles.activeFilterCount]}><Text style={[styles.filterCountText, isActive && styles.activeFilterCountText]}>{filterCount}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredNotifications.length > 0 && !loading && (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>{activeFilter === 'all' ? 'Recent notifications' : 'Notifications'}</Text><View style={styles.sectionTitleAccent} /></View>
            <TouchableOpacity onPress={clearAllNotifications} activeOpacity={0.7}><Text style={styles.clearText}>CLEAR ALL</Text></TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}><Text style={styles.emptyIcon}>🔔</Text></View>
            <Text style={styles.emptyTitle}>Loading notifications...</Text>
            <Text style={styles.emptySubtitle}>Checking your latest booking updates.</Text>
          </View>
        ) : filteredNotifications.length === 0 ? renderEmptyState() : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
            {filteredNotifications.map(notification => {
              const iconBackground = getIconBackground(notification.type);
              const iconColor = getIconColor(notification.type);
              return (
                <TouchableOpacity key={notification.id} activeOpacity={0.85} onPress={() => handleNotificationPress(notification)} onLongPress={() => handleLongPress(notification)} style={[styles.notificationCard, !notification.read && styles.unreadCard]}>
                  {!notification.read && <View style={styles.unreadDot} />}
                  <View style={[styles.iconContainer, iconBackground]}><Text style={[styles.iconText, { color: iconColor }]}>{getIcon(notification.type)}</Text></View>
                  <View style={styles.contentContainer}>
                    <View style={styles.titleRow}><Text numberOfLines={2} style={[styles.notificationTitle, !notification.read && styles.notificationTitleUnread]}>{notification.title}</Text><Text numberOfLines={1} style={styles.timestamp}>{notification.timestamp}</Text></View>
                    <Text style={styles.notificationMessage}>{notification.message}</Text>
                    {!notification.read && <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

export { NotificationsScreen };

const styles = StyleSheet.create({

  safeArea: {

    flex: 1,

    backgroundColor: COLORS.bg,

  },



  container: {

    flex: 1,

    paddingHorizontal: 18,

    backgroundColor: COLORS.bg,

  },



  /* HEADER */

  headerRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'flex-start',

    paddingTop: 12,

    marginBottom: 18,

  },



  headerLeft: {

    flex: 1,

    marginRight: 12,

  },



  headerBadge: {

    alignSelf: 'flex-start',

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    color: COLORS.primaryDarker,

    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 10,

    letterSpacing: 1.4,

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: 20,

    marginBottom: 10,

    overflow: 'hidden',

  },



  headerTitleRow: {

    flexDirection: 'row',

    alignItems: 'center',

  },



  headerTitle: {

    fontSize: 26,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textPrimary,

    letterSpacing: -0.4,

  },



  headerSubtitle: {

    fontSize: 12,

    fontFamily: 'Poppins_500Medium',

    color: COLORS.textMuted,

    marginTop: 5,

  },



  unreadCountBadge: {

    minWidth: 26,

    height: 26,

    borderRadius: 13,

    paddingHorizontal: 8,

    backgroundColor: COLORS.primary,

    justifyContent: 'center',

    alignItems: 'center',

    marginLeft: 10,

    shadowColor: COLORS.primaryDeep,

    shadowOffset: { width: 0, height: 3 },

    shadowOpacity: 0.22,

    shadowRadius: 7,

    elevation: 3,

  },



  unreadCountText: {

    color: COLORS.textPrimary,

    fontSize: 11,

    fontFamily: 'Poppins_900Black',

  },



  markReadButton: {

    backgroundColor: COLORS.primarySoft,

    borderRadius: 20,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    paddingHorizontal: 14,

    paddingVertical: 10,

    marginTop: 4,

  },



  markReadButtonDisabled: {

    backgroundColor: COLORS.bgMuted,

    borderColor: COLORS.border,

  },



  markReadText: {

    color: COLORS.primaryDarker,

    fontSize: 10,

    fontFamily: 'Poppins_800ExtraBold',

    letterSpacing: 1,

  },



  disabledText: {

    color: COLORS.textMuted,

  },



  /* FILTER */

  filterScroll: {

    maxHeight: 48,

    marginBottom: 14,

  },



  filterContent: {

    paddingRight: 8,

  },



  filterChip: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 16,

    paddingVertical: 10,

    borderRadius: 24,

    backgroundColor: COLORS.card,

    borderWidth: 1,

    borderColor: COLORS.border,

    marginRight: 8,

  },



  activeFilterChip: {

    backgroundColor: COLORS.primary,

    borderColor: COLORS.primary,

    shadowColor: COLORS.primaryDeep,

    shadowOffset: { width: 0, height: 5 },

    shadowOpacity: 0.20,

    shadowRadius: 9,

    elevation: 4,

  },



  filterText: {

    fontSize: 12,

    fontFamily: 'Poppins_600SemiBold',

    color: COLORS.textSecondary,

    letterSpacing: 0.1,

  },



  activeFilterText: {

    color: COLORS.textPrimary,

    fontFamily: 'Poppins_800ExtraBold',

  },



  filterCount: {

    minWidth: 20,

    height: 20,

    borderRadius: 10,

    paddingHorizontal: 5,

    marginLeft: 7,

    alignItems: 'center',

    justifyContent: 'center',

    backgroundColor: COLORS.bgMuted,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

  },



  activeFilterCount: {

    backgroundColor: 'rgba(11,18,32,0.12)',

    borderColor: 'rgba(11,18,32,0.16)',

  },



  filterCountText: {

    fontSize: 10,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textSecondary,

  },



  activeFilterCountText: {

    color: COLORS.textPrimary,

  },



  /* SECTION HEADER */

  sectionHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginTop: 6,

    marginBottom: 14,

  },



  sectionTitleRow: {

    flexDirection: 'row',

    alignItems: 'center',

  },



  sectionTitle: {

    fontSize: 15,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textPrimary,

    letterSpacing: 0.2,

  },



  sectionTitleAccent: {

    width: 6,

    height: 6,

    borderRadius: 3,

    backgroundColor: COLORS.primary,

    marginLeft: 8,

    marginTop: 2,

  },



  clearText: {

    fontSize: 10,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.dangerText,

    letterSpacing: 1,

  },



  /* LIST */

  listContainer: {

    paddingTop: 2,

    paddingBottom: 100,

  },



  /* CARD */

  notificationCard: {

    position: 'relative',

    flexDirection: 'row',

    alignItems: 'flex-start',

    backgroundColor: COLORS.card,

    padding: 15,

    marginBottom: 11,

    borderRadius: 22,

    borderWidth: 1,

    borderColor: COLORS.border,

    shadowColor: COLORS.textPrimary,

    shadowOffset: { width: 0, height: 5 },

    shadowOpacity: 0.055,

    shadowRadius: 13,

    elevation: 2,

  },



  unreadCard: {

    backgroundColor: COLORS.primaryFaint,

    borderColor: COLORS.primaryMuted,

    shadowColor: COLORS.primaryDeep,

    shadowOpacity: 0.075,

  },



  unreadDot: {

    position: 'absolute',

    top: 14,

    right: 14,

    width: 8,

    height: 8,

    borderRadius: 4,

    backgroundColor: COLORS.primaryDeep,

    shadowColor: COLORS.primaryDeep,

    shadowOffset: { width: 0, height: 0 },

    shadowOpacity: 0.45,

    shadowRadius: 4,

    elevation: 3,

  },



  /* ICON */

  iconContainer: {

    width: 48,

    height: 48,

    borderRadius: 17,

    borderWidth: 1,

    justifyContent: 'center',

    alignItems: 'center',

    marginRight: 13,

    shadowColor: COLORS.textPrimary,

    shadowOffset: { width: 0, height: 3 },

    shadowOpacity: 0.08,

    shadowRadius: 5,

    elevation: 2,

  },



  iconText: {

    fontSize: 20,

    fontFamily: 'Poppins_800ExtraBold',

  },



  /* CONTENT */

  contentContainer: {

    flex: 1,

    paddingRight: 14,

    minWidth: 0,

  },



  titleRow: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    marginBottom: 6,

  },



  notificationTitle: {

    flex: 1,

    flexShrink: 1,

    fontSize: 13,

    lineHeight: 19,

    fontFamily: 'Poppins_600SemiBold',

    color: COLORS.textSecondary,

    marginRight: 8,

    letterSpacing: 0,

  },



  notificationTitleUnread: {

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textPrimary,

  },



  timestamp: {

    fontSize: 10,

    fontFamily: 'Poppins_500Medium',

    color: COLORS.textMuted,

    paddingTop: 3,

    flexShrink: 0,

  },



  notificationMessage: {

    fontSize: 11,

    lineHeight: 18,

    fontFamily: 'Poppins_400Regular',

    color: COLORS.textSecondary,

  },



  newBadge: {

    alignSelf: 'flex-start',

    marginTop: 9,

    paddingHorizontal: 10,

    paddingVertical: 4,

    borderRadius: 12,

    backgroundColor: COLORS.primary,

    shadowColor: COLORS.primaryDeep,

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.22,

    shadowRadius: 4,

    elevation: 2,

  },



  newBadgeText: {

    fontSize: 9,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textPrimary,

    letterSpacing: 1,

  },



  /* EMPTY */

  emptyContainer: {

    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    paddingHorizontal: 30,

    paddingBottom: 80,

  },



  emptyIconContainer: {

    width: 96,

    height: 96,

    borderRadius: 30,

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    marginBottom: 20,

    shadowColor: COLORS.primaryDeep,

    shadowOffset: { width: 0, height: 5 },

    shadowOpacity: 0.08,

    shadowRadius: 12,

    elevation: 3,

  },



  emptyIcon: {

    fontSize: 42,

  },



  emptyTitle: {

    fontSize: 20,

    fontFamily: 'Poppins_800ExtraBold',

    color: COLORS.textPrimary,

    marginBottom: 10,

    letterSpacing: -0.1,

  },



  emptySubtitle: {

    fontSize: 13,

    lineHeight: 20,

    fontFamily: 'Poppins_400Regular',

    color: COLORS.textMuted,

    textAlign: 'center',

  },

});



export default NotificationsScreen;