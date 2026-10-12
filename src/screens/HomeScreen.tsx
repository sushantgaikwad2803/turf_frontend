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

  AppState,

  AppStateStatus,

  BackHandler,

  Image,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  TouchableOpacity,

  View,

} from 'react-native';



import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
  useFonts,
} from '@expo-google-fonts/poppins';

import { SavedTurfsScreen } from './SavedTurfsScreen';

import { NotificationsScreen } from './NotificationsScreen';

import { OwnerProfileScreen } from './OwnerProfileScreen';

import  CustomerProfileScreen  from './CustomerProfileScreen';

import OwnerDashboardScreen from './OwnerDashboardScreen';



/* =========================================================

   API

========================================================= */



/**

 * The backend URL comes ONLY from EXPO_PUBLIC_API_URL.

 * No local IP address, no port 5000, and no Expo hostUri are used here.

 *

 * Valid .env example:

 * EXPO_PUBLIC_API_URL=https://turfbackend-production-a87e.up.railway.app/api

 */

const getApiBaseUrl = (): string => {

  const rawValue = process.env.EXPO_PUBLIC_API_URL;



  if (!rawValue || !rawValue.trim()) {

    throw new Error(

      'EXPO_PUBLIC_API_URL is missing. Add it to your .env file and restart Expo.',

    );

  }



  let url = rawValue.trim();



  // Remove accidental surrounding quotes from .env values.

  url = url.replace(/^[\\"']|[\\"']$/g, '');



  // Remove trailing slash(es) so endpoints are joined consistently.

  url = url.replace(/\/+$/, '');



  // React Native fetch requires an absolute URL with a protocol.

  // If the .env value does not contain one, default to HTTPS for Railway.

  if (!/^https?:\/\//i.test(url)) {

    url = `https://${url}`;

  }



  // Prevent accidental values such as "https://" from reaching fetch().

  if (!/^https?:\/\/[^\s/]+/i.test(url)) {

    throw new Error(

      `Invalid EXPO_PUBLIC_API_URL: ${url}. Expected a URL such as https://your-backend.up.railway.app/api`,

    );

  }



  return url;

};



const API_BASE_URL = getApiBaseUrl();



/**

 * Build every API endpoint from the single normalized base URL.

 */

const getApiUrl = (path: string): string => {

  const cleanPath = path.replace(/^\/+/, '');

  return `${API_BASE_URL}/${cleanPath}`;

};



// console.log('TurfBook API base URL:', API_BASE_URL);





/* =========================================================

   AUTO REFRESH

========================================================= */



const AUTO_REFRESH_INTERVAL = 30 * 1000;



/* =========================================================

   NEARBY SETTINGS

========================================================= */



const NEARBY_TURF_LIMIT = 3;



/* =========================================================

   THEME COLORS - WHITE & #7DC25B

========================================================= */



const COLORS = {
  // Premium TurfBook palette — deep navy + electric lime + violet
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
  placeholder: '#8A92A3',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#B91C1C',

  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  warningText: '#92400E',

  info: '#3B82F6',
  infoSoft: '#EFF6FF',

  white: '#FFFFFF',
  black: '#000000',

  overlay: 'rgba(11,18,32,0.06)',
  overlaySoft: 'rgba(255,255,255,0.94)',
  overlayFaint: 'rgba(255,255,255,0.18)',

  shadowColor: '#0B1220',
  shadowLight: '#DDE2EC',

  dark: '#0B1220',
  darkSoft: '#111827',
  darkCard: '#151D2E',
  darkMuted: '#1D2638',
  lime: '#C7F36B',
  violet: '#8B5CF6',
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



interface Turf {

  _id?: string;

  id?: string;

  name?: string;

  description?: string;

  address?: string;

  city?: string;

  sports?: string[];

  pricePerHour?: number;

  courts?: TurfCourt[];

  images?: TurfImage[];

  status?: 'active' | 'inactive' | 'maintenance';

  location?: {

    type?: 'Point';

    coordinates?: [number, number];

  };

}



interface UserLocation {

  latitude: number;

  longitude: number;

}



interface HomeScreenProps {

  user: any;

  onLogout?: () => void;

  onSelectTurf?: (turf: Turf) => void;

  onNavigateToAddTurf?: () => void;

  onUpdateUser?: (updatedUser: any) => void;

  onNavigateToManageCourts?: () => void;

  onNavigateToManageSlots?: () => void;

  onNavigateToOwnerBookings?: () => void;

}



/* =========================================================

   SPORT CATEGORIES

========================================================= */



const SPORT_CATEGORIES = [
  { id: 'all', name: 'All', icon: 'trophy-outline' as const },
  { id: 'cricket', name: 'Cricket', icon: 'cricket' as const },
  { id: 'football', name: 'Football', icon: 'soccer' as const },
  { id: 'badminton', name: 'Badminton', icon: 'badminton' as const },
  { id: 'basketball', name: 'Basketball', icon: 'basketball' as const },
  { id: 'volleyball', name: 'Volleyball', icon: 'volleyball' as const },
];



/* =========================================================

   HELPERS

========================================================= */



const normalizeSport = (sport?: string): string =>

  sport?.trim().toLowerCase() || '';



const formatSportName = (sport: string): string => {

  if (!sport) return '';

  return sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();

};



const getCourtSports = (court: TurfCourt): string[] => {

  const sports: string[] = [];

  if (typeof court.sport === 'string' && court.sport.trim()) {

    sports.push(court.sport);

  }

  if (Array.isArray(court.sports)) {

    sports.push(...court.sports);

  }

  return Array.from(new Set(sports.map(normalizeSport).filter(Boolean)));

};



const getTurfSports = (turf: Turf): string[] => {

  const sportsSet = new Set<string>();

  if (Array.isArray(turf.courts)) {

    turf.courts.forEach((court) => {

      getCourtSports(court).forEach((sport) => sportsSet.add(sport));

    });

  }

  if (sportsSet.size === 0 && Array.isArray(turf.sports)) {

    turf.sports.forEach((sport) => {

      const normalized = normalizeSport(sport);

      if (normalized) sportsSet.add(normalized);

    });

  }

  return Array.from(sportsSet);

};



const getCourtCount = (turf: Turf): number =>

  Array.isArray(turf.courts) ? turf.courts.length : 0;



const getSportPrice = (turf: Turf, selectedSport: string): number | null => {

  const courts = Array.isArray(turf.courts) ? turf.courts : [];

  const validCourts = courts.filter(

    (court) =>

      typeof court.pricePerHour === 'number' &&

      Number.isFinite(court.pricePerHour) &&

      court.pricePerHour >= 0,

  );



  if (validCourts.length === 0) {

    if (

      typeof turf.pricePerHour === 'number' &&

      Number.isFinite(turf.pricePerHour) &&

      turf.pricePerHour >= 0

    ) {

      return turf.pricePerHour;

    }

    return null;

  }



  const category = normalizeSport(selectedSport);



  if (category === 'all') {

    const cricketPrices = validCourts

      .filter((court) => getCourtSports(court).includes('cricket'))

      .map((court) => court.pricePerHour as number);



    if (cricketPrices.length > 0) return Math.min(...cricketPrices);



    const allPrices = validCourts.map((court) => court.pricePerHour as number);

    return allPrices.length > 0 ? Math.min(...allPrices) : null;

  }



  const matchingPrices = validCourts

    .filter((court) => getCourtSports(court).includes(category))

    .map((court) => court.pricePerHour as number);



  return matchingPrices.length === 0 ? null : Math.min(...matchingPrices);

};



const getPriceSportLabel = (selectedSport: string): string => {

  if (selectedSport === 'all') return 'Cricket price';

  const category = SPORT_CATEGORIES.find((item) => item.id === selectedSport);

  return category ? `${category.name} price` : 'Court price';

};



const getTurfImage = (turf: Turf): string | null => {

  if (!Array.isArray(turf.images) || turf.images.length === 0) return null;

  const primaryImage = turf.images.find((image) => image.isPrimary === true);

  return primaryImage?.url || turf.images[0]?.url || null;

};



const calculateDistanceKm = (

  lat1: number,

  lon1: number,

  lat2: number,

  lon2: number,

): number => {

  const earthRadiusKm = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;

  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =

    Math.sin(dLat / 2) * Math.sin(dLat / 2) +

    Math.cos((lat1 * Math.PI) / 180) *

      Math.cos((lat2 * Math.PI) / 180) *

      Math.sin(dLon / 2) *

      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;

};



const getTurfDistanceKm = (

  turf: Turf,

  location: UserLocation | null,

): number | null => {

  if (!location) return null;

  const coordinates = turf.location?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;



  const longitude = Number(coordinates[0]);

  const latitude = Number(coordinates[1]);



  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;



  return calculateDistanceKm(

    location.latitude,

    location.longitude,

    latitude,

    longitude,

  );

};



const formatDistance = (distanceKm: number | null): string => {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) {
    return 'Distance unavailable';
  }

  // Keep the distance compact and always show kilometres.
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
};



/* =========================================================

   HOME SCREEN

========================================================= */



export const HomeScreen: React.FC<HomeScreenProps> = ({

  user,

  onLogout,

  onSelectTurf,

  onNavigateToAddTurf,

  onUpdateUser,

  onNavigateToManageCourts,

  onNavigateToManageSlots,

  onNavigateToOwnerBookings,

}) => {

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const isOwner = user?.role === 'owner';



  const [activeTab, setActiveTab] = useState<

    'home' | 'liked' | 'notifications' | 'profile' | 'dashboard'

  >('home');



  const [searchQuery, setSearchQuery] = useState('');

  const [selectedCategory, setSelectedCategory] = useState('all');

  const [turfs, setTurfs] = useState<Turf[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [likedTurfs, setLikedTurfs] = useState<string[]>([]);

  const [likesLoaded, setLikesLoaded] = useState(false);



  const likedTurfsStorageKey = useMemo(() => {

    const identity =

      user?._id ||

      user?.id ||

      user?.userId ||

      user?.email ||

      user?.phone ||

      'guest';



    return `@turfbook_liked_turfs_${String(identity)}`;

  }, [user?._id, user?.id, user?.userId, user?.email, user?.phone]);

  const [userCity, setUserCity] = useState('Detecting location...');

  const [loadingLocation, setLoadingLocation] = useState(true);

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);



  const isFetchingTurfsRef = useRef(false);

  const isFetchingLocationRef = useRef(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const autoRefreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(

    null,

  );

  const previousActiveTabRef = useRef(activeTab);



  /* FETCH LIVE LOCATION */

  const fetchLiveLocation = useCallback(async () => {

    if (isFetchingLocationRef.current) return;



    try {

      isFetchingLocationRef.current = true;

      setLoadingLocation(true);



      const { status } = await Location.requestForegroundPermissionsAsync();



      if (status !== 'granted') {

        setUserCity(user?.city || 'Location Disabled');

        setUserLocation(null);

        return;

      }



      const location = await Location.getCurrentPositionAsync({

        accuracy: Location.Accuracy.High,

      });



      const latitude = location.coords.latitude;

      const longitude = location.coords.longitude;



      setUserLocation({ latitude, longitude });



      const geocode = await Location.reverseGeocodeAsync({

        latitude,

        longitude,

      });



      if (geocode.length > 0) {

        const place = geocode[0];

        const currentCity =

          place.city ||

          place.subregion ||

          place.region ||

          place.district ||

          'Current Location';

        setUserCity(currentCity);

      } else {

        setUserCity(user?.city || 'Unknown City');

      }

    } catch (error) {

      console.error('Error fetching live location:', error);

      setUserLocation(null);

      setUserCity(user?.city || 'Location Unavailable');

    } finally {

      setLoadingLocation(false);

      isFetchingLocationRef.current = false;

    }

  }, [user?.city]);



  /* FETCH TURFS */

  const fetchTurfs = useCallback(

    async (showLoader = true, showErrorAlert = false) => {

      if (isFetchingTurfsRef.current) return;



      let timeoutId: ReturnType<typeof setTimeout> | null = null;



      try {

        isFetchingTurfsRef.current = true;



        if (showLoader) setLoading(true);

        setErrorMessage(null);



        const apiUrl = getApiUrl('turfs');



        // console.log('========================================');

        // console.log('TurfBook API request:', apiUrl);

        // console.log('========================================');



        const controller = new AbortController();



        timeoutId = setTimeout(() => {

          controller.abort();

        }, 15000);



        let response: Response;



        try {

          response = await fetch(apiUrl, {

            method: 'GET',

            headers: {

              Accept: 'application/json',

            },

            signal: controller.signal,

          });

        } catch (networkError) {

          const errorText =

            networkError instanceof Error

              ? networkError.message

              : String(networkError);



          const isAbort =

            networkError instanceof Error &&

            (networkError.name === 'AbortError' ||

              errorText.toLowerCase().includes('abort'));



          if (isAbort) {

            throw new Error(

              `Request timed out while connecting to ${apiUrl}. Check that the Railway backend is running and the URL is correct.`,

            );

          }



          if (errorText.toLowerCase().includes('malformedurlexception') ||

              errorText.toLowerCase().includes('no protocol')) {

            throw new Error(

              `Invalid backend URL: ${apiUrl}. EXPO_PUBLIC_API_URL must be a complete URL such as https://your-backend.up.railway.app/api.`,

            );

          }



          throw new Error(

            `Cannot connect to the backend at ${apiUrl}. Original error: ${errorText || 'Network request failed'}`,

          );

        }



        if (timeoutId) {

          clearTimeout(timeoutId);

          timeoutId = null;

        }



        /*

         * Read text first instead of calling response.json() directly.

         * This prevents a second JSON parsing error when Express/proxy

         * returns HTML or an empty response.

         */

        const responseText = await response.text();



        let data: any = null;



        if (responseText.trim()) {

          try {

            data = JSON.parse(responseText);

          } catch {

            data = null;

          }

        }



        // console.log('Turf API status:', response.status);

        // console.log('Turf API response:', responseText.slice(0, 500));



        if (!response.ok) {

          const serverMessage =

            data?.error ||

            data?.message ||

            data?.errors?.[0]?.message ||

            responseText.trim() ||

            `HTTP ${response.status}`;



          throw new Error(

            `Server returned ${response.status}: ${serverMessage}`,

          );

        }



        const turfList: Turf[] = Array.isArray(data)

          ? data

          : Array.isArray(data?.turfs)

            ? data.turfs

            : [];



        const activeTurfs = turfList.filter(

          (turf) => !turf.status || turf.status === 'active',

        );



        setTurfs(activeTurfs);

        setErrorMessage(null);

      } catch (error) {

        console.error('========================================');

        console.error('FETCH TURFS ERROR:', error);

        console.error('API URL:', getApiUrl('turfs'));

        console.error('========================================');



        const rawMessage =

          error instanceof Error ? error.message : String(error);



        const message = rawMessage.toLowerCase().includes('network request failed')

          ? `Unable to connect to TurfBook server at ${getApiUrl('turfs')}. Check your Railway backend and network connection.`

          : rawMessage;



        setErrorMessage(message);



        if (showErrorAlert) {

          Alert.alert('Unable to load turfs', message, [

            {

              text: 'OK',

              style: 'default',

            },

          ]);

        }

      } finally {

        if (timeoutId) {

          clearTimeout(timeoutId);

          timeoutId = null;

        }



        setLoading(false);

        setRefreshing(false);

        isFetchingTurfsRef.current = false;

      }

    },

    [],

  );



  /* INITIAL DATA */

  useEffect(() => {

    fetchLiveLocation();

    fetchTurfs(true, true);

  }, [fetchLiveLocation, fetchTurfs]);



  /* AUTO REFRESH */

  useEffect(() => {

    if (autoRefreshTimerRef.current) {

      clearInterval(autoRefreshTimerRef.current);

      autoRefreshTimerRef.current = null;

    }



    if (activeTab !== 'home') return;



    autoRefreshTimerRef.current = setInterval(() => {

      fetchTurfs(false, false);

    }, AUTO_REFRESH_INTERVAL);



    return () => {

      if (autoRefreshTimerRef.current) {

        clearInterval(autoRefreshTimerRef.current);

        autoRefreshTimerRef.current = null;

      }

    };

  }, [activeTab, fetchTurfs]);



  /* REFRESH ON TAB RETURN */

  useEffect(() => {

    const previousTab = previousActiveTabRef.current;

    if (previousTab !== 'home' && activeTab === 'home') {

      fetchTurfs(false, false);

      fetchLiveLocation();

    }

    previousActiveTabRef.current = activeTab;

  }, [activeTab, fetchTurfs, fetchLiveLocation]);



  /* APP STATE */

  useEffect(() => {

    const subscription = AppState.addEventListener('change', (nextAppState) => {

      const previousState = appStateRef.current;

      appStateRef.current = nextAppState;



      const wasBackground =

        previousState === 'background' || previousState === 'inactive';

      const isForeground = nextAppState === 'active';



      if (wasBackground && isForeground && activeTab === 'home') {

        fetchTurfs(false, false);

        fetchLiveLocation();

      }

    });



    return () => subscription.remove();

  }, [activeTab, fetchTurfs, fetchLiveLocation]);



  /* BACK BUTTON */

  useEffect(() => {

    const onBackPress = () => {

      if (activeTab !== 'home') {

        setActiveTab('home');

        return true;

      }

      return false;

    };



    const backHandler = BackHandler.addEventListener(

      'hardwareBackPress',

      onBackPress,

    );



    return () => backHandler.remove();

  }, [activeTab]);



  /* PULL TO REFRESH */

  const handleRefresh = useCallback(async () => {

    if (refreshing) return;

    setRefreshing(true);

    try {

      await Promise.all([fetchTurfs(false, false), fetchLiveLocation()]);

    } finally {

      setRefreshing(false);

    }

  }, [fetchTurfs, fetchLiveLocation, refreshing]);



  /* LOAD PERSISTENT LIKES */

  useEffect(() => {

    let cancelled = false;



    const loadLikedTurfs = async () => {

      setLikesLoaded(false);



      try {

        const stored = await AsyncStorage.getItem(likedTurfsStorageKey);



        if (cancelled) return;



        if (!stored) {

          setLikedTurfs([]);

          return;

        }



        const parsed: unknown = JSON.parse(stored);

        const ids = Array.isArray(parsed)

          ? parsed

              .filter((id): id is string => typeof id === 'string')

              .map((id) => id.trim())

              .filter(Boolean)

          : [];



        setLikedTurfs(Array.from(new Set(ids)));

      } catch (error) {

        console.error('Failed to load liked turfs:', error);

        if (!cancelled) setLikedTurfs([]);

      } finally {

        if (!cancelled) setLikesLoaded(true);

      }

    };



    loadLikedTurfs();



    return () => {

      cancelled = true;

    };

  }, [likedTurfsStorageKey]);



  /* SAVE PERSISTENT LIKES */

  useEffect(() => {

    if (!likesLoaded) return;



    const saveLikedTurfs = async () => {

      try {

        await AsyncStorage.setItem(

          likedTurfsStorageKey,

          JSON.stringify(Array.from(new Set(likedTurfs))),

        );

      } catch (error) {

        console.error('Failed to save liked turfs:', error);

      }

    };



    saveLikedTurfs();

  }, [likedTurfs, likedTurfsStorageKey, likesLoaded]);



  /* LIKE / UNLIKE TURF */

  const toggleLikeTurf = useCallback((turfId: string) => {

    const normalizedId = String(turfId || '').trim();

    if (!normalizedId) return;



    setLikedTurfs((previous) => {

      if (previous.includes(normalizedId)) {

        return previous.filter((id) => id !== normalizedId);

      }



      return [...previous, normalizedId];

    });

  }, []);



  /* FILTERED + SORTED */

  const filteredTurfs = useMemo(() => {

    const query = searchQuery.trim().toLowerCase();



    const filtered = turfs.filter((turf) => {

      const turfName = turf.name?.toLowerCase() || '';

      const turfCity = turf.city?.toLowerCase() || '';

      const turfAddress = turf.address?.toLowerCase() || '';



      const matchesSearch =

        !query ||

        turfName.includes(query) ||

        turfCity.includes(query) ||

        turfAddress.includes(query);



      const turfSports = getTurfSports(turf);

      const matchesCategory =

        selectedCategory === 'all' ||

        turfSports.includes(normalizeSport(selectedCategory));



      return matchesSearch && matchesCategory;

    });



    return [...filtered].sort((a, b) => {

      const distanceA = getTurfDistanceKm(a, userLocation);

      const distanceB = getTurfDistanceKm(b, userLocation);



      if (distanceA === null && distanceB === null) return 0;

      if (distanceA === null) return 1;

      if (distanceB === null) return -1;

      return distanceA - distanceB;

    });

  }, [turfs, searchQuery, selectedCategory, userLocation]);



  // Search results should never be hidden behind the 3-item nearby limit.
  const isSearching = searchQuery.trim().length > 0;

  const displayedTurfs = useMemo(
    () => (isSearching ? filteredTurfs : filteredTurfs.slice(0, NEARBY_TURF_LIMIT)),
    [filteredTurfs, isSearching],
  );

  const moreNearbyTurfs = useMemo(
    () => (isSearching ? [] : filteredTurfs.slice(NEARBY_TURF_LIMIT)),
    [filteredTurfs, isSearching],
  );



  /* RENDER HORIZONTAL TURF CARD */

  const renderTurfCard = (item: Turf) => {

    const turfId = String(item._id || item.id || '');

    const isLiked = turfId ? likedTurfs.includes(turfId) : false;

    const turfImage = getTurfImage(item);

    const turfPrice = getSportPrice(item, selectedCategory);

    const courtCount = getCourtCount(item);

    const sports = getTurfSports(item);

    const turfDistance = getTurfDistanceKm(item, userLocation);



    return (

      <TouchableOpacity

        key={turfId || item.name || 'turf-card'}

        style={styles.turfCardHorizontal}

        activeOpacity={0.9}

        onPress={() => onSelectTurf?.(item)}

      >

        {/* IMAGE */}

        <View style={styles.imageWrapper}>

          {turfImage ? (

            <Image

              source={{ uri: turfImage }}

              style={styles.turfImageHorizontal}

              resizeMode="cover"

            />

          ) : (

            <View style={styles.imagePlaceholder}>

              <MaterialCommunityIcons name="soccer" size={34} color={COLORS.primaryDeep} />

              <Text style={styles.imagePlaceholderText}>No Image</Text>

            </View>

          )}



          {/* GRADIENT OVERLAY */}

          <View style={styles.imageOverlay} />



          {/* LIKE */}

          {!isOwner && (

            <TouchableOpacity

              style={styles.likeHeartOverlay}

              activeOpacity={0.8}

              onPress={() => toggleLikeTurf(turfId)}

            >

              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={21}
                color={isLiked ? COLORS.danger : COLORS.textMuted}
              />

            </TouchableOpacity>

          )}



          {/* PRICE */}

          {turfPrice !== null && (

            <View style={styles.pricePill}>

              <Text style={styles.pricePillText}>₹{turfPrice}/hr</Text>

            </View>

          )}



          {/* DISTANCE BADGE */}

          <View style={styles.distanceBadge}>

            <View style={styles.distanceBadgeContent}>
              <Ionicons name="location-outline" size={12} color={COLORS.primaryDeep} />
              <Text style={styles.distanceBadgeText}>{formatDistance(turfDistance)}</Text>
            </View>

          </View>

        </View>



        {/* TURF INFO */}

        <View style={styles.turfInfoHorizontal}>

          <Text style={styles.turfNameHorizontal} numberOfLines={1}>

            {item.name || 'Unnamed Turf'}

          </Text>



          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.turfCityHorizontal} numberOfLines={1}>
              {item.city || 'City unavailable'}
            </Text>
          </View>



          <View style={styles.turfMetaRow}>

            {turfPrice !== null ? (

              <Text style={styles.priceText} numberOfLines={1}>

                From ₹{turfPrice}/hr

              </Text>

            ) : (

              <Text style={styles.priceUnavailableText} numberOfLines={1}>

                Price unavailable

              </Text>

            )}



            <View style={styles.courtBadge}>

              <View style={styles.courtTextRow}>
                <Ionicons name="grid-outline" size={11} color={COLORS.primaryDeep} />
                <Text style={styles.courtText} numberOfLines={1}>{courtCount}</Text>
              </View>

            </View>

          </View>



          {sports.length > 0 ? (

            <Text style={styles.sportsText} numberOfLines={1}>

              {sports.map(formatSportName).join(' • ')}

            </Text>

          ) : (

            <Text style={styles.noSportsText}>Sports not available</Text>

          )}

        </View>

      </TouchableOpacity>

    );

  };



  /* RENDER MORE TURF CARD */

  const renderMoreTurfCard = (item: Turf) => {

    const turfId = String(item._id || item.id || '');

    const turfImage = getTurfImage(item);

    const turfPrice = getSportPrice(item, selectedCategory);

    const courtCount = getCourtCount(item);

    const sports = getTurfSports(item);

    const distance = getTurfDistanceKm(item, userLocation);

    const isLiked = turfId ? likedTurfs.includes(turfId) : false;



    return (

      <TouchableOpacity

        key={turfId}

        style={styles.moreTurfCard}

        activeOpacity={0.9}

        onPress={() => onSelectTurf?.(item)}

      >

        <View style={styles.moreTurfImageWrapper}>

          {turfImage ? (

            <Image

              source={{ uri: turfImage }}

              style={styles.moreTurfImage}

              resizeMode="cover"

            />

          ) : (

            <View style={styles.moreTurfImagePlaceholder}>

              <MaterialCommunityIcons name="soccer" size={30} color={COLORS.primaryDeep} />

            </View>

          )}



          {!isOwner && (

            <TouchableOpacity

              style={styles.moreTurfLikeButton}

              activeOpacity={0.8}

              onPress={() => toggleLikeTurf(turfId)}

            >

              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={isLiked ? COLORS.danger : COLORS.textMuted}
              />

            </TouchableOpacity>

          )}

        </View>



        <View style={styles.moreTurfInfo}>

          <Text style={styles.moreTurfName} numberOfLines={1}>

            {item.name || 'Unnamed Turf'}

          </Text>



          <View style={styles.cityRow}>
            <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.moreTurfCity} numberOfLines={1}>
              {item.city || 'City unavailable'}
            </Text>
          </View>



          <View style={styles.moreTurfDistanceRow}>

            <View style={styles.distanceInlineRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.primaryDeep} />
              <Text style={styles.moreTurfDistance} numberOfLines={1}>
                {formatDistance(distance)}
              </Text>
            </View>



            {turfPrice !== null && (

              <Text style={styles.moreTurfPrice}>₹{turfPrice}/hr</Text>

            )}

          </View>



          <View style={styles.moreTurfMetaRow}>

            <View style={styles.moreTurfCourtBadge}>

              <View style={styles.courtTextRow}>
              <Ionicons name="grid-outline" size={10} color={COLORS.primaryDeep} />
              <Text style={styles.moreTurfCourtText} numberOfLines={1}>{courtCount}</Text>
            </View>

            </View>



            {sports.length > 0 && (

              <Text style={styles.moreTurfSports} numberOfLines={1}>

                {sports.map(formatSportName).join(' • ')}

              </Text>

            )}

          </View>

        </View>

      </TouchableOpacity>

    );

  };



  /* HOME CONTENT */

  const renderHome = () => (

    <ScrollView

      contentContainerStyle={styles.scrollContent}

      showsVerticalScrollIndicator={false}

      refreshControl={

        <RefreshControl

          refreshing={refreshing}

          onRefresh={handleRefresh}

          colors={[COLORS.primary]}

          tintColor={COLORS.primary}

        />

      }

    >

      {/* HEADER */}

      <View style={styles.header}>

        <View style={styles.headerLeft}>

          <Text style={styles.greeting}>

            Hi, {user?.name || 'Player'}

          </Text>



          <TouchableOpacity

            style={styles.locationRow}

            onPress={fetchLiveLocation}

            activeOpacity={0.7}

          >

            <Ionicons name="location-outline" size={16} color={COLORS.primaryDeep} style={styles.locationDot} />

            <Text style={styles.locationText} numberOfLines={1}>

              {userCity}

            </Text>

            {loadingLocation && (

              <ActivityIndicator

                size="small"

                color={COLORS.primary}

                style={{ marginLeft: 6 }}

              />

            )}

          </TouchableOpacity>

        </View>



        <View style={styles.headerIcons}>

          {!isOwner && (

            <TouchableOpacity

              style={styles.iconCircleButton}

              onPress={() => setActiveTab('liked')}

              activeOpacity={0.75}

            >

              <Ionicons name="heart-outline" size={21} color={COLORS.textPrimary} />

            </TouchableOpacity>

          )}



          <TouchableOpacity

            style={styles.iconCircleButton}

            onPress={() => setActiveTab('notifications')}

            activeOpacity={0.75}

          >

            <Ionicons name="notifications-outline" size={21} color={COLORS.textPrimary} />

          </TouchableOpacity>

        </View>

      </View>



      {/* SEARCH */}

      <View style={styles.searchContainer}>

        <Ionicons name="search-outline" size={20} color={COLORS.textMuted} style={styles.searchIcon} />

        <TextInput

          style={styles.searchInput}

          placeholder="Search turf, city or location"

          placeholderTextColor={COLORS.placeholder}

          value={searchQuery}

          onChangeText={setSearchQuery}

          returnKeyType="search"

        />

      </View>



      {!isSearching && (
        <>
      <View style={styles.bannerContainer}>

        <View style={styles.bannerDecorCircle1} />

        <View style={styles.bannerDecorCircle2} />



        <View style={styles.bannerTextContent}>

          <View style={styles.bannerBadgeRow}>

            <Ionicons name="trophy-outline" size={13} color={COLORS.lime} /><Text style={styles.bannerBadgeText}>TURFBOOK</Text>

          </View>



          <Text style={styles.bannerTitle}>Find Your Perfect Turf</Text>

          <Text style={styles.bannerSubText}>Book your slot in seconds</Text>



          <TouchableOpacity

            style={styles.bannerButton}

            onPress={() => {

              setSearchQuery('');

              setSelectedCategory('all');

            }}

            activeOpacity={0.85}

          >

            <Text style={styles.bannerButtonText}>EXPLORE TURFS →</Text>

          </TouchableOpacity>

        </View>



        <View style={styles.bannerEmojiCircle}>

          <MaterialCommunityIcons name="soccer" size={40} color={COLORS.lime} />

        </View>

      </View>



      

      <View style={styles.sectionContainer}>

        <View style={styles.sectionTitleRow}>

          <Text style={styles.sectionTitle}>Sports</Text>

          <View style={styles.sectionTitleAccent} />

        </View>



        <ScrollView

          horizontal

          showsHorizontalScrollIndicator={false}

          style={styles.categoryScroll}

          contentContainerStyle={styles.categoryScrollContent}

        >

          {SPORT_CATEGORIES.map((category) => {

            const isSelected = selectedCategory === category.id;

            return (

              <TouchableOpacity

                key={category.id}
                style={[
                  styles.categoryCard,
                  category.id === SPORT_CATEGORIES[SPORT_CATEGORIES.length - 1].id &&
                    styles.lastCategoryCard,
                  isSelected && styles.activeCategoryCard,
                ]}

                activeOpacity={0.8}

                onPress={() => setSelectedCategory(category.id)}

              >

                <View

                  style={[

                    styles.categoryIconWrapper,

                    isSelected && styles.activeCategoryIconWrapper,

                  ]}

                >

                  <MaterialCommunityIcons name={category.icon} size={24} color={isSelected ? COLORS.dark : COLORS.textPrimary} />

                </View>



                <Text

                  style={[

                    styles.categoryText,

                    isSelected && styles.activeCategoryText,

                  ]}

                >

                  {category.name}

                </Text>

              </TouchableOpacity>

            );

          })}

        </ScrollView>

      </View>

        </>
            )}



      <View style={styles.sectionContainer}>

        <View style={styles.sectionHeaderRow}>

          <View style={styles.sectionHeaderTextContainer}>

            <View style={styles.sectionTitleRow}>

              <Text style={styles.sectionTitle}>{isSearching ? 'Search Results' : 'Nearby Arenas'}</Text>

              <View style={styles.sectionTitleAccent} />

            </View>



            <Text style={styles.priceModeText}>

              {isSearching
                ? `${filteredTurfs.length} turf${filteredTurfs.length === 1 ? '' : 's'} found`
                : selectedCategory === 'all'
                ? 'Showing nearest Cricket court price'
                : `Showing nearest ${
                    SPORT_CATEGORIES.find((c) => c.id === selectedCategory)
                      ?.name || 'selected sport'
                  } court price`}

            </Text>

          </View>



          <TouchableOpacity

            style={styles.viewAllButton}

            onPress={() => {

              setSearchQuery('');

              setSelectedCategory('all');

            }}

            activeOpacity={0.8}

          >

            <Text style={styles.viewAllText}>{isSearching ? 'Clear' : 'View all'}</Text>

          </TouchableOpacity>

        </View>



        {/* ERROR */}

        {errorMessage && !loading && (

          <View style={styles.errorContainer}>

            <Ionicons name="warning-outline" size={28} color={COLORS.danger} />

            <Text style={styles.errorText}>{errorMessage}</Text>

            <TouchableOpacity

              style={styles.retryButton}

              onPress={() => fetchTurfs(true, true)}

              activeOpacity={0.85}

            >

              <Text style={styles.retryButtonText}>RETRY</Text>

            </TouchableOpacity>

            <Text style={styles.errorHint}>

              Server: {API_BASE_URL}

            </Text>

          </View>

        )}



        {/* LOADING / EMPTY / LIST */}

        {loading ? (

          <View style={styles.loadingContainer}>

            <ActivityIndicator color={COLORS.primary} size="large" />

            <Text style={styles.loadingText}>Finding nearby turfs...</Text>

          </View>

        ) : filteredTurfs.length === 0 ? (

          <View style={styles.emptyContainer}>

            <View style={styles.emptyIconWrapper}>

              <Ionicons name="search-outline" size={30} color={COLORS.primaryDeep} />

            </View>



            <Text style={styles.emptyTitle}>No turfs found</Text>

            <Text style={styles.emptyText}>

              No turf is available for the selected sport or search.

            </Text>



            <TouchableOpacity

              style={styles.clearFilterButton}

              onPress={() => {

                setSearchQuery('');

                setSelectedCategory('all');

              }}

              activeOpacity={0.85}

            >

              <Text style={styles.clearFilterButtonText}>CLEAR FILTERS</Text>

            </TouchableOpacity>

          </View>

        ) : (

          <>
            {isSearching ? (
              <View style={styles.moreNearbyList}>
                {displayedTurfs.map(renderMoreTurfCard)}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.turfListContent}
              >
                {displayedTurfs.map(renderTurfCard)}
              </ScrollView>
            )}



            {moreNearbyTurfs.length > 0 && (

              <View style={styles.moreNearbyContainer}>

                <View style={styles.sectionTitleRow}>

                  <Text style={styles.sectionTitle}>More Nearby Arenas</Text>

                  <View style={styles.sectionTitleAccent} />

                </View>



                <Text style={styles.moreNearbySubtitle}>

                  Other turfs near your location

                </Text>



                <View style={styles.moreNearbyList}>

                  {moreNearbyTurfs.map(renderMoreTurfCard)}

                </View>

              </View>

            )}



            {!userLocation && filteredTurfs.length > 0 && (

              <View style={styles.locationNotice}>

                <Ionicons name="location-outline" size={21} color={COLORS.primaryDeep} style={styles.locationNoticeIcon} />

                <Text style={styles.locationNoticeText}>

                  Enable location access to see exact turf distances near you.

                </Text>

                <TouchableOpacity

                  style={styles.locationNoticeButton}

                  onPress={fetchLiveLocation}

                  activeOpacity={0.8}

                >

                  <Text style={styles.locationNoticeButtonText}>ENABLE</Text>

                </TouchableOpacity>

              </View>

            )}

          </>

        )}

      </View>

    </ScrollView>

  );



  /* MAIN RENDER */

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fontLoadingContainer}>
          <View style={styles.fontLoadingMark}>
            <Ionicons name="football-outline" size={30} color={COLORS.dark} />
          </View>
          <ActivityIndicator size="small" color={COLORS.primaryDeep} />
          <Text style={styles.fontLoadingText}>TurfBook</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (

    <SafeAreaView style={styles.container}>

      {activeTab === 'home' && renderHome()}



      {!isOwner && activeTab === 'liked' && (

        <SavedTurfsScreen

          turfs={turfs}

          likedTurfs={likedTurfs}

          onSelectTurf={onSelectTurf}

          onToggleLike={toggleLikeTurf}

        />

      )}



      {activeTab === 'notifications' && <NotificationsScreen />}



      {activeTab === 'profile' &&

        (isOwner ? (

          <OwnerProfileScreen

            user={user}

            onUpdateUser={onUpdateUser}

            onLogout={onLogout}

            onNavigateToAddTurf={onNavigateToAddTurf}

          />

        ) : (

          <CustomerProfileScreen

            user={user}

            onUpdateUser={onUpdateUser}

            onLogout={onLogout}

          />

        ))}



      {isOwner && activeTab === 'dashboard' && (

        <OwnerDashboardScreen

          user={user}

          onAddTurf={onNavigateToAddTurf}

          onManageCourts={onNavigateToManageCourts}

          onManageSlots={onNavigateToManageSlots}

          onViewBookings={onNavigateToOwnerBookings}

        />

      )}



      {/* BOTTOM NAVIGATION */}

      <View style={styles.bottomBarContainer}>

        <TouchableOpacity

          style={styles.tabButton}

          onPress={() => setActiveTab('home')}

          activeOpacity={0.8}

        >

          <View

            style={[

              styles.tabIconWrapper,

              activeTab === 'home' && styles.activeTabIconWrapper,

            ]}

          >

            <Ionicons name={activeTab === 'home' ? 'home' : 'home-outline'} size={22}
              color={activeTab === 'home' ? COLORS.dark : COLORS.textMuted} />

          </View>

          <Text

            style={[

              styles.tabLabel,

              activeTab === 'home' && styles.activeTabLabel,

            ]}

          >

            Home

          </Text>

        </TouchableOpacity>



        {!isOwner && (

          <TouchableOpacity

            style={styles.tabButton}

            onPress={() => setActiveTab('liked')}

            activeOpacity={0.8}

          >

            <View

              style={[

                styles.tabIconWrapper,

                activeTab === 'liked' && styles.activeTabIconWrapper,

              ]}

            >

              <Ionicons name={activeTab === 'liked' ? 'heart' : 'heart-outline'} size={22}
                color={activeTab === 'liked' ? COLORS.dark : COLORS.textMuted} />

            </View>

            <Text

              style={[

                styles.tabLabel,

                activeTab === 'liked' && styles.activeTabLabel,

              ]}

            >

              Liked

            </Text>

          </TouchableOpacity>

        )}



        <TouchableOpacity

          style={styles.tabButton}

          onPress={() => setActiveTab('notifications')}

          activeOpacity={0.8}

        >

          <View

            style={[

              styles.tabIconWrapper,

              activeTab === 'notifications' && styles.activeTabIconWrapper,

            ]}

          >

            <Ionicons name={activeTab === 'notifications' ? 'notifications' : 'notifications-outline'} size={22}
              color={activeTab === 'notifications' ? COLORS.dark : COLORS.textMuted} />

          </View>

          <Text

            style={[

              styles.tabLabel,

              activeTab === 'notifications' && styles.activeTabLabel,

            ]}

          >

            Alerts

          </Text>

        </TouchableOpacity>



        {isOwner && (

          <TouchableOpacity

            style={styles.tabButton}

            onPress={() => setActiveTab('dashboard')}

            activeOpacity={0.8}

          >

            <View

              style={[

                styles.tabIconWrapper,

                activeTab === 'dashboard' && styles.activeTabIconWrapper,

              ]}

            >

              <Ionicons name={activeTab === 'dashboard' ? 'grid' : 'grid-outline'} size={21}
                color={activeTab === 'dashboard' ? COLORS.dark : COLORS.textMuted} />

            </View>

            <Text

              style={[

                styles.tabLabel,

                activeTab === 'dashboard' && styles.activeTabLabel,

              ]}

            >

              Dashboard

            </Text>

          </TouchableOpacity>

        )}



        <TouchableOpacity

          style={styles.tabButton}

          onPress={() => setActiveTab('profile')}

          activeOpacity={0.8}

        >

          <View

            style={[

              styles.tabIconWrapper,

              activeTab === 'profile' && styles.activeTabIconWrapper,

            ]}

          >

            <Ionicons name={activeTab === 'profile' ? 'person' : 'person-outline'} size={22}
              color={activeTab === 'profile' ? COLORS.dark : COLORS.textMuted} />

          </View>

          <Text

            style={[

              styles.tabLabel,

              activeTab === 'profile' && styles.activeTabLabel,

            ]}

          >

            Profile

          </Text>

        </TouchableOpacity>

      </View>

    </SafeAreaView>

  );

};



