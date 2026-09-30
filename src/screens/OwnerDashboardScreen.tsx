import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================================================
   API
========================================================= */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

/* =========================================================
   THEME COLORS - WHITE & LIGHT GREEN
========================================================= */

const COLORS = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',
  primaryLight: '#DCFCE7',
  primarySoft: '#F0FDF4',
  primaryFaint: '#F7FEF9',

  accent: '#F97316',
  accentLight: '#FFEDD5',
  accentSoft: '#FEF3C7',
  accentText: '#92400E',

  info: '#3B82F6',
  infoSoft: '#EFF6FF',
  infoBorder: '#BFDBFE',

  bg: '#FFFFFF',
  bgSoft: '#FAFEFB',
  card: '#FFFFFF',
  cardSoft: '#F9FDFA',

  border: '#E8F5EC',
  borderLight: '#D1FAE5',
  borderSoft: '#BBF7D0',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  placeholder: '#94A3B8',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleBorder: '#DDD6FE',

  white: '#FFFFFF',
};

/* =========================================================
   TYPES
========================================================= */

interface OwnerDashboardScreenProps {
  user?: {
    _id?: string;
    id?: string;
    name?: string;
  };
  onAddTurf?: () => void;
  onManageCourts?: () => void;
  onManageSlots?: () => void;
  onViewBookings?: () => void;
}

interface DashboardData {
  overview: {
    totalRevenue: number;
    todaysBookings: number;
    totalBookings: number;
    occupancy: number;
  };
  slots: {
    available: number;
    reserved: number;
    booked: number;
    blocked: number;
  };
  revenue: { date: string; revenue: number }[];
  courts: {
    _id: string;
    name: string;
    sport: string;
    pricePerHour: number;
    status: 'active' | 'inactive' | 'maintenance';
    bookedSlots: number;
    totalSlots: number;
    occupancy: number;
    revenue: number;
  }[];
  todaysBookings: {
    confirmed: number;
    pending: number;
    completed: number;
    cancelled: number;
  };
  recentBookings: {
    _id: string;
    customer?: { name?: string; email?: string; phone?: string } | null;
    turf?: { name?: string; city?: string } | null;
    court?: { name?: string; sport?: string } | null;
    bookingDate: string;
    startTime: string;
    endTime: string;
    grossAmount: number;
    discountAmount: number;
    finalAmount: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    createdAt: string;
  }[];
  upcomingSlots: {
    _id: string;
    date: string;
    startTime: string;
    endTime: string;
    price: number;
    status: string;
    court?: { name?: string; sport?: string };
  }[];
  payments: {
    gross: number;
    platformFee: number;
    ownerAmount: number;
  };
  turfs: {
    _id: string;
    name: string;
    city: string;
    address: string;
    status: string;
  }[];
}

