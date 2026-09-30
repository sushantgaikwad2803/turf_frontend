import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type {
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import type {
  RootStackParamList,
  User,
} from '../../App';

/* =========================================================
   CONFIG
========================================================= */

const API_BASE_URL = 'http://192.168.0.100:5000/api';

/* =========================================================
   THEME COLORS
========================================================= */

const COLORS = {
  primary: '#16A34A',
  primaryDark: '#15803D',
  primaryDeep: '#065F46',
  primaryLight: '#DCFCE7',
  primarySoft: '#F0FDF4',
  primaryFaint: '#F7FDF9',

  accent: '#F97316',
  accentLight: '#FFEDD5',
  accentSoft: '#FEF3C7',
  accentText: '#92400E',

  info: '#2563EB',
  infoSoft: '#EFF6FF',

  bg: '#FFFFFF',
  bgSoft: '#F7FDF9',
  card: '#FFFFFF',
  cardSoft: '#F9FAFB',

  border: '#E5E7EB',
  borderLight: '#D1FAE5',
  borderSoft: '#BBF7D0',

  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  placeholder: '#9CA3AF',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#DC2626',

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningText: '#92400E',

  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',

  white: '#FFFFFF',
};

/* =========================================================
   TYPES
========================================================= */

type TurfStatus = 'active' | 'inactive' | 'maintenance';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'> & {
  user: User;
  onLogout: () => void;
};

interface AdminOverview {
  totalUsers: number;
  totalTurfs: number;
  totalCourts: number;
  totalBookings: number;
  grossRevenue: number;
  platformRevenue: number;
  todaysBookings: number;
  todaysRevenue: number;
}

interface UserSummary {
  total: number;
  customers: number;
  owners: number;
  admins: number;
}

interface TurfSummary {
  total: number;
  active: number;
  inactive: number;
  maintenance: number;
}

interface CourtSummary {
  total: number;
  active: number;
}

interface BookingSummary {
  total: number;
  today: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}

interface PaymentPeriod {
  grossRevenue: number;
  platformRevenue: number;
  ownerAmount: number;
}

interface PaymentSummary {
  grossRevenue: number;
  platformRevenue: number;
  ownerAmount: number;
  today: PaymentPeriod;
  thisMonth: PaymentPeriod;
}

interface AdminDashboardData {
  success: boolean;
  overview: AdminOverview;
  users: UserSummary;
  turfs: TurfSummary;
  courts: CourtSummary;
  bookings: BookingSummary;
  payments: PaymentSummary;
  content: {
    reviews: number;
    coupons: number;
  };
  recentUsers: Array<{
    _id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    createdAt?: string;
  }>;
  recentTurfs: Array<{
    _id: string;
    name: string;
    city: string;
    address: string;
    status: TurfStatus | string;
    owner?: {
      _id: string;
      name: string;
      email: string;
      phone?: string;
    } | null;
    createdAt?: string;
  }>;
  recentBookings: Array<{
    _id: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    finalAmount: number;
    status: string;
    user?: {
      _id: string;
      name: string;
      email: string;
      phone?: string;
    } | null;
    turf?: {
      _id: string;
      name: string;
      city: string;
    } | null;
    court?: {
      _id: string;
      name: string;
      sport: string;
    } | null;
  }>;
}

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (value: number): string => {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
};

