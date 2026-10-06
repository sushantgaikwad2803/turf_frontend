import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
   API
========================================================= */

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '')
  .trim()
  .replace(/\/+$/, '');

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
  placeholder: '#8A92A3',

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
  black: '#000000',
  dark: '#0B1220',
  overlay: 'rgba(11,18,32,0.52)',
};

/* =========================================================
   TYPES
========================================================= */

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'owner' | 'admin';
}

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
}

export interface OperatingHour {
  day: string;
  openingTime: string;
  closingTime: string;
  isClosed: boolean;
}

export interface Court {
  _id: string;
  turf: string;
  name: string;
  sport: string;
  pricePerHour: number;
  hasNightPricing: boolean;
  nightPricePerHour?: number;
  nightStartHour?: number;
  nightEndHour?: number;
  fullDayDiscountPercent?: number;
  status: 'active' | 'inactive' | 'maintenance';
}

export interface Turf {
  _id: string;
  owner: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  status?: 'active' | 'inactive' | 'maintenance';
  operatingHours?: OperatingHour[];
  location?: {
    type: string;
    coordinates: [number, number];
  };
  images?: Array<{
    url: string;
    isPrimary?: boolean;
  }>;
}

export interface RecentBooking {
  _id: string;
  customer: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  } | null;
  turf: {
    _id: string;
    name: string;
    city?: string;
  } | null;
  court: {
    _id: string;
    name: string;
    sport?: string;
  } | null;
  slot: {
    startTime?: string;
    endTime?: string;
    price?: number;
  } | null;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  grossAmount?: number;
  discountAmount?: number;
  finalAmount?: number;
  status?: string;
  createdAt?: string;
}

interface OwnerProfileScreenProps {
  user: User;
  onUpdateUser?: (updatedUser: User) => void;
  onLogout?: () => void;
  onNavigateToAddTurf?: () => void;
}

/* =========================================================
   DEFAULT HOURS
========================================================= */

const DEFAULT_OPERATING_HOURS: OperatingHour[] = [
  { day: 'Monday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Tuesday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Wednesday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Thursday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Friday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Saturday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
  { day: 'Sunday', openingTime: '06:00', closingTime: '23:00', isClosed: false },
];

/* =========================================================
   HELPERS
========================================================= */

const cloneDefaultHours = (): OperatingHour[] =>
  DEFAULT_OPERATING_HOURS.map((item) => ({ ...item }));

const getErrorMessage = (
  error: unknown,
  fallback = 'Something went wrong.',
): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
};

const buildApiUrl = (path: string): string => {
  if (!API_BASE_URL) {
    throw new Error(
      'API URL is not configured. Please add EXPO_PUBLIC_API_URL to your .env file.',
    );
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
};

const parseApiResponse = async (response: Response): Promise<any> => {
  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`,
    );
  }
  return data;
};

const timeStringToDate = (time: string): Date => {
  const [hours, minutes] = String(time || '')
    .split(':')
    .map(Number);
  const date = new Date();
  date.setHours(
    Number.isNaN(hours) ? 6 : hours,
    Number.isNaN(minutes) ? 0 : minutes,
    0,
    0,
  );
  return date;
};

const dateToTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const hourToTimeString = (hour?: number): string => {
  const safeHour =
    typeof hour === 'number' && hour >= 0 && hour <= 23 ? hour : 18;
  return `${String(safeHour).padStart(2, '0')}:00`;
};

const timeStringToHour = (time: string): number => {
  const [hours] = String(time || '')
    .split(':')
    .map(Number);
  return Number.isNaN(hours) ? 0 : hours;
};

const formatHour = (hour?: number): string => {
  if (typeof hour !== 'number' || hour < 0 || hour > 23) return '--:--';
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:00 ${suffix}`;
};

const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber) return 'Not added';
  if (accountNumber.length <= 4) return accountNumber;
  return `•••• •••• ${accountNumber.slice(-4)}`;
};

const getTurfStatusColors = (status?: string) => {
  const cleanStatus = String(status || 'active').toLowerCase();
  switch (cleanStatus) {
    case 'active':
      return {
        bg: COLORS.primarySoft,
        border: COLORS.borderSoft,
        text: COLORS.primaryDarker,
        dot: COLORS.primaryDeep,
      };
    case 'maintenance':
      return {
        bg: COLORS.warningSoft,
        border: COLORS.warningBorder,
        text: COLORS.warningText,
        dot: COLORS.warning,
      };
    case 'inactive':
    default:
      return {
        bg: COLORS.cardSoft,
        border: COLORS.border,
        text: COLORS.textMuted,
        dot: COLORS.textMuted,
      };
  }
};

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const normalizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

