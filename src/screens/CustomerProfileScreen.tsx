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

/* =========================================================
   API CONFIG
========================================================= */

const RAW_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://192.168.0.100:5000/api';

/**
 * Normalizes the API URL.
 *
 * Examples:
 *
 * turfbackend-production-a87e.up.railway.app/api
 *      ->
 * https://turfbackend-production-a87e.up.railway.app/api
 *
 * https://turfbackend-production-a87e.up.railway.app/api
 *      ->
 * https://turfbackend-production-a87e.up.railway.app/api
 *
 * http://192.168.0.100:5000/api
 *      ->
 * http://192.168.0.100:5000/api
 */
const normalizeApiUrl = (url: string): string => {
  let normalized = String(url || '').trim();

  if (!normalized) {
    normalized = 'http://192.168.0.100:5000/api';
  }

  // Remove accidental quotes
  normalized = normalized.replace(/^["']|["']$/g, '');

  // Add HTTPS when protocol is missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
};

const API_BASE_URL = normalizeApiUrl(RAW_API_URL);

console.log('CustomerProfile API URL:', API_BASE_URL);

/* =========================================================
   THEME COLORS
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
  warningText: '#92400E',

  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
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
  if (!dateString) {
    return 'Date unavailable';
  }

  try {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const formatAmount = (amount: number): string => {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return '0';
  }

  return numericAmount.toLocaleString('en-IN');
};

const getInitial = (name?: string): string => {
  if (!name?.trim()) {
    return 'U';
  }

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
          color: COLORS.primaryDark,
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
          borderColor: '#FDE68A',
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
  if (!status) {
    return 'UNKNOWN';
  }

  return status.toUpperCase();
};

/* =========================================================
   SAFE API RESPONSE
========================================================= */

const getResponseData = async (response: Response): Promise<any> => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {
        message: 'Server returned invalid JSON.',
      };
    }
  }

  const text = await response.text();

  return {
    message: text || 'Unexpected server response.',
  };
};

/* =========================================================
   COMPONENT
========================================================= */

const CustomerProfileScreen: React.FC<
  CustomerProfileScreenProps
