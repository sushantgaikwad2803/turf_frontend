import React, { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
  useFonts,
} from '@expo-google-fonts/poppins';

/* =========================================================
   API CONFIG
========================================================= */

const RAW_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://192.168.0.100:5000/api';

const normalizeApiUrl = (url: string): string => {
  let normalized = String(url || '').trim();

  if (!normalized) {
    normalized = 'http://192.168.0.100:5000/api';
  }

  normalized = normalized.replace(/^["']|["']$/g, '');

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized.replace(/\/+$/, '');

  return normalized;
};

const API_BASE_URL = normalizeApiUrl(RAW_API_URL);

/* =========================================================
   THEME COLORS
========================================================= */

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
  accentText: '#6D28D9',

  bg: '#F7F8FC',
  bgSoft: '#FBFBFD',
  bgMuted: '#F1F3F8',
  card: '#FFFFFF',
  cardSoft: '#FCFCFE',

  border: '#E6E8EF',
  borderLight: '#ECEEF4',
  borderSoft: '#D9DCE7',
  borderDark: '#C9CDD9',

  textPrimary: '#0B1220',
  textSecondary: '#5E6677',
  textMuted: '#8A92A3',
  textLight: '#B7BDCA',
  placeholder: '#8A92A3',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  info: '#3B82F6',
  infoSoft: '#EFF6FF',

  white: '#FFFFFF',
  dark: '#0B1220',
  overlay: 'rgba(11,18,32,0.52)',
};

/* =========================================================
   TYPES
========================================================= */

export interface CustomerUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer';
}

export interface Booking {
  _id: string;

  turf?: {
    _id?: string;
    name?: string;
    address?: string;
    city?: string;
  };

  court?: {
    _id?: string;
    name?: string;
    sport?: string;
  };

  bookingDate: string;
  startTime: string;
  endTime: string;

  finalAmount: number;

  status:
    | 'confirmed'
    | 'cancelled'
    | 'pending'
    | 'completed'
    | 'booked'
    | string;
}

interface CustomerProfileScreenProps {
  user: CustomerUser;
  onUpdateUser?: (updatedUser: CustomerUser) => void;
  onLogout?: () => void;
}

/* =========================================================
   HELPERS
========================================================= */

const formatBookingDate = (dateString: string): string => {
  if (!dateString) return 'Date unavailable';

  try {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/**
 * Converts any time string into a compact 12-hour hour number.
 *
 * Examples:
 *   "17:00"     -> "5"
 *   "19:00"     -> "7"
 *   "12:00"     -> "12"
 *   "13:00"     -> "1"
 *   "00:00"     -> "12"
 *   "07:30"     -> "7:30"
 *   "5:00 PM"   -> "5"
 */
const formatTimeCompact = (time: string): string => {
  if (!time) return '--';

  const str = String(time).trim();

  const match = str.match(
    /^(\d{1,2})(?::(\d{1,2}))?(?::\d{2})?\s*(AM|PM)?$/i,
  );

  if (!match) return str;

  let hour = Number(match[1]);
  const minute = match[2] !== undefined ? Number(match[2]) : 0;
  const period = match[3]?.toUpperCase();

  if (!Number.isFinite(hour)) return str;

  // Normalize 12-hour AM/PM input to 24-hour internally
  if (period) {
    if (period === 'AM' && hour === 12) {
      hour = 0;
    } else if (period === 'PM' && hour < 12) {
      hour += 12;
    }
  }

  // Convert 24-hour to 12-hour display
  let displayHour: number;
  if (hour === 0) {
    displayHour = 12;
  } else if (hour > 12) {
    displayHour = hour - 12;
  } else {
    displayHour = hour;
  }

  if (minute === 0) {
    return String(displayHour);
  }

  return `${displayHour}:${String(minute).padStart(2, '0')}`;
};

const formatTimeRange = (
  startTime: string,
  endTime: string,
): string => {
  const start = formatTimeCompact(startTime);
  const end = formatTimeCompact(endTime);
  return `${start} - ${end}`;
};

const formatAmount = (amount: number): string => {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) return '0';

  return numericAmount.toLocaleString('en-IN');
};

const getInitial = (name?: string): string => {
  if (!name?.trim()) return 'U';
  return name.trim().charAt(0).toUpperCase();
};

const getStatusStyle = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'completed':
    case 'booked':
      return {
        container: {
          backgroundColor: COLORS.primarySoft,
          borderColor: COLORS.borderSoft,
        },
        text: {
          color: COLORS.primaryDarker,
        },
      };

    case 'cancelled':
      return {
        container: {
          backgroundColor: COLORS.dangerSoft,
          borderColor: COLORS.dangerBorder,
        },
        text: {
          color: COLORS.dangerText,
        },
      };

    case 'pending':
      return {
        container: {
          backgroundColor: COLORS.warningSoft,
          borderColor: COLORS.warningBorder,
        },
        text: {
          color: COLORS.warningText,
        },
      };

    default:
      return {
        container: {
          backgroundColor: COLORS.cardSoft,
          borderColor: COLORS.border,
        },
        text: {
          color: COLORS.textMuted,
        },
      };
  }
};

