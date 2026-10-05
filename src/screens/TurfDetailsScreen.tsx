import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || ''
).replace(/\/+$/, '');

const getImageUrl = (image?: string): string | undefined => {
  if (!image) {
    return undefined;
  }

  if (
    image.startsWith('http://') ||
    image.startsWith('https://')
  ) {
    return image;
  }

  return image;
};

const getTurfId = (turf: Turf): string => {
  return String(turf._id || turf.id || '');
};

const getCourtId = (court: TurfCourt): string => {
  return String(court._id || court.id || '');
};

const getCourtName = (court: TurfCourt, index: number): string => {
  return (
    court.name ||
    court.courtName ||
    `Court ${index + 1}`
  );
};

const getCourtPrice = (
  court: TurfCourt,
  turf: Turf
): number => {
  const price = Number(
    court.pricePerHour ?? turf.pricePerHour ?? 0
  );

  return Number.isFinite(price) ? price : 0;
};

const getPrimaryImage = (turf: Turf): string | undefined => {
  const primary = turf.images?.find(
    image => image?.isPrimary && image?.url
  );

  if (primary?.url) {
    return getImageUrl(primary.url);
  }

  const first = turf.images?.find(image => image?.url);

  if (first?.url) {
    return getImageUrl(first.url);
  }

  return getImageUrl(turf.image);
};

const getTodayHours = (
  turf: Turf
): OperatingHour | undefined => {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const today = days[new Date().getDay()];

  const hours = turf.operatingHours || [];

  return hours.find(item => {
    const value = String(
      item.dayOfWeek || item.day || ''
    ).toLowerCase();

    return value === today.toLowerCase();
  });
};