const formatDate = (value?: string): string => {
  if (!value) return '--';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '--';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/* =========================================================
   COMPONENT
========================================================= */

const AdminDashboardScreen: React.FC<Props> = ({ user, onLogout }) => {
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingTurfId, setUpdatingTurfId] = useState<string | null>(null);

  /* FETCH DASHBOARD */
  const fetchDashboard = useCallback(
    async (showLoader = true): Promise<void> => {
      try {
        if (showLoader) setLoading(true);
        setError(null);

        if (!user?._id) {
          throw new Error('Admin user ID is missing.');
        }

        const response = await fetch(
          `${API_BASE_URL}/admin/dashboard?adminId=${encodeURIComponent(
            user._id
          )}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load admin dashboard.');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to load dashboard.');
        }

        setDashboard(data);
      } catch (requestError) {
        console.error('Admin dashboard fetch error:', requestError);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to load dashboard.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?._id]
  );

  /* INITIAL LOAD */
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* REFRESH */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard(false);
  }, [fetchDashboard]);

  /* UPDATE TURF STATUS */
  const updateTurfStatus = useCallback(
    async (turfId: string, status: TurfStatus): Promise<void> => {
      try {
        if (!user?._id) {
          Alert.alert('Error', 'Admin user ID is missing.');
          return;
        }

        if (!turfId) {
          Alert.alert('Error', 'Turf ID is missing.');
          return;
        }

        setUpdatingTurfId(turfId);

        const response = await fetch(
          `${API_BASE_URL}/admin/turfs/${encodeURIComponent(turfId)}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ adminId: user._id, status }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to update turf status.');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to update turf status.');
        }

        const title =
          status === 'active'
            ? 'Turf Activated'
            : status === 'inactive'
            ? 'Turf Deactivated'
            : 'Turf Under Maintenance';

        Alert.alert(
          title,
          data?.message || 'Turf status updated successfully.'
        );

        await fetchDashboard(false);
      } catch (requestError) {
        console.error('Update turf status error:', requestError);
        Alert.alert(
          'Update Failed',
          requestError instanceof Error
            ? requestError.message
            : 'Unable to update turf status.'
        );
      } finally {
        setUpdatingTurfId(null);
      }
    },
    [user?._id, fetchDashboard]
  );

  /* ACTIVATE TURF */
  const handleActivateTurf = useCallback(
    (turfId: string, turfName: string) => {
      Alert.alert(
        'Activate Turf',
        `Are you sure you want to activate "${turfName}"?\n\nOnce activated, this turf will become visible to customers on the Home screen.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Activate', onPress: () => updateTurfStatus(turfId, 'active') },
        ]
      );
    },
    [updateTurfStatus]
  );

  /* DEACTIVATE TURF */
  const handleDeactivateTurf = useCallback(
    (turfId: string, turfName: string) => {
      Alert.alert(
        'Deactivate Turf',
        `Are you sure you want to deactivate "${turfName}"?\n\nThis turf will no longer be visible to customers.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: () => updateTurfStatus(turfId, 'inactive'),
          },
        ]
      );
    },
    [updateTurfStatus]
  );

  /* MAINTENANCE */
  const handleMaintenanceTurf = useCallback(
    (turfId: string, turfName: string) => {
      Alert.alert(
        'Move to Maintenance',
        `Are you sure you want to move "${turfName}" to maintenance?\n\nCustomers will not see this turf while it is not active.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Maintenance',
            onPress: () => updateTurfStatus(turfId, 'maintenance'),
          },
        ]
      );
    },
    [updateTurfStatus]
  );

  /* LOGOUT */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: onLogout },
    ]);
  };

  /* MANAGEMENT ACTION */
  const showComingSoon = (title: string) => {
    Alert.alert(
      title,
      'This management section will be connected to its detailed screen next.',
      [{ text: 'OK' }]
    );
  };

  /* LOADING */
  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View style={styles.loadingContainer}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>T</Text>
          </View>

          <ActivityIndicator size="large" color={COLORS.primary} />

          <Text style={styles.loadingTitle}>Loading Admin Dashboard</Text>
          <Text style={styles.loadingSubtitle}>
            Fetching platform statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ERROR */
  if (error && !dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>

          <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
          <Text style={styles.errorMessage}>{error}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.85}
            onPress={() => fetchDashboard()}
          >
            <Text style={styles.retryButtonText}>TRY AGAIN</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.errorLogoutButton}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text style={styles.errorLogoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* SAFE DATA */
  const overview = dashboard?.overview;
  const users = dashboard?.users;
  const turfs = dashboard?.turfs;
  const courts = dashboard?.courts;
  const bookings = dashboard?.bookings;
  const payments = dashboard?.payments;
  const content = dashboard?.content;

  /* =========================================================
     UI
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerBadgeRow}>
            <Text style={styles.headerBadge}>🏆 TURFBOOK ADMIN</Text>
          </View>

          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Platform overview & management
          </Text>

          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>ADMIN</Text>
          </View>
        </View>

        {/* WELCOME CARD */}
        <View style={styles.welcomeCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>

            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>🏆</Text>
            </View>
          </View>

          <View style={styles.welcomeContent}>
            <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
            <Text style={styles.welcomeName} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.welcomeEmail} numberOfLines={1}>
              {user.email}
            </Text>
          </View>

          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>LIVE</Text>
          </View>
        </View>

        {/* PLATFORM OVERVIEW */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Live platform statistics
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>👥</Text>
            </View>

            <Text style={styles.statValue}>{overview?.totalUsers ?? 0}</Text>
            <Text style={styles.statTitle}>Total Users</Text>
            <Text style={styles.statMeta}>
              {users?.customers ?? 0} customers • {users?.owners ?? 0} owners
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>🏟️</Text>
            </View>

            <Text style={styles.statValue}>{overview?.totalTurfs ?? 0}</Text>
            <Text style={styles.statTitle}>Total Turfs</Text>
            <Text style={styles.statMeta}>{turfs?.active ?? 0} active</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📅</Text>
            </View>

            <Text style={styles.statValue}>
              {overview?.totalBookings ?? 0}
            </Text>
            <Text style={styles.statTitle}>Total Bookings</Text>
            <Text style={styles.statMeta}>
              {overview?.todaysBookings ?? 0} today
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>₹</Text>
            </View>

            <Text style={styles.statValueSmall}>
              {formatCurrency(overview?.platformRevenue ?? 0)}
            </Text>
            <Text style={styles.statTitle}>Platform Revenue</Text>
            <Text style={styles.statMeta}>
              Today {formatCurrency(overview?.todaysRevenue ?? 0)}
            </Text>
          </View>
        </View>

        {/* REVENUE */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Revenue</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Payment collection summary
          </Text>
        </View>

        <View style={styles.revenueCard}>
          <View style={styles.revenueMain}>
            <Text style={styles.revenueLabel}>TOTAL GROSS COLLECTION</Text>
            <Text style={styles.revenueValue}>
              {formatCurrency(payments?.grossRevenue ?? 0)}
            </Text>
          </View>

          <View style={styles.revenueDivider} />

          <View style={styles.revenueRow}>
            <View>
              <Text style={styles.revenueRowLabel}>Platform Revenue</Text>
              <Text style={styles.revenueRowValue}>
                {formatCurrency(payments?.platformRevenue ?? 0)}
              </Text>
            </View>

            <View style={styles.revenueRight}>
              <Text style={styles.revenueRowLabel}>Owner Amount</Text>
              <Text style={styles.revenueRowValue}>
                {formatCurrency(payments?.ownerAmount ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.revenueMonthBox}>
            <Text style={styles.revenueMonthTitle}>THIS MONTH</Text>
            <Text style={styles.revenueMonthValue}>
              {formatCurrency(payments?.thisMonth?.platformRevenue ?? 0)}
            </Text>
          </View>
        </View>

        {/* BOOKING STATUS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Booking Overview</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>Current booking status</Text>
        </View>

        <View style={styles.bookingStatusGrid}>
          <View style={styles.bookingStatusCard}>
            <View style={styles.bookingStatusHeader}>
              <View style={styles.bookingStatusDotPending} />
              <Text style={styles.bookingStatusValue}>
                {bookings?.pending ?? 0}
              </Text>
            </View>
            <Text style={styles.bookingStatusLabel}>Pending</Text>
          </View>

          <View style={styles.bookingStatusCard}>
            <View style={styles.bookingStatusHeader}>
              <View style={styles.bookingStatusDotConfirmed} />
              <Text style={styles.bookingStatusValue}>
                {bookings?.confirmed ?? 0}
              </Text>
            </View>
            <Text style={styles.bookingStatusLabel}>Confirmed</Text>
          </View>

          <View style={styles.bookingStatusCard}>
            <View style={styles.bookingStatusHeader}>
              <View style={styles.bookingStatusDotCompleted} />
              <Text style={styles.bookingStatusValue}>
                {bookings?.completed ?? 0}
              </Text>
            </View>
            <Text style={styles.bookingStatusLabel}>Completed</Text>
          </View>

          <View style={styles.bookingStatusCard}>
            <View style={styles.bookingStatusHeader}>
              <View style={styles.bookingStatusDotCancelled} />
              <Text style={styles.bookingStatusValue}>
                {bookings?.cancelled ?? 0}
              </Text>
            </View>
            <Text style={styles.bookingStatusLabel}>Cancelled</Text>
          </View>
        </View>

        {/* PLATFORM DETAILS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Platform Details</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Current platform inventory
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <DetailRow label="Customers" value={users?.customers ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow label="Owners" value={users?.owners ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow label="Courts" value={courts?.total ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow label="Active Courts" value={courts?.active ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow label="Active Turfs" value={turfs?.active ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow
            label="Inactive / Pending Turfs"
            value={turfs?.inactive ?? 0}
          />
          <View style={styles.detailDivider} />

          <DetailRow
            label="Maintenance Turfs"
            value={turfs?.maintenance ?? 0}
          />
          <View style={styles.detailDivider} />

          <DetailRow label="Reviews" value={content?.reviews ?? 0} />
          <View style={styles.detailDivider} />

          <DetailRow label="Coupons" value={content?.coupons ?? 0} />
        </View>

        {/* MANAGEMENT */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Management</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Manage TurfBook platform
          </Text>
        </View>

        <View style={styles.managementCard}>
          <ManagementItem
            icon="👥"
            title="User Management"
            subtitle="View and manage customers, owners and admins"
            onPress={() => showComingSoon('User Management')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="🏟️"
            title="Turf Management"
            subtitle="Manage registered turfs, courts and owners"
            onPress={() => showComingSoon('Turf Management')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="📅"
            title="Booking Management"
            subtitle="Monitor booking activity and statuses"
            onPress={() => showComingSoon('Booking Management')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="💳"
            title="Payments & Payouts"
            subtitle="Monitor payments, fees and owner settlements"
            onPress={() => showComingSoon('Payments & Payouts')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="⭐"
            title="Reviews & Reports"
            subtitle="Review feedback and platform content"
            onPress={() => showComingSoon('Reviews & Reports')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="🎟️"
            title="Coupons"
            subtitle="Manage promotional coupon campaigns"
            onPress={() => showComingSoon('Coupons')}
          />
        </View>

        {/* RECENT USERS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Users</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Latest registered accounts
          </Text>
        </View>

        <View style={styles.listCard}>
          {dashboard?.recentUsers?.length ? (
            dashboard.recentUsers.map((recentUser, index) => (
              <React.Fragment key={recentUser._id}>
                <View style={styles.userRow}>
                  <View style={styles.smallAvatar}>
                    <Text style={styles.smallAvatarText}>
                      {recentUser.name?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>

                  <View style={styles.listContent}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {recentUser.name}
                    </Text>
                    <Text style={styles.listSubtitle} numberOfLines={1}>
                      {recentUser.email}
                    </Text>
                  </View>

                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>
                      {String(recentUser.role).toUpperCase()}
                    </Text>
                  </View>
                </View>

                {index < dashboard.recentUsers.length - 1 && (
                  <View style={styles.listDivider} />
                )}
              </React.Fragment>
            ))
          ) : (
            <EmptyList text="No users found." />
          )}
        </View>

        {/* RECENT TURFS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Turfs</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Approve and manage turf registrations
          </Text>
        </View>

        <View style={styles.listCard}>
          {dashboard?.recentTurfs?.length ? (
            dashboard.recentTurfs.map((turf, index) => {
              const isUpdating = updatingTurfId === turf._id;
              const turfStatus = turf.status;

              return (
                <React.Fragment key={turf._id}>
                  <View style={styles.turfRow}>
                    <View style={styles.turfIcon}>
                      <Text style={styles.turfIconText}>🏟️</Text>
                    </View>

                    <View style={styles.turfMainContent}>
                      <Text style={styles.listTitle} numberOfLines={1}>
                        {turf.name}
                      </Text>

                      <Text style={styles.listSubtitle} numberOfLines={1}>
                        {turf.city} • {turf.owner?.name || 'Unknown owner'}
                      </Text>

                      <View style={styles.turfStatusRow}>
                        <View
                          style={[
                            styles.statusBadge,
                            turfStatus === 'active'
                              ? styles.statusActive
                              : turfStatus === 'maintenance'
                              ? styles.statusMaintenance
                              : styles.statusInactive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              turfStatus === 'active'
                                ? styles.statusTextActive
                                : turfStatus === 'maintenance'
                                ? styles.statusTextMaintenance
                                : styles.statusTextInactive,
                            ]}
                          >
                            {String(turfStatus).toUpperCase()}
                          </Text>
                        </View>

                        {turfStatus === 'inactive' && (
                          <TouchableOpacity
                            style={styles.activateButton}
                            activeOpacity={0.85}
                            disabled={isUpdating}
                            onPress={() =>
                              handleActivateTurf(turf._id, turf.name)
                            }
                          >
                            {isUpdating ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.white}
                              />
                            ) : (
                              <Text style={styles.activateButtonText}>
                                ACTIVATE
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}

                        {turfStatus === 'active' && (
                          <>
                            <TouchableOpacity
                              style={styles.deactivateButton}
                              activeOpacity={0.85}
                              disabled={isUpdating}
                              onPress={() =>
                                handleDeactivateTurf(turf._id, turf.name)
                              }
                            >
                              {isUpdating ? (
                                <ActivityIndicator
                                  size="small"
                                  color={COLORS.dangerText}
                                />
                              ) : (
                                <Text style={styles.deactivateButtonText}>
                                  DEACTIVATE
                                </Text>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.maintenanceButton}
                              activeOpacity={0.85}
                              disabled={isUpdating}
                              onPress={() =>
                                handleMaintenanceTurf(turf._id, turf.name)
                              }
                            >
                              <Text style={styles.maintenanceButtonText}>
                                MAINTENANCE
                              </Text>
                            </TouchableOpacity>
                          </>
                        )}

                        {turfStatus === 'maintenance' && (
                          <TouchableOpacity
                            style={styles.activateButton}
                            activeOpacity={0.85}
                            disabled={isUpdating}
                            onPress={() =>
                              handleActivateTurf(turf._id, turf.name)
                            }
                          >
                            {isUpdating ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.white}
                              />
                            ) : (
                              <Text style={styles.activateButtonText}>
                                ACTIVATE
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>

                  {index < dashboard.recentTurfs.length - 1 && (
                    <View style={styles.listDivider} />
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <EmptyList text="No turfs found." />
          )}
        </View>

        {/* RECENT BOOKINGS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Latest booking activity
          </Text>
        </View>

        <View style={styles.listCard}>
          {dashboard?.recentBookings?.length ? (
            dashboard.recentBookings.map((booking, index) => (
              <React.Fragment key={booking._id}>
                <View style={styles.bookingRow}>
                  <View style={styles.bookingIcon}>
                    <Text style={styles.bookingIconText}>📅</Text>
                  </View>

                  <View style={styles.listContent}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {booking.user?.name || 'Customer'}
                    </Text>
                    <Text style={styles.listSubtitle} numberOfLines={1}>
                      {booking.turf?.name || 'Turf'} •{' '}
                      {booking.court?.name || 'Court'}
                    </Text>
                    <Text style={styles.bookingDate}>
                      {formatDate(booking.bookingDate)} • {booking.startTime} -{' '}
                      {booking.endTime}
                    </Text>
                  </View>

                  <View style={styles.bookingRight}>
                    <Text style={styles.bookingAmount}>
                      {formatCurrency(booking.finalAmount)}
                    </Text>
                    <View
                      style={[
                        styles.bookingStatusPill,
                        booking.status === 'confirmed'
                          ? styles.bookingStatusConfirmed
                          : booking.status === 'completed'
                          ? styles.bookingStatusCompleted
                          : booking.status === 'cancelled'
                          ? styles.bookingStatusCancelled
                          : styles.bookingStatusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.bookingStatusText,
                          booking.status === 'confirmed'
                            ? styles.confirmed
                            : booking.status === 'completed'
                            ? styles.completed
                            : booking.status === 'cancelled'
                            ? styles.cancelled
                            : styles.pending,
                        ]}
                      >
                        {String(booking.status).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {index < dashboard.recentBookings.length - 1 && (
                  <View style={styles.listDivider} />
                )}
              </React.Fragment>
            ))
          ) : (
            <EmptyList text="No recent bookings found." />
          )}
        </View>

        {/* PLATFORM */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Platform</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <Text style={styles.sectionSubtitle}>
            Configuration & analytics
          </Text>
        </View>

        <View style={styles.managementCard}>
          <ManagementItem
            icon="⚙️"
            title="Platform Settings"
            subtitle="Configure TurfBook platform settings"
            onPress={() => showComingSoon('Platform Settings')}
          />
          <View style={styles.divider} />

          <ManagementItem
            icon="📊"
            title="Analytics"
            subtitle="View detailed platform performance"
            onPress={() => showComingSoon('Analytics')}
          />
        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={handleLogout}
        >
          <Text style={styles.logoutIcon}>⇥</Text>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>

        {/* FOOTER */}
        <Text style={styles.footer}>TurfBook Admin Panel</Text>
        <Text style={styles.footerVersion}>
          Platform Management • v1.0
        </Text>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* =========================================================
   SUB COMPONENTS
========================================================= */

const DetailRow = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const ManagementItem = ({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) => {
  return (
    <TouchableOpacity
      style={styles.managementItem}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={styles.managementIcon}>
        <Text style={styles.managementIconText}>{icon}</Text>
      </View>

      <View style={styles.managementContent}>
        <Text style={styles.managementTitle}>{title}</Text>
        <Text style={styles.managementSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
};

const EmptyList = ({ text }: { text: string }) => {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Text style={styles.emptyIconText}>📭</Text>
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
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

  scrollContent: {
    paddingBottom: 40,
  },

  /* HEADER */

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    position: 'relative',
  },

  headerBadgeRow: {
    marginBottom: 12,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },

  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 6,
  },

  adminBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },

  adminBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  /* WELCOME */

  welcomeCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  avatarWrapper: {
    position: 'relative',
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  avatarText: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: '900',
  },

  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.white,
  },

  avatarBadgeText: {
    fontSize: 10,
  },

  welcomeContent: {
    flex: 1,
    marginLeft: 14,
  },

  welcomeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 3,
  },

  welcomeName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  welcomeEmail: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },

  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },

  onlineText: {
    color: COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* SECTIONS */

  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 26,
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  sectionTitleAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginLeft: 8,
    marginTop: 2,
  },

  sectionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },

  /* STATISTICS */

  statsGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  statCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  statIconText: {
    fontSize: 18,
  },

  statValue: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  statValueSmall: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  statTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  statMeta: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: 0.2,
  },

  /* REVENUE */

  revenueCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  revenueMain: {
    alignItems: 'center',
  },

  revenueLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  revenueValue: {
    color: COLORS.primaryDark,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 6,
    letterSpacing: 0.3,
  },

  revenueDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },

  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  revenueRight: {
    alignItems: 'flex-end',
  },

  revenueRowLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },

  revenueRowValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },

  revenueMonthBox: {
    marginTop: 16,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  revenueMonthTitle: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  revenueMonthValue: {
    color: COLORS.primaryDark,
    fontSize: 16,
    fontWeight: '900',
  },

  /* BOOKING STATUS */

  bookingStatusGrid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  bookingStatusCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  bookingStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  bookingStatusDotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.warning,
    marginRight: 8,
  },

  bookingStatusDotConfirmed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 8,
  },

  bookingStatusDotCompleted: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.info,
    marginRight: 8,
  },

  bookingStatusDotCancelled: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginRight: 8,
  },

  bookingStatusValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },

  bookingStatusLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* DETAILS */

  detailsCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  detailRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },

  detailDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  /* MANAGEMENT */

  managementCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  managementItem: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  managementIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  managementIconText: {
    fontSize: 20,
  },

  managementContent: {
    flex: 1,
    marginLeft: 14,
  },

  managementTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  managementSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
    fontWeight: '500',
  },

  arrow: {
    color: COLORS.textMuted,
    fontSize: 27,
    fontWeight: '300',
    marginLeft: 8,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 76,
  },

  /* LISTS */

  listCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  userRow: {
    minHeight: 72,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },

  turfRow: {
    minHeight: 86,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  turfMainContent: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },

  bookingRow: {
    minHeight: 82,
    paddingHorizontal: 15,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },

  smallAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  smallAvatarText: {
    color: COLORS.primaryDark,
    fontSize: 16,
    fontWeight: '900',
  },

  turfIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  turfIconText: {
    fontSize: 19,
  },

  bookingIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  bookingIconText: {
    fontSize: 18,
  },

  listContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
  },

  listTitle: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  listSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 3,
    fontWeight: '500',
  },

  bookingDate: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 4,
    fontWeight: '500',
  },

  listDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 71,
  },

  roleBadge: {
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  roleBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* TURF STATUS */

  turfStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
    rowGap: 6,
  },

  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },

  statusActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.borderSoft,
  },

  statusInactive: {
    backgroundColor: COLORS.cardSoft,
    borderColor: COLORS.border,
  },

  statusMaintenance: {
    backgroundColor: COLORS.warningSoft,
    borderColor: '#FDE68A',
  },

  statusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  statusTextActive: {
    color: COLORS.primaryDark,
  },

  statusTextInactive: {
    color: COLORS.textMuted,
  },

  statusTextMaintenance: {
    color: COLORS.warningText,
  },

  activateButton: {
    marginLeft: 7,
    minWidth: 70,
    minHeight: 25,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activateButtonText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  deactivateButton: {
    marginLeft: 7,
    minHeight: 25,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  deactivateButtonText: {
    color: COLORS.dangerText,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  maintenanceButton: {
    marginLeft: 7,
    minHeight: 25,
    backgroundColor: COLORS.warningSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },

  maintenanceButtonText: {
    color: COLORS.warningText,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* BOOKING */

  bookingRight: {
    alignItems: 'flex-end',
    minWidth: 80,
  },

  bookingAmount: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },

  bookingStatusPill: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },

  bookingStatusConfirmed: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.borderSoft,
  },

  bookingStatusCompleted: {
    backgroundColor: COLORS.infoSoft,
    borderColor: '#BFDBFE',
  },

  bookingStatusCancelled: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.dangerBorder,
  },

  bookingStatusPending: {
    backgroundColor: COLORS.warningSoft,
    borderColor: '#FDE68A',
  },

  bookingStatusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  pending: {
    color: COLORS.warningText,
  },

  confirmed: {
    color: COLORS.primaryDark,
  },

  completed: {
    color: COLORS.info,
  },

  cancelled: {
    color: COLORS.dangerText,
  },

  /* EMPTY */

  emptyContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },

  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIconText: {
    fontSize: 24,
  },

  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  /* LOGOUT */

  logoutButton: {
    marginHorizontal: 16,
    marginTop: 28,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutIcon: {
    color: COLORS.dangerText,
    fontSize: 22,
    fontWeight: '700',
    marginRight: 8,
  },

  logoutText: {
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* LOADING */

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: COLORS.bg,
  },

  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  loadingLogoText: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: '900',
  },

  loadingTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 18,
    letterSpacing: 0.2,
  },

  loadingSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },

  /* ERROR */

  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    backgroundColor: COLORS.bg,
  },

  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  errorIconText: {
    color: COLORS.dangerText,
    fontSize: 28,
    fontWeight: '900',
  },

  errorTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  errorMessage: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    fontWeight: '500',
  },

  retryButton: {
    marginTop: 22,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 13,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  retryButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  errorLogoutButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  errorLogoutText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* FOOTER */

  footer: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 24,
    letterSpacing: 0.5,
  },

  footerVersion: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },

  footerSpace: {
    height: 10,
  },
});

export default AdminDashboardScreen;