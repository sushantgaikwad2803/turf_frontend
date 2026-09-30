import React, { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================================================
   TYPES
========================================================= */

export type NotificationType =
  | 'confirmed'
  | 'cancelled'
  | 'reminder'
  | 'promotional';

export type NotificationFilter = 'all' | NotificationType;

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

/* =========================================================
   THEME COLORS - WHITE & LIGHT GREEN
========================================================= */

const COLORS = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',
  primaryDarker: '#166534',
  primaryLight: '#DCFCE7',
  primarySoft: '#F0FDF4',
  primaryFaint: '#F7FEF9',

  accent: '#F97316',
  accentLight: '#FFEDD5',
  accentSoft: '#FEF3C7',

  white: '#FFFFFF',
  bg: '#FFFFFF',
  bgSoft: '#FAFEFB',
  bgMuted: '#F4FBF6',
  card: '#FFFFFF',
  cardSoft: '#F9FDFA',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  border: '#E8F5EC',
  borderLight: '#D1FAE5',
  borderSoft: '#BBF7D0',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  offer: '#7C3AED',
  offerSoft: '#F5F3FF',
  offerBorder: '#DDD6FE',

  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  infoBorder: '#BFDBFE',
};

/* =========================================================
   MOCK DATA
========================================================= */

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: '1',
    type: 'confirmed',
    title: 'Booking Confirmed! 🎉',
    message:
      'Your slot at Green Field Arena is confirmed for tomorrow at 6:00 PM.',
    timestamp: '2 mins ago',
    read: false,
  },
  {
    id: '2',
    type: 'reminder',
    title: 'Upcoming Match Reminder ⏰',
    message:
      "Don't forget your booking at Apex Sports Club today in 2 hours.",
    timestamp: '1 hour ago',
    read: false,
  },
  {
    id: '3',
    type: 'promotional',
    title: 'Special Weekend Offer 🎁',
    message:
      'Get up to 40% discount on badminton court bookings this Sunday!',
    timestamp: '1 day ago',
    read: true,
  },
  {
    id: '4',
    type: 'cancelled',
    title: 'Booking Cancelled ❌',
    message:
      'Your slot at Turf Park was cancelled. Refund processed to your account.',
    timestamp: '3 days ago',
    read: true,
  },
];

/* =========================================================
   FILTER OPTIONS
========================================================= */

const FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'reminder', label: 'Reminders' },
  { key: 'promotional', label: 'Offers' },
  { key: 'cancelled', label: 'Cancelled' },
];