> = ({ user, onUpdateUser, onLogout }) => {
  /* =======================================================
     PROFILE STATE
  ======================================================= */

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');

  /* =======================================================
     PASSWORD STATE
  ======================================================= */

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  /* =======================================================
     BOOKING STATE
  ======================================================= */

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /* =======================================================
     LOADING STATES
  ======================================================= */

  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* =======================================================
     SYNC USER DATA
  ======================================================= */

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [user]);

  /* =======================================================
     FETCH BOOKINGS
  ======================================================= */

  const fetchBookings = useCallback(async () => {
    if (!user?._id) {
      console.warn(
        'Cannot fetch bookings: user ID is missing.',
      );
      return;
    }

    const bookingUrl =
      `${API_BASE_URL}/users/${encodeURIComponent(
        user._id,
      )}/bookings`;

    console.log('Fetching customer bookings:', bookingUrl);

    try {
      setFetchingBookings(true);

      const response = await fetch(bookingUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await getResponseData(response);

      console.log(
        'Booking API status:',
        response.status,
      );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Failed to fetch bookings. HTTP ${response.status}`,
        );
      }

      /*
       * Backend can return either:
       *
       * [
       *   {...},
       *   {...}
       * ]
       *
       * OR:
       *
       * {
       *   bookings: [...]
       * }
       */

      const bookingData: Booking[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.bookings)
          ? data.bookings
          : [];

      setBookings(bookingData);
    } catch (error: any) {
      console.error(
        'Fetch bookings error:',
        error,
      );

      setBookings([]);

      /*
       * We intentionally do not show an Alert here.
       * A temporary network error should not interrupt
       * the profile screen.
       */
    } finally {
      setFetchingBookings(false);
    }
  }, [user?._id]);

  /* =======================================================
     INITIAL BOOKING LOAD
  ======================================================= */

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  /* =======================================================
     PULL TO REFRESH
  ======================================================= */

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchBookings();
    } finally {
      setRefreshing(false);
    }
  }, [fetchBookings]);

  /* =======================================================
     VALIDATE PROFILE
  ======================================================= */

  const validateProfile = (): boolean => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (
      !trimmedName ||
      !trimmedEmail ||
      !trimmedPhone
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill in your name, email and phone number.',
      );

      return false;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.',
      );

      return false;
    }

    const phoneDigits =
      trimmedPhone.replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      Alert.alert(
        'Invalid Phone',
        'Please enter a valid phone number.',
      );

      return false;
    }

    return true;
  };

  /* =======================================================
     UPDATE PROFILE
  ======================================================= */

  const handleUpdateProfile = async () => {
    if (!validateProfile()) {
      return;
    }

    if (!user?._id) {
      Alert.alert(
        'Error',
        'User information is missing.',
      );

      return;
    }

    const updateUrl =
      `${API_BASE_URL}/users/${encodeURIComponent(
        user._id,
      )}`;

    console.log('Updating profile:', updateUrl);

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

      const updatedUser: CustomerUser =
        data?.user || data;

      onUpdateUser?.({
        ...user,
        ...updatedUser,
        role: 'customer',
      });

      setShowEditProfile(false);

      Alert.alert(
        'Success',
        'Your profile has been updated successfully.',
      );
    } catch (error: any) {
      console.error(
        'Update profile error:',
        error,
      );

      Alert.alert(
        'Update Failed',
        error?.message ||
          'Unable to update your profile. Please try again.',
      );
    } finally {
      setUpdatingProfile(false);
    }
  };

  /* =======================================================
     VALIDATE PASSWORD
  ======================================================= */

  const validatePassword = (): boolean => {
    if (!currentPassword.trim()) {
      Alert.alert(
        'Missing Password',
        'Please enter your current password.',
      );

      return false;
    }

    if (!newPassword.trim()) {
      Alert.alert(
        'Missing Password',
        'Please enter your new password.',
      );

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

  /* =======================================================
     CHANGE PASSWORD
  ======================================================= */

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      return;
    }

    if (!user?._id) {
      Alert.alert(
        'Error',
        'User information is missing.',
      );

      return;
    }

    const passwordUrl =
      `${API_BASE_URL}/users/${encodeURIComponent(
        user._id,
      )}/password`;

    console.log(
      'Changing password:',
      passwordUrl,
    );

    try {
      setChangingPassword(true);

      const response = await fetch(passwordUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
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

      Alert.alert(
        'Success',
        'Your password has been changed successfully.',
      );
    } catch (error: any) {
      console.error(
        'Change password error:',
        error,
      );

      Alert.alert(
        'Password Change Failed',
        error?.message ||
          'Unable to change your password. Please try again.',
      );
    } finally {
      setChangingPassword(false);
    }
  };

  /* =======================================================
     OPEN PASSWORD MODAL
  ======================================================= */

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');

    setShowCurrentPassword(false);
    setShowNewPassword(false);

    setShowPasswordModal(true);
  };

  /* =======================================================
     CLOSE PASSWORD MODAL
  ======================================================= */

  const closePasswordModal = () => {
    if (changingPassword) {
      return;
    }

    setCurrentPassword('');
    setNewPassword('');

    setShowCurrentPassword(false);
    setShowNewPassword(false);

    setShowPasswordModal(false);
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            onLogout?.();
          },
        },
      ],
      {
        cancelable: true,
      },
    );
  };

  /* =======================================================
     RENDER
  ======================================================= */

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
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderBadge}>
            ⚽ PLAYER
          </Text>

          <Text style={styles.title}>
            Profile
          </Text>

          <Text style={styles.pageHeaderSubtitle}>
            Manage your account and bookings
          </Text>
        </View>

        {/* =================================================
            PROFILE CARD
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {getInitial(user.name)}
              </Text>
            </View>

            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>
                🏆
              </Text>
            </View>
          </View>

          <Text style={styles.name}>
            {user.name || 'User'}
          </Text>

          <Text style={styles.email}>
            {user.email || 'Email not available'}
          </Text>

          {/* PHONE */}

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Phone
            </Text>

            <Text style={styles.value}>
              {user.phone || 'Not added'}
            </Text>
          </View>

          {/* ACCOUNT TYPE */}

          <View style={styles.infoRow}>
            <Text style={styles.label}>
              Account Type
            </Text>

            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>
                PLAYER
              </Text>
            </View>
          </View>

          {/* EDIT PROFILE */}

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() =>
              setShowEditProfile(true)
            }
            activeOpacity={0.85}
          >
            <Text style={styles.greenButtonText}>
              EDIT PROFILE
            </Text>
          </TouchableOpacity>

          {/* CHANGE PASSWORD */}

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={openPasswordModal}
            activeOpacity={0.85}
          >
            <Text
              style={styles.secondaryButtonText}
            >
              CHANGE PASSWORD
            </Text>
          </TouchableOpacity>
        </View>

        {/* =================================================
            BOOKING HISTORY HEADER
        ================================================= */}

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>
              Booking History
            </Text>

            <View
              style={styles.sectionTitleAccent}
            />
          </View>

          {bookings.length > 0 && (
            <View style={styles.countPill}>
              <Text
                style={styles.countPillText}
              >
                {bookings.length}
              </Text>
            </View>
          )}
        </View>

        {/* =================================================
            BOOKING LOADING
        ================================================= */}

        {fetchingBookings && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              size="small"
              color={COLORS.primary}
            />

            <Text style={styles.loadingText}>
              Loading bookings...
            </Text>
          </View>
        ) : bookings.length === 0 ? (
          /* =================================================
             EMPTY BOOKINGS
          ================================================= */

          <View style={styles.emptyCard}>
            <View
              style={styles.emptyIconWrapper}
            >
              <Text style={styles.emptyIcon}>
                🎟️
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No bookings yet
            </Text>

            <Text style={styles.emptyText}>
              Your turf bookings will appear here.
            </Text>

            <TouchableOpacity
              style={
                styles.emptyRefreshButton
              }
              onPress={fetchBookings}
              activeOpacity={0.8}
            >
              <Text
                style={styles.emptyRefreshText}
              >
                REFRESH
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* =================================================
             BOOKINGS
          ================================================= */

          bookings.map((booking) => {
            const statusStyle =
              getStatusStyle(
                booking.status,
              );

            return (
              <View
                key={booking._id}
                style={styles.bookingCard}
              >
                {/* BOOKING HEADER */}

                <View
                  style={styles.bookingHeader}
                >
                  <View
                    style={
                      styles.bookingIconCircle
                    }
                  >
                    <Text
                      style={styles.bookingIcon}
                    >
                      🏟️
                    </Text>
                  </View>

                  <View
                    style={
                      styles.bookingMainInfo
                    }
                  >
                    <Text
                      style={
                        styles.bookingTurf
                      }
                      numberOfLines={1}
                    >
                      {booking.turf?.name ||
                        'Turf'}
                    </Text>

                    <View
                      style={
                        styles.bookingDateRow
                      }
                    >
                      <Text
                        style={
                          styles.bookingDateIcon
                        }
                      >
                        📅
                      </Text>

                      <Text
                        style={
                          styles.bookingDate
                        }
                      >
                        {formatBookingDate(
                          booking.bookingDate,
                        )}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      statusStyle.container,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        statusStyle.text,
                      ]}
                    >
                      {getStatusLabel(
                        booking.status,
                      )}
                    </Text>
                  </View>
                </View>

                {/* DIVIDER */}

                <View
                  style={styles.bookingDivider}
                />

                {/* BOTTOM */}

                <View
                  style={styles.bookingBottom}
                >
                  <View
                    style={styles.bookingTimeBox}
                  >
                    <Text
                      style={
                        styles.bookingTimeLabel
                      }
                    >
                      TIME
                    </Text>

                    <Text
                      style={styles.bookingTime}
                    >
                      {booking.startTime ||
                        '--'}{' '}
                      —{' '}
                      {booking.endTime ||
                        '--'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.bookingAmountBox
                    }
                  >
                    <Text
                      style={
                        styles.bookingAmountLabel
                      }
                    >
                      AMOUNT
                    </Text>

                    <Text
                      style={styles.amount}
                    >
                      ₹
                      {formatAmount(
                        booking.finalAmount,
                      )}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        {/* =================================================
            LOGOUT
        ================================================= */}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Text style={styles.logoutText}>
            LOGOUT
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ===================================================
          EDIT PROFILE MODAL
      =================================================== */}

      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!updatingProfile) {
            setShowEditProfile(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScrollContent
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalBadge}>
                👤 PROFILE
              </Text>

              <Text style={styles.modalTitle}>
                Edit Profile
              </Text>

              {/* NAME */}

              <Text style={styles.fieldLabel}>
                Name
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor={
                  COLORS.placeholder
                }
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!updatingProfile}
                returnKeyType="next"
              />

              {/* EMAIL */}

              <Text style={styles.fieldLabel}>
                Email
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={
                  COLORS.placeholder
                }
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!updatingProfile}
                returnKeyType="next"
              />

              {/* PHONE */}

              <Text style={styles.fieldLabel}>
                Phone
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor={
                  COLORS.placeholder
                }
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                editable={!updatingProfile}
                maxLength={15}
                returnKeyType="done"
              />

              {/* SAVE */}

              <TouchableOpacity
                style={[
                  styles.greenButton,
                  updatingProfile &&
                    styles.disabledButton,
                ]}
                onPress={
                  handleUpdateProfile
                }
                disabled={updatingProfile}
                activeOpacity={0.85}
              >
                {updatingProfile ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.greenButtonText
                    }
                  >
                    SAVE CHANGES
                  </Text>
                )}
              </TouchableOpacity>

              {/* CANCEL */}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() =>
                  setShowEditProfile(false)
                }
                disabled={updatingProfile}
                activeOpacity={0.8}
              >
                <Text
                  style={styles.cancelText}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===================================================
          CHANGE PASSWORD MODAL
      =================================================== */}

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={
          closePasswordModal
        }
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScrollContent
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalBadge}>
                🔒 SECURITY
              </Text>

              <Text style={styles.modalTitle}>
                Change Password
              </Text>

              {/* CURRENT PASSWORD */}

              <Text style={styles.fieldLabel}>
                Current Password
              </Text>

              <View
                style={
                  styles.passwordInputWrapper
                }
              >
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter current password"
                  placeholderTextColor={
                    COLORS.placeholder
                  }
                  secureTextEntry={
                    !showCurrentPassword
                  }
                  value={currentPassword}
                  onChangeText={
                    setCurrentPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!changingPassword}
                />

                <TouchableOpacity
                  style={
                    styles.passwordToggle
                  }
                  onPress={() =>
                    setShowCurrentPassword(
                      (previous) =>
                        !previous,
                    )
                  }
                  disabled={changingPassword}
                >
                  <Text
                    style={
                      styles.passwordToggleText
                    }
                  >
                    {showCurrentPassword
                      ? 'HIDE'
                      : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* NEW PASSWORD */}

              <Text style={styles.fieldLabel}>
                New Password
              </Text>

              <View
                style={
                  styles.passwordInputWrapper
                }
              >
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter new password"
                  placeholderTextColor={
                    COLORS.placeholder
                  }
                  secureTextEntry={
                    !showNewPassword
                  }
                  value={newPassword}
                  onChangeText={setNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!changingPassword}
                />

                <TouchableOpacity
                  style={
                    styles.passwordToggle
                  }
                  onPress={() =>
                    setShowNewPassword(
                      (previous) =>
                        !previous,
                    )
                  }
                  disabled={changingPassword}
                >
                  <Text
                    style={
                      styles.passwordToggleText
                    }
                  >
                    {showNewPassword
                      ? 'HIDE'
                      : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.helperText}>
                Minimum 6 characters
              </Text>

              {/* CHANGE PASSWORD */}

              <TouchableOpacity
                style={[
                  styles.greenButton,
                  changingPassword &&
                    styles.disabledButton,
                ]}
                onPress={
                  handleChangePassword
                }
                disabled={changingPassword}
                activeOpacity={0.85}
              >
                {changingPassword ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.greenButtonText
                    }
                  >
                    CHANGE PASSWORD
                  </Text>
                )}
              </TouchableOpacity>

              {/* CANCEL */}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closePasswordModal}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                <Text
                  style={styles.cancelText}
                >
                  Cancel
                </Text>
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
  /* =======================================================
     SAFE AREA
  ======================================================= */

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    padding: 20,
    paddingBottom: 60,
  },

  /* =======================================================
     PAGE HEADER
  ======================================================= */

  pageHeader: {
    marginBottom: 22,
  },

  pageHeaderBadge: {
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
    marginBottom: 12,
    overflow: 'hidden',
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  pageHeaderSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  /* =======================================================
     PROFILE CARD
  ======================================================= */

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 8,
    },

    shadowOpacity: 0.05,
    shadowRadius: 16,

    elevation: 3,
  },

  avatarWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary,

    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: COLORS.primary,

    shadowOffset: {
      width: 0,
      height: 10,
    },

    shadowOpacity: 0.3,
    shadowRadius: 16,

    elevation: 8,
  },

  avatarText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
  },

  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,

    width: 32,
    height: 32,
    borderRadius: 16,

    backgroundColor: COLORS.accent,

    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 3,
    borderColor: COLORS.white,
  },

  avatarBadgeText: {
    fontSize: 13,
  },

  name: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  email: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 22,
    fontWeight: '500',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingVertical: 14,

    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  label: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  value: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',

    maxWidth: '60%',

    textAlign: 'right',
  },

  rolePill: {
    backgroundColor: COLORS.primarySoft,

    borderWidth: 1.5,
    borderColor: COLORS.borderLight,

    paddingHorizontal: 12,
    paddingVertical: 5,

    borderRadius: 14,
  },

  rolePillText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* =======================================================
     BUTTONS
  ======================================================= */

  greenButton: {
    backgroundColor: COLORS.primary,

    borderRadius: 14,

    paddingVertical: 16,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 18,

    shadowColor: COLORS.primary,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.25,
    shadowRadius: 10,

    elevation: 4,
  },

  greenButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,

    backgroundColor: COLORS.primarySoft,

    borderRadius: 14,

    paddingVertical: 15,

    alignItems: 'center',
    justifyContent: 'center',

    marginTop: 12,
  },

  secondaryButtonText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  disabledButton: {
    opacity: 0.65,
  },

  /* =======================================================
     SECTION
  ======================================================= */

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 20,
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

  countPill: {
    backgroundColor: COLORS.primarySoft,

    borderWidth: 1.5,
    borderColor: COLORS.borderLight,

    paddingHorizontal: 12,
    paddingVertical: 5,

    borderRadius: 14,

    minWidth: 28,

    alignItems: 'center',
  },

  countPillText: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: '900',
  },

  /* =======================================================
     LOADING
  ======================================================= */

  loadingBox: {
    backgroundColor: COLORS.primarySoft,

    borderRadius: 18,

    padding: 28,

    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  loadingText: {
    color: COLORS.textSecondary,

    marginTop: 12,

    fontSize: 12,

    fontWeight: '600',

    letterSpacing: 0.3,
  },

  /* =======================================================
     EMPTY BOOKINGS
  ======================================================= */

  emptyCard: {
    backgroundColor: COLORS.primarySoft,

    borderRadius: 22,

    padding: 30,

    alignItems: 'center',

    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIconWrapper: {
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
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  emptyText: {
    color: COLORS.textMuted,

    marginTop: 8,

    fontSize: 12,

    textAlign: 'center',

    lineHeight: 18,
  },

  emptyRefreshButton: {
    marginTop: 18,

    paddingHorizontal: 18,
    paddingVertical: 10,

    borderRadius: 12,

    backgroundColor: COLORS.white,

    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyRefreshText: {
    color: COLORS.primaryDark,

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 1,
  },

  /* =======================================================
     BOOKING CARD
  ======================================================= */

  bookingCard: {
    backgroundColor: COLORS.card,

    borderRadius: 20,

    padding: 18,

    marginBottom: 14,

    borderWidth: 1,
    borderColor: COLORS.border,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.05,

    shadowRadius: 12,

    elevation: 2,
  },

  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bookingIconCircle: {
    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1,
    borderColor: COLORS.borderLight,

    alignItems: 'center',
    justifyContent: 'center',

    marginRight: 14,
  },

  bookingIcon: {
    fontSize: 22,
  },

  bookingMainInfo: {
    flex: 1,
    minWidth: 0,
  },

  bookingTurf: {
    fontSize: 17,

    fontWeight: '900',

    color: COLORS.textPrimary,

    letterSpacing: 0.2,
  },

  bookingDateRow: {
    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 6,
  },

  bookingDateIcon: {
    fontSize: 11,

    marginRight: 5,
  },

  bookingDate: {
    color: COLORS.textSecondary,

    fontSize: 12,

    fontWeight: '600',
  },

  statusPill: {
    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 14,

    borderWidth: 1,

    marginLeft: 8,

    maxWidth: 100,
  },

  statusPillText: {
    fontSize: 8,

    fontWeight: '900',

    letterSpacing: 0.8,
  },

  bookingDivider: {
    height: 1,

    backgroundColor: COLORS.borderLight,

    marginVertical: 16,
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

    fontWeight: '800',

    letterSpacing: 1,

    marginBottom: 4,
  },

  bookingTime: {
    color: COLORS.textPrimary,

    fontSize: 13,

    fontWeight: '700',
  },

  bookingAmountBox: {
    alignItems: 'flex-end',
  },

  bookingAmountLabel: {
    fontSize: 9,

    color: COLORS.textMuted,

    fontWeight: '800',

    letterSpacing: 1,

    marginBottom: 4,
  },

  amount: {
    fontSize: 20,

    fontWeight: '900',

    color: COLORS.primaryDark,

    letterSpacing: 0.2,
  },

  /* =======================================================
     LOGOUT
  ======================================================= */

  logoutButton: {
    marginTop: 28,

    borderWidth: 1.5,

    borderColor: COLORS.dangerBorder,

    backgroundColor: COLORS.dangerSoft,

    borderRadius: 14,

    paddingVertical: 16,

    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutText: {
    color: COLORS.dangerText,

    fontWeight: '900',

    fontSize: 13,

    letterSpacing: 1.2,
  },

  /* =======================================================
     MODAL
  ======================================================= */

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

    padding: 24,

    borderWidth: 1,

    borderColor: COLORS.borderLight,
  },

  modalBadge: {
    alignSelf: 'flex-start',

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1.5,

    borderColor: COLORS.borderLight,

    color: COLORS.primaryDark,

    fontSize: 9,

    fontWeight: '900',

    letterSpacing: 1.5,

    paddingHorizontal: 12,

    paddingVertical: 5,

    borderRadius: 20,

    marginBottom: 12,

    overflow: 'hidden',
  },

  modalTitle: {
    fontSize: 22,

    fontWeight: '900',

    color: COLORS.textPrimary,

    marginBottom: 20,

    letterSpacing: 0.2,
  },

  fieldLabel: {
    fontSize: 11,

    fontWeight: '800',

    color: COLORS.primaryDark,

    marginBottom: 8,

    letterSpacing: 1,

    textTransform: 'uppercase',
  },

  input: {
    borderWidth: 1.5,

    borderColor: COLORS.borderLight,

    backgroundColor: COLORS.primarySoft,

    borderRadius: 14,

    paddingHorizontal: 16,

    paddingVertical: 14,

    marginBottom: 16,

    color: COLORS.textPrimary,

    fontSize: 14,

    fontWeight: '500',
  },

  /* =======================================================
     PASSWORD INPUT
  ======================================================= */

  passwordInputWrapper: {
    flexDirection: 'row',

    alignItems: 'center',

    borderWidth: 1.5,

    borderColor: COLORS.borderLight,

    backgroundColor: COLORS.primarySoft,

    borderRadius: 14,

    marginBottom: 16,

    overflow: 'hidden',
  },

  passwordInput: {
    flex: 1,

    paddingHorizontal: 16,

    paddingVertical: 14,

    color: COLORS.textPrimary,

    fontSize: 14,

    fontWeight: '500',
  },

  passwordToggle: {
    paddingHorizontal: 12,

    paddingVertical: 12,
  },

  passwordToggleText: {
    color: COLORS.primaryDark,

    fontSize: 9,

    fontWeight: '900',

    letterSpacing: 0.8,
  },

  helperText: {
    fontSize: 11,

    color: COLORS.textMuted,

    marginTop: -8,

    marginBottom: 16,

    letterSpacing: 0.3,
  },

  cancelButton: {
    paddingVertical: 15,

    alignItems: 'center',

    marginTop: 8,
  },

  cancelText: {
    color: COLORS.textMuted,

    fontWeight: '800',

    fontSize: 13,

    letterSpacing: 0.5,
  },
});
