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
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

/* =========================================================
   API CONFIGURATION
========================================================= */

const RAW_API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? ''
).trim();

const API_BASE_URL = (() => {
  if (!RAW_API_BASE_URL) {
    return '';
  }

  let url = RAW_API_BASE_URL.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  return url;
})();

const getApiUrl = (path: string): string => {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not configured.'
    );
  }

  const cleanPath = path.startsWith('/')
    ? path
    : `/${path}`;

  return `${API_BASE_URL}${cleanPath}`;
};

/* =========================================================
   TYPES
========================================================= */

interface TurfImage {
  url?: string;
  isPrimary?: boolean;
}

interface TurfLocation {
  type?: string;
  coordinates?: [number, number];
}

interface TurfCourt {
  _id?: string;
  id?: string;

  name?: string;

  sport?: string;
  sports?: string[];

  pricePerHour?: number;

  hasNightPricing?: boolean;
  nightPricePerHour?: number;

  nightStartHour?: number;
  nightEndHour?: number;

  // Full-day / long-booking discount configured per court
  fullDayDiscountPercent?: number;

  status?: string;
}

interface OperatingHour {
  /*
    Current backend format
  */
  day?: string;

  openingTime?: string;
  closingTime?: string;

  /*
    Older frontend format
  */
  dayOfWeek?: number;

  openTime?: string;
  closeTime?: string;

  isClosed?: boolean;
}

interface Turf {
  _id?: string;
  id?: string;

  name?: string;
  description?: string;

  address?: string;
  city?: string;

  pricePerHour?: number;

  sports?: string[];

  amenities?: string[];

  images?: TurfImage[];

  courts?: TurfCourt[];

  operatingHours?: OperatingHour[];

  location?: TurfLocation;

  status?: string;
}

interface BackendBookedSlot {
  slotId?: string;
  id?: string;
  _id?: string;

  startTime?: string;
  endTime?: string;

  date?: string;

  status?: string;

  price?: number;
}

interface BackendSlot {
  _id?: string;
  id?: string;

  startTime?: string;
  endTime?: string;

  date?: string;

  status?: string;

  price?: number;

  available?: boolean;

  booked?: boolean;
}

interface SlotsApiResponse {
  success?: boolean;

  message?: string;

  slots?: BackendSlot[];

  bookedSlots?: BackendBookedSlot[];

  data?: {
    slots?: BackendSlot[];
    bookedSlots?: BackendBookedSlot[];
  };
}

interface Slot {
  id: string;

  bookingKey: string;

  startTime: string;

  endTime: string;

  startMinutes: number;

  endMinutes: number;

  available: boolean;

  price: number;

  isPast: boolean;

  isNight: boolean;
}

interface TurfDetailsScreenProps {
  navigation: any;

  route: {
    params?: {
      turf?: Turf;
    };
  };
}

/* =========================================================
   COLORS
========================================================= */

const COLORS = {
  primary: '#16A34A',
  primaryDark: '#15803D',
  primaryLight: '#DCFCE7',

  purple: '#7C3AED',
  purpleLight: '#EDE9FE',

  red: '#DC2626',
  redLight: '#FEE2E2',

  blue: '#2563EB',
  blueLight: '#DBEAFE',

  yellow: '#CA8A04',
  yellowLight: '#FEF9C3',

  background: '#F6F8FA',
  white: '#FFFFFF',

  text: '#111827',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',

  border: '#E5E7EB',
};

/* =========================================================
   DATE HELPERS
========================================================= */

const formatDate = (
  date: Date
): string => {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (
  date: Date
): string => {
  return date.toLocaleDateString(
    'en-IN',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }
  );
};

const isSameDate = (
  first: Date,
  second: Date
): boolean => {
  return (
    formatDate(first) ===
    formatDate(second)
  );
};

const isPastDate = (
  date: Date
): boolean => {
  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const target =
    new Date(date);

  target.setHours(
    0,
    0,
    0,
    0
  );

  return (
    target.getTime() <
    today.getTime()
  );
};

/* =========================================================
   TIME HELPERS
========================================================= */

const parseTimeToMinutes = (
  time?: string
): number | null => {
  if (!time) {
    return null;
  }

  const value =
    String(time).trim();

  /*
    24-hour format
    00:00
    06:00
    18:30
    23:00
  */
  const twentyFourHour =
    value.match(
      /^(\d{1,2}):(\d{2})$/
    );

  if (twentyFourHour) {
    const hour =
      Number(
        twentyFourHour[1]
      );

    const minute =
      Number(
        twentyFourHour[2]
      );

    if (
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    ) {
      return (
        hour * 60 +
        minute
      );
    }
  }

  /*
    12-hour format
  */
  const twelveHour =
    value.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
    );

  if (twelveHour) {
    let hour =
      Number(
        twelveHour[1]
      );

    const minute =
      Number(
        twelveHour[2]
      );

    const period =
      twelveHour[3].toUpperCase();

    if (
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    if (
      period === 'AM'
    ) {
      if (hour === 12) {
        hour = 0;
      }
    } else {
      if (hour !== 12) {
        hour += 12;
      }
    }

    return (
      hour * 60 +
      minute
    );
  }

  return null;
};

const formatTime = (
  minutes: number
): string => {
  const normalized =
    ((minutes % 1440) +
      1440) %
    1440;

  let hour =
    Math.floor(
      normalized / 60
    );

  const minute =
    normalized % 60;

  const period =
    hour >= 12
      ? 'PM'
      : 'AM';

  hour =
    hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return `${String(hour).padStart(
    2,
    '0'
  )}:${String(minute).padStart(
    2,
    '0'
  )} ${period}`;
};

const getCurrentMinutes = (): number => {
  const now =
    new Date();

  return (
    now.getHours() * 60 +
    now.getMinutes()
  );
};

/* =========================================================
   CURRENCY
========================================================= */

const formatCurrency = (
  amount: number
): string => {
  return `₹${Number(
    amount || 0
  ).toLocaleString(
    'en-IN'
  )}`;
};

/* =========================================================
   TURF HELPERS
========================================================= */

const getTurfId = (
  turf?: Turf
): string => {
  return (
    turf?._id ||
    turf?.id ||
    ''
  );
};

const getCourtId = (
  court?: TurfCourt
): string => {
  return (
    court?._id ||
    court?.id ||
    ''
  );
};

const getTurfImage = (
  turf?: Turf
): string | null => {
  if (
    !turf?.images ||
    turf.images.length === 0
  ) {
    return null;
  }

  const primary =
    turf.images.find(
      image =>
        image.isPrimary ===
          true &&
        !!image.url
    );

  if (primary?.url) {
    return primary.url;
  }

  const first =
    turf.images.find(
      image =>
        !!image.url
    );

  return (
    first?.url ?? null
  );
};

const getCourtSportText = (
  court?: TurfCourt
): string => {
  if (!court) {
    return 'Sport';
  }

  if (
    court.sport &&
    court.sport.trim()
  ) {
    return court.sport.trim();
  }

  if (
    Array.isArray(
      court.sports
    ) &&
    court.sports.length > 0
  ) {
    return court.sports.join(
      ' • '
    );
  }

  return 'Sport';
};

const getNormalCourtPrice = (
  court?: TurfCourt
): number => {
  const price =
    Number(
      court?.pricePerHour
    );

  return Number.isFinite(
    price
  ) && price >= 0
    ? price
    : 0;
};

const getNightCourtPrice = (
  court?: TurfCourt
): number => {
  if (
    !court?.hasNightPricing
  ) {
    return getNormalCourtPrice(
      court
    );
  }

  const price =
    Number(
      court.nightPricePerHour
    );

  return Number.isFinite(
    price
  ) && price >= 0
    ? price
    : getNormalCourtPrice(
        court
      );
};

/* =========================================================
   OPERATING HOURS
========================================================= */

const getOperatingHourForDay = (
  turf: Turf | undefined,
  dayOfWeek: number
): OperatingHour | undefined => {
  if (
    !Array.isArray(
      turf?.operatingHours
    )
  ) {
    return undefined;
  }

  const dayNames = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  return turf.operatingHours.find(
    hour => {
      if (
        typeof hour.dayOfWeek ===
        'number'
      ) {
        return (
          hour.dayOfWeek ===
          dayOfWeek
        );
      }

      if (
        typeof hour.day ===
        'string'
      ) {
        return (
          hour.day
            .trim()
            .toLowerCase() ===
          dayNames[
            dayOfWeek
          ]
        );
      }

      return false;
    }
  );
};

const getOpeningTime = (
  hour?: OperatingHour
): string => {
  return (
    hour?.openingTime ||
    hour?.openTime ||
    '00:00'
  );
};

const getClosingTime = (
  hour?: OperatingHour
): string => {
  return (
    hour?.closingTime ||
    hour?.closeTime ||
    '00:00'
  );
};

/* =========================================================
   24-HOUR DETECTION
========================================================= */

/*
  IMPORTANT

  These values mean a full 24-hour day:

  00:00 -> 00:00

  or

  00:00 -> 24:00

  Since normal JavaScript time parsing does
  not accept 24:00 as a normal hour, we
  explicitly handle it.
*/

const is24HourOperatingDay = (
  openingTime: string,
  closingTime: string
): boolean => {
  const normalizedOpen =
    openingTime
      .trim()
      .toUpperCase();

  const normalizedClose =
    closingTime
      .trim()
      .toUpperCase();

  if (
    normalizedOpen ===
      '00:00' &&
    normalizedClose ===
      '00:00'
  ) {
    return true;
  }

  if (
    normalizedOpen ===
      '12:00 AM' &&
    normalizedClose ===
      '12:00 AM'
  ) {
    return true;
  }

  if (
    normalizedOpen ===
      '00:00' &&
    normalizedClose ===
      '24:00'
  ) {
    return true;
  }

  return false;
};

/* =========================================================
   NIGHT PRICING
========================================================= */

