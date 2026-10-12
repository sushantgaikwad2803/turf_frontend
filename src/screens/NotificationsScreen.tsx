import React, { useCallback, useEffect, useMemo, useState } from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from '@react-navigation/native';

import {

  ActivityIndicator,

  Alert,

  RefreshControl,

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

  createdAt?: string;

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



const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '')

  .trim()

const USER_STORAGE_KEY = '@user_data';

const NOTIFICATION_STATE_PREFIX = '@turfbook_notification_state_';



type NotificationLocalState = {

  readIds: string[];

  deletedIds: string[];

};



const buildApiUrl = (path: string): string => {

  if (!API_BASE_URL) {

    throw new Error(

      'API URL is not configured. Add EXPO_PUBLIC_API_URL to your .env file.',

    );

  }



  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const baseLower = API_BASE_URL.toLowerCase();

  const pathLower = cleanPath.toLowerCase();



  // Supports:

  // EXPO_PUBLIC_API_URL=http\://server.com/api

  // and

  // EXPO_PUBLIC_API_URL=http\://server.com

  //

  // Also prevents /api/api/... when the caller already includes /api.

  if (baseLower.endsWith('/api') && pathLower.startsWith('/api/')) {

    return `${API_BASE_URL}${cleanPath.slice(4)}`;

  }



  if (!baseLower.endsWith('/api') && pathLower.startsWith('/notifications')) {

    return `${API_BASE_URL}/api${cleanPath}`;

  }



  return `${API_BASE_URL}${cleanPath}`;

};



const getNotificationTimestamp = (createdAt?: string): string => {

  if (!createdAt) return 'Just now';



  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) return 'Just now';



  const diffMinutes = Math.max(

    0,

    Math.floor((Date.now() - date.getTime()) / 60000),

  );

  const diffHours = Math.floor(diffMinutes / 60);

  const diffDays = Math.floor(diffHours / 24);



  if (diffMinutes < 1) return 'Just now';

  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  if (diffHours < 24) {

    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  }

  if (diffDays < 7) {

    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  }



  return date.toLocaleDateString('en-IN', {

    day: '2-digit',

    month: 'short',

    year: 'numeric',

  });

};



