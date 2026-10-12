import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
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
   API CONFIGURATION
========================================================= */

const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL;

/**
 * Normalizes the API URL.
 *
 * Accepts:
 * https://example.com/api
 * example.com/api
 * https://example.com
 *
 * Returns:
 * https://example.com/api
 */
const normalizeApiUrl = (url?: string): string => {
  if (!url || !url.trim()) {
    return '';
  }

  let normalized = url.trim();

  // Remove trailing slashes
  normalized = normalized.replace(/\/+$/, '');

  // Add HTTPS if protocol is missing
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  // Remove duplicate /api if user accidentally configured it twice
  normalized = normalized.replace(/\/api\/api$/i, '/api');

  return normalized;
};

const API_BASE_URL = normalizeApiUrl(RAW_API_URL);

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

type TurfStatus =
  | 'active'
  | 'inactive'
  | 'maintenance';

type Props =
  NativeStackScreenProps<
    RootStackParamList,
    'AdminDashboard'
  > & {
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

interface AdminBankDetails {
  _id?: string;
  accountType?: 'admin';
  owner?: string | null;
  gatewayAccountId?: string;
  accountHolderName: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  branchName?: string;
  isVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* =========================================================
   HELPERS
========================================================= */

const formatCurrency = (value: number): string => {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
};

const formatDate = (value?: string): string => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Safely parse JSON.
 * Sometimes Railway/proxy/server errors return HTML/text instead of JSON.
 */
const parseResponse = async (
  response: Response,
): Promise<any> => {
  const contentType =
    response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return {
      error:
        text ||
        `Server returned ${response.status}`,
    };
  }
};

/**
 * Creates a readable network error.
 */
const getNetworkErrorMessage = (
  error: unknown,
): string => {
  if (error instanceof TypeError) {
    return (
      'Unable to connect to the backend.\n\n' +
      'Please check:\n' +
      '• Railway backend is running\n' +
      '• EXPO_PUBLIC_API_URL contains https://\n' +
      '• The API endpoint is correct\n' +
      '• Your device has internet access'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to connect to the backend.';
};

/* =========================================================
   COMPONENT
========================================================= */

const AdminDashboardScreen: React.FC<Props> = ({
  user,
  onLogout,
}) => {
  const [dashboard, setDashboard] =
    useState<AdminDashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [updatingTurfId, setUpdatingTurfId] =
    useState<string | null>(null);

  /* =========================================================
     ADMIN BANK DETAILS
  ========================================================= */

  const [adminBank, setAdminBank] =
    useState<AdminBankDetails | null>(null);

  const [bankModalVisible, setBankModalVisible] =
    useState(false);

  const [bankLoading, setBankLoading] =
    useState(false);

  const [bankSaving, setBankSaving] =
    useState(false);

  const [bankDeleting, setBankDeleting] =
    useState(false);

  const [bankError, setBankError] =
    useState<string | null>(null);

  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    gatewayAccountId: '',
  });

  /* =========================================================
     FETCH DASHBOARD
  ========================================================= */

  const fetchDashboard = useCallback(
    async (
      showLoader = true,
    ): Promise<void> => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        setError(null);

        /* -----------------------------------------
           Validate API URL
        ----------------------------------------- */

        if (!API_BASE_URL) {
          throw new Error(
            'Backend API URL is not configured.\n\n' +
            'Set this in your .env file:\n\n' +
            'EXPO_PUBLIC_API_URL=https://your-backend.up.railway.app/api',
          );
        }

        /* -----------------------------------------
           Validate user
        ----------------------------------------- */

        if (!user?._id) {
          throw new Error(
            'Admin user ID is missing.',
          );
        }

        /* -----------------------------------------
           Build URL
        ----------------------------------------- */

        const endpoint =
          `${API_BASE_URL}/admin/dashboard` +
          `?adminId=${encodeURIComponent(user._id)}`;

        console.log(
          '[AdminDashboard] API:',
          endpoint,
        );

        /* -----------------------------------------
           Request
        ----------------------------------------- */

        const response = await fetch(
          endpoint,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        );

        /* -----------------------------------------
           Parse response
        ----------------------------------------- */

        const data =
          await parseResponse(response);

        console.log(
          '[AdminDashboard] Status:',
          response.status,
        );

        /* -----------------------------------------
           HTTP error
        ----------------------------------------- */

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            `Server error: ${response.status}`,
          );
        }

        /* -----------------------------------------
           API error
        ----------------------------------------- */

        if (!data?.success) {
          throw new Error(
            data?.error ||
            data?.message ||
            'Failed to load admin dashboard.',
          );
        }

        /* -----------------------------------------
           Save dashboard
        ----------------------------------------- */

        setDashboard(data);
      } catch (requestError) {
        console.error(
          '[AdminDashboard] Fetch error:',
          requestError,
        );

        setError(
          getNetworkErrorMessage(
            requestError,
          ),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?._id],
  );

  /* =========================================================
     ADMIN BANK DETAILS - FETCH
  ========================================================= */

  const fetchAdminBankDetails = useCallback(
    async (showLoader = false): Promise<void> => {
      try {
        if (!API_BASE_URL || !user?._id) {
          return;
        }

        if (showLoader) {
          setBankLoading(true);
        }

        setBankError(null);

        const endpoint =
          `${API_BASE_URL}/admin/bank-details` +
          `?adminId=${encodeURIComponent(user._id)}`;

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });

        const data = await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            `Server error: ${response.status}`,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
            data?.message ||
            'Failed to load admin bank details.',
          );
        }

        setAdminBank(data?.bankDetails || null);
      } catch (requestError) {
        console.error(
          '[AdminDashboard] Admin bank fetch error:',
          requestError,
        );

        setBankError(
          getNetworkErrorMessage(requestError),
        );
      } finally {
        setBankLoading(false);
      }
    },
    [user?._id],
  );

  /* =========================================================
     ADMIN BANK DETAILS - OPEN ADD/EDIT
  ========================================================= */

  const openBankModal = useCallback(() => {
    setBankError(null);

    setBankForm({
      accountHolderName:
        adminBank?.accountHolderName || '',
      accountNumber:
        adminBank?.accountNumber || '',
      ifscCode:
        adminBank?.ifscCode || '',
      bankName:
        adminBank?.bankName || '',
      branchName:
        adminBank?.branchName || '',
      gatewayAccountId:
        adminBank?.gatewayAccountId || '',
    });

    setBankModalVisible(true);
  }, [adminBank]);

  /* =========================================================
     ADMIN BANK DETAILS - SAVE
  ========================================================= */

  const saveAdminBankDetails = useCallback(
    async (): Promise<void> => {
      try {
        if (!API_BASE_URL) {
          Alert.alert(
            'Configuration Error',
            'Backend API URL is missing.',
          );
          return;
        }

        if (!user?._id) {
          Alert.alert(
            'Error',
            'Admin user ID is missing.',
          );
          return;
        }

        const holder =
          bankForm.accountHolderName.trim();

        const account =
          bankForm.accountNumber
            .trim()
            .replace(/\s+/g, '');

        const ifsc =
          bankForm.ifscCode
            .trim()
            .toUpperCase();

        const bankName =
          bankForm.bankName.trim();

        const branchName =
          bankForm.branchName.trim();

        const gatewayAccountId =
          bankForm.gatewayAccountId.trim();

        if (holder.length < 2) {
          Alert.alert(
            'Invalid Account Holder',
            'Please enter the account holder name.',
          );
          return;
        }

        if (!/^\d{6,30}$/.test(account)) {
          Alert.alert(
            'Invalid Account Number',
            'Account number must contain 6 to 30 digits.',
          );
          return;
        }

        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
          Alert.alert(
            'Invalid IFSC',
            'Please enter a valid Indian IFSC code.',
          );
          return;
        }

        setBankSaving(true);
        setBankError(null);

        const endpoint =
          `${API_BASE_URL}/admin/bank-details`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId: user._id,
            accountHolderName: holder,
            accountNumber: account,
            ifscCode: ifsc,
            bankName: bankName || undefined,
            branchName: branchName || undefined,
            gatewayAccountId:
              gatewayAccountId || undefined,
          }),
        });

        const data = await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            `Server error: ${response.status}`,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
            data?.message ||
            'Failed to save admin bank details.',
          );
        }

        setAdminBank(
          data?.bankDetails || null,
        );

        setBankModalVisible(false);

        Alert.alert(
          'Bank Details Saved',
          data?.message ||
            'Admin bank details have been saved successfully.',
        );
      } catch (requestError) {
        console.error(
          '[AdminDashboard] Admin bank save error:',
          requestError,
        );

        const message =
          getNetworkErrorMessage(requestError);

        setBankError(message);

        Alert.alert(
          'Save Failed',
          message,
        );
      } finally {
        setBankSaving(false);
      }
    },
    [bankForm, user?._id],
  );

  /* =========================================================
     ADMIN BANK DETAILS - DELETE
  ========================================================= */

  const deleteAdminBankDetails = useCallback(() => {
    if (!adminBank) {
      return;
    }

    Alert.alert(
      'Delete Bank Details',
      'This will remove the admin settlement bank account from TurfBook. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!API_BASE_URL || !user?._id) {
                Alert.alert(
                  'Error',
                  'Backend API URL or admin ID is missing.',
                );
                return;
              }

              setBankDeleting(true);

              const endpoint =
                `${API_BASE_URL}/admin/bank-details` +
                `?adminId=${encodeURIComponent(user._id)}`;

              const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              });

              const data =
                await parseResponse(response);

              if (!response.ok) {
                throw new Error(
                  data?.error ||
                  data?.message ||
                  `Server error: ${response.status}`,
                );
              }

              if (!data?.success) {
                throw new Error(
                  data?.error ||
                  data?.message ||
                  'Failed to delete admin bank details.',
                );
              }

              setAdminBank(null);

              Alert.alert(
                'Deleted',
                data?.message ||
                  'Admin bank details deleted successfully.',
              );
            } catch (requestError) {
              console.error(
                '[AdminDashboard] Admin bank delete error:',
                requestError,
              );

              Alert.alert(
                'Delete Failed',
                getNetworkErrorMessage(
                  requestError,
                ),
              );
            } finally {
              setBankDeleting(false);
            }
          },
        },
      ],
    );
  }, [adminBank, user?._id]);

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    fetchDashboard();
    fetchAdminBankDetails();
  }, [
    fetchDashboard,
    fetchAdminBankDetails,
  ]);

  /* =========================================================
     REFRESH
  ========================================================= */

  const handleRefresh = useCallback(() => {
    if (refreshing) {
      return;
    }

    setRefreshing(true);

    fetchDashboard(false);
  }, [
    fetchDashboard,
    refreshing,
  ]);

  /* =========================================================
     UPDATE TURF STATUS
  ========================================================= */

  const updateTurfStatus = useCallback(
    async (
      turfId: string,
      status: TurfStatus,
    ): Promise<void> => {
      try {
        if (!API_BASE_URL) {
          Alert.alert(
            'Configuration Error',
            'Backend API URL is missing.',
          );

          return;
        }

        if (!user?._id) {
          Alert.alert(
            'Error',
            'Admin user ID is missing.',
          );

          return;
        }

        if (!turfId) {
          Alert.alert(
            'Error',
            'Turf ID is missing.',
          );

          return;
        }

        setUpdatingTurfId(turfId);

        const endpoint =
          `${API_BASE_URL}/admin/turfs/` +
          `${encodeURIComponent(turfId)}/status`;

        console.log(
          '[AdminDashboard] Updating turf:',
          endpoint,
        );

        const response = await fetch(
          endpoint,
          {
            method: 'PUT',

            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              adminId: user._id,
              status,
            }),
          },
        );

        const data =
          await parseResponse(response);

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            'Failed to update turf status.',
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
            data?.message ||
            'Failed to update turf status.',
          );
        }

        let title = 'Turf Updated';

        if (status === 'active') {
          title = 'Turf Activated';
        } else if (status === 'inactive') {
          title = 'Turf Deactivated';
        } else if (status === 'maintenance') {
          title = 'Turf Under Maintenance';
        }

        Alert.alert(
          title,
          data?.message ||
            'Turf status updated successfully.',
        );

        await fetchDashboard(false);
      } catch (requestError) {
        console.error(
          '[AdminDashboard] Turf update error:',
          requestError,
        );

        Alert.alert(
          'Update Failed',
          getNetworkErrorMessage(
            requestError,
          ),
        );
      } finally {
        setUpdatingTurfId(null);
      }
    },
    [
      user?._id,
      fetchDashboard,
    ],
  );

  /* =========================================================
     ACTIVATE TURF
  ========================================================= */

  const handleActivateTurf = useCallback(
    (
      turfId: string,
      turfName: string,
    ) => {
      Alert.alert(
        'Activate Turf',

        `Are you sure you want to activate "${turfName}"?\n\n` +
          'Once activated, this turf will become visible to customers on the Home screen.',

        [
          {
            text: 'Cancel',
            style: 'cancel',
          },

          {
            text: 'Activate',
            onPress: () =>
              updateTurfStatus(
                turfId,
                'active',
              ),
          },
        ],
      );
    },
    [updateTurfStatus],
  );

  /* =========================================================
     DEACTIVATE TURF
  ========================================================= */

  const handleDeactivateTurf =
    useCallback(
      (
        turfId: string,
        turfName: string,
      ) => {
        Alert.alert(
          'Deactivate Turf',

          `Are you sure you want to deactivate "${turfName}"?\n\n` +
            'This turf will no longer be visible to customers.',

          [
            {
              text: 'Cancel',
              style: 'cancel',
            },

            {
              text: 'Deactivate',

              style: 'destructive',

              onPress: () =>
                updateTurfStatus(
                  turfId,
                  'inactive',
                ),
            },
          ],
        );
      },
      [updateTurfStatus],
    );

  /* =========================================================
     MAINTENANCE
  ========================================================= */

  const handleMaintenanceTurf =
    useCallback(
      (
        turfId: string,
        turfName: string,
      ) => {
        Alert.alert(
          'Move to Maintenance',

          `Are you sure you want to move "${turfName}" to maintenance?\n\n` +
            'Customers will not see this turf while it is not active.',

          [
            {
              text: 'Cancel',
              style: 'cancel',
            },

            {
              text: 'Maintenance',

              onPress: () =>
                updateTurfStatus(
                  turfId,
                  'maintenance',
                ),
            },
          ],
        );
      },
      [updateTurfStatus],
    );

  /* =========================================================
     LOGOUT
  ========================================================= */

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
          onPress: onLogout,
        },
      ],
    );
  };

  /* =========================================================
     MANAGEMENT ACTION
  ========================================================= */

  const showComingSoon = (
    title: string,
  ) => {
    Alert.alert(
      title,
      'This management section will be connected to its detailed screen next.',
      [
        {
          text: 'OK',
        },
      ],
    );
  };

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading && !dashboard) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.bg}
        />

        <View
          style={styles.loadingContainer}
        >
          <View
            style={styles.loadingLogo}
          >
            <Text
              style={
                styles.loadingLogoText
              }
            >
              T
            </Text>
          </View>

          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text
            style={styles.loadingTitle}
          >
            Loading Admin Dashboard
          </Text>

          <Text
            style={styles.loadingSubtitle}
          >
            Fetching platform statistics...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error && !dashboard) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <StatusBar
          barStyle="dark-content"
          backgroundColor={COLORS.bg}
        />

        <View
          style={styles.errorContainer}
        >
          <View
            style={styles.errorIcon}
          >
            <Text
              style={styles.errorIconText}
            >
              !
            </Text>
          </View>

          <Text
            style={styles.errorTitle}
          >
            Unable to Load Dashboard
          </Text>

          <Text
            style={styles.errorMessage}
          >
            {error}
          </Text>

          <TouchableOpacity
            style={styles.retryButton}
            activeOpacity={0.85}
            onPress={() =>
              fetchDashboard()
            }
          >
            <Text
              style={
                styles.retryButtonText
              }
            >
              TRY AGAIN
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.errorLogoutButton
            }
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Text
              style={
                styles.errorLogoutText
              }
            >
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* =========================================================
     SAFE DATA
  ========================================================= */

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
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.bg}
      />

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
        contentContainerStyle={
          styles.scrollContent
        }
      >

        {/* HEADER */}

        <View style={styles.header}>
          <View
            style={styles.headerBadgeRow}
          >
            <Text
              style={styles.headerBadge}
            >
              🏆 TURFBOOK ADMIN
            </Text>
          </View>

          <Text
            style={styles.headerTitle}
          >
            Admin Dashboard
          </Text>

          <Text
            style={styles.headerSubtitle}
          >
            Platform overview & management
          </Text>

          <View
            style={styles.adminBadge}
          >
            <Text
              style={styles.adminBadgeText}
            >
              ADMIN
            </Text>
          </View>
        </View>

        {/* WELCOME CARD */}

        <View
          style={styles.welcomeCard}
        >
          <View
            style={styles.avatarWrapper}
          >
            <View style={styles.avatar}>
              <Text
                style={styles.avatarText}
              >
                {user.name
                  ? user.name
                      .charAt(0)
                      .toUpperCase()
                  : 'A'}
              </Text>
            </View>

            <View
              style={styles.avatarBadge}
            >
              <Text
                style={
                  styles.avatarBadgeText
                }
              >
                🏆
              </Text>
            </View>
          </View>

          <View
            style={styles.welcomeContent}
          >
            <Text
              style={styles.welcomeLabel}
            >
              WELCOME BACK
            </Text>

            <Text
              style={styles.welcomeName}
              numberOfLines={1}
            >
              {user.name}
            </Text>

            <Text
              style={styles.welcomeEmail}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          </View>

          <View
            style={styles.onlineBadge}
          >
            <View
              style={styles.onlineDot}
            />

            <Text
              style={styles.onlineText}
            >
              LIVE
            </Text>
          </View>
        </View>

        {/* PLATFORM OVERVIEW */}

        <SectionHeader
          title="Platform Overview"
          subtitle="Live platform statistics"
        />

        <View style={styles.statsGrid}>

          <StatCard
            icon="👥"
            value={
              overview?.totalUsers ?? 0
            }
            title="Total Users"
            meta={`${users?.customers ?? 0} customers • ${
              users?.owners ?? 0
            } owners`}
          />

          <StatCard
            icon="🏟️"
            value={
              overview?.totalTurfs ?? 0
            }
            title="Total Turfs"
            meta={`${turfs?.active ?? 0} active`}
          />

          <StatCard
            icon="📅"
            value={
              overview?.totalBookings ?? 0
            }
            title="Total Bookings"
            meta={`${
              overview?.todaysBookings ?? 0
            } today`}
          />

          <StatCard
            icon="₹"
            value={formatCurrency(
              overview?.platformRevenue ??
                0,
            )}
            title="Platform Revenue"
            meta={`Today ${formatCurrency(
              overview?.todaysRevenue ??
                0,
            )}`}
            small
          />

        </View>

        {/* REVENUE */}

        <SectionHeader
          title="Revenue"
          subtitle="Payment collection summary"
        />

        <View
          style={styles.revenueCard}
        >
          <View
            style={styles.revenueMain}
          >
            <Text
              style={styles.revenueLabel}
            >
              TOTAL GROSS COLLECTION
            </Text>

            <Text
              style={styles.revenueValue}
            >
              {formatCurrency(
                payments?.grossRevenue ??
                  0,
              )}
            </Text>
          </View>

          <View
            style={styles.revenueDivider}
          />

          <View
            style={styles.revenueRow}
          >
            <View>
              <Text
                style={
                  styles.revenueRowLabel
                }
              >
                Platform Revenue
              </Text>

              <Text
                style={
                  styles.revenueRowValue
                }
              >
                {formatCurrency(
                  payments?.platformRevenue ??
                    0,
                )}
              </Text>
            </View>

            <View
              style={styles.revenueRight}
            >
              <Text
                style={
                  styles.revenueRowLabel
                }
              >
                Owner Amount
              </Text>

              <Text
                style={
                  styles.revenueRowValue
                }
              >
                {formatCurrency(
                  payments?.ownerAmount ??
                    0,
                )}
              </Text>
            </View>
          </View>

          <View
            style={styles.revenueMonthBox}
          >
            <Text
              style={
                styles.revenueMonthTitle
              }
            >
              THIS MONTH
            </Text>

            <Text
              style={
                styles.revenueMonthValue
              }
            >
              {formatCurrency(
                payments?.thisMonth
                  ?.platformRevenue ??
                  0,
              )}
            </Text>
          </View>
        </View>

        {/* BOOKING STATUS */}

        <SectionHeader
          title="Booking Overview"
          subtitle="Current booking status"
        />

        <View
          style={
            styles.bookingStatusGrid
          }
        >
          <BookingStatusCard
            dotStyle={
              styles.bookingStatusDotPending
            }
            value={
              bookings?.pending ?? 0
            }
            label="Pending"
          />

          <BookingStatusCard
            dotStyle={
              styles.bookingStatusDotConfirmed
            }
            value={
              bookings?.confirmed ?? 0
            }
            label="Confirmed"
          />

          <BookingStatusCard
            dotStyle={
              styles.bookingStatusDotCompleted
            }
            value={
              bookings?.completed ?? 0
            }
            label="Completed"
          />

          <BookingStatusCard
            dotStyle={
              styles.bookingStatusDotCancelled
            }
            value={
              bookings?.cancelled ?? 0
            }
            label="Cancelled"
          />
        </View>

        {/* PLATFORM DETAILS */}

        <SectionHeader
          title="Platform Details"
          subtitle="Current platform inventory"
        />

        <View
          style={styles.detailsCard}
        >
          <DetailRow
            label="Customers"
            value={users?.customers ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Owners"
            value={users?.owners ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Courts"
            value={courts?.total ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Active Courts"
            value={courts?.active ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Active Turfs"
            value={turfs?.active ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Inactive / Pending Turfs"
            value={turfs?.inactive ?? 0}
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Maintenance Turfs"
            value={
              turfs?.maintenance ?? 0
            }
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Reviews"
            value={
              content?.reviews ?? 0
            }
          />

          <View
            style={styles.detailDivider}
          />

          <DetailRow
            label="Coupons"
            value={
              content?.coupons ?? 0
            }
          />
        </View>

        {/* MANAGEMENT */}

        <SectionHeader
          title="Management"
          subtitle="Manage TurfBook platform"
        />

        <View
          style={styles.managementCard}
        >
          <ManagementItem
            icon="👥"
            title="User Management"
            subtitle="View and manage customers, owners and admins"
            onPress={() =>
              showComingSoon(
                'User Management',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="🏟️"
            title="Turf Management"
            subtitle="Manage registered turfs, courts and owners"
            onPress={() =>
              showComingSoon(
                'Turf Management',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="📅"
            title="Booking Management"
            subtitle="Monitor booking activity and statuses"
            onPress={() =>
              showComingSoon(
                'Booking Management',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="💳"
            title="Payments & Payouts"
            subtitle="Monitor payments, fees and owner settlements"
            onPress={() =>
              showComingSoon(
                'Payments & Payouts',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="⭐"
            title="Reviews & Reports"
            subtitle="Review feedback and platform content"
            onPress={() =>
              showComingSoon(
                'Reviews & Reports',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="🎟️"
            title="Coupons"
            subtitle="Manage promotional coupon campaigns"
            onPress={() =>
              showComingSoon('Coupons')
            }
          />
        </View>

        {/* RECENT USERS */}

        <SectionHeader
          title="Recent Users"
          subtitle="Latest registered accounts"
        />

        <View
          style={styles.listCard}
        >
          {dashboard?.recentUsers
            ?.length ? (
            dashboard.recentUsers.map(
              (
                recentUser,
                index,
              ) => (
                <React.Fragment
                  key={
                    recentUser._id
                  }
                >
                  <View
                    style={
                      styles.userRow
                    }
                  >
                    <View
                      style={
                        styles.smallAvatar
                      }
                    >
                      <Text
                        style={
                          styles.smallAvatarText
                        }
                      >
                        {recentUser.name
                          ?.charAt(0)
                          .toUpperCase() ||
                          'U'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.listContent
                      }
                    >
                      <Text
                        style={
                          styles.listTitle
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          recentUser.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.listSubtitle
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {
                          recentUser.email
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.roleBadge
                      }
                    >
                      <Text
                        style={
                          styles.roleBadgeText
                        }
                      >
                        {String(
                          recentUser.role,
                        ).toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {index <
                    dashboard
                      .recentUsers
                      .length -
                      1 && (
                    <View
                      style={
                        styles.listDivider
                      }
                    />
                  )}
                </React.Fragment>
              ),
            )
          ) : (
            <EmptyList text="No users found." />
          )}
        </View>

        {/* RECENT TURFS */}

        <SectionHeader
          title="Recent Turfs"
          subtitle="Approve and manage turf registrations"
        />

        <View
          style={styles.listCard}
        >
          {dashboard?.recentTurfs
            ?.length ? (
            dashboard.recentTurfs.map(
              (turf, index) => {
                const isUpdating =
                  updatingTurfId ===
                  turf._id;

                const turfStatus =
                  turf.status;

                return (
                  <React.Fragment
                    key={turf._id}
                  >
                    <View
                      style={
                        styles.turfRow
                      }
                    >
                      <View
                        style={
                          styles.turfIcon
                        }
                      >
                        <Text
                          style={
                            styles.turfIconText
                          }
                        >
                          🏟️
                        </Text>
                      </View>

                      <View
                        style={
                          styles.turfMainContent
                        }
                      >
                        <Text
                          style={
                            styles.listTitle
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {turf.name}
                        </Text>

                        <Text
                          style={
                            styles.listSubtitle
                          }
                          numberOfLines={
                            1
                          }
                        >
                          {turf.city} •{' '}
                          {turf.owner
                            ?.name ||
                            'Unknown owner'}
                        </Text>

                        <View
                          style={
                            styles.turfStatusRow
                          }
                        >
                          <View
                            style={[
                              styles.statusBadge,

                              turfStatus ===
                              'active'
                                ? styles.statusActive
                                : turfStatus ===
                                  'maintenance'
                                ? styles.statusMaintenance
                                : styles.statusInactive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusText,

                                turfStatus ===
                                'active'
                                  ? styles.statusTextActive
                                  : turfStatus ===
                                    'maintenance'
                                  ? styles.statusTextMaintenance
                                  : styles.statusTextInactive,
                              ]}
                            >
                              {String(
                                turfStatus,
                              ).toUpperCase()}
                            </Text>
                          </View>

                          {/* INACTIVE */}

                          {turfStatus ===
                            'inactive' && (
                            <TouchableOpacity
                              style={
                                styles.activateButton
                              }
                              activeOpacity={
                                0.85
                              }
                              disabled={
                                isUpdating
                              }
                              onPress={() =>
                                handleActivateTurf(
                                  turf._id,
                                  turf.name,
                                )
                              }
                            >
                              {isUpdating ? (
                                <ActivityIndicator
                                  size="small"
                                  color={
                                    COLORS.white
                                  }
                                />
                              ) : (
                                <Text
                                  style={
                                    styles.activateButtonText
                                  }
                                >
                                  ACTIVATE
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}

                          {/* ACTIVE */}

                          {turfStatus ===
                            'active' && (
                            <>
                              <TouchableOpacity
                                style={
                                  styles.deactivateButton
                                }
                                activeOpacity={
                                  0.85
                                }
                                disabled={
                                  isUpdating
                                }
                                onPress={() =>
                                  handleDeactivateTurf(
                                    turf._id,
                                    turf.name,
                                  )
                                }
                              >
                                {isUpdating ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={
                                      COLORS.dangerText
                                    }
                                  />
                                ) : (
                                  <Text
                                    style={
                                      styles.deactivateButtonText
                                    }
                                  >
                                    DEACTIVATE
                                  </Text>
                                )}
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={
                                  styles.maintenanceButton
                                }
                                activeOpacity={
                                  0.85
                                }
                                disabled={
                                  isUpdating
                                }
                                onPress={() =>
                                  handleMaintenanceTurf(
                                    turf._id,
                                    turf.name,
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.maintenanceButtonText
                                  }
                                >
                                  MAINTENANCE
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}

                          {/* MAINTENANCE */}

                          {turfStatus ===
                            'maintenance' && (
                            <TouchableOpacity
                              style={
                                styles.activateButton
                              }
                              activeOpacity={
                                0.85
                              }
                              disabled={
                                isUpdating
                              }
                              onPress={() =>
                                handleActivateTurf(
                                  turf._id,
                                  turf.name,
                                )
                              }
                            >
                              {isUpdating ? (
                                <ActivityIndicator
                                  size="small"
                                  color={
                                    COLORS.white
                                  }
                                />
                              ) : (
                                <Text
                                  style={
                                    styles.activateButtonText
                                  }
                                >
                                  ACTIVATE
                                </Text>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>

                    {index <
                      dashboard
                        .recentTurfs
                        .length -
                        1 && (
                      <View
                        style={
                          styles.listDivider
                        }
                      />
                    )}
                  </React.Fragment>
                );
              },
            )
          ) : (
            <EmptyList text="No turfs found." />
          )}
        </View>

        {/* RECENT BOOKINGS */}

        <SectionHeader
          title="Recent Bookings"
          subtitle="Latest booking activity"
        />

        <View
          style={styles.listCard}
        >
          {dashboard?.recentBookings
            ?.length ? (
            dashboard.recentBookings.map(
              (
                booking,
                index,
              ) => (
                <React.Fragment
                  key={booking._id}
                >
                  <View
                    style={
                      styles.bookingRow
                    }
                  >
                    <View
                      style={
                        styles.bookingIcon
                      }
                    >
                      <Text
                        style={
                          styles.bookingIconText
                        }
                      >
                        📅
                      </Text>
                    </View>

                    <View
                      style={
                        styles.listContent
                      }
                    >
                      <Text
                        style={
                          styles.listTitle
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {booking.user
                          ?.name ||
                          'Customer'}
                      </Text>

                      <Text
                        style={
                          styles.listSubtitle
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {booking.turf
                          ?.name ||
                          'Turf'}{' '}
                        •{' '}
                        {booking.court
                          ?.name ||
                          'Court'}
                      </Text>

                      <Text
                        style={
                          styles.bookingDate
                        }
                      >
                        {formatDate(
                          booking.bookingDate,
                        )}{' '}
                        •{' '}
                        {
                          booking.startTime
                        }{' '}
                        -{' '}
                        {
                          booking.endTime
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.bookingRight
                      }
                    >
                      <Text
                        style={
                          styles.bookingAmount
                        }
                      >
                        {formatCurrency(
                          booking.finalAmount,
                        )}
                      </Text>

                      <View
                        style={[
                          styles.bookingStatusPill,

                          booking.status ===
                          'confirmed'
                            ? styles.bookingStatusConfirmed
                            : booking.status ===
                              'completed'
                            ? styles.bookingStatusCompleted
                            : booking.status ===
                              'cancelled'
                            ? styles.bookingStatusCancelled
                            : styles.bookingStatusPending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.bookingStatusText,

                            booking.status ===
                            'confirmed'
                              ? styles.confirmed
                              : booking.status ===
                                'completed'
                              ? styles.completed
                              : booking.status ===
                                'cancelled'
                              ? styles.cancelled
                              : styles.pending,
                          ]}
                        >
                          {String(
                            booking.status,
                          ).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {index <
                    dashboard
                      .recentBookings
                      .length -
                      1 && (
                    <View
                      style={
                        styles.listDivider
                      }
                    />
                  )}
                </React.Fragment>
              ),
            )
          ) : (
            <EmptyList text="No recent bookings found." />
          )}
        </View>

        {/* ADMIN BANK ACCOUNT */}

        <SectionHeader
          title="Admin Bank Account"
          subtitle="Settlement account for TurfBook platform revenue"
        />

        <View style={styles.bankCard}>
          <View style={styles.bankCardHeader}>
            <View style={styles.bankIconCircle}>
              <Text style={styles.bankIconText}>🏦</Text>
            </View>

            <View style={styles.bankCardHeaderContent}>
              <Text style={styles.bankCardTitle}>
                {adminBank
                  ? 'Admin settlement account'
                  : 'No admin bank account added'}
              </Text>

              <Text style={styles.bankCardSubtitle}>
                {adminBank
                  ? 'Used for platform settlement and financial operations.'
                  : 'Add your TurfBook admin bank account to enable settlement setup.'}
              </Text>
            </View>
          </View>

          {bankLoading ? (
            <View style={styles.bankLoadingRow}>
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
              />
              <Text style={styles.bankLoadingText}>
                Loading bank details...
              </Text>
            </View>
          ) : adminBank ? (
            <View style={styles.bankDetailsBox}>
              <BankDetailRow
                label="Account Holder"
                value={
                  adminBank.accountHolderName ||
                  '--'
                }
              />

              <BankDetailRow
                label="Bank"
                value={
                  adminBank.bankName ||
                  '--'
                }
              />

              <BankDetailRow
                label="Branch"
                value={
                  adminBank.branchName ||
                  '--'
                }
              />

              <BankDetailRow
                label="Account Number"
                value={maskAccountNumber(
                  adminBank.accountNumber,
                )}
              />

              <BankDetailRow
                label="IFSC"
                value={
                  adminBank.ifscCode ||
                  '--'
                }
              />

              <BankDetailRow
                label="Gateway Account"
                value={
                  adminBank.gatewayAccountId
                    ? adminBank.gatewayAccountId
                    : 'Not connected'
                }
              />

              <View style={styles.bankVerificationRow}>
                <View
                  style={[
                    styles.bankVerificationPill,
                    adminBank.isVerified
                      ? styles.bankVerified
                      : styles.bankNotVerified,
                  ]}
                >
                  <View
                    style={[
                      styles.bankVerificationDot,
                      adminBank.isVerified
                        ? styles.bankVerifiedDot
                        : styles.bankNotVerifiedDot,
                    ]}
                  />
                  <Text
                    style={[
                      styles.bankVerificationText,
                      adminBank.isVerified
                        ? styles.bankVerifiedText
                        : styles.bankNotVerifiedText,
                    ]}
                  >
                    {adminBank.isVerified
                      ? 'VERIFIED'
                      : 'NOT VERIFIED'}
                  </Text>
                </View>
              </View>

              <View style={styles.bankActionRow}>
                <TouchableOpacity
                  style={styles.bankEditButton}
                  activeOpacity={0.85}
                  onPress={openBankModal}
                  disabled={bankDeleting}
                >
                  <Text style={styles.bankEditButtonText}>
                    EDIT BANK
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bankDeleteButton}
                  activeOpacity={0.85}
                  onPress={deleteAdminBankDetails}
                  disabled={bankDeleting}
                >
                  {bankDeleting ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.dangerText}
                    />
                  ) : (
                    <Text
                      style={styles.bankDeleteButtonText}
                    >
                      DELETE
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addBankButton}
              activeOpacity={0.85}
              onPress={openBankModal}
            >
              <Text style={styles.addBankButtonIcon}>
                +
              </Text>

              <View style={styles.addBankButtonContent}>
                <Text style={styles.addBankButtonTitle}>
                  ADD BANK ACCOUNT
                </Text>

                <Text style={styles.addBankButtonSubtitle}>
                  Add account holder, bank, account number and IFSC
                </Text>
              </View>

              <Text style={styles.addBankButtonArrow}>
                ›
              </Text>
            </TouchableOpacity>
          )}

          {!!bankError && (
            <View style={styles.bankErrorBox}>
              <Text style={styles.bankErrorText}>
                {bankError}
              </Text>
            </View>
          )}
        </View>

        {/* PLATFORM */}

        <SectionHeader
          title="Platform"
          subtitle="Configuration & analytics"
        />

        <View
          style={styles.managementCard}
        >
          <ManagementItem
            icon="⚙️"
            title="Platform Settings"
            subtitle="Configure TurfBook platform settings"
            onPress={() =>
              showComingSoon(
                'Platform Settings',
              )
            }
          />

          <View
            style={styles.divider}
          />

          <ManagementItem
            icon="📊"
            title="Analytics"
            subtitle="View detailed platform performance"
            onPress={() =>
              showComingSoon(
                'Analytics',
              )
            }
          />
        </View>

        {/* ADMIN BANK MODAL */}

        <Modal
          visible={bankModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => {
            if (!bankSaving) {
              setBankModalVisible(false);
            }
          }}
        >
          <KeyboardAvoidingView
            style={styles.bankModalOverlay}
            behavior={
              Platform.OS === 'ios'
                ? 'padding'
                : undefined
            }
          >
            <View style={styles.bankModalCard}>
              <View style={styles.bankModalHeader}>
                <View>
                  <Text style={styles.bankModalTitle}>
                    {adminBank
                      ? 'Edit Admin Bank'
                      : 'Add Admin Bank'}
                  </Text>

                  <Text style={styles.bankModalSubtitle}>
                    Enter the account that belongs to TurfBook administration.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.bankModalClose}
                  onPress={() => {
                    if (!bankSaving) {
                      setBankModalVisible(false);
                    }
                  }}
                  disabled={bankSaving}
                >
                  <Text style={styles.bankModalCloseText}>
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  styles.bankModalScroll
                }
              >
                <BankInput
                  label="Account Holder Name *"
                  value={
                    bankForm.accountHolderName
                  }
                  placeholder="e.g. TurfBook Technologies"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      accountHolderName: value,
                    }))
                  }
                  autoCapitalize="words"
                />

                <BankInput
                  label="Bank Name"
                  value={bankForm.bankName}
                  placeholder="e.g. HDFC Bank"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      bankName: value,
                    }))
                  }
                  autoCapitalize="words"
                />

                <BankInput
                  label="Branch Name"
                  value={bankForm.branchName}
                  placeholder="e.g. Sangli Main Branch"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      branchName: value,
                    }))
                  }
                  autoCapitalize="words"
                />

                <BankInput
                  label="Account Number *"
                  value={bankForm.accountNumber}
                  placeholder="Enter bank account number"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      accountNumber: value.replace(
                        /[^0-9]/g,
                        '',
                      ),
                    }))
                  }
                  keyboardType="number-pad"
                  secureTextEntry
                />

                <BankInput
                  label="IFSC Code *"
                  value={bankForm.ifscCode}
                  placeholder="e.g. HDFC0001234"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      ifscCode:
                        value
                          .toUpperCase()
                          .replace(
                            /[^A-Z0-9]/g,
                            '',
                          ),
                    }))
                  }
                  autoCapitalize="characters"
                  maxLength={11}
                />

                <BankInput
                  label="Gateway Account ID"
                  value={bankForm.gatewayAccountId}
                  placeholder="Optional until payout onboarding"
                  onChangeText={(value) =>
                    setBankForm((current) => ({
                      ...current,
                      gatewayAccountId: value,
                    }))
                  }
                  autoCapitalize="none"
                />

                <View style={styles.bankSecurityNote}>
                  <Text style={styles.bankSecurityIcon}>
                    🔒
                  </Text>

                  <Text style={styles.bankSecurityText}>
                    Bank details are used only for TurfBook
                    administrative settlement. Do not enter a
                    fake gateway account ID. Leave it empty until
                    your real payout provider account is created.
                  </Text>
                </View>

                {!!bankError && (
                  <View style={styles.bankModalError}>
                    <Text style={styles.bankModalErrorText}>
                      {bankError}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.bankSaveButton,
                    bankSaving &&
                      styles.bankSaveButtonDisabled,
                  ]}
                  activeOpacity={0.85}
                  onPress={saveAdminBankDetails}
                  disabled={bankSaving}
                >
                  {bankSaving ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                    />
                  ) : (
                    <Text style={styles.bankSaveButtonText}>
                      {adminBank
                        ? 'UPDATE BANK DETAILS'
                        : 'SAVE BANK DETAILS'}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bankCancelButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (!bankSaving) {
                      setBankModalVisible(false);
                    }
                  }}
                  disabled={bankSaving}
                >
                  <Text style={styles.bankCancelButtonText}>
                    CANCEL
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* LOGOUT */}

        <TouchableOpacity
          style={styles.logoutButton}
          activeOpacity={0.85}
          onPress={handleLogout}
        >
          <Text
            style={styles.logoutIcon}
          >
            ⇥
          </Text>

          <Text
            style={styles.logoutText}
          >
            LOGOUT
          </Text>
        </TouchableOpacity>

        {/* FOOTER */}

        <Text style={styles.footer}>
          TurfBook Admin Panel
        </Text>

        <Text
          style={styles.footerVersion}
        >
          Platform Management • v1.0
        </Text>

        <View
          style={styles.footerSpace}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

/* =========================================================
   SECTION HEADER
========================================================= */

const SectionHeader = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => {
  return (
    <View
      style={styles.sectionHeader}
    >
      <View
        style={styles.sectionTitleRow}
      >
        <Text
          style={styles.sectionTitle}
        >
          {title}
        </Text>

        <View
          style={
            styles.sectionTitleAccent
          }
        />
      </View>

      <Text
        style={styles.sectionSubtitle}
      >
        {subtitle}
      </Text>
    </View>
  );
};

/* =========================================================
   STAT CARD
========================================================= */

const StatCard = ({
  icon,
  value,
  title,
  meta,
  small = false,
}: {
  icon: string;
  value: number | string;
  title: string;
  meta: string;
  small?: boolean;
}) => {
  return (
    <View
      style={styles.statCard}
    >
      <View
        style={styles.statIcon}
      >
        <Text
          style={styles.statIconText}
        >
          {icon}
        </Text>
      </View>

      <Text
        style={
          small
            ? styles.statValueSmall
            : styles.statValue
        }
      >
        {value}
      </Text>

      <Text
        style={styles.statTitle}
      >
        {title}
      </Text>

      <Text
        style={styles.statMeta}
      >
        {meta}
      </Text>
    </View>
  );
};

/* =========================================================
   BOOKING STATUS CARD
========================================================= */

const BookingStatusCard = ({
  dotStyle,
  value,
  label,
}: {
  dotStyle: any;
  value: number;
  label: string;
}) => {
  return (
    <View
      style={
        styles.bookingStatusCard
      }
    >
      <View
        style={
          styles.bookingStatusHeader
        }
      >
        <View style={dotStyle} />

        <Text
          style={
            styles.bookingStatusValue
          }
        >
          {value}
        </Text>
      </View>

      <Text
        style={
          styles.bookingStatusLabel
        }
      >
        {label}
      </Text>
    </View>
  );
};

/* =========================================================
   DETAIL ROW
========================================================= */

const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <View
    style={styles.detailRow}
  >
    <Text
      style={styles.detailLabel}
    >
      {label}
    </Text>

    <Text
      style={styles.detailValue}
    >
      {value}
    </Text>
  </View>
);

/* =========================================================
   MANAGEMENT ITEM
========================================================= */

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
      <View
        style={styles.managementIcon}
      >
        <Text
          style={
            styles.managementIconText
          }
        >
          {icon}
        </Text>
      </View>

      <View
        style={styles.managementContent}
      >
        <Text
          style={styles.managementTitle}
        >
          {title}
        </Text>

        <Text
          style={
            styles.managementSubtitle
          }
        >
          {subtitle}
        </Text>
      </View>

      <Text style={styles.arrow}>
        ›
      </Text>
    </TouchableOpacity>
  );
};

