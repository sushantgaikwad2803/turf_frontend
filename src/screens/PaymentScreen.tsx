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

import AsyncStorage from '@react-native-async-storage/async-storage';

import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';

import {
  CFEnvironment,
  CFSession,
} from 'cashfree-pg-api-contract';

/* ============================================================================
 * CONFIG
 * ========================================================================== */

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

const USER_STORAGE_KEY = '@user_data';

/*
 * .env:
 *
 * EXPO_PUBLIC_CASHFREE_ENV=SANDBOX
 *
 * Production:
 *
 * EXPO_PUBLIC_CASHFREE_ENV=PRODUCTION
 */

const CASHFREE_ENVIRONMENT =
  String(process.env.EXPO_PUBLIC_CASHFREE_ENV ?? 'SANDBOX')
    .trim()
    .toUpperCase() === 'PRODUCTION'
    ? CFEnvironment.PRODUCTION
    : CFEnvironment.SANDBOX;

/* ============================================================================
 * COLORS
 * ========================================================================== */

const COLORS = {
  primary: '#111827',

  accent: '#16A34A',
  accentDark: '#15803D',

  greenLight: '#DCFCE7',
  greenText: '#166534',

  background: '#F7F8FA',
  card: '#FFFFFF',

  text: '#111827',
  muted: '#6B7280',
  lightText: '#9CA3AF',

  border: '#E5E7EB',

  danger: '#DC2626',
  dangerLight: '#FEF2F2',

  blueLight: '#EFF6FF',
  blueText: '#1E40AF',

  purpleLight: '#F5F3FF',
  purpleText: '#7C3AED',

  orangeLight: '#FFF7ED',
  orangeText: '#C2410C',
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

  paymentSessionId?: string;
  orderId?: string;

  bookingId?: string;
  bookingIds?: string[];

  amount?: number;
  totalAmount?: number;

  status?: string;

  [key: string]: any;
}

