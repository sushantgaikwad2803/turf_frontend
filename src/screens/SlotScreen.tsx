import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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
   TYPES
========================================================= */

type TurfImage = {
  url?: string;
  isPrimary?: boolean;
};

type OperatingHour = {
  day?: string;
  dayOfWeek?: string;
  openingTime?: string;
  closingTime?: string;
  openTime?: string;
  closeTime?: string;
  isClosed?: boolean;
};

type TurfCourt = {
  _id?: string;
  id?: string;
  name?: string;
  courtName?: string;
  sport?: string;
  sports?: string[];
  pricePerHour?: number;
  status?: string;
  hasNightPricing?: boolean;
  nightPricePerHour?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  fullDayDiscountPercent?: number;
};

type Turf = {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  city?: string;
  address?: string;
  pricePerHour?: number;
  sports?: string[];
  amenities?: string[];
  images?: TurfImage[];
  openingTime?: string;
  closingTime?: string;
  operatingHours?: OperatingHour[];
  courts?: TurfCourt[];
};

type Slot = {
  id: string;
  bookingKey: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  price: number;
  isNight: boolean;
  booked: boolean;
};

type BookingDay = {
  date: string;
  courtId: string;
  slots: Slot[];
  slotCount: number;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  totalAmount: number;
};

type Props = {
  route: {
    params?: {
      turf?: Turf;
    };
  };
  navigation: any;
};

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
};

/* =========================================================
   CONSTANTS
========================================================= */

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || ''
).replace(/\/+$/, '');

const DEFAULT_FULL_DAY_DISCOUNT_PERCENT = 10;
const MIN_FULL_DAY_HOURS = 5;
const MAX_FULL_DAY_HOURS = 12;

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/* =========================================================
   HELPERS
========================================================= */

const getTurfId = (turf: Turf): string =>
  String(turf._id || turf.id || '');

const getCourtId = (court: TurfCourt): string =>
  String(court._id || court.id || '');

const getCourtName = (
  court: TurfCourt,
  index: number,
): string =>
  court.name ||
  court.courtName ||
  `Court ${index + 1}`;

const normalizeTime = (value?: string): string =>
  String(value || '').trim().toUpperCase();

const parseTimeToMinutes = (value?: string): number => {
  if (!value) return 0;

  const normalized = normalizeTime(value);

  if (normalized === '24:00') return 1440;

  const match = normalized.match(
    /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/,
  );

  if (!match) return 0;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3];

  if (period) {
    if (period === 'AM') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
  }

  return hour * 60 + minute;
};

const formatMinutes = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(
    minute,
  ).padStart(2, '0')}`;
};

const formatDisplayTime = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  let hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const formatCompactTime = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  let hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return minute === 0
    ? `${hour} ${suffix}`
    : `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};

const is24HourOperatingDay = (
  openingTime: string,
  closingTime: string,
): boolean => {
  const open = normalizeTime(openingTime);
  const close = normalizeTime(closingTime);
  return (
    (open === '00:00' && close === '00:00') ||
    (open === '12:00 AM' && close === '12:00 AM') ||
    (open === '00:00' && close === '24:00')
  );
};

const getOperatingHours = (
  turf: Turf,
  date: Date,
): {
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
} => {
  const dayName = DAYS[date.getDay()];

  const item = (turf.operatingHours || []).find((hour) => {
    const day = String(
      hour.dayOfWeek || hour.day || '',
    ).toLowerCase();
    return day === dayName.toLowerCase();
  });

  if (item) {
    return {
      openingTime:
        item.openingTime ||
        item.openTime ||
        turf.openingTime ||
        '06:00 AM',
      closingTime:
        item.closingTime ||
        item.closeTime ||
        turf.closingTime ||
        '11:00 PM',
      isClosed: item.isClosed === true,
    };
  }

  return {
    openingTime: turf.openingTime || '06:00 AM',
    closingTime: turf.closingTime || '11:00 PM',
    isClosed: false,
  };
};

const isNightSlot = (
  startMinutes: number,
  court: TurfCourt,
): boolean => {
  if (!court.hasNightPricing) return false;

  const startHour = Number(court.nightStartHour);
  const endHour = Number(court.nightEndHour);

  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    startHour > 23 ||
    endHour < 0 ||
    endHour > 23
  ) {
    return false;
  }

  const nightStart = startHour * 60;
  const nightEnd = endHour * 60;

  if (nightStart === nightEnd) return true;

  if (nightStart < nightEnd) {
    return startMinutes >= nightStart && startMinutes < nightEnd;
  }

  return startMinutes >= nightStart || startMinutes < nightEnd;
};

const getSlotPrice = (
  court: TurfCourt,
  turf: Turf,
  startMinutes: number,
): { price: number; isNight: boolean } => {
  const regularPrice = Number(
    court.pricePerHour ?? turf.pricePerHour ?? 0,
  );
  const night = isNightSlot(startMinutes, court);

  if (night && court.nightPricePerHour !== undefined) {
    const nightPrice = Number(court.nightPricePerHour);
    if (Number.isFinite(nightPrice)) {
      return { price: nightPrice, isNight: true };
    }
  }

  return {
    price: Number.isFinite(regularPrice) ? regularPrice : 0,
    isNight: night,
  };
};

const isPastSlot = (
  slot: Slot,
  dateString: string,
): boolean => {
  const today = formatDate(new Date());
  if (dateString !== today) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return slot.startMinutes <= currentMinutes;
};