/* =========================================================

   STYLES - WHITE & #7DC25B THEME

========================================================= */



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: COLORS.bg,

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
    marginBottom: 16,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },

  fontLoadingText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: COLORS.textPrimary,
    marginTop: 10,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 118,
  },



  /* HEADER */

  header: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: 20,

  },



  headerLeft: {

    flex: 1,

    marginRight: 12,

  },



  greeting: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },



  locationRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 8,

    maxWidth: 240,

  },



  locationDot: {
    marginRight: 4,
  },



  locationText: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 13,

    color: COLORS.textSecondary,

    fontWeight: '600',

  },



  headerIcons: {

    flexDirection: 'row',

    gap: 10,

  },



  iconCircleButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },



  headerIconText: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 18,

  },



  /* SEARCH */

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 17,
    paddingHorizontal: 15,
    height: 56,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },



  searchIcon: {
    marginRight: 9,
  },



  searchInput: {
    fontFamily: 'Poppins_500Medium',

    flex: 1,

    fontSize: 14,

    color: COLORS.textPrimary,

    fontWeight: '500',

  },



  /* BANNER */

  bannerContainer: {
    backgroundColor: COLORS.dark,
    borderRadius: 28,
    padding: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    overflow: 'hidden',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },



  bannerDecorCircle1: {

    position: 'absolute',

    top: -50,

    right: -50,

    width: 160,

    height: 160,

    borderRadius: 80,

    backgroundColor: 'rgba(255,255,255,0.12)',

  },



  bannerDecorCircle2: {

    position: 'absolute',

    bottom: -60,

    left: -40,

    width: 140,

    height: 140,

    borderRadius: 70,

    backgroundColor: 'rgba(255,255,255,0.08)',

  },



  bannerTextContent: {

    flex: 1,

    zIndex: 2,

  },



  bannerBadgeRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(199,243,107,0.12)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(199,243,107,0.22)',
  },



  bannerBadgeText: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.white,

    fontSize: 10,

    fontWeight: '900',

    letterSpacing: 1.5,

  },



  bannerTitle: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.white,

    fontSize: 21,

    fontWeight: '900',

    letterSpacing: 0.3,

    marginBottom: 6,

  },



  bannerSubText: {
    fontFamily: 'Poppins_500Medium',

    color: 'rgba(255,255,255,0.92)',

    fontSize: 13,

    fontWeight: '500',

    marginBottom: 18,

  },



  bannerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    paddingHorizontal: 17,
    paddingVertical: 11,
    alignSelf: 'flex-start',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },



  bannerButtonText: {
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.dark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },



  bannerEmojiCircle: {
    width: 82,
    height: 82,
    borderRadius: 28,
    backgroundColor: 'rgba(199,243,107,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(199,243,107,0.24)',
    transform: [{ rotate: '-8deg' }],
  },



  bannerBadgeEmoji: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 36,

  },



  /* SECTIONS */

  sectionContainer: {

    marginBottom: 28,

  },



  sectionHeaderRow: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    marginBottom: 16,

  },



  sectionHeaderTextContainer: {

    flex: 1,

  },



  sectionTitleRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 4,

  },



  sectionTitle: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 19,

    fontWeight: '800',

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



  priceModeText: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 11,

    color: COLORS.primaryDeep,

    marginTop: 4,

    fontWeight: '600',

  },



  viewAllButton: {

    paddingHorizontal: 14,

    paddingVertical: 8,

    borderRadius: 18,

    backgroundColor: COLORS.primarySoft,

    borderWidth: 1.5,

    borderColor: COLORS.borderLight,

    marginLeft: 10,

  },



  viewAllText: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 12,

    color: COLORS.primaryDeep,

    fontWeight: '800',

    letterSpacing: 0.5,

  },



  /* CATEGORIES */

  categoryScroll: {
    marginTop: 10,
    width: '100%',
  },

  categoryScrollContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 2,
    paddingRight: 16,
  },

  categoryCard: {
    width: 82,
    height: 100,
    marginRight: 10,
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  lastCategoryCard: {
    marginRight: 0,
  },

  activeCategoryCard: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.20,
    shadowRadius: 12,
    elevation: 5,
  },

  categoryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  activeCategoryIconWrapper: {
    backgroundColor: 'rgba(11,18,32,0.10)',
  },

  categoryIcon: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 22,
  },

  categoryText: {
    width: '100%',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10.5,
    lineHeight: 15,
    color: COLORS.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
    includeFontPadding: false,
  },

  activeCategoryText: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.primaryDarker,

    fontWeight: '900',

  },



  /* TURF HORIZONTAL LIST */

  turfListContent: {

    paddingRight: 4,

  },



  turfCardHorizontal: {

    width: 220,

    backgroundColor: COLORS.card,

    borderRadius: 20,

    marginRight: 14,

    borderWidth: 1,

    borderColor: COLORS.border,

    overflow: 'hidden',

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 6 },

    shadowOpacity: 0.06,

    shadowRadius: 12,

    elevation: 3,

  },



  /* TURF IMAGE */

  imageWrapper: {

    position: 'relative',

  },



  turfImageHorizontal: {

    width: '100%',

    height: 130,

  },



  imageOverlay: {

    position: 'absolute',

    bottom: 0,

    left: 0,

    right: 0,

    height: 60,

    // backgroundColor: 'rgba(0,0,0,0.15)',

  },



  imagePlaceholder: {

    width: '100%',

    height: 130,

    backgroundColor: COLORS.primarySoft,

    justifyContent: 'center',

    alignItems: 'center',

  },



  imagePlaceholderIcon: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 32,

    marginBottom: 4,

  },



  imagePlaceholderText: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 11,

    color: COLORS.textMuted,

  },



  /* PRICE PILL */

  pricePill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
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
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },



  /* DISTANCE BADGE */

  distanceBadgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  distanceInlineRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  cityRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  courtTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  distanceBadgeText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
    fontWeight: '900',

    color: COLORS.primaryDarker,

  },



  /* LIKE */

  likeHeartOverlay: {

    position: 'absolute',

    top: 10,

    right: 10,

    backgroundColor: 'rgba(255,255,255,0.95)',

    borderRadius: 18,

    width: 36,

    height: 36,

    justifyContent: 'center',

    alignItems: 'center',

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.15,

    shadowRadius: 4,

    elevation: 3,

  },



  heartIcon: {
    fontFamily: 'Poppins_700Bold',

    color: COLORS.textMuted,

    fontSize: 18,

    fontWeight: '700',

  },



  likedHeartIcon: {

    color: COLORS.danger,

  },



  /* TURF INFORMATION */

  turfInfoHorizontal: {

    padding: 14,

  },



  turfNameHorizontal: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 15,

    fontWeight: '800',

    color: COLORS.textPrimary,

    letterSpacing: 0.2,

  },



  turfCityHorizontal: {
    fontFamily: 'Poppins_500Medium',

    fontSize: 12,

    color: COLORS.textSecondary,

    marginTop: 5,

    fontWeight: '500',

  },



  turfMetaRow: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 10,

    gap: 8,

  },



  priceText: {
    fontFamily: 'Poppins_800ExtraBold',

    flex: 1,

    fontSize: 12,

    fontWeight: '800',

    color: COLORS.primaryDeep,

  },



  priceUnavailableText: {
    fontFamily: 'Poppins_400Regular',

    flex: 1,

    fontSize: 10,

    color: COLORS.textMuted,

  },



  courtBadge: {

    backgroundColor: COLORS.primarySoft,

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 10,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

  },



  courtText: {
    fontFamily: 'Poppins_700Bold',

    fontSize: 10,

    color: COLORS.primaryDeep,

    fontWeight: '700',

  },



  sportsText: {
    fontFamily: 'Poppins_600SemiBold',

    fontSize: 11,

    color: COLORS.textSecondary,

    marginTop: 10,

    fontWeight: '600',

  },



  noSportsText: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 10,

    color: COLORS.textMuted,

    marginTop: 10,

  },



  /* MORE NEARBY */

  moreNearbyContainer: {

    marginTop: 30,

  },



  moreNearbySubtitle: {
    fontFamily: 'Poppins_500Medium',

    fontSize: 12,

    color: COLORS.textMuted,

    marginTop: 0,

    marginBottom: 14,

    fontWeight: '500',

  },



  moreNearbyList: {

    gap: 12,

  },



  /* MORE TURF CARD */

  moreTurfCard: {

    width: '100%',

    minHeight: 112,

    backgroundColor: COLORS.card,

    borderRadius: 18,

    borderWidth: 1,

    borderColor: COLORS.border,

    flexDirection: 'row',

    overflow: 'hidden',

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 4 },

    shadowOpacity: 0.05,

    shadowRadius: 10,

    elevation: 2,

  },



  moreTurfImageWrapper: {

    width: 115,

    height: 112,

    position: 'relative',

  },



  moreTurfImage: {

    width: '100%',

    height: '100%',

  },



  moreTurfImagePlaceholder: {

    width: '100%',

    height: '100%',

    backgroundColor: COLORS.primarySoft,

    alignItems: 'center',

    justifyContent: 'center',

  },



  moreTurfPlaceholderIcon: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 30,

  },



  moreTurfLikeButton: {

    position: 'absolute',

    top: 8,

    right: 8,

    width: 30,

    height: 30,

    borderRadius: 15,

    backgroundColor: 'rgba(255,255,255,0.95)',

    alignItems: 'center',

    justifyContent: 'center',

    shadowColor: '#000',

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.12,

    shadowRadius: 3,

    elevation: 2,

  },



  moreTurfHeart: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 16,

    color: COLORS.textMuted,

    fontWeight: '800',

  },



  moreTurfInfo: {

    flex: 1,

    paddingHorizontal: 14,

    paddingVertical: 12,

    justifyContent: 'center',

  },



  moreTurfName: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 15,

    color: COLORS.textPrimary,

    fontWeight: '800',

  },



  moreTurfCity: {
    fontFamily: 'Poppins_500Medium',

    fontSize: 11,

    color: COLORS.textSecondary,

    marginTop: 4,

    fontWeight: '500',

  },



  moreTurfDistanceRow: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 8,

  },



  moreTurfDistance: {
    fontFamily: 'Poppins_800ExtraBold',

    flex: 1,

    fontSize: 10,

    color: COLORS.primaryDeep,

    fontWeight: '800',

  },



  moreTurfPrice: {
    fontFamily: 'Poppins_900Black',

    fontSize: 12,

    color: COLORS.primaryDeep,

    fontWeight: '900',

  },



  moreTurfMetaRow: {

    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 8,

  },



  moreTurfCourtBadge: {

    backgroundColor: COLORS.primarySoft,

    paddingHorizontal: 8,

    paddingVertical: 3,

    borderRadius: 8,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    marginRight: 8,

  },



  moreTurfCourtText: {
    fontFamily: 'Poppins_700Bold',

    fontSize: 9,

    color: COLORS.primaryDeep,

    fontWeight: '700',

  },



  moreTurfSports: {
    fontFamily: 'Poppins_600SemiBold',

    flex: 1,

    fontSize: 10,

    color: COLORS.textMuted,

    fontWeight: '600',

  },



  /* LOCATION NOTICE */

  locationNotice: {

    marginTop: 20,

    paddingHorizontal: 16,

    paddingVertical: 14,

    backgroundColor: COLORS.primarySoft,

    borderRadius: 16,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

    flexDirection: 'row',

    alignItems: 'center',

  },



  locationNoticeIcon: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 18,

    marginRight: 10,

  },



  locationNoticeText: {
    fontFamily: 'Poppins_500Medium',

    flex: 1,

    fontSize: 11,

    color: COLORS.textSecondary,

    lineHeight: 16,

    fontWeight: '500',

  },



  locationNoticeButton: {

    marginLeft: 10,

    backgroundColor: COLORS.primary,

    paddingHorizontal: 12,

    paddingVertical: 8,

    borderRadius: 14,

  },



  locationNoticeButtonText: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.white,

    fontSize: 9,

    fontWeight: '900',

  },



  /* LOADING */

  loadingContainer: {

    paddingVertical: 40,

    alignItems: 'center',

    justifyContent: 'center',

  },



  loadingText: {
    fontFamily: 'Poppins_600SemiBold',

    marginTop: 12,

    fontSize: 12,

    color: COLORS.textMuted,

    fontWeight: '600',

    letterSpacing: 0.3,

  },



  /* EMPTY */

  emptyContainer: {

    padding: 30,

    alignItems: 'center',

    backgroundColor: COLORS.primarySoft,

    borderRadius: 22,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

  },



  emptyIconWrapper: {

    width: 72,

    height: 72,

    borderRadius: 36,

    backgroundColor: COLORS.white,

    alignItems: 'center',

    justifyContent: 'center',

    marginBottom: 14,

    borderWidth: 1,

    borderColor: COLORS.borderLight,

  },



  emptyIcon: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 30,

  },



  emptyTitle: {
    fontFamily: 'Poppins_800ExtraBold',

    fontSize: 16,

    fontWeight: '800',

    color: COLORS.textPrimary,

    letterSpacing: 0.2,

  },



  emptyText: {
    fontFamily: 'Poppins_400Regular',

    color: COLORS.textMuted,

    fontSize: 12,

    marginTop: 8,

    textAlign: 'center',

    lineHeight: 18,

  },



  clearFilterButton: {
    marginTop: 18,
    backgroundColor: COLORS.dark,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 15,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },



  clearFilterButtonText: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.white,

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 1,

  },



  /* ERROR */

  errorContainer: {

    backgroundColor: COLORS.dangerSoft,

    borderRadius: 18,

    padding: 18,

    marginBottom: 14,

    alignItems: 'center',

    borderWidth: 1,

    borderColor: COLORS.dangerBorder,

  },



  errorEmoji: {
    fontFamily: 'Poppins_400Regular',

    fontSize: 24,

    marginBottom: 8,

  },



  errorText: {
    fontFamily: 'Poppins_500Medium',

    color: COLORS.dangerText,

    fontSize: 13,

    textAlign: 'center',

    marginBottom: 14,

    fontWeight: '500',

    lineHeight: 18,

  },



  retryButton: {

    backgroundColor: COLORS.danger,

    paddingHorizontal: 22,

    paddingVertical: 11,

    borderRadius: 24,

  },



  errorHint: {
    fontFamily: 'Poppins_400Regular',

    marginTop: 10,

    paddingHorizontal: 16,

    textAlign: 'center',

    color: COLORS.textMuted,

    fontSize: 10,

    lineHeight: 15,

  },



  retryButtonText: {
    fontFamily: 'Poppins_900Black',

    color: COLORS.white,

    fontSize: 11,

    fontWeight: '900',

    letterSpacing: 1,

  },



  /* BOTTOM NAVIGATION */

  bottomBarContainer: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    height: 74,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingBottom: 4,
    paddingTop: 5,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 14,
  },



  tabButton: {

    alignItems: 'center',

    justifyContent: 'center',

    minWidth: 60,

    flex: 1,

  },



  /* =====================================================

     ⭐ iPhone-style squircle tab icon wrapper

     - `borderCurve: 'continuous'` gives the iOS superellipse

       curve (same math as iOS app icons and tab bars).

     - On Android, it falls back to a normal rounded rect.

     - `overflow: 'hidden'` clips the lime fill cleanly

       to the squircle curve.

  ===================================================== */

  tabIconWrapper: {
    width: 46,
    height: 40,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },



  activeTabIconWrapper: {
    backgroundColor: COLORS.primary,
    borderCurve: 'continuous',
    overflow: 'hidden',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },



  tabIcon: {

    fontFamily: 'Poppins_400Regular',

    fontSize: 18,

  },



  activeTabIcon: {

    fontFamily: 'Poppins_400Regular',

    fontSize: 18,

  },



  tabLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
    letterSpacing: 0.1,
  },



  activeTabLabel: {
    fontFamily: 'Poppins_700Bold',
    color: COLORS.dark,
    fontWeight: '700',
  },

});