const getStatusLabel = (status: string): string => {
  if (!status) return 'UNKNOWN';
  return status.toUpperCase();
};

const getResponseData = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return { message: 'Server returned invalid JSON.' };
    }
  }

  const text = await response.text();
  return { message: text || 'Unexpected server response.' };
};

/* =========================================================
   COMPONENT
========================================================= */

const CustomerProfileScreen: React.FC<
  CustomerProfileScreenProps
> = ({ user, onUpdateUser, onLogout }) => {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  /* PROFILE STATE */
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');

  /* PASSWORD STATE */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  /* BOOKING STATE */
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* LOADING STATES */
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* SYNC USER DATA */
  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [user]);

  /* FETCH BOOKINGS */
  const fetchBookings = useCallback(async () => {
    if (!user?._id) {
      console.warn('Cannot fetch bookings: user ID is missing.');
      return;
    }

    const bookingUrl = `${API_BASE_URL}/users/${encodeURIComponent(
      user._id,
    )}/bookings`;

    try {
      setFetchingBookings(true);

      const response = await fetch(bookingUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = await getResponseData(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to fetch bookings. HTTP ${response.status}`,
        );
      }

      const bookingData: Booking[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.bookings)
          ? data.bookings
          : [];

      setBookings(bookingData);
    } catch (error: any) {
      console.error('Fetch bookings error:', error);
      setBookings([]);
    } finally {
      setFetchingBookings(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  const validateProfile = (): boolean => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      Alert.alert(
        'Missing Information',
        'Please fill in your name, email and phone number.',
      );
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    const phoneDigits = trimmedPhone.replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return false;
    }

    return true;
  };

  const handleUpdateProfile = async () => {
    if (!validateProfile()) return;

    if (!user?._id) {
      Alert.alert('Error', 'User information is missing.');
      return;
    }

    const updateUrl = `${API_BASE_URL}/users/${encodeURIComponent(
      user._id,
    )}`;

    try {
      setUpdatingProfile(true);

      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
        }),
      });

      const data = await getResponseData(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to update profile. HTTP ${response.status}`,
        );
      }

      const updatedUser: CustomerUser = data?.user || data;

      onUpdateUser?.({
        ...user,
        ...updatedUser,
        role: 'customer',
      });

      setShowEditProfile(false);

      Alert.alert('Success', 'Your profile has been updated successfully.');
    } catch (error: any) {
      console.error('Update profile error:', error);
      Alert.alert(
        'Update Failed',
        error?.message ||
          'Unable to update your profile. Please try again.',
      );
    } finally {
      setUpdatingProfile(false);
    }
  };

  const validatePassword = (): boolean => {
    if (!currentPassword.trim()) {
      Alert.alert('Missing Password', 'Please enter your current password.');
      return false;
    }

    if (!newPassword.trim()) {
      Alert.alert('Missing Password', 'Please enter your new password.');
      return false;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        'Invalid Password',
        'New password must contain at least 6 characters.',
      );
      return false;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        'Invalid Password',
        'New password must be different from your current password.',
      );
      return false;
    }

    return true;
  };

  const handleChangePassword = async () => {
    if (!validatePassword()) return;

    if (!user?._id) {
      Alert.alert('Error', 'User information is missing.');
      return;
    }

    const passwordUrl = `${API_BASE_URL}/users/${encodeURIComponent(
      user._id,
    )}/password`;

    try {
      setChangingPassword(true);

      const response = await fetch(passwordUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await getResponseData(response);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to change password. HTTP ${response.status}`,
        );
      }

      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowPasswordModal(false);

      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (error: any) {
      console.error('Change password error:', error);
      Alert.alert(
        'Password Change Failed',
        error?.message ||
          'Unable to change your password. Please try again.',
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (changingPassword) return;

    setCurrentPassword('');
    setNewPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowPasswordModal(false);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            onLogout?.();
          },
        },
      ],
      { cancelable: true },
    );
  };

  /* FONT LOADING GUARD */
  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.fontLoadingContainer}>
          <View style={styles.fontLoadingMark}>
            <Text style={styles.fontLoadingMarkText}>T</Text>
          </View>
          <ActivityIndicator size="small" color={COLORS.primaryDeep} />
          <Text style={styles.fontLoadingText}>TurfBook</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primaryDeep}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* PAGE HEADER */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderBadge}>⚽ PLAYER</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Manage your account and bookings
          </Text>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.card}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitial(user.name)}
                </Text>
              </View>

              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>🏆</Text>
              </View>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name || 'User'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email || 'Email not available'}
              </Text>

              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>PLAYER</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user.phone || 'Not added'}</Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowEditProfile(true)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="create-outline"
                size={15}
                color={COLORS.dark}
              />
              <Text style={styles.primaryButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={openPasswordModal}
              activeOpacity={0.85}
            >
              <Ionicons
                name="lock-closed-outline"
                size={15}
                color={COLORS.textPrimary}
              />
              <Text style={styles.secondaryButtonText}>Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BOOKING HISTORY HEADER */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Booking History</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          {bookings.length > 0 && (
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{bookings.length}</Text>
            </View>
          )}
        </View>

        {/* BOOKING LOADING */}
        {fetchingBookings && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primaryDeep} />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : bookings.length === 0 ? (
          /* EMPTY BOOKINGS */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrapper}>
              <Text style={styles.emptyIcon}>🎟️</Text>
            </View>

            <Text style={styles.emptyTitle}>No bookings yet</Text>

            <Text style={styles.emptyText}>
              Your turf bookings will appear here.
            </Text>

            <TouchableOpacity
              style={styles.emptyRefreshButton}
              onPress={fetchBookings}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyRefreshText}>REFRESH</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* BOOKINGS */
          bookings.map((booking) => {
            const statusStyle = getStatusStyle(booking.status);

            return (
              <View key={booking._id} style={styles.bookingCard}>
                {/* BOOKING HEADER */}
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingIconCircle}>
                    <Text style={styles.bookingIcon}>🏟️</Text>
                  </View>

                  <View style={styles.bookingMainInfo}>
                    <Text
                      style={styles.bookingTurf}
                      numberOfLines={1}
                    >
                      {booking.turf?.name || 'Turf'}
                    </Text>

                    <View style={styles.bookingDateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={11}
                        color={COLORS.textMuted}
                      />
                      <Text style={styles.bookingDate}>
                        {formatBookingDate(booking.bookingDate)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[styles.statusPill, statusStyle.container]}
                  >
                    <Text
                      style={[styles.statusPillText, statusStyle.text]}
                    >
                      {getStatusLabel(booking.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingDivider} />

                {/* BOTTOM */}
                <View style={styles.bookingBottom}>
                  <View style={styles.bookingTimeBox}>
                    <Text style={styles.bookingTimeLabel}>TIME</Text>

                    <Text style={styles.bookingTime}>
                      {formatTimeRange(
                        booking.startTime,
                        booking.endTime,
                      )}
                    </Text>
                  </View>

                  <View style={styles.bookingAmountBox}>
                    <Text style={styles.bookingAmountLabel}>
                      AMOUNT
                    </Text>

                    <Text style={styles.amount}>
                      ₹{formatAmount(booking.finalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons
            name="log-out-outline"
            size={16}
            color={COLORS.dangerText}
          />
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!updatingProfile) setShowEditProfile(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalBadge}>👤 PROFILE</Text>

              <Text style={styles.modalTitle}>Edit Profile</Text>

              <Text style={styles.fieldLabel}>NAME</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={COLORS.placeholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!updatingProfile}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>EMAIL</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updatingProfile}
                returnKeyType="next"
              />

              <Text style={styles.fieldLabel}>PHONE</Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor={COLORS.placeholder}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!updatingProfile}
                maxLength={15}
                returnKeyType="done"
              />

              <TouchableOpacity
                style={[
                  styles.greenButton,
                  updatingProfile && styles.disabledButton,
                ]}
                onPress={handleUpdateProfile}
                disabled={updatingProfile}
                activeOpacity={0.85}
              >
                {updatingProfile ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.greenButtonText}>
                    SAVE CHANGES
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditProfile(false)}
                disabled={updatingProfile}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={closePasswordModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalBadge}>🔒 SECURITY</Text>

              <Text style={styles.modalTitle}>Change Password</Text>

              <Text style={styles.fieldLabel}>
                CURRENT PASSWORD
              </Text>

              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter current password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showCurrentPassword}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!changingPassword}
                />

                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() =>
                    setShowCurrentPassword((prev) => !prev)
                  }
                  disabled={changingPassword}
                  hitSlop={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                >
                  <Ionicons
                    name={
                      showCurrentPassword
                        ? 'eye-off-outline'
                        : 'eye-outline'
                    }
                    size={18}
                    color={COLORS.primaryDarker}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>

              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showNewPassword}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!changingPassword}
                />

                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowNewPassword((prev) => !prev)}
                  disabled={changingPassword}
                  hitSlop={{
                    top: 10,
                    bottom: 10,
                    left: 10,
                    right: 10,
                  }}
                >
                  <Ionicons
                    name={
                      showNewPassword
                        ? 'eye-off-outline'
                        : 'eye-outline'
                    }
                    size={18}
                    color={COLORS.primaryDarker}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Minimum 6 characters
              </Text>

              <TouchableOpacity
                style={[
                  styles.greenButton,
                  changingPassword && styles.disabledButton,
                ]}
                onPress={handleChangePassword}
                disabled={changingPassword}
                activeOpacity={0.85}
              >
                {changingPassword ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.greenButtonText}>
                    CHANGE PASSWORD
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closePasswordModal}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default CustomerProfileScreen;

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 60,
  },

  fontLoadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
  },

  fontLoadingMark: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },

  fontLoadingMarkText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 26,
    color: COLORS.dark,
    letterSpacing: -0.5,
  },

  fontLoadingText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 10,
    letterSpacing: 0.3,
  },

  pageHeader: {
    marginBottom: 18,
  },

  pageHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },

  title: {
    fontSize: 26,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },

  pageHeaderSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },

  avatarText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 26,
    color: COLORS.dark,
  },

  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  avatarBadgeText: {
    fontSize: 11,
  },

  profileInfo: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    fontSize: 18,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  email: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textMuted,
    marginTop: 2,
  },

  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },

  rolePillText: {
    color: COLORS.primaryDarker,
    fontSize: 9,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    flex: 1,
  },

  value: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    maxWidth: '65%',
    textAlign: 'right',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },

  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  primaryButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    borderRadius: 12,
    paddingVertical: 12,
  },

  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  sectionTitleAccent: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginLeft: 7,
    marginTop: 2,
  },

  countPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 26,
    alignItems: 'center',
  },

  countPillText: {
    fontSize: 10,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_900Black',
  },

  loadingBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
  },

  emptyCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIcon: {
    fontSize: 26,
  },

  emptyTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  emptyText: {
    color: COLORS.textMuted,
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 17,
  },

  emptyRefreshButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  emptyRefreshText: {
    color: COLORS.dark,
    fontSize: 11,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1,
  },

  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bookingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  bookingIcon: {
    fontSize: 18,
  },

  bookingMainInfo: {
    flex: 1,
    minWidth: 0,
  },

  bookingTurf: {
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  bookingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },

  bookingDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },

  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    marginLeft: 8,
  },

  statusPillText: {
    fontSize: 8,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.8,
  },

  bookingDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 12,
  },

  bookingBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  bookingTimeBox: {
    flex: 1,
    paddingRight: 10,
  },

  bookingTimeLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 3,
  },

  bookingTime: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -0.2,
  },

  bookingAmountBox: {
    alignItems: 'flex-end',
  },

  bookingAmountLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 1,
    marginBottom: 3,
  },

  amount: {
    fontSize: 17,
    fontFamily: 'Poppins_900Black',
    color: COLORS.primaryDarker,
    letterSpacing: -0.2,
  },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 14,
    paddingVertical: 14,
  },

  logoutText: {
    color: COLORS.dangerText,
    fontFamily: 'Poppins_900Black',
    fontSize: 12,
    letterSpacing: 1.2,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
  },

  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 12,
  },

  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 16,
  },

  modalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDarker,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },

  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    marginBottom: 18,
    letterSpacing: -0.2,
  },

  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 7,
    marginTop: 6,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  input: {
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardSoft,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    minHeight: 50,
  },

  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.cardSoft,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    minHeight: 50,
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },

  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  helperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_500Medium',
    marginTop: -2,
    marginBottom: 14,
    letterSpacing: 0.2,
  },

  greenButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 50,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 4,
  },

  greenButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
  },

  disabledButton: {
    opacity: 0.65,
  },

  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },

  cancelText: {
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});