const formatBookingDate = (date?: string): string => {
  if (!date) return 'Date not available';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatBookingTime = (time?: string): string => {
  if (!time) return '--';
  const match = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(hours) || hours < 0 || hours > 23) return time;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes} ${suffix}`;
};

const getBookingStatusColors = (status?: string) => {
  const cleanStatus = String(status || 'confirmed').toLowerCase();

  if (cleanStatus === 'cancelled' || cleanStatus === 'canceled') {
    return {
      bg: COLORS.dangerSoft,
      border: COLORS.dangerBorder,
      text: COLORS.dangerText,
    };
  }

  if (cleanStatus === 'pending' || cleanStatus === 'reserved') {
    return {
      bg: COLORS.warningSoft,
      border: COLORS.warningBorder,
      text: COLORS.warningText,
    };
  }

  if (cleanStatus === 'completed') {
    return {
      bg: COLORS.infoSoft,
      border: '#BFDBFE',
      text: '#1D4ED8',
    };
  }

  return {
    bg: COLORS.primarySoft,
    border: COLORS.borderSoft,
    text: COLORS.primaryDarker,
  };
};

/* =========================================================
   COMPONENT
========================================================= */

export const OwnerProfileScreen: React.FC<OwnerProfileScreenProps> = ({
  user,
  onUpdateUser,
  onLogout,
  onNavigateToAddTurf,
}) => {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  /* MODALS */
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showTurfModal, setShowTurfModal] = useState(false);
  const [showCourtModal, setShowCourtModal] = useState(false);

  /* PROFILE */
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  /* BANK */
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });

  /* TURF FORM */
  const [turfName, setTurfName] = useState('');
  const [turfDescription, setTurfDescription] = useState('');
  const [turfAddress, setTurfAddress] = useState('');
  const [turfCity, setTurfCity] = useState('');

  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>(
    cloneDefaultHours(),
  );

  /* COURT FORM */
  const [courtName, setCourtName] = useState('');
  const [courtSport, setCourtSport] = useState('');
  const [courtPrice, setCourtPrice] = useState('');
  const [courtFullDayDiscountPercent, setCourtFullDayDiscountPercent] =
    useState('4');
  const [courtHasNightPricing, setCourtHasNightPricing] = useState(false);
  const [courtNightPrice, setCourtNightPrice] = useState('');
  const [courtNightStartTime, setCourtNightStartTime] = useState('18:00');
  const [courtNightEndTime, setCourtNightEndTime] = useState('23:00');

  /* DATA */
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfCourts, setTurfCourts] = useState<Record<string, Court[]>>({});
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [fetchingBookings, setFetchingBookings] = useState(false);

  const [expandedTurfId, setExpandedTurfId] = useState<string | null>(null);

  const [selectedTurfId, setSelectedTurfId] = useState<string | null>(null);
  const [selectedTurf, setSelectedTurf] = useState<Turf | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);

  /* TIME PICKERS */
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'opening' | 'closing'>(
    'opening',
  );
  const [selectedHourIndex, setSelectedHourIndex] = useState<number | null>(
    null,
  );

  const [showCourtTimePicker, setShowCourtTimePicker] = useState(false);
  const [courtTimePickerMode, setCourtTimePickerMode] = useState<
    'nightStart' | 'nightEnd'
  >('nightStart');

  /* LOADING */
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [user.name, user.email, user.phone]);

  const fetchTurfs = useCallback(async () => {
    const response = await fetch(
      buildApiUrl(`/owners/${encodeURIComponent(user._id)}/turfs`),
    );
    const data = await parseApiResponse(response);
    const ownerTurfs = Array.isArray(data?.turfs)
      ? data.turfs
      : Array.isArray(data)
        ? data
        : [];
    if (mountedRef.current) setTurfs(ownerTurfs);
    return ownerTurfs;
  }, [user._id]);

  const fetchBankDetails = useCallback(async () => {
    const response = await fetch(
      buildApiUrl(`/owners/${encodeURIComponent(user._id)}/bank-details`),
    );
    const data = await parseApiResponse(response);
    if (!mountedRef.current) return;
    if (data) {
      setBankDetails({
        accountHolderName: data.accountHolderName || '',
        accountNumber: data.accountNumber || '',
        ifscCode: data.ifscCode || '',
      });
    } else {
      setBankDetails({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
      });
    }
  }, [user._id]);

  const fetchRecentBookings = useCallback(async () => {
    try {
      setFetchingBookings(true);
      const response = await fetch(
        buildApiUrl(`/owners/${encodeURIComponent(user._id)}/dashboard`),
      );
      const data = await parseApiResponse(response);
      const bookings = Array.isArray(data?.recentBookings)
        ? data.recentBookings
        : [];
      if (mountedRef.current) setRecentBookings(bookings);
    } catch (error) {
      console.error('Failed to fetch recent bookings:', error);
      if (mountedRef.current) setRecentBookings([]);
    } finally {
      if (mountedRef.current) setFetchingBookings(false);
    }
  }, [user._id]);

  const fetchOwnerData = useCallback(async () => {
    try {
      setFetchingData(true);
      const results = await Promise.allSettled([
        fetchTurfs(),
        fetchBankDetails(),
        fetchRecentBookings(),
      ]);
      const failedRequests = results.filter(
        (result) => result.status === 'rejected',
      );
      if (failedRequests.length > 0) {
        const firstError = failedRequests[0];
        if (firstError.status === 'rejected') {
          console.error('Owner data request failed:', firstError.reason);
        }
      }
    } catch (error) {
      console.error('Failed to fetch owner data:', error);
      if (mountedRef.current) {
        Alert.alert(
          'Connection Error',
          getErrorMessage(error, 'Unable to load your owner data.'),
        );
      }
    } finally {
      if (mountedRef.current) setFetchingData(false);
    }
  }, [fetchTurfs, fetchBankDetails, fetchRecentBookings]);

  useEffect(() => {
    fetchOwnerData();
  }, [fetchOwnerData]);

  const fetchCourts = useCallback(async (turfId: string) => {
    try {
      const response = await fetch(
        buildApiUrl(`/turfs/${encodeURIComponent(turfId)}/courts`),
      );
      const data = await parseApiResponse(response);
      const courts = Array.isArray(data?.courts)
        ? data.courts
        : Array.isArray(data)
          ? data
          : [];
      if (mountedRef.current) {
        setTurfCourts((previous) => ({ ...previous, [turfId]: courts }));
      }
      return courts;
    } catch (error) {
      console.error('Failed to fetch courts:', error);
      Alert.alert(
        'Unable to Load Courts',
        getErrorMessage(error, 'Failed to load courts for this turf.'),
      );
      return [];
    }
  }, []);

  const handleToggleTurf = async (turfId: string) => {
    if (expandedTurfId === turfId) {
      setExpandedTurfId(null);
      return;
    }
    setExpandedTurfId(turfId);
    await fetchCourts(turfId);
  };

  const handleUpdateProfile = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      Alert.alert('Missing Information', 'Please fill in all profile fields.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    const cleanPhone = normalizePhone(trimmedPhone);
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/users/${encodeURIComponent(user._id)}`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
          }),
        },
      );
      const data = await parseApiResponse(response);
      const updatedUser = data?.user || data;
      if (updatedUser && mountedRef.current) onUpdateUser?.(updatedUser);
      setShowEditProfile(false);
      Alert.alert('Profile Updated', 'Your profile has been updated successfully.');
    } catch (error) {
      Alert.alert(
        'Update Failed',
        getErrorMessage(error, 'Failed to update profile.'),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const current = currentPassword.trim();
    const next = newPassword.trim();

    if (!current || !next) {
      Alert.alert(
        'Missing Password',
        'Please enter your current and new password.',
      );
      return;
    }
    if (next.length < 6) {
      Alert.alert(
        'Invalid Password',
        'New password must contain at least 6 characters.',
      );
      return;
    }
    if (current === next) {
      Alert.alert(
        'Invalid Password',
        'New password must be different from your current password.',
      );
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/users/${encodeURIComponent(user._id)}/password`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: current,
            newPassword: next,
          }),
        },
      );
      await parseApiResponse(response);
      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordModal(false);
      Alert.alert(
        'Password Changed',
        'Your password has been changed successfully.',
      );
    } catch (error) {
      Alert.alert(
        'Password Change Failed',
        getErrorMessage(error, 'Failed to change password.'),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleAddTurf = () => {
    if (onNavigateToAddTurf) {
      onNavigateToAddTurf();
      return;
    }
    Alert.alert('Navigation Error', 'Add Turf navigation is not configured.');
  };

  const handleEditTurf = (turf: Turf) => {
    setSelectedTurf(turf);
    setTurfName(turf.name || '');
    setTurfDescription(turf.description || '');
    setTurfAddress(turf.address || '');
    setTurfCity(turf.city || '');

    if (turf.operatingHours?.length) {
      setOperatingHours(
        DEFAULT_OPERATING_HOURS.map((defaultHour) => {
          const existingHour = turf.operatingHours?.find(
            (hour) => hour.day.toLowerCase() === defaultHour.day.toLowerCase(),
          );
          if (!existingHour) return { ...defaultHour };
          return {
            day: defaultHour.day,
            openingTime: existingHour.openingTime || defaultHour.openingTime,
            closingTime: existingHour.closingTime || defaultHour.closingTime,
            isClosed: existingHour.isClosed ?? defaultHour.isClosed,
          };
        }),
      );
    } else {
      setOperatingHours(cloneDefaultHours());
    }
    setShowTurfModal(true);
  };

  const updateOperatingHour = (
    index: number,
    field: keyof OperatingHour,
    value: string | boolean,
  ) => {
    setOperatingHours((previous) =>
      previous.map((hour, hourIndex) => {
        if (hourIndex !== index) return hour;
        return { ...hour, [field]: value };
      }),
    );
  };

  const openTimePicker = (index: number, mode: 'opening' | 'closing') => {
    setSelectedHourIndex(index);
    setTimePickerMode(mode);
    setShowTimePicker(true);
  };

  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (
      event?.type === 'dismissed' ||
      !selectedDate ||
      selectedHourIndex === null
    ) {
      setSelectedHourIndex(null);
      return;
    }
    const newTime = dateToTimeString(selectedDate);
    const field = timePickerMode === 'opening' ? 'openingTime' : 'closingTime';
    updateOperatingHour(selectedHourIndex, field, newTime);
    setSelectedHourIndex(null);
  };

  const handleSaveTurf = async () => {
    const cleanName = turfName.trim();
    const cleanDescription = turfDescription.trim();
    const cleanAddress = turfAddress.trim();
    const cleanCity = turfCity.trim();

    if (!cleanName || !cleanAddress || !cleanCity) {
      Alert.alert(
        'Missing Information',
        'Please fill in turf name, address and city.',
      );
      return;
    }

    for (const hour of operatingHours) {
      if (hour.isClosed) continue;
      if (!hour.openingTime || !hour.closingTime) {
        Alert.alert(
          'Invalid Hours',
          `Please select opening and closing time for ${hour.day}.`,
        );
        return;
      }
      const opening = timeStringToDate(hour.openingTime).getTime();
      const closing = timeStringToDate(hour.closingTime).getTime();
      if (opening >= closing) {
        Alert.alert(
          'Invalid Hours',
          `Closing time must be later than opening time on ${hour.day}.`,
        );
        return;
      }
    }

    try {
      setLoading(true);
      const isEditing = Boolean(selectedTurf);
      const url = isEditing
        ? buildApiUrl(`/turfs/${encodeURIComponent(selectedTurf!._id)}`)
        : buildApiUrl('/turfs');
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: user._id,
          name: cleanName,
          description: cleanDescription,
          address: cleanAddress,
          city: cleanCity,
          operatingHours,
        }),
      });
      await parseApiResponse(response);
      closeTurfModal();
      await fetchTurfs();
      Alert.alert(
        'Success',
        isEditing ? 'Turf updated successfully.' : 'Turf added successfully.',
      );
    } catch (error) {
      Alert.alert('Save Failed', getErrorMessage(error, 'Failed to save turf.'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const closeTurfModal = () => {
    setShowTurfModal(false);
    setSelectedTurf(null);
    setTurfName('');
    setTurfDescription('');
    setTurfAddress('');
    setTurfCity('');
    setOperatingHours(cloneDefaultHours());
  };

  const handleDeleteTurf = (turf: Turf) => {
    const courtCount = turfCourts[turf._id]?.length;
    const courtMessage =
      typeof courtCount === 'number'
        ? `\n\nThis turf currently has ${courtCount} court${
            courtCount === 1 ? '' : 's'
          }.`
        : '';

    Alert.alert(
      'Delete Turf',
      `Are you sure you want to permanently delete "${turf.name}"?${courtMessage}\n\nAll courts belonging to this turf will also be deleted.\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Turf',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await fetch(
                buildApiUrl(`/turfs/${encodeURIComponent(turf._id)}`),
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                },
              );
              const data = await parseApiResponse(response);
              if (!mountedRef.current) return;

              setTurfs((previous) =>
                previous.filter((item) => item._id !== turf._id),
              );
              setTurfCourts((previous) => {
                const updated = { ...previous };
                delete updated[turf._id];
                return updated;
              });
              if (expandedTurfId === turf._id) setExpandedTurfId(null);
              if (selectedTurf?._id === turf._id) closeTurfModal();

              Alert.alert(
                'Turf Deleted',
                data?.message ||
                  'Turf and all its courts were deleted successfully.',
              );
            } catch (error) {
              console.error('Delete turf error:', error);
              Alert.alert(
                'Delete Failed',
                getErrorMessage(error, 'Failed to delete turf.'),
              );
            } finally {
              if (mountedRef.current) setLoading(false);
            }
          },
        },
      ],
    );
  };

  const resetCourtForm = () => {
    setCourtName('');
    setCourtSport('');
    setCourtPrice('');
    setCourtFullDayDiscountPercent('4');
    setCourtHasNightPricing(false);
    setCourtNightPrice('');
    setCourtNightStartTime('18:00');
    setCourtNightEndTime('23:00');
    setSelectedCourt(null);
  };

  const handleAddCourt = (turfId: string) => {
    setSelectedTurfId(turfId);
    resetCourtForm();
    setShowCourtModal(true);
  };

  const handleEditCourt = (turfId: string, court: Court) => {
    setSelectedTurfId(turfId);
    setSelectedCourt(court);
    setCourtName(court.name || '');
    setCourtSport(court.sport || '');
    setCourtPrice(
      court.pricePerHour !== undefined ? String(court.pricePerHour) : '',
    );
    setCourtFullDayDiscountPercent(
      court.fullDayDiscountPercent !== undefined
        ? String(court.fullDayDiscountPercent)
        : '4',
    );
    setCourtHasNightPricing(Boolean(court.hasNightPricing));
    setCourtNightPrice(
      court.nightPricePerHour !== undefined
        ? String(court.nightPricePerHour)
        : '',
    );
    setCourtNightStartTime(hourToTimeString(court.nightStartHour));
    setCourtNightEndTime(hourToTimeString(court.nightEndHour));
    setShowCourtModal(true);
  };

  const openCourtTimePicker = (mode: 'nightStart' | 'nightEnd') => {
    setCourtTimePickerMode(mode);
    setShowCourtTimePicker(true);
  };

  const handleCourtTimeChange = (event: any, selectedDate?: Date) => {
    setShowCourtTimePicker(false);
    if (event?.type === 'dismissed' || !selectedDate) return;
    const selectedTime = dateToTimeString(selectedDate);
    if (courtTimePickerMode === 'nightStart') {
      setCourtNightStartTime(selectedTime);
    } else {
      setCourtNightEndTime(selectedTime);
    }
  };

  const handleSaveCourt = async () => {
    if (
      !selectedTurfId ||
      !courtName.trim() ||
      !courtSport.trim() ||
      !courtPrice.trim()
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill all required court fields.',
      );
      return;
    }

    const price = Number(courtPrice);
    if (!Number.isFinite(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Base price must be greater than ₹0.');
      return;
    }

    const fullDayDiscountPercent = Number(
      courtFullDayDiscountPercent.trim(),
    );
    if (
      !Number.isFinite(fullDayDiscountPercent) ||
      fullDayDiscountPercent < 0 ||
      fullDayDiscountPercent > 100
    ) {
      Alert.alert(
        'Invalid Full Day Discount',
        'Full Day discount must be between 0% and 100%.',
      );
      return;
    }

    let nightPrice: number | undefined;
    let nightStartHour: number | undefined;
    let nightEndHour: number | undefined;

    if (courtHasNightPricing) {
      if (!courtNightPrice.trim()) {
        Alert.alert(
          'Night Pricing',
          'Please enter the night price per hour.',
        );
        return;
      }
      nightPrice = Number(courtNightPrice);
      if (!Number.isFinite(nightPrice) || nightPrice <= 0) {
        Alert.alert(
          'Invalid Night Price',
          'Night price must be greater than ₹0.',
        );
        return;
      }
      nightStartHour = timeStringToHour(courtNightStartTime);
      nightEndHour = timeStringToHour(courtNightEndTime);
      if (nightStartHour === nightEndHour) {
        Alert.alert(
          'Invalid Night Hours',
          'Night start and end time cannot be the same.',
        );
        return;
      }
    }

    try {
      setLoading(true);
      const isEditing = Boolean(selectedCourt);
      const url = isEditing
        ? buildApiUrl(`/courts/${encodeURIComponent(selectedCourt!._id)}`)
        : buildApiUrl('/courts');
      const payload = {
        turf: selectedTurfId,
        name: courtName.trim(),
        sport: courtSport.trim(),
        pricePerHour: price,
        fullDayDiscountPercent,
        hasNightPricing: courtHasNightPricing,
        ...(courtHasNightPricing
          ? { nightPricePerHour: nightPrice, nightStartHour, nightEndHour }
          : {}),
      };
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await parseApiResponse(response);
      setShowCourtModal(false);
      await fetchCourts(selectedTurfId);
      resetCourtForm();
      Alert.alert(
        'Success',
        isEditing ? 'Court updated successfully.' : 'Court added successfully.',
      );
    } catch (error) {
      Alert.alert('Save Failed', getErrorMessage(error, 'Failed to save court.'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDeleteCourt = (turfId: string, court: Court) => {
    Alert.alert(
      'Delete Court',
      `Are you sure you want to delete "${court.name}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await fetch(
                buildApiUrl(`/courts/${encodeURIComponent(court._id)}`),
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                },
              );
              const data = await parseApiResponse(response);
              if (!mountedRef.current) return;
              setTurfCourts((previous) => ({
                ...previous,
                [turfId]: (previous[turfId] || []).filter(
                  (item) => item._id !== court._id,
                ),
              }));
              if (selectedCourt?._id === court._id) {
                setSelectedCourt(null);
                setShowCourtModal(false);
              }
              Alert.alert(
                'Court Deleted',
                data?.message || 'Court deleted successfully.',
              );
            } catch (error) {
              Alert.alert(
                'Delete Failed',
                getErrorMessage(error, 'Failed to delete court.'),
              );
            } finally {
              if (mountedRef.current) setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleSaveBankDetails = async () => {
    const holder = bankDetails.accountHolderName.trim();
    const account = bankDetails.accountNumber.trim();
    const ifsc = bankDetails.ifscCode.trim().toUpperCase();

    if (!holder || !account || !ifsc) {
      Alert.alert('Missing Information', 'Please fill all bank details.');
      return;
    }
    if (account.length < 6) {
      Alert.alert(
        'Invalid Account Number',
        'Please enter a valid bank account number.',
      );
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
      Alert.alert('Invalid IFSC', 'Please enter a valid IFSC code.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/owners/${encodeURIComponent(user._id)}/bank-details`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountHolderName: holder,
            accountNumber: account,
            ifscCode: ifsc,
          }),
        },
      );
      await parseApiResponse(response);
      setShowBankModal(false);
      await fetchBankDetails();
      Alert.alert(
        'Bank Details Saved',
        'Your payout bank details have been saved successfully.',
      );
    } catch (error) {
      Alert.alert(
        'Save Failed',
        getErrorMessage(error, 'Failed to save bank details.'),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDeleteBankDetails = () => {
    if (!bankDetails.accountHolderName) return;

    Alert.alert(
      'Delete Bank Details',
      'Are you sure you want to remove your payout bank account details?\n\nYou can add them again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await fetch(
                buildApiUrl(
                  `/owners/${encodeURIComponent(user._id)}/bank-details`,
                ),
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                },
              );
              const data = await parseApiResponse(response);
              if (!mountedRef.current) return;
              setBankDetails({
                accountHolderName: '',
                accountNumber: '',
                ifscCode: '',
              });
              setShowBankModal(false);
              Alert.alert(
                'Bank Details Deleted',
                data?.message || 'Bank details deleted successfully.',
              );
            } catch (error) {
              Alert.alert(
                'Delete Failed',
                getErrorMessage(error, 'Failed to delete bank details.'),
              );
            } finally {
              if (mountedRef.current) setLoading(false);
            }
          },
        },
      ],
    );
  };

  const performDeleteOwnerAccount = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        buildApiUrl(`/owners/${encodeURIComponent(user._id)}/account`),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const data = await parseApiResponse(response);
      if (!mountedRef.current) return;
      setTurfs([]);
      setTurfCourts({});
      setBankDetails({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
      });
      Alert.alert(
        'Account Deleted',
        data?.message ||
          'Your owner account and associated turf data have been deleted.',
        [{ text: 'OK', onPress: () => onLogout?.() }],
      );
    } catch (error) {
      Alert.alert(
        'Account Deletion Failed',
        getErrorMessage(error, 'Failed to delete your owner account.'),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleDeleteOwnerAccount = () => {
    Alert.alert(
      'Delete Owner Account',
      `This will permanently delete:\n\n• Your owner account\n• All your turfs\n• All courts belonging to those turfs\n• Your bank details\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              `Are you absolutely sure you want to permanently delete "${user.name}"'s owner account?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'YES, DELETE ACCOUNT',
                  style: 'destructive',
                  onPress: performDeleteOwnerAccount,
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  /* FONT LOADING */
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderBadge}>🏟️ OWNER</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Manage your turfs, courts and payouts
          </Text>
        </View>

        {/* COMPACT PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatarWrapper}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0)?.toUpperCase() || 'O'}
                </Text>
              </View>
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>🏆</Text>
              </View>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name || 'Owner'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email || 'No email added'}
              </Text>

              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>TURF OWNER</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user.phone || 'Not added'}</Text>
          </View>

          {/* Side-by-side compact buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowEditProfile(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={14} color={COLORS.dark} />
              <Text style={styles.primaryButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowPasswordModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={COLORS.textPrimary}
              />
              <Text style={styles.secondaryButtonText}>Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TURFS HEADER */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>My Listed Turfs</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddTurf}
            activeOpacity={0.85}
          >
            <Text style={styles.addButtonText}>+ ADD TURF</Text>
          </TouchableOpacity>
        </View>

        {fetchingData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primaryDeep} />
            <Text style={styles.loadingText}>Loading your turfs...</Text>
          </View>
        ) : turfs.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrapper}>
              <Text style={styles.emptyIcon}>🏟️</Text>
            </View>
            <Text style={styles.emptyTitle}>No turfs listed</Text>
            <Text style={styles.emptyText}>
              Add your first turf to start accepting bookings.
            </Text>
            <TouchableOpacity
              style={styles.primaryButtonFull}
              onPress={handleAddTurf}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonFullText}>
                ADD YOUR FIRST TURF
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          turfs.map((turf) => {
            const courts = turfCourts[turf._id] || [];
            const isExpanded = expandedTurfId === turf._id;
            const statusColors = getTurfStatusColors(turf.status);
            const imageUrl =
              turf.images?.find((image) => image.isPrimary)?.url ||
              turf.images?.[0]?.url;

            return (
              <View key={turf._id} style={styles.turfCard}>
                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.turfImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderIcon}>⚽</Text>
                    <Text style={styles.placeholderText}>No Image</Text>
                  </View>
                )}

                <View
                  style={[
                    styles.turfStatusPill,
                    {
                      backgroundColor: statusColors.bg,
                      borderColor: statusColors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColors.dot },
                    ]}
                  />
                  <Text
                    style={[styles.turfStatusText, { color: statusColors.text }]}
                  >
                    {String(turf.status || 'active').toUpperCase()}
                  </Text>
                </View>

                <View style={styles.turfContent}>
                  <Text style={styles.turfName} numberOfLines={2}>
                    {turf.name}
                  </Text>
                  <Text style={styles.turfCity}>📍 {turf.city}</Text>
                  <Text style={styles.turfAddress} numberOfLines={3}>
                    {turf.address}
                  </Text>

                  <View style={styles.turfActionGrid}>
                    <TouchableOpacity
                      style={styles.manageButton}
                      onPress={() => handleToggleTurf(turf._id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.manageButtonText}>
                        {isExpanded ? 'HIDE COURTS' : 'MANAGE COURTS'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => handleEditTurf(turf)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.editButtonText}>EDIT</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteTurfButton}
                      onPress={() => handleDeleteTurf(turf)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.deleteTurfButtonText}>DELETE</Text>
                    </TouchableOpacity>
                  </View>

                  {isExpanded && (
                    <View style={styles.courtsContainer}>
                      <View style={styles.courtHeader}>
                        <Text style={styles.courtTitle}>Courts</Text>
                        <TouchableOpacity
                          onPress={() => handleAddCourt(turf._id)}
                          activeOpacity={0.8}
                          style={styles.addCourtButton}
                        >
                          <Text style={styles.addCourtText}>+ Add Court</Text>
                        </TouchableOpacity>
                      </View>

                      {courts.length === 0 ? (
                        <View style={styles.noCourtsBox}>
                          <Text style={styles.noCourtsIcon}>🏟️</Text>
                          <Text style={styles.noCourtText}>
                            No courts added yet.
                          </Text>
                        </View>
                      ) : (
                        courts.map((court) => (
                          <View key={court._id} style={styles.courtCard}>
                            <View style={styles.courtInfo}>
                              <View style={styles.courtNameRow}>
                                <Text
                                  style={styles.courtName}
                                  numberOfLines={2}
                                >
                                  {court.name}
                                </Text>
                                <View style={styles.sportPill}>
                                  <Text style={styles.sportPillText}>
                                    {court.sport}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.courtPrice}>
                                ₹
                                {Number(
                                  court.pricePerHour || 0,
                                ).toLocaleString('en-IN')}
                                /hour
                              </Text>

                              {court.hasNightPricing && (
                                <>
                                  <View style={styles.nightPriceBadge}>
                                    <Text style={styles.nightPriceBadgeText}>
                                      🌙 Night ₹
                                      {Number(
                                        court.nightPricePerHour || 0,
                                      ).toLocaleString('en-IN')}
                                      /hr
                                    </Text>
                                  </View>
                                  <Text style={styles.nightTimeText}>
                                    {formatHour(court.nightStartHour)} —{' '}
                                    {formatHour(court.nightEndHour)}
                                  </Text>
                                </>
                              )}
                            </View>

                            <View style={styles.courtActions}>
                              <TouchableOpacity
                                style={styles.smallEditButton}
                                onPress={() => handleEditCourt(turf._id, court)}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.editCourtText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.smallDeleteButton}
                                onPress={() =>
                                  handleDeleteCourt(turf._id, court)
                                }
                                activeOpacity={0.85}
                              >
                                <Text style={styles.deleteCourtText}>
                                  Delete
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* RECENT BOOKINGS */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <View style={styles.sectionTitleAccent} />
          </View>

          <View style={styles.bookingCountPill}>
            <Text style={styles.bookingCountText}>
              {recentBookings.length}
            </Text>
          </View>
        </View>

        {fetchingBookings ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primaryDeep} />
            <Text style={styles.loadingText}>
              Loading recent bookings...
            </Text>
          </View>
        ) : recentBookings.length === 0 ? (
          <View style={styles.bookingEmptyCard}>
            <View style={styles.bookingEmptyIcon}>
              <Text style={styles.bookingEmptyIconText}>📅</Text>
            </View>
            <Text style={styles.bookingEmptyTitle}>No bookings yet</Text>
            <Text style={styles.bookingEmptyText}>
              Customer details will appear here when someone books your turf.
            </Text>
          </View>
        ) : (
          <View style={styles.bookingsList}>
            {recentBookings.map((booking) => {
              const customer = booking.customer;
              const statusColors = getBookingStatusColors(booking.status);

              return (
                <View key={booking._id} style={styles.bookingCard}>
                  <View style={styles.bookingTopRow}>
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>
                        {customer?.name?.charAt(0)?.toUpperCase() || 'C'}
                      </Text>
                    </View>
                    <View style={styles.customerMainInfo}>
                      <Text
                        style={styles.customerName}
                        numberOfLines={1}
                      >
                        {customer?.name || 'Customer'}
                      </Text>
                      <Text
                        style={styles.customerPhone}
                        numberOfLines={1}
                      >
                        📞 {customer?.phone || 'Phone not available'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bookingStatusPill,
                        {
                          backgroundColor: statusColors.bg,
                          borderColor: statusColors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bookingStatusText,
                          { color: statusColors.text },
                        ]}
                      >
                        {String(booking.status || 'confirmed').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingDivider} />

                  <View style={styles.bookingDetailsGrid}>
                    <View style={styles.bookingDetailItem}>
                      <Text style={styles.bookingDetailLabel}>TURF</Text>
                      <Text
                        style={styles.bookingDetailValue}
                        numberOfLines={1}
                      >
                        {booking.turf?.name || '—'}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailItem}>
                      <Text style={styles.bookingDetailLabel}>COURT</Text>
                      <Text
                        style={styles.bookingDetailValue}
                        numberOfLines={1}
                      >
                        {booking.court?.name || '—'}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailItem}>
                      <Text style={styles.bookingDetailLabel}>DATE</Text>
                      <Text style={styles.bookingDetailValue}>
                        {formatBookingDate(booking.bookingDate)}
                      </Text>
                    </View>
                    <View style={styles.bookingDetailItem}>
                      <Text style={styles.bookingDetailLabel}>TIME</Text>
                      <Text style={styles.bookingDetailValue}>
                        {formatBookingTime(
                          booking.startTime || booking.slot?.startTime,
                        )}
                        {' → '}
                        {formatBookingTime(
                          booking.endTime || booking.slot?.endTime,
                        )}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.bookingBottomRow}>
                    <Text style={styles.bookingCustomerHint}>
                      Customer contact
                    </Text>
                    <Text style={styles.bookingAmount}>
                      ₹
                      {Number(
                        booking.finalAmount ?? booking.grossAmount ?? 0,
                      ).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* BANK */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Bank Account</Text>
            <View style={styles.sectionTitleAccent} />
          </View>
        </View>

        <View style={styles.bankCard}>
          <View style={styles.bankHeaderRow}>
            <View style={styles.bankIconCircle}>
              <Text style={styles.bankIconText}>🏦</Text>
            </View>
            <View style={styles.bankHeaderText}>
              <Text style={styles.bankHeaderTitle}>Payout Account</Text>
              <Text style={styles.bankHeaderSubtitle}>
                Where your earnings get transferred
              </Text>
            </View>
          </View>

          {bankDetails.accountHolderName ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Holder</Text>
                <Text style={styles.infoValue}>
                  {bankDetails.accountHolderName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Account Number</Text>
                <Text style={styles.infoValue}>
                  {maskAccountNumber(bankDetails.accountNumber)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IFSC</Text>
                <Text style={styles.infoValue}>{bankDetails.ifscCode}</Text>
              </View>
            </>
          ) : (
            <View style={styles.noBankBox}>
              <Text style={styles.noBankIcon}>💳</Text>
              <Text style={styles.emptyText}>
                No bank account details added yet.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButtonFull}
            onPress={() => setShowBankModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonFullText}>
              {bankDetails.accountHolderName
                ? 'EDIT BANK DETAILS'
                : 'ADD BANK DETAILS'}
            </Text>
          </TouchableOpacity>

          {bankDetails.accountHolderName && (
            <TouchableOpacity
              style={styles.deleteBankButton}
              onPress={handleDeleteBankDetails}
              activeOpacity={0.85}
            >
              <Text style={styles.deleteBankButtonText}>
                DELETE BANK DETAILS
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* DANGER ZONE */}
        <View style={styles.dangerSection}>
          <View style={styles.dangerHeaderRow}>
            <View style={styles.dangerIconCircle}>
              <Text style={styles.dangerIcon}>⚠️</Text>
            </View>
            <View style={styles.dangerHeaderText}>
              <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
              <Text style={styles.dangerSectionDescription}>
                Permanently delete your owner account and associated turf data.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteOwnerAccount}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.dangerText} />
            ) : (
              <Text style={styles.deleteAccountButtonText}>
                DELETE OWNER ACCOUNT
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <Ionicons
            name="log-out-outline"
            size={16}
            color={COLORS.textPrimary}
          />
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* EDIT PROFILE MODAL */}
      <Modal
        visible={showEditProfile}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalBadge}>👤 PROFILE</Text>
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={COLORS.placeholder}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={COLORS.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>PHONE</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone"
                placeholderTextColor={COLORS.placeholder}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.primaryButtonFull}
                onPress={handleUpdateProfile}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.primaryButtonFullText}>
                    SAVE CHANGES
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowEditProfile(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* PASSWORD MODAL */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalBadge}>🔒 SECURITY</Text>
              <Text style={styles.modalTitle}>Change Password</Text>

              <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter current password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />

              <Text style={styles.helperText}>Minimum 6 characters</Text>

              <TouchableOpacity
                style={styles.primaryButtonFull}
                onPress={handleChangePassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.primaryButtonFullText}>
                    CHANGE PASSWORD
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPasswordModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* TURF MODAL */}
      <Modal
        visible={showTurfModal}
        transparent
        animationType="slide"
        onRequestClose={closeTurfModal}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalBadge}>🏟️ TURF</Text>
              <Text style={styles.modalTitle}>
                {selectedTurf ? 'Edit Turf' : 'Add Turf'}
              </Text>

              <Text style={styles.fieldLabel}>TURF NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter turf name"
                placeholderTextColor={COLORS.placeholder}
                value={turfName}
                onChangeText={setTurfName}
              />

              <Text style={styles.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Enter turf description"
                placeholderTextColor={COLORS.placeholder}
                value={turfDescription}
                onChangeText={setTurfDescription}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter address"
                placeholderTextColor={COLORS.placeholder}
                value={turfAddress}
                onChangeText={setTurfAddress}
              />

              <Text style={styles.fieldLabel}>CITY</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter city"
                placeholderTextColor={COLORS.placeholder}
                value={turfCity}
                onChangeText={setTurfCity}
                autoCapitalize="words"
              />

              <View style={styles.hoursSectionTitleRow}>
                <Text style={styles.hoursSectionTitle}>Operating Hours</Text>
                <View style={styles.sectionTitleAccent} />
              </View>

              <Text style={styles.hoursDescription}>
                Set the opening and closing time for each day.
              </Text>

              {operatingHours.map((hour, index) => (
                <View key={hour.day} style={styles.operatingHourCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{hour.day}</Text>
                    <View style={styles.openStatusRow}>
                      <Text
                        style={[
                          styles.statusText,
                          !hour.isClosed && styles.statusTextOpen,
                        ]}
                      >
                        {hour.isClosed ? 'CLOSED' : 'OPEN'}
                      </Text>
                      <Switch
                        value={!hour.isClosed}
                        onValueChange={(value) =>
                          updateOperatingHour(index, 'isClosed', !value)
                        }
                        trackColor={{
                          false: COLORS.border,
                          true: COLORS.primaryMuted,
                        }}
                        thumbColor={
                          hour.isClosed ? COLORS.textMuted : COLORS.primary
                        }
                      />
                    </View>
                  </View>

                  {!hour.isClosed && (
                    <View style={styles.timeRow}>
                      <View style={styles.timeBox}>
                        <Text style={styles.timeLabel}>OPENING</Text>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePicker(index, 'opening')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.timeButtonText}>
                            {hour.openingTime}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.timeSeparator}>→</Text>

                      <View style={styles.timeBox}>
                        <Text style={styles.timeLabel}>CLOSING</Text>
                        <TouchableOpacity
                          style={styles.timeButton}
                          onPress={() => openTimePicker(index, 'closing')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.timeButtonText}>
                            {hour.closingTime}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.primaryButtonFull}
                onPress={handleSaveTurf}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.primaryButtonFullText}>
                    {selectedTurf ? 'UPDATE TURF' : 'SAVE TURF'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeTurfModal}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {showTimePicker && selectedHourIndex !== null && (
        <DateTimePicker
          value={timeStringToDate(
            operatingHours[selectedHourIndex][
              timePickerMode === 'opening' ? 'openingTime' : 'closingTime'
            ],
          )}
          mode="time"
          is24Hour
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {/* COURT MODAL */}
      <Modal
        visible={showCourtModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowCourtModal(false);
          resetCourtForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalBadge}>⚽ COURT</Text>
              <Text style={styles.modalTitle}>
                {selectedCourt ? 'Edit Court' : 'Add Court'}
              </Text>

              <Text style={styles.fieldLabel}>COURT NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Court 1"
                placeholderTextColor={COLORS.placeholder}
                value={courtName}
                onChangeText={setCourtName}
              />

              <Text style={styles.fieldLabel}>SPORT</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Football, Cricket"
                placeholderTextColor={COLORS.placeholder}
                value={courtSport}
                onChangeText={setCourtSport}
              />

              <Text style={styles.fieldLabel}>NORMAL PRICE PER HOUR</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter base price"
                placeholderTextColor={COLORS.placeholder}
                value={courtPrice}
                onChangeText={setCourtPrice}
                keyboardType="numeric"
              />

              <View style={styles.fullDayDiscountCard}>
                <Text style={styles.fullDayDiscountTitle}>
                  🎉 Full Day / Long Booking Discount
                </Text>
                <Text style={styles.fullDayDiscountDescription}>
                  Set the percentage discount applied when a customer uses
                  Full Day booking and selects a continuous time range.
                </Text>

                <Text style={styles.fieldLabel}>FULL DAY DISCOUNT (%)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 4"
                  placeholderTextColor={COLORS.placeholder}
                  value={courtFullDayDiscountPercent}
                  onChangeText={(value) => {
                    const cleaned = value.replace(/[^0-9.]/g, '');
                    setCourtFullDayDiscountPercent(cleaned);
                  }}
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
                <Text style={styles.fullDayDiscountHint}>
                  Example: 4 means 4% OFF. Enter 0 for no discount. Maximum
                  100%.
                </Text>
              </View>

              <View style={styles.nightPricingCard}>
                <View style={styles.nightPricingHeader}>
                  <View style={styles.nightPricingTitleContainer}>
                    <Text style={styles.nightPricingTitle}>
                      🌙 Night Pricing
                    </Text>
                    <Text style={styles.nightPricingDescription}>
                      Use a different hourly price during selected hours.
                    </Text>
                  </View>
                  <Switch
                    value={courtHasNightPricing}
                    onValueChange={setCourtHasNightPricing}
                    trackColor={{
                      false: COLORS.border,
                      true: COLORS.accentLight,
                    }}
                    thumbColor={
                      courtHasNightPricing ? COLORS.accent : COLORS.textMuted
                    }
                  />
                </View>

                {courtHasNightPricing && (
                  <>
                    <Text style={styles.fieldLabel}>
                      NIGHT PRICE PER HOUR
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 700"
                      placeholderTextColor={COLORS.placeholder}
                      value={courtNightPrice}
                      onChangeText={setCourtNightPrice}
                      keyboardType="numeric"
                    />

                    <Text style={styles.fieldLabel}>
                      NIGHT PRICING STARTS
                    </Text>
                    <TouchableOpacity
                      style={styles.timeButtonLarge}
                      onPress={() => openCourtTimePicker('nightStart')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.timeButtonLargeLabel}>
                        START TIME
                      </Text>
                      <Text style={styles.timeButtonLargeValue}>
                        {courtNightStartTime}
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                      NIGHT PRICING ENDS
                    </Text>
                    <TouchableOpacity
                      style={styles.timeButtonLarge}
                      onPress={() => openCourtTimePicker('nightEnd')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.timeButtonLargeLabel}>
                        END TIME
                      </Text>
                      <Text style={styles.timeButtonLargeValue}>
                        {courtNightEndTime}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.pricingPreview}>
                      <Text style={styles.pricingPreviewTitle}>
                        PRICING PREVIEW
                      </Text>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Normal</Text>
                        <Text style={styles.previewValue}>
                          ₹{courtPrice || '0'}/hr
                        </Text>
                      </View>
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Night</Text>
                        <Text style={styles.nightPreviewValue}>
                          ₹{courtNightPrice || '0'}/hr
                        </Text>
                      </View>
                      <Text style={styles.previewTime}>
                        {courtNightStartTime} → {courtNightEndTime}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <TouchableOpacity
                style={styles.primaryButtonFull}
                onPress={handleSaveCourt}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.primaryButtonFullText}>
                    {selectedCourt ? 'UPDATE COURT' : 'SAVE COURT'}
                  </Text>
                )}
              </TouchableOpacity>

              {selectedCourt && (
                <TouchableOpacity
                  style={styles.deleteFullButton}
                  onPress={() => {
                    if (!selectedTurfId) return;
                    handleDeleteCourt(selectedTurfId, selectedCourt);
                  }}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteFullButtonText}>
                    DELETE COURT
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCourtModal(false);
                  resetCourtForm();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {showCourtTimePicker && (
        <DateTimePicker
          value={timeStringToDate(
            courtTimePickerMode === 'nightStart'
              ? courtNightStartTime
              : courtNightEndTime,
          )}
          mode="time"
          is24Hour
          display="default"
          onChange={handleCourtTimeChange}
        />
      )}

      {/* BANK MODAL */}
      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalBadge}>🏦 BANK</Text>
              <Text style={styles.modalTitle}>Bank Account Details</Text>

              <Text style={styles.fieldLabel}>ACCOUNT HOLDER NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Account Holder Name"
                placeholderTextColor={COLORS.placeholder}
                value={bankDetails.accountHolderName}
                onChangeText={(value) =>
                  setBankDetails((previous) => ({
                    ...previous,
                    accountHolderName: value,
                  }))
                }
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>ACCOUNT NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="Account Number"
                placeholderTextColor={COLORS.placeholder}
                value={bankDetails.accountNumber}
                onChangeText={(value) =>
                  setBankDetails((previous) => ({
                    ...previous,
                    accountNumber: value.replace(/\D/g, ''),
                  }))
                }
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>IFSC CODE</Text>
              <TextInput
                style={styles.input}
                placeholder="IFSC Code"
                placeholderTextColor={COLORS.placeholder}
                value={bankDetails.ifscCode}
                onChangeText={(value) =>
                  setBankDetails((previous) => ({
                    ...previous,
                    ifscCode: value.toUpperCase(),
                  }))
                }
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={styles.primaryButtonFull}
                onPress={handleSaveBankDetails}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.dark} />
                ) : (
                  <Text style={styles.primaryButtonFullText}>
                    SAVE BANK DETAILS
                  </Text>
                )}
              </TouchableOpacity>

              {bankDetails.accountHolderName && (
                <TouchableOpacity
                  style={styles.deleteFullButton}
                  onPress={handleDeleteBankDetails}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <Text style={styles.deleteFullButtonText}>
                    DELETE BANK DETAILS
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowBankModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default OwnerProfileScreen;

/* =========================================================
   STYLES — COMPACT
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 60,
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

  pageHeader: {
    marginBottom: 16,
  },

  pageHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },

  title: {
    fontSize: 26,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },

  pageHeaderSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  /* COMPACT PROFILE CARD */

  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },

  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },

  avatarText: {
    fontFamily: 'Poppins_900Black',
    fontSize: 26,
    color: COLORS.dark,
  },

  avatarBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  avatarBadgeText: {
    fontSize: 11,
  },

  profileInfo: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    fontSize: 18,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  email: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textMuted,
    marginTop: 2,
  },

  rolePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },

  rolePillText: {
    color: COLORS.primaryDarker,
    fontSize: 9,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    flex: 1,
    letterSpacing: 0.2,
  },

  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    maxWidth: '65%',
    textAlign: 'right',
  },

  /* BUTTON ROW — side-by-side compact */

  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },

  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  primaryButtonText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    borderRadius: 12,
    paddingVertical: 12,
  },

  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  /* FULL-WIDTH BUTTONS (used in modals) */

  primaryButtonFull: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.20,
    shadowRadius: 10,
    elevation: 4,
  },

  primaryButtonFullText: {
    color: COLORS.dark,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
  },

  cancelButton: {
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
  },

  /* SECTIONS */

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.1,
  },

  sectionTitleAccent: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.primary,
    marginLeft: 7,
    marginTop: 2,
  },

  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginLeft: 10,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  addButtonText: {
    color: COLORS.dark,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
    letterSpacing: 1,
  },

  /* LOADING */

  loadingBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 18,
    padding: 26,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.3,
  },

  /* EMPTY */

  emptyCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIconWrapper: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  emptyIcon: {
    fontSize: 26,
  },

  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  emptyText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  /* TURF */

  turfCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
  },

  turfImage: {
    width: '100%',
    height: 160,
  },

  imagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderIcon: {
    fontSize: 32,
    marginBottom: 6,
  },

  placeholderText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },

  turfStatusPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  turfStatusText: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1,
  },

  turfContent: {
    padding: 14,
  },

  turfName: {
    fontSize: 16,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },

  turfCity: {
    fontSize: 12,
    color: COLORS.primaryDarker,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    marginTop: 5,
  },

  turfAddress: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },

  turfActionGrid: {
    flexDirection: 'row',
    marginTop: 14,
  },

  manageButton: {
    flex: 1.4,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    minHeight: 42,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  manageButtonText: {
    color: COLORS.primaryDarker,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
    letterSpacing: 0.7,
    textAlign: 'center',
  },

  editButton: {
    flex: 0.7,
    borderRadius: 12,
    backgroundColor: COLORS.dark,
    minHeight: 42,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },

  editButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
    letterSpacing: 0.8,
  },

  deleteTurfButton: {
    flex: 0.85,
    borderRadius: 12,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    minHeight: 42,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  deleteTurfButtonText: {
    color: COLORS.dangerText,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
    letterSpacing: 0.7,
  },

  /* COURTS */

  courtsContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  courtTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  addCourtButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 11,
  },

  addCourtText: {
    color: COLORS.primaryDarker,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 11,
    letterSpacing: 0.4,
  },

  noCourtsBox: {
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
  },

  noCourtsIcon: {
    fontSize: 24,
    marginBottom: 6,
  },

  noCourtText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Poppins_600SemiBold',
  },

  courtCard: {
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  courtInfo: {
    flex: 1,
    paddingRight: 10,
  },

  courtNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  courtName: {
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    marginRight: 6,
    letterSpacing: -0.1,
  },

  sportPill: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  sportPillText: {
    color: COLORS.primaryDarker,
    fontSize: 9,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
  },

  courtPrice: {
    color: COLORS.primaryDarker,
    fontSize: 13,
    fontFamily: 'Poppins_900Black',
    marginTop: 6,
  },

  nightPriceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },

  nightPriceBadgeText: {
    color: COLORS.accentText,
    fontSize: 9,
    fontFamily: 'Poppins_800ExtraBold',
  },

  nightTimeText: {
    color: COLORS.accentText,
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'Poppins_700Bold',
  },

  courtActions: {
    alignItems: 'flex-end',
  },

  smallEditButton: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginBottom: 6,
  },

  editCourtText: {
    color: COLORS.primaryDarker,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
  },

  smallDeleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  deleteCourtText: {
    color: COLORS.dangerText,
    fontWeight: '900',
    fontFamily: 'Poppins_900Black',
    fontSize: 10,
  },

  /* BOOKINGS */

  bookingCountPill: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookingCountText: {
    color: COLORS.primaryDarker,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
  },

  bookingEmptyCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    padding: 22,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
  },

  bookingEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  bookingEmptyIconText: {
    fontSize: 24,
  },

  bookingEmptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontFamily: 'Poppins_900Black',
  },

  bookingEmptyText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 5,
  },

  bookingsList: {
    marginBottom: 22,
  },

  bookingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  customerAvatarText: {
    color: COLORS.dark,
    fontSize: 16,
    fontFamily: 'Poppins_900Black',
  },

  customerMainInfo: {
    flex: 1,
    marginLeft: 10,
    paddingRight: 8,
  },

  customerName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
  },

  customerPhone: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    marginTop: 3,
  },

  bookingStatusPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    maxWidth: 86,
  },

  bookingStatusText: {
    fontSize: 8,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.6,
    textAlign: 'center',
  },

  bookingDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 11,
  },

  bookingDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },

  bookingDetailItem: {
    width: '50%',
    paddingHorizontal: 4,
    marginBottom: 9,
  },

  bookingDetailLabel: {
    color: COLORS.textMuted,
    fontSize: 8,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.9,
    marginBottom: 3,
  },

  bookingDetailValue: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
  },

  bookingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },

  bookingCustomerHint: {
    color: COLORS.textMuted,
    fontSize: 9,
    fontFamily: 'Poppins_600SemiBold',
  },

  bookingAmount: {
    color: COLORS.primaryDarker,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
  },

  /* BANK */

  bankCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  bankIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bankIconText: {
    fontSize: 22,
  },

  bankHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  bankHeaderTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
  },

  bankHeaderSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    marginTop: 3,
    lineHeight: 15,
  },

  noBankBox: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  noBankIcon: {
    fontSize: 26,
    marginBottom: 6,
  },

  deleteBankButton: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    paddingVertical: 13,
    alignItems: 'center',
  },

  deleteBankButtonText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.8,
  },

  /* DANGER */

  dangerSection: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 20,
    padding: 16,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dangerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  dangerIcon: {
    fontSize: 20,
  },

  dangerHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  dangerSectionTitle: {
    color: COLORS.dangerText,
    fontSize: 15,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.3,
  },

  dangerSectionDescription: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 16,
    marginTop: 4,
  },

  deleteAccountButton: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: COLORS.dangerText,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },

  deleteAccountButtonText: {
    color: COLORS.dangerText,
    fontSize: 11,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.8,
  },

  /* LOGOUT */

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 2,
  },

  logoutText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
  },

  /* MODALS */

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },

  modalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },

  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    marginTop: 40,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 12,
  },

  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 16,
  },

  modalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDarker,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 1.2,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    marginBottom: 16,
    letterSpacing: -0.2,
  },

  fieldLabel: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 7,
    marginTop: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  input: {
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    minHeight: 50,
  },

  textArea: {
    minHeight: 90,
    paddingTop: 15,
  },

  helperText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    marginTop: -6,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  /* OPERATING HOURS */

  hoursSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 6,
  },

  hoursSectionTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
  },

  hoursDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 16,
    marginTop: 5,
    marginBottom: 12,
  },

  operatingHourCard: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dayName: {
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
  },

  openStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
    marginRight: 8,
    letterSpacing: 0.8,
  },

  statusTextOpen: {
    color: COLORS.primaryDarker,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 12,
  },

  timeBox: {
    flex: 1,
  },

  timeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 5,
    letterSpacing: 0.6,
  },

  timeButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },

  timeButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
  },

  timeSeparator: {
    color: COLORS.primaryDeep,
    fontSize: 16,
    fontFamily: 'Poppins_900Black',
    marginHorizontal: 10,
    marginBottom: 10,
  },

  /* FULL DAY DISCOUNT */

  fullDayDiscountCard: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  fullDayDiscountTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
    marginBottom: 5,
    letterSpacing: -0.1,
  },

  fullDayDiscountDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 17,
    marginBottom: 12,
  },

  fullDayDiscountHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* NIGHT PRICING */

  nightPricingCard: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },

  nightPricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nightPricingTitleContainer: {
    flex: 1,
    paddingRight: 12,
  },

  nightPricingTitle: {
    color: COLORS.accentText,
    fontSize: 14,
    fontFamily: 'Poppins_900Black',
  },

  nightPricingDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 15,
    marginTop: 4,
  },

  timeButtonLarge: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.accentLight,
    borderRadius: 11,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  timeButtonLargeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.8,
  },

  timeButtonLargeValue: {
    color: COLORS.accentText,
    fontSize: 13,
    fontFamily: 'Poppins_900Black',
  },

  pricingPreview: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.accentLight,
  },

  pricingPreviewTitle: {
    color: COLORS.accentText,
    fontSize: 11,
    fontFamily: 'Poppins_900Black',
    marginBottom: 8,
    letterSpacing: 1,
  },

  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },

  previewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
  },

  previewValue: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
  },

  nightPreviewValue: {
    color: COLORS.accentText,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
  },

  previewTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
    marginTop: 7,
  },

  /* DELETE */

  deleteFullButton: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteFullButtonText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontFamily: 'Poppins_900Black',
    letterSpacing: 0.9,
  },
});