/* =========================================================
   COMPONENT
========================================================= */

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === activeFilter);
  }, [notifications, activeFilter]);

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
      case 'confirmed': return COLORS.primaryDark;
      case 'cancelled': return COLORS.dangerText;
      case 'reminder': return COLORS.warningText;
      case 'promotional': return COLORS.offer;
      default: return COLORS.textSecondary;
    }
  };

  const getIconBackground = (type: NotificationType) => {
    switch (type) {
      case 'confirmed':
        return { backgroundColor: COLORS.primarySoft, borderColor: COLORS.borderSoft };
      case 'cancelled':
        return { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerBorder };
      case 'reminder':
        return { backgroundColor: COLORS.warningSoft, borderColor: COLORS.warningBorder };
      case 'promotional':
        return { backgroundColor: COLORS.offerSoft, borderColor: COLORS.offerBorder };
      default:
        return { backgroundColor: COLORS.card, borderColor: COLORS.border };
    }
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear Notifications', 'Are you sure you want to remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: () => setNotifications([]) },
    ]);
  };

  const handleNotificationPress = (notification: NotificationItem) => {
    markAsRead(notification.id);
    switch (notification.type) {
      case 'confirmed':
        Alert.alert('Booking Confirmed', 'Your booking is confirmed.');
        break;
      case 'reminder':
        Alert.alert('Booking Reminder', 'Your booking is coming up soon.');
        break;
      case 'cancelled':
        Alert.alert('Booking Cancelled', 'Your booking was cancelled.');
        break;
      case 'promotional':
        Alert.alert('Special Offer', 'This offer can open the promotional details.');
        break;
    }
  };

  const handleLongPress = (notification: NotificationItem) => {
    Alert.alert('Notification Options', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: notification.read ? 'Mark as Unread' : 'Mark as Read',
        onPress: () => {
          setNotifications((prev) =>
            prev.map((item) =>
              item.id === notification.id ? { ...item, read: !item.read } : item,
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
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>🔔</Text>
      </View>
      <Text style={styles.emptyTitle}>No notifications</Text>
      <Text style={styles.emptySubtitle}>
        You have no notifications in this category right now.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerBadge}>🔔 ALERTS</Text>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>Booking updates and offers</Text>
          </View>

          <TouchableOpacity
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
            activeOpacity={0.7}
            style={[styles.markReadButton, unreadCount === 0 && styles.markReadButtonDisabled]}
          >
            <Text style={[styles.markReadText, unreadCount === 0 && styles.disabledText]}>
              MARK ALL READ
            </Text>
          </TouchableOpacity>
        </View>

        {/* FILTERS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            const filterCount =
              filter.key === 'all'
                ? notifications.length
                : notifications.filter((n) => n.type === filter.key).length;

            return (
              <TouchableOpacity
                key={filter.key}
                activeOpacity={0.8}
                onPress={() => setActiveFilter(filter.key)}
                style={[styles.filterChip, isActive && styles.activeFilterChip]}
              >
                <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                  {filter.label}
                </Text>
                {filterCount > 0 && (
                  <View style={[styles.filterCount, isActive && styles.activeFilterCount]}>
                    <Text style={[styles.filterCountText, isActive && styles.activeFilterCountText]}>
                      {filterCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SECTION HEADER */}
        {filteredNotifications.length > 0 && (
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>
                {activeFilter === 'all' ? 'Recent notifications' : 'Notifications'}
              </Text>
              <View style={styles.sectionTitleAccent} />
            </View>
            <TouchableOpacity onPress={clearAllNotifications} activeOpacity={0.7}>
              <Text style={styles.clearText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LIST */}
        {filteredNotifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          >
            {filteredNotifications.map((notification) => {
              const iconBackground = getIconBackground(notification.type);
              const iconColor = getIconColor(notification.type);

              return (
                <TouchableOpacity
                  key={notification.id}
                  activeOpacity={0.85}
                  onPress={() => handleNotificationPress(notification)}
                  onLongPress={() => handleLongPress(notification)}
                  style={[styles.notificationCard, !notification.read && styles.unreadCard]}
                >
                  {!notification.read && <View style={styles.unreadDot} />}

                  <View style={[styles.iconContainer, iconBackground]}>
                    <Text style={[styles.iconText, { color: iconColor }]}>
                      {getIcon(notification.type)}
                    </Text>
                  </View>

                  <View style={styles.contentContainer}>
                    <View style={styles.titleRow}>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.notificationTitle,
                          !notification.read && styles.notificationTitleUnread,
                        ]}
                      >
                        {notification.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.timestamp}>
                        {notification.timestamp}
                      </Text>
                    </View>

                    <Text style={styles.notificationMessage}>{notification.message}</Text>

                    {!notification.read && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
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

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
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
    marginRight: 10,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 5,
    fontWeight: '500',
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
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  unreadCountText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
  },

  markReadButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },

  markReadButtonDisabled: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
  },

  markReadText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
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
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginRight: 8,
  },

  activeFilterChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },

  filterText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },

  activeFilterText: {
    color: COLORS.white,
  },

  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    marginLeft: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  activeFilterCount: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },

  filterCountText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },

  activeFilterCountText: {
    color: COLORS.white,
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
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  sectionTitleAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginLeft: 8,
    marginTop: 2,
  },

  clearText: {
    fontSize: 10,
    fontWeight: '900',
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
    padding: 16,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  unreadCard: {
    backgroundColor: COLORS.primaryFaint,
    borderColor: COLORS.borderSoft,
    shadowOpacity: 0.08,
  },

  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },

  /* ICON */
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    // Circular background shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },

  iconText: {
    fontSize: 20,
    fontWeight: '900',
  },

  /* CONTENT */
  contentContainer: {
    flex: 1,
    paddingRight: 4,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginRight: 8,
    letterSpacing: 0.1,
  },

  notificationTitleUnread: {
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  timestamp: {
    fontSize: 10,
    color: COLORS.textMuted,
    paddingTop: 3,
    fontWeight: '600',
  },

  notificationMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  newBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  newBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.white,
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
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    marginBottom: 20,
    // Circular background shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  emptyIcon: {
    fontSize: 42,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.2,
  },

  emptySubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default NotificationsScreen;