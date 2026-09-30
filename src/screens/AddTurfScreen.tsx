import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File, UploadType } from 'expo-file-system';

/* =========================================================
   API
========================================================= */

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

  info: '#2563EB',
  infoLight: '#DBEAFE',
  infoSoft: '#EFF6FF',
  infoText: '#1E40AF',

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

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  warningBorder: '#FDE68A',
  warningText: '#92400E',

  white: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.45)',
};

/* =========================================================
   TYPES
========================================================= */

interface AddTurfScreenProps {
  navigation: any;
  route?: any;
  user?: {
    _id?: string;
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  };
}

/* =========================================================
   COMPONENT
========================================================= */

const AddTurfScreen: React.FC<AddTurfScreenProps> = ({
  navigation,
  route,
  user,
}) => {
  /* OWNER */
  const ownerId =
    user?._id ||
    user?.id ||
    route?.params?.ownerId ||
    route?.params?.user?._id ||
    route?.params?.user?.id ||
    '';

  /* TURF DETAILS */
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [amenities, setAmenities] = useState('');

  /* IMAGE */
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  /* LOCATION */
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  /* OPERATING HOURS */
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('23:00');

  /* LOADING */
  const [loading, setLoading] = useState(false);

  /* FORMAT TIME INPUT */
  const formatTimeInput = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const numbersOnly = value.replace(/\D/g, '').slice(0, 4);

    if (numbersOnly.length <= 2) {
      setter(numbersOnly);
      return;
    }

    setter(`${numbersOnly.slice(0, 2)}:${numbersOnly.slice(2, 4)}`);
  };

  const isValidTime = (time: string): boolean => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  };

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const formatTimeForDisplay = (time: string): string => {
    if (!isValidTime(time)) return '--:--';

    const [hourString, minuteString] = time.split(':');

    let hour = Number(hourString);
    const period = hour >= 12 ? 'PM' : 'AM';

    if (hour === 0) {
      hour = 12;
    } else if (hour > 12) {
      hour -= 12;
    }

    return `${hour}:${minuteString} ${period}`;
  };

  /* VALIDATE OPERATING HOURS */
  const validateOperatingHours = (): boolean => {
    if (!openingTime.trim()) {
      Alert.alert('Opening Time Required', 'Please enter the turf opening time.');
      return false;
    }

    if (!closingTime.trim()) {
      Alert.alert('Closing Time Required', 'Please enter the turf closing time.');
      return false;
    }

    if (!isValidTime(openingTime)) {
      Alert.alert(
        'Invalid Opening Time',
        'Please enter a valid time in HH:MM format.\n\nExample: 06:00'
      );
      return false;
    }

    if (!isValidTime(closingTime)) {
      Alert.alert(
        'Invalid Closing Time',
        'Please enter a valid time in HH:MM format.\n\nExample: 23:00'
      );
      return false;
    }

    const openingMinutes = timeToMinutes(openingTime);
    const closingMinutes = timeToMinutes(closingTime);

    if (closingMinutes <= openingMinutes) {
      Alert.alert(
        'Invalid Operating Hours',
        'Closing time must be later than opening time.'
      );
      return false;
    }

    return true;
  };

  /* VALIDATE LOCATION */
  const validateLocation = (): { latitude: number; longitude: number } | null => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      !Number.isFinite(parsedLatitude) ||
      !Number.isFinite(parsedLongitude)
    ) {
      Alert.alert(
        'Location Required',
        'Please enter valid latitude and longitude.'
      );
      return null;
    }

    if (parsedLatitude < -90 || parsedLatitude > 90) {
      Alert.alert('Invalid Latitude', 'Latitude must be between -90 and 90.');
      return null;
    }

    if (parsedLongitude < -180 || parsedLongitude > 180) {
      Alert.alert(
        'Invalid Longitude',
        'Longitude must be between -180 and 180.'
      );
      return null;
    }

    return { latitude: parsedLatitude, longitude: parsedLongitude };
  };

  /* IMAGE UPLOAD */
  const uploadImageToCloudinary = async (
    selectedImageUri: string
  ): Promise<string> => {
    if (!selectedImageUri) {
      throw new Error('No image was selected.');
    }

    const file = new File(selectedImageUri);

    if (!file.exists) {
      throw new Error('Selected image file does not exist on the device.');
    }

    if (!file.size || file.size <= 0) {
      throw new Error('Selected image file is empty.');
    }

    const mimeType = file.type || 'image/jpeg';
    const uploadUrl = `${API_BASE_URL}/upload/turf-image`;

    const result = await file.upload(uploadUrl, {
      httpMethod: 'POST',
      uploadType: UploadType.MULTIPART,
      fieldName: 'image',
      mimeType,
      headers: { Accept: 'application/json' },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `Image upload failed (${result.status}): ${result.body}`
      );
    }

    let data: any;

    try {
      data = JSON.parse(result.body);
    } catch {
      throw new Error('Backend returned an invalid JSON response.');
    }

    if (!data?.url) {
      throw new Error(
        data?.error ||
          'Image uploaded but server did not return an image URL.'
      );
    }

    return data.url;
  };

  /* PICK IMAGE */
  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access to select a turf image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert('Image Error', 'Could not get the selected image.');
        return;
      }

      setImageUri(asset.uri);
      setUploadedImageUrl('');
      setImageUploading(true);

      try {
        const imageUrl = await uploadImageToCloudinary(asset.uri);
        setUploadedImageUrl(imageUrl);
        Alert.alert('Upload Successful', 'Turf image uploaded successfully.');
      } catch (error) {
        setImageUri(null);
        setUploadedImageUrl('');
        Alert.alert(
          'Upload Failed',
          error instanceof Error ? error.message : 'Could not upload the image.'
        );
      } finally {
        setImageUploading(false);
      }
    } catch (error) {
      setImageUploading(false);
      Alert.alert(
        'Image Error',
        error instanceof Error ? error.message : 'Could not select the image.'
      );
    }
  };

  /* CREATE TURF */
  const handleSubmit = async () => {
    if (loading) return;

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter the turf name.');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please enter the turf address.');
      return;
    }

    if (!city.trim()) {
      Alert.alert('Validation Error', 'Please enter the city.');
      return;
    }

    if (!ownerId) {
      Alert.alert(
        'Owner ID Required',
        'Logged-in owner information was not found. Please login again.'
      );
      return;
    }

    if (imageUploading) {
      Alert.alert('Please Wait', 'The turf image is still uploading.');
      return;
    }

    if (!uploadedImageUrl) {
      Alert.alert(
        'Image Required',
        'Please select a turf image and wait for the upload to finish.'
      );
      return;
    }

    const location = validateLocation();
    if (!location) return;

    if (!validateOperatingHours()) return;

    try {
      setLoading(true);

      const amenityList = amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        owner: ownerId,
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        location: {
          type: 'Point',
          coordinates: [location.longitude, location.latitude],
        },
        images: [{ url: uploadedImageUrl, isPrimary: true }],
        amenities: amenityList,
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
      };

      console.log('CREATE TURF PAYLOAD:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${API_BASE_URL}/turfs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let data: any = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.details ||
            `Failed to create turf (${response.status}).`
        );
      }

      Alert.alert(
        'Turf Created Successfully',
        'Your turf has been created. Now add the courts.',
        [
          {
            text: 'Add Court',
            onPress: () => {
              navigation.navigate('AddCourtScreen', {
                turfId: data?.turf?._id || data?._id,
                turf: data?.turf || data,
              });
            },
          },
          {
            text: 'Done',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Create turf error:', error);
      Alert.alert(
        'Create Turf Failed',
        error instanceof Error ? error.message : 'Unable to create turf.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <View style={styles.headerBadgeRow}>
                <Text style={styles.headerBadge}>🏟️ NEW TURF</Text>
              </View>

              <Text style={styles.headerTitle}>Add Turf</Text>

              <Text style={styles.headerSubtitle}>
                Create and manage your turf venue
              </Text>
            </View>
          </View>

          {/* =========================================
              BASIC DETAILS
          ========================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>1</Text>
              </View>

              <View style={styles.sectionHeaderText}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Basic Details</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <Text style={styles.sectionSubtitle}>
                  Enter information about your venue
                </Text>
              </View>
            </View>

            {/* NAME */}
            <Text style={styles.label}>TURF NAME *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. City Sports Arena"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="words"
            />

            {/* DESCRIPTION */}
            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your turf, facilities and services"
              placeholderTextColor={COLORS.placeholder}
              style={[styles.input, styles.textArea]}
              multiline
              textAlignVertical="top"
            />

            {/* ADDRESS */}
            <Text style={styles.label}>ADDRESS *</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter complete turf address"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />

            {/* CITY */}
            <Text style={styles.label}>CITY *</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Enter city"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              autoCapitalize="words"
            />

            {/* AMENITIES */}
            <Text style={styles.label}>AMENITIES</Text>
            <TextInput
              value={amenities}
              onChangeText={setAmenities}
              placeholder="Parking, Washroom, Changing Room"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
            />

            <Text style={styles.helperText}>
              Separate multiple amenities with commas.
            </Text>
          </View>

          {/* =========================================
              IMAGE
          ========================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>2</Text>
              </View>

              <View style={styles.sectionHeaderText}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Turf Image</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <Text style={styles.sectionSubtitle}>
                  Add a clear photo of your venue
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                imageUploading && styles.disabledButton,
              ]}
              onPress={pickImage}
              disabled={imageUploading}
              activeOpacity={0.8}
            >
              {imageUploading ? (
                <View style={styles.uploadButtonContent}>
                  <ActivityIndicator size="small" color={COLORS.primaryDark} />
                  <Text style={styles.imagePickerButtonText}>
                    Uploading Image...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.plusCircle}>
                    <Text style={styles.plusText}>+</Text>
                  </View>
                  <Text style={styles.imagePickerButtonText}>
                    {imageUri ? 'Change Turf Image' : 'Select Turf Image'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {imageUri && (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  resizeMode="cover"
                />

                {imageUploading && (
                  <View style={styles.imageUploadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.white} />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}

                {!imageUploading && uploadedImageUrl ? (
                  <View style={styles.imageSuccessBadge}>
                    <Text style={styles.imageSuccessBadgeText}>
                      ✓ UPLOADED
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {uploadedImageUrl ? (
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeText}>
                  ✓ Image uploaded successfully
                </Text>
              </View>
            ) : null}
          </View>

          {/* =========================================
              LOCATION
          ========================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>3</Text>
              </View>

              <View style={styles.sectionHeaderText}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Location</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <Text style={styles.sectionSubtitle}>
                  Add your turf coordinates for maps
                </Text>
              </View>
            </View>

            <View style={styles.locationInfo}>
              <View style={styles.locationInfoIconCircle}>
                <Text style={styles.locationInfoIcon}>i</Text>
              </View>

              <Text style={styles.locationInfoText}>
                Enter the exact latitude and longitude of your turf.
              </Text>
            </View>

            <Text style={styles.label}>LATITUDE *</Text>
            <TextInput
              value={latitude}
              onChangeText={setLatitude}
              placeholder="Example: 16.8524"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>LONGITUDE *</Text>
            <TextInput
              value={longitude}
              onChangeText={setLongitude}
              placeholder="Example: 74.5815"
              placeholderTextColor={COLORS.placeholder}
              style={styles.input}
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.helperText}>
              Coordinates are stored as GeoJSON: [longitude, latitude].
            </Text>
          </View>

          {/* =========================================
              OPERATING HOURS
          ========================================= */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIcon}>
                <Text style={styles.sectionIconText}>4</Text>
              </View>

              <View style={styles.sectionHeaderText}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Operating Hours</Text>
                  <View style={styles.sectionTitleAccent} />
                </View>

                <Text style={styles.sectionSubtitle}>
                  Set when your turf is open
                </Text>
              </View>
            </View>

            {/* INFO */}
            <View style={styles.hoursInfoBox}>
              <Text style={styles.hoursInfoTitle}>Turf-wide timing</Text>
              <Text style={styles.hoursInfoText}>
                These opening and closing times will apply to all courts in
                this turf.
              </Text>
            </View>

            {/* TIME ROW */}
            <View style={styles.timeRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>OPENING TIME</Text>
                <TextInput
                  value={openingTime}
                  onChangeText={(value) =>
                    formatTimeInput(value, setOpeningTime)
                  }
                  placeholder="06:00"
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.timeInput}
                  keyboardType="number-pad"
                  maxLength={5}
                  selectTextOnFocus={false}
                />
                <Text style={styles.timeHint}>
                  {isValidTime(openingTime)
                    ? formatTimeForDisplay(openingTime)
                    : 'HH:MM'}
                </Text>
              </View>

              <View style={styles.toContainer}>
                <View style={styles.toCircle}>
                  <Text style={styles.toText}>→</Text>
                </View>
              </View>

              <View style={styles.timeInputContainer}>
                <Text style={styles.timeLabel}>CLOSING TIME</Text>
                <TextInput
                  value={closingTime}
                  onChangeText={(value) =>
                    formatTimeInput(value, setClosingTime)
                  }
                  placeholder="23:00"
                  placeholderTextColor={COLORS.placeholder}
                  style={styles.timeInput}
                  keyboardType="number-pad"
                  maxLength={5}
                  selectTextOnFocus={false}
                />
                <Text style={styles.timeHint}>
                  {isValidTime(closingTime)
                    ? formatTimeForDisplay(closingTime)
                    : 'HH:MM'}
                </Text>
              </View>
            </View>

            {/* SCHEDULE PREVIEW */}
            {isValidTime(openingTime) && isValidTime(closingTime) && (
              <View style={styles.schedulePreview}>
                <View>
                  <Text style={styles.schedulePreviewLabel}>
                    TURF WILL BE OPEN
                  </Text>
                  <Text style={styles.schedulePreviewValue}>
                    {formatTimeForDisplay(openingTime)} –{' '}
                    {formatTimeForDisplay(closingTime)}
                  </Text>
                </View>

                <View style={styles.openBadge}>
                  <View style={styles.openDot} />
                  <Text style={styles.openBadgeText}>OPEN</Text>
                </View>
              </View>
            )}

            <View style={styles.defaultHoursBox}>
              <Text style={styles.defaultHoursIcon}>✓</Text>
              <Text style={styles.defaultHoursText}>
                Default timing is{' '}
                <Text style={styles.defaultHoursBold}>
                  06:00 AM – 11:00 PM
                </Text>
              </Text>
            </View>

            <Text style={styles.hoursNote}>
              Use 24-hour format when entering time. For example, 06:00 means
              6:00 AM and 23:00 means 11:00 PM.
            </Text>
          </View>

          {/* =========================================
              INFO CARD
          ========================================= */}
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <View style={styles.infoIconCircle}>
                <Text style={styles.infoIcon}>i</Text>
              </View>

              <Text style={styles.infoTitle}>Turf & Court Structure</Text>
            </View>

            <Text style={styles.infoText}>
              This screen creates the main turf venue.
            </Text>
            <Text style={styles.infoText}>
              After creating the turf, you can add individual courts with their
              sport and hourly price.
            </Text>
            <Text style={styles.infoText}>
              The turf operating hours will be used when creating and managing
              court slots.
            </Text>
          </View>

          {/* =========================================
              SUBMIT BUTTON
          ========================================= */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (loading || imageUploading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || imageUploading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.submitButtonContent}>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={styles.submitButtonText}>Creating Turf...</Text>
              </View>
            ) : (
              <View style={styles.submitButtonContent}>
                <Text style={styles.submitButtonIcon}>+</Text>
                <Text style={styles.submitButtonText}>CREATE TURF</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.requiredText}>* Required fields</Text>

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  backButtonText: {
    fontSize: 32,
    lineHeight: 34,
    color: COLORS.primaryDark,
    marginTop: -3,
    fontWeight: '600',
  },

  headerTextContainer: {
    flex: 1,
  },

  headerBadgeRow: {
    marginBottom: 6,
  },

  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  /* CARD */

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  /* SECTION HEADER */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },

  sectionIconText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.white,
  },

  sectionHeaderText: {
    flex: 1,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 18,
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

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 3,
    fontWeight: '500',
  },

  /* INPUTS */

  label: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 8,
    marginTop: 14,
    letterSpacing: 1,
  },

  input: {
    width: '100%',
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.primarySoft,
    fontWeight: '500',
  },

  textArea: {
    minHeight: 110,
    paddingTop: 14,
  },

  helperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 8,
    lineHeight: 17,
    fontWeight: '500',
  },

  /* IMAGE */

  imagePickerButton: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  disabledButton: {
    opacity: 0.6,
  },

  plusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  plusText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginTop: -1,
  },

  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  imagePickerButtonText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  imagePreviewContainer: {
    width: '100%',
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    position: 'relative',
  },

  imagePreview: {
    width: '100%',
    height: '100%',
  },

  imageUploadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadingText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
    letterSpacing: 0.5,
  },

  imageSuccessBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },

  imageSuccessBadgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  successBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  successBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  /* LOCATION */

  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.infoSoft,
    borderWidth: 1,
    borderColor: COLORS.infoLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },

  locationInfoIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  locationInfoIcon: {
    fontSize: 13,
    color: COLORS.info,
    fontWeight: '900',
  },

  locationInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.infoText,
    fontWeight: '500',
  },

  /* OPERATING HOURS */

  hoursInfoBox: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },

  hoursInfoTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primaryDeep,
    marginBottom: 4,
    letterSpacing: 0.2,
  },

  hoursInfoText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.primaryDark,
    fontWeight: '500',
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  timeInputContainer: {
    flex: 1,
  },

  timeLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 8,
    letterSpacing: 1,
  },

  timeInput: {
    height: 56,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
    backgroundColor: COLORS.primarySoft,
    textAlign: 'center',
  },

  timeHint: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
    fontWeight: '600',
  },

  toContainer: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 22,
  },

  toCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  toText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },

  schedulePreview: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.primaryFaint,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  schedulePreviewLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginBottom: 4,
    fontWeight: '900',
    letterSpacing: 1,
  },

  schedulePreviewValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  openDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 6,
  },

  openBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.8,
  },

  defaultHoursBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningSoft,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 12,
    padding: 12,
  },

  defaultHoursIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.warningBorder,
    color: COLORS.warningText,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 12,
    fontWeight: '900',
    marginRight: 10,
    overflow: 'hidden',
  },

  defaultHoursText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.warningText,
    lineHeight: 18,
    fontWeight: '500',
  },

  defaultHoursBold: {
    fontWeight: '900',
    color: '#78350F',
  },

  hoursNote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  /* INFO CARD */

  infoCard: {
    backgroundColor: COLORS.infoSoft,
    borderWidth: 1,
    borderColor: COLORS.infoLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  infoIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  infoIcon: {
    fontSize: 13,
    color: COLORS.info,
    fontWeight: '900',
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E3A8A',
    letterSpacing: 0.2,
  },

  infoText: {
    fontSize: 12,
    color: COLORS.infoText,
    lineHeight: 18,
    marginTop: 5,
    fontWeight: '500',
  },

  /* SUBMIT */

  submitButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  submitButtonIcon: {
    fontSize: 22,
    lineHeight: 22,
    color: COLORS.white,
    fontWeight: '900',
  },

  submitButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  requiredText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  bottomSpacing: {
    height: 20,
  },
});

export default AddTurfScreen;