const generateSlots = (
  turf: Turf,
  court: TurfCourt,
  date: Date,
): Slot[] => {
  const hours = getOperatingHours(turf, date);
  if (hours.isClosed) return [];

  const slots: Slot[] = [];
  const dateString = formatDate(date);
  const courtId = getCourtId(court);

  for (let start = 0; start < 1440; start += 60) {
    const end = start + 60;
    const pricing = getSlotPrice(court, turf, start);
    const bookingKey = `${dateString}_${courtId}_${start}`;

    slots.push({
      id: bookingKey,
      bookingKey,
      startTime: formatMinutes(start),
      endTime: formatMinutes(end),
      startMinutes: start,
      endMinutes: end >= 1440 ? 0 : end,
      price: pricing.price,
      isNight: pricing.isNight,
      booked: false,
    });
  }

  return slots;
};

const extractBookedSlots = (data: any): any[] => {
  if (Array.isArray(data?.bookedSlots)) return data.bookedSlots;
  if (Array.isArray(data?.slots)) {
    return data.slots.filter((slot: any) => {
      const status = String(slot.status || '').toLowerCase();
      return (
        status === 'booked' ||
        status === 'reserved' ||
        status === 'blocked'
      );
    });
  }
  if (Array.isArray(data?.data?.bookedSlots)) {
    return data.data.bookedSlots;
  }
  return [];
};

const getBookedKey = (value: any): string | null => {
  if (typeof value === 'string') return value;
  if (!value) return null;
  if (typeof value.bookingKey === 'string') return value.bookingKey;
  if (typeof value.startTime === 'string') return value.startTime;
  if (typeof value.startMinutes === 'number')
    return String(value.startMinutes);
  return null;
};

const extractApiSlots = (data: any): any[] => {
  if (Array.isArray(data?.slots)) return data.slots;
  if (Array.isArray(data?.data?.slots)) return data.data.slots;
  return [];
};

const isApiSlotUnavailable = (slot: any): boolean => {
  if (!slot) return false;
  const status = String(slot.status ?? '').trim().toLowerCase();
  return (
    slot.booked === true ||
    slot.available === false ||
    status === 'booked' ||
    status === 'reserved' ||
    status === 'blocked'
  );
};

const normalizeApiTime = (value: any): string => {
  const minutes = parseTimeToMinutes(String(value ?? ''));
  return Number.isFinite(minutes) ? formatMinutes(minutes) : '';
};

const getFullDayDiscountPercent = (
  court: TurfCourt,
): number => {
  const backendValue = Number(court.fullDayDiscountPercent);
  if (Number.isFinite(backendValue) && backendValue > 0) {
    return backendValue;
  }
  return DEFAULT_FULL_DAY_DISCOUNT_PERCENT;
};

const calculateDiscount = (
  subtotal: number,
  slotCount: number,
  court: TurfCourt,
): { discountAmount: number; discountPercent: number } => {
  if (slotCount < MIN_FULL_DAY_HOURS) {
    return { discountAmount: 0, discountPercent: 0 };
  }

  const discountPercent = getFullDayDiscountPercent(court);
  const discountAmount = Math.round(
    subtotal * (discountPercent / 100),
  );

  return { discountAmount, discountPercent };
};

const areSlotsContinuous = (slots: Slot[]): boolean => {
  if (slots.length <= 1) return true;

  const sorted = [...slots].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (curr.startMinutes === prev.endMinutes) continue;
    if (prev.endMinutes === 0 && curr.startMinutes === 0) continue;

    return false;
  }

  return true;
};

/* =========================================================
   SLOT CARD — compact with "N" night badge
========================================================= */

type SlotCardProps = {
  slot: Slot;
  selected: boolean;
  dateString: string;
  onPress: (slot: Slot) => void;
};

const SlotCard = React.memo(
  ({
    slot,
    selected,
    dateString,
    onPress,
  }: SlotCardProps) => {
    const past = isPastSlot(slot, dateString);
    const disabled = slot.booked || past;

    const statusLabel = past
      ? 'PAST'
      : slot.booked
        ? 'BOOKED'
        : selected
          ? 'SELECTED'
          : 'AVAILABLE';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => onPress(slot)}
        accessibilityRole="button"
        accessibilityLabel={`${formatDisplayTime(
          slot.startMinutes,
        )} to ${formatDisplayTime(
          slot.endMinutes,
        )}, ${statusLabel}, ₹${slot.price}`}
        accessibilityState={{ disabled, selected }}
        style={[
          styles.slotCard,
          disabled && styles.slotCardDisabled,
          selected && styles.slotCardSelected,
        ]}
      >
        {/* TOP: start time + N badge */}
        <View style={styles.slotTopRow}>
          <Text
            style={[
              styles.slotStartTime,
              disabled && styles.slotTextDisabled,
              selected && styles.slotTextSelected,
            ]}
            numberOfLines={1}
          >
            {formatCompactTime(slot.startMinutes)}
          </Text>

          {slot.isNight && (
            <View
              style={[
                styles.nightBadge,
                selected && styles.nightBadgeSelected,
                disabled && styles.nightBadgeDisabled,
              ]}
            >
              <Text
                style={[
                  styles.nightBadgeText,
                  selected && styles.nightBadgeTextSelected,
                ]}
              >
                N
              </Text>
            </View>
          )}
        </View>

        {/* END TIME */}
        <Text
          style={[
            styles.slotEndTime,
            disabled && styles.slotTextDisabled,
            selected && styles.slotTextSelected,
          ]}
          numberOfLines={1}
        >
          {formatCompactTime(slot.endMinutes)}
        </Text>

        {/* PRICE */}
        <Text
          style={[
            styles.slotPrice,
            disabled && styles.slotPriceDisabled,
            selected && styles.slotPriceSelected,
          ]}
          numberOfLines={1}
        >
          ₹{slot.price}
        </Text>

        {/* STATUS */}
        <Text
          style={[
            styles.slotStatus,
            past && styles.slotStatusPast,
            slot.booked && !past && styles.slotStatusBooked,
            selected && styles.slotStatusSelected,
          ]}
          numberOfLines={1}
        >
          {statusLabel}
        </Text>
      </TouchableOpacity>
    );
  },
);

