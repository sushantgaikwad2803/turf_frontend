import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';

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
  image?: string;
  location?: {
    coordinates?: number[];
  };
  operatingHours?: OperatingHour[];
  openingTime?: string;
  closingTime?: string;
  courts?: TurfCourt[];
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.48);

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
  court.name || court.courtName || `Court ${index + 1}`;

const getCourtPrice = (
  court: TurfCourt,
  turf: Turf,
): number => {
  const price = Number(
    court.pricePerHour ?? turf.pricePerHour ?? 0,
  );
  return Number.isFinite(price) ? price : 0;
};

const getCourtSports = (
  court: TurfCourt,
): string[] => {
  if (Array.isArray(court.sports) && court.sports.length) {
    return court.sports;
  }
  if (court.sport) return [court.sport];
  return [];
};

const resolveImageUrl = (
  image?: string,
): string | undefined => {
  if (!image) return undefined;
  const trimmed = image.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed;
  }

  if (!API_URL) return trimmed;
  if (trimmed.startsWith('/')) return `${API_URL}${trimmed}`;
  return `${API_URL}/${trimmed}`;
};

const getGalleryImages = (turf: Turf): string[] => {
  const urls = (turf.images || [])
    .map((img) => resolveImageUrl(img?.url))
    .filter((url): url is string => Boolean(url));

  if (urls.length) {
    const primary = (turf.images || []).find(
      (img) => img?.isPrimary && img?.url,
    );

    if (primary?.url) {
      const primaryUrl = resolveImageUrl(primary.url);
      if (primaryUrl) {
        return [primaryUrl, ...urls.filter((u) => u !== primaryUrl)];
      }
    }

    return urls;
  }

  const single = resolveImageUrl(turf.image);
  return single ? [single] : [];
};

const findHoursForDay = (
  turf: Turf,
  dayName: string,
): OperatingHour | undefined => {
  const hours = turf.operatingHours || [];
  const target = dayName.toLowerCase();

  return hours.find((item) => {
    const value = String(
      item.dayOfWeek || item.day || '',
    ).toLowerCase();
    return value === target;
  });
};

