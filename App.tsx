import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AuthScreen from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import AddTurfScreen from './src/screens/AddTurfScreen';
import TurfDetailsScreen from './src/screens/TurfDetailsScreen';
import SlotScreen from './src/screens/SlotScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';

/* =========================================================
   TYPES
========================================================= */

export type UserRole = 'customer' | 'owner' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface TurfImage {
  url: string;
  isPrimary?: boolean;
}

export interface TurfCourt {
  _id?: string;
  id?: string;

  name?: string;
  courtName?: string;

  sport?: string;
  sports?: string[];

  pricePerHour?: number;

  hasNightPricing?: boolean;
  nightPricePerHour?: number;
  nightStartHour?: number;
  nightEndHour?: number;

  fullDayDiscountPercent?: number;

  status?: string;
}

export interface TurfOperatingHour {
  /*
   * Backend can use either:
   * day / openingTime / closingTime
   * OR
   * dayOfWeek / openTime / closeTime
   *
   * dayOfWeek is intentionally STRING because
   * TurfDetailsScreen expects values such as:
   * "Monday", "Tuesday", etc.
   */
  day?: string;
  dayOfWeek?: string;

  openingTime?: string;
  closingTime?: string;

  openTime?: string;
  closeTime?: string;

  isClosed?: boolean;
}

export interface TurfLocation {
  type?: 'Point';
  coordinates?: [number, number];
}

export interface Turf {
  _id?: string;
  id?: string;

  owner?: string | User;

  name?: string;
  description?: string;

  address?: string;
  city?: string;

  amenities?: string[];
  sports?: string[];

  pricePerHour?: number;

  images?: TurfImage[];

  courts?: TurfCourt[];

  operatingHours?: TurfOperatingHour[];

  openingTime?: string;
  closingTime?: string;

  location?: TurfLocation;

  status?: 'active' | 'inactive' | 'maintenance' | string;
}

export interface BookingSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  isNight?: boolean;
}

/* =========================================================
   BOOKING TYPES
========================================================= */

export interface BookingDateData {
  date: string;
  courtId: string;
  slots: BookingSlot[];
  totalAmount: number;
}

/* =========================================================
   NAVIGATION TYPES
========================================================= */

export type RootStackParamList = {
  Auth: undefined;

  Home: undefined;

  AddTurf: undefined;

  TurfDetails: {
    turf: Turf;
  };

  /*
   * IMPORTANT:
   * TurfDetailsScreen navigates to:
   *
   * navigation.navigate('Slot', { turf })
   *
   * Therefore Slot MUST exist here.
   */
  Slot: {
    turf: Turf;
    initialCourtId?: string;
    initialDate?: string;
  };

  Payment: {
    turf: Turf;
    court: TurfCourt;

    /*
     * Single-date booking support
     */
    date?: string;
    slots?: BookingSlot[];

    /*
     * Multi-date booking support
     */
    bookings?: BookingDateData[];
    dates?: string[];

    /*
     * Required payment summary
     */
    slotCount: number;
    totalAmount: number;

    /*
     * Optional discount information
     */
    originalTotal?: number;
    discountAmount?: number;
    discountPercent?: number;

    /*
     * Booking flags
     */
    isMultiDate?: boolean;
    isMultiSlot?: boolean;

    /*
     * IDs are kept available because your payment flow
     * may use them when creating the Cashfree order.
     */
    turfId?: string;
    courtId?: string;
  };

  AdminDashboard: undefined;
};

/* =========================================================
   NAVIGATION
========================================================= */

const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef =
  createNavigationContainerRef<RootStackParamList>();

/* =========================================================
   STORAGE
========================================================= */

const USER_STORAGE_KEY = '@user_data';

