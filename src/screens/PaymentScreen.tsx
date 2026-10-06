import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
  useFonts,
} from '@expo-google-fonts/poppins';

/* ============================================================================
 * CONFIG
 * ========================================================================== */

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
)
  .trim()
  .replace(/\/+$/, '');

const USER_STORAGE_KEY = '@user_data';

/* ============================================================================
 * COLORS — matched to HomeScreen palette
 * ========================================================================== */

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
  lime: '#C7F36B',
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface TurfImage {
  url?: string;
  isPrimary?: boolean;
}

interface Turf {
  _id?: string;
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  images?: TurfImage[];
  owner?: string | { _id?: string };
}

interface Court {
  _id?: string;
  id?: string;
  name?: string;
  sport?: string;
}

interface BookingSlot {
  id: string;
  bookingKey?: string;
  startTime: string;
  endTime: string;
  startMinutes?: number;
  endMinutes?: number;
  price: number;
  isNight?: boolean;
}

interface MultiDateBooking {
  date: string;
  courtId?: string;
  slots: BookingSlot[];
  slotCount?: number;
  totalAmount?: number;
}

interface User {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
}

interface PaymentScreenProps {
  navigation: any;
  route: {
    params: {
      turf: Turf;
      court: Court;
      turfId?: string;
      courtId?: string;
      bookings?: MultiDateBooking[];
      dates?: string[];
      date?: string;
      slots?: BookingSlot[];
      slotCount?: number;
      totalAmount?: number;
      isMultiDate?: boolean;
      isMultiSlot?: boolean;
    };
  };
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  error?: string;
  bookingId?: string;
  bookingIds?: string[];
  bookings?: any[];
  payment?: {
    _id?: string;
    totalPaid?: number;
    platformFeePercent?: number;
    platformFeeAmount?: number;
    ownerAmount?: number;
    paymentMethod?: string;
    status?: string;
  };
  payout?: {
    _id?: string;
    totalBookingAmount?: number;
    platformCommission?: number;
    netPayoutAmount?: number;
    status?: string;
  };
  grossAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  platformFeeAmount?: number;
  ownerAmount?: number;
  bookedSlots?: any[];
  [key: string]: any;
}