export default function TurfDetailsScreen({
  route,
  navigation,
}: Props) {
  const turf = route.params?.turf;

  const [refreshing, setRefreshing] = useState(false);

  const imageUrl = turf
    ? getPrimaryImage(turf)
    : undefined;

  const turfId = turf ? getTurfId(turf) : '';

  const activeCourts = (turf?.courts || []).filter(
    court =>
      String(court.status || 'active').toLowerCase() ===
      'active'
  );

  const todayHours = turf
    ? getTodayHours(turf)
    : undefined;

  const openTime =
    todayHours?.openingTime ||
    todayHours?.openTime ||
    turf?.openingTime ||
    '06:00 AM';

  const closeTime =
    todayHours?.closingTime ||
    todayHours?.closeTime ||
    turf?.closingTime ||
    '11:00 PM';

  const refresh = useCallback(async () => {
    /*
      TurfDetails is intentionally kept independent from
      slot availability.

      If you later add a turf GET endpoint, refresh it here.
      For now this simply refreshes the screen state.
    */
    setRefreshing(true);

    try {
      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleBookTurf = () => {
    if (!turf) {
      Alert.alert(
        'Turf unavailable',
        'Turf information could not be loaded.'
      );
      return;
    }

    if (!turfId) {
      Alert.alert(
        'Invalid turf',
        'This turf does not have a valid ID.'
      );
      return;
    }

    if (activeCourts.length === 0) {
      Alert.alert(
        'No courts available',
        'There are currently no active courts available for booking.'
      );
      return;
    }

    navigation.navigate('Slot', {
      turf,
    });
  };

  if (!turf) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            Turf not found
          </Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>
              Go Back
            </Text>
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerButtonText}>
              ‹
            </Text>
          </TouchableOpacity>

          <Text
            style={styles.headerTitle}
            numberOfLines={1}
          >
            Turf Details
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderText}>
                No Image
              </Text>
            </View>
          )}

          <View style={styles.content}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text style={styles.turfName}>
                  {turf.name || 'Unnamed Turf'}
                </Text>

                {!!turf.city && (
                  <Text style={styles.cityText}>
                    {turf.city}
                  </Text>
                )}
              </View>

              {typeof turf.pricePerHour === 'number' && (
                <View style={styles.priceBox}>
                  <Text style={styles.priceLabel}>
                    From
                  </Text>

                  <Text style={styles.price}>
                    ₹{turf.pricePerHour}
                  </Text>

                  <Text style={styles.priceUnit}>
                    /hour
                  </Text>
                </View>
              )}
            </View>

            {!!turf.address && (
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>
                  📍
                </Text>

                <Text style={styles.locationText}>
                  {turf.address}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>
              About Turf
            </Text>

            <Text style={styles.description}>
              {turf.description?.trim() ||
                'Enjoy a great sports experience at this turf.'}
            </Text>

            {!!turf.sports?.length && (
              <>
                <Text style={styles.sectionTitle}>
                  Sports
                </Text>

                <View style={styles.chipContainer}>
                  {turf.sports.map((sport, index) => (
                    <View
                      key={`${sport}-${index}`}
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>
                        {sport}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!!turf.amenities?.length && (
              <>
                <Text style={styles.sectionTitle}>
                  Amenities
                </Text>

                <View style={styles.amenitiesGrid}>
                  {turf.amenities.map(
                    (amenity, index) => (
                      <View
                        key={`${amenity}-${index}`}
                        style={styles.amenityItem}
                      >
                        <View
                          style={styles.amenityIcon}
                        >
                          <Text>✓</Text>
                        </View>

                        <Text
                          style={styles.amenityText}
                          numberOfLines={2}
                        >
                          {amenity}
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </>
            )}

            <Text style={styles.sectionTitle}>
              Courts
            </Text>

            {activeCourts.length === 0 ? (
              <View style={styles.noCourts}>
                <Text style={styles.noCourtsText}>
                  No active courts available.
                </Text>
              </View>
            ) : (
              activeCourts.map((court, index) => {
                const price = getCourtPrice(
                  court,
                  turf
                );

                return (
                  <View
                    key={getCourtId(court) || index}
                    style={styles.courtCard}
                  >
                    <View style={styles.courtLeft}>
                      <Text style={styles.courtName}>
                        {getCourtName(
                          court,
                          index
                        )}
                      </Text>

                      {!!court.sport && (
                        <Text style={styles.courtSport}>
                          {court.sport}
                        </Text>
                      )}
                    </View>

                    <View style={styles.courtRight}>
                      <Text style={styles.courtPrice}>
                        ₹{price}
                      </Text>

                      <Text style={styles.courtUnit}>
                        /hour
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            <Text style={styles.sectionTitle}>
              Opening Hours
            </Text>

            <View style={styles.hoursCard}>
              <Text style={styles.hoursDay}>
                Today
              </Text>

              <Text style={styles.hoursTime}>
                {openTime} - {closeTime}
              </Text>
            </View>

            <View style={styles.bottomSpace} />
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.bottomLabel}>
              Available courts
            </Text>

            <Text style={styles.bottomValue}>
              {activeCourts.length}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.bookButton}
            activeOpacity={0.85}
            onPress={handleBookTurf}
          >
            <Text style={styles.bookButtonText}>
              BOOK TURF
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF1',
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F5',
  },

  headerButtonText: {
    fontSize: 34,
    lineHeight: 34,
    color: '#111827',
    marginTop: -3,
  },

  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  headerSpacer: {
    width: 40,
  },

  scrollContent: {
    paddingBottom: 120,
  },

  heroImage: {
    width: '100%',
    height: 240,
    backgroundColor: '#E5E7EB',
  },

  imagePlaceholder: {
    width: '100%',
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
  },

  imagePlaceholderText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },

  content: {
    padding: 18,
  },

  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  titleContainer: {
    flex: 1,
  },

  turfName: {
    fontSize: 25,
    fontWeight: '900',
    color: '#111827',
  },

  cityText: {
    marginTop: 5,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  priceBox: {
    alignItems: 'flex-end',
  },

  priceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  price: {
    fontSize: 21,
    fontWeight: '900',
    color: '#111827',
  },

  priceUnit: {
    fontSize: 11,
    color: '#6B7280',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
  },

  locationIcon: {
    fontSize: 16,
    marginRight: 7,
  },

  locationText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#5B6472',
  },

  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 20,
    marginBottom: 10,
  },

  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#606A78',
  },

  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EAF7EE',
  },

  chipText: {
    color: '#16833B',
    fontWeight: '700',
    fontSize: 13,
  },

  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  amenityItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  amenityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF7EE',
    marginRight: 8,
  },

  amenityText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
  },

  courtCard: {
    minHeight: 70,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E9ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  courtLeft: {
    flex: 1,
  },

  courtName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  courtSport: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  courtRight: {
    alignItems: 'flex-end',
  },

  courtPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
  },

  courtUnit: {
    fontSize: 11,
    color: '#6B7280',
  },

  noCourts: {
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },

  noCourtsText: {
    color: '#6B7280',
  },

  hoursCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E9ED',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  hoursDay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  hoursTime: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16833B',
  },

  bottomSpace: {
    height: 30,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bottomLabel: {
    fontSize: 11,
    color: '#6B7280',
  },

  bottomValue: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },

  bookButton: {
    minWidth: 155,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#16833B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 20,
  },

  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#16833B',
  },

  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});