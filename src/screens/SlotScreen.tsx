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
   CONSTANTS
========================================================= */

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || ''
).replace(/\/+$/, '');

/*
 * Default full-day discount.
 *
 * If backend court contains:
 *
 * fullDayDiscountPercent
 *
 * then that value will be used instead.
 */
const DEFAULT_FULL_DAY_DISCOUNT_PERCENT = 10;

/*
 * Minimum booking for Full Day mode.
 *
 * IMPORTANT:
 * User cannot select less than 5 hours.
 */
const MIN_FULL_DAY_HOURS = 5;

/*
 * Full Day Booking is fixed to EXACTLY 5 continuous hours.
 *
 * The user can choose the starting time, but the duration is always 5 hours.
 * This applies to normal and 24-hour turfs.
 */
const MAX_FULL_DAY_HOURS = MIN_FULL_DAY_HOURS;

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

const getTurfId = (turf: Turf): string => {
  return String(turf._id || turf.id || '');
};

const getCourtId = (court: TurfCourt): string => {
  return String(court._id || court.id || '');
};

const getCourtName = (
  court: TurfCourt,
  index: number,
): string => {
  return (
    court.name ||
    court.courtName ||
    `Court ${index + 1}`
  );
};

/* =========================================================
   TIME HELPERS
========================================================= */

const normalizeTime = (
  value?: string,
): string => {
  return String(value || '')
    .trim()
    .toUpperCase();
};

const parseTimeToMinutes = (
  value?: string,
): number => {
  if (!value) {
    return 0;
  }

  const normalized = normalizeTime(value);

  /*
   * Explicit 24:00 support.
   */
  if (normalized === '24:00') {
    return 1440;
  }

  const match = normalized.match(
    /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/,
  );

  if (!match) {
    return 0;
  }

  let hour = Number(match[1]);

  const minute = Number(match[2]);

  const period = match[3];

  if (period) {
    if (period === 'AM') {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }
  }

  return hour * 60 + minute;
};

const formatMinutes = (
  minutes: number,
): string => {
  const normalized =
    ((minutes % 1440) + 1440) % 1440;

  const hour = Math.floor(
    normalized / 60,
  );

  const minute = normalized % 60;

  return `${String(hour).padStart(
    2,
    '0',
  )}:${String(minute).padStart(2, '0')}`;
};

const formatDisplayTime = (
  minutes: number,
): string => {
  const normalized =
    ((minutes % 1440) + 1440) % 1440;

  let hour = Math.floor(
    normalized / 60,
  );

  const minute = normalized % 60;

  const suffix =
    hour >= 12 ? 'PM' : 'AM';

  hour = hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return `${hour}:${String(minute).padStart(
    2,
    '0',
  )} ${suffix}`;
};

const formatDate = (
  date: Date,
): string => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const addDays = (
  date: Date,
  amount: number,
): Date => {
  const result = new Date(date);

  result.setDate(
    result.getDate() + amount,
  );

  return result;
};

/* =========================================================
   24 HOUR DETECTION
========================================================= */

const is24HourOperatingDay = (
  openingTime: string,
  closingTime: string,
): boolean => {
  const open =
    normalizeTime(openingTime);

  const close =
    normalizeTime(closingTime);

  /*
   * Supported 24-hour formats:
   *
   * 00:00 -> 00:00
   * 12:00 AM -> 12:00 AM
   * 00:00 -> 24:00
   */
  return (
    (open === '00:00' &&
      close === '00:00') ||
    (open === '12:00 AM' &&
      close === '12:00 AM') ||
    (open === '00:00' &&
      close === '24:00')
  );
};

/* =========================================================
   OPERATING HOURS
========================================================= */

const getOperatingHours = (
  turf: Turf,
  date: Date,
): {
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
} => {
  const dayName =
    DAYS[date.getDay()];

  const item = (
    turf.operatingHours || []
  ).find((hour) => {
    const day = String(
      hour.dayOfWeek ||
        hour.day ||
        '',
    ).toLowerCase();

    return (
      day === dayName.toLowerCase()
    );
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

      isClosed:
        item.isClosed === true,
    };
  }

  return {
    openingTime:
      turf.openingTime ||
      '06:00 AM',

    closingTime:
      turf.closingTime ||
      '11:00 PM',

    isClosed: false,
  };
};

/* =========================================================
   NIGHT PRICING
========================================================= */

const isNightSlot = (
  startMinutes: number,
  court: TurfCourt,
): boolean => {
  if (!court.hasNightPricing) {
    return false;
  }

  const startHour = Number(
    court.nightStartHour,
  );

  const endHour = Number(
    court.nightEndHour,
  );

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

  const nightStart =
    startHour * 60;

  const nightEnd =
    endHour * 60;

  /*
   * Same start/end means full-day night pricing.
   */
  if (nightStart === nightEnd) {
    return true;
  }

  /*
   * Normal range.
   */
  if (nightStart < nightEnd) {
    return (
      startMinutes >= nightStart &&
      startMinutes < nightEnd
    );
  }

  /*
   * Overnight range.
   *
   * Example:
   * 22:00 -> 06:00
   */
  return (
    startMinutes >= nightStart ||
    startMinutes < nightEnd
  );
};

/* =========================================================
   SLOT PRICE
========================================================= */

const getSlotPrice = (
  court: TurfCourt,
  turf: Turf,
  startMinutes: number,
): {
  price: number;
  isNight: boolean;
} => {
  const regularPrice = Number(
    court.pricePerHour ??
      turf.pricePerHour ??
      0,
  );

  const night = isNightSlot(
    startMinutes,
    court,
  );

  if (
    night &&
    court.nightPricePerHour !==
      undefined
  ) {
    const nightPrice = Number(
      court.nightPricePerHour,
    );

    if (
      Number.isFinite(nightPrice)
    ) {
      return {
        price: nightPrice,
        isNight: true,
      };
    }
  }

  return {
    price: Number.isFinite(
      regularPrice,
    )
      ? regularPrice
      : 0,

    isNight: night,
  };
};

/* =========================================================
   GENERATE SLOTS
========================================================= */