type PaymentStatus =
  | 'idle'
  | 'loading'
  | 'processing'
  | 'success'
  | 'failed';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const formatMoney = (value: number) => {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `₹${safeAmount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
};

const getImage = (turf?: Turf) => {
  const images = Array.isArray(turf?.images) ? turf.images : [];

  const primaryImage = images.find(
    (image) =>
      image?.isPrimary &&
      typeof image.url === 'string' &&
      image.url.trim().length > 0,
  );

  if (primaryImage?.url) {
    return primaryImage.url.trim();
  }

  const firstImage = images.find(
    (image) =>
      typeof image?.url === 'string' && image.url.trim().length > 0,
  );

  return firstImage?.url?.trim() ?? '';
};

const getId = (value?: { _id?: string; id?: string }) => {
  return String(value?._id || value?.id || '').trim();
};

const isValidObjectId = (value?: string) => {
  if (!value) return false;
  return /^[a-fA-F0-9]{24}$/.test(value);
};

const parseApiResponse = async (
  response: Response,
): Promise<ApiResponse> => {
  const rawText = await response.text();

  let data: ApiResponse = {};

  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
};

const validateApiUrl = () => {
  if (!API_BASE_URL) {
    throw new Error(
      'API URL is not configured. Add EXPO_PUBLIC_API_URL to your .env file.',
    );
  }
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
};

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  navigation,
  route,
}) => {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const {
    turf,
    court,
    turfId: routeTurfId,
    courtId: routeCourtId,
    bookings: routeBookings = [],
    date: legacyDate,
    slots: legacySlots = [],
    slotCount: legacySlotCount,
    totalAmount: legacyTotalAmount = 0,
  } = route.params || {};

  /* STATE */

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [successfulBookingIds, setSuccessfulBookingIds] = useState<string[]>(
    [],
  );
  const [successfulPayment, setSuccessfulPayment] =
    useState<ApiResponse['payment'] | null>(null);

  /* REFS */

  const userRef = useRef<User | null>(null);
  const mountedRef = useRef(true);
  const paymentInProgressRef = useRef(false);

  /* DERIVED VALUES */

  const bookingGroups = useMemo<MultiDateBooking[]>(() => {
    if (Array.isArray(routeBookings) && routeBookings.length > 0) {
      return routeBookings
        .filter(
          (booking) =>
            booking?.date && Array.isArray(booking?.slots),
        )
        .map((booking) => ({
          ...booking,
          date: String(booking.date),
          slots: [...booking.slots].sort((a, b) => {
            const am = Number(a.startMinutes);
            const bm = Number(b.startMinutes);

            if (Number.isFinite(am) && Number.isFinite(bm)) {
              return am - bm;
            }

            return String(a.startTime).localeCompare(
              String(b.startTime),
            );
          }),
          slotCount: booking.slotCount ?? booking.slots.length,
          totalAmount: Number(
            booking.totalAmount ??
              booking.slots.reduce(
                (sum, slot) => sum + Number(slot.price || 0),
                0,
              ),
          ),
        }));
    }

    if (legacyDate && legacySlots.length > 0) {
      return [
        {
          date: String(legacyDate),
          courtId: routeCourtId || getId(court),
          slots: [...legacySlots].sort((a, b) =>
            String(a.startTime).localeCompare(String(b.startTime)),
          ),
          slotCount: legacySlotCount ?? legacySlots.length,
          totalAmount: Number(
            legacyTotalAmount ||
              legacySlots.reduce(
                (sum, slot) => sum + Number(slot.price || 0),
                0,
              ),
          ),
        },
      ];
    }

    return [];
  }, [
    court,
    legacyDate,
    legacySlotCount,
    legacySlots,
    legacyTotalAmount,
    routeBookings,
    routeCourtId,
  ]);

  const totalSlotCount = useMemo(
    () =>
      bookingGroups.reduce(
        (sum, booking) =>
          sum + Number(booking.slotCount ?? booking.slots.length),
        0,
      ),
    [bookingGroups],
  );

  const displayedAmount = useMemo(() => {
    const calculated = bookingGroups.reduce(
      (sum, booking) => sum + Number(booking.totalAmount || 0),
      0,
    );

    if (calculated > 0) return calculated;

    const legacyAmount = Number(legacyTotalAmount);

    return Number.isFinite(legacyAmount) && legacyAmount > 0
      ? legacyAmount
      : 0;
  }, [bookingGroups, legacyTotalAmount]);

  const selectedDates = useMemo(
    () => bookingGroups.map((booking) => booking.date),
    [bookingGroups],
  );

  const imageUrl = useMemo(() => getImage(turf), [turf]);

  const turfId = useMemo(
    () => String(routeTurfId || getId(turf)).trim(),
    [routeTurfId, turf],
  );

  const courtId = useMemo(
    () => String(routeCourtId || getId(court)).trim(),
    [routeCourtId, court],
  );

  const isBusy =
    paymentStatus === 'loading' || paymentStatus === 'processing';

  /* RESET STATE */

  const resetPaymentState = useCallback(() => {
    paymentInProgressRef.current = false;

    if (!mountedRef.current) return;

    setPaymentStatus('idle');
    setStatusMessage('');
    setSuccessfulBookingIds([]);
    setSuccessfulPayment(null);
  }, []);

  /* LOAD USER */

  const loadUser = useCallback(async () => {
    try {
      if (mountedRef.current) {
        setLoadingUser(true);
        setPaymentStatus('loading');
      }

      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

      if (!storedUser) {
        userRef.current = null;

        if (!mountedRef.current) return;

        setUser(null);
        setPaymentStatus('idle');

        Alert.alert(
          'Login required',
          'Please login before making a booking.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );

        return;
      }

      let parsedUser: User;

      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        throw new Error('Invalid saved user session.');
      }

      if (!parsedUser?._id) {
        throw new Error('Invalid user session.');
      }

      userRef.current = parsedUser;

      if (mountedRef.current) {
        setUser(parsedUser);
        setPaymentStatus('idle');
      }
    } catch (error) {
      console.error('Unable to load user:', error);

      userRef.current = null;

      if (!mountedRef.current) return;

      setUser(null);
      setPaymentStatus('failed');

      Alert.alert(
        'Session error',
        getApiErrorMessage(
          error,
          'Your login session is invalid. Please login again.',
        ),
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } finally {
      if (mountedRef.current) {
        setLoadingUser(false);
      }
    }
  }, [navigation]);

  /* VALIDATE BOOKING */

  const validateBooking = useCallback(() => {
    const currentUser = userRef.current;

    if (!currentUser?._id) {
      Alert.alert(
        'Login required',
        'Please login before making a payment.',
      );
      return false;
    }

    if (!isValidObjectId(currentUser._id)) {
      Alert.alert(
        'Session error',
        'Your user session is invalid. Please login again.',
      );
      return false;
    }

    if (!turfId || !isValidObjectId(turfId)) {
      Alert.alert(
        'Booking error',
        'Turf information is missing or invalid.',
      );
      return false;
    }

    if (!courtId || !isValidObjectId(courtId)) {
      Alert.alert(
        'Booking error',
        'Court information is missing or invalid.',
      );
      return false;
    }

    if (!bookingGroups.length) {
      Alert.alert(
        'Booking error',
        'Please select at least one date and slot.',
      );
      return false;
    }

    for (const booking of bookingGroups) {
      if (!booking.date || !booking.slots.length) {
        Alert.alert(
          'Booking error',
          'Every selected date must contain at least one slot.',
        );
        return false;
      }

      const bookingCourtId = String(
        booking.courtId || courtId,
      ).trim();

      if (bookingCourtId !== courtId) {
        Alert.alert(
          'Booking error',
          'All selected dates must use the same court.',
        );
        return false;
      }

      const invalidSlot = booking.slots.find(
        (slot) =>
          !slot?.id ||
          !slot?.startTime ||
          !slot?.endTime ||
          !Number.isFinite(Number(slot.price)) ||
          Number(slot.price) < 0,
      );

      if (invalidSlot) {
        Alert.alert(
          'Booking error',
          `One or more slots on ${booking.date} contain invalid information.`,
        );
        return false;
      }
    }

    if (
      !Number.isFinite(displayedAmount) ||
      displayedAmount <= 0
    ) {
      Alert.alert('Booking error', 'The booking amount is invalid.');
      return false;
    }

    return true;
  }, [bookingGroups, courtId, displayedAmount, turfId]);

  /* CREATE BOOKING */

  const createBooking = useCallback(async () => {
    if (paymentInProgressRef.current) return;

    if (!validateBooking()) return;

    const currentUser = userRef.current;

    if (!currentUser?._id) {
      Alert.alert('Login required', 'Please login again.');
      return;
    }

    try {
      validateApiUrl();

      paymentInProgressRef.current = true;

      if (mountedRef.current) {
        setPaymentStatus('processing');
        setStatusMessage(
          'Checking slot availability and confirming your booking...',
        );
      }

      const requestBookings = bookingGroups.map((booking) => ({
        date: booking.date,
        courtId: booking.courtId || courtId,
        slots: booking.slots.map((slot) => ({
          id: slot.id,
          bookingKey: slot.bookingKey,
          startTime: slot.startTime,
          endTime: slot.endTime,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          price: Number(slot.price || 0),
          isNight: slot.isNight,
        })),
        slotCount: booking.slots.length,
        totalAmount: booking.slots.reduce(
          (sum, slot) => sum + Number(slot.price || 0),
          0,
        ),
      }));

      const response = await fetch(`${API_BASE_URL}/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser._id,
          turfId,
          courtId,
          bookings: requestBookings,
        }),
      });

      const data = await parseApiResponse(response);

      if (data?.success !== true) {
        throw new Error(
          data?.message || 'Booking could not be completed.',
        );
      }

      const bookingIds = Array.isArray(data.bookingIds)
        ? data.bookingIds
        : data.bookingId
          ? [data.bookingId]
          : [];

      if (bookingIds.length === 0) {
        throw new Error(
          'Booking was processed but no booking ID was returned.',
        );
      }

      if (mountedRef.current) {
        setSuccessfulBookingIds(bookingIds);
        setSuccessfulPayment(data.payment ?? null);
        setPaymentStatus('success');
        setStatusMessage(
          'Payment successful. Your turf has been booked successfully.',
        );
      }

      paymentInProgressRef.current = false;

      Alert.alert(
        'Payment Successful 🎉',
        `Your turf has been booked successfully.\n\nBooking ID: ${bookingIds[0]}`,
        [
          {
            text: 'VIEW HOME',
            onPress: () => {
              if (!mountedRef.current) return;

              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ],
        { cancelable: false },
      );
    } catch (error) {
      console.error('Direct booking error:', error);

      paymentInProgressRef.current = false;

      if (!mountedRef.current) return;

      setPaymentStatus('failed');
      setStatusMessage('Booking could not be completed.');

      Alert.alert(
        'Booking failed',
        getApiErrorMessage(
          error,
          'Unable to complete your booking. Please try again.',
        ),
        [
          {
            text: 'OK',
            onPress: () => {
              if (mountedRef.current) {
                setPaymentStatus('idle');
                setStatusMessage('');
              }
            },
          },
        ],
      );
    }
  }, [bookingGroups, courtId, navigation, turfId, validateBooking]);

  /* EFFECT */

  useEffect(() => {
    mountedRef.current = true;
    void loadUser();

    return () => {
      mountedRef.current = false;
      paymentInProgressRef.current = false;
    };
  }, [loadUser]);

  /* PAY NOW */

  const handlePayNow = useCallback(() => {
    if (isBusy) return;
    if (paymentStatus === 'success') return;
    if (!validateBooking()) return;

    Alert.alert(
      'Confirm booking',
      `Confirm booking for ${formatMoney(displayedAmount)}?\n\n${totalSlotCount} ${
        totalSlotCount === 1 ? 'slot' : 'slots'
      } across ${bookingGroups.length} ${
        bookingGroups.length === 1 ? 'date' : 'dates'
      }.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'PAY NOW', onPress: createBooking },
      ],
    );
  }, [
    bookingGroups.length,
    createBooking,
    displayedAmount,
    isBusy,
    paymentStatus,
    totalSlotCount,
    validateBooking,
  ]);

  /* BACK */

  const handleBack = useCallback(() => {
    if (isBusy) {
      Alert.alert(
        'Booking in progress',
        'Please wait until the booking process is completed.',
      );
      return;
    }

    navigation.goBack();
  }, [isBusy, navigation]);

  /* PAYMENT STATUS UI */

  const renderPaymentStatus = () => {
    if (paymentStatus === 'idle' && !statusMessage) return null;

    const isProcessing = paymentStatus === 'processing';
    const isSuccess = paymentStatus === 'success';
    const isFailed = paymentStatus === 'failed';

    return (
      <View
        style={[
          styles.statusCard,
          isProcessing && styles.statusCardGreen,
          isSuccess && styles.statusCardSuccess,
          isFailed && styles.statusCardFailed,
        ]}
      >
        <View style={styles.statusIcon}>
          {isProcessing ? (
            <ActivityIndicator size="small" color={COLORS.primaryDeep} />
          ) : (
            <Text style={styles.statusEmoji}>
              {isSuccess ? '✓' : '!'}
            </Text>
          )}
        </View>

        <View style={styles.statusContent}>
          <Text
            style={[
              styles.statusTitle,
              isSuccess && styles.statusTitleSuccess,
              isFailed && styles.statusTitleFailed,
            ]}
          >
            {isSuccess
              ? 'Payment Successful 🎉'
              : isFailed
                ? 'Booking failed'
                : 'Confirming booking'}
          </Text>

          <Text
            style={[
              styles.statusMessage,
              isSuccess && styles.statusMessageSuccess,
              isFailed && styles.statusMessageFailed,
            ]}
          >
            {statusMessage || 'Please wait...'}
          </Text>

          {isSuccess && successfulBookingIds.length > 0 && (
            <Text style={styles.bookingIdText}>
              Booking ID: {successfulBookingIds[0]}
            </Text>
          )}
        </View>
      </View>
    );
  };

  /* LOADING */

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right', 'bottom']}
      >
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

  if (loadingUser) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={['top', 'left', 'right', 'bottom']}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primaryDeep} />
          <Text style={styles.loadingText}>Loading payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* SCREEN */

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color={isBusy ? COLORS.textLight : COLORS.textPrimary}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Payment</Text>

        <View style={styles.headerRight} />
      </View>

      {/* CONTENT */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* SUCCESS MESSAGE */}
        {paymentStatus === 'success' && (
          <View style={styles.successBanner}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>

            <View style={styles.successTextBox}>
              <Text style={styles.successTitle}>
                Payment Successful 🎉
              </Text>

              <Text style={styles.successSubtitle}>
                Your turf has been booked successfully.
              </Text>

              {successfulBookingIds.length > 0 && (
                <Text style={styles.successBookingId}>
                  Booking ID: {successfulBookingIds[0]}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* SECURE BOOKING */}
        {paymentStatus !== 'success' && (
          <View style={styles.secureBanner}>
            <View style={styles.secureIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={COLORS.primaryDarker}
              />
            </View>

            <View style={styles.secureTextBox}>
              <Text style={styles.secureTitle}>Secure booking</Text>

              <Text style={styles.secureSubtitle}>
                Your selected slots will be confirmed securely by
                the server.
              </Text>
            </View>
          </View>
        )}

        {/* STATUS */}
        {renderPaymentStatus()}

        {/* TURF */}
        <Text style={styles.sectionTitle}>Booking summary</Text>

        <View style={styles.turfCard}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.turfImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderEmoji}>⚽</Text>
            </View>
          )}

          <View style={styles.turfInfo}>
            <Text style={styles.turfName} numberOfLines={2}>
              {turf?.name || 'Turf'}
            </Text>

            <Text style={styles.courtText} numberOfLines={2}>
              {court?.name || 'Selected court'}
              {court?.sport ? ` • ${court.sport}` : ''}
            </Text>

            {!!turf?.city && (
              <Text style={styles.locationText} numberOfLines={1}>
                {turf.city}
              </Text>
            )}
          </View>
        </View>

        {/* DATES + SLOTS */}
        <Text style={styles.sectionTitle}>Booking dates & slots</Text>

        <View style={styles.multiDateCard}>
          {bookingGroups.length === 0 ? (
            <View style={styles.emptySlots}>
              <Text style={styles.emptySlotsText}>
                No slots selected.
              </Text>
            </View>
          ) : (
            bookingGroups.map((booking, bookingIndex) => (
              <View
                key={`${booking.date}-${bookingIndex}`}
                style={[
                  styles.dateGroup,
                  bookingIndex === bookingGroups.length - 1 &&
                    styles.lastDateGroup,
                ]}
              >
                <View style={styles.dateGroupHeader}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>
                      {bookingIndex + 1}
                    </Text>
                  </View>

                  <View style={styles.dateGroupTitleBox}>
                    <Text style={styles.dateGroupTitle}>
                      {booking.date}
                    </Text>

                    <Text style={styles.dateGroupSubtitle}>
                      {booking.slots.length}{' '}
                      {booking.slots.length === 1 ? 'slot' : 'slots'}
                    </Text>
                  </View>

                  <Text style={styles.dateGroupTotal}>
                    {formatMoney(Number(booking.totalAmount || 0))}
                  </Text>
                </View>

                {booking.slots.map((slot, slotIndex) => (
                  <View
                    key={`${booking.date}-${slot.id}-${slotIndex}`}
                    style={styles.multiDateSlotRow}
                  >
                    <View style={styles.multiDateSlotLeft}>
                      <View style={styles.slotDot}>
                        <Text style={styles.slotDotText}>
                          {slotIndex + 1}
                        </Text>
                      </View>

                      <View style={styles.slotInfo}>
                        <Text style={styles.slotTime}>
                          {slot.startTime} - {slot.endTime}
                        </Text>

                        {slot.isNight && (
                          <View style={styles.nightBadge}>
                            <Text style={styles.nightText}>
                              🌙 Night pricing
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text style={styles.slotPrice}>
                      {formatMoney(Number(slot.price || 0))}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* DETAILS */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Selected dates</Text>
            <Text style={styles.detailValue}>
              {bookingGroups.length}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total slots</Text>
            <Text style={styles.detailValue}>{totalSlotCount}</Text>
          </View>
        </View>

        {/* AMOUNT */}
        <Text style={styles.sectionTitle}>Amount</Text>

        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Booking amount</Text>
            <Text style={styles.amountValue}>
              {formatMoney(displayedAmount)}
            </Text>
          </View>

          <View style={styles.amountDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total payable</Text>
            <Text style={styles.totalValue}>
              {formatMoney(displayedAmount)}
            </Text>
          </View>
        </View>

        {/* PAYMENT INFORMATION */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How booking works</Text>

          <Text style={styles.infoText}>
            1. Your selected slots are checked again by the server.
          </Text>

          <Text style={styles.infoText}>
            2. The server calculates the final booking amount.
          </Text>

          <Text style={styles.infoText}>
            3. Available slots are locked and changed to booked.
          </Text>

          <Text style={styles.infoText}>
            4. Your payment record is stored as successful.
          </Text>

          <Text style={styles.infoText}>
            5. A 2% platform commission is stored and the owner
            payout is recorded.
          </Text>
        </View>

        {/* SAFETY */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Booking safety</Text>

          <Text style={styles.warningText}>
            Your booking is processed as one server transaction. If
            any part fails, the booking changes are rolled back.
          </Text>
        </View>

        {/* SUCCESS DETAILS */}
        {paymentStatus === 'success' && successfulPayment && (
          <View style={styles.successDetailsCard}>
            <Text style={styles.successDetailsTitle}>
              Payment details
            </Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment status</Text>
              <Text style={styles.successValue}>SUCCESS</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount paid</Text>
              <Text style={styles.detailValue}>
                {formatMoney(
                  Number(
                    successfulPayment.totalPaid || displayedAmount,
                  ),
                )}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Payment method</Text>
              <Text style={styles.detailValue}>Direct</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM BAR */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceBox}>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomAmount}>
            {formatMoney(displayedAmount)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.payButton,
            isBusy && styles.payButtonDisabled,
            paymentStatus === 'success' && styles.successButton,
            (!bookingGroups.length ||
              totalSlotCount <= 0 ||
              displayedAmount <= 0) &&
              styles.payButtonDisabled,
          ]}
          onPress={handlePayNow}
          disabled={
            isBusy ||
            paymentStatus === 'success' ||
            !bookingGroups.length ||
            totalSlotCount <= 0 ||
            displayedAmount <= 0
          }
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Pay now"
        >
          {isBusy ? (
            <>
              <ActivityIndicator color={COLORS.dark} size="small" />
              <Text style={styles.payButtonText}>CONFIRMING...</Text>
            </>
          ) : paymentStatus === 'success' ? (
            <>
              <Text style={styles.payButtonText}>BOOKED ✓</Text>
            </>
          ) : (
            <>
              <Text style={styles.payButtonText}>PAY NOW</Text>
              <Ionicons
                name="arrow-forward"
                size={17}
                color={COLORS.dark}
                style={styles.payArrow}
              />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

/* ============================================================================
 * STYLES
 * ========================================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* FONT LOADING */

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

  /* HEADER */

  header: {
    height: 60,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  headerTitle: {
    fontSize: 17,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  headerRight: {
    width: 42,
  },

  /* CONTENT */

  content: {
    padding: 16,
    paddingBottom: 165,
  },

  /* SECURE */

  secureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  secureIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  secureTextBox: {
    flex: 1,
    marginLeft: 12,
  },

  secureTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.primaryDarker,
    letterSpacing: 0.1,
  },

  secureSubtitle: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  /* SUCCESS */

  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  successIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  successIconText: {
    color: COLORS.dark,
    fontSize: 22,
    fontFamily: 'Poppins_900Black',
  },

  successTextBox: {
    flex: 1,
    marginLeft: 12,
  },

  successTitle: {
    color: COLORS.primaryDarker,
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.1,
  },

  successSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 16,
    marginTop: 3,
  },

  successBookingId: {
    color: COLORS.primaryDarker,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 5,
  },

  /* STATUS */

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 14,
    padding: 13,
    marginBottom: 20,
  },

  statusCardGreen: {
    backgroundColor: COLORS.primaryFaint,
    borderColor: COLORS.primaryMuted,
  },

  statusCardSuccess: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryMuted,
  },

  statusCardFailed: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.dangerBorder,
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },

  statusEmoji: {
    fontSize: 18,
    fontFamily: 'Poppins_900Black',
    color: COLORS.primaryDeep,
  },

  statusContent: {
    flex: 1,
    marginLeft: 11,
  },

  statusTitle: {
    color: COLORS.warningText,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.1,
  },

  statusTitleSuccess: {
    color: COLORS.primaryDarker,
  },

  statusTitleFailed: {
    color: COLORS.dangerText,
  },

  statusMessage: {
    marginTop: 3,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 16,
  },

  statusMessageSuccess: {
    color: COLORS.primaryDarker,
  },

  statusMessageFailed: {
    color: COLORS.dangerText,
  },

  bookingIdText: {
    marginTop: 5,
    color: COLORS.primaryDarker,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
  },

  /* SECTION */

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },

  /* TURF */

  turfCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  turfImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: COLORS.bgMuted,
  },

  imagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: 30,
  },

  turfInfo: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: 'center',
  },

  turfName: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },

  courtText: {
    marginTop: 5,
    fontSize: 12,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_700Bold',
  },

  locationText: {
    marginTop: 4,
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_500Medium',
  },

  /* DETAILS */

  detailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  detailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },

  detailValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
  },

  successValue: {
    color: COLORS.primaryDarker,
    fontSize: 13,
    fontFamily: 'Poppins_900Black',
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
  },

  /* SLOTS */

  emptySlots: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptySlotsText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },

  multiDateCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 14,
  },

  dateGroup: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  lastDateGroup: {
    borderBottomWidth: 0,
  },

  dateGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  dateBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  dateBadgeText: {
    color: COLORS.primaryDarker,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
  },

  dateGroupTitleBox: {
    flex: 1,
  },

  dateGroupTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
  },

  dateGroupSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    marginTop: 2,
  },

  dateGroupTotal: {
    color: COLORS.primaryDarker,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
  },

  multiDateSlotRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primaryFaint,
    marginTop: 6,
  },

  multiDateSlotLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  slotDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  slotDotText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
  },

  slotInfo: {
    flex: 1,
  },

  slotTime: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },

  nightBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },

  nightText: {
    color: COLORS.accentText,
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },

  slotPrice: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    marginLeft: 10,
  },

  /* AMOUNT */

  amountCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  amountLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },

  amountValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },

  amountDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 14,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: 'Poppins_800ExtraBold',
  },

  totalValue: {
    color: COLORS.primaryDarker,
    fontSize: 20,
    fontFamily: 'Poppins_900Black',
    letterSpacing: -0.3,
  },

  /* INFO */

  infoBox: {
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  infoTitle: {
    color: COLORS.primaryDarker,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 8,
    letterSpacing: 0.1,
  },

  infoText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 17,
    marginBottom: 3,
  },

  /* WARNING */

  warningBox: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  warningTitle: {
    color: COLORS.warningText,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 6,
    letterSpacing: 0.1,
  },

  warningText: {
    color: COLORS.warningText,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 17,
  },

  /* SUCCESS DETAILS */

  successDetailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  successDetailsTitle: {
    color: COLORS.primaryDarker,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
    paddingTop: 15,
    paddingBottom: 5,
  },

  /* BOTTOM */

  bottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },

  bottomPriceBox: {
    flex: 1,
    minWidth: 100,
  },

  bottomLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.3,
  },

  bottomAmount: {
    marginTop: 1,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontFamily: 'Poppins_900Black',
    letterSpacing: -0.3,
  },

  payButton: {
    minWidth: 148,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  payButtonDisabled: {
    opacity: 0.6,
  },

  successButton: {
    backgroundColor: COLORS.primaryDeep,
  },

  payButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
    marginLeft: 6,
  },

  payArrow: {
    marginLeft: 8,
  },
});

export default PaymentScreen;