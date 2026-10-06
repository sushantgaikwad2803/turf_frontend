import React from 'react';
import {
  ActivityIndicator,
  Image,
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
   THEME COLORS — matched to HomeScreen / OwnerProfile
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
   PROPS
========================================================= */

interface SavedTurfsScreenProps {
  turfs: any[];
  likedTurfs: string[];
  onSelectTurf?: (turf: any) => void;
  onToggleLike: (turfId: string) => void;
}

/* =========================================================
   COMPONENT
========================================================= */

export const SavedTurfsScreen: React.FC<SavedTurfsScreenProps> = ({
  turfs,
  likedTurfs,
  onSelectTurf,
  onToggleLike,
}) => {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const normalizedLikedTurfs = new Set(likedTurfs.map((id) => String(id)));

  const savedTurfsList = turfs.filter((turf) => {
    const turfId = String(turf._id || turf.id || '');
    return turfId.length > 0 && normalizedLikedTurfs.has(turfId);
  });

  /* Font loading guard — never hangs the screen */
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

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerBadge}>❤️ FAVORITES</Text>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Saved Turfs</Text>
          {savedTurfsList.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {savedTurfsList.length}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.headerSubtitle}>
          Your favorite turfs in one place
        </Text>
      </View>

      {savedTurfsList.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>♡</Text>
          </View>
          <Text style={styles.emptyTitle}>No saved turfs yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the heart icon on any turf to add it to your saved list.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        >
          {savedTurfsList.map((item) => {
            const turfId = String(item._id || item.id || '');

            return (
              <TouchableOpacity
                key={turfId}
                style={styles.turfCard}
                onPress={() => onSelectTurf && onSelectTurf(item)}
                activeOpacity={0.9}
              >
                {/* IMAGE */}
                <View style={styles.imageWrapper}>
                  <Image
                    source={{
                      uri:
                        item.images && item.images.length > 0
                          ? item.images[0].url
                          : 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=600&q=80',
                    }}
                    style={styles.turfImage}
                    resizeMode="cover"
                  />

                  {/* PRICE PILL */}
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>
                      ₹{item.pricePerHour || '500'}/hr
                    </Text>
                  </View>

                  {/* HEART */}
                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => onToggleLike(turfId)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.heartIcon}>♥</Text>
                  </TouchableOpacity>
                </View>

                {/* DETAILS */}
                <View style={styles.cardDetails}>
                  <Text style={styles.turfName} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <View style={styles.locationRow}>
                    <View style={styles.locationDot} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {item.address || item.city}
                    </Text>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>From</Text>
                      <Text style={styles.priceText}>
                        ₹{item.pricePerHour || '500'}
                        <Text style={styles.priceUnit}>/hr</Text>
                      </Text>
                    </View>

                    <View style={styles.bookNowPill}>
                      <Text style={styles.bookNowText}>VIEW →</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

/* =========================================================
   STYLES — matched to HomeScreen palette + Poppins
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: COLORS.bg,
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
    marginBottom: 20,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontFamily: 'Poppins_900Black',
    fontSize: 28,
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },

  countBadge: {
    marginLeft: 12,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 9,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  countBadgeText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: -0.2,
  },

  headerSubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
  },

  /* LIST */

  listContainer: {
    paddingBottom: 100,
  },

  /* EMPTY */

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    marginTop: 60,
  },

  emptyIconCircle: {
    width: 104,
    height: 104,
    borderRadius: 34,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 4,
  },

  emptyIcon: {
    fontSize: 44,
    color: COLORS.primaryDeep,
    fontFamily: 'Poppins_700Bold',
  },

  emptyTitle: {
    fontFamily: 'Poppins_900Black',
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.2,
  },

  emptySubtitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* TURF CARD */

  turfCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },

  imageWrapper: {
    position: 'relative',
  },

  turfImage: {
    width: '100%',
    height: 170,
    backgroundColor: COLORS.bgMuted,
  },

  /* PRICE PILL */

  pricePill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: COLORS.dark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  pricePillText: {
    color: COLORS.primary,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.3,
  },

  /* HEART */

  heartButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 15,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },

  heartIcon: {
    color: COLORS.danger,
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
  },

  /* DETAILS */

  cardDetails: {
    padding: 16,
  },

  turfName: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 17,
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
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
    backgroundColor: COLORS.primaryDeep,
    marginRight: 8,
  },

  locationText: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  /* CARD FOOTER */

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  priceLabel: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginRight: 8,
  },

  priceText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 17,
    color: COLORS.primaryDarker,
    letterSpacing: -0.2,
  },

  priceUnit: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    color: COLORS.textMuted,
  },

  bookNowPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.primaryMuted,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },

  bookNowText: {
    color: COLORS.primaryDarker,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1,
  },
});

export default SavedTurfsScreen;