type PaymentStatus =
  | 'idle'
  | 'loading'
  | 'creating'
  | 'processing'
  | 'verifying'
  | 'success'
  | 'failed';

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const formatMoney = (value: number) => {
  const amount = Number(value);

  const safeAmount = Number.isFinite(amount)
    ? amount
    : 0;

  return `₹${safeAmount.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;
};

const getImage = (turf?: Turf) => {
  const images = Array.isArray(turf?.images)
    ? turf.images
    : [];

  const primaryImage = images.find(
    image =>
      image?.isPrimary &&
      typeof image.url === 'string' &&
      image.url.trim().length > 0,
  );

  if (primaryImage?.url) {
    return primaryImage.url.trim();
  }

  const firstImage = images.find(
    image =>
      typeof image?.url === 'string' &&
      image.url.trim().length > 0,
  );

  return firstImage?.url?.trim() ?? '';
};

const getId = (
  value?: {
    _id?: string;
    id?: string;
  },
) => {
  return String(
    value?._id ||
      value?.id ||
      '',
  ).trim();
};

const isValidObjectId = (value?: string) => {
  if (!value) {
    return false;
  }

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
      data = {
        message: rawText,
      };
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

const getApiErrorMessage = (
  error: unknown,
  fallback: string,
) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    typeof error === 'string' &&
    error.trim()
  ) {
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

  /* --------------------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------------------ */

  const [user, setUser] =
    useState<User | null>(null);

  const [loadingUser, setLoadingUser] =
    useState(true);

  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>('idle');

  const [statusMessage, setStatusMessage] =
    useState('');

  const [cashfreeAvailable, setCashfreeAvailable] =
    useState<boolean | null>(null);

  /* --------------------------------------------------------------------------
   * REFS
   * ------------------------------------------------------------------------ */

  const userRef =
    useRef<User | null>(null);

  const mountedRef =
    useRef(true);

  const paymentInProgressRef =
    useRef(false);

  const currentOrderIdRef =
    useRef<string>('');

  /* --------------------------------------------------------------------------
   * DERIVED VALUES
   * ------------------------------------------------------------------------ */

  const bookingGroups = useMemo<MultiDateBooking[]>(() => {
    if (Array.isArray(routeBookings) && routeBookings.length > 0) {
      return routeBookings
        .filter(booking => booking?.date && Array.isArray(booking?.slots))
        .map(booking => ({
          ...booking,
          date: String(booking.date),
          slots: [...booking.slots].sort((a, b) => {
            const am = Number(a.startMinutes);
            const bm = Number(b.startMinutes);
            if (Number.isFinite(am) && Number.isFinite(bm)) return am - bm;
            return String(a.startTime).localeCompare(String(b.startTime));
          }),
          slotCount: booking.slotCount ?? booking.slots.length,
          totalAmount: Number(booking.totalAmount ?? booking.slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0)),
        }));
    }

    if (legacyDate && legacySlots.length > 0) {
      return [{
        date: String(legacyDate),
        courtId: routeCourtId || getId(court),
        slots: [...legacySlots].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
        slotCount: legacySlotCount ?? legacySlots.length,
        totalAmount: Number(legacyTotalAmount || legacySlots.reduce((sum, slot) => sum + Number(slot.price || 0), 0)),
      }];
    }

    return [];
  }, [court, legacyDate, legacySlotCount, legacySlots, legacyTotalAmount, routeBookings, routeCourtId]);

  const totalSlotCount = useMemo(
    () => bookingGroups.reduce((sum, booking) => sum + Number(booking.slotCount ?? booking.slots.length), 0),
    [bookingGroups],
  );

  const displayedAmount = useMemo(() => {
    const calculated = bookingGroups.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    if (calculated > 0) return calculated;
    const legacyAmount = Number(legacyTotalAmount);
    return Number.isFinite(legacyAmount) && legacyAmount > 0 ? legacyAmount : 0;
  }, [bookingGroups, legacyTotalAmount]);

  const selectedDates = useMemo(() => bookingGroups.map(booking => booking.date), [bookingGroups]);

  const imageUrl = useMemo(() => getImage(turf), [turf]);
  const turfId = useMemo(() => String(routeTurfId || getId(turf)).trim(), [routeTurfId, turf]);
  const courtId = useMemo(() => String(routeCourtId || getId(court)).trim(), [routeCourtId, court]);

  const isBusy =
    paymentStatus === 'loading' ||
    paymentStatus === 'creating' ||
    paymentStatus === 'processing' ||
    paymentStatus === 'verifying';

  /* ==========================================================================
   * RESET PAYMENT STATE
   * ======================================================================== */

  const resetPaymentState = useCallback(() => {
    paymentInProgressRef.current = false;
    currentOrderIdRef.current = '';

    if (!mountedRef.current) {
      return;
    }

    setPaymentStatus('idle');
    setStatusMessage('');
  }, []);

  /* ==========================================================================
   * LOAD USER
   * ======================================================================== */

  const loadUser = useCallback(async () => {
    try {
      if (mountedRef.current) {
        setLoadingUser(true);
        setPaymentStatus('loading');
      }

      const storedUser =
        await AsyncStorage.getItem(
          USER_STORAGE_KEY,
        );

      if (!storedUser) {
        userRef.current = null;

        if (!mountedRef.current) {
          return;
        }

        setUser(null);
        setPaymentStatus('idle');

        Alert.alert(
          'Login required',
          'Please login before making a booking.',
          [
            {
              text: 'OK',
              onPress: () =>
                navigation.goBack(),
            },
          ],
        );

        return;
      }

      let parsedUser: User;

      try {
        parsedUser = JSON.parse(
          storedUser,
        );
      } catch {
        throw new Error(
          'Invalid saved user session.',
        );
      }

      if (!parsedUser?._id) {
        throw new Error(
          'Invalid user session.',
        );
      }

      userRef.current =
        parsedUser;

      if (mountedRef.current) {
        setUser(parsedUser);
        setPaymentStatus('idle');
      }
    } catch (error) {
      console.error(
        'Unable to load user:',
        error,
      );

      userRef.current = null;

      if (!mountedRef.current) {
        return;
      }

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
            onPress: () =>
              navigation.goBack(),
          },
        ],
      );
    } finally {
      if (mountedRef.current) {
        setLoadingUser(false);
      }
    }
  }, [navigation]);

  /* ==========================================================================
   * VALIDATE BOOKING
   * ======================================================================== */

  const validateBooking = useCallback(() => {
    const currentUser = userRef.current;
    if (!currentUser?._id) { Alert.alert('Login required', 'Please login before making a payment.'); return false; }
    if (!isValidObjectId(currentUser._id)) { Alert.alert('Session error', 'Your user session is invalid. Please login again.'); return false; }
    if (!turfId || !isValidObjectId(turfId)) { Alert.alert('Booking error', 'Turf information is missing or invalid.'); return false; }
    if (!courtId || !isValidObjectId(courtId)) { Alert.alert('Booking error', 'Court information is missing or invalid.'); return false; }
    if (!bookingGroups.length) { Alert.alert('Booking error', 'Please select at least one date and slot.'); return false; }

    for (const booking of bookingGroups) {
      if (!booking.date || !booking.slots.length) { Alert.alert('Booking error', 'Every selected date must contain at least one slot.'); return false; }
      const bookingCourtId = String(booking.courtId || courtId).trim();
      if (bookingCourtId && bookingCourtId !== courtId) { Alert.alert('Booking error', 'All selected dates must use the same court.'); return false; }
      const invalidSlot = booking.slots.find(slot => !slot?.id || !slot?.startTime || !slot?.endTime || !Number.isFinite(Number(slot.price)) || Number(slot.price) < 0);
      if (invalidSlot) { Alert.alert('Booking error', `One or more slots on ${booking.date} contain invalid information.`); return false; }
    }

    if (!Number.isFinite(displayedAmount) || displayedAmount <= 0) { Alert.alert('Booking error', 'The booking amount is invalid.'); return false; }
    return true;
  }, [bookingGroups, courtId, displayedAmount, turfId]);

  /* ==========================================================================
   * CASHFREE AVAILABILITY CHECK
   *
   * IMPORTANT:
   *
   * Accessing native Cashfree methods inside Expo Go can throw:
   *
   * "react-native-cashfree-pg-api doesn't seem to be linked"
   *
   * Therefore all native access is protected by try/catch.
   * ======================================================================== */

  const setupCashfree =
    useCallback(() => {
      try {
        if (
          !CFPaymentGatewayService ||
          typeof CFPaymentGatewayService.setCallback !==
            'function'
        ) {
          setCashfreeAvailable(false);
          return false;
        }

        CFPaymentGatewayService.setCallback({
          onVerify: (
            orderId: string,
          ) => {
            console.log(
              'Cashfree verified callback:',
              orderId,
            );

            const callbackOrderId =
              String(
                orderId ||
                  currentOrderIdRef.current ||
                  '',
              ).trim();

            if (!callbackOrderId) {
              console.error(
                'Cashfree callback did not contain order ID.',
              );

              paymentInProgressRef.current =
                false;

              if (mountedRef.current) {
                setPaymentStatus(
                  'failed',
                );

                setStatusMessage(
                  'Payment callback did not return an order ID.',
                );

                Alert.alert(
                  'Payment verification error',
                  'We could not identify the Cashfree payment order. Please check your payment status before trying again.',
                );
              }

              return;
            }

            /*
             * Do not create another order.
             *
             * Always verify the existing order
             * with the backend.
             */
            void verifyPayment(
              callbackOrderId,
            );
          },

          onError: (
            error: any,
            orderId: string,
          ) => {
            console.error(
              'Cashfree payment error:',
              error,
              orderId,
            );

            const cashfreeOrderId =
              String(
                orderId ||
                  currentOrderIdRef.current ||
                  '',
              ).trim();

            console.log(
              'Cashfree failed order:',
              cashfreeOrderId,
            );

            paymentInProgressRef.current =
              false;

            if (!mountedRef.current) {
              return;
            }

            setPaymentStatus('failed');

            setStatusMessage(
              'Payment was not completed.',
            );

            Alert.alert(
              'Payment not completed',
              'Your payment was not confirmed. If money was deducted, please do not pay again immediately. Check your booking/payment status first.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (
                      mountedRef.current
                    ) {
                      setPaymentStatus(
                        'idle',
                      );

                      setStatusMessage(
                        '',
                      );
                    }
                  },
                },
              ],
            );
          },
        });

        setCashfreeAvailable(true);

        return true;
      } catch (error) {
        console.warn(
          'Cashfree native SDK is not available:',
          error,
        );

        setCashfreeAvailable(false);

        return false;
      }
    }, []);

  /* ==========================================================================
   * VERIFY PAYMENT
   * ======================================================================== */

  const verifyPayment =
    useCallback(
      async (orderId: string) => {
        const currentUser =
          userRef.current;

        if (!currentUser?._id) {
          resetPaymentState();

          Alert.alert(
            'Session error',
            'Your login session is no longer available. Please login again.',
          );

          return;
        }

        const cleanOrderId =
          String(
            orderId || '',
          ).trim();

        if (!cleanOrderId) {
          resetPaymentState();

          Alert.alert(
            'Verification error',
            'Cashfree did not return a valid order ID.',
          );

          return;
        }

        try {
          validateApiUrl();

          if (mountedRef.current) {
            setPaymentStatus(
              'verifying',
            );

            setStatusMessage(
              'Verifying your payment and confirming your booking...',
            );
          }

          const response =
            await fetch(
              `${API_BASE_URL}/payments/verify`,
              {
                method: 'POST',

                headers: {
                  'Content-Type':
                    'application/json',

                  Accept:
                    'application/json',
                },

                body: JSON.stringify({
                  orderId:
                    cleanOrderId,

                  userId:
                    currentUser._id,
                }),
              },
            );

          const data =
            await parseApiResponse(
              response,
            );

          console.log(
            'Payment verification response:',
            data,
          );

          if (
            data?.success !== true
          ) {
            throw new Error(
              data?.message ||
                'Payment could not be verified.',
            );
          }

          const bookingId =
            data.bookingId ||
            data.bookingIds?.[0] ||
            '';

          currentOrderIdRef.current =
            cleanOrderId;

          paymentInProgressRef.current =
            false;

          if (!mountedRef.current) {
            return;
          }

          setPaymentStatus(
            'success',
          );

          setStatusMessage(
            'Payment successful. Your booking has been confirmed.',
          );

          Alert.alert(
            'Booking confirmed',
            bookingId
              ? `Payment successful.\n\nBooking ID: ${bookingId}`
              : 'Payment successful and your booking has been confirmed.',
            [
              {
                text: 'VIEW HOME',

                onPress: () => {
                  navigation.reset({
                    index: 0,

                    routes: [
                      {
                        name: 'Home',
                      },
                    ],
                  });
                },
              },
            ],
          );
        } catch (error) {
          console.error(
            'Payment verification error:',
            error,
          );

          /*
           * IMPORTANT:
           *
           * Do not automatically create
           * another Cashfree order.
           *
           * Cashfree payment may already
           * have succeeded while verification
           * temporarily failed.
           */

          paymentInProgressRef.current =
            false;

          if (!mountedRef.current) {
            return;
          }

          setPaymentStatus(
            'failed',
          );

          setStatusMessage(
            'Payment verification is pending.',
          );

          Alert.alert(
            'Verification pending',
            getApiErrorMessage(
              error,
              'We could not verify the payment right now. If money was deducted, please do not pay again immediately. Check My Bookings or payment status first.',
            ),
            [
              {
                text: 'OK',

                onPress: () => {
                  if (
                    mountedRef.current
                  ) {
                    setPaymentStatus(
                      'idle',
                    );

                    setStatusMessage(
                      '',
                    );
                  }
                },
              },
            ],
          );
        }
      },
      [
        navigation,
        resetPaymentState,
      ],
    );

  /* ==========================================================================
   * CREATE CASHFREE ORDER
   * ======================================================================== */

  const createCashfreeOrder =
    useCallback(async () => {
      if (
        paymentInProgressRef.current
      ) {
        return;
      }

      if (!validateBooking()) {
        return;
      }

      /*
       * Check native Cashfree SDK.
       *
       * This prevents Expo Go from crashing.
       */
      let nativeCashfreeReady =
        cashfreeAvailable;

      if (
        nativeCashfreeReady !== true
      ) {
        nativeCashfreeReady =
          setupCashfree();
      }

      if (!nativeCashfreeReady) {
        Alert.alert(
          'Cashfree setup required',
          'The Cashfree native payment module is not available in this app build.\n\nIf you are using Expo Go, the payment screen can open, but Cashfree payment requires a development/native build containing the Cashfree SDK.',
          [
            {
              text: 'OK',
            },
          ],
        );

        return;
      }

      const currentUser =
        userRef.current;

      if (!currentUser?._id) {
        return;
      }

      try {
        validateApiUrl();

        paymentInProgressRef.current =
          true;

        if (mountedRef.current) {
          setPaymentStatus(
            'creating',
          );

          setStatusMessage(
            'Checking slot availability and creating secure payment...',
          );
        }

        /*
         * IMPORTANT:
         *
         * Do NOT trust totalAmount from frontend.
         *
         * Backend must:
         *
         * 1. Validate user.
         * 2. Validate turf.
         * 3. Validate court.
         * 4. Validate date.
         * 5. Check selected slots.
         * 6. Check availability again.
         * 7. Calculate authoritative price.
         * 8. Create Cashfree order.
         * 9. Save pending payment.
         * 10. Return paymentSessionId + orderId.
         */

        const response =
          await fetch(
            `${API_BASE_URL}/payments/create-order`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Accept:
                  'application/json',
              },

                              body: JSON.stringify({
                  userId: currentUser._id,
                  turfId,
                  courtId,
                  bookings: bookingGroups.map(booking => ({
                    date: booking.date,
                    courtId: booking.courtId || courtId,
                    slots: booking.slots.map(slot => ({
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
                    totalAmount: booking.slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0),
                  })),
                  dates: selectedDates,
                  slotCount: totalSlotCount,
                  totalAmount: displayedAmount,
                  bookingDate: bookingGroups[0]?.date,
                  slots: bookingGroups[0]?.slots.map(slot => ({
                    id: slot.id, startTime: slot.startTime, endTime: slot.endTime, price: Number(slot.price || 0),
                  })),
                }),
            },
          );

        const data =
          await parseApiResponse(
            response,
          );

        console.log(
          'Create payment order response:',
          data,
        );

        if (
          !data?.paymentSessionId
        ) {
          throw new Error(
            data?.message ||
              'Cashfree payment session was not returned by the server.',
          );
        }

        if (!data?.orderId) {
          throw new Error(
            'Cashfree order ID was not returned by the server.',
          );
        }

        const paymentSessionId =
          String(
            data.paymentSessionId,
          ).trim();

        const orderId =
          String(
            data.orderId,
          ).trim();

        if (!paymentSessionId) {
          throw new Error(
            'Invalid Cashfree payment session.',
          );
        }

        if (!orderId) {
          throw new Error(
            'Invalid Cashfree order ID.',
          );
        }

        currentOrderIdRef.current =
          orderId;

        /*
         * The backend controls the
         * actual Cashfree order amount.
         */

        const session =
          new CFSession(
            paymentSessionId,
            orderId,
            CASHFREE_ENVIRONMENT,
          );

        if (mountedRef.current) {
          setPaymentStatus(
            'processing',
          );

          setStatusMessage(
            'Opening secure Cashfree payment...',
          );
        }

        /*
         * Native call is protected.
         *
         * This is important for Expo Go.
         */
        try {
          await CFPaymentGatewayService.doWebPayment(
            session,
          );
        } catch (nativeError) {
          console.error(
            'Cashfree native payment error:',
            nativeError,
          );

          throw new Error(
            'Cashfree payment module is not available in this app build. Please use a development/native build instead of Expo Go.',
          );
        }
      } catch (error) {
        console.error(
          'Create Cashfree order error:',
          error,
        );

        paymentInProgressRef.current =
          false;

        /*
         * Keep the order ID if one was
         * created so the user does not
         * accidentally create another
         * order without checking status.
         */
        if (
          mountedRef.current
        ) {
          setPaymentStatus(
            'failed',
          );

          setStatusMessage(
            'Unable to start payment.',
          );

          Alert.alert(
            'Payment error',
            getApiErrorMessage(
              error,
              'Unable to start payment. Please try again.',
            ),
            [
              {
                text: 'OK',

                onPress: () => {
                  if (
                    mountedRef.current
                  ) {
                    setPaymentStatus(
                      'idle',
                    );

                    setStatusMessage(
                      '',
                    );
                  }
                },
              },
            ],
          );
        }
      }
    }, [
      bookingGroups,
      cashfreeAvailable,
      courtId,
      displayedAmount,
      selectedDates,
      setupCashfree,
      totalSlotCount,
      turfId,
      validateBooking,
    ]);

  /* ==========================================================================
   * CASHFREE CALLBACK SETUP
   *
   * This no longer crashes Expo Go.
   * ======================================================================== */

  useEffect(() => {
    mountedRef.current = true;

    void loadUser();

    /*
     * Try to initialize Cashfree.
     *
     * If running inside Expo Go, this will
     * safely fail instead of crashing the
     * PaymentScreen.
     */
    const available =
      setupCashfree();

    console.log(
      'Cashfree native SDK available:',
      available,
    );

    return () => {
      mountedRef.current = false;

      /*
       * Remove callback only if the
       * native SDK was actually available.
       */
      if (available) {
        try {
          if (
            CFPaymentGatewayService &&
            typeof CFPaymentGatewayService.removeCallback ===
              'function'
          ) {
            CFPaymentGatewayService.removeCallback();
          }
        } catch (error) {
          console.warn(
            'Unable to remove Cashfree callback:',
            error,
          );
        }
      }
    };
  }, [
    loadUser,
    setupCashfree,
  ]);

  /* ==========================================================================
   * PAY NOW
   * ======================================================================== */

  const handlePayNow = useCallback(() => {
    if (isBusy) return;
    if (!validateBooking()) return;

    Alert.alert(
      'Confirm payment',
      `Pay ${formatMoney(displayedAmount)} for ${totalSlotCount} ${totalSlotCount === 1 ? 'slot' : 'slots'} across ${bookingGroups.length} ${bookingGroups.length === 1 ? 'date' : 'dates'}?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'PAY NOW', onPress: createCashfreeOrder },
      ],
    );
  }, [bookingGroups.length, createCashfreeOrder, displayedAmount, isBusy, totalSlotCount, validateBooking]);

  /* ==========================================================================
   * BACK BUTTON
   * ======================================================================== */

  const handleBack =
    useCallback(() => {
      if (isBusy) {
        Alert.alert(
          'Payment in progress',
          'Please wait until the payment process is completed.',
        );

        return;
      }

      navigation.goBack();
    }, [
      isBusy,
      navigation,
    ]);

  /* ==========================================================================
   * PAYMENT STATUS UI
   * ======================================================================== */

  const renderPaymentStatus =
    () => {
      if (
        !isBusy &&
        !statusMessage
      ) {
        return null;
      }

      const isVerifying =
        paymentStatus ===
        'verifying';

      const isCreating =
        paymentStatus ===
        'creating';

      const isProcessing =
        paymentStatus ===
        'processing';

      return (
        <View
          style={[
            styles.statusCard,

            isVerifying &&
              styles.statusCardBlue,

            (isCreating ||
              isProcessing) &&
              styles.statusCardGreen,
          ]}
        >
          <View
            style={styles.statusIcon}
          >
            <ActivityIndicator
              size="small"
              color={
                isVerifying
                  ? COLORS.blueText
                  : COLORS.accent
              }
            />
          </View>

          <View
            style={styles.statusContent}
          >
            <Text
              style={[
                styles.statusTitle,

                isVerifying &&
                  styles.statusTitleBlue,
              ]}
            >
              {isVerifying
                ? 'Verifying payment'
                : isCreating
                  ? 'Creating payment'
                  : 'Processing payment'}
            </Text>

            <Text
              style={[
                styles.statusMessage,

                isVerifying &&
                  styles.statusMessageBlue,
              ]}
            >
              {statusMessage ||
                'Please wait...'}
            </Text>
          </View>
        </View>
      );
    };

  /* ==========================================================================
   * LOADING
   * ======================================================================== */

  if (loadingUser) {
    return (
      <SafeAreaView
        style={styles.container}
        edges={[
          'top',
          'left',
          'right',
          'bottom',
        ]}
      >
        <View
          style={styles.center}
        >
          <ActivityIndicator
            size="large"
            color={COLORS.accent}
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading payment...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ==========================================================================
   * SCREEN
   * ======================================================================== */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        'top',
        'left',
        'right',
        'bottom',
      ]}
    >
      {/* =====================================================================
       * HEADER
       * =================================================================== */}

      <View
        style={styles.header}
      >
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={
            handleBack
          }
          disabled={isBusy}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text
            style={[
              styles.backText,

              isBusy &&
                styles.backTextDisabled,
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>

        <Text
          style={
            styles.headerTitle
          }
        >
          Payment
        </Text>

        <View
          style={
            styles.headerRight
          }
        />
      </View>

      {/* =====================================================================
       * CONTENT
       * =================================================================== */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* ===================================================================
         * SECURE PAYMENT
         * ================================================================= */}

        <View
          style={
            styles.secureBanner
          }
        >
          <View
            style={
              styles.secureIcon
            }
          >
            <Text
              style={
                styles.lockIcon
              }
            >
              🔒
            </Text>
          </View>

          <View
            style={
              styles.secureTextBox
            }
          >
            <Text
              style={
                styles.secureTitle
              }
            >
              Secure payment
            </Text>

            <Text
              style={
                styles.secureSubtitle
              }
            >
              Your payment is
              processed securely
              by Cashfree.
            </Text>
          </View>
        </View>

        {/* ===================================================================
         * CASHFREE BUILD WARNING
         * ================================================================= */}

        {cashfreeAvailable ===
          false && (
          <View
            style={
              styles.nativeWarning
            }
          >
            <Text
              style={
                styles.nativeWarningTitle
              }
            >
              Cashfree native payment
            </Text>

            <Text
              style={
                styles.nativeWarningText
              }
            >
              This screen is working,
              but the current app build
              does not contain the
              Cashfree native module.
              Actual Cashfree payment
              requires a native
              development/production
              build.
            </Text>
          </View>
        )}

        {/* ===================================================================
         * PAYMENT STATUS
         * ================================================================= */}

        {renderPaymentStatus()}

        {/* ===================================================================
         * BOOKING SUMMARY
         * ================================================================= */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Booking summary
        </Text>

        <View
          style={
            styles.turfCard
          }
        >
          {imageUrl ? (
            <Image
              source={{
                uri: imageUrl,
              }}
              style={
                styles.turfImage
              }
              resizeMode="cover"
            />
          ) : (
            <View
              style={
                styles.imagePlaceholder
              }
            >
              <Text
                style={
                  styles.placeholderEmoji
                }
              >
                ⚽
              </Text>
            </View>
          )}

          <View
            style={
              styles.turfInfo
            }
          >
            <Text
              style={
                styles.turfName
              }
              numberOfLines={2}
            >
              {turf?.name ||
                'Turf'}
            </Text>

            <Text
              style={
                styles.courtText
              }
              numberOfLines={2}
            >
              {court?.name ||
                'Selected court'}

              {court?.sport
                ? ` • ${court.sport}`
                : ''}
            </Text>

            {!!turf?.city && (
              <Text
                style={
                  styles.locationText
                }
                numberOfLines={1}
              >
                {turf.city}
              </Text>
            )}
          </View>
        </View>

        {/* ===================================================================
         * MULTI-DATE BOOKING SUMMARY
         * ================================================================= */}
        <Text style={styles.sectionTitle}>Booking dates & slots</Text>

        <View style={styles.multiDateCard}>
          {bookingGroups.length === 0 ? (
            <View style={styles.emptySlots}>
              <Text style={styles.emptySlotsText}>No slots selected.</Text>
            </View>
          ) : (
            bookingGroups.map((booking, bookingIndex) => (
              <View key={`${booking.date}-${bookingIndex}`} style={[styles.dateGroup, bookingIndex === bookingGroups.length - 1 && styles.lastDateGroup]}>
                <View style={styles.dateGroupHeader}>
                  <View style={styles.dateBadge}><Text style={styles.dateBadgeText}>{bookingIndex + 1}</Text></View>
                  <View style={styles.dateGroupTitleBox}>
                    <Text style={styles.dateGroupTitle}>{booking.date}</Text>
                    <Text style={styles.dateGroupSubtitle}>{booking.slots.length} {booking.slots.length === 1 ? 'slot' : 'slots'}</Text>
                  </View>
                  <Text style={styles.dateGroupTotal}>{formatMoney(Number(booking.totalAmount || 0))}</Text>
                </View>

                {booking.slots.map((slot, slotIndex) => (
                  <View key={`${booking.date}-${slot.id}-${slotIndex}`} style={styles.multiDateSlotRow}>
                    <View style={styles.multiDateSlotLeft}>
                      <View style={styles.slotDot}><Text style={styles.slotDotText}>{slotIndex + 1}</Text></View>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotTime}>{slot.startTime} - {slot.endTime}</Text>
                        {slot.isNight && <View style={styles.nightBadge}><Text style={styles.nightText}>🌙 Night pricing</Text></View>}
                      </View>
                    </View>
                    <Text style={styles.slotPrice}>{formatMoney(Number(slot.price || 0))}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Selected dates</Text>
            <Text style={styles.detailValue}>{bookingGroups.length}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total slots</Text>
            <Text style={styles.detailValue}>{totalSlotCount}</Text>
          </View>
        </View>

        {/* ===================================================================
         * AMOUNT
         * ================================================================= */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Amount
        </Text>

        <View
          style={
            styles.amountCard
          }
        >
          <View
            style={
              styles.amountRow
            }
          >
            <Text
              style={
                styles.amountLabel
              }
            >
              Booking amount
            </Text>

            <Text
              style={
                styles.amountValue
              }
            >
              {formatMoney(
                displayedAmount,
              )}
            </Text>
          </View>

          <View
            style={
              styles.amountDivider
            }
          />

          <View
            style={
              styles.totalRow
            }
          >
            <Text
              style={
                styles.totalLabel
              }
            >
              Total payable
            </Text>

            <Text
              style={
                styles.totalValue
              }
            >
              {formatMoney(
                displayedAmount,
              )}
            </Text>
          </View>
        </View>

        {/* ===================================================================
         * PAYMENT INFORMATION
         * ================================================================= */}

        <View
          style={
            styles.infoBox
          }
        >
          <Text
            style={
              styles.infoTitle
            }
          >
            How payment works
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            1. Your selected slots
            are checked by the
            server.
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            2. The server
            calculates the final
            booking amount.
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            3. Cashfree opens the
            secure payment screen.
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            4. Your server verifies
            the payment.
          </Text>

          <Text
            style={
              styles.infoText
            }
          >
            5. The booking is
            confirmed only after
            successful verification.
          </Text>
        </View>

        {/* ===================================================================
         * SECURITY WARNING
         * ================================================================= */}

        <View
          style={
            styles.warningBox
          }
        >
          <Text
            style={
              styles.warningTitle
            }
          >
            Payment safety
          </Text>

          <Text
            style={
              styles.warningText
            }
          >
            If your bank account is
            charged but the booking
            confirmation does not
            appear immediately, do
            not make another payment.
            First check your
            booking/payment status.
          </Text>
        </View>

        {/* ===================================================================
         * DEVELOPMENT
         * ================================================================= */}

        {__DEV__ && (
          <View
            style={
              styles.devBox
            }
          >
            <Text
              style={
                styles.devTitle
              }
            >
              Development mode
            </Text>

            <Text
              style={
                styles.devText
              }
            >
              Cashfree environment:{' '}
              {CASHFREE_ENVIRONMENT ===
              CFEnvironment.PRODUCTION
                ? 'PRODUCTION'
                : 'SANDBOX'}
            </Text>

            <Text
              style={
                styles.devText
              }
            >
              Cashfree native SDK:{' '}
              {cashfreeAvailable ===
              true
                ? 'AVAILABLE'
                : cashfreeAvailable ===
                    false
                  ? 'NOT AVAILABLE'
                  : 'CHECKING'}
            </Text>

            <Text
              style={
                styles.devText
              }
            >
              API:{' '}
              {API_BASE_URL ||
                'Not configured'}
            </Text>

            <Text
              style={
                styles.devText
              }
            >
              User:{' '}
              {user?.name ||
                user?.email ||
                user?.phone ||
                'Not loaded'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* =====================================================================
       * BOTTOM PAYMENT BAR
       * =================================================================== */}

      <View
        style={
          styles.bottomBar
        }
      >
        <View
          style={
            styles.bottomPriceBox
          }
        >
          <Text
            style={
              styles.bottomLabel
            }
          >
            Total
          </Text>

          <Text
            style={
              styles.bottomAmount
            }
          >
            {formatMoney(
              displayedAmount,
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.payButton,

            isBusy &&
              styles.payButtonDisabled,

            (!bookingGroups.length ||
              totalSlotCount <= 0 ||
              displayedAmount <= 0) &&
              styles.payButtonDisabled,
          ]}
          onPress={
            handlePayNow
          }
          disabled={
            isBusy ||
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
              <ActivityIndicator
                color="#FFFFFF"
                size="small"
              />

              <Text
                style={
                  styles.payButtonText
                }
              >
                {paymentStatus ===
                'verifying'
                  ? 'VERIFYING...'
                  : paymentStatus ===
                      'creating'
                    ? 'CREATING...'
                    : 'PROCESSING...'}
              </Text>
            </>
          ) : (
            <>
              <Text
                style={
                  styles.payButtonText
                }
              >
                PAY NOW
              </Text>

              <Text
                style={
                  styles.payArrow
                }
              >
                →
              </Text>
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
    backgroundColor:
      COLORS.background,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },

  /* --------------------------------------------------------------------------
   * HEADER
   * ------------------------------------------------------------------------ */

  header: {
    height: 60,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },

  backText: {
    fontSize: 38,
    lineHeight: 38,
    color: COLORS.text,
    fontWeight: '300',
  },

  backTextDisabled: {
    color: COLORS.lightText,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
  },

  headerRight: {
    width: 42,
  },

  /* --------------------------------------------------------------------------
   * CONTENT
   * ------------------------------------------------------------------------ */

  content: {
    padding: 16,
    paddingBottom: 165,
  },

  /* --------------------------------------------------------------------------
   * SECURE PAYMENT
   * ------------------------------------------------------------------------ */

  secureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      COLORS.greenLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  secureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.card,
  },

  lockIcon: {
    fontSize: 19,
  },

  secureTextBox: {
    flex: 1,
    marginLeft: 12,
  },

  secureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.greenText,
  },

  secureSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.greenText,
    lineHeight: 17,
  },

  /* --------------------------------------------------------------------------
   * NATIVE WARNING
   * ------------------------------------------------------------------------ */

  nativeWarning: {
    backgroundColor:
      COLORS.orangeLight,
    borderWidth: 1,
    borderColor:
      '#FED7AA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  nativeWarningTitle: {
    color: COLORS.orangeText,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },

  nativeWarningText: {
    color: COLORS.orangeText,
    fontSize: 12,
    lineHeight: 18,
  },

  /* --------------------------------------------------------------------------
   * STATUS
   * ------------------------------------------------------------------------ */

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      COLORS.orangeLight,
    borderWidth: 1,
    borderColor:
      '#FED7AA',
    borderRadius: 14,
    padding: 13,
    marginBottom: 20,
  },

  statusCardGreen: {
    backgroundColor:
      COLORS.greenLight,
    borderColor:
      '#BBF7D0',
  },

  statusCardBlue: {
    backgroundColor:
      COLORS.blueLight,
    borderColor:
      '#BFDBFE',
  },

  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      COLORS.card,
  },

  statusContent: {
    flex: 1,
    marginLeft: 11,
  },

  statusTitle: {
    color: COLORS.orangeText,
    fontSize: 14,
    fontWeight: '800',
  },

  statusTitleBlue: {
    color: COLORS.blueText,
  },

  statusMessage: {
    marginTop: 3,
    color: COLORS.orangeText,
    fontSize: 12,
    lineHeight: 17,
  },

  statusMessageBlue: {
    color: COLORS.blueText,
  },

  /* --------------------------------------------------------------------------
   * SECTION
   * ------------------------------------------------------------------------ */

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },

  /* --------------------------------------------------------------------------
   * TURF
   * ------------------------------------------------------------------------ */

  turfCard: {
    flexDirection: 'row',
    backgroundColor:
      COLORS.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  turfImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor:
      '#E5E7EB',
  },

  imagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor:
      '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderEmoji: {
    fontSize: 30,
  },

  turfInfo: {
    flex: 1,
    paddingLeft: 12,
    justifyContent:
      'center',
  },

  turfName: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },

  courtText: {
    marginTop: 5,
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '700',
  },

  locationText: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.muted,
  },

  /* --------------------------------------------------------------------------
   * DETAILS
   * ------------------------------------------------------------------------ */

  detailCard: {
    backgroundColor:
      COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  detailRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  detailLabel: {
    color: COLORS.muted,
    fontSize: 14,
  },

  detailValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },

  divider: {
    height: 1,
    backgroundColor:
      COLORS.border,
  },

  /* --------------------------------------------------------------------------
   * SLOTS
   * ------------------------------------------------------------------------ */

  slotsCard: {
    backgroundColor:
      COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  emptySlots: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent:
      'center',
  },

  emptySlotsText: {
    color: COLORS.muted,
    fontSize: 13,
  },

  slotRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
    borderBottomWidth: 1,
    borderBottomColor:
      COLORS.border,
  },

  lastSlotRow: {
    borderBottomWidth: 0,
  },

  slotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  slotNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor:
      '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  slotNumberText: {
    color: COLORS.accent,
    fontWeight: '800',
  },

  slotInfo: {
    flex: 1,
  },

  slotTime: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  nightBadge: {
    alignSelf:
      'flex-start',
    backgroundColor:
      COLORS.purpleLight,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },

  nightText: {
    color: COLORS.purpleText,
    fontSize: 10,
    fontWeight: '700',
  },

  slotPrice: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 10,
  },

  /* --------------------------------------------------------------------------
   * AMOUNT
   * ------------------------------------------------------------------------ */

  multiDateCard: {
    backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 14,
  },
  dateGroup: { padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  lastDateGroup: { borderBottomWidth: 0 },
  dateGroupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dateBadge: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.greenLight, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateBadgeText: { color: COLORS.greenText, fontSize: 14, fontWeight: '800' },
  dateGroupTitleBox: { flex: 1 },
  dateGroupTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800' },
  dateGroupSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  dateGroupTotal: { color: COLORS.accentDark, fontSize: 15, fontWeight: '800' },
  multiDateSlotRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, backgroundColor: COLORS.background, marginTop: 6 },
  multiDateSlotLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slotDot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 9, borderWidth: 1, borderColor: COLORS.border },
  slotDotText: { color: COLORS.muted, fontSize: 11, fontWeight: '800' },

  amountCard: {
    backgroundColor:
      COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor:
      COLORS.border,
  },

  amountRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  amountLabel: {
    color: COLORS.muted,
    fontSize: 14,
  },

  amountValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },

  amountDivider: {
    height: 1,
    backgroundColor:
      COLORS.border,
    marginVertical: 14,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  totalLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
  },

  totalValue: {
    color: COLORS.accent,
    fontSize: 20,
    fontWeight: '900',
  },

  /* --------------------------------------------------------------------------
   * INFORMATION
   * ------------------------------------------------------------------------ */

  infoBox: {
    backgroundColor:
      COLORS.blueLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  infoTitle: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },

  infoText: {
    color: COLORS.blueText,
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 3,
  },

  /* --------------------------------------------------------------------------
   * WARNING
   * ------------------------------------------------------------------------ */

  warningBox: {
    backgroundColor:
      '#FFF7ED',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor:
      '#FED7AA',
  },

  warningTitle: {
    color: '#9A3412',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },

  warningText: {
    color: '#9A3412',
    fontSize: 12,
    lineHeight: 18,
  },

  /* --------------------------------------------------------------------------
   * DEVELOPMENT
   * ------------------------------------------------------------------------ */

  devBox: {
    backgroundColor:
      '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },

  devTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 5,
  },

  devText: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
  },

  /* --------------------------------------------------------------------------
   * BOTTOM BAR
   * ------------------------------------------------------------------------ */

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      COLORS.card,
    borderTopWidth: 1,
    borderTopColor:
      COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'space-between',
  },

  bottomPriceBox: {
    flex: 1,
    minWidth: 100,
  },

  bottomLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },

  bottomAmount: {
    marginTop: 2,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
  },

  payButton: {
    minWidth: 170,
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor:
      COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:
      'center',
  },

  payButtonDisabled: {
    opacity: 0.6,
  },

  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },

  payArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 10,
  },
});

export default PaymentScreen;