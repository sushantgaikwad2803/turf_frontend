  import React, {
    useCallback,
    useEffect,
    useMemo,
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

  const API_BASE_URL = 'http://192.168.0.100:5000/api';

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

    night: '#7C3AED',
    nightLight: '#EDE9FE',
    nightSoft: '#FAF5FF',
    nightBorder: '#DDD6FE',

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

    disabled: '#9CA3AF',
    disabledCard: '#F3F4F6',

    white: '#FFFFFF',
  };

  /* =========================================================
    TYPES
  ========================================================= */

  interface TurfImage {
    url: string;
    isPrimary?: boolean;
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
    status?: string;
  }

  interface OperatingHour {
    dayOfWeek: number;
    openTime: string;
    closeTime: string;
    isClosed: boolean;
  }

  interface Turf {
    _id?: string;
    id?: string;
    name?: string;
    description?: string;
    address?: string;
    city?: string;
    amenities?: string[];
    images?: TurfImage[];
    courts?: TurfCourt[];
    operatingHours?: OperatingHour[];
    location?: {
      type?: 'Point';
      coordinates?: [number, number];
    };
  }

  interface Slot {
    id: string;
    startTime: string;
    endTime: string;
    available: boolean;
    price: number;
    isPast?: boolean;
    isNight?: boolean;
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
    CONSTANTS
  ========================================================= */

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

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      weekday: 'short',
    });
  };

  /* =========================================================
    TIME PARSER
  ========================================================= */

  const parseTimeToMinutes = (time: string): number => {
    if (!time) return 0;

    const normalized = time.trim().toUpperCase();

    const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);

    if (!match) return 0;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3];

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      minute < 0 ||
      minute > 59
    ) {
      return 0;
    }

    if (period === 'AM') {
      if (hour === 12) hour = 0;
    }

    if (period === 'PM') {
      if (hour !== 12) hour += 12;
    }

    if (hour < 0 || hour > 23) return 0;

    return hour * 60 + minute;
  };

  const formatTime = (minutes: number): string => {
    const safeMinutes = ((minutes % 1440) + 1440) % 1440;

    const hour24 = Math.floor(safeMinutes / 60);
    const minute = safeMinutes % 60;

    const period = hour24 >= 12 ? 'PM' : 'AM';

    let hour12 = hour24 % 12;
    if (hour12 === 0) hour12 = 12;

    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(
      2,
      '0'
    )} ${period}`;
  };

  const getTurfImage = (turf: Turf): string | null => {
    if (!Array.isArray(turf.images)) return null;

    const primaryImage = turf.images.find((image) => image.isPrimary === true);

    return primaryImage?.url || turf.images[0]?.url || null;
  };

  const getCourtId = (court: TurfCourt): string => {
    return court._id || court.id || '';
  };

  const getCourtSportText = (court: TurfCourt): string => {
    if (court.sport) return court.sport;

    if (Array.isArray(court.sports) && court.sports.length > 0) {
      return court.sports.join(' • ');
    }

    return 'Sport';
  };

  const isSameDate = (firstDate: Date, secondDate: Date): boolean => {
    return (
      firstDate.getFullYear() === secondDate.getFullYear() &&
      firstDate.getMonth() === secondDate.getMonth() &&
      firstDate.getDate() === secondDate.getDate()
    );
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    return checkDate < today;
  };

  const getCurrentMinutes = (): number => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  };

  /* =========================================================
    NIGHT PRICING CHECK
  ========================================================= */

  const isNightSlot = (
    slotStartMinutes: number,
    court: TurfCourt
  ): boolean => {
    if (court.hasNightPricing !== true) return false;

    if (
      typeof court.nightStartHour !== 'number' ||
      typeof court.nightEndHour !== 'number'
    ) {
      return false;
    }

    const startHour = court.nightStartHour;
    const endHour = court.nightEndHour;

    if (
      startHour < 0 ||
      startHour > 23 ||
      endHour < 0 ||
      endHour > 23
    ) {
      return false;
    }

    const nightStart = startHour * 60;
    const nightEnd = endHour * 60;

    if (nightStart === nightEnd) return false;

    if (nightStart < nightEnd) {
      return slotStartMinutes >= nightStart && slotStartMinutes < nightEnd;
    }

    return slotStartMinutes >= nightStart || slotStartMinutes < nightEnd;
  };

  /* =========================================================
    PRICE HELPERS
  ========================================================= */

  const getNormalCourtPrice = (court: TurfCourt): number => {
    if (
      typeof court.pricePerHour === 'number' &&
      Number.isFinite(court.pricePerHour) &&
      court.pricePerHour >= 0
    ) {
      return court.pricePerHour;
    }
    return 0;
  };

  const getNightCourtPrice = (court: TurfCourt): number => {
    if (
      court.hasNightPricing === true &&
      typeof court.nightPricePerHour === 'number' &&
      Number.isFinite(court.nightPricePerHour) &&
      court.nightPricePerHour >= 0
    ) {
      return court.nightPricePerHour;
    }
    return getNormalCourtPrice(court);
  };

  const getSlotPrice = (
    court: TurfCourt,
    slotStartMinutes: number
  ): number => {
    const night = isNightSlot(slotStartMinutes, court);
    if (night) return getNightCourtPrice(court);
    return getNormalCourtPrice(court);
  };

  /* =========================================================
    SCREEN
  ========================================================= */

  export const TurfDetailsScreen: React.FC<TurfDetailsScreenProps> = ({
    navigation,
    route,
  }) => {
    const turf = route.params?.turf;

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedCourtId, setSelectedCourtId] = useState<string>('');
    const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
    const [bookedSlots, setBookedSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(
      getCurrentMinutes()
    );

    /* UPDATE CURRENT TIME */
    useEffect(() => {
      const updateCurrentTime = () => {
        setCurrentTimeMinutes(getCurrentMinutes());
      };

      updateCurrentTime();
      const interval = setInterval(updateCurrentTime, 60 * 1000);

      return () => clearInterval(interval);
    }, []);

    /* IMAGE */
    const imageUrl = useMemo(() => {
      if (!turf) return null;
      return getTurfImage(turf);
    }, [turf]);

    /* ACTIVE COURTS */
    const activeCourts = useMemo(() => {
      if (!Array.isArray(turf?.courts)) return [];

      return turf.courts.filter(
        (court) =>
          court.status !== 'inactive' && court.status !== 'maintenance'
      );
    }, [turf]);

    /* DEFAULT COURT */
    useEffect(() => {
      if (activeCourts.length === 0) {
        setSelectedCourtId('');
        return;
      }

      const currentCourtStillExists =
        selectedCourtId &&
        activeCourts.some(
          (court) => getCourtId(court) === selectedCourtId
        );

      if (!currentCourtStillExists) {
        const firstCourt = activeCourts[0];
        setSelectedCourtId(getCourtId(firstCourt));
      }
    }, [activeCourts, selectedCourtId]);

    /* SELECTED COURT */
    const selectedCourt = useMemo(() => {
      return activeCourts.find(
        (court) => getCourtId(court) === selectedCourtId
      );
    }, [activeCourts, selectedCourtId]);

    /* SELECTED DAY */
    const selectedDayOfWeek = selectedDate.getDay();

    /* OPERATING HOURS */
    const selectedOperatingHour = useMemo(() => {
      return turf?.operatingHours?.find(
        (hour) => hour.dayOfWeek === selectedDayOfWeek
      );
    }, [turf?.operatingHours, selectedDayOfWeek]);

    /* NIGHT INFO */
    const nightPricingEnabled = selectedCourt?.hasNightPricing === true;
    const nightStartHour = selectedCourt?.nightStartHour;
    const nightEndHour = selectedCourt?.nightEndHour;

    const normalPrice = selectedCourt
      ? getNormalCourtPrice(selectedCourt)
      : 0;

    const nightPrice = selectedCourt
      ? getNightCourtPrice(selectedCourt)
      : 0;

    const nightPricingText = useMemo(() => {
      if (
        !nightPricingEnabled ||
        typeof nightStartHour !== 'number' ||
        typeof nightEndHour !== 'number'
      ) {
        return null;
      }

      return `${formatTime(nightStartHour * 60)} - ${formatTime(
        nightEndHour * 60
      )}`;
    }, [nightPricingEnabled, nightStartHour, nightEndHour]);

    /* GENERATE SLOTS */
    const generateSlots = useCallback((): Slot[] => {
      if (!selectedCourt || !selectedCourtId) return [];

      const openingTime = selectedOperatingHour?.openTime || '06:00';
      const closingTime = selectedOperatingHour?.closeTime || '23:00';

      if (selectedOperatingHour?.isClosed) return [];

      const startMinutes = parseTimeToMinutes(openingTime);
      const endMinutes = parseTimeToMinutes(closingTime);

      if (endMinutes <= startMinutes) return [];

      const todaySelected = isSameDate(selectedDate, new Date());
      const nowMinutes = currentTimeMinutes;

      const generatedSlots: Slot[] = [];

      for (
        let current = startMinutes;
        current + 60 <= endMinutes;
        current += 60
      ) {
        const startTime = formatTime(current);
        const endTime = formatTime(current + 60);

        const slotId = `${formatDate(selectedDate)}_${selectedCourtId}_${current}`;

        const isPast = todaySelected && current < nowMinutes;
        const isBooked = bookedSlots.includes(slotId);

        const isNight = isNightSlot(current, selectedCourt);
        const price = getSlotPrice(selectedCourt, current);
        const available = !isPast && !isBooked;

        generatedSlots.push({
          id: slotId,
          startTime,
          endTime,
          price,
          available,
          isPast,
          isNight,
        });
      }

      return generatedSlots;
    }, [
      selectedCourt,
      selectedCourtId,
      selectedOperatingHour,
      selectedDate,
      bookedSlots,
      currentTimeMinutes,
    ]);

    const slots = useMemo(() => generateSlots(), [generateSlots]);

    /* LOAD BOOKED SLOTS */
    const loadBookedSlots = useCallback(async () => {
      if (!selectedCourtId || !turf?._id) {
        setBookedSlots([]);
        return;
      }

      try {
        setLoadingSlots(true);
        setErrorMessage(null);

        const response = await fetch(
          `${API_BASE_URL}/slots?turfId=${encodeURIComponent(
            turf._id
          )}&courtId=${encodeURIComponent(
            selectedCourtId
          )}&date=${encodeURIComponent(formatDate(selectedDate))}`
        );

        if (!response.ok) {
          setBookedSlots([]);
          return;
        }

        const data = await response.json();

        const serverBookedSlots = Array.isArray(data?.bookedSlots)
          ? data.bookedSlots
          : Array.isArray(data?.slots)
          ? data.slots
          : [];

        setBookedSlots(
          serverBookedSlots.filter(
            (item: unknown): item is string => typeof item === 'string'
          )
        );
      } catch (error) {
        console.log('Slot API not available:', error);
        setBookedSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }, [selectedCourtId, selectedDate, turf?._id]);

    useEffect(() => {
      setSelectedSlots([]);
      loadBookedSlots();
    }, [selectedDate, selectedCourtId, loadBookedSlots]);

    /* SLOT SELECTION */
    const isSlotSelected = useCallback(
      (slot: Slot): boolean => {
        return selectedSlots.some(
          (selectedSlot) => selectedSlot.id === slot.id
        );
      },
      [selectedSlots]
    );

    const handleSelectSlot = useCallback((slot: Slot) => {
      if (!slot.available || slot.isPast) return;

      setSelectedSlots((previousSlots) => {
        const alreadySelected = previousSlots.some(
          (selectedSlot) => selectedSlot.id === slot.id
        );

        if (alreadySelected) {
          return previousSlots.filter(
            (selectedSlot) => selectedSlot.id !== slot.id
          );
        }

        return [...previousSlots, slot];
      });
    }, []);

    /* TOTAL PRICE */
    const totalPrice = useMemo(() => {
      return selectedSlots.reduce(
        (total, slot) => total + Number(slot.price || 0),
        0
      );
    }, [selectedSlots]);

    /* SORTED SLOTS */
    const sortedSelectedSlots = useMemo(() => {
      return [...selectedSlots].sort(
        (a, b) =>
          parseTimeToMinutes(a.startTime) -
          parseTimeToMinutes(b.startTime)
      );
    }, [selectedSlots]);

    /* SELECTED TIME TEXT */
    const selectedTimeText = useMemo(() => {
      if (sortedSelectedSlots.length === 0) return 'Select slots';

      if (sortedSelectedSlots.length === 1) {
        return `${sortedSelectedSlots[0].startTime} - ${sortedSelectedSlots[0].endTime}`;
      }

      return `${sortedSelectedSlots.length} slots selected`;
    }, [sortedSelectedSlots]);

    /* HANDLERS */
    const handleSelectCourt = (courtId: string) => {
      if (courtId === selectedCourtId) return;
      setSelectedSlots([]);
      setSelectedCourtId(courtId);
    };

    const handleSelectDate = (date: Date) => {
      if (isPastDate(date)) return;
      setSelectedSlots([]);
      setSelectedDate(date);
    };

    const handleBookNow = () => {
      if (!selectedCourt) {
        Alert.alert('Select Court', 'Please select a court first.');
        return;
      }

      if (selectedSlots.length === 0) {
        Alert.alert('Select Slots', 'Please select at least one available slot.');
        return;
      }

      const orderedSlots = [...selectedSlots].sort(
        (a, b) =>
          parseTimeToMinutes(a.startTime) -
          parseTimeToMinutes(b.startTime)
      );

      const bookingData = {
        turf,
        court: selectedCourt,
        date: formatDate(selectedDate),
        slots: orderedSlots.map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          price: slot.price,
          isNight: slot.isNight === true,
        })),
        slotCount: orderedSlots.length,
        totalAmount: totalPrice,
      };

      navigation.navigate('Payment', bookingData);
    };

    /* NO TURF */
    if (!turf) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.noTurfContainer}>
            <View style={styles.noTurfIconCircle}>
              <Text style={styles.noTurfIcon}>⚽</Text>
            </View>

            <Text style={styles.noTurfTitle}>
              Turf details not available
            </Text>

            <Text style={styles.noTurfText}>
              We couldn't load this turf's information.
            </Text>

            <TouchableOpacity
              style={styles.backButtonLarge}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={styles.backButtonLargeText}>GO BACK</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    /* =========================================================
      UI
    ========================================================= */

    return (
      <SafeAreaView style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>
            Turf Details
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* TURF IMAGE */}
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.turfImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderEmoji}>⚽</Text>
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}

            {/* IMAGE OVERLAY BADGE */}
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>🏟️ TURF</Text>
            </View>
          </View>

          {/* BASIC DETAILS */}
          <View style={styles.detailsCard}>
            <Text style={styles.turfName}>{turf.name || 'Unnamed Turf'}</Text>

            <View style={styles.locationRow}>
              <View style={styles.locationDot} />
              <Text style={styles.locationText} numberOfLines={2}>
                {turf.address || turf.city || 'Location unavailable'}
              </Text>
            </View>

            {turf.description ? (
              <Text style={styles.description}>{turf.description}</Text>
            ) : null}
          </View>

          {/* COURTS */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitleNoMargin}>Select Court</Text>
              <View style={styles.sectionTitleAccent} />
            </View>

            {activeCourts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🏟️</Text>
                <Text style={styles.emptyText}>No courts available.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.courtScrollContent}
              >
                {activeCourts.map((court) => {
                  const courtId = getCourtId(court);
                  const selected = courtId === selectedCourtId;
                  const sport = getCourtSportText(court);
                  const courtNormalPrice = getNormalCourtPrice(court);
                  const courtNightPrice = getNightCourtPrice(court);

                  const hasValidNightPricing =
                    court.hasNightPricing === true &&
                    typeof court.nightPricePerHour === 'number' &&
                    typeof court.nightStartHour === 'number' &&
                    typeof court.nightEndHour === 'number';

                  return (
                    <TouchableOpacity
                      key={courtId}
                      style={[
                        styles.courtCard,
                        selected && styles.selectedCourtCard,
                      ]}
                      onPress={() => handleSelectCourt(courtId)}
                      activeOpacity={0.85}
                    >
                      {selected && (
                        <View style={styles.selectedCheck}>
                          <Text style={styles.selectedCheckText}>✓</Text>
                        </View>
                      )}

                      <Text
                        style={[
                          styles.courtName,
                          selected && styles.selectedCourtText,
                        ]}
                        numberOfLines={1}
                      >
                        {court.name || 'Court'}
                      </Text>

                      <View
                        style={[
                          styles.sportPill,
                          selected && styles.sportPillSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.sportPillText,
                            selected && styles.sportPillTextSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {sport}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.courtPrice,
                          selected && styles.selectedCourtText,
                        ]}
                      >
                        ₹{courtNormalPrice}/hr
                      </Text>

                      {hasValidNightPricing ? (
                        <View
                          style={[
                            styles.nightPill,
                            selected && styles.nightPillSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.nightPillText,
                              selected && styles.nightPillTextSelected,
                            ]}
                          >
                            🌙 ₹{courtNightPrice}/hr
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* SELECTED COURT PRICING */}
          {selectedCourt ? (
            <View style={styles.pricingCard}>
              <View style={styles.pricingHeader}>
                <View style={styles.pricingHeaderLeft}>
                  <View style={styles.pricingIconCircle}>
                    <Text style={styles.pricingIcon}>💰</Text>
                  </View>

                  <View>
                    <Text style={styles.pricingTitle}>
                      {selectedCourt.name || 'Selected Court'}
                    </Text>

                    <Text style={styles.pricingSport}>
                      {getCourtSportText(selectedCourt)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.pricingRows}>
                <View style={styles.pricingRow}>
                  <View style={styles.pricingRowLeft}>
                    <View style={styles.normalDot} />
                    <Text style={styles.pricingRowLabel}>Normal price</Text>
                  </View>

                  <Text style={styles.pricingRowPrice}>₹{normalPrice}/hr</Text>
                </View>

                {nightPricingEnabled && nightPricingText ? (
                  <View style={styles.pricingRow}>
                    <View style={styles.pricingRowLeft}>
                      <View style={styles.nightDot} />
                      <View style={styles.nightLabelContainer}>
                        <Text style={styles.pricingRowLabel}>Night price</Text>
                        <Text style={styles.nightTimeText}>
                          {nightPricingText}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.nightPriceValue}>₹{nightPrice}/hr</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* AMENITIES */}
          {Array.isArray(turf.amenities) && turf.amenities.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleNoMargin}>Amenities</Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              <View style={styles.amenitiesContainer}>
                {turf.amenities.map((amenity, index) => (
                  <View key={`${amenity}-${index}`} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>✓ {amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* DATE */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleNoMargin}>Select Date</Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              <View style={styles.selectedDatePill}>
                <Text style={styles.selectedDateText}>
                  {formatDisplayDate(selectedDate)}
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateScrollContent}
            >
              {Array.from({ length: 7 }, (_, index) => {
                const date = new Date();
                date.setHours(0, 0, 0, 0);
                date.setDate(date.getDate() + index);

                const selected =
                  formatDate(date) === formatDate(selectedDate);

                const operatingHour = turf.operatingHours?.find(
                  (hour) => hour.dayOfWeek === date.getDay()
                );

                const closed = operatingHour?.isClosed === true;

                return (
                  <TouchableOpacity
                    key={formatDate(date)}
                    style={[
                      styles.dateCard,
                      selected && styles.selectedDateCard,
                      closed && !selected && styles.closedDateCard,
                    ]}
                    onPress={() => handleSelectDate(date)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        selected && styles.selectedDateTextWhite,
                        closed && !selected && styles.closedDateText,
                      ]}
                    >
                      {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>

                    <Text
                      style={[
                        styles.dateNumber,
                        selected && styles.selectedDateTextWhite,
                        closed && !selected && styles.closedDateText,
                      ]}
                    >
                      {date.getDate()}
                    </Text>

                    <Text
                      style={[
                        styles.dateMonth,
                        selected && styles.selectedDateTextWhite,
                        closed && !selected && styles.closedDateText,
                      ]}
                    >
                      {date.toLocaleDateString('en-IN', { month: 'short' })}
                    </Text>

                    {closed ? (
                      <Text
                        style={[
                          styles.closedLabel,
                          selected && styles.closedLabelSelected,
                        ]}
                      >
                        CLOSED
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* AVAILABLE SLOTS */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleNoMargin}>
                  Available Slots
                </Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              <Text style={styles.oneHourText}>1 hour each</Text>
            </View>

            {/* PRICING LEGEND */}
            {selectedCourt &&
            selectedCourt.hasNightPricing === true &&
            typeof selectedCourt.nightPricePerHour === 'number' &&
            nightPricingText ? (
              <View style={styles.priceLegend}>
                <View style={styles.priceLegendItem}>
                  <View style={styles.normalDot} />
                  <Text style={styles.priceLegendText}>
                    Normal ₹{normalPrice}/hr
                  </Text>
                </View>

                <View style={styles.priceLegendItem}>
                  <View style={styles.nightDot} />
                  <Text style={styles.priceLegendText}>
                    Night ₹{nightPrice}/hr
                  </Text>
                </View>
              </View>
            ) : null}

            {/* TODAY CURRENT TIME */}
            {isSameDate(selectedDate, new Date()) ? (
              <View style={styles.currentTimeBanner}>
                <View style={styles.currentTimeIconCircle}>
                  <Text style={styles.currentTimeIcon}>🕐</Text>
                </View>

                <View style={styles.currentTimeInfo}>
                  <Text style={styles.currentTimeTitle}>Current time</Text>
                  <Text style={styles.currentTimeValue}>
                    {formatTime(currentTimeMinutes)}
                  </Text>
                </View>

                <Text style={styles.pastHint}>
                  Past slots are unavailable
                </Text>
              </View>
            ) : null}

            {/* LOADING / ERROR / EMPTY / SLOTS */}
            {loadingSlots ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={COLORS.primary} size="large" />
                <Text style={styles.loadingText}>Loading slots...</Text>
              </View>
            ) : errorMessage ? (
              <View style={styles.emptyBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadBookedSlots}
                  activeOpacity={0.85}
                >
                  <Text style={styles.retryButtonText}>TRY AGAIN</Text>
                </TouchableOpacity>
              </View>
            ) : slots.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIcon}>🕐</Text>
                </View>

                <Text style={styles.emptyTitle}>No slots available</Text>

                <Text style={styles.emptyText}>
                  This turf may be closed on the selected date or the selected
                  court has no available slots.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.slotInstruction}>
                  Tap multiple available slots to select them. Past and booked
                  slots cannot be selected.
                </Text>

                <View style={styles.slotsGrid}>
                  {slots.map((slot) => {
                    const selected = isSlotSelected(slot);
                    const past = slot.isPast === true;
                    const booked = !past && !slot.available;
                    const night = slot.isNight === true;

                    return (
                      <TouchableOpacity
                        key={slot.id}
                        disabled={!slot.available || past}
                        style={[
                          styles.slotCard,
                          night &&
                            !selected &&
                            !past &&
                            !booked &&
                            styles.nightSlotCard,
                          past && styles.pastSlotCard,
                          booked && styles.bookedSlotCard,
                          selected && styles.selectedSlotCard,
                        ]}
                        onPress={() => handleSelectSlot(slot)}
                        activeOpacity={0.85}
                      >
                        {/* NIGHT BADGE */}
                        {night && !past && !booked && !selected ? (
                          <View style={styles.nightBadge}>
                            <Text style={styles.nightBadgeText}>🌙 NIGHT</Text>
                          </View>
                        ) : null}

                        {/* PAST OVERLAY */}
                        {past ? (
                          <View style={styles.pastOverlay}>
                            <Text style={styles.pastOverlayText}>PASSED</Text>
                          </View>
                        ) : null}

                        {/* BOOKED OVERLAY */}
                        {booked ? (
                          <View style={styles.bookedOverlay}>
                            <Text style={styles.bookedOverlayText}>BOOKED</Text>
                          </View>
                        ) : null}

                        {/* SELECTED CHECK */}
                        {selected ? (
                          <View style={styles.selectedCheck}>
                            <Text style={styles.selectedCheckText}>✓</Text>
                          </View>
                        ) : null}

                        <Text
                          style={[
                            styles.slotTime,
                            night &&
                              !selected &&
                              !past &&
                              !booked &&
                              styles.slotTimeNight,
                            past && styles.pastSlotText,
                            booked && styles.bookedSlotText,
                            selected && styles.selectedSlotText,
                          ]}
                        >
                          {slot.startTime}
                        </Text>

                        <Text
                          style={[
                            styles.slotEndTime,
                            past && styles.pastSlotText,
                            booked && styles.bookedSlotText,
                            selected && styles.selectedSlotText,
                          ]}
                        >
                          to {slot.endTime}
                        </Text>

                        <Text
                          style={[
                            styles.slotPrice,
                            night &&
                              !selected &&
                              !past &&
                              !booked &&
                              styles.slotPriceNight,
                            past && styles.pastSlotText,
                            booked && styles.bookedSlotText,
                            selected && styles.selectedSlotText,
                          ]}
                        >
                          ₹{slot.price}
                        </Text>

                        <Text
                          style={[
                            styles.slotStatus,
                            past && styles.pastSlotStatus,
                            booked && styles.bookedSlotText,
                            selected && styles.selectedSlotText,
                            night &&
                              !selected &&
                              !past &&
                              !booked &&
                              styles.slotStatusNight,
                          ]}
                        >
                          {selected
                            ? 'Selected'
                            : past
                            ? 'Time passed'
                            : booked
                            ? 'Booked'
                            : night
                            ? 'Night price'
                            : 'Available'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* SELECTED SLOTS SUMMARY */}
          {selectedSlots.length > 0 ? (
            <View style={styles.selectedSummarySection}>
              <View style={styles.selectedSummaryHeader}>
                <View>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.selectedSummaryTitle}>
                      Selected Slots
                    </Text>
                    <View style={styles.sectionTitleAccent} />
                  </View>

                  <Text style={styles.selectedSummarySubtitle}>
                    {selectedSlots.length}{' '}
                    {selectedSlots.length === 1 ? 'slot' : 'slots'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedSlots([])}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearText}>CLEAR ALL</Text>
                </TouchableOpacity>
              </View>

              {sortedSelectedSlots.map((slot) => (
                <View key={slot.id} style={styles.selectedSlotRow}>
                  <View style={styles.selectedSlotRowLeft}>
                    <View
                      style={[
                        styles.selectedSlotBullet,
                        slot.isNight && styles.selectedNightBullet,
                      ]}
                    />

                    <View>
                      <Text style={styles.selectedSlotRowTime}>
                        {slot.startTime} - {slot.endTime}
                      </Text>

                      {slot.isNight ? (
                        <Text style={styles.selectedNightText}>
                          🌙 Night pricing
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.selectedSlotRowRight}>
                    <Text style={styles.selectedSlotRowPrice}>
                      ₹{slot.price}
                    </Text>

                    <TouchableOpacity
                      onPress={() => handleSelectSlot(slot)}
                      activeOpacity={0.8}
                      style={styles.removeButton}
                    >
                      <Text style={styles.removeSlotText}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.totalDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalAmount}>₹{totalPrice}</Text>
              </View>
            </View>
          ) : null}

          {/* LOCATION */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitleNoMargin}>Location</Text>
              <View style={styles.sectionTitleAccent} />
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationIconCircle}>
                <Text style={styles.locationCardIcon}>📍</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.locationCardTitle}>
                  {turf.city || 'Location'}
                </Text>

                <Text style={styles.locationCardText}>
                  {turf.address || 'Address unavailable'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* BOTTOM BOOKING BAR */}
        <View style={styles.bottomContainer}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomLabel}>
              {selectedSlots.length > 0
                ? `${selectedSlots.length} ${
                    selectedSlots.length === 1 ? 'slot' : 'slots'
                  }`
                : 'No slots selected'}
            </Text>

            <Text style={styles.bottomPrice}>
              {selectedSlots.length > 0 ? `₹${totalPrice}` : '—'}
            </Text>

            {selectedSlots.length > 0 ? (
              <Text style={styles.bottomTime} numberOfLines={1}>
                {selectedTimeText}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.bookButton,
              selectedSlots.length === 0 && styles.disabledBookButton,
            ]}
            disabled={selectedSlots.length === 0}
            onPress={handleBookNow}
            activeOpacity={0.85}
          >
            <Text style={styles.bookButtonText}>CONTINUE →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  };

  /* =========================================================
    STYLES
  ========================================================= */

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },

    scrollContent: {
      paddingBottom: 20,
    },

    /* HEADER */

    header: {
      height: 58,
      backgroundColor: COLORS.white,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
    },

    backText: {
      fontSize: 32,
      lineHeight: 34,
      color: COLORS.primaryDark,
      marginTop: -3,
      fontWeight: '600',
    },

    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
    },

    headerSpacer: {
      width: 40,
    },

    /* IMAGE */

    imageContainer: {
      width: '100%',
      height: 240,
      backgroundColor: COLORS.primarySoft,
      position: 'relative',
    },

    turfImage: {
      width: '100%',
      height: '100%',
    },

    imagePlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    placeholderEmoji: {
      fontSize: 48,
    },

    placeholderText: {
      marginTop: 8,
      color: COLORS.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },

    imageBadge: {
      position: 'absolute',
      top: 14,
      left: 14,
      backgroundColor: 'rgba(255,255,255,0.95)',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 4,
      elevation: 3,
    },

    imageBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      color: COLORS.primaryDark,
      letterSpacing: 1.5,
    },

    /* DETAILS */

    detailsCard: {
      backgroundColor: COLORS.white,
      padding: 18,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },

    turfName: {
      fontSize: 24,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: 0.3,
    },

    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },

    locationDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
      marginRight: 8,
    },

    locationText: {
      flex: 1,
      color: COLORS.textSecondary,
      fontSize: 13,
      fontWeight: '500',
    },

    description: {
      marginTop: 12,
      color: COLORS.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },

    /* SECTION */

    section: {
      backgroundColor: COLORS.white,
      padding: 18,
      marginTop: 10,
    },

    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 12,
    },

    sectionTitleNoMargin: {
      fontSize: 17,
      fontWeight: '800',
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

    selectedDatePill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    selectedDateText: {
      fontSize: 11,
      color: COLORS.primaryDark,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    oneHourText: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '600',
      letterSpacing: 0.3,
    },

    /* COURTS */

    courtScrollContent: {
      paddingRight: 4,
    },

    courtCard: {
      width: 165,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: COLORS.borderLight,
      backgroundColor: COLORS.primarySoft,
      marginRight: 10,
      position: 'relative',
    },

    selectedCourtCard: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 5,
    },

    courtName: {
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
    },

    sportPill: {
      alignSelf: 'flex-start',
      marginTop: 6,
      backgroundColor: COLORS.white,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },

    sportPillSelected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderColor: 'rgba(255,255,255,0.35)',
    },

    sportPillText: {
      fontSize: 10,
      color: COLORS.primaryDark,
      fontWeight: '800',
      letterSpacing: 0.4,
    },

    sportPillTextSelected: {
      color: COLORS.white,
    },

    courtPrice: {
      fontSize: 14,
      color: COLORS.primaryDark,
      fontWeight: '900',
      marginTop: 10,
    },

    courtNightPrice: {
      fontSize: 12,
      color: COLORS.night,
      fontWeight: '700',
      marginTop: 5,
    },

    selectedCourtText: {
      color: COLORS.white,
    },

    nightPill: {
      alignSelf: 'flex-start',
      marginTop: 8,
      backgroundColor: COLORS.nightLight,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },

    nightPillSelected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },

    nightPillText: {
      fontSize: 10,
      color: COLORS.night,
      fontWeight: '800',
      letterSpacing: 0.3,
    },

    nightPillTextSelected: {
      color: COLORS.white,
    },

    selectedCheck: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },

    selectedCheckText: {
      color: COLORS.primaryDark,
      fontSize: 13,
      fontWeight: '900',
    },

    /* PRICING CARD */

    pricingCard: {
      backgroundColor: COLORS.white,
      marginTop: 10,
      padding: 18,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: COLORS.borderLight,
    },

    pricingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    pricingHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    pricingIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    pricingIcon: {
      fontSize: 20,
    },

    pricingTitle: {
      fontSize: 15,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
    },

    pricingSport: {
      fontSize: 11,
      color: COLORS.textMuted,
      marginTop: 2,
      fontWeight: '600',
    },

    pricingRows: {
      marginTop: 14,
    },

    pricingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },

    pricingRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    pricingRowLabel: {
      fontSize: 13,
      color: COLORS.textSecondary,
      fontWeight: '700',
    },

    pricingRowPrice: {
      fontSize: 14,
      color: COLORS.primaryDark,
      fontWeight: '900',
    },

    nightLabelContainer: {
      flex: 1,
    },

    nightTimeText: {
      fontSize: 10,
      color: COLORS.night,
      marginTop: 2,
      fontWeight: '600',
    },

    nightPriceValue: {
      fontSize: 14,
      color: COLORS.night,
      fontWeight: '900',
    },

    /* AMENITIES */

    amenitiesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },

    amenityChip: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    amenityText: {
      color: COLORS.primaryDark,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    /* DATE */

    dateScrollContent: {
      paddingRight: 4,
    },

    dateCard: {
      width: 78,
      minHeight: 92,
      borderRadius: 16,
      backgroundColor: COLORS.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 9,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor: COLORS.borderLight,
    },

    selectedDateCard: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 4,
    },

    closedDateCard: {
      backgroundColor: COLORS.cardSoft,
      borderColor: COLORS.border,
      opacity: 0.7,
    },

    dateDay: {
      fontSize: 11,
      color: COLORS.textMuted,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    dateNumber: {
      fontSize: 22,
      color: COLORS.textPrimary,
      fontWeight: '900',
      marginVertical: 3,
    },

    dateMonth: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '600',
    },

    selectedDateTextWhite: {
      color: COLORS.white,
    },

    closedDateText: {
      color: COLORS.textMuted,
    },

    closedLabel: {
      fontSize: 8,
      color: COLORS.danger,
      fontWeight: '900',
      marginTop: 3,
      letterSpacing: 0.5,
    },

    closedLabelSelected: {
      color: COLORS.white,
    },

    /* PRICE LEGEND */

    priceLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 16,
    },

    priceLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    normalDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
      marginRight: 6,
    },

    nightDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.night,
      marginRight: 6,
    },

    priceLegendText: {
      fontSize: 11,
      color: COLORS.textSecondary,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    /* CURRENT TIME */

    currentTimeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.borderSoft,
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
    },

    currentTimeIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    currentTimeIcon: {
      fontSize: 16,
    },

    currentTimeInfo: {
      flex: 1,
    },

    currentTimeTitle: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },

    currentTimeValue: {
      fontSize: 14,
      color: COLORS.primaryDark,
      fontWeight: '900',
      marginTop: 2,
    },

    pastHint: {
      fontSize: 9,
      color: COLORS.textMuted,
      textAlign: 'right',
      fontWeight: '600',
      maxWidth: 90,
    },

    /* SLOT INSTRUCTION */

    slotInstruction: {
      fontSize: 12,
      color: COLORS.textMuted,
      marginBottom: 12,
      lineHeight: 18,
      fontWeight: '500',
    },

    /* SLOT GRID */

    slotsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },

    slotCard: {
      width: '48%',
      minHeight: 118,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: COLORS.borderSoft,
      backgroundColor: COLORS.primarySoft,
      padding: 12,
      marginBottom: 10,
      position: 'relative',
      overflow: 'hidden',
    },

    nightSlotCard: {
      backgroundColor: COLORS.nightSoft,
      borderColor: COLORS.nightBorder,
    },

    nightBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: COLORS.nightLight,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      zIndex: 5,
    },

    nightBadgeText: {
      fontSize: 8,
      fontWeight: '900',
      color: COLORS.night,
      letterSpacing: 0.5,
    },

    pastSlotCard: {
      backgroundColor: COLORS.cardSoft,
      borderColor: COLORS.border,
      opacity: 0.6,
    },

    pastSlotText: {
      color: COLORS.textMuted,
    },

    pastSlotStatus: {
      color: COLORS.textMuted,
    },

    pastOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: COLORS.border,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      zIndex: 5,
    },

    pastOverlayText: {
      fontSize: 8,
      fontWeight: '900',
      color: COLORS.textMuted,
      letterSpacing: 0.5,
    },

    bookedSlotCard: {
      backgroundColor: COLORS.cardSoft,
      borderColor: COLORS.border,
      opacity: 0.7,
    },

    bookedOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: COLORS.dangerSoft,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 3,
      zIndex: 5,
    },

    bookedOverlayText: {
      fontSize: 8,
      fontWeight: '900',
      color: COLORS.dangerText,
      letterSpacing: 0.5,
    },

    bookedSlotText: {
      color: COLORS.textMuted,
    },

    selectedSlotCard: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      opacity: 1,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 5,
    },

    slotSelectedCheck: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },

    slotSelectedCheckText: {
      color: COLORS.primaryDark,
      fontSize: 14,
      fontWeight: '900',
    },

    slotTime: {
      fontSize: 15,
      fontWeight: '900',
      color: COLORS.primaryDark,
      letterSpacing: 0.2,
    },

    slotTimeNight: {
      color: COLORS.night,
    },

    slotEndTime: {
      fontSize: 11,
      color: COLORS.textSecondary,
      marginTop: 2,
      fontWeight: '600',
    },

    slotPrice: {
      fontSize: 15,
      fontWeight: '900',
      color: COLORS.textPrimary,
      marginTop: 10,
    },

    slotPriceNight: {
      color: COLORS.night,
    },

    slotStatus: {
      fontSize: 11,
      color: COLORS.primaryDark,
      fontWeight: '800',
      marginTop: 4,
      letterSpacing: 0.2,
    },

    slotStatusNight: {
      color: COLORS.night,
    },

    selectedSlotText: {
      color: COLORS.white,
    },

    /* SELECTED SUMMARY */

    selectedSummarySection: {
      backgroundColor: COLORS.white,
      marginTop: 10,
      padding: 18,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: COLORS.borderLight,
    },

    selectedSummaryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },

    selectedSummaryTitle: {
      fontSize: 17,
      fontWeight: '900',
      color: COLORS.textPrimary,
    },

    selectedSummarySubtitle: {
      fontSize: 12,
      color: COLORS.textMuted,
      marginTop: 2,
      fontWeight: '600',
    },

    clearText: {
      color: COLORS.dangerText,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
    },

    selectedSlotRow: {
      minHeight: 56,
      borderRadius: 12,
      backgroundColor: COLORS.primaryFaint,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      marginBottom: 8,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    selectedSlotRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },

    selectedSlotBullet: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
      marginRight: 9,
    },

    selectedNightBullet: {
      backgroundColor: COLORS.night,
    },

    selectedSlotRowTime: {
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },

    selectedNightText: {
      fontSize: 9,
      color: COLORS.night,
      fontWeight: '800',
      marginTop: 2,
      letterSpacing: 0.3,
    },

    selectedSlotRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    selectedSlotRowPrice: {
      fontSize: 13,
      fontWeight: '900',
      color: COLORS.primaryDark,
      marginRight: 10,
    },

    removeButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: COLORS.dangerSoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.dangerBorder,
    },

    removeSlotText: {
      fontSize: 18,
      lineHeight: 20,
      color: COLORS.dangerText,
      fontWeight: '700',
      marginTop: -2,
    },

    totalDivider: {
      height: 1,
      backgroundColor: COLORS.borderLight,
      marginTop: 6,
      marginBottom: 14,
    },

    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    totalLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: COLORS.textSecondary,
      letterSpacing: 0.3,
    },

    totalAmount: {
      fontSize: 22,
      fontWeight: '900',
      color: COLORS.primaryDark,
      letterSpacing: 0.2,
    },

    /* LOCATION */

    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.primaryFaint,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    locationIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    locationCardIcon: {
      fontSize: 18,
    },

    locationCardTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
    },

    locationCardText: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginTop: 4,
      fontWeight: '500',
    },

    /* EMPTY / ERROR / LOADING */

    loadingContainer: {
      paddingVertical: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      marginTop: 10,
      fontSize: 12,
      color: COLORS.textMuted,
      fontWeight: '600',
      letterSpacing: 0.3,
    },

    emptyBox: {
      alignItems: 'center',
      paddingVertical: 26,
      backgroundColor: COLORS.primaryFaint,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      paddingHorizontal: 20,
    },

    emptyIconCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
    },

    emptyIcon: {
      fontSize: 26,
    },

    emptyTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: 0.2,
    },

    emptyText: {
      fontSize: 12,
      color: COLORS.textMuted,
      marginTop: 6,
      textAlign: 'center',
      lineHeight: 18,
    },

    errorText: {
      color: COLORS.dangerText,
      fontSize: 13,
      textAlign: 'center',
      fontWeight: '600',
      marginBottom: 12,
    },

    retryButton: {
      marginTop: 4,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: COLORS.danger,
    },

    retryButtonText: {
      color: COLORS.white,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1,
    },

    /* BOTTOM BOOKING BAR */

    bottomContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      minHeight: 86,
      backgroundColor: COLORS.white,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      paddingHorizontal: 18,
      paddingVertical: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 10,
    },

    bottomInfo: {
      flex: 1,
      paddingRight: 10,
    },

    bottomLabel: {
      fontSize: 10,
      color: COLORS.textMuted,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },

    bottomPrice: {
      fontSize: 20,
      fontWeight: '900',
      color: COLORS.primaryDark,
      marginTop: 3,
      letterSpacing: 0.2,
    },

    bottomTime: {
      fontSize: 10,
      color: COLORS.textSecondary,
      marginTop: 3,
      fontWeight: '600',
    },

    bookButton: {
      backgroundColor: COLORS.primary,
      borderRadius: 14,
      paddingHorizontal: 24,
      paddingVertical: 15,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.32,
      shadowRadius: 10,
      elevation: 5,
    },

    disabledBookButton: {
      backgroundColor: COLORS.disabled,
      shadowOpacity: 0,
      elevation: 0,
    },

    bookButtonText: {
      color: COLORS.white,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 1,
    },

    /* NO TURF */

    noTurfContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },

    noTurfIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: COLORS.primarySoft,
      borderWidth: 1,
      borderColor: COLORS.borderLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    noTurfIcon: {
      fontSize: 40,
    },

    noTurfTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: COLORS.textPrimary,
      textAlign: 'center',
      letterSpacing: 0.2,
    },

    noTurfText: {
      fontSize: 13,
      color: COLORS.textMuted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 19,
    },

    backButtonLarge: {
      marginTop: 22,
      backgroundColor: COLORS.primary,
      borderRadius: 12,
      paddingHorizontal: 24,
      paddingVertical: 13,
      shadowColor: COLORS.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },

    backButtonLargeText: {
      color: COLORS.white,
      fontWeight: '900',
      fontSize: 12,
      letterSpacing: 1.2,
    },
  });

  export default TurfDetailsScreen;