const isNightSlot = (
  startMinutes: number,
  court?: TurfCourt
): boolean => {
  if (
    !court?.hasNightPricing
  ) {
    return false;
  }

  const startHour =
    Number(
      court.nightStartHour
    );

  const endHour =
    Number(
      court.nightEndHour
    );

  if (
    !Number.isInteger(
      startHour
    ) ||
    !Number.isInteger(
      endHour
    ) ||
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
    Example:
    18:00 -> 23:00
  */
  if (
    nightStart <
    nightEnd
  ) {
    return (
      startMinutes >=
        nightStart &&
      startMinutes <
        nightEnd
    );
  }

  /*
    Example:
    22:00 -> 06:00
  */
  if (
    nightStart >
    nightEnd
  ) {
    return (
      startMinutes >=
        nightStart ||
      startMinutes <
        nightEnd
    );
  }

  return false;
};

const getSlotPrice = (
  startMinutes: number,
  court?: TurfCourt
): number => {
  if (
    isNightSlot(
      startMinutes,
      court
    )
  ) {
    return getNightCourtPrice(
      court
    );
  }

  return getNormalCourtPrice(
    court
  );
};

/* =========================================================
   BOOKING KEY
========================================================= */

const createBookingKey = (
  date: string,
  courtId: string,
  startMinutes: number
): string => {
  return `${date}_${courtId}_${startMinutes}`;
};

const getMinutesFromBookingKey = (
  bookingKey: string
): number | null => {
  const parts =
    bookingKey.split('_');

  const last =
    parts[parts.length - 1];

  const minutes =
    Number(last);

  if (
    Number.isFinite(minutes) &&
    minutes >= 0 &&
    minutes < 1440
  ) {
    return minutes;
  }

  return null;
};

/* =========================================================
   BACKEND SLOT ID PARSER
========================================================= */

const extractMinutesFromSlotId = (
  slotId?: string
): number | null => {
  if (!slotId) {
    return null;
  }

  const parts =
    String(slotId).split(
      '_'
    );

  const last =
    parts[
      parts.length - 1
    ];

  if (
    /^\d+$/.test(last)
  ) {
    const minutes =
      Number(last);

    if (
      minutes >= 0 &&
      minutes < 1440
    ) {
      return minutes;
    }
  }

  return parseTimeToMinutes(
    last
  );
};

/* =========================================================
   NORMALIZE BOOKED SLOTS
========================================================= */

const normalizeBookedSlots = (
  response: SlotsApiResponse,
  date: string,
  courtId: string
): Set<string> => {
  const result =
    new Set<string>();

  const bookedSlots =
    Array.isArray(
      response.bookedSlots
    )
      ? response.bookedSlots
      : Array.isArray(
          response.data
            ?.bookedSlots
        )
        ? response.data
            ?.bookedSlots ?? []
        : [];

  for (
    const item of bookedSlots
  ) {
    if (!item) {
      continue;
    }

    const backendDate =
      item.date || date;

    const startMinutes =
      parseTimeToMinutes(
        item.startTime
      );

    if (
      startMinutes !== null
    ) {
      result.add(
        createBookingKey(
          backendDate,
          courtId,
          startMinutes
        )
      );

      continue;
    }

    const rawId =
      item.slotId ||
      item.id ||
      item._id;

    const idMinutes =
      extractMinutesFromSlotId(
        rawId
      );

    if (
      idMinutes !== null
    ) {
      result.add(
        createBookingKey(
          backendDate,
          courtId,
          idMinutes
        )
      );
    }
  }

  return result;
};

/* =========================================================
   COMPONENT
========================================================= */

const TurfDetailsScreen: React.FC<
  TurfDetailsScreenProps
> = ({
  navigation,
  route,
}) => {
  const turf =
    route.params?.turf;

  const mountedRef =
    useRef(true);

  /* =======================================================
     STATE
  ======================================================= */

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<Date>(
    new Date()
  );

  const [
    selectedCourtId,
    setSelectedCourtId,
  ] = useState('');

  /*
    IMPORTANT:
    Each date keeps its own selected slots.

    Example:
    {
      "2026-10-05": ["2026-10-05_court1_600"],
      "2026-10-07": [
        "2026-10-07_court1_1080",
        "2026-10-07_court1_1140"
      ]
    }
  */
  const [
    selectedSlotsByDate,
    setSelectedSlotsByDate,
  ] = useState<Record<string, string[]>>({});

  /*
    Availability is also cached separately for every date.
    This prevents switching dates from losing information.
  */
  const [
    bookedSlotKeysByDate,
    setBookedSlotKeysByDate,
  ] = useState<Record<string, Set<string>>>({});

  const [
    loadingDates,
    setLoadingDates,
  ] = useState<Record<string, boolean>>({});

  const [
    errorByDate,
    setErrorByDate,
  ] = useState<Record<string, string>>({});

  const [
    currentTimeMinutes,
    setCurrentTimeMinutes,
  ] = useState(
    getCurrentMinutes()
  );

  /* =======================================================
     FULL DAY / LONG-BOOKING PACKAGE

     The discount percentage comes from the selected court
     (`fullDayDiscountPercent`) in the Court schema.

     The customer can choose ANY continuous available range
     offered by the turf/court, from 1 hour up to 12 hours.
     The discount is applied to the selected continuous range.
     Only the currently displayed date is changed;
     selections on other dates remain untouched.
  ======================================================= */

  const [
    fullDayModalVisible,
    setFullDayModalVisible,
  ] = useState(false);

  const [
    fullDayStartMinutes,
    setFullDayStartMinutes,
  ] = useState<number | null>(null);

  const [
    fullDayEndMinutes,
    setFullDayEndMinutes,
  ] = useState<number | null>(null);

  const [
    fullDayDates,
    setFullDayDates,
  ] = useState<Record<string, boolean>>({});

  /* =======================================================
     MOUNT
  ======================================================= */

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  /* =======================================================
     CURRENT TIME
  ======================================================= */

  useEffect(() => {
    const timer =
      setInterval(() => {
        if (
          mountedRef.current
        ) {
          setCurrentTimeMinutes(
            getCurrentMinutes()
          );
        }
      }, 60 * 1000);

    return () =>
      clearInterval(timer);
  }, []);

  /* =======================================================
     TURF ID
  ======================================================= */

  const turfId =
    useMemo(
      () =>
        getTurfId(turf),
      [turf]
    );

  /* =======================================================
     IMAGE
  ======================================================= */

  const turfImage =
    useMemo(
      () =>
        getTurfImage(turf),
      [turf]
    );

  /* =======================================================
     ACTIVE COURTS
  ======================================================= */

  const activeCourts =
    useMemo(() => {
      return (
        turf?.courts ?? []
      ).filter(
        court => {
          const status =
            String(
              court.status ??
                'active'
            ).toLowerCase();

          return (
            status !==
              'inactive' &&
            status !==
              'maintenance'
          );
        }
      );
    }, [
      turf?.courts,
    ]);

  /* =======================================================
     DEFAULT COURT
  ======================================================= */

  useEffect(() => {
    if (
      activeCourts.length ===
      0
    ) {
      setSelectedCourtId(
        ''
      );

      return;
    }

    const exists =
      activeCourts.some(
        court =>
          getCourtId(
            court
          ) ===
          selectedCourtId
      );

    if (!exists) {
      setSelectedCourtId(
        getCourtId(
          activeCourts[0]
        )
      );
    }
  }, [
    activeCourts,
    selectedCourtId,
  ]);

  /* =======================================================
     SELECTED COURT
  ======================================================= */

  const selectedCourt =
    useMemo(() => {
      return activeCourts.find(
        court =>
          getCourtId(
            court
          ) ===
          selectedCourtId
      );
    }, [
      activeCourts,
      selectedCourtId,
    ]);

  /* =======================================================
     FULL DAY DISCOUNT FROM SELECTED COURT

     The discount percentage comes from the Court schema.
     It is NOT hard-coded in this screen.

     Examples:
     4  -> 4%
     10 -> 10%
     0  -> no discount

     This must stay below selectedCourt because it reads
     selectedCourt.fullDayDiscountPercent.
  ======================================================= */

  const fullDayDiscountPercent = useMemo(() => {
    const value = Number(
      selectedCourt?.fullDayDiscountPercent ?? 0
    );

    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, value));
  }, [selectedCourt]);

  /* =======================================================
     SELECTED DAY
  ======================================================= */

  const selectedDayOfWeek =
    selectedDate.getDay();

  const selectedOperatingHour =
    useMemo(
      () =>
        getOperatingHourForDay(
          turf,
          selectedDayOfWeek
        ),
      [
        turf,
        selectedDayOfWeek,
      ]
    );

  /* =======================================================
     OPERATING TIMES
  ======================================================= */

  const openingTime =
    getOpeningTime(
      selectedOperatingHour
    );

  const closingTime =
    getClosingTime(
      selectedOperatingHour
    );

  const isTwentyFourHours =
    is24HourOperatingDay(
      openingTime,
      closingTime
    );

  /* =======================================================
     GENERATE 24-HOUR SLOTS
========================================================= */

  const slots =
    useMemo(() => {
      if (
        !selectedCourt ||
        !selectedCourtId
      ) {
        return [];
      }

      if (
        selectedOperatingHour
          ?.isClosed === true
      ) {
        return [];
      }

      /*
        =====================================================
        24-HOUR MODE
        =====================================================

        If backend gives:

        00:00 -> 00:00

        we create:

        00-01
        01-02
        02-03
        ...
        23-00

        exactly 24 slots.
      */

      let slotStart = 0;
      let slotCount = 24;

      if (
        isTwentyFourHours
      ) {
        slotStart = 0;
        slotCount = 24;
      } else {
        /*
          Normal operating-hours mode.
        */

        const start =
          parseTimeToMinutes(
            openingTime
          );

        const end =
          parseTimeToMinutes(
            closingTime
          );

        if (
          start === null ||
          end === null
        ) {
          return [];
        }

        slotStart =
          start;

        let totalMinutes =
          end - start;

        /*
          Overnight schedule:

          18:00 -> 02:00

          becomes:

          18:00 -> 26:00
        */
        if (
          totalMinutes <= 0
        ) {
          totalMinutes +=
            1440;
        }

        /*
          Generate one-hour
          slots only.
        */
        slotCount =
          Math.floor(
            totalMinutes /
              60
          );

        if (
          slotCount <= 0
        ) {
          return [];
        }
      }

      const generated: Slot[] =
        [];

      for (
        let index = 0;
        index < slotCount;
        index++
      ) {
        /*
          For 24-hour:

          index 0 = 00:00
          index 1 = 01:00
          ...
          index 23 = 23:00
        */
        const rawStart =
          slotStart +
          index * 60;

        const actualStart =
          rawStart % 1440;

        const actualEnd =
          (rawStart + 60) %
          1440;

        const startTime =
          formatTime(
            actualStart
          );

        const endTime =
          formatTime(
            actualEnd
          );

        const bookingKey =
          createBookingKey(
            formatDate(
              selectedDate
            ),
            selectedCourtId,
            actualStart
          );

        const currentDateString =
          formatDate(selectedDate);

        const currentBookedSlotKeys =
          bookedSlotKeysByDate[
            currentDateString
          ] ?? new Set<string>();

        const isBooked =
          currentBookedSlotKeys.has(
            bookingKey
          );

        /*
          Past logic applies
          only to today.
        */
        const today =
          isSameDate(
            selectedDate,
            new Date()
          );

        const isPast =
          today &&
          actualStart <
            currentTimeMinutes;

        const isNight =
          isNightSlot(
            actualStart,
            selectedCourt
          );

        const price =
          getSlotPrice(
            actualStart,
            selectedCourt
          );

        generated.push({
          id: bookingKey,

          bookingKey,

          startTime,

          endTime,

          startMinutes:
            actualStart,

          endMinutes:
            actualEnd,

          available:
            !isBooked &&
            !isPast,

          price,

          isPast,

          isNight,
        });
      }

      return generated;
    }, [
      selectedCourt,
      selectedCourtId,
      selectedOperatingHour,
      openingTime,
      closingTime,
      isTwentyFourHours,
      selectedDate,
      currentTimeMinutes,
      bookedSlotKeysByDate,
    ]);

  /* =======================================================
     LOAD BOOKED SLOTS FOR ONE DATE
  ======================================================= */

  const loadBookedSlotsForDate =
    useCallback(
      async (
        dateValue: Date,
        showLoader = true
      ): Promise<Set<string>> => {
        if (
          !turfId ||
          !selectedCourtId
        ) {
          return new Set<string>();
        }

        const dateString =
          formatDate(dateValue);

        if (showLoader) {
          setLoadingDates(
            previous => ({
              ...previous,
              [dateString]: true,
            })
          );
        }

        setErrorByDate(
          previous => ({
            ...previous,
            [dateString]: '',
          })
        );

        try {
          const url =
            getApiUrl(
              `/slots?turfId=${encodeURIComponent(
                turfId
              )}&courtId=${encodeURIComponent(
                selectedCourtId
              )}&date=${encodeURIComponent(
                dateString
              )}`
            );

          console.log(
            'GET /api/slots',
            url
          );

          const response =
            await fetch(
              url,
              {
                method: 'GET',
                headers: {
                  Accept:
                    'application/json',
                },
              }
            );

          const text =
            await response.text();

          let data: SlotsApiResponse =
            {};

          if (text) {
            try {
              data =
                JSON.parse(text);
            } catch {
              throw new Error(
                'Backend returned invalid JSON.'
              );
            }
          }

          if (!response.ok) {
            throw new Error(
              data.message ||
                `Slot API failed with HTTP ${response.status}`
            );
          }

          if (
            data.success ===
            false
          ) {
            throw new Error(
              data.message ||
                'Unable to load slots.'
            );
          }

          /*
            IMPORTANT:
            Only bookedSlots are treated as booked.
            data.slots may contain available slots too.
          */
          const normalized =
            normalizeBookedSlots(
              data,
              dateString,
              selectedCourtId
            );

          if (mountedRef.current) {
            setBookedSlotKeysByDate(
              previous => ({
                ...previous,
                [dateString]:
                  normalized,
              })
            );

            /*
              If a slot became booked after the user
              selected it, remove that slot from this date.
            */
            setSelectedSlotsByDate(
              previous => {
                const existing =
                  previous[
                    dateString
                  ] ?? [];

                if (
                  existing.length ===
                  0
                ) {
                  return previous;
                }

                const remaining =
                  existing.filter(
                    bookingKey =>
                      !normalized.has(
                        bookingKey
                      )
                  );

                if (
                  remaining.length ===
                  existing.length
                ) {
                  return previous;
                }

                return {
                  ...previous,
                  [dateString]:
                    remaining,
                };
              }
            );
          }

          return normalized;
        } catch (error) {
          console.error(
            `Slot API error for ${dateString}:`,
            error
          );

          const message =
            error instanceof Error
              ? error.message
              : 'Unable to load slot availability.';

          if (mountedRef.current) {
            setErrorByDate(
              previous => ({
                ...previous,
                [dateString]:
                  message,
              })
            );
          }

          return new Set<string>();
        } finally {
          if (
            showLoader &&
            mountedRef.current
          ) {
            setLoadingDates(
              previous => ({
                ...previous,
                [dateString]: false,
              })
            );
          }
        }
      },
      [
        turfId,
        selectedCourtId,
      ]
    );

  /* =======================================================
     LOAD CURRENT DATE
  ======================================================= */

  useEffect(() => {
    if (
      !turfId ||
      !selectedCourtId
    ) {
      return;
    }

    const dateString =
      formatDate(selectedDate);

    /*
      Load only when this date has not already been
      checked for the current court.
    */
    if (
      bookedSlotKeysByDate[
        dateString
      ] !== undefined
    ) {
      return;
    }

    loadBookedSlotsForDate(
      selectedDate
    );
  }, [
    turfId,
    selectedCourtId,
    selectedDate,
    bookedSlotKeysByDate,
    loadBookedSlotsForDate,
  ]);

  /* =======================================================
     SLOT SELECTION
  ======================================================= */

  const handleSelectSlot =
    useCallback(
      (slot: Slot) => {
        if (!slot.available) {
          return;
        }

        const dateString =
          formatDate(selectedDate);

        /* Manual slot selection disables the Full Day package
           for this date so the 4% discount cannot be applied
           accidentally. */
        setFullDayDates(previous => {
          const next = { ...previous };
          delete next[dateString];
          return next;
        });

        setSelectedSlotsByDate(
          previous => {
            const current =
              previous[
                dateString
              ] ?? [];

            if (
              current.includes(
                slot.id
              )
            ) {
              const remaining =
                current.filter(
                  id =>
                    id !== slot.id
                );

              if (
                remaining.length ===
                0
              ) {
                const next = {
                  ...previous,
                };

                delete next[
                  dateString
                ];

                return next;
              }

              return {
                ...previous,
                [dateString]:
                  remaining,
              };
            }

            return {
              ...previous,
              [dateString]: [
                ...current,
                slot.id,
              ],
            };
          }
        );
      },
      [selectedDate]
    );

  /* =======================================================
     SELECTED SLOT OBJECTS FOR CURRENT DATE
  ======================================================= */

  const selectedSlotObjects =
    useMemo(() => {
      const dateString =
        formatDate(selectedDate);

      const selectedIds =
        selectedSlotsByDate[
          dateString
        ] ?? [];

      return slots
        .filter(slot =>
          selectedIds.includes(
            slot.id
          )
        )
        .sort(
          (a, b) =>
            a.startMinutes -
            b.startMinutes
        );
    }, [
      slots,
      selectedDate,
      selectedSlotsByDate,
    ]);

  /* =======================================================
     ALL SELECTED BOOKINGS
  ======================================================= */

  const selectedDateStrings =
    useMemo(() => {
      return Object.keys(
        selectedSlotsByDate
      )
        .filter(
          date =>
            (
              selectedSlotsByDate[
                date
              ] ?? []
            ).length > 0
        )
        .sort();
    }, [
      selectedSlotsByDate,
    ]);

  const selectedBookingCount =
    useMemo(() => {
      return selectedDateStrings.reduce(
        (total, date) =>
          total +
          (
            selectedSlotsByDate[
              date
            ] ?? []
          ).length,
        0
      );
    }, [
      selectedDateStrings,
      selectedSlotsByDate,
    ]);

  const baseTotalPrice =
    useMemo(() => {
      return selectedDateStrings.reduce(
        (grandTotal, dateString) => {
          const ids =
            selectedSlotsByDate[dateString] ?? [];

          return (
            grandTotal +
            ids.reduce(
              (dateTotal, bookingKey) => {
                const startMinutes =
                  getMinutesFromBookingKey(bookingKey) ?? 0;

                return (
                  dateTotal +
                  getSlotPrice(
                    startMinutes,
                    selectedCourt
                  )
                );
              },
              0
            )
          );
        },
        0
      );
    }, [
      selectedDateStrings,
      selectedSlotsByDate,
      selectedCourt,
    ]);

  const fullDayDiscountAmount =
    useMemo(() => {
      return selectedDateStrings.reduce(
        (discountTotal, dateString) => {
          if (!fullDayDates[dateString]) {
            return discountTotal;
          }

          const ids =
            selectedSlotsByDate[dateString] ?? [];

          const dateSubtotal = ids.reduce(
            (sum, bookingKey) => {
              const startMinutes =
                getMinutesFromBookingKey(bookingKey) ?? 0;

              return (
                sum +
                getSlotPrice(
                  startMinutes,
                  selectedCourt
                )
              );
            },
            0
          );

          return (
            discountTotal +
            dateSubtotal *
              (fullDayDiscountPercent / 100)
          );
        },
        0
      );
    }, [
      selectedDateStrings,
      selectedSlotsByDate,
      selectedCourt,
      fullDayDates,
      fullDayDiscountPercent,
    ]);

  const totalPrice =
    Math.max(
      0,
      baseTotalPrice -
        fullDayDiscountAmount
    );

  const selectedTimeText =
    useMemo(() => {
      if (
        selectedSlotObjects.length ===
        0
      ) {
        return selectedBookingCount > 0
          ? `${selectedBookingCount} slot(s) across ${selectedDateStrings.length} date(s)`
          : 'Select slots';
      }

      if (
        selectedBookingCount >
        selectedSlotObjects.length
      ) {
        return `${selectedBookingCount} slots across ${selectedDateStrings.length} dates`;
      }

      if (
        selectedSlotObjects.length ===
        1
      ) {
        const slot =
          selectedSlotObjects[0];

        return `${slot.startTime} - ${slot.endTime}`;
      }

      const first =
        selectedSlotObjects[0];

      const last =
        selectedSlotObjects[
          selectedSlotObjects.length -
            1
        ];

      return `${first.startTime} - ${last.endTime}`;
    }, [
      selectedSlotObjects,
      selectedBookingCount,
      selectedDateStrings.length,
    ]);

  /* =======================================================
     DATE LIST
  ======================================================= */

  const nextSevenDays =
    useMemo(() => {
      const result: Date[] =
        [];

      for (
        let index = 0;
        index < 7;
        index++
      ) {
        const date =
          new Date();

        date.setDate(
          date.getDate() +
            index
        );

        date.setHours(
          0,
          0,
          0,
          0
        );

        result.push(
          date
        );
      }

      return result;
    }, []);

  /* =======================================================
     COURT CHANGE
  ======================================================= */

  const handleCourtChange =
    useCallback(
      (courtId: string) => {
        setSelectedCourtId(
          courtId
        );

        /*
          Court changes must clear all date selections,
          because slot IDs are court-specific.
        */
        setSelectedSlotsByDate(
          {}
        );

        setFullDayDates({});

        setBookedSlotKeysByDate(
          {}
        );

        setLoadingDates({});
        setErrorByDate({});
      },
      []
    );

  /* =======================================================
     DATE CHANGE
  ======================================================= */

  const handleDateChange =
    useCallback(
      (date: Date) => {
        if (
          isPastDate(date)
        ) {
          return;
        }

        /*
          IMPORTANT:
          Do NOT clear selectedSlotsByDate here.
          The user's selections for other dates must remain.
        */
        setSelectedDate(
          new Date(date)
        );
      },
      []
    );

  /* =======================================================
     REMOVE SLOT FOR ANY DATE
  ======================================================= */

  const removeSelectedSlotForDate =
    useCallback(
      (
        dateString: string,
        slotId: string
      ) => {
        setSelectedSlotsByDate(
          previous => {
            const current =
              previous[
                dateString
              ] ?? [];

            const remaining =
              current.filter(
                id =>
                  id !== slotId
              );

            if (
              remaining.length ===
              0
            ) {
              const next = {
                ...previous,
              };

              delete next[
                dateString
              ];

              return next;
            }

            return {
              ...previous,
              [dateString]:
                remaining,
            };
          }
        );
      },
      []
    );

  const removeSelectedSlot =
    useCallback(
      (slotId: string) => {
        removeSelectedSlotForDate(
          formatDate(selectedDate),
          slotId
        );
      },
      [
        selectedDate,
        removeSelectedSlotForDate,
      ]
    );

  /* =======================================================
     FULL DAY BOOKING HELPERS
  ======================================================= */

  // Maximum duration allowed for Full Day Booking.
  // Users can select any continuous range from 1 hour up to 12 hours.
  const FULL_DAY_MAX_HOURS = 12;

  const getDurationHours = useCallback(
    (startMinutes: number, endMinutes: number): number => {
      let duration = endMinutes - startMinutes;

      if (duration <= 0) {
        duration += 1440;
      }

      return duration / 60;
    },
    []
  );

  const getFullDayStartOptions = useMemo(() => {
    return slots.filter(slot => slot.available);
  }, [slots]);

  const getFullDayEndOptions = useMemo(() => {
    if (fullDayStartMinutes === null) {
      return [];
    }

    const startIndex = slots.findIndex(
      slot => slot.startMinutes === fullDayStartMinutes
    );

    if (startIndex < 0) {
      return [];
    }

    const options: Slot[] = [];

    /*
      End time represents the end of the selected final slot.

      Full Day Booking supports any continuous duration from
      1 hour up to a maximum of 12 hours.

      Example:
      10:00 -> 15:00 = 5 hours
      10:00 -> 20:00 = 10 hours
      10:00 -> 22:00 = 12 hours

      The loop also stops immediately when an unavailable slot
      is encountered, so the selected range can never contain
      a gap/booked slot.
    */
    for (
      let index = startIndex;
      index < slots.length;
      index++
    ) {
      const candidate = slots[index];

      if (!candidate.available) {
        break;
      }

      const durationHours =
        getDurationHours(
          fullDayStartMinutes,
          candidate.endMinutes
        );

      if (durationHours > FULL_DAY_MAX_HOURS) {
        break;
      }

      options.push(candidate);
    }

    return options;
  }, [
    slots,
    fullDayStartMinutes,
    getDurationHours,
  ]);

  const openFullDayBooking = useCallback(() => {
    if (!selectedCourt) {
      Alert.alert(
        'Select Court',
        'Please select a court first.'
      );
      return;
    }

    if (
      selectedOperatingHour?.isClosed === true ||
      slots.length === 0
    ) {
      Alert.alert(
        'No Slots',
        'There are no bookable slots for this date.'
      );
      return;
    }

    const firstAvailableIndex = slots.findIndex(
      slot => slot.available
    );

    if (firstAvailableIndex < 0) {
      Alert.alert(
        'No Availability',
        'No continuous available slot is available for this date.'
      );
      return;
    }

    const firstAvailable =
      slots[firstAvailableIndex];

    // Default to the longest continuous range currently available,
    // but never more than the 12-hour Full Day limit.
    // The user can change both start and end times in the modal.
    let lastAvailableIndex = firstAvailableIndex;

    for (
      let index = firstAvailableIndex + 1;
      index < slots.length;
      index++
    ) {
      const candidate = slots[index];

      if (!candidate?.available) {
        break;
      }

      const durationHours =
        getDurationHours(
          firstAvailable.startMinutes,
          candidate.endMinutes
        );

      if (durationHours > FULL_DAY_MAX_HOURS) {
        break;
      }

      lastAvailableIndex = index;
    }

    const endCandidate =
      slots[lastAvailableIndex];

    setFullDayStartMinutes(
      firstAvailable.startMinutes
    );

    setFullDayEndMinutes(
      endCandidate && endCandidate.available
        ? endCandidate.endMinutes
        : firstAvailable.endMinutes
    );

    setFullDayModalVisible(true);
  }, [
    selectedCourt,
    selectedOperatingHour,
    slots,
    getDurationHours,
  ]);

  const applyFullDayBooking = useCallback(() => {
    if (
      fullDayStartMinutes === null ||
      fullDayEndMinutes === null
    ) {
      Alert.alert(
        'Select Time',
        'Please select both start time and end time.'
      );
      return;
    }

    const durationHours = getDurationHours(
      fullDayStartMinutes,
      fullDayEndMinutes
    );

    if (durationHours <= 0) {
      Alert.alert(
        'Invalid Time Range',
        'Please select a valid start and end time.'
      );
      return;
    }

    if (durationHours > FULL_DAY_MAX_HOURS) {
      Alert.alert(
        'Maximum 12 Hours',
        'Full Day Booking can be selected for a maximum of 12 continuous hours.'
      );
      return;
    }

    if (
      !Number.isInteger(durationHours)
    ) {
      Alert.alert(
        'Invalid Time',
        'Please select complete one-hour slots.'
      );
      return;
    }

    const startIndex = slots.findIndex(
      slot => slot.startMinutes === fullDayStartMinutes
    );

    if (startIndex < 0) {
      Alert.alert(
        'Slot Unavailable',
        'The selected start time is no longer available.'
      );
      return;
    }

    const requiredSlotCount = durationHours;
    const selectedRange: Slot[] = [];

    for (
      let index = 0;
      index < requiredSlotCount;
      index++
    ) {
      const slot = slots[startIndex + index];

      if (!slot || !slot.available) {
        Alert.alert(
          'Slots Not Available',
          'Full Day Booking requires continuous available slots. One of the selected slots is already booked or unavailable.'
        );
        return;
      }

      selectedRange.push(slot);
    }

    const actualEnd =
      selectedRange[selectedRange.length - 1]?.endMinutes;

    if (
      actualEnd === undefined ||
      getDurationHours(
        fullDayStartMinutes,
        actualEnd
      ) !== durationHours
    ) {
      Alert.alert(
        'Invalid Range',
        'Please choose a continuous time range.'
      );
      return;
    }

    const dateString =
      formatDate(selectedDate);

    setSelectedSlotsByDate(
      previous => ({
        ...previous,
        [dateString]: selectedRange.map(
          slot => slot.id
        ),
      })
    );

    setFullDayDates(
      previous => ({
        ...previous,
        [dateString]: true,
      })
    );

    setFullDayModalVisible(false);
  }, [
    fullDayStartMinutes,
    fullDayEndMinutes,
    getDurationHours,
    slots,
    selectedDate,
  ]);

  /* =======================================================
     BOOK NOW
  ======================================================= */

  const handleBookNow =
    useCallback(
      async () => {
        if (
          !selectedCourt
        ) {
          Alert.alert(
            'Select Court',
            'Please select a court.'
          );

          return;
        }

        if (
          selectedBookingCount ===
          0
        ) {
          Alert.alert(
            'Select Date & Slot',
            'Please select at least one slot. You can select slots on multiple dates.'
          );

          return;
        }

        /*
          Re-check every selected date before payment.
          This is important because another customer can
          book a slot while this screen is open.
        */
        const dateStrings =
          [...selectedDateStrings];

        const refreshedBookings: Array<{
          date: string;
          slots: Slot[];
          slotCount: number;
          subtotal: number;
          discountAmount: number;
          discountPercent: number;
          totalAmount: number;
        }> = [];

        for (
          const dateString of dateStrings
        ) {
          const selectedIds =
            selectedSlotsByDate[
              dateString
            ] ?? [];

          if (
            selectedIds.length ===
            0
          ) {
            continue;
          }

          const dateParts =
            dateString.split('-');

          const dateValue =
            new Date(
              Number(
                dateParts[0]
              ),
              Number(
                dateParts[1]
              ) - 1,
              Number(
                dateParts[2]
              )
            );

          const operatingHour =
            getOperatingHourForDay(
              turf,
              dateValue.getDay()
            );

          if (
            operatingHour?.isClosed
          ) {
            Alert.alert(
              'Turf Closed',
              `${formatDisplayDate(
                dateValue
              )} is closed. Please remove that date from your selection.`
            );

            setSelectedDate(
              dateValue
            );

            return;
          }

          /*
            Refresh availability from backend.
          */
          const booked =
            await loadBookedSlotsForDate(
              dateValue,
              false
            );

          /*
            Convert selected booking keys into
            actual Slot objects.
          */
          const openHour =
            getOpeningTime(
              operatingHour
            );

          const closeHour =
            getClosingTime(
              operatingHour
            );

          const twentyFour =
            is24HourOperatingDay(
              openHour,
              closeHour
            );

          let slotStart = 0;
          let slotCount = 24;

          if (
            !twentyFour
          ) {
            const startMinutes =
              parseTimeToMinutes(
                openHour
              );

            const endMinutes =
              parseTimeToMinutes(
                closeHour
              );

            if (
              startMinutes ===
                null ||
              endMinutes ===
                null
            ) {
              Alert.alert(
                'Invalid Operating Hours',
                `Operating hours are invalid for ${formatDisplayDate(
                  dateValue
                )}.`
              );

              return;
            }

            slotStart =
              startMinutes;

            let totalMinutes =
              endMinutes -
              startMinutes;

            if (
              totalMinutes <=
              0
            ) {
              totalMinutes +=
                1440;
            }

            slotCount =
              Math.floor(
                totalMinutes /
                  60
              );
          }

          const availableSlots: Slot[] =
            [];

          for (
            let index = 0;
            index < slotCount;
            index++
          ) {
            const rawStart =
              slotStart +
              index * 60;

            const actualStart =
              rawStart % 1440;

            const actualEnd =
              (rawStart + 60) %
              1440;

            const bookingKey =
              createBookingKey(
                dateString,
                selectedCourtId,
                actualStart
              );

            const today =
              isSameDate(
                dateValue,
                new Date()
              );

            const isPast =
              today &&
              actualStart <
                currentTimeMinutes;

            const isBooked =
              booked.has(
                bookingKey
              );

            if (
              !isBooked &&
              !isPast
            ) {
              availableSlots.push({
                id: bookingKey,
                bookingKey,
                startTime:
                  formatTime(
                    actualStart
                  ),
                endTime:
                  formatTime(
                    actualEnd
                  ),
                startMinutes:
                  actualStart,
                endMinutes:
                  actualEnd,
                available: true,
                price:
                  getSlotPrice(
                    actualStart,
                    selectedCourt
                  ),
                isPast: false,
                isNight:
                  isNightSlot(
                    actualStart,
                    selectedCourt
                  ),
              });
            }
          }

          const selectedObjects =
            selectedIds
              .map(id =>
                availableSlots.find(
                  slot =>
                    slot.id === id
                )
              )
              .filter(
                (
                  slot
                ): slot is Slot =>
                  !!slot
              )
              .sort(
                (a, b) =>
                  a.startMinutes -
                  b.startMinutes
              );

          if (
            selectedObjects.length !==
            selectedIds.length
          ) {
            Alert.alert(
              'Slot Unavailable',
              `One or more selected slots on ${formatDisplayDate(
                dateValue
              )} are no longer available. Please select again.`
            );

            setSelectedDate(
              dateValue
            );

            /*
              Remove only unavailable slots.
            */
            setSelectedSlotsByDate(
              previous => ({
                ...previous,
                [dateString]:
                  selectedObjects.map(
                    slot =>
                      slot.id
                  ),
              })
            );

            return;
          }

          const dateSubtotal =
            selectedObjects.reduce(
              (sum, slot) =>
                sum +
                Number(
                  slot.price || 0
                ),
              0
            );

          const isFullDayBooking =
            fullDayDates[dateString] === true;

          const dateDiscount =
            isFullDayBooking
              ? dateSubtotal *
                (fullDayDiscountPercent / 100)
              : 0;

          const dateTotal =
            Math.max(
              0,
              dateSubtotal -
                dateDiscount
            );

          refreshedBookings.push({
            date: dateString,
            slots: selectedObjects,
            slotCount:
              selectedObjects.length,
            subtotal: dateSubtotal,
            discountAmount: dateDiscount,
            discountPercent: isFullDayBooking
              ? fullDayDiscountPercent
              : 0,
            totalAmount: dateTotal,
          });
        }

        if (
          refreshedBookings.length ===
          0
        ) {
          Alert.alert(
            'Select Slot',
            'Please select at least one available slot.'
          );

          return;
        }

        const grandTotal =
          refreshedBookings.reduce(
            (sum, booking) =>
              sum +
              booking.totalAmount,
            0
          );

        const totalSlots =
          refreshedBookings.reduce(
            (sum, booking) =>
              sum +
              booking.slotCount,
            0
          );

        const originalTotal =
          refreshedBookings.reduce(
            (sum, booking) =>
              sum +
              booking.subtotal,
            0
          );

        const totalDiscount =
          refreshedBookings.reduce(
            (sum, booking) =>
              sum +
              booking.discountAmount,
            0
          );

        const paymentBookings =
          refreshedBookings.map(
            booking => ({
              date:
                booking.date,
              courtId:
                selectedCourtId,
              slots:
                booking.slots.map(
                  slot => ({
                    id:
                      slot.id,
                    bookingKey:
                      slot.bookingKey,
                    startTime:
                      slot.startTime,
                    endTime:
                      slot.endTime,
                    startMinutes:
                      slot.startMinutes,
                    endMinutes:
                      slot.endMinutes,
                    price:
                      slot.price,
                    isNight:
                      slot.isNight,
                  })
                ),
              slotCount:
                booking.slotCount,
              subtotal:
                booking.subtotal,
              discountAmount:
                booking.discountAmount,
              discountPercent:
                booking.discountPercent,
              totalAmount:
                booking.totalAmount,
            })
          );

        /*
          New multi-date navigation payload.

          `bookings` is the important new field.
          `date`, `slots`, etc. are also kept for
          backward compatibility with older PaymentScreen
          code that may still read a single booking.
        */
        const firstBooking =
          paymentBookings[0];

        const bookingData = {
          turf,

          court:
            selectedCourt,

          turfId,

          courtId:
            selectedCourtId,

          bookings:
            paymentBookings,

          dates:
            paymentBookings.map(
              booking =>
                booking.date
            ),

          slotCount:
            totalSlots,

          totalAmount:
            grandTotal,

          originalTotal,
          discountAmount:
            totalDiscount,
          discountPercent:
            totalDiscount > 0
              ? fullDayDiscountPercent
              : 0,

          /*
            Legacy single-booking fields.
          */
          date:
            firstBooking.date,

          slots:
            firstBooking.slots,

          /*
            Helpful explicit flags.
          */
          isMultiDate:
            paymentBookings.length >
              1,

          isMultiSlot:
            totalSlots > 1,
        };

        console.log(
          'MULTI-DATE BOOKING DATA:',
          JSON.stringify(
            bookingData,
            null,
            2
          )
        );

        navigation.navigate(
          'Payment',
          bookingData
        );
      },
      [
        selectedCourt,
        selectedBookingCount,
        selectedDateStrings,
        selectedSlotsByDate,
        turf,
        turfId,
        selectedCourtId,
        currentTimeMinutes,
        fullDayDates,
        fullDayDiscountPercent,
        loadBookedSlotsForDate,
        navigation,
      ]
    );

  /* =======================================================
     NO TURF
  ======================================================= */

  if (!turf) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.emptyContainer
          }
        >
          <Text
            style={
              styles.emptyTitle
            }
          >
            Turf not found
          </Text>

          <TouchableOpacity
            style={
              styles.backButtonLarge
            }
            onPress={() =>
              navigation.goBack()
            }
          >
            <Text
              style={
                styles.backButtonLargeText
              }
            >
              GO BACK
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* =======================================================
     SELECTED COURT PRICES
  ======================================================= */

  const normalPrice =
    getNormalCourtPrice(
      selectedCourt
    );

  const nightPrice =
    getNightCourtPrice(
      selectedCourt
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      {/* ===================================================
          HEADER
      =================================================== */}

      <View
        style={
          styles.header
        }
      >
        <TouchableOpacity
          style={
            styles.headerBackButton
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

        <Text
          style={
            styles.headerTitle
          }
          numberOfLines={1}
        >
          {turf.name ||
            'Turf Details'}
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* =================================================
            IMAGE
        ================================================= */}

        <View
          style={
            styles.imageContainer
          }
        >
          {turfImage ? (
            <Image
              source={{
                uri: turfImage,
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
                  styles.imagePlaceholderText
                }
              >
                NO IMAGE
              </Text>
            </View>
          )}

          <View
            style={
              styles.turfBadge
            }
          >
            <Text
              style={
                styles.turfBadgeText
              }
            >
              TURF
            </Text>
          </View>
        </View>

        {/* =================================================
            TURF INFO
        ================================================= */}

        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.turfName
            }
          >
            {turf.name ||
              'Turf'}
          </Text>

          {!!turf.city && (
            <Text
              style={
                styles.cityText
              }
            >
              {turf.city}
            </Text>
          )}

          {!!turf.address && (
            <Text
              style={
                styles.addressText
              }
            >
              {turf.address}
            </Text>
          )}

          {!!turf.description && (
            <Text
              style={
                styles.description
              }
            >
              {turf.description}
            </Text>
          )}
        </View>

        {/* =================================================
            COURTS
        ================================================= */}

        <View
          style={
            styles.section
          }
        >
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
              styles.courtScroll
            }
          >
            {activeCourts.map(
              court => {
                const courtId =
                  getCourtId(
                    court
                  );

                const selected =
                  courtId ===
                  selectedCourtId;

                return (
                  <TouchableOpacity
                    key={
                      courtId ||
                      court.name
                    }
                    style={[
                      styles.courtCard,
                      selected &&
                        styles.courtCardSelected,
                    ]}
                    onPress={() =>
                      handleCourtChange(
                        courtId
                      )
                    }
                  >
                    <View
                      style={
                        styles.courtIcon
                      }
                    >
                      <Text
                        style={
                          styles.courtIconText
                        }
                      >
                        ⚽
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.courtName,
                        selected &&
                          styles.courtNameSelected,
                      ]}
                      numberOfLines={
                        1
                      }
                    >
                      {court.name ||
                        'Court'}
                    </Text>

                    <Text
                      style={[
                        styles.courtSport,
                        selected &&
                          styles.courtSportSelected,
                      ]}
                    >
                      {getCourtSportText(
                        court
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.courtPrice,
                        selected &&
                          styles.courtPriceSelected,
                      ]}
                    >
                      {formatCurrency(
                        getNormalCourtPrice(
                          court
                        )
                      )}
                      /hr
                    </Text>

                    {court.hasNightPricing && (
                      <Text
                        style={
                          styles.courtNightPrice
                        }
                      >
                        🌙{' '}
                        {formatCurrency(
                          getNightCourtPrice(
                            court
                          )
                        )}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>
        </View>

        {/* =================================================
            PRICING
        ================================================= */}

        {selectedCourt && (
          <View
            style={
              styles.pricingCard
            }
          >
            <View
              style={
                styles.pricingHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.pricingTitle
                  }
                >
                  {selectedCourt.name ||
                    'Court'}
                </Text>

                <Text
                  style={
                    styles.pricingSport
                  }
                >
                  {getCourtSportText(
                    selectedCourt
                  )}
                </Text>
              </View>

              <Text
                style={
                  styles.pricingNormal
                }
              >
                {formatCurrency(
                  normalPrice
                )}
                /hr
              </Text>
            </View>

            {selectedCourt.hasNightPricing && (
              <View
                style={
                  styles.nightPricingBox
                }
              >
                <View>
                  <Text
                    style={
                      styles.nightPricingTitle
                    }
                  >
                    🌙 Night Pricing
                  </Text>

                  <Text
                    style={
                      styles.nightPricingTime
                    }
                  >
                    {formatTime(
                      Number(
                        selectedCourt.nightStartHour ??
                          0
                      ) * 60
                    )}{' '}
                    -
                    {' '}
                    {formatTime(
                      Number(
                        selectedCourt.nightEndHour ??
                          0
                      ) * 60
                    )}
                  </Text>
                </View>

                <Text
                  style={
                    styles.nightPricingAmount
                  }
                >
                  {formatCurrency(
                    nightPrice
                  )}
                  /hr
                </Text>
              </View>
            )}
          </View>
        )}

        {/* =================================================
            AMENITIES
        ================================================= */}

        {turf.amenities &&
          turf.amenities.length >
            0 && (
            <View
              style={
                styles.section
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Amenities
              </Text>

              <View
                style={
                  styles.amenitiesContainer
                }
              >
                {turf.amenities.map(
                  (
                    amenity,
                    index
                  ) => (
                    <View
                      key={`${amenity}-${index}`}
                      style={
                        styles.amenityChip
                      }
                    >
                      <Text
                        style={
                          styles.amenityText
                        }
                      >
                        ✓ {amenity}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </View>
          )}

        {/* =================================================
            MULTI-DATE SELECTION
        ================================================= */}

        <View
          style={
            styles.section
          }
        >
          <View
            style={
              styles.multiDateHeader
            }
          >
            <View
              style={
                styles.multiDateHeaderText
              }
            >
              <Text
                style={
                  styles.sectionTitleNoMargin
                }
              >
                Select Dates
              </Text>

              <Text
                style={
                  styles.multiDateHint
                }
              >
                Choose a date, then select one or more slots.
                Your selections stay saved when you switch dates.
              </Text>
            </View>

            <View
              style={
                styles.selectedDateCountBadge
              }
            >
              <Text
                style={
                  styles.selectedDateCountText
                }
              >
                {selectedDateStrings.length}
              </Text>

              <Text
                style={
                  styles.selectedDateCountLabel
                }
              >
                date
                {selectedDateStrings.length !==
                1
                  ? 's'
                  : ''}
              </Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.dateScroll
            }
          >
            {nextSevenDays.map(
              date => {
                const dateString =
                  formatDate(date);

                const active =
                  isSameDate(
                    date,
                    selectedDate
                  );

                const selectedCount =
                  (
                    selectedSlotsByDate[
                      dateString
                    ] ?? []
                  ).length;

                const hour =
                  getOperatingHourForDay(
                    turf,
                    date.getDay()
                  );

                const closed =
                  hour?.isClosed ===
                  true;

                return (
                  <TouchableOpacity
                    key={
                      dateString
                    }
                    style={[
                      styles.dateCard,
                      active &&
                        styles.dateCardSelected,
                      selectedCount >
                        0 &&
                        !active &&
                        styles.dateCardHasSelection,
                      closed &&
                        styles.dateCardClosed,
                    ]}
                    onPress={() =>
                      handleDateChange(
                        date
                      )
                    }
                    disabled={
                      isPastDate(date)
                    }
                    activeOpacity={
                      0.8
                    }
                  >
                    {selectedCount >
                      0 && (
                      <View
                        style={[
                          styles.dateSelectionBadge,
                          active &&
                            styles.dateSelectionBadgeActive,
                        ]}
                      >
                        <Text
                          style={
                            styles.dateSelectionBadgeText
                          }
                        >
                          {selectedCount}
                        </Text>
                      </View>
                    )}

                    <Text
                      style={[
                        styles.dateDay,
                        active &&
                          styles.dateTextSelected,
                      ]}
                    >
                      {date.toLocaleDateString(
                        'en-IN',
                        {
                          weekday:
                            'short',
                        }
                      )}
                    </Text>

                    <Text
                      style={[
                        styles.dateNumber,
                        active &&
                          styles.dateTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>

                    <Text
                      style={[
                        styles.dateMonth,
                        active &&
                          styles.dateTextSelected,
                      ]}
                    >
                      {date.toLocaleDateString(
                        'en-IN',
                        {
                          month:
                            'short',
                        }
                      )}
                    </Text>

                    {closed ? (
                      <Text
                        style={
                          styles.closedText
                        }
                      >
                        Closed
                      </Text>
                    ) : selectedCount >
                      0 ? (
                      <Text
                        style={[
                          styles.dateBookedLabel,
                          active &&
                            styles.dateBookedLabelActive,
                        ]}
                      >
                        {selectedCount}{' '}
                        slot
                        {selectedCount !==
                        1
                          ? 's'
                          : ''}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>

          <View
            style={
              styles.activeDateInfo
            }
          >
            <View>
              <Text
                style={
                  styles.selectedDateText
                }
              >
                Booking date
              </Text>

              <Text
                style={
                  styles.activeDateValue
                }
              >
                {formatDisplayDate(
                  selectedDate
                )}
              </Text>
            </View>

            <Text
              style={
                styles.activeDateSlotCount
              }
            >
              {(
                selectedSlotsByDate[
                  formatDate(
                    selectedDate
                  )
                ] ?? []
              ).length}{' '}
              selected
            </Text>
          </View>
        </View>

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

            <Text
              style={
                styles.slotSubtitle
              }
            >
              {isTwentyFourHours
                ? '24-hour booking available'
                : `${openingTime} - ${closingTime}`}
            </Text>
          </View>

          <View
            style={styles.slotHeaderActions}
          >
            {loadingDates[
              formatDate(
                selectedDate
              )
            ] && (
              <ActivityIndicator
                size="small"
                color={
                  COLORS.primary
                }
              />
            )}

            <TouchableOpacity
              style={styles.fullDayButton}
              onPress={openFullDayBooking}
              activeOpacity={0.85}
            >
              <Text
                style={styles.fullDayButtonText}
              >
                FULL DAY
              </Text>
              <Text
                style={styles.fullDayButtonDiscount}
              >
                1–12 HOURS • {fullDayDiscountPercent}% OFF
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =================================================
            24 HOURS INDICATOR
        ================================================= */}

        {isTwentyFourHours &&
          selectedOperatingHour?.isClosed !==
            true && (
            <View
              style={
                styles.twentyFourHourBanner
              }
            >
              <Text
                style={
                  styles.twentyFourHourIcon
                }
              >
                🕐
              </Text>

              <View
                style={
                  styles.twentyFourHourContent
                }
              >
                <Text
                  style={
                    styles.twentyFourHourTitle
                  }
                >
                  Open 24 Hours
                </Text>

                <Text
                  style={
                    styles.twentyFourHourText
                  }
                >
                  All 24 one-hour slots are available for this day.
                </Text>
              </View>
            </View>
          )}

        {/* =================================================
            CLOSED
        ================================================= */}

        {selectedOperatingHour?.isClosed ===
        true ? (
          <View
            style={
              styles.closedCard
            }
          >
            <Text
              style={
                styles.closedIcon
              }
            >
              🔒
            </Text>

            <Text
              style={
                styles.closedTitle
              }
            >
              Turf Closed
            </Text>

            <Text
              style={
                styles.closedDescription
              }
            >
              This turf is closed on the selected date.
            </Text>
          </View>
        ) : (
          <>
            {/* =============================================
                ERROR
            ============================================= */}

            {(
              errorByDate[
                formatDate(
                  selectedDate
                )
              ] ?? ''
            ) !== '' && (
              <View
                style={
                  styles.errorCard
                }
              >
                <Text
                  style={
                    styles.errorTitle
                  }
                >
                  Unable to load availability
                </Text>

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {errorByDate[
                    formatDate(
                      selectedDate
                    )
                  ]}
                </Text>

                <TouchableOpacity
                  style={
                    styles.retryButton
                  }
                  onPress={() =>
                    loadBookedSlotsForDate(
                      selectedDate
                    )
                  }
                >
                  <Text
                    style={
                      styles.retryButtonText
                    }
                  >
                    RETRY
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* =============================================
                CURRENT TIME
            ============================================= */}

            {isSameDate(
              selectedDate,
              new Date()
            ) && (
              <View
                style={
                  styles.currentTimeBanner
                }
              >
                <Text
                  style={
                    styles.currentTimeText
                  }
                >
                  Current time:{' '}
                  {formatTime(
                    currentTimeMinutes
                  )}
                </Text>

                <Text
                  style={
                    styles.currentTimeHint
                  }
                >
                  Past slots cannot be booked.
                </Text>
              </View>
            )}

            {/* =============================================
                SLOT GRID
            ============================================= */}

            {loadingDates[
              formatDate(
                selectedDate
              )
            ] ? (
              <View
                style={
                  styles.loadingContainer
                }
              >
                <ActivityIndicator
                  size="large"
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.loadingText
                  }
                >
                  Checking slot availability...
                </Text>
              </View>
            ) : slots.length ===
              0 ? (
              <View
                style={
                  styles.noSlotsCard
                }
              >
                <Text
                  style={
                    styles.noSlotsTitle
                  }
                >
                  No slots available
                </Text>

                <Text
                  style={
                    styles.noSlotsText
                  }
                >
                  Please check the turf operating hours.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.slotGrid
                }
              >
                {slots.map(
                  slot => {
                    const currentDateString =
                      formatDate(
                        selectedDate
                      );

                    const selected =
                      (
                        selectedSlotsByDate[
                          currentDateString
                        ] ?? []
                      ).includes(
                        slot.id
                      );

                    const booked =
                      (
                        bookedSlotKeysByDate[
                          currentDateString
                        ] ??
                        new Set<string>()
                      ).has(
                        slot.bookingKey
                      );

                    return (
                      <TouchableOpacity
                        key={
                          slot.id
                        }
                        style={[
                          styles.slotCard,

                          selected &&
                            styles.slotCardSelected,

                          !slot.available &&
                            styles.slotCardDisabled,
                        ]}
                        disabled={
                          !slot.available
                        }
                        onPress={() =>
                          handleSelectSlot(
                            slot
                          )
                        }
                        activeOpacity={
                          0.8
                        }
                      >
                        <Text
                          style={[
                            styles.slotTime,
                            selected &&
                              styles.slotTimeSelected,
                            !slot.available &&
                              styles.slotTimeDisabled,
                          ]}
                        >
                          {
                            slot.startTime
                          }
                        </Text>

                        <Text
                          style={[
                            styles.slotEndTime,
                            selected &&
                              styles.slotEndTimeSelected,
                          ]}
                        >
                          to{' '}
                          {
                            slot.endTime
                          }
                        </Text>

                        <Text
                          style={[
                            styles.slotPrice,
                            selected &&
                              styles.slotPriceSelected,
                          ]}
                        >
                          {formatCurrency(
                            slot.price
                          )}
                        </Text>

                        {slot.isNight &&
                          slot.available && (
                            <View
                              style={
                                styles.nightBadge
                              }
                            >
                              <Text
                                style={
                                  styles.nightBadgeText
                                }
                              >
                                🌙 NIGHT
                              </Text>
                            </View>
                          )}

                        {selected && (
                          <View
                            style={
                              styles.selectedCheck
                            }
                          >
                            <Text
                              style={
                                styles.selectedCheckText
                              }
                            >
                              ✓
                            </Text>
                          </View>
                        )}

                        {!slot.isPast &&
                          booked && (
                            <View
                              style={
                                styles.slotOverlay
                              }
                            >
                              <Text
                                style={
                                  styles.slotUnavailableText
                                }
                              >
                                BOOKED
                              </Text>
                            </View>
                          )}

                        {slot.isPast && (
                          <View
                            style={
                              styles.slotOverlay
                            }
                          >
                            <Text
                              style={
                                styles.slotUnavailableText
                              }
                            >
                              PAST
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            )}
          </>
        )}

        {/* =================================================
            ALL SELECTED DATES + SLOTS
        ================================================= */}

        {selectedBookingCount >
          0 && (
          <View
            style={
              styles.selectedCard
            }
          >
            <View
              style={
                styles.selectedHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.selectedTitle
                  }
                >
                  Booking Summary
                </Text>

                <Text
                  style={
                    styles.selectedSubtitle
                  }
                >
                  {selectedBookingCount}{' '}
                  slot
                  {selectedBookingCount !==
                  1
                    ? 's'
                    : ''}{' '}
                  across{' '}
                  {
                    selectedDateStrings.length
                  }{' '}
                  date
                  {selectedDateStrings.length !==
                  1
                    ? 's'
                    : ''}
                </Text>
              </View>

              <View style={styles.selectedTotalBox}>
                {fullDayDiscountAmount > 0 && (
                  <Text style={styles.selectedOriginalTotal}>
                    {formatCurrency(baseTotalPrice)}
                  </Text>
                )}
                <Text
                  style={
                    styles.selectedTotal
                  }
                >
                  {formatCurrency(
                    totalPrice
                  )}
                </Text>
                {fullDayDiscountAmount > 0 && (
                  <Text style={styles.selectedDiscountText}>
                    {fullDayDiscountPercent}% OFF • Saved {formatCurrency(fullDayDiscountAmount)}
                  </Text>
                )}
              </View>
            </View>

            {selectedDateStrings.map(
              dateString => {
                const selectedIds =
                  selectedSlotsByDate[
                    dateString
                  ] ?? [];

                return (
                  <View
                    key={
                      dateString
                    }
                    style={
                      styles.selectedDateGroup
                    }
                  >
                    <View
                      style={
                        styles.selectedDateGroupHeader
                      }
                    >
                      <Text
                        style={
                          styles.selectedDateGroupTitle
                        }
                      >
                        {formatDisplayDate(
                          new Date(
                            Number(
                              dateString.slice(
                                0,
                                4
                              )
                            ),
                            Number(
                              dateString.slice(
                                5,
                                7
                              )
                            ) - 1,
                            Number(
                              dateString.slice(
                                8,
                                10
                              )
                            )
                          )
                        )}
                      </Text>

                      <TouchableOpacity
                        onPress={() => {
                          setSelectedSlotsByDate(
                            previous => {
                              const next = {
                                ...previous,
                              };

                              delete next[
                                dateString
                              ];

                              setFullDayDates(
                                current => {
                                  const nextFullDay = { ...current };
                                  delete nextFullDay[dateString];
                                  return nextFullDay;
                                }
                              );

                              return next;
                            }
                          );
                        }}
                      >
                        <Text
                          style={
                            styles.clearDateText
                          }
                        >
                          Clear date
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {[...selectedIds]
                      .sort(
                        (a, b) =>
                          (
                            getMinutesFromBookingKey(
                              a
                            ) ?? 0
                          ) -
                          (
                            getMinutesFromBookingKey(
                              b
                            ) ?? 0
                          )
                      )
                      .map(
                        bookingKey => {
                          const minutes =
                            getMinutesFromBookingKey(
                              bookingKey
                            ) ?? 0;

                          const endMinutes =
                            (minutes +
                              60) %
                            1440;

                          const isNight =
                            isNightSlot(
                              minutes,
                              selectedCourt
                            );

                          const price =
                            getSlotPrice(
                              minutes,
                              selectedCourt
                            );

                          return (
                            <View
                              key={
                                bookingKey
                              }
                              style={
                                styles.selectedSlotRow
                              }
                            >
                              <View
                                style={
                                  styles.selectedSlotInfo
                                }
                              >
                                <Text
                                  style={
                                    styles.selectedSlotTime
                                  }
                                >
                                  {formatTime(
                                    minutes
                                  )}{' '}
                                  -{' '}
                                  {formatTime(
                                    endMinutes
                                  )}
                                </Text>

                                <Text
                                  style={
                                    styles.selectedSlotPrice
                                  }
                                >
                                  {formatCurrency(
                                    price
                                  )}
                                  {isNight
                                    ? ' • Night'
                                    : ''}
                                </Text>
                              </View>

                              <TouchableOpacity
                                style={
                                  styles.removeButton
                                }
                                onPress={() =>
                                  removeSelectedSlotForDate(
                                    dateString,
                                    bookingKey
                                  )
                                }
                              >
                                <Text
                                  style={
                                    styles.removeButtonText
                                  }
                                >
                                  ×
                                </Text>
                              </TouchableOpacity>
                            </View>
                          );
                        }
                      )}
                  </View>
                );
              }
            )}
          </View>
        )}

        {/* =================================================
            LOCATION
        ================================================= */}

        {(turf.address ||
          turf.city) && (
          <View
            style={
              styles.locationCard
            }
          >
            <Text
              style={
                styles.locationTitle
              }
            >
              📍 Location
            </Text>

            {!!turf.address && (
              <Text
                style={
                  styles.locationText
                }
              >
                {turf.address}
              </Text>
            )}

            {!!turf.city && (
              <Text
                style={
                  styles.locationCity
                }
              >
                {turf.city}
              </Text>
            )}
          </View>
        )}

        <View
          style={
            styles.bottomSpacing
          }
        />
      </ScrollView>

      {/* =====================================================
          FULL DAY BOOKING MODAL
      ===================================================== */}
      <Modal
        visible={fullDayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setFullDayModalVisible(false)
        }
      >
        <View style={styles.fullDayModalOverlay}>
          <View style={styles.fullDayModalCard}>
            <View style={styles.fullDayModalHeader}>
              <View style={styles.fullDayModalHeaderText}>
                <Text style={styles.fullDayModalTitle}>
                  Full Day Booking
                </Text>
                <Text style={styles.fullDayModalSubtitle}>
                  Choose your start and end time. Maximum booking duration is 12 continuous hours.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.fullDayCloseButton}
                onPress={() =>
                  setFullDayModalVisible(false)
                }
              >
                <Text style={styles.fullDayCloseText}>
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fullDayOfferBanner}>
              <Text style={styles.fullDayOfferTitle}>
                🎉 {fullDayDiscountPercent}% OFF Full Day Booking
              </Text>
              <Text style={styles.fullDayOfferText}>
                Choose your own start and end time. Book any continuous duration from 1 to 12 hours and save the configured discount.
              </Text>
            </View>

            <Text style={styles.fullDayFieldLabel}>
              START TIME
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fullDayTimeList}
            >
              {getFullDayStartOptions.map(slot => {
                const selected =
                  slot.startMinutes ===
                  fullDayStartMinutes;

                return (
                  <TouchableOpacity
                    key={`start-${slot.id}`}
                    style={[
                      styles.fullDayTimeChip,
                      selected &&
                        styles.fullDayTimeChipSelected,
                    ]}
                    onPress={() => {
                      setFullDayStartMinutes(
                        slot.startMinutes
                      );

                      const nextEnd =
                        slots.find(
                          candidate =>
                            candidate.startMinutes ===
                            slot.startMinutes + 60
                        );

                      setFullDayEndMinutes(
                        nextEnd?.endMinutes ??
                          slot.endMinutes
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.fullDayTimeChipText,
                        selected &&
                          styles.fullDayTimeChipTextSelected,
                      ]}
                    >
                      {slot.startTime}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.fullDayFieldLabel}>
              END TIME
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.fullDayTimeList}
            >
              {getFullDayEndOptions.map(slot => {
                const selected =
                  slot.endMinutes ===
                  fullDayEndMinutes;

                return (
                  <TouchableOpacity
                    key={`end-${slot.id}`}
                    style={[
                      styles.fullDayTimeChip,
                      selected &&
                        styles.fullDayTimeChipSelected,
                    ]}
                    onPress={() =>
                      setFullDayEndMinutes(
                        slot.endMinutes
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.fullDayTimeChipText,
                        selected &&
                          styles.fullDayTimeChipTextSelected,
                      ]}
                    >
                      {slot.endTime}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.fullDayRangeSummary}>
              <View>
                <Text style={styles.fullDayRangeLabel}>
                  SELECTED RANGE
                </Text>
                <Text style={styles.fullDayRangeValue}>
                  {fullDayStartMinutes !== null
                    ? formatTime(fullDayStartMinutes)
                    : '--'}{' '}
                  →{' '}
                  {fullDayEndMinutes !== null
                    ? formatTime(fullDayEndMinutes)
                    : '--'}
                </Text>
              </View>

              <View style={styles.fullDayHoursBadge}>
                <Text style={styles.fullDayHoursValue}>
                  {fullDayStartMinutes !== null &&
                  fullDayEndMinutes !== null
                    ? getDurationHours(
                        fullDayStartMinutes,
                        fullDayEndMinutes
                      )
                    : 0}
                </Text>
                <Text style={styles.fullDayHoursLabel}>
                  HOURS
                </Text>
              </View>
            </View>

            <View style={styles.fullDayModalActions}>
              <TouchableOpacity
                style={styles.fullDayCancelButton}
                onPress={() =>
                  setFullDayModalVisible(false)
                }
              >
                <Text style={styles.fullDayCancelText}>
                  CANCEL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fullDayApplyButton}
                onPress={applyFullDayBooking}
              >
                <Text style={styles.fullDayApplyText}>
                  APPLY {fullDayDiscountPercent}% OFF
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =====================================================
          BOOKING BAR
      ===================================================== */}

      <View
        style={
          styles.bookingBar
        }
      >
        <View
          style={
            styles.bookingSummary
          }
        >
          <Text
            style={
              styles.bookingCount
            }
          >
            {selectedBookingCount}{' '}
            slot
            {selectedBookingCount !==
            1
              ? 's'
              : ''}{' '}
            •{' '}
            {selectedDateStrings.length}{' '}
            date
            {selectedDateStrings.length !==
            1
              ? 's'
              : ''}
          </Text>

          <Text
            style={
              styles.bookingTime
            }
          >
            {selectedTimeText}
          </Text>

          {fullDayDiscountAmount > 0 && (
            <Text style={styles.bookingDiscountText}>
              {fullDayDiscountPercent}% OFF • Saved {formatCurrency(fullDayDiscountAmount)}
            </Text>
          )}

          <Text
            style={
              styles.bookingTotal
            }
          >
            {formatCurrency(
              totalPrice
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            selectedBookingCount ===
              0 &&
              styles.continueButtonDisabled,
          ]}
          disabled={
            selectedBookingCount ===
            0
          }
          onPress={
            handleBookNow
          }
        >
          <Text
            style={
              styles.continueButtonText
            }
          >
            CONTINUE
          </Text>

          <Text
            style={
              styles.continueArrow
            }
          >
            →
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        COLORS.background,
    },

    header: {
      height: 58,
      backgroundColor:
        COLORS.white,
      flexDirection:
        'row',
      alignItems:
        'center',
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor:
        COLORS.border,
    },

    headerBackButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        '#F3F4F6',
    },

    headerBackText: {
      fontSize: 32,
      color:
        COLORS.text,
      marginTop: -3,
    },

    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight:
        '700',
      color:
        COLORS.text,
      marginLeft: 12,
    },

    headerSpacer: {
      width: 40,
    },

    scrollContent: {
      paddingBottom: 20,
    },

    imageContainer: {
      width: '100%',
      height: 230,
      backgroundColor:
        '#E5E7EB',
      position:
        'relative',
    },

    turfImage: {
      width: '100%',
      height: '100%',
    },

    imagePlaceholder: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    imagePlaceholderText: {
      color:
        COLORS.textSecondary,
      fontWeight:
        '700',
    },

    turfBadge: {
      position:
        'absolute',
      top: 16,
      left: 16,
      backgroundColor:
        COLORS.primary,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
    },

    turfBadgeText: {
      color:
        COLORS.white,
      fontSize: 11,
      fontWeight:
        '800',
    },

    card: {
      backgroundColor:
        COLORS.white,
      marginHorizontal: 16,
      marginTop: -18,
      borderRadius: 16,
      padding: 18,
      elevation: 3,
      zIndex: 2,
    },

    turfName: {
      fontSize: 23,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    cityText: {
      fontSize: 14,
      color:
        COLORS.primary,
      fontWeight:
        '600',
      marginTop: 5,
    },

    addressText: {
      fontSize: 14,
      color:
        COLORS.textSecondary,
      marginTop: 6,
      lineHeight: 20,
    },

    description: {
      fontSize: 14,
      color:
        COLORS.textSecondary,
      marginTop: 12,
      lineHeight: 21,
    },

    section: {
      marginTop: 20,
    },

    sectionTitle: {
      fontSize: 19,
      fontWeight:
        '800',
      color:
        COLORS.text,
      marginHorizontal: 16,
    },

    sectionTitleNoMargin: {
      fontSize: 19,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    multiDateHeader: {
      paddingHorizontal: 16,
      paddingTop: 2,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    multiDateHeaderText: {
      flex: 1,
      paddingRight: 12,
    },

    multiDateHint: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 5,
      lineHeight: 17,
    },

    selectedDateCountBadge: {
      minWidth: 48,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor:
        COLORS.primaryLight,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 8,
    },

    selectedDateCountText: {
      fontSize: 17,
      fontWeight:
        '900',
      color:
        COLORS.primaryDark,
    },

    selectedDateCountLabel: {
      fontSize: 9,
      fontWeight:
        '700',
      color:
        COLORS.primaryDark,
    },

    courtScroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },

    courtCard: {
      width: 155,
      minHeight: 175,
      backgroundColor:
        COLORS.white,
      borderRadius: 16,
      padding: 14,
      marginRight: 12,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    courtCardSelected: {
      borderColor:
        COLORS.primary,
      borderWidth: 2,
      backgroundColor:
        '#F0FDF4',
    },

    courtIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        COLORS.primaryLight,
      marginBottom: 10,
    },

    courtIconText: {
      fontSize: 20,
    },

    courtName: {
      fontSize: 16,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    courtNameSelected: {
      color:
        COLORS.primaryDark,
    },

    courtSport: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 4,
    },

    courtSportSelected: {
      color:
        COLORS.primaryDark,
    },

    courtPrice: {
      fontSize: 14,
      color:
        COLORS.text,
      fontWeight:
        '700',
      marginTop: 10,
    },

    courtPriceSelected: {
      color:
        COLORS.primaryDark,
    },

    courtNightPrice: {
      fontSize: 12,
      color:
        COLORS.purple,
      fontWeight:
        '700',
      marginTop: 5,
    },

    pricingCard: {
      backgroundColor:
        COLORS.white,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor:
        COLORS.border,
    },

    pricingHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    pricingTitle: {
      fontSize: 17,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    pricingSport: {
      fontSize: 13,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    pricingNormal: {
      fontSize: 16,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
    },

    nightPricingBox: {
      marginTop: 14,
      backgroundColor:
        COLORS.purpleLight,
      borderRadius: 12,
      padding: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    nightPricingTitle: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.purple,
    },

    nightPricingTime: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    nightPricingAmount: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.purple,
    },

    amenitiesContainer: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },

    amenityChip: {
      backgroundColor:
        COLORS.primaryLight,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },

    amenityText: {
      color:
        COLORS.primaryDark,
      fontSize: 12,
      fontWeight:
        '700',
    },

    dateScroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
    },

    dateCard: {
      width: 72,
      minHeight: 92,
      backgroundColor:
        COLORS.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    dateCardSelected: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    dateCardHasSelection: {
      borderColor:
        COLORS.primary,
      borderWidth: 2,
      backgroundColor:
        '#F0FDF4',
    },

    dateSelectionBadge: {
      position:
        'absolute',
      top: 5,
      right: 5,
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor:
        COLORS.primary,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 4,
      zIndex: 5,
    },

    dateSelectionBadgeActive: {
      backgroundColor:
        COLORS.white,
    },

    dateSelectionBadgeText: {
      fontSize: 10,
      fontWeight:
        '900',
      color:
        COLORS.white,
    },

    dateCardClosed: {
      opacity: 0.55,
    },

    dateDay: {
      fontSize: 12,
      fontWeight:
        '700',
      color:
        COLORS.textSecondary,
    },

    dateNumber: {
      fontSize: 24,
      fontWeight:
        '900',
      color:
        COLORS.text,
      marginTop: 3,
    },

    dateMonth: {
      fontSize: 11,
      color:
        COLORS.textSecondary,
    },

    dateTextSelected: {
      color:
        COLORS.white,
    },

    closedText: {
      fontSize: 9,
      color:
        COLORS.red,
      fontWeight:
        '800',
      marginTop: 3,
    },

    selectedDateText: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 0,
    },

    activeDateInfo: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        COLORS.white,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    activeDateValue: {
      fontSize: 15,
      fontWeight:
        '800',
      color:
        COLORS.text,
      marginTop: 2,
    },

    activeDateSlotCount: {
      fontSize: 12,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
      backgroundColor:
        COLORS.primaryLight,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
    },

    dateBookedLabel: {
      fontSize: 9,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
      marginTop: 3,
    },

    dateBookedLabelActive: {
      color:
        COLORS.white,
    },

    slotHeader: {
      marginTop: 20,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingRight: 16,
    },

    slotSubtitle: {
      marginHorizontal: 16,
      marginTop: 4,
      color:
        COLORS.textSecondary,
      fontSize: 12,
    },

    twentyFourHourBanner: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        COLORS.primaryLight,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderWidth: 1,
      borderColor:
        '#BBF7D0',
    },

    twentyFourHourIcon: {
      fontSize: 25,
      marginRight: 10,
    },

    twentyFourHourContent: {
      flex: 1,
    },

    twentyFourHourTitle: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
    },

    twentyFourHourText: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    currentTimeBanner: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor:
        COLORS.blueLight,
    },

    currentTimeText: {
      fontSize: 13,
      fontWeight:
        '800',
      color:
        COLORS.blue,
    },

    currentTimeHint: {
      fontSize: 11,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    slotGrid: {
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
    },

    slotCard: {
      width: '31%',
      minHeight: 110,
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.white,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 8,
      position:
        'relative',
      overflow:
        'hidden',
    },

    slotCardSelected: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    slotCardDisabled: {
      backgroundColor:
        '#F3F4F6',
      borderColor:
        '#E5E7EB',
    },

    slotTime: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    slotTimeSelected: {
      color:
        COLORS.white,
    },

    slotTimeDisabled: {
      color:
        COLORS.textLight,
    },

    slotEndTime: {
      fontSize: 10,
      color:
        COLORS.textSecondary,
      marginTop: 2,
    },

    slotEndTimeSelected: {
      color:
        COLORS.white,
    },

    slotPrice: {
      fontSize: 12,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
      marginTop: 8,
    },

    slotPriceSelected: {
      color:
        COLORS.white,
    },

    nightBadge: {
      backgroundColor:
        COLORS.purpleLight,
      paddingHorizontal: 5,
      paddingVertical: 3,
      borderRadius: 5,
      marginTop: 5,
    },

    nightBadgeText: {
      fontSize: 7,
      fontWeight:
        '900',
      color:
        COLORS.purple,
    },

    selectedCheck: {
      position:
        'absolute',
      top: 5,
      right: 5,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor:
        COLORS.white,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    selectedCheckText: {
      fontSize: 13,
      fontWeight:
        '900',
      color:
        COLORS.primary,
    },

    /*
      Full BOOKED / PAST overlay.
    */
    slotOverlay: {
      // ...StyleSheet.absoluteFillObject,
      backgroundColor:
        'rgba(255,255,255,0.78)',
      alignItems:
        'center',
      justifyContent:
        'center',
      zIndex: 20,
    },

    slotUnavailableText: {
      fontSize: 10,
      fontWeight:
        '900',
      color:
        COLORS.red,
    },

    loadingContainer: {
      minHeight: 150,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    loadingText: {
      fontSize: 13,
      color:
        COLORS.textSecondary,
      marginTop: 10,
    },

    errorCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 14,
      borderRadius: 14,
      backgroundColor:
        COLORS.redLight,
      borderWidth: 1,
      borderColor:
        '#FECACA',
    },

    errorTitle: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.red,
    },

    errorText: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 5,
    },

    retryButton: {
      alignSelf:
        'flex-start',
      marginTop: 10,
      backgroundColor:
        COLORS.red,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },

    retryButtonText: {
      color:
        COLORS.white,
      fontSize: 11,
      fontWeight:
        '800',
    },

    closedCard: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor:
        COLORS.redLight,
      borderRadius: 16,
      padding: 20,
      alignItems:
        'center',
    },

    closedIcon: {
      fontSize: 28,
    },

    closedTitle: {
      fontSize: 18,
      fontWeight:
        '800',
      color:
        COLORS.red,
      marginTop: 8,
    },

    closedDescription: {
      fontSize: 13,
      color:
        COLORS.textSecondary,
      marginTop: 5,
      textAlign:
        'center',
    },

    noSlotsCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 18,
      borderRadius: 14,
      backgroundColor:
        COLORS.white,
      alignItems:
        'center',
    },

    noSlotsTitle: {
      fontSize: 16,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    noSlotsText: {
      fontSize: 13,
      color:
        COLORS.textSecondary,
      marginTop: 5,
      textAlign:
        'center',
    },

    slotHeaderActions: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 8,
    },

    fullDayButton: {
      backgroundColor:
        COLORS.purple,
      borderRadius: 12,
      paddingHorizontal: 11,
      paddingVertical: 8,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    fullDayButtonText: {
      color:
        COLORS.white,
      fontSize: 11,
      fontWeight:
        '900',
    },

    fullDayButtonDiscount: {
      color:
        COLORS.white,
      fontSize: 7,
      fontWeight:
        '800',
      marginTop: 2,
    },

    fullDayModalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.48)',
      justifyContent:
        'flex-end',
    },

    fullDayModalCard: {
      backgroundColor:
        COLORS.white,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 26,
    },

    fullDayModalHeader: {
      flexDirection:
        'row',
      alignItems:
        'flex-start',
      justifyContent:
        'space-between',
    },

    fullDayModalHeaderText: {
      flex: 1,
      paddingRight: 10,
    },

    fullDayModalTitle: {
      fontSize: 21,
      fontWeight:
        '900',
      color:
        COLORS.text,
    },

    fullDayModalSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      color:
        COLORS.textSecondary,
      marginTop: 4,
    },

    fullDayCloseButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        '#F3F4F6',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    fullDayCloseText: {
      fontSize: 25,
      lineHeight: 28,
      color:
        COLORS.textSecondary,
    },

    fullDayOfferBanner: {
      marginTop: 16,
      backgroundColor:
        COLORS.purpleLight,
      borderRadius: 14,
      padding: 13,
      borderWidth: 1,
      borderColor:
        '#DDD6FE',
    },

    fullDayOfferTitle: {
      color:
        COLORS.purple,
      fontSize: 14,
      fontWeight:
        '900',
    },

    fullDayOfferText: {
      color:
        COLORS.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },

    fullDayFieldLabel: {
      fontSize: 11,
      fontWeight:
        '900',
      color:
        COLORS.textSecondary,
      marginTop: 18,
      marginBottom: 8,
    },

    fullDayTimeList: {
      paddingRight: 10,
      gap: 8,
    },

    fullDayTimeChip: {
      minWidth: 76,
      height: 42,
      borderRadius: 11,
      borderWidth: 1,
      borderColor:
        COLORS.border,
      backgroundColor:
        COLORS.white,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 10,
    },

    fullDayTimeChipSelected: {
      backgroundColor:
        COLORS.primary,
      borderColor:
        COLORS.primary,
    },

    fullDayTimeChipText: {
      color:
        COLORS.text,
      fontSize: 12,
      fontWeight:
        '800',
    },

    fullDayTimeChipTextSelected: {
      color:
        COLORS.white,
    },

    fullDayRangeSummary: {
      marginTop: 18,
      borderRadius: 14,
      backgroundColor:
        COLORS.background,
      padding: 13,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    fullDayRangeLabel: {
      fontSize: 9,
      fontWeight:
        '900',
      color:
        COLORS.textSecondary,
    },

    fullDayRangeValue: {
      fontSize: 17,
      fontWeight:
        '900',
      color:
        COLORS.text,
      marginTop: 4,
    },

    fullDayHoursBadge: {
      minWidth: 58,
      height: 50,
      borderRadius: 12,
      backgroundColor:
        COLORS.primaryLight,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    fullDayHoursValue: {
      fontSize: 17,
      fontWeight:
        '900',
      color:
        COLORS.primaryDark,
    },

    fullDayHoursLabel: {
      fontSize: 7,
      fontWeight:
        '900',
      color:
        COLORS.primaryDark,
    },

    fullDayModalActions: {
      flexDirection:
        'row',
      gap: 10,
      marginTop: 18,
    },

    fullDayCancelButton: {
      flex: 1,
      height: 50,
      borderRadius: 12,
      backgroundColor:
        '#F3F4F6',
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    fullDayCancelText: {
      fontSize: 12,
      fontWeight:
        '900',
      color:
        COLORS.textSecondary,
    },

    fullDayApplyButton: {
      flex: 1.4,
      height: 50,
      borderRadius: 12,
      backgroundColor:
        COLORS.primary,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    fullDayApplyText: {
      fontSize: 12,
      fontWeight:
        '900',
      color:
        COLORS.white,
    },

    selectedTotalBox: {
      alignItems:
        'flex-end',
    },

    selectedOriginalTotal: {
      fontSize: 11,
      color:
        COLORS.textLight,
      textDecorationLine:
        'line-through',
      marginBottom: 1,
    },

    selectedDiscountText: {
      fontSize: 9,
      fontWeight:
        '800',
      color:
        COLORS.purple,
      marginTop: 2,
    },

    bookingDiscountText: {
      fontSize: 9,
      fontWeight:
        '800',
      color:
        COLORS.purple,
      marginTop: 1,
    },

    selectedCard: {
      marginHorizontal: 16,
      marginTop: 20,
      backgroundColor:
        COLORS.white,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor:
        COLORS.primaryLight,
    },

    selectedDateGroup: {
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      paddingTop: 8,
    },

    selectedDateGroupHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      paddingVertical: 5,
    },

    selectedDateGroupTitle: {
      fontSize: 14,
      fontWeight:
        '800',
      color:
        COLORS.primaryDark,
    },

    clearDateText: {
      fontSize: 11,
      fontWeight:
        '800',
      color:
        COLORS.red,
    },

    selectedSlotInfo: {
      flex: 1,
    },

    selectedHeader: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      marginBottom: 12,
    },

    selectedTitle: {
      fontSize: 17,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    selectedSubtitle: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    selectedTotal: {
      fontSize: 18,
      fontWeight:
        '900',
      color:
        COLORS.primaryDark,
    },

    selectedSlotRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      paddingVertical: 12,
    },

    selectedSlotTime: {
      fontSize: 14,
      fontWeight:
        '700',
      color:
        COLORS.text,
    },

    selectedSlotPrice: {
      fontSize: 12,
      color:
        COLORS.textSecondary,
      marginTop: 3,
    },

    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        COLORS.redLight,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    removeButtonText: {
      fontSize: 22,
      color:
        COLORS.red,
      lineHeight: 25,
    },

    locationCard: {
      marginHorizontal: 16,
      marginTop: 20,
      backgroundColor:
        COLORS.white,
      borderRadius: 16,
      padding: 16,
    },

    locationTitle: {
      fontSize: 17,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    locationText: {
      fontSize: 14,
      color:
        COLORS.textSecondary,
      marginTop: 10,
      lineHeight: 20,
    },

    locationCity: {
      fontSize: 13,
      color:
        COLORS.primary,
      fontWeight:
        '700',
      marginTop: 5,
    },

    bottomSpacing: {
      height: 30,
    },

    emptyContainer: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      fontSize: 22,
      fontWeight:
        '800',
      color:
        COLORS.text,
    },

    backButtonLarge: {
      marginTop: 20,
      backgroundColor:
        COLORS.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 10,
    },

    backButtonLargeText: {
      color:
        COLORS.white,
      fontWeight:
        '800',
    },

    bookingBar: {
      backgroundColor:
        COLORS.white,
      borderTopWidth: 1,
      borderTopColor:
        COLORS.border,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 10,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 12,
    },

    bookingSummary: {
      flex: 1,
    },

    bookingCount: {
      fontSize: 11,
      fontWeight:
        '700',
      color:
        COLORS.textSecondary,
    },

    bookingTime: {
      fontSize: 12,
      fontWeight:
        '700',
      color:
        COLORS.text,
      marginTop: 2,
    },

    bookingTotal: {
      fontSize: 18,
      fontWeight:
        '900',
      color:
        COLORS.primaryDark,
      marginTop: 2,
    },

    continueButton: {
      minWidth: 135,
      height: 52,
      borderRadius: 13,
      backgroundColor:
        COLORS.primary,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal: 14,
    },

    continueButtonDisabled: {
      backgroundColor:
        '#A7F3D0',
    },

    continueButtonText: {
      color:
        COLORS.white,
      fontSize: 13,
      fontWeight:
        '900',
    },

    continueArrow: {
      color:
        COLORS.white,
      fontSize: 20,
      marginLeft: 7,
    },
  });

export default TurfDetailsScreen;