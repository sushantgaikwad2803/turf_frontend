import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';

/* =========================================================
   THEME COLORS - WHITE & LIGHT GREEN
========================================================= */

const COLORS = {
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',
  primaryLight: '#DCFCE7',
  primarySoft: '#F0FDF4',
  primaryFaint: '#F7FEF9',

  accent: '#F97316',
  accentLight: '#FFEDD5',

  bg: '#FFFFFF',
  card: '#FFFFFF',
  cardSoft: '#F9FDFA',

  border: '#E8F5EC',
  borderLight: '#D1FAE5',
  borderSoft: '#BBF7D0',

  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',

  white: '#FFFFFF',
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
  const normalizedLikedTurfs = new Set(likedTurfs.map((id) => String(id)));

  const savedTurfsList = turfs.filter((turf) => {
    const turfId = String(turf._id || turf.id || '');
    return turfId.length > 0 && normalizedLikedTurfs.has(turfId);
  });

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerBadge}>❤️ FAVORITES</Text>

        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Saved Turfs</Text>
          {savedTurfsList.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{savedTurfsList.length}</Text>
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
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.bg,
  },

  /* HEADER */
  header: {
    marginBottom: 20,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  countBadge: {
    marginLeft: 12,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  countBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },

  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '500',
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
    borderRadius: 52,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  emptyIcon: {
    fontSize: 46,
    color: COLORS.primary,
    fontWeight: '700',
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 10,
    letterSpacing: 0.2,
  },

  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },

  /* TURF CARD */
  turfCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  imageWrapper: {
    position: 'relative',
  },

  turfImage: {
    width: '100%',
    height: 170,
  },

  /* PRICE PILL */
  pricePill: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },

  pricePillText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  /* HEART */
  heartButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },

  heartIcon: {
    color: COLORS.danger,
    fontSize: 20,
    fontWeight: '800',
  },

  /* DETAILS */
  cardDetails: {
    padding: 16,
  },

  turfName: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
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
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  /* CARD FOOTER */
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },

  priceLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginRight: 8,
  },

  priceText: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.2,
  },

  priceUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },

  bookNowPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },

  bookNowText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

export default SavedTurfsScreen;