const generateSlots = (
  turf: Turf,
  court: TurfCourt,
  date: Date,
): Slot[] => {
  const hours = getOperatingHours(turf, date);

  if (hours.isClosed) {
    return [];
  }

  /*
   * =======================================================
   * 24-HOUR SLOT MODE ONLY
   * =======================================================
   *
   * SlotScreen always renders exactly 24 one-hour slots for
   * an open day. The backend /api/slots response is used only
   * to update availability/status/price.
   *
   * 00:00 -> 01:00
   * 01:00 -> 02:00
   * ...
   * 22:00 -> 23:00
   * 23:00 -> 00:00
   */
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

/* =========================================================
   API BOOKED SLOTS
========================================================= */

const extractBookedSlots = (
  data: any,
): any[] => {
  if (
    Array.isArray(
      data?.bookedSlots,
    )
  ) {
    return data.bookedSlots;
  }

  if (
    Array.isArray(data?.slots)
  ) {
    return data.slots.filter(
      (slot: any) => {
        const status =
          String(
            slot.status || '',
          ).toLowerCase();

        return (
          status === 'booked' ||
          status === 'reserved'
        );
      },
    );
  }

  if (
    Array.isArray(
      data?.data?.bookedSlots,
    )
  ) {
    return data.data.bookedSlots;
  }

  return [];
};

const getBookedKey = (
  value: any,
): string | null => {
  if (
    typeof value === 'string'
  ) {
    return value;
  }

  if (!value) {
    return null;
  }

  if (
    typeof value.bookingKey ===
    'string'
  ) {
    return value.bookingKey;
  }

  if (
    typeof value.startTime ===
    'string'
  ) {
    return value.startTime;
  }

  if (
    typeof value.startMinutes ===
    'number'
  ) {
    return String(
      value.startMinutes,
    );
  }

  return null;
};

const extractApiSlots = (data: any): any[] => {
  if (Array.isArray(data?.slots)) {
    return data.slots;
  }

  if (Array.isArray(data?.data?.slots)) {
    return data.data.slots;
  }

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

/* =========================================================
   DISCOUNT
========================================================= */

const getFullDayDiscountPercent = (
  court: TurfCourt,
): number => {
  const backendValue = Number(
    court.fullDayDiscountPercent,
  );

  if (
    Number.isFinite(
      backendValue,
    ) &&
    backendValue > 0
  ) {
    return backendValue;
  }

  return (
    DEFAULT_FULL_DAY_DISCOUNT_PERCENT
  );
};

const calculateDiscount = (
  subtotal: number,
  slotCount: number,
  court: TurfCourt,
): {
  discountAmount: number;
  discountPercent: number;
} => {
  /*
   * Minimum 5 hours.
   */
  if (
    slotCount <
    MIN_FULL_DAY_HOURS
  ) {
    return {
      discountAmount: 0,
      discountPercent: 0,
    };
  }

  const discountPercent =
    getFullDayDiscountPercent(
      court,
    );

  const discountAmount =
    Math.round(
      subtotal *
        (discountPercent /
          100),
    );

  return {
    discountAmount,
    discountPercent,
  };
};

/* =========================================================
   CHECK CONTIGUOUS SLOTS
========================================================= */

/*
 * Returns true when the selected slots form
 * continuous hourly booking.
 */
const areSlotsContinuous = (
  slots: Slot[],
): boolean => {
  if (slots.length <= 1) {
    return true;
  }

  const sorted = [
    ...slots,
  ].sort(
    (a, b) =>
      a.startMinutes -
      b.startMinutes,
  );

  for (
    let index = 1;
    index < sorted.length;
    index++
  ) {
    const previous =
      sorted[index - 1];

    const current =
      sorted[index];

    /*
     * Normal continuous case.
     */
    if (
      current.startMinutes ===
      previous.endMinutes
    ) {
      continue;
    }

    /*
     * 24-hour midnight case:
     *
     * 23:00 -> 00:00
     */
    if (
      previous.endMinutes ===
        0 &&
      current.startMinutes ===
        0
    ) {
      continue;
    }

    return false;
  }

  return true;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function SlotScreen({
  route,
  navigation,
}: Props) {
  const turf =
    route.params?.turf;

  const [
    selectedCourtId,
    setSelectedCourtId,
  ] = useState<string>('');

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string>(
    formatDate(new Date()),
  );

  const [
    selectedDates,
    setSelectedDates,
  ] = useState<string[]>([
    formatDate(new Date()),
  ]);

  const [
    slotsByDate,
    setSlotsByDate,
  ] = useState<
    Record<string, Slot[]>
  >({});

  const [
    selectedSlots,
    setSelectedSlots,
  ] = useState<
    Record<string, string[]>
  >({});

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    bookingLoading,
    setBookingLoading,
  ] = useState(false);

  const [
    multiDateMode,
    setMultiDateMode,
  ] = useState(false);

  /*
   * Full day modal.
   */
  const [
    fullDayMode,
    setFullDayMode,
  ] = useState(false);

  /*
   * User-selected start slot.
   */
  const [
    fullDayStartKey,
    setFullDayStartKey,
  ] = useState<string>('');

  /*
   * User-selected number of hours.
   *
   * Minimum = 5.
   */
  const [
    fullDayHours,
    setFullDayHours,
  ] = useState(
    MIN_FULL_DAY_HOURS,
  );

  const [
    showSummary,
    setShowSummary,
  ] = useState(false);

  /* =======================================================
     ACTIVE COURTS
  ======================================================= */

  const activeCourts =
    useMemo(() => {
      if (!turf?.courts) {
        return [];
      }

      return turf.courts.filter(
        (court) =>
          String(
            court.status ||
              'active',
          ).toLowerCase() ===
          'active',
      );
    }, [turf]);

  /* =======================================================
     SELECTED COURT
  ======================================================= */

  const selectedCourt =
    useMemo(() => {
      return activeCourts.find(
        (court) =>
          getCourtId(court) ===
          selectedCourtId,
      );
    }, [
      activeCourts,
      selectedCourtId,
    ]);

  /* =======================================================
     DEFAULT COURT
  ======================================================= */

  useEffect(() => {
    if (
      !selectedCourtId &&
      activeCourts.length > 0
    ) {
      setSelectedCourtId(
        getCourtId(
          activeCourts[0],
        ),
      );
    }
  }, [
    activeCourts,
    selectedCourtId,
  ]);

  /* =======================================================
     LOAD SLOTS
  ======================================================= */

  const loadSlots =
    useCallback(
      async (
        dateString: string,
        court: TurfCourt,
        silent = false,
      ): Promise<Slot[]> => {
        if (!turf) {
          return [];
        }

        if (!silent) {
          setLoading(true);
        }

        try {
          const localDate =
            new Date(
              `${dateString}T00:00:00`,
            );

          const generated =
            generateSlots(
              turf,
              court,
              localDate,
            );

          /*
           * If API URL doesn't exist,
           * use locally generated slots.
           */
          if (!API_URL) {
            setSlotsByDate(
              (previous) => ({
                ...previous,
                [dateString]:
                  generated,
              }),
            );

            return generated;
          }

          const turfId =
            getTurfId(turf);

          const courtId =
            getCourtId(court);

          const url =
            `${API_URL}/api/slots?` +
            `turfId=${encodeURIComponent(
              turfId,
            )}` +
            `&courtId=${encodeURIComponent(
              courtId,
            )}` +
            `&date=${encodeURIComponent(
              dateString,
            )}`;

          const response =
            await fetch(url);

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data?.message ||
                'Failed to load slots',
            );
          }

          const booked = extractBookedSlots(data);
          const apiSlots = extractApiSlots(data);

          const bookedKeys = new Set<string>();
          booked.forEach((item) => {
            const key = getBookedKey(item);
            if (key) bookedKeys.add(key);
          });

          const apiByStartTime = new Map<string, any>();
          apiSlots.forEach((item) => {
            const start = normalizeApiTime(item?.startTime);
            if (start) apiByStartTime.set(start, item);
          });

          const finalSlots = generated.map((slot) => {
            const apiSlot = apiByStartTime.get(slot.startTime);

            const isBooked =
              bookedKeys.has(slot.bookingKey) ||
              bookedKeys.has(slot.startTime) ||
              bookedKeys.has(String(slot.startMinutes)) ||
              isApiSlotUnavailable(apiSlot);

            const apiPrice = Number(apiSlot?.price);

            return {
              ...slot,
              price: Number.isFinite(apiPrice) && apiPrice >= 0
                ? apiPrice
                : slot.price,
              booked: isBooked,
            };
          });

          setSlotsByDate(
            (previous) => ({
              ...previous,
              [dateString]:
                finalSlots,
            }),
          );

          return finalSlots;
        } catch (error: any) {
          if (!silent) {
            Alert.alert(
              'Slots',
              error?.message ||
                'Unable to load slots.',
            );
          }

          const fallback =
            generateSlots(
              turf,
              court,
              new Date(
                `${dateString}T00:00:00`,
              ),
            );

          setSlotsByDate(
            (previous) => ({
              ...previous,
              [dateString]:
                previous[dateString] ||
                fallback,
            }),
          );

          return (
            slotsByDate[dateString] ||
            fallback
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [turf],
    );

  /* =======================================================
     LOAD CURRENT DATE
  ======================================================= */

  useEffect(() => {
    if (!turf || !selectedCourt) {
      return;
    }

    /*
     * Always load the active date. This is required in both modes:
     * - Single Date: one active date
     * - Multiple Dates: the tapped date is the active date while all
     *   selected dates remain in selectedDates for payment.
     */
    void loadSlots(
      selectedDate,
      selectedCourt,
    );
  }, [
    turf,
    selectedCourt,
    selectedDate,
    loadSlots,
  ]);

  /* =======================================================
     REFRESH
  ======================================================= */

  const refreshAvailability =
    useCallback(
      async () => {
        if (
          !turf ||
          !selectedCourt
        ) {
          return;
        }

        setRefreshing(true);

        try {
          const dates =
            multiDateMode
              ? selectedDates
              : [selectedDate];

          for (
            const date of dates
          ) {
            await loadSlots(
              date,
              selectedCourt,
              true,
            );
          }
        } finally {
          setRefreshing(false);
        }
      },
      [
        turf,
        selectedCourt,
        multiDateMode,
        selectedDates,
        selectedDate,
        loadSlots,
      ],
    );

  /* =======================================================
     DATE SELECTION
  ======================================================= */

  const toggleDate = (
    date: string,
  ) => {
    /*
     * SINGLE DATE MODE
     * -----------------
     * Only the tapped date remains active.
     * Any selections belonging to other dates are removed so they
     * can never accidentally reach Payment after switching back
     * from Multiple Dates.
     */
    if (!multiDateMode) {
      setSelectedDate(date);
      setSelectedDates([date]);

      setSelectedSlots((previous) => ({
        [date]: previous[date] || [],
      }));

      if (selectedCourt) {
        void loadSlots(date, selectedCourt, true);
      }

      return;
    }

    /*
     * MULTIPLE DATE MODE
     * ------------------
     * Tap once = add date.
     * Tap again = remove date.
     * At least one date always stays selected.
     * The tapped date becomes the active date whose slots are shown.
     */
    setSelectedDates((previous) => {
      if (previous.includes(date)) {
        if (previous.length === 1) {
          return previous;
        }

        const next = previous
          .filter((item) => item !== date)
          .sort();

        /* If the currently displayed date was removed, move the
           slot view to another still-selected date. */
        if (selectedDate === date) {
          const nextActiveDate = next[0];
          if (nextActiveDate) {
            setSelectedDate(nextActiveDate);
            if (selectedCourt) {
              void loadSlots(
                nextActiveDate,
                selectedCourt,
                true,
              );
            }
          }
        }

        return next;
      }

      const next = [...previous, date].sort();

      setSelectedDate(date);

      if (selectedCourt) {
        void loadSlots(date, selectedCourt, true);
      }

      return next;
    });
  };

  /* =======================================================
     SLOT SELECTION
  ======================================================= */

  const toggleSlot = (
    slot: Slot,
  ) => {
    if (slot.booked) {
      return;
    }

    const date =
      selectedDate;

    setSelectedSlots(
      (previous) => {
        const current =
          previous[date] || [];

        if (
          current.includes(
            slot.bookingKey,
          )
        ) {
          return {
            ...previous,
            [date]:
              current.filter(
                (key) =>
                  key !==
                  slot.bookingKey,
              ),
          };
        }

        return {
          ...previous,

          [date]: [
            ...current,
            slot.bookingKey,
          ],
        };
      },
    );
  };

  /* =======================================================
     SELECTED SLOT OBJECTS
  ======================================================= */

  const selectedSlotObjects =
    useMemo(() => {
      const slots =
        slotsByDate[
          selectedDate
        ] || [];

      const selected =
        new Set(
          selectedSlots[
            selectedDate
          ] || [],
        );

      return slots.filter(
        (slot) =>
          selected.has(
            slot.bookingKey,
          ),
      );
    }, [
      slotsByDate,
      selectedDate,
      selectedSlots,
    ]);

  /* =======================================================
     DAY SUBTOTAL
  ======================================================= */

  const getDaySubtotal = (
    date: string,
  ): number => {
    const slots =
      slotsByDate[date] || [];

    const selected =
      new Set(
        selectedSlots[date] ||
          [],
      );

    return slots
      .filter((slot) =>
        selected.has(
          slot.bookingKey,
        ),
      )
      .reduce(
        (sum, slot) =>
          sum + slot.price,
        0,
      );
  };

  /* =======================================================
     DAY SLOTS
  ======================================================= */

  const getDaySlots = (
    date: string,
  ): Slot[] => {
    const slots =
      slotsByDate[date] || [];

    const selected =
      new Set(
        selectedSlots[date] ||
          [],
      );

    return slots.filter(
      (slot) =>
        selected.has(
          slot.bookingKey,
        ),
    );
  };

  /* =======================================================
     TOTALS
  ======================================================= */

  const grandOriginalTotal =
    selectedDates.reduce(
      (sum, date) =>
        sum +
        getDaySubtotal(date),
      0,
    );

  const totalSelectedSlots =
    selectedDates.reduce(
      (sum, date) =>
        sum +
        getDaySlots(date).length,
      0,
    );

  const grandDiscount =
    selectedCourt
      ? selectedDates.reduce(
          (sum, date) => {
            const subtotal =
              getDaySubtotal(
                date,
              );

            const count =
              getDaySlots(
                date,
              ).length;

            return (
              sum +
              calculateDiscount(
                subtotal,
                count,
                selectedCourt,
              ).discountAmount
            );
          },
          0,
        )
      : 0;

  const grandTotal =
    Math.max(
      0,
      grandOriginalTotal -
        grandDiscount,
    );

  /* =======================================================
     CLEAR DATE
  ======================================================= */

  const clearSelectionForDate = (
    date: string,
  ) => {
    setSelectedSlots(
      (previous) => ({
        ...previous,
        [date]: [],
      }),
    );
  };

  /* =======================================================
     FULL DAY AVAILABLE START TIMES
  ======================================================= */

  const fullDayAvailableSlots =
    useMemo(() => {
      if (!selectedCourt) {
        return [];
      }

      return (
        slotsByDate[
          selectedDate
        ] || []
      ).filter(
        (slot) =>
          !slot.booked,
      );
    }, [
      slotsByDate,
      selectedDate,
      selectedCourt,
    ]);

  /* =======================================================
     IS 24 HOUR CURRENT DATE
  ======================================================= */

  const isCurrentDate24Hours = useMemo(() => {
    /* SlotScreen is intentionally 24-hour only. */
    return Boolean(turf);
  }, [turf]);

  /* =======================================================
     FIND CONTINUOUS BOOKING
  ======================================================= */

  const getContinuousSlots = (
    startIndex: number,
    hours: number,
  ): Slot[] => {
    const slots =
      slotsByDate[
        selectedDate
      ] || [];

    if (
      slots.length === 0
    ) {
      return [];
    }

    /*
     * 24-hour turf can wrap:
     *
     * 22:00
     * 23:00
     * 00:00
     * 01:00
     * 02:00
     */
    if (isCurrentDate24Hours) {
      const result: Slot[] = [];

      for (
        let offset = 0;
        offset < hours;
        offset++
      ) {
        const index =
          (startIndex +
            offset) %
          slots.length;

        const slot =
          slots[index];

        if (
          !slot ||
          slot.booked
        ) {
          return [];
        }

        result.push(slot);
      }

      return result;
    }

    /*
     * Normal turf cannot wrap around.
     */
    const result =
      slots.slice(
        startIndex,
        startIndex + hours,
      );

    if (
      result.length !== hours
    ) {
      return [];
    }

    if (
      result.some(
        (slot) => slot.booked,
      )
    ) {
      return [];
    }

    if (
      !areSlotsContinuous(
        result,
      )
    ) {
      return [];
    }

    return result;
  };

  /* =======================================================
     AVAILABLE HOURS FOR SELECTED START
  ======================================================= */

  const availableHoursForStart =
    useMemo(() => {
      if (
        !fullDayStartKey
      ) {
        return [];
      }

      const slots =
        slotsByDate[
          selectedDate
        ] || [];

      const startIndex =
        slots.findIndex(
          (slot) =>
            slot.bookingKey ===
            fullDayStartKey,
        );

      if (
        startIndex < 0
      ) {
        return [];
      }

      const result: number[] =
        [];

      const maxHours =
        Math.min(
          MAX_FULL_DAY_HOURS,
          slots.length,
        );

      for (
        let hours =
          MIN_FULL_DAY_HOURS;
        hours <= maxHours;
        hours++
      ) {
        const continuous =
          getContinuousSlots(
            startIndex,
            hours,
          );

        if (
          continuous.length ===
          hours
        ) {
          result.push(hours);
        } else {
          /*
           * Once continuity breaks,
           * larger durations also won't
           * work for a normal turf.
           *
           * For 24-hour turf, a booked
           * slot can also break it.
           */
          if (
            !isCurrentDate24Hours
          ) {
            break;
          }
        }
      }

      return result;
    }, [
      fullDayStartKey,
      slotsByDate,
      selectedDate,
      isCurrentDate24Hours,
    ]);

  /* =======================================================
     FULL DAY START SELECTION
  ======================================================= */

  const selectFullDayStart = (
    slot: Slot,
  ) => {
    if (slot.booked) {
      return;
    }

    setFullDayStartKey(
      slot.bookingKey,
    );

    /*
     * Reset to minimum 5 hours
     * whenever start time changes.
     */
    setFullDayHours(
      MIN_FULL_DAY_HOURS,
    );
  };

  /* =======================================================
     APPLY CUSTOM FULL DAY
  ======================================================= */

  const applyFullDayBooking =
    () => {
      if (!selectedCourt) {
        Alert.alert(
          'Court required',
          'Please select a court first.',
        );

        return;
      }

      if (
        !fullDayStartKey
      ) {
        Alert.alert(
          'Start time required',
          'Please select your Full Day starting time.',
        );

        return;
      }

      if (
        fullDayHours !==
        MIN_FULL_DAY_HOURS
      ) {
        Alert.alert(
          '5 Hours Required',
          'Full Day Booking is available for exactly 5 continuous hours.',
        );

        return;
      }

      const slots =
        slotsByDate[
          selectedDate
        ] || [];

      const startIndex =
        slots.findIndex(
          (slot) =>
            slot.bookingKey ===
            fullDayStartKey,
        );

      if (
        startIndex < 0
      ) {
        Alert.alert(
          'Start time unavailable',
          'Please select another starting time.',
        );

        return;
      }

      const selected =
        getContinuousSlots(
          startIndex,
          fullDayHours,
        );

      /*
       * IMPORTANT:
       * All slots must be available.
       */
      if (
        selected.length !==
        fullDayHours
      ) {
        Alert.alert(
          'Slots unavailable',
          `The selected ${fullDayHours}-hour period contains a booked slot. Please choose another starting time or duration.`,
        );

        return;
      }

      /*
       * Apply selected continuous slots.
       */
      setSelectedSlots(
        (previous) => ({
          ...previous,
          [selectedDate]:
            selected.map(
              (slot) =>
                slot.bookingKey,
            ),
        }),
      );

      setFullDayMode(false);

      Alert.alert(
        'Full Day Selected',
        `${fullDayHours} hours selected from ${formatDisplayTime(
          selected[0]
            .startMinutes,
        )}.`,
      );
    };

  /* =======================================================
     OPEN FULL DAY MODAL
  ======================================================= */

  const openFullDayModal = () => {
    if (!selectedCourt) {
      Alert.alert(
        'Court required',
        'Please select a court first.',
      );

      return;
    }

    if (
      fullDayAvailableSlots.length <
      MIN_FULL_DAY_HOURS
    ) {
      Alert.alert(
        'Not enough slots',
        `At least ${MIN_FULL_DAY_HOURS} consecutive available hours are required for Full Day Booking.`,
      );

      return;
    }

    /*
     * Reset previous Full Day
     * selection.
     */
    setFullDayStartKey('');

    setFullDayHours(
      MIN_FULL_DAY_HOURS,
    );

    setFullDayMode(true);
  };

  /* =======================================================
     BOOK NOW
  ======================================================= */

  const handleBookNow =
    async () => {
      if (!turf) {
        return;
      }

      if (!selectedCourt) {
        Alert.alert(
          'Court required',
          'Please select a court.',
        );

        return;
      }

      const dates =
        multiDateMode
          ? selectedDates
          : [selectedDate];

      const hasSelection =
        dates.some(
          (date) =>
            getDaySlots(date)
              .length > 0,
        );

      if (!hasSelection) {
        Alert.alert(
          'Select slot',
          'Please select at least one available slot.',
        );

        return;
      }

      /*
       * Validate each selected day.
       */
      for (
        const date of dates
      ) {
        const daySlots =
          getDaySlots(date);

        if (
          daySlots.length === 0
        ) {
          continue;
        }

        if (
          daySlots.some(
            (slot) =>
              slot.booked,
          )
        ) {
          Alert.alert(
            'Slot unavailable',
            `One of the selected slots on ${date} is no longer available.`,
          );

          return;
        }
      }

      setBookingLoading(true);

      try {
        /*
         * Refresh selected dates immediately
         * before payment.
         */
        const refreshedSlotsByDate:
          Record<
            string,
            Slot[]
          > = {};

        for (
          const date of dates
        ) {
          refreshedSlotsByDate[
            date
          ] = await loadSlots(
            date,
            selectedCourt,
            true,
          );
        }

        /*
         * Build payment data from fresh
         * availability.
         */
        const paymentBookings:
          BookingDay[] = dates
          .map((date) => {
            const freshSlots =
              refreshedSlotsByDate[
                date
              ] || [];

            const selectedKeys =
              new Set(
                selectedSlots[
                  date
                ] || [],
              );

            const slots =
              freshSlots.filter(
                (slot) =>
                  selectedKeys.has(
                    slot.bookingKey,
                  ) &&
                  !slot.booked,
              );

            const subtotal =
              slots.reduce(
                (sum, slot) =>
                  sum +
                  slot.price,
                0,
              );

            const discount =
              calculateDiscount(
                subtotal,
                slots.length,
                selectedCourt,
              );

            return {
              date,

              courtId:
                getCourtId(
                  selectedCourt,
                ),

              slots,

              slotCount:
                slots.length,

              subtotal,

              discountAmount:
                discount.discountAmount,

              discountPercent:
                discount.discountPercent,

              totalAmount:
                Math.max(
                  0,
                  subtotal -
                    discount.discountAmount,
                ),
            };
          })
          .filter(
            (booking) =>
              booking.slots.length >
              0,
          );

        if (
          paymentBookings.length ===
          0
        ) {
          Alert.alert(
            'Slots unavailable',
            'The selected slots are no longer available. Please select them again.',
          );

          /*
           * Remove stale selections.
           */
          setSelectedSlots({});

          return;
        }

        const originalTotal =
          paymentBookings.reduce(
            (sum, booking) =>
              sum +
              booking.subtotal,
            0,
          );

        const discountAmount =
          paymentBookings.reduce(
            (sum, booking) =>
              sum +
              booking.discountAmount,
            0,
          );

        const totalAmount =
          paymentBookings.reduce(
            (sum, booking) =>
              sum +
              booking.totalAmount,
            0,
          );

        const firstBooking =
          paymentBookings[0];

        /*
         * Navigate to Payment.
         */
        navigation.navigate(
          'Payment',
          {
            turf,

            court:
              selectedCourt,

            turfId:
              getTurfId(turf),

            courtId:
              getCourtId(
                selectedCourt,
              ),

            bookings:
              paymentBookings,

            dates:
              paymentBookings.map(
                (booking) =>
                  booking.date,
              ),

            slotCount:
              paymentBookings.reduce(
                (
                  sum,
                  booking,
                ) =>
                  sum +
                  booking.slotCount,
                0,
              ),

            totalAmount,

            originalTotal,

            discountAmount,

            discountPercent:
              originalTotal > 0
                ? Math.round(
                    (discountAmount /
                      originalTotal) *
                      100,
                  )
                : 0,

            date:
              firstBooking.date,

            slots:
              firstBooking.slots,

            isMultiDate:
              paymentBookings.length >
              1,

            isMultiSlot:
              paymentBookings.some(
                (booking) =>
                  booking.slotCount >
                  1,
              ),
          },
        );
      } catch (error: any) {
        Alert.alert(
          'Booking error',
          error?.message ||
            'Unable to continue with booking.',
        );
      } finally {
        setBookingLoading(false);
      }
    };

  /* =======================================================
     VISIBLE DATES
  ======================================================= */

  const visibleDates =
    useMemo(() => {
      const result: string[] =
        [];

      const start =
        new Date();

      for (
        let index = 0;
        index < 14;
        index++
      ) {
        result.push(
          formatDate(
            addDays(
              start,
              index,
            ),
          ),
        );
      }

      return result;
    }, []);

  /* =======================================================
     DATE LABEL
  ======================================================= */

  const getDateLabel = (
    dateString: string,
  ): string => {
    const date =
      new Date(
        `${dateString}T00:00:00`,
      );

    if (
      dateString ===
      formatDate(new Date())
    ) {
      return 'Today';
    }

    return date.toLocaleDateString(
      'en-IN',
      {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      },
    );
  };

  /* =======================================================
     NO TURF
  ======================================================= */

  if (!turf) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.center}
        >
          <Text
            style={
              styles.errorText
            }
          >
            Turf information not found.
          </Text>

          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* =========================================================
     RENDER
  ========================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        'top',
        'bottom',
      ]}
    >
      <View
        style={styles.container}
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <View
          style={styles.header}
        >
          <TouchableOpacity
            style={
              styles.headerBack
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text
              style={
                styles.headerBackText
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.headerCenter
            }
          >
            <Text
              style={
                styles.headerTitle
              }
              numberOfLines={1}
            >
              Select Slots
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
              numberOfLines={1}
            >
              {turf.name ||
                'Turf Booking'}
            </Text>
          </View>

          <TouchableOpacity
            style={
              styles.refreshButton
            }
            onPress={
              refreshAvailability
            }
          >
            <Text
              style={
                styles.refreshText
              }
            >
              ↻
            </Text>
          </TouchableOpacity>
        </View>

        {/* =================================================
            CONTENT
        ================================================= */}

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                refreshAvailability
              }
            />
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >

          {/* =================================================
              MODE
          ================================================= */}

          <View
            style={styles.modeRow}
          >
            <TouchableOpacity
              style={[
                styles.modeButton,
                !multiDateMode &&
                  styles.modeButtonActive,
              ]}
              onPress={() => {
                /*
                 * Returning to Single Date must remove every other
                 * date from the booking state. The active date and
                 * its slot selection are preserved.
                 */
                setMultiDateMode(false);
                setSelectedDates([selectedDate]);

                setSelectedSlots((previous) => ({
                  [selectedDate]: previous[selectedDate] || [],
                }));

                if (selectedCourt) {
                  void loadSlots(
                    selectedDate,
                    selectedCourt,
                    true,
                  );
                }
              }}
            >
              <Text
                style={[
                  styles.modeText,
                  !multiDateMode &&
                    styles.modeTextActive,
                ]}
              >
                Single Date
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeButton,
                multiDateMode &&
                  styles.modeButtonActive,
              ]}
              onPress={() => {
                /*
                 * Multiple Date mode starts with the currently active
                 * date. Existing selection for that date is preserved.
                 */
                setMultiDateMode(true);

                setSelectedDates((previous) => {
                  if (previous.length > 0) {
                    return previous.includes(selectedDate)
                      ? previous
                      : [...previous, selectedDate].sort();
                  }

                  return [selectedDate];
                });

                if (selectedCourt) {
                  void loadSlots(
                    selectedDate,
                    selectedCourt,
                    true,
                  );
                }
              }}
            >
              <Text
                style={[
                  styles.modeText,
                  multiDateMode &&
                    styles.modeTextActive,
                ]}
              >
                Multiple Dates
              </Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              COURT
          ================================================= */}

          <Text
            style={
              styles.sectionTitle
            }
          >
            Select Court
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.horizontalContent
            }
          >
            {activeCourts.map(
              (
                court,
                index,
              ) => {
                const id =
                  getCourtId(
                    court,
                  );

                const active =
                  id ===
                  selectedCourtId;

                return (
                  <TouchableOpacity
                    key={
                      id ||
                      String(
                        index,
                      )
                    }
                    style={[
                      styles.courtSelector,
                      active &&
                        styles.courtSelectorActive,
                    ]}
                    onPress={() => {
                      setSelectedCourtId(id);

                      /* Court changes invalidate slot selections, but
                         keep the current Single/Multiple Date mode. */
                      setSelectedSlots({});

                      setFullDayStartKey('');
                      setFullDayMode(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.courtSelectorName,
                        active &&
                          styles.courtSelectorNameActive,
                      ]}
                    >
                      {getCourtName(
                        court,
                        index,
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.courtSelectorPrice,
                        active &&
                          styles.courtSelectorPriceActive,
                      ]}
                    >
                      ₹
                      {Number(
                        court.pricePerHour ??
                          turf.pricePerHour ??
                          0,
                      )}
                      /hr
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </ScrollView>

          {/* =================================================
              DATE
          ================================================= */}

          <Text
            style={
              styles.sectionTitle
            }
          >
            Select Date
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.horizontalContent
            }
          >
            {visibleDates.map(
              (date) => {
                const active =
                  multiDateMode
                    ? selectedDates.includes(
                        date,
                      )
                    : selectedDate ===
                      date;

                return (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.dateCard,
                      active &&
                        styles.dateCardActive,
                    ]}
                    onPress={() =>
                      toggleDate(
                        date,
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.dateText,
                        active &&
                          styles.dateTextActive,
                      ]}
                    >
                      {getDateLabel(
                        date,
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              },
            )}
          </ScrollView>

          {/* =================================================
              MULTI DATE INFO
          ================================================= */}

          {multiDateMode && (
            <View
              style={
                styles.multiDateInfo
              }
            >
              <Text
                style={
                  styles.multiDateInfoText
                }
              >
                {selectedDates.length}{' '}
                date
                {selectedDates.length !==
                1
                  ? 's'
                  : ''}{' '}
                selected
              </Text>
            </View>
          )}

          {/* =================================================
              SLOT HEADER
          ================================================= */}

          <View
            style={
              styles.slotHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Available Slots
              </Text>

              {selectedCourt && (
                <Text
                  style={
                    styles.slotSubTitle
                  }
                >
                  {
                    getOperatingHours(
                      turf,
                      new Date(
                        `${selectedDate}T00:00:00`,
                      ),
                    ).openingTime
                  }{' '}
                  -
                  {' '}
                  {
                    getOperatingHours(
                      turf,
                      new Date(
                        `${selectedDate}T00:00:00`,
                      ),
                    ).closingTime
                  }
                </Text>
              )}
            </View>

            {/* FULL DAY */}
            <TouchableOpacity
              style={
                styles.fullDayButton
              }
              onPress={
                openFullDayModal
              }
            >
              <Text
                style={
                  styles.fullDayButtonText
                }
              >
                FULL DAY
              </Text>
            </TouchableOpacity>
          </View>

          {/* =================================================
              24 HOUR INFO
          ================================================= */}

          {isCurrentDate24Hours && (
            <View
              style={
                styles.twentyFourHourBanner
              }
            >
              <Text
                style={
                  styles.twentyFourHourTitle
                }
              >
                🕐 24 Hours Available
              </Text>

              <Text
                style={
                  styles.twentyFourHourText
                }
              >
                All 24 hourly slots are available
                from 12:00 AM to 12:00 AM.
              </Text>
            </View>
          )}

          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (
            <View
              style={
                styles.loadingBox
              }
            >
              <ActivityIndicator
                size="large"
                color="#16833B"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                Loading slots...
              </Text>
            </View>
          ) : selectedCourt ? (
            <>
              {/* =================================================
                  EMPTY
              ================================================= */}

              {(
                slotsByDate[
                  selectedDate
                ] || []
              ).length === 0 ? (
                <View
                  style={
                    styles.emptySlots
                  }
                >
                  <Text
                    style={
                      styles.emptySlotsTitle
                    }
                  >
                    Turf is closed
                  </Text>

                  <Text
                    style={
                      styles.emptySlotsText
                    }
                  >
                    No booking slots are
                    available for this date.
                  </Text>
                </View>
              ) : (
                /* =================================================
                   SLOT GRID
                ================================================= */

                <View
                  style={
                    styles.slotsGrid
                  }
                >
                  {(
                    slotsByDate[
                      selectedDate
                    ] || []
                  ).map((slot) => {
                    const selected =
                      (
                        selectedSlots[
                          selectedDate
                        ] || []
                      ).includes(
                        slot.bookingKey,
                      );

                    return (
                      <TouchableOpacity
                        key={
                          slot.bookingKey
                        }
                        disabled={
                          slot.booked
                        }
                        style={[
                          styles.slotCard,
                          slot.booked &&
                            styles.slotBooked,
                          selected &&
                            styles.slotSelected,
                        ]}
                        onPress={() =>
                          toggleSlot(
                            slot,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.slotTime,
                            slot.booked &&
                              styles.slotBookedText,
                            selected &&
                              styles.slotSelectedText,
                          ]}
                        >
                          {formatDisplayTime(
                            slot.startMinutes,
                          )}
                        </Text>

                        <Text
                          style={[
                            styles.slotEndTime,
                            slot.booked &&
                              styles.slotBookedText,
                            selected &&
                              styles.slotSelectedText,
                          ]}
                        >
                          to{' '}
                          {formatDisplayTime(
                            slot.endMinutes,
                          )}
                        </Text>

                        <Text
                          style={[
                            styles.slotPrice,
                            slot.booked &&
                              styles.slotBookedText,
                            selected &&
                              styles.slotSelectedText,
                          ]}
                        >
                          ₹
                          {slot.price}
                        </Text>

                        {slot.isNight && (
                          <Text
                            style={[
                              styles.nightText,
                              selected &&
                                styles.slotSelectedText,
                            ]}
                          >
                            NIGHT
                          </Text>
                        )}

                        <Text
                          style={[
                            styles.slotStatus,
                            slot.booked &&
                              styles.slotBookedText,
                            selected &&
                              styles.slotSelectedText,
                          ]}
                        >
                          {slot.booked
                            ? 'Booked'
                            : selected
                              ? 'Selected'
                              : 'Available'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <View
              style={
                styles.emptySlots
              }
            >
              <Text
                style={
                  styles.emptySlotsText
                }
              >
                Please select a court.
              </Text>
            </View>
          )}

          {/* =================================================
              SELECTED INFO
          ================================================= */}

          {selectedSlotObjects.length >
            0 && (
            <View
              style={
                styles.selectedInfo
              }
            >
              <Text
                style={
                  styles.selectedInfoTitle
                }
              >
                Selected Slots
              </Text>

              <Text
                style={
                  styles.selectedInfoText
                }
              >
                {selectedSlotObjects.length}{' '}
                slot
                {selectedSlotObjects.length !==
                1
                  ? 's'
                  : ''}{' '}
                selected for{' '}
                {getDateLabel(
                  selectedDate,
                )}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  clearSelectionForDate(
                    selectedDate,
                  )
                }
              >
                <Text
                  style={
                    styles.clearText
                  }
                >
                  Clear
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* =================================================
              MULTI DATE SUMMARY
          ================================================= */}

          {multiDateMode &&
            selectedDates.length >
              0 && (
              <View
                style={
                  styles.multiDateSummary
                }
              >
                <Text
                  style={
                    styles.summaryTitle
                  }
                >
                  Selected Dates
                </Text>

                {selectedDates.map(
                  (date) => (
                    <View
                      key={date}
                      style={
                        styles.summaryRow
                      }
                    >
                      <Text
                        style={
                          styles.summaryDate
                        }
                      >
                        {getDateLabel(
                          date,
                        )}
                      </Text>

                      <Text
                        style={
                          styles.summaryAmount
                        }
                      >
                        ₹
                        {getDaySubtotal(
                          date,
                        )}
                      </Text>
                    </View>
                  ),
                )}
              </View>
            )}

          <View
            style={
              styles.bottomSpacing
            }
          />
        </ScrollView>

        {/* =================================================
            BOOKING BAR
        ================================================= */}

        <View
          style={
            styles.bookingBar
          }
        >
          <View
            style={
              styles.bookingTotals
            }
          >
            <Text
              style={
                styles.bookingCount
              }
            >
              {totalSelectedSlots}{' '}
              slot
              {totalSelectedSlots !==
              1
                ? 's'
                : ''}
            </Text>

            {grandDiscount > 0 && (
              <Text
                style={
                  styles.originalPrice
                }
              >
                ₹
                {
                  grandOriginalTotal
                }
              </Text>
            )}

            <Text
              style={
                styles.grandTotal
              }
            >
              ₹{grandTotal}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              (totalSelectedSlots ===
                0 ||
                bookingLoading) &&
                styles.disabledButton,
            ]}
            disabled={
              totalSelectedSlots ===
                0 ||
              bookingLoading
            }
            onPress={
              handleBookNow
            }
          >
            {bookingLoading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.continueText
                }
              >
                CONTINUE
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* =================================================
            CUSTOM FULL DAY MODAL
        ================================================= */}

        {fullDayMode && (
          <View
            style={
              styles.modalOverlay
            }
          >
            <View
              style={
                styles.fullDayModal
              }
            >

              {/* MODAL HEADER */}

              <View
                style={
                  styles.modalHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Full Day Booking
                  </Text>

                  <Text
                    style={
                      styles.modalSmallText
                    }
                  >
                    Minimum {MIN_FULL_DAY_HOURS}{' '}
                    hours
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    setFullDayMode(
                      false,
                    )
                  }
                >
                  <Text
                    style={
                      styles.modalClose
                    }
                  >
                    ×
                  </Text>
                </TouchableOpacity>
              </View>

              {/* =================================================
                  STEP 1 — START TIME
              ================================================= */}

              <Text
                style={
                  styles.modalSectionTitle
                }
              >
                1. Select Start Time
              </Text>

              <Text
                style={
                  styles.modalDescription
                }
              >
                Choose the time when your booking
                should start.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.startTimeContainer
                }
              >
                {fullDayAvailableSlots.map(
                  (slot) => {
                    const active =
                      fullDayStartKey ===
                      slot.bookingKey;

                    /*
                     * Check whether at least
                     * 5 continuous hours are
                     * possible from this time.
                     */
                    const index =
                      (
                        slotsByDate[
                          selectedDate
                        ] || []
                      ).findIndex(
                        (item) =>
                          item.bookingKey ===
                          slot.bookingKey,
                      );

                    const minimumPossible =
                      index >= 0
                        ? getContinuousSlots(
                            index,
                            MIN_FULL_DAY_HOURS,
                          ).length ===
                          MIN_FULL_DAY_HOURS
                        : false;

                    if (
                      !minimumPossible
                    ) {
                      return null;
                    }

                    return (
                      <TouchableOpacity
                        key={
                          slot.bookingKey
                        }
                        style={[
                          styles.startTimeButton,
                          active &&
                            styles.startTimeButtonActive,
                        ]}
                        onPress={() =>
                          selectFullDayStart(
                            slot,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.startTimeText,
                            active &&
                              styles.startTimeTextActive,
                          ]}
                        >
                          {formatDisplayTime(
                            slot.startMinutes,
                          )}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </ScrollView>

              {/* =================================================
                  SELECTED START
              ================================================= */}

              {fullDayStartKey !==
                '' && (
                <View
                  style={
                    styles.selectedStartBox
                  }
                >
                  <Text
                    style={
                      styles.selectedStartLabel
                    }
                  >
                    Starting from
                  </Text>

                  <Text
                    style={
                      styles.selectedStartValue
                    }
                  >
                    {formatDisplayTime(
                      (
                        slotsByDate[
                          selectedDate
                        ] || []
                      ).find(
                        (slot) =>
                          slot.bookingKey ===
                          fullDayStartKey,
                      )?.startMinutes ??
                        0,
                    )}
                  </Text>
                </View>
              )}

              {/* =================================================
                  STEP 2 — HOURS
              ================================================= */}

              <Text
                style={
                  styles.modalSectionTitle
                }
              >
                2. Select Booking Hours
              </Text>

              <Text
                style={
                  styles.modalDescription
                }
              >
                Minimum {MIN_FULL_DAY_HOURS}{' '}
                hours. Select as many continuous
                hours as you need.
              </Text>

              <View
                style={
                  styles.hourSelector
                }
              >
                {availableHoursForStart
                  .filter(
                    (hours) =>
                      hours ===
                      MIN_FULL_DAY_HOURS,
                  )
                  .map(
                    (hours) => (
                      <TouchableOpacity
                        key={hours}
                        style={[
                          styles.hourButton,
                          styles.hourButtonActive,
                        ]}
                        onPress={() =>
                          setFullDayHours(
                            MIN_FULL_DAY_HOURS,
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.hourButtonText,
                            styles.hourButtonTextActive,
                          ]}
                        >
                          {hours}h
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
              </View>

              {/* =================================================
                  DISCOUNT
              ================================================= */}

              <View
                style={
                  styles.discountNotice
                }
              >
                <Text
                  style={
                    styles.discountNoticeText
                  }
                >
                  🎉{' '}
                  {selectedCourt
                    ? getFullDayDiscountPercent(
                        selectedCourt,
                      )
                    : DEFAULT_FULL_DAY_DISCOUNT_PERCENT}
                  % Full Day Discount
                </Text>

                <Text
                  style={
                    styles.discountSubText
                  }
                >
                  Applied to the exact {MIN_FULL_DAY_HOURS}-hour
                  Full Day booking.
                </Text>
              </View>

              {/* =================================================
                  PREVIEW
              ================================================= */}

              {fullDayStartKey !==
                '' && (
                <View
                  style={
                    styles.bookingPreview
                  }
                >
                  <Text
                    style={
                      styles.previewTitle
                    }
                  >
                    Booking Preview
                  </Text>

                  <Text
                    style={
                      styles.previewText
                    }
                  >
                    Start:{' '}
                    {
                      formatDisplayTime(
                        (
                          slotsByDate[
                            selectedDate
                          ] || []
                        ).find(
                          (slot) =>
                            slot.bookingKey ===
                            fullDayStartKey,
                        )?.startMinutes ??
                          0,
                      )
                    }
                  </Text>

                  <Text
                    style={
                      styles.previewText
                    }
                  >
                    Duration:{' '}
                    {fullDayHours}{' '}
                    hours
                  </Text>

                  <Text
                    style={
                      styles.previewText
                    }
                  >
                    End:{' '}
                    {(() => {
                      const selected =
                        (
                          slotsByDate[
                            selectedDate
                          ] || []
                        ).find(
                          (slot) =>
                            slot.bookingKey ===
                            fullDayStartKey,
                        );

                      if (!selected) {
                        return '--';
                      }

                      return formatDisplayTime(
                        selected.startMinutes +
                          fullDayHours *
                            60,
                      );
                    })()}
                  </Text>

                  {isCurrentDate24Hours &&
                    fullDayStartKey !==
                      '' && (
                      <Text
                        style={
                          styles.midnightSupportText
                        }
                      >
                        ✓ 24-hour booking can
                        cross midnight.
                      </Text>
                    )}
                </View>
              )}

              {/* =================================================
                  APPLY
              ================================================= */}

              <TouchableOpacity
                style={[
                  styles.applyFullDay,
                  (!fullDayStartKey ||
                    availableHoursForStart.length ===
                      0) &&
                    styles.disabledButton,
                ]}
                disabled={
                  !fullDayStartKey ||
                  availableHoursForStart.length ===
                    0
                }
                onPress={
                  applyFullDayBooking
                }
              >
                <Text
                  style={
                    styles.applyFullDayText
                  }
                >
                  BOOK 5 HOURS
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================
            SUMMARY MODAL
        ================================================= */}

        {showSummary && (
          <View
            style={
              styles.modalOverlay
            }
          >
            <View
              style={
                styles.summaryModal
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Booking Summary
              </Text>

              <Text
                style={
                  styles.summaryModalText
                }
              >
                {turf.name}
              </Text>

              <Text
                style={
                  styles.summaryModalText
                }
              >
                {selectedCourt
                  ? getCourtName(
                      selectedCourt,
                      0,
                    )
                  : ''}
              </Text>

              <Text
                style={
                  styles.summaryModalText
                }
              >
                {totalSelectedSlots}{' '}
                hours selected
              </Text>

              <Text
                style={
                  styles.summaryModalTotal
                }
              >
                ₹{grandTotal}
              </Text>

              <TouchableOpacity
                style={
                  styles.applyFullDay
                }
                onPress={() =>
                  setShowSummary(
                    false,
                  )
                }
              >
                <Text
                  style={
                    styles.applyFullDayText
                  }
                >
                  CLOSE
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  /* =======================================================
     HEADER
  ======================================================= */

  header: {
    height: 60,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E9ED',
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerBackText: {
    fontSize: 34,
    color: '#111827',
    lineHeight: 34,
    marginTop: -3,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F5',
  },

  refreshText: {
    fontSize: 25,
    color: '#16833B',
    fontWeight: '800',
  },

  /* =======================================================
     SCROLL
  ======================================================= */

  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },

  /* =======================================================
     MODE
  ======================================================= */

  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 12,
    padding: 4,
  },

  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeButtonActive: {
    backgroundColor: '#16833B',
  },

  modeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6B7280',
  },

  modeTextActive: {
    color: '#FFFFFF',
  },

  /* =======================================================
     SECTIONS
  ======================================================= */

  sectionTitle: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },

  horizontalContent: {
    paddingRight: 10,
    gap: 10,
  },

  /* =======================================================
     COURTS
  ======================================================= */

  courtSelector: {
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E5E9',
  },

  courtSelectorActive: {
    backgroundColor: '#16833B',
    borderColor: '#16833B',
  },

  courtSelectorName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },

  courtSelectorNameActive: {
    color: '#FFFFFF',
  },

  courtSelectorPrice: {
    marginTop: 4,
    fontSize: 12,
    color: '#16833B',
    fontWeight: '700',
  },

  courtSelectorPriceActive: {
    color: '#FFFFFF',
  },

  /* =======================================================
     DATES
  ======================================================= */

  dateCard: {
    minWidth: 85,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E5E9',
    alignItems: 'center',
  },

  dateCardActive: {
    backgroundColor: '#16833B',
    borderColor: '#16833B',
  },

  dateText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },

  dateTextActive: {
    color: '#FFFFFF',
  },

  multiDateInfo: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#EAF7EE',
  },

  multiDateInfoText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: '#16833B',
  },

  /* =======================================================
     24 HOURS
  ======================================================= */

  twentyFourHourBanner: {
    marginTop: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#C8E8D1',
  },

  twentyFourHourTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#16833B',
  },

  twentyFourHourText: {
    marginTop: 3,
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 17,
  },

  /* =======================================================
     SLOT HEADER
  ======================================================= */

  slotHeader: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  slotSubTitle: {
    fontSize: 12,
    color: '#6B7280',
  },

  fullDayButton: {
    minWidth: 155,
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fullDayButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#946200',
  },

  /* =======================================================
     LOADING
  ======================================================= */

  loadingBox: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    color: '#6B7280',
    fontSize: 13,
  },

  /* =======================================================
     SLOTS
  ======================================================= */

  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  slotCard: {
    width: '31.5%',
    minHeight: 96,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE2E7',
  },

  slotSelected: {
    backgroundColor: '#16833B',
    borderColor: '#16833B',
  },

  slotBooked: {
    backgroundColor: '#F1F2F4',
    borderColor: '#E0E2E5',
    opacity: 0.65,
  },

  slotTime: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },

  slotEndTime: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },

  slotPrice: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
    color: '#16833B',
  },

  nightText: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '900',
    color: '#946200',
  },

  slotStatus: {
    marginTop: 5,
    fontSize: 10,
    fontWeight: '800',
    color: '#16833B',
  },

  slotSelectedText: {
    color: '#FFFFFF',
  },

  slotBookedText: {
    color: '#8B929B',
  },

  /* =======================================================
     EMPTY
  ======================================================= */

  emptySlots: {
    padding: 25,
    marginTop: 10,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  emptySlotsTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  emptySlotsText: {
    marginTop: 6,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 13,
  },

  /* =======================================================
     SELECTED
  ======================================================= */

  selectedInfo: {
    marginTop: 10,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#C8E8D1',
  },

  selectedInfoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16833B',
  },

  selectedInfoText: {
    marginTop: 5,
    fontSize: 12,
    color: '#4B5563',
  },

  clearText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '900',
    color: '#C62828',
  },

  /* =======================================================
     MULTI DATE
  ======================================================= */

  multiDateSummary: {
    marginTop: 15,
    padding: 15,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E6EA',
  },

  summaryTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 8,
  },

  summaryRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  summaryDate: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '700',
  },

  summaryAmount: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '900',
  },

  bottomSpacing: {
    height: 40,
  },

  /* =======================================================
     BOOKING BAR
  ======================================================= */

  bookingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E5E9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bookingTotals: {
    flex: 1,
  },

  bookingCount: {
    fontSize: 11,
    color: '#6B7280',
  },

  originalPrice: {
    marginTop: 2,
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },

  grandTotal: {
    marginTop: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  continueButton: {
    minWidth: 145,
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 13,
    backgroundColor: '#16833B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    backgroundColor: '#AAB0B7',
  },

  continueText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  /* =======================================================
     MODAL
  ======================================================= */

  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor:
      'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  fullDayModal: {
    width: '100%',
    maxHeight: '92%',
    padding: 20,
    paddingBottom: 30,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: '#FFFFFF',
  },

  summaryModal: {
    width: '90%',
    padding: 22,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 'auto',
    marginTop: 'auto',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  modalSmallText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#16833B',
  },

  modalClose: {
    fontSize: 30,
    color: '#6B7280',
  },

  modalSectionTitle: {
    marginTop: 20,
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
  },

  modalDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },

  /* =======================================================
     START TIME
  ======================================================= */

  startTimeContainer: {
    paddingTop: 12,
    paddingRight: 10,
    gap: 8,
  },

  startTimeButton: {
    minWidth: 90,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E3E7',
  },

  startTimeButtonActive: {
    backgroundColor: '#16833B',
    borderColor: '#16833B',
  },

  startTimeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#374151',
  },

  startTimeTextActive: {
    color: '#FFFFFF',
  },

  /* =======================================================
     SELECTED START
  ======================================================= */

  selectedStartBox: {
    marginTop: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#C8E8D1',
    flexDirection: 'row',
    justifyContent:
      'space-between',
    alignItems: 'center',
  },

  selectedStartLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '700',
  },

  selectedStartValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16833B',
  },

  /* =======================================================
     HOURS
  ======================================================= */

  hourSelector: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  hourButton: {
    width: '100%',
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F1F3F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E3E7',
  },

  hourButtonActive: {
    backgroundColor: '#16833B',
    borderColor: '#16833B',
  },

  hourButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
  },

  hourButtonTextActive: {
    color: '#FFFFFF',
  },

  /* =======================================================
     DISCOUNT
  ======================================================= */

  discountNotice: {
    marginTop: 15,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF4D6',
  },

  discountNoticeText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
    color: '#946200',
  },

  discountSubText: {
    marginTop: 3,
    textAlign: 'center',
    fontSize: 10,
    color: '#946200',
  },

  /* =======================================================
     PREVIEW
  ======================================================= */

  bookingPreview: {
    marginTop: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E2E5E9',
  },

  previewTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 5,
  },

  previewText: {
    marginTop: 3,
    fontSize: 12,
    color: '#4B5563',
  },

  midnightSupportText: {
    marginTop: 7,
    fontSize: 11,
    color: '#16833B',
    fontWeight: '800',
  },

  /* =======================================================
     APPLY BUTTON
  ======================================================= */

  applyFullDay: {
    height: 50,
    marginTop: 18,
    borderRadius: 13,
    backgroundColor: '#16833B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  applyFullDayText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  /* =======================================================
     SUMMARY
  ======================================================= */

  summaryModalText: {
    marginTop: 10,
    fontSize: 14,
    color: '#4B5563',
  },

  summaryModalTotal: {
    marginTop: 15,
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
  },

  /* =======================================================
     ERROR
  ======================================================= */

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },

  errorText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#16833B',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
