import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CFPaymentGatewayService,
} from 'react-native-cashfree-pg-sdk';

import {
  CFEnvironment,
  CFSession,
} from 'cashfree-pg-api-contract';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const USER_STORAGE_KEY = '@user_data';

const COLORS = {
  primary: '#111827',
  accent: '#16A34A',
  greenLight: '#DCFCE7',
  background: '#F7F8FA',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  danger: '#DC2626',
};

interface Turf {
  _id?: string;
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  images?: Array<{ url: string; isPrimary?: boolean }>;
}

interface Court {
  _id?: string;
  id?: string;
  name?: string;
  sport?: string;
}

interface BookingSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  isNight?: boolean;
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
      date: string;
      slots: BookingSlot[];
      slotCount: number;
      totalAmount: number;
    };
  };
}

const formatMoney = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN')}`;

const getImage = (turf?: Turf) => {
  const images = turf?.images || [];
  const primary = images.find((image) => image?.isPrimary && image?.url);
  return primary?.url || images.find((image) => image?.url)?.url || '';
};

const PaymentScreen: React.FC<PaymentScreenProps> = ({
  navigation,
  route,
}) => {
  const { turf, court, date, slots = [], totalAmount = 0 } = route.params;

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [paymentStarted, setPaymentStarted] = useState(false);

  const orderedSlots = useMemo(
    () =>
      [...slots].sort((a, b) =>
        String(a.startTime).localeCompare(String(b.startTime)),
      ),
    [slots],
  );

  const imageUrl = getImage(turf);

  useEffect(() => {
    loadUser();

    // Cashfree sends the final result to these callbacks.
    CFPaymentGatewayService.setCallback({
      onVerify: (orderId: string) => {
        verifyPayment(orderId);
      },
      onError: (error: any, orderId: string) => {
        console.log('Cashfree payment error:', error, orderId);
        setPaymentStarted(false);
        setCreatingOrder(false);

        Alert.alert(
          'Payment not completed',
          'Your payment was not confirmed. If money was deducted, please do not pay again until the payment status is checked.',
        );
      },
    });

    return () => {
      CFPaymentGatewayService.removeCallback();
    };
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);

      if (!stored) {
        Alert.alert('Login required', 'Please login before making a booking.', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
        return;
      }

      const parsed: User = JSON.parse(stored);

      if (!parsed?._id) {
        throw new Error('Invalid user session');
      }

      setUser(parsed);
    } catch (error) {
      console.error('Unable to load user:', error);
      Alert.alert('Session error', 'Please login again.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setLoadingUser(false);
    }
  };

  const createCashfreeOrder = async () => {
    if (!user?._id) {
      Alert.alert('Login required', 'Please login before payment.');
      return;
    }

    if (!turf?._id && !turf?.id) {
      Alert.alert('Booking error', 'Turf information is missing.');
      return;
    }

    if (!court?._id && !court?.id) {
      Alert.alert('Booking error', 'Court information is missing.');
      return;
    }

    if (!orderedSlots.length) {
      Alert.alert('Booking error', 'Please select at least one slot.');
      return;
    }

    if (Number(totalAmount) <= 0) {
      Alert.alert('Booking error', 'The booking amount is invalid.');
      return;
    }

    try {
      setCreatingOrder(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user._id,
          turfId: turf._id || turf.id,
          courtId: court._id || court.id,
          bookingDate: date,
          slots: orderedSlots.map((slot) => ({
            id: slot.id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            price: Number(slot.price || 0),
          })),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || 'Unable to create payment order.',
        );
      }

      if (!data?.paymentSessionId || !data?.orderId) {
        throw new Error('Cashfree payment session was not returned by server.');
      }

      // Sandbox while developing. Change to PRODUCTION only for the release build.
      const session = new CFSession(
        data.paymentSessionId,
        data.orderId,
        CFEnvironment.SANDBOX,
      );

      setPaymentStarted(true);

      await CFPaymentGatewayService.doWebPayment(session);
    } catch (error) {
      console.error('Create Cashfree order error:', error);
      setPaymentStarted(false);

      Alert.alert(
        'Payment error',
        error instanceof Error
          ? error.message
          : 'Unable to start payment.',
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const verifyPayment = async (orderId: string) => {
    if (!user?._id) return;

    try {
      setCreatingOrder(true);

      const response = await fetch(`${API_BASE_URL}/payments/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          userId: user._id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success !== true) {
        throw new Error(
          data?.message ||
            'Payment could not be verified. Please check your booking status.',
        );
      }

      setPaymentStarted(false);

      Alert.alert(
        'Booking confirmed',
        `Payment successful.\nBooking ID: ${
          data.bookingId || data.bookingIds?.[0] || orderId
        }`,
        [
          {
            text: 'VIEW HOME',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            },
          },
        ],
      );
    } catch (error) {
      console.error('Payment verification error:', error);
      setPaymentStarted(false);

      Alert.alert(
        'Verification pending',
        error instanceof Error
          ? error.message
          : 'We could not verify the payment yet. Please check My Bookings before trying again.',
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const handlePayNow = () => {
    if (creatingOrder || paymentStarted) return;

    Alert.alert(
      'Confirm payment',
      `Pay ${formatMoney(totalAmount)} for ${orderedSlots.length} ${
        orderedSlots.length === 1 ? 'slot' : 'slots'
      }?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'PAY NOW',
          onPress: createCashfreeOrder,
        },
      ],
    );
  };

  if (loadingUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={creatingOrder || paymentStarted}
        >
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Payment</Text>

        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.secureBanner}>
          <View style={styles.secureIcon}>
            <Text>🔒</Text>
          </View>

          <View style={styles.secureTextBox}>
            <Text style={styles.secureTitle}>Secure payment</Text>
            <Text style={styles.secureSubtitle}>
              Your payment is processed securely by Cashfree.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Booking summary</Text>

        <View style={styles.turfCard}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.turfImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderEmoji}>⚽</Text>
            </View>
          )}

          <View style={styles.turfInfo}>
            <Text style={styles.turfName} numberOfLines={2}>
              {turf?.name || 'Turf'}
            </Text>

            <Text style={styles.courtText}>
              {court?.name || 'Selected court'}
              {court?.sport ? ` • ${court.sport}` : ''}
            </Text>

            {!!turf?.city && (
              <Text style={styles.locationText}>{turf.city}</Text>
            )}
          </View>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{date}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Slots</Text>
            <Text style={styles.detailValue}>
              {orderedSlots.length} {orderedSlots.length === 1 ? 'slot' : 'slots'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Selected slots</Text>

        <View style={styles.slotsCard}>
          {orderedSlots.map((slot, index) => (
            <View key={`${slot.id}-${index}`} style={styles.slotRow}>
              <View style={styles.slotLeft}>
                <View style={styles.slotNumber}>
                  <Text style={styles.slotNumberText}>{index + 1}</Text>
                </View>

                <View>
                  <Text style={styles.slotTime}>
                    {slot.startTime} - {slot.endTime}
                  </Text>

                  {slot.isNight ? (
                    <Text style={styles.nightText}>🌙 Night pricing</Text>
                  ) : null}
                </View>
              </View>

              <Text style={styles.slotPrice}>
                {formatMoney(Number(slot.price || 0))}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Amount</Text>

        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Booking amount</Text>
            <Text style={styles.amountValue}>
              {formatMoney(totalAmount)}
            </Text>
          </View>

          <View style={styles.amountDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total payable</Text>
            <Text style={styles.totalValue}>
              {formatMoney(totalAmount)}
            </Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How payment works</Text>
          <Text style={styles.infoText}>
            1. Your selected slot is reserved by the server.
          </Text>
          <Text style={styles.infoText}>
            2. Cashfree opens the secure payment screen.
          </Text>
          <Text style={styles.infoText}>
            3. Your server verifies the payment before confirming the booking.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>Total</Text>
          <Text style={styles.bottomAmount}>
            {formatMoney(totalAmount)}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.payButton,
            (creatingOrder || paymentStarted) && styles.payButtonDisabled,
          ]}
          onPress={handlePayNow}
          disabled={creatingOrder || paymentStarted}
          activeOpacity={0.85}
        >
          {creatingOrder || paymentStarted ? (
            <>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.payButtonText}>
                {paymentStarted ? 'PROCESSING...' : 'PLEASE WAIT...'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.payButtonText}>PAY NOW</Text>
              <Text style={styles.payArrow}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 14,
  },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    fontSize: 38,
    lineHeight: 38,
    color: COLORS.text,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerRight: {
    width: 42,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
  },
  secureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.greenLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  secureIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  secureTextBox: {
    flex: 1,
    marginLeft: 12,
  },
  secureTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  secureSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  turfCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  turfImage: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  imagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
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
    backgroundColor: COLORS.border,
  },
  slotsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  slotNumberText: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  slotTime: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  nightText: {
    marginTop: 3,
    color: '#7C3AED',
    fontSize: 11,
    fontWeight: '700',
  },
  slotPrice: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
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
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  infoTitle: {
    color: '#1E3A8A',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoText: {
    color: '#1E40AF',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    opacity: 0.65,
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  payArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 10,
  },
});
  
export default PaymentScreen;