const normalizeNotificationType = (value: unknown): NotificationType => {

  switch (String(value ?? '').toLowerCase()) {

    case 'confirmed':

      return 'confirmed';

    case 'cancelled':

    case 'canceled':

      return 'cancelled';

    case 'reminder':

      return 'reminder';

    case 'promotional':

    case 'promotion':

    case 'offer':

      return 'promotional';

    default:

      return 'reminder';

  }

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



const NotificationsScreen: React.FC<NotificationsScreenProps> = ({

  userId: propUserId,

}) => {

  const [resolvedUserId, setResolvedUserId] = useState(

    String(propUserId ?? '').trim(),

  );

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [activeFilter, setActiveFilter] =

    useState<NotificationFilter>('all');

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');



  const resolveUserId = useCallback(async (): Promise<string> => {

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

      console.error('[Notifications] Resolve user error:', error);

      setResolvedUserId('');

      return '';

    }

  }, [propUserId]);



  const getLocalStateKey = useCallback(

    (userId: string) => `${NOTIFICATION_STATE_PREFIX}${userId}`,

    [],

  );



  const loadLocalState = useCallback(

    async (userId: string): Promise<NotificationLocalState> => {

      try {

        const raw = await AsyncStorage.getItem(getLocalStateKey(userId));



        if (!raw) {

          return { readIds: [], deletedIds: [] };

        }



        const parsed = JSON.parse(raw);



        return {

          readIds: Array.isArray(parsed?.readIds)

            ? parsed.readIds.map(String)

            : [],

          deletedIds: Array.isArray(parsed?.deletedIds)

            ? parsed.deletedIds.map(String)

            : [],

        };

      } catch (error) {

        console.error('[Notifications] Load local state error:', error);

        return { readIds: [], deletedIds: [] };

      }

    },

    [getLocalStateKey],

  );



  const saveLocalState = useCallback(

    async (userId: string, state: NotificationLocalState) => {

      try {

        await AsyncStorage.setItem(

          getLocalStateKey(userId),

          JSON.stringify({

            readIds: [...new Set(state.readIds)],

            deletedIds: [...new Set(state.deletedIds)],

          }),

        );

      } catch (error) {

        console.error('[Notifications] Save local state error:', error);

      }

    },

    [getLocalStateKey],

  );



  const fetchNotifications = useCallback(

    async (options?: { silent?: boolean }) => {

      const silent = Boolean(options?.silent);



      try {

        if (!silent) {

          setLoading(true);

        }



        setErrorMessage('');



        const currentUserId = await resolveUserId();



        if (!currentUserId) {

          throw new Error('Logged-in user ID was not found. Please log in again.');

        }



        const endpoint = `/api/notifications/${encodeURIComponent(

          currentUserId,

        )}`;

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



        if (!response.ok || data?.success === false) {

          const serverMessage =

            data?.message ||

            data?.error ||

            data?.details ||

            `Failed to load notifications (HTTP ${response.status}).`;



          throw new Error(serverMessage);

        }



        const localState = await loadLocalState(currentUserId);



        const rawNotifications = Array.isArray(data?.notifications)

          ? data.notifications

          : Array.isArray(data?.data)

            ? data.data

            : [];



        const normalized: NotificationItem[] = rawNotifications

          .map((item: any, index: number) => {

            const id = String(

              item?._id ??

                item?.id ??

                item?.notificationId ??

                `notification-${index}`,

            );



            return {

              id,

              _id: item?._id ? String(item._id) : id,

              type: normalizeNotificationType(item?.type),

              title: String(item?.title ?? 'Notification'),

              message: String(item?.message ?? ''),

              timestamp: getNotificationTimestamp(

                item?.timestamp ?? item?.createdAt,

              ),

              createdAt: item?.createdAt

                ? String(item.createdAt)

                : undefined,

              read:

                Boolean(item?.read) ||

                localState.readIds.includes(id),

            };

          })

          .filter(

            (item: NotificationItem) =>

              !localState.deletedIds.includes(item.id),

          );



        // Newest first. If the API already sorts the list, this simply

        // preserves that order for equal/invalid dates.

        normalized.sort((a, b) => {

          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;

          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;



          if (!Number.isNaN(bTime) && !Number.isNaN(aTime)) {

            return bTime - aTime;

          }



          return 0;

        });



        setNotifications(normalized);

      } catch (error) {

        const message =

          error instanceof Error && error.message

            ? error.message

            : 'Unable to load notifications right now.';



        console.error('[Notifications] Fetch error:', error);

        setErrorMessage(message);



        // Keep the existing list visible when a background refresh fails.

        // Show an alert only for an initial/manual non-silent load.

        if (!silent) {

          Alert.alert('Notifications', message);

        }

      } finally {

        if (!silent) {

          setLoading(false);

        }

      }

    },

    [loadLocalState, resolveUserId],

  );



  useEffect(() => {

    void fetchNotifications();

  }, [fetchNotifications]);



  useFocusEffect(

    useCallback(() => {

      void fetchNotifications({ silent: true });

    }, [fetchNotifications]),

  );



  const onRefresh = useCallback(async () => {

    setRefreshing(true);



    try {

      await fetchNotifications({ silent: true });

    } finally {

      setRefreshing(false);

    }

  }, [fetchNotifications]);



  const unreadCount = useMemo(

    () => notifications.filter(item => !item.read).length,

    [notifications],

  );



  const filteredNotifications = useMemo(

    () =>

      activeFilter === 'all'

        ? notifications

        : notifications.filter(item => item.type === activeFilter),

    [notifications, activeFilter],

  );



  const updateLocalReadState = useCallback(

    async (ids: string[], read: boolean) => {

      const currentUserId = resolvedUserId || (await resolveUserId());



      if (!currentUserId) return;



      const state = await loadLocalState(currentUserId);

      const nextReadIds = new Set(state.readIds);



      ids.forEach(id => {

        if (read) {

          nextReadIds.add(id);

        } else {

          nextReadIds.delete(id);

        }

      });



      await saveLocalState(currentUserId, {

        readIds: [...nextReadIds],

        deletedIds: state.deletedIds,

      });

    },

    [loadLocalState, resolveUserId, resolvedUserId, saveLocalState],

  );



  const markAsRead = useCallback(

    (id: string) => {

      const item = notifications.find(notification => notification.id === id);



      if (!item || item.read) return;



      setNotifications(previous =>

        previous.map(notification =>

          notification.id === id

            ? { ...notification, read: true }

            : notification,

        ),

      );



      void updateLocalReadState([id], true);

    },

    [notifications, updateLocalReadState],

  );



  const markAllAsRead = useCallback(() => {

    if (unreadCount === 0) return;



    const unreadIds = notifications

      .filter(notification => !notification.read)

      .map(notification => notification.id);



    setNotifications(previous =>

      previous.map(notification => ({

        ...notification,

        read: true,

      })),

    );



    void updateLocalReadState(unreadIds, true);

  }, [notifications, unreadCount, updateLocalReadState]);



  const deleteNotification = useCallback(

    (id: string) => {

      setNotifications(previous =>

        previous.filter(notification => notification.id !== id),

      );



      void (async () => {

        const currentUserId = resolvedUserId || (await resolveUserId());



        if (!currentUserId) return;



        const state = await loadLocalState(currentUserId);



        await saveLocalState(currentUserId, {

          readIds: state.readIds.filter(readId => readId !== id),

          deletedIds: [...new Set([...state.deletedIds, id])],

        });

      })();

    },

    [loadLocalState, resolveUserId, resolvedUserId, saveLocalState],

  );



  const clearAllNotifications = useCallback(() => {

    if (notifications.length === 0) return;



    Alert.alert(

      'Clear Notifications',

      'Are you sure you want to remove all notifications from this device?',

      [

        { text: 'Cancel', style: 'cancel' },

        {

          text: 'Clear All',

          style: 'destructive',

          onPress: () => {

            const ids = notifications.map(notification => notification.id);



            setNotifications([]);



            void (async () => {

              const currentUserId = resolvedUserId || (await resolveUserId());



              if (!currentUserId) return;



              const state = await loadLocalState(currentUserId);



              await saveLocalState(currentUserId, {

                readIds: state.readIds.filter(id => !ids.includes(id)),

                deletedIds: [...new Set([...state.deletedIds, ...ids])],

              });

            })();

          },

        },

      ],

    );

  }, [

    loadLocalState,

    notifications,

    resolveUserId,

    resolvedUserId,

    saveLocalState,

  ]);



  const handleNotificationPress = useCallback(

    (notification: NotificationItem) => {

      markAsRead(notification.id);



      switch (notification.type) {

        case 'confirmed':

          Alert.alert('Booking Confirmed', notification.message);

          break;

        case 'reminder':

          Alert.alert('Booking Reminder', notification.message);

          break;

        case 'cancelled':

          Alert.alert('Booking Cancelled', notification.message);

          break;

        case 'promotional':

          Alert.alert('Special Offer', notification.message);

          break;

        default:

          Alert.alert(notification.title, notification.message);

      }

    },

    [markAsRead],

  );



  const handleLongPress = useCallback(

    (notification: NotificationItem) => {

      Alert.alert('Notification Options', undefined, [

        { text: 'Cancel', style: 'cancel' },

        {

          text: notification.read ? 'Mark as Unread' : 'Mark as Read',

          onPress: () => {

            const nextRead = !notification.read;



            setNotifications(previous =>

              previous.map(item =>

                item.id === notification.id

                  ? { ...item, read: nextRead }

                  : item,

              ),

            );



            void updateLocalReadState([notification.id], nextRead);

          },

        },

        {

          text: 'Delete',

          style: 'destructive',

          onPress: () => deleteNotification(notification.id),

        },

      ]);

    },

    [deleteNotification, updateLocalReadState],

  );



  const getIcon = (type: NotificationType): string => {

    switch (type) {

      case 'confirmed':

        return '✓';

      case 'cancelled':

        return '✕';

      case 'reminder':

        return '⏰';

      case 'promotional':

        return '🎁';

      default:

        return '🔔';

    }

  };



  const getIconColor = (type: NotificationType): string => {

    switch (type) {

      case 'confirmed':

        return COLORS.primaryDarker;

      case 'cancelled':

        return COLORS.dangerText;

      case 'reminder':

        return COLORS.warningText;

      case 'promotional':

        return COLORS.offer;

      default:

        return COLORS.textSecondary;

    }

  };



  const getIconBackground = (type: NotificationType) => {

    switch (type) {

      case 'confirmed':

        return {

          backgroundColor: COLORS.primarySoft,

          borderColor: COLORS.borderSoft,

        };

      case 'cancelled':

        return {

          backgroundColor: COLORS.dangerSoft,

          borderColor: COLORS.dangerBorder,

        };

      case 'reminder':

        return {

          backgroundColor: COLORS.warningSoft,

          borderColor: COLORS.warningBorder,

        };

      case 'promotional':

        return {

          backgroundColor: COLORS.offerSoft,

          borderColor: COLORS.offerBorder,

        };

      default:

        return {

          backgroundColor: COLORS.card,

          borderColor: COLORS.border,

        };

    }

  };



  const renderEmptyState = () => (

    <View style={styles.emptyContainer}>

      <View style={styles.emptyIconContainer}>

        <Text style={styles.emptyIcon}>🔔</Text>

      </View>



      <Text style={styles.emptyTitle}>No notifications</Text>



      <Text style={styles.emptySubtitle}>

        {activeFilter === 'all'

          ? 'You have no notifications right now.'

          : 'You have no notifications in this category right now.'}

      </Text>



      {errorMessage ? (

        <TouchableOpacity

          activeOpacity={0.8}

          onPress={() => void fetchNotifications()}

          style={styles.retryButton}

        >

          <Text style={styles.retryButtonText}>TRY AGAIN</Text>

        </TouchableOpacity>

      ) : null}

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



              {unreadCount > 0 ? (

                <View style={styles.unreadCountBadge}>

                  <Text style={styles.unreadCountText}>{unreadCount}</Text>

                </View>

              ) : null}

            </View>



            <Text style={styles.headerSubtitle}>

              Booking updates and offers

            </Text>

          </View>



          <TouchableOpacity

            onPress={markAllAsRead}

            disabled={unreadCount === 0}

            activeOpacity={0.7}

            style={[

              styles.markReadButton,

              unreadCount === 0 && styles.markReadButtonDisabled,

            ]}

          >

            <Text

              style={[

                styles.markReadText,

                unreadCount === 0 && styles.disabledText,

              ]}

            >

              MARK ALL READ

            </Text>

          </TouchableOpacity>

        </View>



        <View style={styles.filterRowWrapper}>

          <ScrollView

            horizontal

            showsHorizontalScrollIndicator={false}

            bounces={false}

            alwaysBounceHorizontal={false}

            style={styles.filterScroll}

            contentContainerStyle={styles.filterContent}

          >

          {FILTERS.map(filter => {

            const isActive = activeFilter === filter.key;



            const filterCount =

              filter.key === 'all'

                ? notifications.length

                : notifications.filter(

                    notification => notification.type === filter.key,

                  ).length;



            return (

              <TouchableOpacity

                key={filter.key}

                activeOpacity={0.8}

                onPress={() => setActiveFilter(filter.key)}

                style={[

                  styles.filterChip,

                  isActive && styles.activeFilterChip,

                ]}

              >

                <Text

                  style={[

                    styles.filterText,

                    isActive && styles.activeFilterText,

                  ]}

                >

                  {filter.label}

                </Text>



                {filterCount > 0 ? (

                  <View

                    style={[

                      styles.filterCount,

                      isActive && styles.activeFilterCount,

                    ]}

                  >

                    <Text

                      style={[

                        styles.filterCountText,

                        isActive && styles.activeFilterCountText,

                      ]}

                    >

                      {filterCount}

                    </Text>

                  </View>

                ) : null}

              </TouchableOpacity>

            );

          })}

                  </ScrollView>

        </View>



        {errorMessage && notifications.length > 0 ? (

          <View style={styles.errorBanner}>

            <Text style={styles.errorBannerText} numberOfLines={2}>

              {errorMessage}

            </Text>



            <TouchableOpacity

              activeOpacity={0.8}

              onPress={() => void fetchNotifications()}

            >

              <Text style={styles.errorRetryText}>RETRY</Text>

            </TouchableOpacity>

          </View>

        ) : null}



        {filteredNotifications.length > 0 && !loading ? (

          <View style={styles.sectionHeader}>

            <View style={styles.sectionTitleRow}>

              <Text style={styles.sectionTitle}>

                {activeFilter === 'all'

                  ? 'Recent notifications'

                  : 'Notifications'}

              </Text>

              <View style={styles.sectionTitleAccent} />

            </View>



            <TouchableOpacity

              onPress={clearAllNotifications}

              activeOpacity={0.7}

            >

              <Text style={styles.clearText}>CLEAR ALL</Text>

            </TouchableOpacity>

          </View>

        ) : null}



        {loading ? (

          <View style={styles.loadingContainer}>

            <View style={styles.loadingIconContainer}>

              <ActivityIndicator size="large" color={COLORS.primaryDarker} />

            </View>



            <Text style={styles.emptyTitle}>Loading notifications...</Text>



            <Text style={styles.emptySubtitle}>

              Checking your latest booking updates.

            </Text>

          </View>

        ) : filteredNotifications.length === 0 ? (

          renderEmptyState()

        ) : (

          <ScrollView

            showsVerticalScrollIndicator={false}

            contentContainerStyle={styles.listContainer}

            refreshControl={

              <RefreshControl

                refreshing={refreshing}

                onRefresh={onRefresh}

                tintColor={COLORS.primaryDarker}

                colors={[COLORS.primaryDarker]}

              />

            }

          >

            {filteredNotifications.map(notification => {

              const iconBackground = getIconBackground(notification.type);

              const iconColor = getIconColor(notification.type);



              return (

                <TouchableOpacity

                  key={notification.id}

                  activeOpacity={0.85}

                  onPress={() => handleNotificationPress(notification)}

                  onLongPress={() => handleLongPress(notification)}

                  delayLongPress={450}

                  style={[

                    styles.notificationCard,

                    !notification.read && styles.unreadCard,

                  ]}

                >

                  {!notification.read ? <View style={styles.unreadDot} /> : null}



                  <View

                    style={[

                      styles.iconContainer,

                      iconBackground,

                    ]}

                  >

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

                          !notification.read &&

                            styles.notificationTitleUnread,

                        ]}

                      >

                        {notification.title}

                      </Text>



                      <Text

                        numberOfLines={1}

                        style={styles.timestamp}

                      >

                        {notification.timestamp}

                      </Text>

                    </View>



                    <Text style={styles.notificationMessage}>

                      {notification.message}

                    </Text>



                    {!notification.read ? (

                      <View style={styles.newBadge}>

                        <Text style={styles.newBadgeText}>NEW</Text>

                      </View>

                    ) : null}

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



  filterRowWrapper: {
    height: 58,
    marginBottom: 14,
    overflow: 'visible',
  },

  filterScroll: {
    height: 58,
  },

  filterContent: {
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 5,
  },

  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    height: 46,
    paddingHorizontal: 15,
    paddingVertical: 0,
    borderRadius: 23,
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
    lineHeight: 17,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textSecondary,
    letterSpacing: 0.1,
    includeFontPadding: true,
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
    flexShrink: 0,

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



  errorBanner: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    backgroundColor: COLORS.dangerSoft,

    borderWidth: 1,

    borderColor: COLORS.dangerBorder,

    borderRadius: 14,

    paddingHorizontal: 13,

    paddingVertical: 10,

    marginBottom: 12,

  },



  errorBannerText: {

    flex: 1,

    color: COLORS.dangerText,

    fontSize: 11,

    lineHeight: 16,

    fontFamily: 'Poppins_500Medium',

    marginRight: 10,

  },



  errorRetryText: {

    color: COLORS.dangerText,

    fontSize: 10,

    fontFamily: 'Poppins_800ExtraBold',

    letterSpacing: 0.8,

  },



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



  listContainer: {

    paddingTop: 2,

    paddingBottom: 100,

  },



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



  loadingContainer: {

    flex: 1,

    justifyContent: 'center',

    alignItems: 'center',

    paddingHorizontal: 30,

    paddingBottom: 80,

  },



  loadingIconContainer: {

    width: 96,

    height: 96,

    borderRadius: 30,

    justifyContent: 'center',

    alignItems: 'center',

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    marginBottom: 20,

  },



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



  retryButton: {

    marginTop: 18,

    paddingHorizontal: 18,

    paddingVertical: 10,

    borderRadius: 20,

    backgroundColor: COLORS.primary,

    borderWidth: 1,

    borderColor: COLORS.primaryDark,

  },



  retryButtonText: {

    color: COLORS.textPrimary,

    fontSize: 10,

    fontFamily: 'Poppins_800ExtraBold',

    letterSpacing: 0.8,

  },

});



export { NotificationsScreen };

export default NotificationsScreen;
