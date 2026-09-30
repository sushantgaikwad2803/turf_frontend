import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE_URL = 'http://192.168.0.100:5000/api';

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
  turf?: { name: string };
  bookingDate: string;
  startTime: string;
  endTime: string;
  finalAmount: number;
  status: 'confirmed' | 'cancelled' | 'pending';
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

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return {
        container: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.borderSoft },
        text: { color: COLORS.primaryDark },
      };
    case 'cancelled':
      return {
        container: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerBorder },
        text: { color: COLORS.dangerText },
      };
    case 'pending':
      return {
        container: { backgroundColor: COLORS.warningSoft, borderColor: '#FDE68A' },
        text: { color: COLORS.warningText },
      };
    default:
      return {
        container: { backgroundColor: COLORS.cardSoft, borderColor: COLORS.border },
        text: { color: COLORS.textMuted },
      };
  }
};

/* =========================================================
   COMPONENT
========================================================= */

export const CustomerProfileScreen: React.FC<CustomerProfileScreenProps> = ({
  user,
  onUpdateUser,
  onLogout,
}) => {
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingBookings, setFetchingBookings] = useState(false);

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    fetchBookings();
  }, [user]);

  /* FETCH BOOKINGS */
  const fetchBookings = async () => {
    try {
      setFetchingBookings(true);
      const response = await fetch(`${API_BASE_URL}/users/${user._id}/bookings`);
      const data = await response.json();
      if (response.ok) {
        setBookings(data.bookings || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setFetchingBookings(false);
    }
  };

  /* UPDATE PROFILE */
  const handleUpdateProfile = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill all fields.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      const updatedUser = data.user || data;
      onUpdateUser?.(updatedUser);
      setShowEditProfile(false);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  /* CHANGE PASSWORD */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please enter both passwords.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must contain at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${user._id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordModal(false);
      Alert.alert('Success', 'Password changed successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  /* LOGOUT */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeText}>🏆</Text>
            </View>
          </View>

          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user.phone || 'Not added'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Account Type</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>PLAYER</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.greenButtonText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowPasswordModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>CHANGE PASSWORD</Text>
          </TouchableOpacity>
        </View>

        {/* BOOKING HISTORY */}
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

        {fetchingBookings ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading bookings...</Text>
          </View>
        ) : bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrapper}>
              <Text style={styles.emptyIcon}>🎟️</Text>
            </View>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>
              Your turf bookings will appear here.
            </Text>
          </View>
        ) : (
          bookings.map((booking) => {
            const statusStyle = getStatusStyle(booking.status);
            return (
              <View key={booking._id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingIconCircle}>
                    <Text style={styles.bookingIcon}>🏟️</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookingTurf} numberOfLines={1}>
                      {booking.turf?.name || 'Turf'}
                    </Text>
                    <View style={styles.bookingDateRow}>
                      <Text style={styles.bookingDateIcon}>📅</Text>
                      <Text style={styles.bookingDate}>
                        {formatBookingDate(booking.bookingDate)}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.statusPill, statusStyle.container]}>
                    <Text style={[styles.statusPillText, statusStyle.text]}>
                      {booking.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                <View style={styles.bookingDivider} />

                <View style={styles.bookingBottom}>
                  <View style={styles.bookingTimeBox}>
                    <Text style={styles.bookingTimeLabel}>TIME</Text>
                    <Text style={styles.bookingTime}>
                      {booking.startTime} — {booking.endTime}
                    </Text>
                  </View>

                  <View style={styles.bookingAmountBox}>
                    <Text style={styles.bookingAmountLabel}>AMOUNT</Text>
                    <Text style={styles.amount}>₹{booking.finalAmount}</Text>
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
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBadge}>👤 PROFILE</Text>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.placeholder}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor={COLORS.placeholder}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <TouchableOpacity
              style={styles.greenButton}
              onPress={handleUpdateProfile}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.greenButtonText}>SAVE CHANGES</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowEditProfile(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalBadge}>🔒 SECURITY</Text>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.fieldLabel}>Current Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter current password"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor={COLORS.placeholder}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <Text style={styles.helperText}>Minimum 6 characters</Text>

            <TouchableOpacity
              style={styles.greenButton}
              onPress={handleChangePassword}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.greenButtonText}>CHANGE PASSWORD</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPasswordModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 20,
    paddingBottom: 60,
  },

  /* PAGE HEADER */
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

  /* PROFILE CARD */
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
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
    shadowOffset: { width: 0, height: 10 },
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

  /* BUTTONS */
  greenButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
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
    marginTop: 12,
  },

  secondaryButtonText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* SECTION */
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

  /* LOADING */
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

  /* EMPTY */
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

  /* BOOKING CARD */
  bookingCard: {
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginLeft: 8,
  },

  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
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

  /* LOGOUT */
  logoutButton: {
    marginTop: 28,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  logoutText: {
    color: COLORS.dangerText,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1.2,
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
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