const emptyDashboard: DashboardData = {
  overview: { totalRevenue: 0, todaysBookings: 0, totalBookings: 0, occupancy: 0 },
  slots: { available: 0, reserved: 0, booked: 0, blocked: 0 },
  revenue: [],
  courts: [],
  todaysBookings: { confirmed: 0, pending: 0, completed: 0, cancelled: 0 },
  recentBookings: [],
  upcomingSlots: [],
  payments: { gross: 0, platformFee: 0, ownerAmount: 0 },
  turfs: [],
};

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN')}`;

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const getInitials = (name?: string) => {
  if (!name) return 'CU';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getStatusColors = (status: string) => {
  const clean = (status || '').toLowerCase();
  switch (clean) {
    case 'confirmed':
      return { bg: COLORS.primarySoft, border: COLORS.borderSoft, text: COLORS.primaryDark };
    case 'completed':
      return { bg: COLORS.infoSoft, border: COLORS.infoBorder, text: COLORS.info };
    case 'pending':
      return { bg: COLORS.warningSoft, border: COLORS.warningBorder, text: COLORS.warningText };
    case 'cancelled':
      return { bg: COLORS.dangerSoft, border: COLORS.dangerBorder, text: COLORS.dangerText };
    case 'maintenance':
      return { bg: COLORS.warningSoft, border: COLORS.warningBorder, text: COLORS.warningText };
    default:
      return { bg: COLORS.cardSoft, border: COLORS.border, text: COLORS.textMuted };
  }
};

/* =========================================================
   COMPONENT
========================================================= */

const OwnerDashboardScreen: React.FC<OwnerDashboardScreenProps> = ({
  user,
  onAddTurf,
  onManageCourts,
  onManageSlots,
  onViewBookings,
}) => {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7' | '30' | '90'>('7');

  const ownerId = user?._id || user?.id;

  const fetchDashboard = useCallback(
    async (showLoader = true) => {
      if (!ownerId) {
        setError('Owner information is missing.');
        setLoading(false);
        return;
      }

      try {
        if (showLoader) setLoading(true);
        setError('');

        const response = await fetch(`${API_BASE_URL}/owners/${ownerId}/dashboard`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load dashboard');
        }

        setDashboard({ ...emptyDashboard, ...data });
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [ownerId],
  );

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboard(false);
  };

  const maxRevenue = useMemo(() => {
    if (!dashboard.revenue.length) return 1;
    return Math.max(...dashboard.revenue.map((item) => item.revenue), 1);
  }, [dashboard.revenue]);

  const visibleRevenue = useMemo(() => {
    const count = Number(period);
    return dashboard.revenue.slice(-count);
  }, [dashboard.revenue, period]);

  /* LOADING */
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingLogo}>
            <Text style={styles.loadingLogoText}>T</Text>
          </View>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerBadge}>📊 OWNER</Text>
            <Text style={styles.greeting}>
              Hello, {user?.name || 'Owner'} 👋
            </Text>
            <Text style={styles.turfCount}>
              {dashboard.turfs.length}{' '}
              {dashboard.turfs.length === 1 ? 'turf' : 'turfs'} connected
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>📊</Text>
          </View>
        </View>

        {/* ERROR */}
        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconCircle}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Unable to load dashboard</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchDashboard()}
              activeOpacity={0.85}
            >
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* TURFS */}
        {dashboard.turfs.length > 0 && (
          <View style={styles.turfCard}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.turfCardTitle}>Your Turfs</Text>
              <View style={styles.sectionTitleAccent} />
            </View>

            {dashboard.turfs.map((turf, index) => {
              const statusColors = getStatusColors(turf.status);
              return (
                <View
                  key={turf._id}
                  style={[
                    styles.turfRow,
                    index === dashboard.turfs.length - 1 && styles.turfRowLast,
                  ]}
                >
                  <View style={styles.turfIcon}>
                    <Text style={styles.turfIconText}>🏟️</Text>
                  </View>

                  <View style={styles.turfInfo}>
                    <Text style={styles.turfName} numberOfLines={1}>
                      {turf.name}
                    </Text>
                    <Text style={styles.turfAddress} numberOfLines={1}>
                      {turf.city} • {turf.address}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColors.bg,
                        borderColor: statusColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {String(turf.status).toUpperCase()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* OVERVIEW */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.sectionTitleAccent} />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>₹</Text>
            </View>
            <Text style={styles.statValue}>
              {formatCurrency(dashboard.overview.totalRevenue)}
            </Text>
            <Text style={styles.statLabel}>Owner Revenue</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📅</Text>
            </View>
            <Text style={styles.statValue}>
              {dashboard.overview.todaysBookings}
            </Text>
            <Text style={styles.statLabel}>Today's Bookings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>🎟️</Text>
            </View>
            <Text style={styles.statValue}>
              {dashboard.overview.totalBookings}
            </Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Text style={styles.statIconText}>📊</Text>
            </View>
            <Text style={styles.statValue}>
              {dashboard.overview.occupancy}%
            </Text>
            <Text style={styles.statLabel}>Today's Occupancy</Text>
          </View>
        </View>

        {/* REVENUE */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Revenue Overview</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.revenueCard}>
          <Text style={styles.revenueLabel}>OWNER EARNINGS</Text>
          <Text style={styles.revenueAmount}>
            {formatCurrency(dashboard.payments.ownerAmount)}
          </Text>

          <View style={styles.chart}>
            {visibleRevenue.length === 0 ? (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartIcon}>📈</Text>
                <Text style={styles.emptyText}>No revenue data available</Text>
              </View>
            ) : (
              visibleRevenue.map((item, index) => {
                const barHeight = Math.max(8, (item.revenue / maxRevenue) * 110);
                return (
                  <View key={`${item.date}-${index}`} style={styles.chartColumn}>
                    <View style={[styles.bar, { height: barHeight }]} />
                    <Text style={styles.dayText}>{formatDate(item.date)}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.periodRow}>
            {[
              { value: '7', label: '7 Days' },
              { value: '30', label: '30 Days' },
              { value: '90', label: '3 Months' },
            ].map((item) => (
              <TouchableOpacity
                key={item.value}
                style={period === item.value ? styles.activePeriod : styles.periodButton}
                onPress={() => setPeriod(item.value as '7' | '30' | '90')}
                activeOpacity={0.85}
              >
                <Text
                  style={period === item.value ? styles.activePeriodText : styles.periodText}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* TODAY'S SLOTS */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Today's Slots</Text>
          <View style={styles.sectionTitleAccent} />
        </View>

        <View style={styles.slotSummaryCard}>
          <View style={styles.slotItem}>
            <View style={[styles.slotDot, styles.availableDot]} />
            <Text style={styles.slotLabel}>Available</Text>
            <Text style={styles.slotValue}>{dashboard.slots.available}</Text>
          </View>
          <View style={styles.slotItem}>
            <View style={[styles.slotDot, styles.reservedDot]} />
            <Text style={styles.slotLabel}>Reserved</Text>
            <Text style={styles.slotValue}>{dashboard.slots.reserved}</Text>
          </View>
          <View style={styles.slotItem}>
            <View style={[styles.slotDot, styles.bookedDot]} />
            <Text style={styles.slotLabel}>Booked</Text>
            <Text style={styles.slotValue}>{dashboard.slots.booked}</Text>
          </View>
          <View style={styles.slotItem}>
            <View style={[styles.slotDot, styles.blockedDot]} />
            <Text style={styles.slotLabel}>Blocked</Text>
            <Text style={styles.slotValue}>{dashboard.slots.blocked}</Text>
          </View>
        </View>

        {/* COURT PERFORMANCE */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Court Performance</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
          <TouchableOpacity onPress={onManageCourts} activeOpacity={0.85}>
            <Text style={styles.viewText}>MANAGE</Text>
          </TouchableOpacity>
        </View>

        {dashboard.courts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🏟️</Text>
            </View>
            <Text style={styles.emptyTitle}>No courts found</Text>
            <Text style={styles.emptyText}>Add courts to start tracking performance.</Text>
            {onManageCourts && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={onManageCourts}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>MANAGE COURTS</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          dashboard.courts.map((court) => {
            const statusColors = getStatusColors(court.status);
            return (
              <View key={court._id} style={styles.courtCard}>
                <View style={styles.courtTop}>
                  <View style={styles.courtNameBox}>
                    <Text style={styles.courtName}>{court.name}</Text>
                    <View style={styles.sportPill}>
                      <Text style={styles.sportPillText}>
                        {String(court.sport).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.courtBookings}>
                      {court.bookedSlots} / {court.totalSlots} slots booked
                    </Text>
                  </View>
                  <Text style={styles.courtPercentage}>{court.occupancy}%</Text>
                </View>

                <View style={styles.progressBackground}>
                  <View
                    style={[styles.progressFill, { width: `${Math.min(court.occupancy, 100)}%` }]}
                  />
                </View>

                <View style={styles.courtBottom}>
                  <Text style={styles.courtRevenue}>
                    Revenue: {formatCurrency(court.revenue)}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: statusColors.bg,
                        borderColor: statusColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: statusColors.text }]}>
                      {String(court.status).toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* TODAY'S BOOKINGS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Today's Bookings</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
          <TouchableOpacity onPress={onViewBookings} activeOpacity={0.85}>
            <Text style={styles.viewText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bookingSummary}>
          <View style={styles.bookingSummaryItem}>
            <View style={[styles.bookingDot, styles.greenDot]} />
            <Text style={[styles.bookingNumber, styles.greenText]}>
              {dashboard.todaysBookings.confirmed}
            </Text>
            <Text style={styles.bookingLabel}>Confirmed</Text>
          </View>
          <View style={styles.bookingSummaryItem}>
            <View style={[styles.bookingDot, styles.orangeDot]} />
            <Text style={[styles.bookingNumber, styles.orangeText]}>
              {dashboard.todaysBookings.pending}
            </Text>
            <Text style={styles.bookingLabel}>Pending</Text>
          </View>
          <View style={styles.bookingSummaryItem}>
            <View style={[styles.bookingDot, styles.blueDot]} />
            <Text style={[styles.bookingNumber, styles.blueText]}>
              {dashboard.todaysBookings.completed}
            </Text>
            <Text style={styles.bookingLabel}>Completed</Text>
          </View>
          <View style={styles.bookingSummaryItem}>
            <View style={[styles.bookingDot, styles.redDot]} />
            <Text style={[styles.bookingNumber, styles.redText]}>
              {dashboard.todaysBookings.cancelled}
            </Text>
            <Text style={styles.bookingLabel}>Cancelled</Text>
          </View>
        </View>

        {/* RECENT BOOKINGS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
          <TouchableOpacity onPress={onViewBookings} activeOpacity={0.85}>
            <Text style={styles.viewText}>VIEW ALL</Text>
          </TouchableOpacity>
        </View>

        {dashboard.recentBookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>📅</Text>
            </View>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>Customer bookings will appear here.</Text>
          </View>
        ) : (
          dashboard.recentBookings.map((booking) => {
            const statusColors = getStatusColors(booking.status);
            return (
              <View key={booking._id} style={styles.bookingCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {getInitials(booking.customer?.name)}
                  </Text>
                </View>

                <View style={styles.bookingInfo}>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {booking.customer?.name || 'Customer'}
                  </Text>
                  <Text style={styles.bookingDetails} numberOfLines={1}>
                    {booking.court?.name || 'Court'} • {booking.startTime} - {booking.endTime}
                  </Text>
                  <Text style={styles.bookingDate}>📅 {formatDate(booking.bookingDate)}</Text>
                </View>

                <View style={styles.bookingRight}>
                  <Text style={styles.bookingAmount}>
                    {formatCurrency(booking.finalAmount)}
                  </Text>
                  <View
                    style={[
                      styles.statusBadgeSmall,
                      {
                        backgroundColor: statusColors.bg,
                        borderColor: statusColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusTextSmall, { color: statusColors.text }]}>
                      {String(booking.status).toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* PAYMENT SUMMARY */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.sectionTitleAccent} />
        </View>

        <View style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Gross Collection</Text>
            <Text style={styles.paymentValue}>
              {formatCurrency(dashboard.payments.gross)}
            </Text>
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Platform Fee</Text>
            <Text style={[styles.paymentValue, styles.feeText]}>
              - {formatCurrency(dashboard.payments.platformFee)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.paymentRow}>
            <Text style={styles.ownerAmountLabel}>Owner Earnings</Text>
            <Text style={styles.ownerAmount}>
              {formatCurrency(dashboard.payments.ownerAmount)}
            </Text>
          </View>
        </View>

        {/* UPCOMING SLOTS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Upcoming Slots</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
          <TouchableOpacity onPress={onManageSlots} activeOpacity={0.85}>
            <Text style={styles.viewText}>MANAGE</Text>
          </TouchableOpacity>
        </View>

        {dashboard.upcomingSlots.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🕐</Text>
            </View>
            <Text style={styles.emptyTitle}>No upcoming slots</Text>
            <Text style={styles.emptyText}>Upcoming court slots will appear here.</Text>
          </View>
        ) : (
          dashboard.upcomingSlots.slice(0, 5).map((slot) => (
            <View key={slot._id} style={styles.slotCard}>
              <View style={styles.slotDateBox}>
                <Text style={styles.slotDate}>{formatDate(slot.date)}</Text>
              </View>
              <View style={styles.slotInfo}>
                <Text style={styles.slotCourt}>{slot.court?.name || 'Court'}</Text>
                <Text style={styles.slotTime}>
                  {slot.startTime} - {slot.endTime}
                </Text>
              </View>
              <Text style={styles.slotPrice}>{formatCurrency(slot.price)}</Text>
            </View>
          ))
        )}

        {/* QUICK ACTIONS */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.sectionTitleAccent} />
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={onAddTurf} activeOpacity={0.85}>
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionIcon}>＋</Text>
            </View>
            <Text style={styles.actionText}>Add Turf</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onManageCourts} activeOpacity={0.85}>
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionIcon}>🏟️</Text>
            </View>
            <Text style={styles.actionText}>Manage Courts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onManageSlots} activeOpacity={0.85}>
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionIcon}>🕐</Text>
            </View>
            <Text style={styles.actionText}>Manage Slots</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onViewBookings} activeOpacity={0.85}>
            <View style={styles.actionIconCircle}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={styles.actionText}>Bookings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default OwnerDashboardScreen;

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    padding: 20,
    paddingBottom: 110,
  },

  /* LOADING */
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },

  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },

  loadingLogoText: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: '900',
  },

  loadingText: {
    marginTop: 14,
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },

  headerText: {
    flex: 1,
    marginRight: 12,
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

  greeting: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  turfCount: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '500',
  },

  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },

  headerIconText: {
    fontSize: 24,
  },

  /* ERROR */
  errorCard: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: 'center',
  },

  errorIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  errorIconText: {
    fontSize: 24,
    color: COLORS.dangerText,
    fontWeight: '900',
  },

  errorTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.dangerText,
    letterSpacing: 0.2,
  },

  errorText: {
    fontSize: 12,
    color: COLORS.dangerText,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  retryText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* SECTIONS */
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 10,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.textPrimary,
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

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
  },

  viewText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
  },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },

  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },

  liveText: {
    color: COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* TURFS CARD */
  turfCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  turfCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  turfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  turfRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },

  turfIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  turfIconText: {
    fontSize: 20,
  },

  turfInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  turfName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  turfAddress: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },

  statusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  statusBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
  },

  statusTextSmall: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* STATS */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  statCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  statIconText: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },

  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 5,
    fontWeight: '600',
  },

  /* REVENUE */
  revenueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  revenueLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  revenueAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: 8,
    letterSpacing: 0.3,
  },

  chart: {
    height: 150,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  chartColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    minWidth: 30,
  },

  bar: {
    width: 20,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginBottom: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 2,
  },

  dayText: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 6,
    fontWeight: '600',
  },

  emptyChart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyChartIcon: {
    fontSize: 30,
    marginBottom: 10,
  },

  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    fontWeight: '500',
  },

  periodRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 10,
  },

  activePeriod: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },

  activePeriodText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  periodButton: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },

  periodText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* SLOT SUMMARY */
  slotSummaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  slotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },

  availableDot: { backgroundColor: COLORS.primary },
  reservedDot: { backgroundColor: COLORS.warning },
  bookedDot: { backgroundColor: COLORS.info },
  blockedDot: { backgroundColor: COLORS.danger },

  slotLabel: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  slotValue: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  /* COURT PERFORMANCE */
  courtCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  courtTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  courtNameBox: {
    flex: 1,
    marginRight: 12,
  },

  courtName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  sportPill: {
    alignSelf: 'flex-start',
    marginTop: 7,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  sportPillText: {
    color: COLORS.primaryDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  courtBookings: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 7,
    fontWeight: '600',
  },

  courtPercentage: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },

  progressBackground: {
    height: 10,
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 6,
    marginTop: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },

  courtBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },

  courtRevenue: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },

  /* BOOKING SUMMARY */
  bookingSummary: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  bookingSummaryItem: {
    alignItems: 'center',
    flex: 1,
  },

  bookingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 7,
  },

  greenDot: { backgroundColor: COLORS.primary },
  orangeDot: { backgroundColor: COLORS.warning },
  blueDot: { backgroundColor: COLORS.info },
  redDot: { backgroundColor: COLORS.danger },

  bookingNumber: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  bookingLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  greenText: { color: COLORS.primaryDark },
  orangeText: { color: COLORS.warningText },
  blueText: { color: COLORS.info },
  redText: { color: COLORS.dangerText },

  /* RECENT BOOKINGS */
  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  avatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },

  bookingInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  customerName: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  bookingDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },

  bookingDate: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 4,
    fontWeight: '600',
  },

  bookingRight: {
    alignItems: 'flex-end',
  },

  bookingAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  /* PAYMENT */
  paymentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },

  paymentLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  paymentValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },

  feeText: {
    color: COLORS.dangerText,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 12,
  },

  ownerAmountLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  ownerAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },

  /* UPCOMING SLOTS */
  slotCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  slotDateBox: {
    width: 60,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  slotDate: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  slotInfo: {
    flex: 1,
    marginLeft: 14,
  },

  slotCourt: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  slotTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },

  slotPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },

  /* EMPTY */
  emptyCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIcon: {
    fontSize: 30,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1.2,
  },

  /* QUICK ACTIONS */
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  actionButton: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
  },

  actionIcon: {
    fontSize: 24,
    color: COLORS.primaryDark,
  },

  actionText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
});