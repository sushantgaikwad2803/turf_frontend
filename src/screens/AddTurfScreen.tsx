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
import * as Location from 'expo-location';
import { File, UploadType } from 'expo-file-system';

/* =========================================================
   API CONFIGURATION
========================================================= */

const RAW_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || '';

const normalizeApiBaseUrl = (value: string): string => {
  let url = value.trim();

  url = url.replace(/^["']|["']$/g, '');
  url = url.replace(/\/+$/, '');

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  if (!/\/api$/i.test(url)) {
    url = `${url}/api`;
  }

  return url;
};

const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

const validateApiUrl = (): void => {
  if (!API_BASE_URL) {
    throw new Error(
      'API URL is missing. Please configure EXPO_PUBLIC_API_URL.',
    );
  }

  try {
    const parsedUrl = new URL(API_BASE_URL);

    if (
      parsedUrl.protocol !== 'http:' &&
      parsedUrl.protocol !== 'https:'
    ) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }
  } catch {
    throw new Error(
      `Invalid API URL:\n\n${API_BASE_URL}\n\nExpected format:\nhttps://your-backend-url/api`,
    );
  }
};

console.log('========================================');
console.log('TURFBOOK API CONFIGURATION');
console.log('RAW API URL:', RAW_API_BASE_URL);
console.log('FINAL API URL:', API_BASE_URL);
console.log('TURFS URL:', `${API_BASE_URL}/turfs`);
console.log('IMAGE URL:', `${API_BASE_URL}/upload/turf-image`);
console.log('========================================');

/* =========================================================
   THEME
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

  bg: '#FFFFFF',
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

  warning: '#F59E0B',
  warningSoft: '#FEF3C7',

  white: '#FFFFFF',
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

interface TurfImage {
  url: string;
  isPrimary: boolean;
}

/* =========================================================
   COMPONENT
========================================================= */

const AddTurfScreen: React.FC<AddTurfScreenProps> = ({
  navigation,
  route,
  user,
}) => {
  /* =======================================================
     OWNER
  ======================================================= */

  const ownerId =
    user?._id ||
    user?.id ||
    route?.params?.ownerId ||
    route?.params?.user?._id ||
    route?.params?.user?.id ||
    '';

  /* =======================================================
     TURF DETAILS

     IMPORTANT:
     Turf contains only venue-level details.
     Court-specific details such as:
       ❌ pricePerHour
       ❌ sports
       ❌ openingTime
       ❌ closingTime
       ❌ operatingHours
     are managed by Court.

     Turf location is stored as GeoJSON:
       location: {
         type: 'Point',
         coordinates: [longitude, latitude],
       }
  ======================================================= */

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [amenities, setAmenities] = useState('');

  /* =======================================================
     TURF LOCATION

     Backend requires:
       location.type = "Point"
       location.coordinates = [longitude, latitude]
  ======================================================= */

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  /* =======================================================
     IMAGE
  ======================================================= */

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);

  /* =======================================================
     LOADING
  ======================================================= */

  const [loading, setLoading] = useState(false);

  /* =======================================================
     IMAGE UPLOAD
  ======================================================= */

  const uploadImageToBackend = async (
    selectedImageUri: string,
  ): Promise<string> => {
    if (!selectedImageUri) {
      throw new Error('No image was selected.');
    }

    validateApiUrl();

    const file = new File(selectedImageUri);

    if (!file.exists) {
      throw new Error(
        'Selected image file does not exist on the device.',
      );
    }

    if (!file.size || file.size <= 0) {
      throw new Error(
        'Selected image file is empty.',
      );
    }

    const mimeType = file.type || 'image/jpeg';
    const uploadUrl = `${API_BASE_URL}/upload/turf-image`;

    console.log('========================================');
    console.log('IMAGE UPLOAD START');
    console.log('UPLOAD URL:', uploadUrl);
    console.log('FILE URI:', selectedImageUri);
    console.log('MIME TYPE:', mimeType);
    console.log('========================================');

    try {
      const result = await file.upload(
        uploadUrl,
        {
          httpMethod: 'POST',
          uploadType: UploadType.MULTIPART,
          fieldName: 'image',
          mimeType,
          headers: {
            Accept: 'application/json',
          },
        },
      );

      console.log(
        'IMAGE UPLOAD STATUS:',
        result.status,
      );

      console.log(
        'IMAGE UPLOAD RESPONSE:',
        result.body,
      );

      if (
        result.status < 200 ||
        result.status >= 300
      ) {
        throw new Error(
          `Image upload failed (${result.status}): ${
            result.body || 'Unknown server error'
          }`,
        );
      }

      let data: any;

      try {
        data = JSON.parse(result.body);
      } catch {
        throw new Error(
          'Backend returned invalid JSON while uploading the image.',
        );
      }

      const imageUrl =
        data?.url ||
        data?.imageUrl ||
        data?.secure_url ||
        data?.image?.url;

      if (!imageUrl) {
        throw new Error(
          data?.error ||
            data?.message ||
            'Image uploaded but server did not return an image URL.',
        );
      }

      console.log(
        'UPLOADED IMAGE URL:',
        imageUrl,
      );

      return String(imageUrl);
    } catch (error) {
      console.error(
        'IMAGE UPLOAD ERROR:',
        error,
      );

      if (error instanceof Error) {
        throw new Error(
          `Image upload failed.\n\n${error.message}`,
        );
      }

      throw new Error(
        'Unable to upload turf image.',
      );
    }
  };

  /* =======================================================
     PICK IMAGE
  ======================================================= */

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow photo library access to select a turf image.',
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert(
          'Image Error',
          'Could not get the selected image.',
        );
        return;
      }

      setImageUri(asset.uri);
      setUploadedImageUrl('');
      setImageUploading(true);

      try {
        const imageUrl =
          await uploadImageToBackend(asset.uri);

        setUploadedImageUrl(imageUrl);

        Alert.alert(
          'Upload Successful',
          'Turf image uploaded successfully.',
        );
      } catch (error) {
        setImageUri(null);
        setUploadedImageUrl('');

        Alert.alert(
          'Upload Failed',
          error instanceof Error
            ? error.message
            : 'Could not upload the image.',
        );
      } finally {
        setImageUploading(false);
      }
    } catch (error) {
      setImageUploading(false);

      Alert.alert(
        'Image Error',
        error instanceof Error
          ? error.message
          : 'Could not select the image.',
      );
    }
  };

  /* =======================================================
     GET CURRENT LOCATION
  ======================================================= */

  const getCurrentLocation = async () => {
    if (locationLoading) {
      return;
    }

    try {
      setLocationLoading(true);

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please allow location access so the turf can be saved on the map.',
        );
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const nextLatitude =
        currentLocation.coords.latitude;

      const nextLongitude =
        currentLocation.coords.longitude;

      if (
        !Number.isFinite(nextLatitude) ||
        !Number.isFinite(nextLongitude) ||
        nextLatitude < -90 ||
        nextLatitude > 90 ||
        nextLongitude < -180 ||
        nextLongitude > 180
      ) {
        throw new Error(
          'The device returned an invalid latitude or longitude.',
        );
      }

      setLatitude(nextLatitude);
      setLongitude(nextLongitude);

      console.log('========================================');
      console.log('TURF LOCATION CAPTURED');
      console.log('LATITUDE:', nextLatitude);
      console.log('LONGITUDE:', nextLongitude);
      console.log(
        'GEOJSON:',
        [nextLongitude, nextLatitude],
      );
      console.log('========================================');

      Alert.alert(
        'Location Captured',
        'Your current turf location has been selected successfully.',
      );
    } catch (error) {
      console.error(
        'GET TURF LOCATION ERROR:',
        error,
      );

      Alert.alert(
        'Location Error',
        error instanceof Error
          ? error.message
          : 'Unable to get your current location.',
      );
    } finally {
      setLocationLoading(false);
    }
  };

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert(
        'Validation Error',
        'Please enter the turf name.',
      );
      return false;
    }

    if (!address.trim()) {
      Alert.alert(
        'Validation Error',
        'Please enter the turf address.',
      );
      return false;
    }

    if (!city.trim()) {
      Alert.alert(
        'Validation Error',
        'Please enter the city.',
      );
      return false;
    }

    if (!ownerId) {
      Alert.alert(
        'Owner ID Required',
        'Logged-in owner information was not found. Please login again.',
      );
      return false;
    }

    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      Alert.alert(
        'Location Required',
        'Please select the turf location using the "Use Current Location" button.',
      );
      return false;
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      Alert.alert(
        'Invalid Location',
        'The selected latitude or longitude is outside the valid range.',
      );
      return false;
    }

    if (imageUploading) {
      Alert.alert(
        'Please Wait',
        'The turf image is still uploading.',
      );
      return false;
    }

    if (!uploadedImageUrl) {
      Alert.alert(
        'Image Required',
        'Please select a turf image and wait for the upload to finish.',
      );
      return false;
    }

    return true;
  };

  /* =======================================================
     CREATE TURF
  ======================================================= */

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      validateApiUrl();
      setLoading(true);

      const amenityList = amenities
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      /*
       * =====================================================
       * IMPORTANT NEW TURF PAYLOAD
       *
       * Only fields that belong to Turf are sent.
       *
       * Removed completely because these belong to Court:
       * ❌ pricePerHour
       * ❌ sports
       * ❌ openingTime
       * ❌ closingTime
       * ❌ operatingHours
       *
       * Required Turf location:
       * ✅ GeoJSON Point
       * ✅ coordinates [longitude, latitude]
       * =====================================================
       */

      const cleanOwnerId = ownerId.trim();

      console.log('OWNER ID CHECK:', {
        ownerId: cleanOwnerId,
        hasOwnerId: Boolean(cleanOwnerId),
        ownerIdLength: cleanOwnerId.length,
      });

      const payload = {
        owner: cleanOwnerId,

        name: name.trim(),

        description: description.trim(),

        address: address.trim(),

        city: city.trim(),

        location: {
          type: 'Point' as const,
          coordinates: [
            longitude,
            latitude,
          ] as [number, number],
        },

        images: [
          {
            url: uploadedImageUrl,
            isPrimary: true,
          } satisfies TurfImage,
        ],

        amenities: amenityList,
      };

      const turfUrl = `${API_BASE_URL}/turfs`;

      console.log('========================================');
      console.log('CREATE TURF REQUEST');
      console.log('API URL:', turfUrl);
      console.log(
        'LOCATION:',
        {
          latitude,
          longitude,
          geoJsonCoordinates: [
            longitude,
            latitude,
          ],
        },
      );

      console.log(
        'PAYLOAD:',
        JSON.stringify(payload, null, 2),
      );
      console.log('========================================');

      const response = await fetch(
        turfUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      const responseText =
        await response.text();

      console.log(
        'CREATE TURF STATUS:',
        response.status,
      );

      console.log(
        'CREATE TURF RESPONSE:',
        responseText,
      );

      let data: any = {};

      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = {};
        }
      }

      /* =====================================================
         SERVER ERROR
      ===================================================== */

      if (!response.ok) {
        /*
         * IMPORTANT:
         * Your backend returns:
         *
         * {
         *   success: false,
         *   error: "Failed to create turf.",
         *   details: "ACTUAL MONGOOSE / SERVER ERROR",
         *   name: "ValidationError"
         * }
         *
         * Always prefer `details` over the generic `error`
         * so the real backend problem is visible in the app.
         */
        const serverDetails =
          typeof data?.details === 'string'
            ? data.details.trim()
            : '';

        const serverError =
          typeof data?.error === 'string'
            ? data.error.trim()
            : '';

        const serverMessage =
          typeof data?.message === 'string'
            ? data.message.trim()
            : '';

        const rawResponse =
          typeof responseText === 'string'
            ? responseText.trim()
            : '';

        const bestServerReason =
          serverDetails ||
          serverMessage ||
          serverError ||
          rawResponse ||
          `Failed to create turf (${response.status}).`;

        console.error(
          '========================================',
        );
        console.error(
          'CREATE TURF SERVER ERROR DETAILS',
        );
        console.error(
          'HTTP STATUS:',
          response.status,
        );
        console.error(
          'SERVER ERROR:',
          serverError || '(none)',
        );
        console.error(
          'SERVER DETAILS:',
          serverDetails || '(none)',
        );
        console.error(
          'SERVER MESSAGE:',
          serverMessage || '(none)',
        );
        console.error(
          'SERVER ERROR NAME:',
          data?.name || '(none)',
        );
        console.error(
          'RAW RESPONSE:',
          rawResponse || '(empty)',
        );
        console.error(
          '========================================',
        );

        throw new Error(
          `Server returned ${response.status}: ${bestServerReason}`,
        );
      }

      /* =====================================================
         CREATED TURF
      ===================================================== */

      const createdTurf =
        data?.turf || data?.data || data;

      const turfId =
        createdTurf?._id ||
        createdTurf?.id ||
        data?.turfId;

      console.log(
        'CREATED TURF:',
        createdTurf,
      );

      console.log(
        'CREATED TURF ID:',
        turfId,
      );

      /* =====================================================
         SUCCESS
      ===================================================== */

      Alert.alert(
        'Turf Submitted Successfully',
        'Your turf has been submitted and is waiting for admin approval. You can continue to add courts.',
        [
          {
            text: 'Add Court',
            onPress: () => {
              navigation.navigate(
                'AddCourtScreen',
                {
                  turfId,
                  turf: createdTurf,
                },
              );
            },
          },
          {
            text: 'Done',
            style: 'cancel',
            onPress: () => {
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        '========================================',
      );

      console.error(
        'CREATE TURF ERROR:',
        error,
      );

      console.error(
        'CREATE TURF ERROR MESSAGE:',
        error instanceof Error
          ? error.message
          : String(error),
      );

      console.error(
        'CREATE TURF REQUEST URL:',
        `${API_BASE_URL}/turfs`,
      );

      console.error(
        'CREATE TURF OWNER ID:',
        ownerId,
      );

      console.error(
        '========================================',
      );

      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Unable to create turf.';

      Alert.alert(
        'Create Turf Failed',
        message,
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                navigation.goBack()
              }
              activeOpacity={0.7}
            >
              <Text
                style={styles.backButtonText}
              >
                ‹
              </Text>
            </TouchableOpacity>

            <View
              style={
                styles.headerTextContainer
              }
            >
              <View
                style={
                  styles.headerBadgeRow
                }
              >
                <Text
                  style={styles.headerBadge}
                >
                  🏟️ NEW TURF
                </Text>
              </View>

              <Text
                style={styles.headerTitle}
              >
                Add Turf
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                Create and manage your
                turf venue
              </Text>
            </View>
          </View>

          {/* =================================================
              BASIC DETAILS
          ================================================= */}

          <View style={styles.card}>
            <SectionHeader
              number="1"
              title="Basic Details"
              subtitle="Enter information about your venue"
            />

            <Text style={styles.label}>
              TURF NAME *
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. City Sports Arena"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>
              DESCRIPTION
            </Text>

            <TextInput
              value={description}
              onChangeText={
                setDescription
              }
              placeholder="Describe your turf, facilities and services"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={[
                styles.input,
                styles.textArea,
              ]}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>
              ADDRESS *
            </Text>

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Enter complete turf address"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={styles.input}
            />

            <Text style={styles.label}>
              CITY *
            </Text>

            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Enter city"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>
              AMENITIES
            </Text>

            <TextInput
              value={amenities}
              onChangeText={setAmenities}
              placeholder="Parking, Washroom, Changing Room"
              placeholderTextColor={
                COLORS.placeholder
              }
              style={styles.input}
            />

            <Text
              style={styles.helperText}
            >
              Separate multiple amenities
              with commas.
            </Text>
          </View>

          {/* =================================================
              LOCATION
          ================================================= */}

          <View style={styles.card}>
            <SectionHeader
              number="2"
              title="Turf Location"
              subtitle="Select the exact venue location"
            />

            <View style={styles.locationInfoBox}>
              <View style={styles.locationInfoIcon}>
                <Text style={styles.locationInfoIconText}>
                  📍
                </Text>
              </View>

              <View style={styles.locationInfoContent}>
                <Text style={styles.locationInfoTitle}>
                  Map Location Required
                </Text>

                <Text style={styles.locationInfoText}>
                  Your turf location is saved as GeoJSON
                  coordinates for nearby turf search and maps.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.locationButton,
                locationLoading &&
                  styles.locationButtonDisabled,
              ]}
              onPress={getCurrentLocation}
              disabled={locationLoading}
              activeOpacity={0.82}
            >
              {locationLoading ? (
                <View style={styles.locationButtonContent}>
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                  />

                  <Text style={styles.locationButtonText}>
                    Getting Location...
                  </Text>
                </View>
              ) : (
                <View style={styles.locationButtonContent}>
                  <Text style={styles.locationButtonIcon}>
                    📍
                  </Text>

                  <Text style={styles.locationButtonText}>
                    {latitude !== null &&
                    longitude !== null
                      ? 'Update Turf Location'
                      : 'Use Current Location'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {latitude !== null &&
              longitude !== null && (
                <View style={styles.coordinatesCard}>
                  <View style={styles.coordinateRow}>
                    <Text style={styles.coordinateLabel}>
                      Latitude
                    </Text>

                    <Text style={styles.coordinateValue}>
                      {latitude.toFixed(6)}
                    </Text>
                  </View>

                  <View style={styles.coordinateDivider} />

                  <View style={styles.coordinateRow}>
                    <Text style={styles.coordinateLabel}>
                      Longitude
                    </Text>

                    <Text style={styles.coordinateValue}>
                      {longitude.toFixed(6)}
                    </Text>
                  </View>

                  <View style={styles.geoJsonBox}>
                    <Text style={styles.geoJsonLabel}>
                      GeoJSON coordinates
                    </Text>

                    <Text style={styles.geoJsonValue}>
                      [{longitude.toFixed(6)}, {latitude.toFixed(6)}]
                    </Text>
                  </View>

                  <View style={styles.locationSuccessRow}>
                    <Text style={styles.locationSuccessIcon}>
                      ✓
                    </Text>

                    <Text style={styles.locationSuccessText}>
                      Turf location is ready to submit
                    </Text>
                  </View>
                </View>
              )}

            {latitude === null &&
              longitude === null && (
                <Text style={styles.locationHelperText}>
                  Location is required before you can create the turf.
                </Text>
              )}
          </View>

          {/* =================================================
              IMAGE
          ================================================= */}

          <View style={styles.card}>
            <SectionHeader
              number="3"
              title="Turf Image"
              subtitle="Add a clear photo of your venue"
            />

            <TouchableOpacity
              style={[
                styles.imagePickerButton,
                imageUploading &&
                  styles.disabledButton,
              ]}
              onPress={pickImage}
              disabled={imageUploading}
              activeOpacity={0.8}
            >
              {imageUploading ? (
                <View
                  style={
                    styles.uploadButtonContent
                  }
                >
                  <ActivityIndicator
                    size="small"
                    color={
                      COLORS.primaryDark
                    }
                  />

                  <Text
                    style={
                      styles.imagePickerButtonText
                    }
                  >
                    Uploading Image...
                  </Text>
                </View>
              ) : (
                <>
                  <View
                    style={styles.plusCircle}
                  >
                    <Text
                      style={styles.plusText}
                    >
                      +
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.imagePickerButtonText
                    }
                  >
                    {imageUri
                      ? 'Change Turf Image'
                      : 'Select Turf Image'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {imageUri && (
              <View
                style={
                  styles.imagePreviewContainer
                }
              >
                <Image
                  source={{
                    uri: imageUri,
                  }}
                  style={
                    styles.imagePreview
                  }
                  resizeMode="cover"
                />

                {imageUploading && (
                  <View
                    style={
                      styles.imageUploadingOverlay
                    }
                  >
                    <ActivityIndicator
                      size="large"
                      color={COLORS.white}
                    />

                    <Text
                      style={
                        styles.uploadingText
                      }
                    >
                      Uploading...
                    </Text>
                  </View>
                )}

                {!imageUploading &&
                  uploadedImageUrl && (
                    <View
                      style={
                        styles.imageSuccessBadge
                      }
                    >
                      <Text
                        style={
                          styles.imageSuccessBadgeText
                        }
                      >
                        ✓ UPLOADED
                      </Text>
                    </View>
                  )}
              </View>
            )}

            {uploadedImageUrl ? (
              <View
                style={
                  styles.successBadge
                }
              >
                <Text
                  style={
                    styles.successBadgeText
                  }
                >
                  ✓ Image uploaded
                  successfully
                </Text>
              </View>
            ) : null}
          </View>

          {/* =================================================
              STRUCTURE INFO
          ================================================= */}

          <View style={styles.infoCard}>
            <View
              style={styles.infoHeader}
            >
              <View
                style={
                  styles.infoIconCircle
                }
              >
                <Text
                  style={styles.infoIcon}
                >
                  i
                </Text>
              </View>

              <Text
                style={styles.infoTitle}
              >
                Turf & Court Structure
              </Text>
            </View>

            <Text style={styles.infoText}>
              This screen creates the main
              turf venue.
            </Text>

            <Text style={styles.infoText}>
              After creating the turf, you
              can add individual courts with
              their sport and hourly price.
            </Text>

            <Text style={styles.infoText}>
              Court-specific pricing, sport,
              slots and booking configuration
              should be managed from the
              court section.
            </Text>
          </View>

          {/* =================================================
              SUBMIT
          ================================================= */}

          <TouchableOpacity
            style={[
              styles.submitButton,
              (loading ||
                imageUploading) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={
              loading ||
              imageUploading
            }
            activeOpacity={0.85}
          >
            {loading ? (
              <View
                style={
                  styles.submitButtonContent
                }
              >
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  Creating Turf...
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.submitButtonContent
                }
              >
                <Text
                  style={
                    styles.submitButtonIcon
                  }
                >
                  +
                </Text>

                <Text
                  style={
                    styles.submitButtonText
                  }
                >
                  CREATE TURF
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Text
            style={styles.requiredText}
          >
            * Required fields
          </Text>

          <View
            style={styles.bottomSpacing}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/* =========================================================
   SECTION HEADER
========================================================= */

const SectionHeader = ({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) => {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Text
          style={styles.sectionIconText}
        >
          {number}
        </Text>
      </View>

      <View
        style={styles.sectionHeaderText}
      >
        <View
          style={styles.sectionTitleRow}
        >
          <Text
            style={styles.sectionTitle}
          >
            {title}
          </Text>

          <View
            style={
              styles.sectionTitleAccent
            }
          />
        </View>

        <Text
          style={styles.sectionSubtitle}
        >
          {subtitle}
        </Text>
      </View>
    </View>
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
    backgroundColor:
      COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    backgroundColor:
      COLORS.primarySoft,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  /* SECTION */

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
    shadowOffset: {
      width: 0,
      height: 3,
    },
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
    borderColor:
      COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor:
      COLORS.primarySoft,
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

  /* LOCATION */

  locationInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
  },

  locationInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  locationInfoIconText: {
    fontSize: 18,
  },

  locationInfoContent: {
    flex: 1,
  },

  locationInfoTitle: {
    color: COLORS.primaryDeep,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 3,
  },

  locationInfoText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    fontWeight: '500',
  },

  locationButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  locationButtonDisabled: {
    opacity: 0.65,
  },

  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationButtonIcon: {
    fontSize: 17,
    marginRight: 8,
  },

  locationButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  coordinatesCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: COLORS.cardSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },

  coordinateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  coordinateLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  coordinateValue: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  coordinateDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },

  geoJsonBox: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 10,
  },

  geoJsonLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  geoJsonValue: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },

  locationSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },

  locationSuccessIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 11,
    fontWeight: '900',
    marginRight: 7,
  },

  locationSuccessText: {
    flex: 1,
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '800',
  },

  locationHelperText: {
    marginTop: 9,
    color: COLORS.textMuted,
    fontSize: 11,
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
    backgroundColor:
      COLORS.primarySoft,
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
    backgroundColor:
      COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor:
      COLORS.borderSoft,
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
  },

  imagePickerButtonText: {
    color: COLORS.primaryDark,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
    marginLeft: 10,
  },

  imagePreviewContainer: {
    width: '100%',
    height: 210,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 14,
    backgroundColor:
      COLORS.cardSoft,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
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
    backgroundColor:
      'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  uploadingText: {
    color: COLORS.white,
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
  },

  imageSuccessBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor:
      COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  imageSuccessBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
  },

  successBadge: {
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor:
      COLORS.primarySoft,
    borderWidth: 1,
    borderColor:
      COLORS.borderSoft,
  },

  successBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },

  /* INFO */

  infoCard: {
    backgroundColor:
      COLORS.primaryFaint,
    borderWidth: 1,
    borderColor:
      COLORS.borderLight,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },

  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor:
      COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  infoIcon: {
    color: COLORS.primaryDark,
    fontSize: 16,
    fontWeight: '900',
  },

  infoTitle: {
    flex: 1,
    color: COLORS.primaryDeep,
    fontSize: 15,
    fontWeight: '900',
  },

  infoText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontWeight: '500',
  },

  /* SUBMIT */

  submitButton: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor:
      COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },

  submitButtonDisabled: {
    opacity: 0.65,
  },

  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonIcon: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
    marginRight: 8,
  },

  submitButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },

  requiredText: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 12,
    fontWeight: '500',
  },

  bottomSpacing: {
    height: 20,
  },
});

export default AddTurfScreen;