SlotCard.displayName = 'SlotCard';

/* =========================================================
   FULL DAY MODAL
========================================================= */

type FullDayModalProps = {
  visible: boolean;
  slots: Slot[];
  selectedDate: string;
  selectedCourt?: TurfCourt;
  allowWrap: boolean;
  onClose: () => void;
  onApply: (selected: Slot[], hours: number) => void;
};

const FullDayModal = ({
  visible,
  slots,
  selectedDate,
  selectedCourt,
  allowWrap,
  onClose,
  onApply,
}: FullDayModalProps) => {
  const [startKey, setStartKey] = useState('');
  const [hours, setHours] = useState(MIN_FULL_DAY_HOURS);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setStartKey('');
      setHours(MIN_FULL_DAY_HOURS);
      setDropdownOpen(false);
    }
  }, [visible]);

  const findContinuous = useCallback(
    (startIndex: number, h: number): Slot[] => {
      if (slots.length === 0) return [];
      const result: Slot[] = [];

      if (allowWrap) {
        for (let offset = 0; offset < h; offset++) {
          const index = (startIndex + offset) % slots.length;
          const slot = slots[index];
          if (
            !slot ||
            slot.booked ||
            isPastSlot(slot, selectedDate)
          ) {
            return [];
          }
          result.push(slot);
        }
        return result;
      }

      const sliced = slots.slice(startIndex, startIndex + h);
      if (sliced.length !== h) return [];
      if (
        sliced.some(
          (s) => s.booked || isPastSlot(s, selectedDate),
        )
      ) {
        return [];
      }
      if (!areSlotsContinuous(sliced)) return [];
      return sliced;
    },
    [slots, selectedDate, allowWrap],
  );

  const availableStartSlots = useMemo(() => {
    return slots.filter((slot, index) => {
      if (slot.booked || isPastSlot(slot, selectedDate)) return false;
      return (
        findContinuous(index, MIN_FULL_DAY_HOURS).length ===
        MIN_FULL_DAY_HOURS
      );
    });
  }, [slots, selectedDate, findContinuous]);

  const startIndex = useMemo(
    () => slots.findIndex((s) => s.bookingKey === startKey),
    [slots, startKey],
  );

  const availableHours = useMemo(() => {
    if (startIndex < 0) return [];
    const result: number[] = [];
    const maxHours = Math.min(MAX_FULL_DAY_HOURS, slots.length);
    for (let h = MIN_FULL_DAY_HOURS; h <= maxHours; h++) {
      const continuous = findContinuous(startIndex, h);
      if (continuous.length === h) {
        result.push(h);
      } else if (!allowWrap) {
        break;
      }
    }
    return result;
  }, [startIndex, slots, findContinuous, allowWrap]);

  const selectedSlots = useMemo(() => {
    if (startIndex < 0) return [];
    return findContinuous(startIndex, hours);
  }, [startIndex, hours, findContinuous]);

  const startTime =
    startIndex >= 0 ? slots[startIndex]?.startMinutes ?? 0 : 0;

  const endTime = selectedSlots.length
    ? selectedSlots[selectedSlots.length - 1].endMinutes
    : 0;

  const discountPercent = selectedCourt
    ? getFullDayDiscountPercent(selectedCourt)
    : DEFAULT_FULL_DAY_DISCOUNT_PERCENT;

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.fullDayModal}>
        <View style={styles.modalHandle} />

        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Full Day Booking</Text>
            <Text style={styles.modalSmallText}>
              Minimum {MIN_FULL_DAY_HOURS} continuous hours
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.modalClose}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          <Text style={styles.modalSectionTitle}>
            1. Select Start Time
          </Text>
          <Text style={styles.modalDescription}>
            Only times with at least {MIN_FULL_DAY_HOURS} continuous
            available hours are shown.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.startRow}
          >
            {availableStartSlots.map((slot) => {
              const active = startKey === slot.bookingKey;
              return (
                <TouchableOpacity
                  key={slot.bookingKey}
                  activeOpacity={0.7}
                  style={[
                    styles.startChip,
                    active && styles.startChipActive,
                  ]}
                  onPress={() => {
                    setStartKey(slot.bookingKey);
                    setHours(MIN_FULL_DAY_HOURS);
                  }}
                >
                  <Text
                    style={[
                      styles.startChipText,
                      active && styles.startChipTextActive,
                    ]}
                  >
                    {formatDisplayTime(slot.startMinutes)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {startKey !== '' && (
            <View style={styles.rangeBox}>
              <View style={styles.rangeItem}>
                <Text style={styles.rangeLabel}>Start</Text>
                <Text style={styles.rangeValue}>
                  {formatDisplayTime(startTime)}
                </Text>
              </View>

              <View style={styles.rangeDivider} />

              <View style={styles.rangeItem}>
                <Text style={styles.rangeLabel}>End</Text>
                <Text style={styles.rangeValue}>
                  {selectedSlots.length
                    ? formatDisplayTime(endTime)
                    : '--'}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.modalSectionTitle}>
            2. Confirm Duration
          </Text>
          <Text style={styles.modalDescription}>
            Choose between {MIN_FULL_DAY_HOURS} and{' '}
            {MAX_FULL_DAY_HOURS} continuous hours.
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            disabled={!startKey}
            style={[
              styles.dropdown,
              !startKey && styles.dropdownDisabled,
            ]}
            onPress={() => setDropdownOpen((v) => !v)}
          >
            <Text style={styles.dropdownText}>{hours} hours</Text>
            <Text style={styles.dropdownArrow}>
              {dropdownOpen ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {dropdownOpen && startKey !== '' && (
            <View style={styles.dropdownList}>
              {availableHours.map((h) => {
                const active = hours === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setHours(h);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        active && styles.dropdownItemTextActive,
                      ]}
                    >
                      {h} hours
                    </Text>
                    {active && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.discountBox}>
            <Text style={styles.discountTitle}>
              🎉 {discountPercent}% Full Day Discount
            </Text>
            <Text style={styles.discountText}>
              Applied automatically for bookings of{' '}
              {MIN_FULL_DAY_HOURS}+ continuous hours.
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!startKey || availableHours.length === 0}
            style={[
              styles.applyButton,
              (!startKey || availableHours.length === 0) &&
                styles.applyButtonDisabled,
            ]}
            onPress={() => onApply(selectedSlots, hours)}
          >
            <Text style={styles.applyButtonText}>
              BOOK {hours} HOURS
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
};

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function SlotScreen({
  route,
  navigation,
}: Props) {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const turf = route.params?.turf;

  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    formatDate(new Date()),
  );
  const [selectedDates, setSelectedDates] = useState<string[]>([
    formatDate(new Date()),
  ]);
  const [slotsByDate, setSlotsByDate] = useState<
    Record<string, Slot[]>
  >({});
  const [selectedSlots, setSelectedSlots] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [fullDayMode, setFullDayMode] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const activeCourts = useMemo(() => {
    if (!turf?.courts) return [];
    return turf.courts.filter(
      (court) =>
        String(court.status || 'active').toLowerCase() === 'active',
    );
  }, [turf]);

  const selectedCourt = useMemo(
    () =>
      activeCourts.find(
        (court) => getCourtId(court) === selectedCourtId,
      ),
    [activeCourts, selectedCourtId],
  );

  useEffect(() => {
    if (!selectedCourtId && activeCourts.length > 0) {
      setSelectedCourtId(getCourtId(activeCourts[0]));
    }
  }, [activeCourts, selectedCourtId]);

  const isCurrentDate24Hours = useMemo(() => {
    if (!turf) return false;
    const hours = getOperatingHours(
      turf,
      new Date(`${selectedDate}T00:00:00`),
    );
    return is24HourOperatingDay(
      hours.openingTime,
      hours.closingTime,
    );
  }, [turf, selectedDate]);

  const loadSlots = useCallback(
    async (
      dateString: string,
      court: TurfCourt,
      silent = false,
    ): Promise<Slot[]> => {
      if (!turf) return [];
      if (!silent) setLoading(true);

      const localDate = new Date(`${dateString}T00:00:00`);
      const generated = generateSlots(turf, court, localDate).map(
        (slot) => ({
          ...slot,
          booked: isPastSlot(slot, dateString),
        }),
      );

      const fallback = () => {
        setSlotsByDate((prev) => ({
          ...prev,
          [dateString]: prev[dateString]?.length
            ? prev[dateString]
            : generated,
        }));
        return generated;
      };

      try {
        const turfId = getTurfId(turf);
        const courtId = getCourtId(court);

        if (!API_URL || !turfId || !courtId) {
          setSlotsByDate((prev) => ({
            ...prev,
            [dateString]: generated,
          }));
          return generated;
        }

        const query = new URLSearchParams({
          turfId,
          courtId,
          date: dateString,
        }).toString();

        const response = await fetch(
          `${API_URL}/slots?${query}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        );

        let data: any = null;
        try {
          data = await response.json();
        } catch {
          data = null;
        }

        if (!response.ok) return fallback();

        const booked = extractBookedSlots(data);
        const apiSlots = extractApiSlots(data);

        const bookedKeys = new Set<string>();
        booked.forEach((item) => {
          const key = getBookedKey(item);
          if (!key) return;
          bookedKeys.add(key);
          const normalized = normalizeApiTime(key);
          if (normalized) bookedKeys.add(normalized);
        });

        const apiByStart = new Map<string, any>();
        apiSlots.forEach((item) => {
          const start = normalizeApiTime(
            item?.startTime ?? item?.start ?? item?.time,
          );
          if (start) apiByStart.set(start, item);
        });

        const finalSlots = generated.map((slot) => {
          const apiSlot = apiByStart.get(slot.startTime);
          const isBooked =
            bookedKeys.has(slot.bookingKey) ||
            bookedKeys.has(slot.startTime) ||
            bookedKeys.has(String(slot.startMinutes)) ||
            isApiSlotUnavailable(apiSlot);

          const apiPrice = Number(apiSlot?.price);

          return {
            ...slot,
            price:
              Number.isFinite(apiPrice) && apiPrice >= 0
                ? apiPrice
                : slot.price,
            booked: isBooked || isPastSlot(slot, dateString),
          };
        });

        setSlotsByDate((prev) => ({
          ...prev,
          [dateString]: finalSlots,
        }));

        return finalSlots;
      } catch {
        return fallback();
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [turf],
  );

  useEffect(() => {
    if (!turf || !selectedCourt) return;
    void loadSlots(selectedDate, selectedCourt);
  }, [turf, selectedCourt, selectedDate, loadSlots]);

  const refreshAvailability = useCallback(async () => {
    if (!turf || !selectedCourt) return;
    setRefreshing(true);
    try {
      const dates = selectedDates.length ? selectedDates : [selectedDate];
      for (const date of dates) {
        await loadSlots(date, selectedCourt, true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [turf, selectedCourt, selectedDates, selectedDate, loadSlots]);

  const toggleDate = (date: string) => {
    const hasAnySelectedSlot = Object.values(selectedSlots).some(
      (keys) => Array.isArray(keys) && keys.length > 0,
    );

    setSelectedDate(date);

    if (selectedCourt) {
      void loadSlots(date, selectedCourt, true);
    }

    setSelectedDates((prev) => {
      const dateHasSlots =
        (selectedSlots[date] || []).length > 0;

      if (dateHasSlots) {
        return prev.includes(date) ? prev : [...prev, date].sort();
      }

      if (!hasAnySelectedSlot) return [date];

      return prev.filter(
        (d) => (selectedSlots[d] || []).length > 0,
      );
    });
  };

  const toggleSlot = (slot: Slot) => {
    if (slot.booked || isPastSlot(slot, selectedDate)) return;

    const date = selectedDate;

    setSelectedSlots((prev) => {
      const current = prev[date] || [];
      const already = current.includes(slot.bookingKey);

      const next = already
        ? current.filter((k) => k !== slot.bookingKey)
        : [...current, slot.bookingKey];

      setSelectedDates((prevDates) => {
        if (next.length > 0) {
          return prevDates.includes(date)
            ? prevDates
            : [...prevDates, date].sort();
        }
        const remaining = prevDates.filter((d) => d !== date);
        return remaining.length === 0 ? [date] : remaining;
      });

      return { ...prev, [date]: next };
    });
  };

  const slotsForSelectedDate = slotsByDate[selectedDate] || [];

  const selectedKeySet = useMemo(
    () => new Set(selectedSlots[selectedDate] || []),
    [selectedSlots, selectedDate],
  );

  const selectedSlotObjects = useMemo(
    () =>
      slotsForSelectedDate.filter((s) =>
        selectedKeySet.has(s.bookingKey),
      ),
    [slotsForSelectedDate, selectedKeySet],
  );

  const daySubtotals = useMemo(() => {
    const subtotal: Record<string, number> = {};
    const count: Record<string, number> = {};

    selectedDates.forEach((date) => {
      const slots = slotsByDate[date] || [];
      const keys = new Set(selectedSlots[date] || []);

      let s = 0;
      let c = 0;

      slots.forEach((slot) => {
        if (keys.has(slot.bookingKey)) {
          s += slot.price;
          c += 1;
        }
      });

      subtotal[date] = s;
      count[date] = c;
    });

    return { subtotal, count };
  }, [selectedDates, slotsByDate, selectedSlots]);

  const grandOriginalTotal = selectedDates.reduce(
    (sum, d) => sum + (daySubtotals.subtotal[d] || 0),
    0,
  );

  const totalSelectedSlots = selectedDates.reduce(
    (sum, d) => sum + (daySubtotals.count[d] || 0),
    0,
  );

  const grandDiscount = selectedCourt
    ? selectedDates.reduce((sum, date) => {
        const subtotal = daySubtotals.subtotal[date] || 0;
        const count = daySubtotals.count[date] || 0;
        return (
          sum +
          calculateDiscount(subtotal, count, selectedCourt)
            .discountAmount
        );
      }, 0)
    : 0;

  const grandTotal = Math.max(0, grandOriginalTotal - grandDiscount);

  const hasAnyFullDayStart = useMemo(() => {
    if (!selectedCourt) return false;
    const slots = slotsByDate[selectedDate] || [];

    return slots.some((slot, index) => {
      if (slot.booked) return false;

      const check = (h: number): number => {
        const result: Slot[] = [];

        if (isCurrentDate24Hours) {
          for (let o = 0; o < h; o++) {
            const idx = (index + o) % slots.length;
            const s = slots[idx];
            if (!s || s.booked || isPastSlot(s, selectedDate)) {
              return 0;
            }
            result.push(s);
          }
          return result.length;
        }

        const sliced = slots.slice(index, index + h);
        if (sliced.length !== h) return 0;
        if (
          sliced.some(
            (s) => s.booked || isPastSlot(s, selectedDate),
          )
        ) {
          return 0;
        }
        if (!areSlotsContinuous(sliced)) return 0;
        return sliced.length;
      };

      return check(MIN_FULL_DAY_HOURS) === MIN_FULL_DAY_HOURS;
    });
  }, [
    selectedCourt,
    selectedDate,
    slotsByDate,
    isCurrentDate24Hours,
  ]);

  const openFullDayModal = () => {
    if (!selectedCourt) {
      Alert.alert('Court required', 'Please select a court first.');
      return;
    }

    if (!hasAnyFullDayStart) {
      Alert.alert(
        'Full Day unavailable',
        `No ${MIN_FULL_DAY_HOURS}-hour continuous period is available. Please choose another date.`,
      );
      return;
    }

    setFullDayMode(true);
  };

  const applyFullDay = (slots: Slot[], hours: number) => {
    setSelectedSlots((prev) => ({
      ...prev,
      [selectedDate]: slots.map((s) => s.bookingKey),
    }));

    setSelectedDates((prev) =>
      prev.includes(selectedDate)
        ? prev
        : [...prev, selectedDate].sort(),
    );

    setFullDayMode(false);

    Alert.alert('Full Day Selected', `${hours} hours selected.`);
  };

  const handleBookNow = async () => {
    if (!turf || !selectedCourt) return;

    const dates = selectedDates.length ? selectedDates : [selectedDate];

    const hasSelection = dates.some((date) => {
      const keys = new Set(selectedSlots[date] || []);
      return (slotsByDate[date] || []).some((s) =>
        keys.has(s.bookingKey),
      );
    });

    if (!hasSelection) {
      Alert.alert(
        'Select slot',
        'Please select at least one available slot.',
      );
      return;
    }

    setBookingLoading(true);

    try {
      const refreshed: Record<string, Slot[]> = {};

      for (const date of dates) {
        refreshed[date] = await loadSlots(
          date,
          selectedCourt,
          true,
        );
      }

      const paymentBookings: BookingDay[] = dates
        .map((date) => {
          const fresh = refreshed[date] || [];
          const keys = new Set(selectedSlots[date] || []);
          const slots = fresh.filter(
            (s) => keys.has(s.bookingKey) && !s.booked,
          );

          const subtotal = slots.reduce(
            (sum, s) => sum + s.price,
            0,
          );

          const discount = calculateDiscount(
            subtotal,
            slots.length,
            selectedCourt,
          );

          return {
            date,
            courtId: getCourtId(selectedCourt),
            slots,
            slotCount: slots.length,
            subtotal,
            discountAmount: discount.discountAmount,
            discountPercent: discount.discountPercent,
            totalAmount: Math.max(
              0,
              subtotal - discount.discountAmount,
            ),
          };
        })
        .filter((b) => b.slots.length > 0);

      if (paymentBookings.length === 0) {
        Alert.alert(
          'Slots unavailable',
          'The selected slots are no longer available.',
        );
        setSelectedSlots({});
        return;
      }

      const originalTotal = paymentBookings.reduce(
        (s, b) => s + b.subtotal,
        0,
      );

      const discountAmount = paymentBookings.reduce(
        (s, b) => s + b.discountAmount,
        0,
      );

      const totalAmount = paymentBookings.reduce(
        (s, b) => s + b.totalAmount,
        0,
      );

      const first = paymentBookings[0];

      navigation.navigate('Payment', {
        turf,
        court: selectedCourt,
        turfId: getTurfId(turf),
        courtId: getCourtId(selectedCourt),
        bookings: paymentBookings,
        dates: paymentBookings.map((b) => b.date),
        slotCount: paymentBookings.reduce(
          (s, b) => s + b.slotCount,
          0,
        ),
        totalAmount,
        originalTotal,
        discountAmount,
        discountPercent:
          originalTotal > 0
            ? Math.round((discountAmount / originalTotal) * 100)
            : 0,
        date: first.date,
        slots: first.slots,
        isMultiDate: paymentBookings.length > 1,
        isMultiSlot: paymentBookings.some(
          (b) => b.slotCount > 1,
        ),
      });
    } catch (e: any) {
      Alert.alert(
        'Booking error',
        e?.message || 'Unable to continue.',
      );
    } finally {
      setBookingLoading(false);
    }
  };

  const visibleDates = useMemo(() => {
    const result: string[] = [];
    const start = new Date();

    for (let i = 0; i < 14; i++) {
      result.push(formatDate(addDays(start, i)));
    }

    return result;
  }, []);

  const getDateLabel = (dateString: string): string => {
    if (dateString === formatDate(new Date())) return 'Today';

    return new Date(
      `${dateString}T00:00:00`,
    ).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

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

  if (!turf) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            Turf information not found.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Select Slots</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {turf.name || 'Turf Booking'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={refreshAvailability}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Refresh"
          >
            <Text style={styles.refreshIcon}>↻</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAvailability}
              tintColor={COLORS.primaryDeep}
              colors={[COLORS.primary]}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* COURT */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Select Court</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {activeCourts.map((court, index) => {
              const id = getCourtId(court);
              const active = id === selectedCourtId;

              return (
                <TouchableOpacity
                  key={id || String(index)}
                  activeOpacity={0.85}
                  style={[
                    styles.courtChip,
                    active && styles.courtChipActive,
                  ]}
                  onPress={() => {
                    setSelectedCourtId(id);
                    setSelectedSlots({});
                  }}
                >
                  <Text
                    style={[
                      styles.courtName,
                      active && styles.courtNameActive,
                    ]}
                  >
                    {getCourtName(court, index)}
                  </Text>
                  <Text
                    style={[
                      styles.courtPrice,
                      active && styles.courtPriceActive,
                    ]}
                  >
                    ₹
                    {Number(
                      court.pricePerHour ?? turf.pricePerHour ?? 0,
                    )}
                    /hr
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* DATE */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {visibleDates.map((date) => {
              const hasSlots =
                (selectedSlots[date] || []).length > 0;

              const hasAny = Object.values(selectedSlots).some(
                (k) => k.length > 0,
              );

              const active =
                hasSlots || (!hasAny && date === selectedDate);

              return (
                <TouchableOpacity
                  key={date}
                  activeOpacity={0.85}
                  style={[
                    styles.dateChip,
                    active && styles.dateChipActive,
                  ]}
                  onPress={() => toggleDate(date)}
                >
                  <Text
                    style={[
                      styles.dateText,
                      active && styles.dateTextActive,
                    ]}
                  >
                    {getDateLabel(date)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {selectedDates.length > 1 && (
            <View style={styles.multiDateInfo}>
              <Text style={styles.multiDateInfoText}>
                {selectedDates.length} dates selected • tap dates
                to add/remove
              </Text>
            </View>
          )}

          {/* SLOT HEADER */}
          <View style={styles.slotHeader}>
            <View style={styles.slotHeaderLeft}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>
                  Available Slots
                </Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              {selectedCourt && (
                <Text style={styles.slotSubtitle}>
                  {
                    getOperatingHours(
                      turf,
                      new Date(`${selectedDate}T00:00:00`),
                    ).openingTime
                  }{' '}
                  –{' '}
                  {
                    getOperatingHours(
                      turf,
                      new Date(`${selectedDate}T00:00:00`),
                    ).closingTime
                  }
                </Text>
              )}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.fullDayButton}
              onPress={openFullDayModal}
            >
              <Text style={styles.fullDayIcon}>☀</Text>
              <Text style={styles.fullDayButtonText}>Full Day</Text>
            </TouchableOpacity>
          </View>

          {isCurrentDate24Hours && (
            <View style={styles.banner}>
              <Text style={styles.bannerIcon}>🕐</Text>
              <View style={styles.bannerTextWrap}>
                <Text style={styles.bannerTitle}>
                  24 Hours Available
                </Text>
                <Text style={styles.bannerText}>
                  Book any hour, from 12:00 AM to 12:00 AM.
                </Text>
              </View>
            </View>
          )}

          {/* SLOT GRID */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator
                size="large"
                color={COLORS.primaryDeep}
              />
              <Text style={styles.loadingText}>
                Loading slots…
              </Text>
            </View>
          ) : selectedCourt ? (
            slotsForSelectedDate.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Turf is closed</Text>
                <Text style={styles.emptyText}>
                  No booking slots are available for this date.
                </Text>
              </View>
            ) : (
              <View style={styles.slotGrid}>
                {slotsForSelectedDate.map((slot) => (
                  <SlotCard
                    key={slot.bookingKey}
                    slot={slot}
                    selected={selectedKeySet.has(slot.bookingKey)}
                    dateString={selectedDate}
                    onPress={toggleSlot}
                  />
                ))}
              </View>
            )
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                Please select a court.
              </Text>
            </View>
          )}

          {/* SELECTED INFO */}
          {selectedSlotObjects.length > 0 && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedInfoTitle}>
                Selected Slots
              </Text>
              <Text style={styles.selectedInfoText}>
                {selectedSlotObjects.length} slot
                {selectedSlotObjects.length !== 1 ? 's' : ''} on{' '}
                {getDateLabel(selectedDate)}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setSelectedSlots((p) => ({
                    ...p,
                    [selectedDate]: [],
                  }))
                }
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* MULTI-DATE SUMMARY */}
          {selectedDates.length > 1 && (
            <View style={styles.multiDateSummary}>
              <Text style={styles.summaryTitle}>Selected Dates</Text>
              {selectedDates.map((date) => (
                <View key={date} style={styles.summaryRow}>
                  <Text style={styles.summaryDate}>
                    {getDateLabel(date)}
                  </Text>
                  <Text style={styles.summaryAmount}>
                    ₹{daySubtotals.subtotal[date] || 0}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 140 }} />
        </ScrollView>

        {/* FLOATING BOOKING BAR */}
        <View style={styles.bookingBar}>
          <View style={styles.bookingBarLeft}>
            <Text style={styles.bookingCount}>
              {totalSelectedSlots} slot
              {totalSelectedSlots !== 1 ? 's' : ''}
            </Text>
            {grandDiscount > 0 && (
              <Text style={styles.originalPrice}>
                ₹{grandOriginalTotal}
              </Text>
            )}
            <Text style={styles.grandTotal}>₹{grandTotal}</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.continueButton,
              (totalSelectedSlots === 0 || bookingLoading) &&
                styles.continueButtonDisabled,
            ]}
            disabled={totalSelectedSlots === 0 || bookingLoading}
            onPress={handleBookNow}
          >
            {bookingLoading ? (
              <ActivityIndicator color={COLORS.dark} />
            ) : (
              <Text style={styles.continueText}>CONTINUE</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FULL DAY MODAL */}
        <FullDayModal
          visible={fullDayMode}
          slots={slotsForSelectedDate}
          selectedDate={selectedDate}
          selectedCourt={selectedCourt}
          allowWrap={isCurrentDate24Hours}
          onClose={() => setFullDayMode(false)}
          onApply={applyFullDay}
        />
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
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

  errorText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 17,
    color: COLORS.textPrimary,
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },

  backButtonText: {
    fontFamily: 'Poppins_900Black',
    color: COLORS.dark,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  /* HEADER */

  header: {
    height: 64,
    paddingHorizontal: 18,
    backgroundColor: COLORS.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  backArrow: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 28,
    color: COLORS.textPrimary,
    lineHeight: 30,
    marginTop: -4,
  },

  refreshIcon: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: COLORS.primaryDarker,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  headerTitle: {
    fontFamily: 'Poppins_900Black',
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  headerSubtitle: {
    fontFamily: 'Poppins_500Medium',
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  /* SCROLL */

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 140,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 12,
  },

  sectionTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 17,
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

  horizontalContent: {
    paddingRight: 10,
    gap: 10,
  },

  /* COURT CHIPS */

  courtChip: {
    minWidth: 108,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  courtChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 5,
  },

  courtName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  courtNameActive: {
    color: COLORS.dark,
  },

  courtPrice: {
    fontFamily: 'Poppins_700Bold',
    marginTop: 4,
    fontSize: 12,
    color: COLORS.primaryDarker,
  },

  courtPriceActive: {
    color: COLORS.primaryDarker,
  },

  /* DATE CHIPS */

  dateChip: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  dateChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 5,
  },

  dateText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },

  dateTextActive: {
    color: COLORS.dark,
  },

  multiDateInfo: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  multiDateInfoText: {
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.primaryDarker,
  },

  /* SLOT HEADER */

  slotHeader: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  slotHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },

  slotSubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 5,
  },

  fullDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    marginTop: 18,
  },

  fullDayIcon: {
    fontSize: 13,
    color: COLORS.warningText,
  },

  fullDayButtonText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: COLORS.warningText,
    letterSpacing: 0.3,
  },

  /* BANNER */

  banner: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    flexDirection: 'row',
    alignItems: 'center',
  },

  bannerIcon: {
    fontSize: 18,
  },

  bannerTextWrap: {
    flex: 1,
    marginLeft: 10,
  },

  bannerTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 13,
    color: COLORS.primaryDarker,
  },

  bannerText: {
    fontFamily: 'Poppins_500Medium',
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },

  /* LOADING */

  loadingBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    fontFamily: 'Poppins_600SemiBold',
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 13,
  },

  /* =====================================================
     SLOT GRID — 4 per row, compact cards with N badge
  ===================================================== */

  slotGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },

  slotCard: {
    width: '23.5%',
    height: 88,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },

  slotCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },

  slotCardDisabled: {
    backgroundColor: COLORS.bgMuted,
    borderColor: COLORS.borderLight,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    opacity: 0.7,
  },

  slotTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 3,
  },

  slotStartTime: {
    flex: 1,
    fontFamily: 'Poppins_900Black',
    fontSize: 11,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  /* =====================================================
     NIGHT BADGE — small "N" pill
  ===================================================== */

  nightBadge: {
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nightBadgeSelected: {
    backgroundColor: 'rgba(11,18,32,0.16)',
    borderColor: 'rgba(11,18,32,0.24)',
  },

  nightBadgeDisabled: {
    opacity: 0.6,
  },

  nightBadgeText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 8,
    lineHeight: 10,
    color: COLORS.warningText,
    letterSpacing: 0,
  },

  nightBadgeTextSelected: {
    color: COLORS.dark,
  },

  slotEndTime: {
    fontFamily: 'Poppins_500Medium',
    marginTop: 0,
    fontSize: 9,
    color: COLORS.textMuted,
  },

  slotPrice: {
    fontFamily: 'Poppins_900Black',
    marginTop: 3,
    fontSize: 12,
    color: COLORS.primaryDarker,
    letterSpacing: -0.2,
  },

  slotPriceSelected: {
    color: COLORS.dark,
  },

  slotPriceDisabled: {
    color: COLORS.textMuted,
  },

  slotStatus: {
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 1,
    fontSize: 7,
    color: COLORS.primaryDarker,
    letterSpacing: 0.4,
  },

  slotStatusPast: {
    color: COLORS.textMuted,
  },

  slotStatusBooked: {
    color: COLORS.dangerText,
  },

  slotStatusSelected: {
    color: COLORS.dark,
  },

  slotTextSelected: {
    color: COLORS.dark,
  },

  slotTextDisabled: {
    color: COLORS.textMuted,
  },

  /* EMPTY */

  emptyBox: {
    padding: 26,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  emptyTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  emptyText: {
    fontFamily: 'Poppins_400Regular',
    marginTop: 6,
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  /* SELECTED INFO */

  selectedInfo: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  selectedInfoTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: COLORS.primaryDarker,
  },

  selectedInfoText: {
    fontFamily: 'Poppins_500Medium',
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  clearText: {
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 10,
    fontSize: 11,
    color: COLORS.dangerText,
    letterSpacing: 0.4,
  },

  /* MULTI DATE */

  multiDateSummary: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  summaryTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 10,
  },

  summaryRow: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  summaryDate: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  summaryAmount: {
    fontFamily: 'Poppins_900Black',
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  /* FLOATING BOOKING BAR */

  bookingBar: {
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

  bookingBarLeft: {
    flex: 1,
  },

  bookingCount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
  },

  originalPrice: {
    fontFamily: 'Poppins_600SemiBold',
    marginTop: 2,
    fontSize: 11,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },

  grandTotal: {
    fontFamily: 'Poppins_900Black',
    marginTop: 1,
    fontSize: 20,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  continueButton: {
    minWidth: 145,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  continueButtonDisabled: {
    backgroundColor: COLORS.borderSoft,
    shadowOpacity: 0,
    elevation: 0,
  },

  continueText: {
    fontFamily: 'Poppins_900Black',
    color: COLORS.dark,
    fontSize: 12,
    letterSpacing: 1.2,
  },

  /* FULL DAY MODAL */

  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,18,32,0.55)',
    justifyContent: 'flex-end',
  },

  fullDayModal: {
    width: '100%',
    maxHeight: '90%',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: COLORS.card,
  },

  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  modalTitle: {
    fontFamily: 'Poppins_900Black',
    fontSize: 20,
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  modalSmallText: {
    fontFamily: 'Poppins_700Bold',
    marginTop: 4,
    fontSize: 11,
    color: COLORS.primaryDarker,
    letterSpacing: 0.3,
  },

  modalClose: {
    fontSize: 30,
    color: COLORS.textMuted,
    lineHeight: 30,
  },

  modalSectionTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 22,
    fontSize: 15,
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  modalDescription: {
    fontFamily: 'Poppins_400Regular',
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  startRow: {
    paddingTop: 14,
    paddingRight: 10,
    gap: 8,
  },

  startChip: {
    minWidth: 92,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  startChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 3,
  },

  startChipText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  startChipTextActive: {
    color: COLORS.dark,
  },

  rangeBox: {
    marginTop: 16,
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
    overflow: 'hidden',
  },

  rangeItem: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },

  rangeDivider: {
    width: 1,
    backgroundColor: COLORS.primaryMuted,
  },

  rangeLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },

  rangeValue: {
    fontFamily: 'Poppins_900Black',
    marginTop: 4,
    fontSize: 15,
    color: COLORS.primaryDarker,
  },

  dropdown: {
    marginTop: 14,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownDisabled: {
    opacity: 0.5,
  },

  dropdownText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  dropdownArrow: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  dropdownList: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  dropdownItem: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownItemActive: {
    backgroundColor: COLORS.primaryFaint,
  },

  dropdownItemText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: COLORS.textPrimary,
  },

  dropdownItemTextActive: {
    fontFamily: 'Poppins_900Black',
    color: COLORS.primaryDarker,
  },

  check: {
    fontFamily: 'Poppins_900Black',
    fontSize: 16,
    color: COLORS.primaryDarker,
  },

  discountBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  discountTitle: {
    fontFamily: 'Poppins_900Black',
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.warningText,
    letterSpacing: 0.2,
  },

  discountText: {
    fontFamily: 'Poppins_500Medium',
    marginTop: 4,
    textAlign: 'center',
    fontSize: 10,
    color: COLORS.warningText,
    lineHeight: 15,
  },

  applyButton: {
    marginTop: 20,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  applyButtonDisabled: {
    backgroundColor: COLORS.borderSoft,
    shadowOpacity: 0,
    elevation: 0,
  },

  applyButtonText: {
    fontFamily: 'Poppins_900Black',
    color: COLORS.dark,
    fontSize: 13,
    letterSpacing: 1,
  },
});