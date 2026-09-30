import React, { useCallback, useEffect, useState } from 'react';
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

const API_BASE_URL = 'http://192.168.0.100:5000/api';

/* =========================================================
   THEME COLORS - WHITE & LIGHT GREEN
========================================================= */

const COLORS = {
  // Primary Greens
  primary: '#22C55E',
  primaryDark: '#16A34A',
  primaryDeep: '#15803D',
  primaryDarker: '#166534',
  primaryLight: '#DCFCE7',
  primarySoft: '#F0FDF4',
  primaryFaint: '#F7FEF9',
  primaryMuted: '#BBF7D0',

  // Accent (warm contrast)
  accent: '#F97316',
  accentLight: '#FFEDD5',
  accentSoft: '#FEF3C7',
  accentText: '#92400E',

  // Neutrals
  bg: '#FFFFFF',
  bgSoft: '#FAFEFB',
  bgMuted: '#F4FBF6',
  card: '#FFFFFF',
  cardSoft: '#F9FDFA',

  // Borders
  border: '#E8F5EC',
  borderLight: '#D1FAE5',
  borderSoft: '#BBF7D0',
  borderDark: '#A7F3D0',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#CBD5E1',
  placeholder: '#94A3B8',

  // Status
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
  overlay: 'rgba(15, 23, 42, 0.5)',

  // Shadows
  shadowColor: '#22C55E',
  shadowLight: '#DCFCE7',
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

interface OwnerProfileScreenProps {
  user: User;
  onUpdateUser?: (updatedUser: User) => void;
  onLogout?: () => void;
  onNavigateToAddTurf?: () => void;
}

/* =========================================================
   DEFAULT OPERATING HOURS
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

const timeStringToDate = (time: string): Date => {
  const [hours, minutes] = time.split(':').map(Number);
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
  const [hours] = time.split(':').map(Number);
  return Number.isNaN(hours) ? 0 : hours;
};

const formatHour = (hour?: number): string => {
  if (typeof hour !== 'number' || hour < 0 || hour > 23) {
    return '--:--';
  }
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
  const clean = (status || 'active').toLowerCase();

  switch (clean) {
    case 'active':
      return {
        bg: COLORS.primarySoft,
        border: COLORS.borderSoft,
        text: COLORS.primaryDark,
        dot: COLORS.primary,
      };
    case 'maintenance':
      return {
        bg: COLORS.warningSoft,
        border: COLORS.warningBorder,
        text: COLORS.warningText,
        dot: COLORS.warning,
      };
    default:
      return {
        bg: COLORS.cardSoft,
        border: COLORS.border,
        text: COLORS.textMuted,
        dot: COLORS.textMuted,
      };
  }
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

  /* TURF */
  const [turfName, setTurfName] = useState('');
  const [turfDescription, setTurfDescription] = useState('');
  const [turfAddress, setTurfAddress] = useState('');
  const [turfCity, setTurfCity] = useState('');

  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>(
    cloneDefaultHours(),
  );

  /* COURT */
  const [courtName, setCourtName] = useState('');
  const [courtSport, setCourtSport] = useState('');
  const [courtPrice, setCourtPrice] = useState('');

  const [courtHasNightPricing, setCourtHasNightPricing] = useState(false);

  const [courtNightPrice, setCourtNightPrice] = useState('');
  const [courtNightStartTime, setCourtNightStartTime] = useState('18:00');
  const [courtNightEndTime, setCourtNightEndTime] = useState('23:00');

  /* DATA */
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [turfCourts, setTurfCourts] = useState<Record<string, Court[]>>({});
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

  /* LOAD USER */
  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
  }, [user.name, user.email, user.phone]);

  useEffect(() => {
    fetchOwnerData();
  }, [user._id]);

  /* FETCH OWNER DATA */
  const fetchOwnerData = useCallback(async () => {
    try {
      setFetchingData(true);
      await Promise.all([fetchTurfs(), fetchBankDetails()]);
    } catch (error) {
      console.error('Failed to fetch owner data:', error);
    } finally {
      setFetchingData(false);
    }
  }, [user._id]);

  /* FETCH TURFS */
  const fetchTurfs = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/owners/${user._id}/turfs`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch turfs.');
      }

      const ownerTurfs = data.turfs || data || [];
      setTurfs(ownerTurfs);
    } catch (error) {
      console.error('Failed to fetch turfs:', error);
    }
  };

  /* FETCH BANK */
  const fetchBankDetails = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/owners/${user._id}/bank-details`,
      );
      const data = await response.json();

      if (response.ok && data) {
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
    } catch (error) {
      console.error('Failed to fetch bank details:', error);
    }
  };

  /* FETCH COURTS */
  const fetchCourts = async (turfId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/turfs/${turfId}/courts`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch courts.');
      }

      setTurfCourts((previous) => ({
        ...previous,
        [turfId]: data.courts || data || [],
      }));
    } catch (error) {
      console.error('Failed to fetch courts:', error);
      Alert.alert('Unable to Load Courts', 'Failed to load courts for this turf.');
    }
  };

  /* TOGGLE TURF */
  const handleToggleTurf = async (turfId: string) => {
    if (expandedTurfId === turfId) {
      setExpandedTurfId(null);
      return;
    }
    setExpandedTurfId(turfId);
    await fetchCourts(turfId);
  };

  /* UPDATE PROFILE */
  const handleUpdateProfile = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      Alert.alert('Missing Information', 'Please fill in all profile fields.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile.');
      }

      const updatedUser = data.user || data;
      onUpdateUser?.(updatedUser);
      setShowEditProfile(false);
      Alert.alert('Profile Updated', 'Your profile has been updated successfully.');
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  /* CHANGE PASSWORD */
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Missing Password', 'Please enter your current and new password.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'New password must contain at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/users/${user._id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password.');
      }

      setCurrentPassword('');
      setNewPassword('');
      setShowPasswordModal(false);
      Alert.alert('Password Changed', 'Your password has been changed successfully.');
    } catch (error: any) {
      Alert.alert('Password Change Failed', error.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  /* ADD TURF */
  const handleAddTurf = () => {
    if (onNavigateToAddTurf) {
      onNavigateToAddTurf();
      return;
    }
    Alert.alert('Navigation Error', 'Add Turf navigation is not configured.');
  };

  /* EDIT TURF */
  const handleEditTurf = (turf: Turf) => {
    setSelectedTurf(turf);
    setTurfName(turf.name || '');
    setTurfDescription(turf.description || '');
    setTurfAddress(turf.address || '');
    setTurfCity(turf.city || '');

    if (turf.operatingHours && turf.operatingHours.length > 0) {
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

  /* UPDATE OPERATING HOURS */
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

  /* OPEN TURF TIME PICKER */
  const openTimePicker = (index: number, mode: 'opening' | 'closing') => {
    setSelectedHourIndex(index);
    setTimePickerMode(mode);
    setShowTimePicker(true);
  };

  /* TURF TIME PICKER */
  const handleTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);

    if (event?.type === 'dismissed' || !selectedDate || selectedHourIndex === null) {
      setSelectedHourIndex(null);
      return;
    }

    const newTime = dateToTimeString(selectedDate);
    const field = timePickerMode === 'opening' ? 'openingTime' : 'closingTime';
    updateOperatingHour(selectedHourIndex, field, newTime);
    setSelectedHourIndex(null);
  };

  /* SAVE TURF */
  const handleSaveTurf = async () => {
    if (!turfName.trim() || !turfAddress.trim() || !turfCity.trim()) {
      Alert.alert('Missing Information', 'Please fill in turf name, address and city.');
      return;
    }

    for (const hour of operatingHours) {
      if (hour.isClosed) continue;

      if (!hour.openingTime || !hour.closingTime) {
        Alert.alert('Invalid Hours', `Please select opening and closing time for ${hour.day}.`);
        return;
      }

      const opening = timeStringToDate(hour.openingTime).getTime();
      const closing = timeStringToDate(hour.closingTime).getTime();

      if (opening >= closing) {
        Alert.alert('Invalid Hours', `Closing time must be later than opening time on ${hour.day}.`);
        return;
      }
    }

    try {
      setLoading(true);
      const isEditing = selectedTurf !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${API_BASE_URL}/turfs/${selectedTurf!._id}`
        : `${API_BASE_URL}/turfs`;

      const payload = {
        owner: user._id,
        name: turfName.trim(),
        description: turfDescription.trim(),
        address: turfAddress.trim(),
        city: turfCity.trim(),
        operatingHours,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save turf.');
      }

      closeTurfModal();
      await fetchTurfs();
      Alert.alert('Success', isEditing ? 'Turf updated successfully.' : 'Turf added successfully.');
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Failed to save turf.');
    } finally {
      setLoading(false);
    }
  };

  /* CLOSE TURF MODAL */
  const closeTurfModal = () => {
    setShowTurfModal(false);
    setSelectedTurf(null);
    setTurfName('');
    setTurfDescription('');
    setTurfAddress('');
    setTurfCity('');
    setOperatingHours(cloneDefaultHours());
  };

  /* DELETE TURF */
  const handleDeleteTurf = (turf: Turf) => {
    const courtCount = turfCourts[turf._id]?.length;
    const courtMessage =
      typeof courtCount === 'number'
        ? `\n\nThis turf currently has ${courtCount} court${courtCount === 1 ? '' : 's'}.`
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
              const response = await fetch(`${API_BASE_URL}/turfs/${turf._id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Failed to delete turf.');
              }

              setTurfs((previous) => previous.filter((item) => item._id !== turf._id));

              setTurfCourts((previous) => {
                const updated = { ...previous };
                delete updated[turf._id];
                return updated;
              });

              if (expandedTurfId === turf._id) setExpandedTurfId(null);
              if (selectedTurf?._id === turf._id) closeTurfModal();

              Alert.alert('Turf Deleted', data.message || 'Turf and all its courts were deleted successfully.');
            } catch (error: any) {
              console.error('Delete turf error:', error);
              Alert.alert('Delete Failed', error.message || 'Failed to delete turf.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  /* COURT RESET */
  const resetCourtForm = () => {
    setCourtName('');
    setCourtSport('');
    setCourtPrice('');
    setCourtHasNightPricing(false);
    setCourtNightPrice('');
    setCourtNightStartTime('18:00');
    setCourtNightEndTime('23:00');
    setSelectedCourt(null);
  };

  /* ADD COURT */
  const handleAddCourt = (turfId: string) => {
    setSelectedTurfId(turfId);
    resetCourtForm();
    setShowCourtModal(true);
  };

  /* EDIT COURT */
  const handleEditCourt = (turfId: string, court: Court) => {
    setSelectedTurfId(turfId);
    setSelectedCourt(court);
    setCourtName(court.name || '');
    setCourtSport(court.sport || '');
    setCourtPrice(
      court.pricePerHour !== undefined ? String(court.pricePerHour) : '',
    );
    setCourtHasNightPricing(Boolean(court.hasNightPricing));
    setCourtNightPrice(
      court.nightPricePerHour !== undefined ? String(court.nightPricePerHour) : '',
    );
    setCourtNightStartTime(hourToTimeString(court.nightStartHour));
    setCourtNightEndTime(hourToTimeString(court.nightEndHour));
    setShowCourtModal(true);
  };

  /* OPEN COURT TIME PICKER */
  const openCourtTimePicker = (mode: 'nightStart' | 'nightEnd') => {
    setCourtTimePickerMode(mode);
    setShowCourtTimePicker(true);
  };

  /* COURT TIME PICKER */
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

  /* SAVE COURT */
  const handleSaveCourt = async () => {
    if (
      !selectedTurfId ||
      !courtName.trim() ||
      !courtSport.trim() ||
      !courtPrice.trim()
    ) {
      Alert.alert('Missing Information', 'Please fill all required court fields.');
      return;
    }

    const price = Number(courtPrice);

    if (Number.isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Base price must be greater than ₹0.');
      return;
    }

    let nightPrice: number | undefined;
    let nightStartHour: number | undefined;
    let nightEndHour: number | undefined;

    if (courtHasNightPricing) {
      if (!courtNightPrice.trim()) {
        Alert.alert('Night Pricing', 'Please enter the night price per hour.');
        return;
      }

      nightPrice = Number(courtNightPrice);

      if (Number.isNaN(nightPrice) || nightPrice <= 0) {
        Alert.alert('Invalid Night Price', 'Night price must be greater than ₹0.');
        return;
      }

      nightStartHour = timeStringToHour(courtNightStartTime);
      nightEndHour = timeStringToHour(courtNightEndTime);

      if (nightStartHour === nightEndHour) {
        Alert.alert('Invalid Night Hours', 'Night start and end time cannot be the same.');
        return;
      }
    }

    try {
      setLoading(true);
      const isEditing = selectedCourt !== null;
      const method = isEditing ? 'PUT' : 'POST';
      const url = isEditing
        ? `${API_BASE_URL}/courts/${selectedCourt!._id}`
        : `${API_BASE_URL}/courts`;

      const payload = {
        turf: selectedTurfId,
        name: courtName.trim(),
        sport: courtSport.trim(),
        pricePerHour: price,
        hasNightPricing: courtHasNightPricing,
        ...(courtHasNightPricing
          ? {
              nightPricePerHour: nightPrice,
              nightStartHour: nightStartHour,
              nightEndHour: nightEndHour,
            }
          : {}),
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save court.');
      }

      setShowCourtModal(false);
      await fetchCourts(selectedTurfId);
      resetCourtForm();
      Alert.alert('Success', isEditing ? 'Court updated successfully.' : 'Court added successfully.');
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Failed to save court.');
    } finally {
      setLoading(false);
    }
  };

  /* DELETE COURT */
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
              const response = await fetch(`${API_BASE_URL}/courts/${court._id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Failed to delete court.');
              }

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

              Alert.alert('Court Deleted', data.message || 'Court deleted successfully.');
            } catch (error: any) {
              Alert.alert('Delete Failed', error.message || 'Failed to delete court.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  /* SAVE BANK */
  const handleSaveBankDetails = async () => {
    if (
      !bankDetails.accountHolderName.trim() ||
      !bankDetails.accountNumber.trim() ||
      !bankDetails.ifscCode.trim()
    ) {
      Alert.alert('Missing Information', 'Please fill all bank details.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/owners/${user._id}/bank-details`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountHolderName: bankDetails.accountHolderName.trim(),
            accountNumber: bankDetails.accountNumber.trim(),
            ifscCode: bankDetails.ifscCode.trim().toUpperCase(),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save bank details.');
      }

      setShowBankModal(false);
      await fetchBankDetails();
      Alert.alert('Bank Details Saved', 'Your payout bank details have been saved successfully.');
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Failed to save bank details.');
    } finally {
      setLoading(false);
    }
  };

  /* DELETE BANK */
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
                `${API_BASE_URL}/owners/${user._id}/bank-details`,
                {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                },
              );

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Failed to delete bank details.');
              }

              setBankDetails({
                accountHolderName: '',
                accountNumber: '',
                ifscCode: '',
              });

              setShowBankModal(false);
              Alert.alert('Bank Details Deleted', data.message || 'Bank details deleted successfully.');
            } catch (error: any) {
              Alert.alert('Delete Failed', error.message || 'Failed to delete bank details.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  /* DELETE OWNER ACCOUNT */
  const performDeleteOwnerAccount = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/owners/${user._id}/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete owner account.');
      }

      setTurfs([]);
      setTurfCourts({});
      setBankDetails({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
      });

      Alert.alert(
        'Account Deleted',
        data.message || 'Your owner account and associated turf data have been deleted.',
        [{ text: 'OK', onPress: () => onLogout?.() }],
      );
    } catch (error: any) {
      Alert.alert('Account Deletion Failed', error.message || 'Failed to delete your owner account.');
    } finally {
      setLoading(false);
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

  /* LOGOUT */
  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => onLogout?.() },
    ]);
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderBadge}>🏟️ OWNER</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.pageHeaderSubtitle}>
            Manage your turfs, courts and payouts
          </Text>
        </View>

        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
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

          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user.phone || 'Not added'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>TURF OWNER</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowEditProfile(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>EDIT PROFILE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setShowPasswordModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>CHANGE PASSWORD</Text>
          </TouchableOpacity>
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

        {/* TURF LIST */}
        {fetchingData ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={COLORS.primary} />
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
              style={styles.primaryButton}
              onPress={handleAddTurf}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>ADD YOUR FIRST TURF</Text>
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
                {/* IMAGE */}
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={styles.turfImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderIcon}>⚽</Text>
                    <Text style={styles.placeholderText}>No Image</Text>
                  </View>
                )}

                {/* STATUS */}
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
                    style={[styles.statusDot, { backgroundColor: statusColors.dot }]}
                  />
                  <Text style={[styles.turfStatusText, { color: statusColors.text }]}>
                    {String(turf.status || 'active').toUpperCase()}
                  </Text>
                </View>

                {/* CONTENT */}
                <View style={styles.turfContent}>
                  <Text style={styles.turfName}>{turf.name}</Text>

                  <Text style={styles.turfCity}>📍 {turf.city}</Text>
                  <Text style={styles.turfAddress}>{turf.address}</Text>

                  {/* ACTIONS */}
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

                  {/* COURTS */}
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
                          <Text style={styles.noCourtText}>No courts added yet.</Text>
                        </View>
                      ) : (
                        courts.map((court) => (
                          <View key={court._id} style={styles.courtCard}>
                            <View style={styles.courtInfo}>
                              <View style={styles.courtNameRow}>
                                <Text style={styles.courtName}>{court.name}</Text>

                                <View style={styles.sportPill}>
                                  <Text style={styles.sportPillText}>
                                    {court.sport}
                                  </Text>
                                </View>
                              </View>

                              <Text style={styles.courtPrice}>
                                ₹{court.pricePerHour}/hour
                              </Text>

                              {court.hasNightPricing && (
                                <>
                                  <View style={styles.nightPriceBadge}>
                                    <Text style={styles.nightPriceBadgeText}>
                                      🌙 Night ₹{court.nightPricePerHour}/hr
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
                                onPress={() => handleDeleteCourt(turf._id, court)}
                                activeOpacity={0.85}
                              >
                                <Text style={styles.deleteCourtText}>Delete</Text>
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

        {/* BANK SECTION */}
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
            style={styles.primaryButton}
            onPress={() => setShowBankModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>
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
              <Text style={styles.deleteBankButtonText}>DELETE BANK DETAILS</Text>
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
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* =====================================================
          EDIT PROFILE MODAL
      ===================================================== */}
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
                style={styles.primaryButton}
                onPress={handleUpdateProfile}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>SAVE CHANGES</Text>
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

      {/* =====================================================
          PASSWORD MODAL
      ===================================================== */}
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
              />

              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <Text style={styles.helperText}>Minimum 6 characters</Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleChangePassword}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>CHANGE PASSWORD</Text>
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

      {/* =====================================================
          TURF MODAL
      ===================================================== */}
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
              />

              {/* OPERATING HOURS */}
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
                style={styles.primaryButton}
                onPress={handleSaveTurf}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
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

      {/* TURF TIME PICKER */}
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

      {/* =====================================================
          COURT MODAL
      ===================================================== */}
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

              {/* NIGHT PRICING */}
              <View style={styles.nightPricingCard}>
                <View style={styles.nightPricingHeader}>
                  <View style={styles.nightPricingTitleContainer}>
                    <Text style={styles.nightPricingTitle}>🌙 Night Pricing</Text>
                    <Text style={styles.nightPricingDescription}>
                      Use a different hourly price during selected hours.
                    </Text>
                  </View>

                  <Switch
                    value={courtHasNightPricing}
                    onValueChange={setCourtHasNightPricing}
                    trackColor={{
                      false: COLORS.border,
                      true: COLORS.warningBorder,
                    }}
                    thumbColor={
                      courtHasNightPricing ? COLORS.warning : COLORS.textMuted
                    }
                  />
                </View>

                {courtHasNightPricing && (
                  <>
                    <Text style={styles.fieldLabel}>NIGHT PRICE PER HOUR</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 700"
                      placeholderTextColor={COLORS.placeholder}
                      value={courtNightPrice}
                      onChangeText={setCourtNightPrice}
                      keyboardType="numeric"
                    />

                    <Text style={styles.fieldLabel}>NIGHT PRICING STARTS</Text>
                    <TouchableOpacity
                      style={styles.timeButtonLarge}
                      onPress={() => openCourtTimePicker('nightStart')}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.timeButtonLargeLabel}>START TIME</Text>
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
                      <Text style={styles.timeButtonLargeLabel}>END TIME</Text>
                      <Text style={styles.timeButtonLargeValue}>
                        {courtNightEndTime}
                      </Text>
                    </TouchableOpacity>

                    {/* PREVIEW */}
                    <View style={styles.pricingPreview}>
                      <Text style={styles.pricingPreviewTitle}>PRICING PREVIEW</Text>

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
                style={styles.primaryButton}
                onPress={handleSaveCourt}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
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
                  <Text style={styles.deleteFullButtonText}>DELETE COURT</Text>
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

      {/* COURT TIME PICKER */}
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

      {/* =====================================================
          BANK MODAL
      ===================================================== */}
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
                    accountNumber: value,
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
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveBankDetails}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>SAVE BANK DETAILS</Text>
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
   STYLES - WHITE & LIGHT GREEN THEME
========================================================= */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  container: {
    padding: 20,
    paddingBottom: 60,
  },

  /* =======================================================
     HEADER
  ======================================================= */

  pageHeader: {
    marginBottom: 24,
  },

  pageHeaderBadge: {
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
    marginBottom: 12,
    overflow: 'hidden',
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  pageHeaderSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 5,
    lineHeight: 19,
  },

  /* =======================================================
     PROFILE CARD
  ======================================================= */

  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
  },

  avatarWrapper: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },

  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },

  avatarText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
  },

  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  avatarBadgeText: {
    fontSize: 13,
  },

  name: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  email: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 22,
    fontWeight: '500',
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },

  rolePill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },

  rolePillText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  /* =======================================================
     BUTTONS
  ======================================================= */

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 52,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  secondaryButtonText: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  cancelButton: {
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  cancelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '800',
  },

  /* =======================================================
     SECTIONS
  ======================================================= */

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
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

  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },

  addButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 1,
  },

  /* =======================================================
     LOADING
  ======================================================= */

  loadingBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },

  /* =======================================================
     EMPTY STATE
  ======================================================= */

  emptyCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    marginBottom: 22,
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
    fontSize: 30,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },

  /* =======================================================
     TURF CARD
  ======================================================= */

  turfCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    position: 'relative',
  },

  turfImage: {
    width: '100%',
    height: 180,
  },

  imagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeholderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },

  placeholderText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  turfStatusPill: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  turfStatusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },

  turfContent: {
    padding: 18,
  },

  turfName: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  turfCity: {
    fontSize: 13,
    color: COLORS.primaryDark,
    fontWeight: '700',
    marginTop: 6,
  },

  turfAddress: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },

  turfActionGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },

  manageButton: {
    flex: 1.4,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  manageButtonText: {
    color: COLORS.primaryDark,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.7,
  },

  editButton: {
    flex: 0.7,
    borderRadius: 12,
    backgroundColor: COLORS.textPrimary,
    minHeight: 46,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  editButtonText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.8,
  },

  deleteTurfButton: {
    flex: 0.85,
    borderRadius: 12,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    minHeight: 46,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  deleteTurfButtonText: {
    color: COLORS.dangerText,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.7,
  },

  /* =======================================================
     COURTS
  ======================================================= */

  courtsContainer: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },

  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  courtTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  addCourtButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },

  addCourtText: {
    color: COLORS.primaryDark,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },

  noCourtsBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderStyle: 'dashed',
  },

  noCourtsIcon: {
    fontSize: 26,
    marginBottom: 8,
  },

  noCourtText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  courtCard: {
    backgroundColor: COLORS.primaryFaint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  courtInfo: {
    flex: 1,
    paddingRight: 12,
  },

  courtNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  courtName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  sportPill: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  sportPillText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  courtPrice: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
  },

  nightPriceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },

  nightPriceBadgeText: {
    color: COLORS.accentText,
    fontSize: 10,
    fontWeight: '800',
  },

  nightTimeText: {
    color: COLORS.accentText,
    fontSize: 11,
    marginTop: 6,
    fontWeight: '700',
  },

  courtActions: {
    alignItems: 'flex-end',
    gap: 8,
  },

  smallEditButton: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  editCourtText: {
    color: COLORS.primaryDark,
    fontWeight: '900',
    fontSize: 11,
  },

  smallDeleteButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  deleteCourtText: {
    color: COLORS.dangerText,
    fontWeight: '900',
    fontSize: 11,
  },

  /* =======================================================
     BANK
  ======================================================= */

  bankCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },

  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  bankIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bankIconText: {
    fontSize: 24,
  },

  bankHeaderText: {
    flex: 1,
    marginLeft: 14,
  },

  bankHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  bankHeaderSubtitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },

  noBankBox: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  noBankIcon: {
    fontSize: 30,
    marginBottom: 8,
  },

  deleteBankButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    paddingVertical: 14,
    alignItems: 'center',
  },

  deleteBankButtonText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* =======================================================
     DANGER ZONE
  ======================================================= */

  dangerSection: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 22,
    padding: 20,
    marginTop: 4,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },

  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  dangerIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
  },

  dangerIcon: {
    fontSize: 22,
  },

  dangerHeaderText: {
    flex: 1,
    marginLeft: 14,
  },

  dangerSectionTitle: {
    color: COLORS.dangerText,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  dangerSectionDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  deleteAccountButton: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: COLORS.dangerText,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },

  deleteAccountButtonText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* =======================================================
     LOGOUT
  ======================================================= */

  logoutButton: {
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 2,
  },

  logoutText: {
    color: COLORS.dangerText,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  /* =======================================================
     MODALS
  ======================================================= */

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
    borderRadius: 28,
    padding: 24,
    marginTop: 40,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },

  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.borderDark,
    alignSelf: 'center',
    marginBottom: 18,
  },

  modalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 20,
    letterSpacing: 0.2,
  },

  fieldLabel: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 8,
    marginTop: 12,
    letterSpacing: 1,
  },

  input: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 52,
  },

  textArea: {
    minHeight: 100,
    paddingTop: 15,
  },

  helperText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginTop: -6,
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  /* =======================================================
     OPERATING HOURS
  ======================================================= */

  hoursSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginBottom: 6,
  },

  hoursSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },

  hoursDescription: {
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
    marginBottom: 14,
  },

  operatingHourCard: {
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dayName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  openStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    marginRight: 8,
    letterSpacing: 0.8,
  },

  statusTextOpen: {
    color: COLORS.primaryDark,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 14,
  },

  timeBox: {
    flex: 1,
  },

  timeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.6,
  },

  timeButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },

  timeButtonText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
  },

  timeSeparator: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 10,
    marginBottom: 12,
  },

  /* =======================================================
     NIGHT PRICING
  ======================================================= */

  nightPricingCard: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  nightPricingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  nightPricingTitleContainer: {
    flex: 1,
    paddingRight: 14,
  },

  nightPricingTitle: {
    color: COLORS.accentText,
    fontSize: 15,
    fontWeight: '900',
  },

  nightPricingDescription: {
    color: COLORS.textSecondary,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },

  timeButtonLarge: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.warningBorder,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  timeButtonLargeLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  timeButtonLargeValue: {
    color: COLORS.accentText,
    fontSize: 14,
    fontWeight: '900',
  },

  pricingPreview: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
  },

  pricingPreviewTitle: {
    color: COLORS.accentText,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 10,
    letterSpacing: 1,
  },

  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  previewLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },

  previewValue: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },

  nightPreviewValue: {
    color: COLORS.accentText,
    fontSize: 12,
    fontWeight: '900',
  },

  previewTime: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },

  /* =======================================================
     FULL DELETE BUTTON
  ======================================================= */

  deleteFullButton: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  deleteFullButtonText: {
    color: COLORS.dangerText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
});