/* =========================================================
   APP
========================================================= */

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  /* =======================================================
     LOAD USER SESSION
  ======================================================= */

  const loadUserSession = async (): Promise<void> => {
    try {
      const storedUser = await AsyncStorage.getItem(
        USER_STORAGE_KEY,
      );

      if (!storedUser) {
        setCurrentUser(null);
        return;
      }

      const parsedUser: User = JSON.parse(storedUser);

      const validRole =
        parsedUser?.role === 'customer' ||
        parsedUser?.role === 'owner' ||
        parsedUser?.role === 'admin';

      if (parsedUser?._id && validRole) {
        setCurrentUser(parsedUser);
      } else {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error(
        'Failed to load user session:',
        error,
      );

      try {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup errors.
      }

      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /* =======================================================
     INITIAL SESSION CHECK
  ======================================================= */

  useEffect(() => {
    void loadUserSession();
  }, []);

  /* =======================================================
     AUTH SUCCESS
  ======================================================= */

  const handleAuthSuccess = async (
    user: User,
    isNewSignup: boolean = false,
  ): Promise<void> => {
    try {
      await AsyncStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(user),
      );

      setCurrentUser(user);

      /*
       * New owner -> directly open Add Turf.
       */
      if (isNewSignup && user.role === 'owner') {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('AddTurf');
          }
        }, 300);
      }
    } catch (error) {
      console.error(
        'Failed to save user session:',
        error,
      );
    }
  };

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(
        USER_STORAGE_KEY,
      );

      setCurrentUser(null);
    } catch (error) {
      console.error(
        'Failed to logout:',
        error,
      );
    }
  };

  /* =======================================================
     SELECT TURF
  ======================================================= */

  const handleSelectTurf = (
    turf: Turf,
  ): void => {
    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate(
      'TurfDetails',
      {
        turf,
      },
    );
  };

  /* =======================================================
     NAVIGATE TO ADD TURF
  ======================================================= */

  const handleNavigateToAddTurf = (): void => {
    if (
      !currentUser ||
      currentUser.role !== 'owner'
    ) {
      return;
    }

    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('AddTurf');
  };

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >

        {/* =================================================
            AUTH
        ================================================= */}

        {!currentUser ? (
          <Stack.Screen name="Auth">
            {(props) => (
              <AuthScreen
                {...props}
                onAuthSuccess={handleAuthSuccess}
              />
            )}
          </Stack.Screen>
        ) : currentUser.role === 'admin' ? (

          /* ===============================================
             ADMIN
          =============================================== */

          <Stack.Screen name="AdminDashboard">
            {(props) => (
              <AdminDashboardScreen
                {...props}
                user={currentUser}
                onLogout={handleLogout}
              />
            )}
          </Stack.Screen>

        ) : (

          /* ===============================================
             CUSTOMER / OWNER
          =============================================== */

          <>
            {/* ===========================================
                HOME
            =========================================== */}

            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen
                  {...props}
                  user={currentUser}
                  onLogout={handleLogout}
                  onNavigateToAddTurf={
                    handleNavigateToAddTurf
                  }
                  onSelectTurf={
                    handleSelectTurf
                  }
                />
              )}
            </Stack.Screen>

            {/* ===========================================
                TURF DETAILS
            =========================================== */}

            <Stack.Screen name="TurfDetails">
              {(props) => (
                <TurfDetailsScreen
                  {...props}
                />
              )}
            </Stack.Screen>

            {/* ===========================================
                SLOT SCREEN

                IMPORTANT:
                This fixes:

                The action 'NAVIGATE' with payload
                {"name":"Slot",...}
                was not handled by any navigator.

                TurfDetailsScreen calls:

                navigation.navigate('Slot', { turf })

                Therefore this screen MUST be
                registered here.
            =========================================== */}

            <Stack.Screen name="Slot">
              {(props) => (
                <SlotScreen
                  {...props}
                />
              )}
            </Stack.Screen>

            {/* ===========================================
                PAYMENT
            =========================================== */}

            <Stack.Screen name="Payment">
              {(props) => (
                <PaymentScreen
                  {...props}
                />
              )}
            </Stack.Screen>

            {/* ===========================================
                ADD TURF
                OWNER ONLY
            =========================================== */}

            {currentUser.role === 'owner' && (
              <Stack.Screen name="AddTurf">
                {(props) => (
                  <AddTurfScreen
                    {...props}
                    user={currentUser}
                  />
                )}
              </Stack.Screen>
            )}
          </>
        )}

      </Stack.Navigator>
    </NavigationContainer>
  );
};

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

/* =========================================================
   EXPORT
========================================================= */

export default App;