/* =========================================================
   EMPTY LIST
========================================================= */

const EmptyList = ({
  text,
}: {
  text: string;
}) => {
  return (
    <View
      style={styles.emptyContainer}
    >
      <View
        style={
          styles.emptyIconCircle
        }
      >
        <Text
          style={
            styles.emptyIconText
          }
        >
          📭
        </Text>
      </View>

      <Text
        style={styles.emptyText}
      >
        {text}
      </Text>
    </View>
  );
};

const maskAccountNumber = (
  accountNumber?: string,
): string => {
  if (!accountNumber) {
    return '--';
  }

  if (accountNumber.length <= 4) {
    return accountNumber;
  }

  return `•••• ${accountNumber.slice(-4)}`;
};

const BankDetailRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <View style={styles.bankDetailRow}>
    <Text style={styles.bankDetailLabel}>
      {label}
    </Text>

    <Text
      style={styles.bankDetailValue}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const BankInput = ({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  maxLength,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}) => (
  <View style={styles.bankInputGroup}>
    <Text style={styles.bankInputLabel}>
      {label}
    </Text>

    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={COLORS.placeholder}
      onChangeText={onChangeText}
      keyboardType={keyboardType || 'default'}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize || 'sentences'}
      maxLength={maxLength}
      style={styles.bankInput}
    />
  </View>
);

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
    backgroundColor:
      COLORS.primarySoft,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
    backgroundColor:
      COLORS.primarySoft,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    backgroundColor:
      COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
  },

  turfIconText: {
    fontSize: 19,
  },

  bookingIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    backgroundColor:
      COLORS.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
  },

  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },

  statusActive: {
    backgroundColor:
      COLORS.primarySoft,
    borderColor:
      COLORS.borderSoft,
  },

  statusInactive: {
    backgroundColor:
      COLORS.cardSoft,
    borderColor: COLORS.border,
  },

  statusMaintenance: {
    backgroundColor:
      COLORS.warningSoft,
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
    backgroundColor:
      COLORS.dangerSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor:
      COLORS.dangerBorder,
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
    backgroundColor:
      COLORS.warningSoft,
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
    backgroundColor:
      COLORS.primarySoft,
    borderColor:
      COLORS.borderSoft,
  },

  bookingStatusCompleted: {
    backgroundColor:
      COLORS.infoSoft,
    borderColor: '#BFDBFE',
  },

  bookingStatusCancelled: {
    backgroundColor:
      COLORS.dangerSoft,
    borderColor:
      COLORS.dangerBorder,
  },

  bookingStatusPending: {
    backgroundColor:
      COLORS.warningSoft,
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
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
  },

  emptyIconText: {
    fontSize: 24,
  },

  emptyText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ADMIN BANK */

  bankCard: {
    marginHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  bankCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  bankIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bankIconText: {
    fontSize: 24,
  },

  bankCardHeaderContent: {
    flex: 1,
    marginLeft: 12,
  },

  bankCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '900',
  },

  bankCardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  bankLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryFaint,
  },

  bankLoadingText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 8,
    fontWeight: '600',
  },

  bankDetailsBox: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },

  bankDetailRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 7,
  },

  bankDetailLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    flex: 0.9,
  },

  bankDetailValue: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    flex: 1.4,
    textAlign: 'right',
  },

  bankVerificationRow: {
    marginTop: 12,
  },

  bankVerificationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },

  bankVerified: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.borderSoft,
  },

  bankNotVerified: {
    backgroundColor: COLORS.warningSoft,
    borderColor: '#FDE68A',
  },

  bankVerificationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },

  bankVerifiedDot: {
    backgroundColor: COLORS.primary,
  },

  bankNotVerifiedDot: {
    backgroundColor: COLORS.warning,
  },

  bankVerificationText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  bankVerifiedText: {
    color: COLORS.primaryDark,
  },

  bankNotVerifiedText: {
    color: COLORS.warningText,
  },

  bankActionRow: {
    flexDirection: 'row',
    marginTop: 14,
  },

  bankEditButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  bankEditButtonText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  bankDeleteButton: {
    width: 96,
    minHeight: 44,
    borderRadius: 11,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  bankDeleteButtonText: {
    color: COLORS.dangerText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  addBankButton: {
    marginTop: 16,
    minHeight: 68,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  addBankButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 36,
    fontSize: 24,
    fontWeight: '700',
  },

  addBankButtonContent: {
    flex: 1,
    marginLeft: 10,
  },

  addBankButtonTitle: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  addBankButtonSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },

  addBankButtonArrow: {
    color: COLORS.primaryDark,
    fontSize: 26,
    fontWeight: '300',
    marginLeft: 8,
  },

  bankErrorBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  bankErrorText: {
    color: COLORS.dangerText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },

  bankModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  bankModalCard: {
    maxHeight: '92%',
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 18,
  },

  bankModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  bankModalTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '900',
  },

  bankModalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
    maxWidth: 290,
  },

  bankModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },

  bankModalCloseText: {
    color: COLORS.textSecondary,
    fontSize: 27,
    fontWeight: '400',
    lineHeight: 30,
  },

  bankModalScroll: {
    padding: 18,
    paddingBottom: 30,
  },

  bankInputGroup: {
    marginBottom: 14,
  },

  bankInputLabel: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 7,
  },

  bankInput: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    color: COLORS.textPrimary,
    paddingHorizontal: 13,
    fontSize: 13,
    fontWeight: '600',
  },

  bankSecurityNote: {
    flexDirection: 'row',
    padding: 11,
    borderRadius: 12,
    backgroundColor: COLORS.infoSoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: 2,
    marginBottom: 16,
  },

  bankSecurityIcon: {
    fontSize: 15,
    marginRight: 8,
  },

  bankSecurityText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '500',
  },

  bankModalError: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  bankModalErrorText: {
    color: COLORS.dangerText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
  },

  bankSaveButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  bankSaveButtonDisabled: {
    opacity: 0.65,
  },

  bankSaveButtonText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },

  bankCancelButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },

  bankCancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },

  /* LOGOUT */

  logoutButton: {
    marginHorizontal: 16,
    marginTop: 28,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor:
      COLORS.dangerBorder,
    backgroundColor:
      COLORS.dangerSoft,
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
    shadowOffset: {
      width: 0,
      height: 8,
    },
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
    backgroundColor:
      COLORS.dangerSoft,
    borderWidth: 1,
    borderColor:
      COLORS.dangerBorder,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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