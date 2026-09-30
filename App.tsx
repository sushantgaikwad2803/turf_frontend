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
  sport?: string;
  sports?: string[];
  pricePerHour?: number;
  hasNightPricing?: boolean;
  nightPricePerHour?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  status?: string;
}

export interface TurfOperatingHour {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
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
  location?: TurfLocation;
  status?: 'active' | 'inactive' | 'maintenance';
}

export interface BookingSlot {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  isNight?: boolean;
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

  Payment: {
    turf: Turf;
    court: TurfCourt;
    date: string;
    slots: BookingSlot[];
    slotCount: number;
    totalAmount: number;
  };

  AdminDashboard: undefined;
};

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

  useEffect(() => {
    void loadUserSession();
  }, []);

  const loadUserSession = async (): Promise<void> => {
    try {
      const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);

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
      console.error('Failed to load user session:', error);

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

      if (isNewSignup && user.role === 'owner') {
        setTimeout(() => {
          if (navigationRef.isReady()) {
            navigationRef.navigate('AddTurf');
          }
        }, 300);
      }
    } catch (error) {
      console.error('Failed to save user session:', error);
    }
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setCurrentUser(null);
    } catch (error) {
      console.error('Failed to logout:', error);
    }
  };

  const handleSelectTurf = (turf: Turf): void => {
    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('TurfDetails', { turf });
  };

  const handleNavigateToAddTurf = (): void => {
    if (!currentUser || currentUser.role !== 'owner') {
      return;
    }

    if (!navigationRef.isReady()) {
      return;
    }

    navigationRef.navigate('AddTurf');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
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
          <>
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen
                  {...props}
                  user={currentUser}
                  onLogout={handleLogout}
                  onNavigateToAddTurf={handleNavigateToAddTurf}
                  onSelectTurf={handleSelectTurf}
                />
              )}
            </Stack.Screen>

            <Stack.Screen name="TurfDetails">
              {(props) => (
                <TurfDetailsScreen {...props} />
              )}
            </Stack.Screen>

            <Stack.Screen name="Payment">
              {(props) => (
                <PaymentScreen {...props} />
              )}
            </Stack.Screen>

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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});

export default App;