const getHoursForDay = (
  turf: Turf,
  dayName: string,
): {
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
} => {
  const item = findHoursForDay(turf, dayName);

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

const getAmenityIcon = (amenity: string): string => {
  const key = amenity.toLowerCase();

  if (key.includes('wifi')) return '📶';
  if (key.includes('park')) return '🅿️';
  if (key.includes('shower') || key.includes('bath')) return '🚿';
  if (key.includes('light')) return '💡';
  if (key.includes('water') || key.includes('drink')) return '💧';
  if (key.includes('cafe') || key.includes('food')) return '☕';
  if (key.includes('locker')) return '🔒';
  if (key.includes('parking')) return '🅿️';
  if (key.includes('first') || key.includes('aid')) return '🩺';
  if (key.includes('seat') || key.includes('bench')) return '🪑';
  if (key.includes('toilet') || key.includes('washroom')) return '🚻';
  if (key.includes('changing')) return '👕';
  if (key.includes('cctv') || key.includes('camera')) return '📹';
  if (key.includes('ac') || key.includes('air')) return '❄️';
  if (key.includes('seating') || key.includes('stand')) return '💺';
  if (key.includes('coach') || key.includes('trainer')) return '🏋️';
  if (key.includes('racket') || key.includes('equipment')) return '🎾';

  return '✓';
};

/* =========================================================
   IMAGE GALLERY
========================================================= */

type GalleryProps = {
  images: string[];
};

const ImageGallery = ({ images }: GalleryProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      if (index !== activeIndex) setActiveIndex(index);
    },
    [activeIndex],
  );

  const onLayout = useCallback((_e: LayoutChangeEvent) => {
    /* Reserved */
  }, []);

  if (!images.length) {
    return (
      <View style={styles.heroPlaceholder}>
        <Text style={styles.heroPlaceholderIcon}>🏟️</Text>
        <Text style={styles.heroPlaceholderText}>
          No image available
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: HERO_HEIGHT }} onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {images.map((uri, index) => (
          <View
            key={`${uri}-${index}`}
            style={{
              width: SCREEN_WIDTH,
              height: HERO_HEIGHT,
            }}
          >
            {loading && index === activeIndex && (
              <View style={styles.heroLoader}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.white}
                />
              </View>
            )}

            <Image
              source={{ uri }}
              style={styles.heroImage}
              resizeMode="cover"
              onLoadEnd={() => setLoading(false)}
            />
          </View>
        ))}
      </ScrollView>

      {images.length > 1 && (
        <View style={styles.dotsRow}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.heroGradientTop} pointerEvents="none" />
    </View>
  );
};

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function TurfDetailsScreen({
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

  const [refreshing, setRefreshing] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);

  const images = useMemo(
    () => (turf ? getGalleryImages(turf) : []),
    [turf],
  );

  const activeCourts = useMemo(
    () =>
      (turf?.courts || []).filter(
        (court) =>
          String(court.status || 'active').toLowerCase() === 'active',
      ),
    [turf],
  );

  const turfId = turf ? getTurfId(turf) : '';

  const priceRange = useMemo(() => {
    if (!turf) return null;

    const prices = activeCourts
      .map((c) => getCourtPrice(c, turf))
      .filter((p) => p > 0);

    if (!prices.length) {
      const fallback = Number(turf.pricePerHour || 0);
      return fallback > 0
        ? { min: fallback, max: fallback }
        : null;
    }

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [activeCourts, turf]);

  const todayName = DAYS[new Date().getDay()];

  const todayHours = useMemo(
    () =>
      turf
        ? getHoursForDay(turf, todayName)
        : { openingTime: '', closingTime: '', isClosed: false },
    [turf, todayName],
  );

  const weekHours = useMemo(() => {
    if (!turf) return [];

    return DAYS.map((day) => ({
      day,
      ...getHoursForDay(turf, day),
    }));
  }, [turf]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleBookTurf = useCallback(() => {
    if (!turf) {
      Alert.alert(
        'Turf unavailable',
        'Turf information could not be loaded.',
      );
      return;
    }

    if (!turfId) {
      Alert.alert(
        'Invalid turf',
        'This turf does not have a valid ID.',
      );
      return;
    }

    if (activeCourts.length === 0) {
      Alert.alert(
        'No courts available',
        'There are currently no active courts available for booking.',
      );
      return;
    }

    navigation.navigate('Slot', { turf });
  }, [turf, turfId, activeCourts.length, navigation]);

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
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏟️</Text>
          <Text style={styles.emptyTitle}>Turf not found</Text>
          <Text style={styles.emptySubtitle}>
            We couldn't load this turf's information.
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={COLORS.primaryDeep}
              colors={[COLORS.primary]}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          <ImageGallery images={images} />

          {/* FLOATING HEADER */}
          <View style={styles.floatingHeader} pointerEvents="box-none">
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={COLORS.white}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.floatingButton}
              onPress={() =>
                Alert.alert('Share', 'Sharing will be available soon.')
              }
              activeOpacity={0.85}
            >
              <Ionicons
                name="share-outline"
                size={18}
                color={COLORS.white}
              />
            </TouchableOpacity>
          </View>

          {/* CONTENT */}
          <View style={styles.contentCard}>
            {/* INFO CARD */}
            <View style={styles.infoCard}>
              <View style={styles.titleRow}>
                <View style={styles.titleContainer}>
                  <Text style={styles.turfName} numberOfLines={2}>
                    {turf.name || 'Unnamed Turf'}
                  </Text>

                  {!!turf.city && (
                    <View style={styles.cityRow}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={COLORS.primaryDeep}
                      />
                      <Text style={styles.cityText} numberOfLines={1}>
                        {turf.city}
                      </Text>
                    </View>
                  )}
                </View>

                {priceRange && (
                  <View style={styles.priceBox}>
                    <Text style={styles.priceLabel}>From</Text>
                    <Text style={styles.price}>
                      ₹{priceRange.min}
                    </Text>
                    <Text style={styles.priceUnit}>
                      {priceRange.min === priceRange.max
                        ? '/hr'
                        : `– ₹${priceRange.max}`}
                    </Text>
                  </View>
                )}
              </View>

              {!!turf.address && (
                <View style={styles.addressRow}>
                  <Ionicons
                    name="navigate-outline"
                    size={14}
                    color={COLORS.textMuted}
                    style={styles.addressIcon}
                  />
                  <Text style={styles.addressText} numberOfLines={2}>
                    {turf.address}
                  </Text>
                </View>
              )}

              <View
                style={[
                  styles.statusBadge,
                  todayHours.isClosed
                    ? styles.statusBadgeClosed
                    : styles.statusBadgeOpen,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    todayHours.isClosed
                      ? styles.statusDotClosed
                      : styles.statusDotOpen,
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    todayHours.isClosed
                      ? styles.statusTextClosed
                      : styles.statusTextOpen,
                  ]}
                >
                  {todayHours.isClosed
                    ? 'Closed Today'
                    : `Open ${todayHours.openingTime} – ${todayHours.closingTime}`}
                </Text>
              </View>
            </View>

            {/* ABOUT */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>About Turf</Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              <Text style={styles.description}>
                {turf.description?.trim() ||
                  'Enjoy a great sports experience at this turf.'}
              </Text>
            </View>

            {/* SPORTS */}
            {!!turf.sports?.length && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Sports</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <View style={styles.chipContainer}>
                  {turf.sports.map((sport, index) => (
                    <View
                      key={`${sport}-${index}`}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>{sport}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* AMENITIES */}
            {!!turf.amenities?.length && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Amenities</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <View style={styles.amenitiesGrid}>
                  {turf.amenities.map((amenity, index) => (
                    <View
                      key={`${amenity}-${index}`}
                      style={styles.amenityItem}
                    >
                      <View style={styles.amenityIcon}>
                        <Text style={styles.amenityIconText}>
                          {getAmenityIcon(amenity)}
                        </Text>
                      </View>

                      <Text
                        style={styles.amenityText}
                        numberOfLines={1}
                      >
                        {amenity}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* COURTS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Courts</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                {activeCourts.length > 0 && (
                  <Text style={styles.sectionCount}>
                    {activeCourts.length}{' '}
                    {activeCourts.length === 1 ? 'court' : 'courts'}
                  </Text>
                )}
              </View>

              {activeCourts.length === 0 ? (
                <View style={styles.noCourts}>
                  <Text style={styles.noCourtsIcon}>🚫</Text>
                  <Text style={styles.noCourtsText}>
                    No active courts available.
                  </Text>
                </View>
              ) : (
                activeCourts.map((court, index) => {
                  const price = getCourtPrice(court, turf);
                  const sports = getCourtSports(court);

                  return (
                    <View
                      key={getCourtId(court) || `court-${index}`}
                      style={styles.courtCard}
                    >
                      <View style={styles.courtLeft}>
                        <Text
                          style={styles.courtName}
                          numberOfLines={1}
                        >
                          {getCourtName(court, index)}
                        </Text>

                        <View style={styles.courtMetaRow}>
                          {sports.length > 0 && (
                            <Text
                              style={styles.courtSportsInline}
                              numberOfLines={1}
                            >
                              {sports.slice(0, 2).join(' • ')}
                            </Text>
                          )}

                          {court.hasNightPricing &&
                            court.nightPricePerHour !== undefined && (
                              <View style={styles.nightBadge}>
                                <Text style={styles.nightBadgeText}>
                                  🌙 ₹{court.nightPricePerHour}
                                </Text>
                              </View>
                            )}
                        </View>
                      </View>

                      <View style={styles.courtRight}>
                        <Text style={styles.courtPrice}>₹{price}</Text>
                        <Text style={styles.courtUnit}>/hr</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* OPENING HOURS */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Opening Hours</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <TouchableOpacity
                  onPress={() => setHoursExpanded((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.linkText}>
                    {hoursExpanded ? 'Hide' : 'Full week'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.hoursCard}>
                <View style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>
                    Today ({todayName.slice(0, 3)})
                  </Text>

                  <Text
                    style={[
                      styles.hoursTime,
                      todayHours.isClosed && styles.hoursTimeClosed,
                    ]}
                  >
                    {todayHours.isClosed
                      ? 'Closed'
                      : `${todayHours.openingTime} – ${todayHours.closingTime}`}
                  </Text>
                </View>

                {hoursExpanded &&
                  weekHours.map((h) => (
                    <View
                      key={h.day}
                      style={[styles.hoursRow, styles.hoursRowDivided]}
                    >
                      <Text style={styles.hoursDaySmall}>{h.day}</Text>

                      <Text
                        style={[
                          styles.hoursTimeSmall,
                          h.isClosed && styles.hoursTimeClosed,
                        ]}
                      >
                        {h.isClosed
                          ? 'Closed'
                          : `${h.openingTime} – ${h.closingTime}`}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>

            <View style={{ height: 100 }} />
          </View>
        </ScrollView>

        {/* FLOATING BOTTOM BAR */}
        <View style={styles.floatingBottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomLabel}>Starting from</Text>
            <Text style={styles.bottomValue}>
              {priceRange ? `₹${priceRange.min}` : '—'}
              <Text style={styles.bottomUnit}>/hour</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.bookButton,
              activeCourts.length === 0 && styles.bookButtonDisabled,
            ]}
            activeOpacity={0.85}
            disabled={activeCourts.length === 0}
            onPress={handleBookTurf}
          >
            <Text style={styles.bookButtonText}>BOOK NOW</Text>
          </TouchableOpacity>
        </View>
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

  scrollContent: {
    paddingBottom: 0,
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

  /* HERO */

  heroImage: {
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: COLORS.border,
  },

  heroLoader: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.border,
    zIndex: 1,
  },

  heroPlaceholder: {
    width: '100%',
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
  },

  heroPlaceholderIcon: {
    fontSize: 40,
    marginBottom: 8,
  },

  heroPlaceholderText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },

  heroGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(11,18,32,0.35)',
  },

  dotsRow: {
    position: 'absolute',
    bottom: 26,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },

  dotActive: {
    width: 16,
    backgroundColor: COLORS.primary,
  },

  /* FLOATING HEADER */

  floatingHeader: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },

  floatingButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(11,18,32,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },

  /* CONTENT WRAPPER */

  contentCard: {
    marginTop: -22,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.bg,
  },

  /* INFO CARD */

  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },

  titleContainer: {
    flex: 1,
    minWidth: 0,
  },

  turfName: {
    fontFamily: 'Poppins_900Black',
    fontSize: 20,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 26,
  },

  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },

  cityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
    flexShrink: 1,
  },

  priceBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    minWidth: 82,
  },

  priceLabel: {
    fontSize: 9,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  price: {
    fontSize: 18,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    marginTop: 1,
    letterSpacing: -0.4,
  },

  priceUnit: {
    fontSize: 9,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_700Bold',
    marginTop: 1,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  addressIcon: {
    marginRight: 7,
    marginTop: 2,
  },

  addressText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_500Medium',
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
  },

  statusBadgeOpen: {
    backgroundColor: COLORS.primaryFaint,
    borderColor: COLORS.primaryMuted,
  },

  statusBadgeClosed: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.dangerBorder,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },

  statusDotOpen: {
    backgroundColor: COLORS.primaryDeep,
  },

  statusDotClosed: {
    backgroundColor: COLORS.danger,
  },

  statusText: {
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.2,
  },

  statusTextOpen: {
    color: COLORS.primaryDarker,
  },

  statusTextClosed: {
    color: COLORS.dangerText,
  },

  /* SECTION CARD */

  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    flexShrink: 0,
  },

  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  sectionTitleAccent: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginLeft: 7,
    marginTop: 2,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionCount: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.2,
  },

  linkText: {
    fontSize: 11,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  description: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_400Regular',
  },

  /* CHIPS */

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
  },

  chipText: {
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'capitalize',
  },

  /* AMENITIES — 3 per row */

  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    rowGap: 8,
  },

  amenityItem: {
    width: '33.33%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  amenityIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryFaint,
    marginRight: 7,
    borderWidth: 1,
    borderColor: COLORS.primaryMuted,
  },

  amenityIconText: {
    fontSize: 13,
  },

  amenityText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
    lineHeight: 15,
  },

  /* COURTS */

  courtCard: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  courtLeft: {
    flex: 1,
    paddingRight: 10,
    minWidth: 0,
  },

  courtName: {
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  courtMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },

  courtSportsInline: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },

  nightBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  nightBadgeText: {
    fontSize: 9,
    color: COLORS.warningText,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.3,
  },

  courtRight: {
    alignItems: 'flex-end',
  },

  courtPrice: {
    fontSize: 16,
    fontFamily: 'Poppins_900Black',
    color: COLORS.primaryDarker,
    letterSpacing: -0.2,
  },

  courtUnit: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_700Bold',
    marginTop: 0,
  },

  noCourts: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
  },

  noCourtsIcon: {
    fontSize: 24,
    marginBottom: 5,
  },

  noCourtsText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* HOURS */

  hoursCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  hoursRowDivided: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.borderLight,
  },

  hoursDay: {
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
  },

  hoursTime: {
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    color: COLORS.primaryDarker,
  },

  hoursDaySmall: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textMuted,
  },

  hoursTimeSmall: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textSecondary,
  },

  hoursTimeClosed: {
    color: COLORS.dangerText,
  },

  /* FLOATING BOTTOM BAR */

  floatingBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    minHeight: 70,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },

  bottomInfo: {
    flex: 1,
  },

  bottomLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.3,
  },

  bottomValue: {
    marginTop: 1,
    fontSize: 18,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },

  bottomUnit: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_700Bold',
  },

  bookButton: {
    minWidth: 138,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },

  bookButtonDisabled: {
    backgroundColor: COLORS.borderSoft,
    shadowOpacity: 0,
    elevation: 0,
  },

  bookButtonText: {
    color: COLORS.dark,
    fontSize: 11,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
  },

  /* EMPTY STATE */

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 19,
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
    color: COLORS.dark,
    fontFamily: 'Poppins_900Black',
    fontSize: 12,
    letterSpacing: 0.8,
  },
});