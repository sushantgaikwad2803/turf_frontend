import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
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

/* =========================================================
   API CONFIGURATION
========================================================= */

const RAW_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!RAW_API_BASE_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is missing. Please check your .env file.',
  );
}

const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '');

const NORMALIZED_API_BASE_URL = /^https?:\/\//i.test(API_BASE_URL)
  ? API_BASE_URL
  : `https://${API_BASE_URL}`;

const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.trim().replace(/^\/+/, '');
  return `${NORMALIZED_API_BASE_URL}/${cleanEndpoint}`;
};

/* =========================================================
   THEME
========================================================= */

const COLORS = {
  primary: '#C7F36B',
  primaryDark: '#A8D94F',
  primaryDeep: '#87B936',
  primaryDarker: '#6F9D28',
  primarySoft: '#F4FBE6',
  primaryFaint: '#FAFDF4',
  primaryMuted: '#D9EDA4',

  accent: '#8B5CF6',

  bg: '#F7F8FC',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',

  border: '#EFF1F5',
  borderSoft: '#E6E8EF',
  borderStrong: '#D9DCE7',

  textPrimary: '#0B1220',
  textSecondary: '#5E6677',
  textMuted: '#8A92A3',
  placeholder: '#9BA1AE',

  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  warning: '#F59E0B',
  success: '#22C55E',
  info: '#3B82F6',

  white: '#FFFFFF',
  dark: '#0B1220',
  lime: '#C7F36B',
};

/* =========================================================
   TYPES
========================================================= */

type UserRole = 'customer' | 'owner' | 'admin';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

interface AuthScreenProps {
  onAuthSuccess?: (user: AuthUser, isNewSignup?: boolean) => void;
}

/* =========================================================
   HELPERS
========================================================= */

const isEmailValid = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const getDigits = (value: string): string => value.replace(/\D/g, '');

type Strength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

const getPasswordStrength = (password: string): Strength => {
  if (!password) {
    return { level: 0, label: '', color: 'transparent' };
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: COLORS.danger };
  if (score <= 2) return { level: 2, label: 'Fair', color: COLORS.warning };
  if (score <= 3) return { level: 3, label: 'Good', color: COLORS.info };
  return { level: 4, label: 'Strong', color: COLORS.success };
};

/* =========================================================
   COMPONENT
========================================================= */

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Poppins_900Black,
  });

  const scrollRef = useRef<ScrollView>(null);
  const fieldYsRef = useRef<Record<string, number>>({});

  const [isLogin, setIsLogin] = useState(true);

  /* LOGIN */
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  /* SIGNUP */
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [role, setRole] = useState<'customer' | 'owner'>('customer');

  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  /* =====================================================
     KEYBOARD HEIGHT LISTENER
  ===================================================== */

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  /* LIVE VALIDATION */
  const emailOk = isEmailValid(email);
  const phoneDigits = getDigits(phone).length;
  const phoneOk = phoneDigits >= 10;
  const loginIdentifierOk =
    identifier.includes('@')
      ? isEmailValid(identifier)
      : getDigits(identifier).length >= 10;
  const strength = getPasswordStrength(signupPassword);

  const resetForms = () => {
    setIdentifier('');
    setLoginPassword('');
    setName('');
    setEmail('');
    setPhone('');
    setSignupPassword('');
    setShowLoginPassword(false);
    setShowSignupPassword(false);
  };

  const switchMode = () => {
    Keyboard.dismiss();
    resetForms();
    setIsLogin((previous) => !previous);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 100);
  };

  /* =====================================================
     FOCUS HANDLER — scrolls ONLY to bring the focused
     field to 80px from top of visible area (not to end)
  ===================================================== */

  const handleFieldFocus = (key: string) => {
    setFocused(key);

    setTimeout(() => {
      const y = fieldYsRef.current[key];
      if (typeof y !== 'number') return;

      scrollRef.current?.scrollTo({
        y: Math.max(0, y - 80),
        animated: true,
      });
    }, 220);
  };

  const handleFieldBlur = () => {
    setFocused(null);
  };

  /* VALIDATE LOGIN */
  const validateLogin = () => {
    const cleanIdentifier = identifier.trim();
    const cleanPassword = loginPassword.trim();

    if (!cleanIdentifier) {
      Alert.alert(
        'Missing Information',
        'Please enter your email or phone number.',
      );
      return false;
    }

    if (!cleanPassword) {
      Alert.alert('Missing Information', 'Please enter your password.');
      return false;
    }

    return true;
  };

  /* VALIDATE SIGNUP */
  const validateSignup = () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanPassword = signupPassword.trim();

    if (!cleanName) {
      Alert.alert('Missing Information', 'Please enter your full name.');
      return false;
    }

    if (cleanName.length < 2) {
      Alert.alert('Invalid Name', 'Name must contain at least 2 characters.');
      return false;
    }

    if (!cleanEmail) {
      Alert.alert('Missing Information', 'Please enter your email address.');
      return false;
    }

    if (!isEmailValid(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    if (!cleanPhone) {
      Alert.alert('Missing Information', 'Please enter your phone number.');
      return false;
    }

    if (getDigits(cleanPhone).length < 10) {
      Alert.alert(
        'Invalid Phone',
        'Please enter a valid 10-digit phone number.',
      );
      return false;
    }

    if (!cleanPassword) {
      Alert.alert('Missing Information', 'Please create a password.');
      return false;
    }

    if (cleanPassword.length < 6) {
      Alert.alert(
        'Weak Password',
        'Password must contain at least 6 characters.',
      );
      return false;
    }

    return true;
  };

  /* LOGIN */
  const handleLogin = async () => {
    if (!validateLogin()) return;

    try {
      setLoading(true);
      Keyboard.dismiss();

      const cleanIdentifier = identifier.trim();
      const cleanPassword = loginPassword.trim();

      const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Login failed. Please try again.');
      }

      const loggedInUser: AuthUser = data?.user || data?.data?.user;

      if (!loggedInUser) {
        throw new Error(
          'Login succeeded but user information was not returned by the server.',
        );
      }

      if (!loggedInUser._id || !loggedInUser.name || !loggedInUser.role) {
        throw new Error('Invalid user information received from the server.');
      }

      if (loggedInUser.role === 'admin') {
        Alert.alert(
          'Admin Login Successful',
          `Welcome to TurfBook Admin Panel, ${loggedInUser.name}.`,
          [
            {
              text: 'Continue',
              onPress: () => {
                onAuthSuccess?.(loggedInUser, false);
              },
            },
          ],
        );
        return;
      }

      onAuthSuccess?.(loggedInUser, false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to login. Please check your connection and try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  /* SIGNUP */
  const handleSignup = async () => {
    if (!validateSignup()) return;

    try {
      setLoading(true);
      Keyboard.dismiss();

      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim().replace(/\s+/g, '');
      const cleanPassword = signupPassword.trim();

      const safeRole: 'customer' | 'owner' =
        role === 'owner' ? 'owner' : 'customer';

      const response = await fetch(getApiUrl('auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          password: cleanPassword,
          role: safeRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Signup failed. Please try again.');
      }

      const createdUser: AuthUser = data?.user || data?.data?.user;

      if (!createdUser) {
        throw new Error(
          'Signup succeeded but user information was not returned by the server.',
        );
      }

      Alert.alert(
        'Account Created',
        `Welcome to TurfBook, ${createdUser.name}!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              onAuthSuccess?.(createdUser, true);
            },
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create your account. Please try again.';
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (loading) return;
    Keyboard.dismiss();
    if (isLogin) {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  /* FONT LOADING */
  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaView style={styles.fontLoadingSafe}>
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

  /* Reasonable dynamic padding — just enough room to scroll */
  const dynamicBottomPadding = keyboardHeight > 0 ? keyboardHeight + 24 : 40;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.blobTop} pointerEvents="none" />
      <View style={styles.blobBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: dynamicBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}
      >
        <View style={styles.container}>
          {/* BRAND */}
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons
                name="soccer"
                size={16}
                color={COLORS.dark}
              />
            </View>
            <Text style={styles.brandText}>TurfBook</Text>
          </View>

          {/* KICKER */}
          <View style={styles.kickerRow}>
            <View style={styles.kickerLine} />
            <Text style={styles.kickerText}>
              {isLogin ? 'SIGN IN' : 'GET STARTED'}
            </Text>
          </View>

          {/* HERO */}
          <Text style={styles.heroTitle}>
            {isLogin ? 'Welcome\nback' : 'Create your\naccount'}
            <Text style={styles.heroTitleDot}>.</Text>
          </Text>

          <Text style={styles.heroSub}>
            {isLogin
              ? 'Sign in to continue booking turfs near you.'
              : 'Join thousands of players booking daily.'}
          </Text>

          {/* CARD */}
          <View style={styles.card}>
            {/* TABS */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => {
                  if (!isLogin) switchMode();
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.tabText, isLogin && styles.activeTabText]}
                >
                  Login
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => {
                  if (isLogin) switchMode();
                }}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text
                  style={[styles.tabText, !isLogin && styles.activeTabText]}
                >
                  Sign up
                </Text>
              </TouchableOpacity>
            </View>

            {/* ============ LOGIN FORM ============ */}
            {isLogin ? (
              <>
                {/* IDENTIFIER */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['identifier'] =
                      e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Email or phone</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'identifier' &&
                        styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'identifier' && styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={15}
                        color={
                          focused === 'identifier'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={identifier}
                      onChangeText={setIdentifier}
                      onFocus={() => handleFieldFocus('identifier')}
                      onBlur={handleFieldBlur}
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      editable={!loading}
                      style={styles.input}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />
                    {loginIdentifierOk && (
                      <View style={styles.checkBadge}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.success}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* PASSWORD */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['loginPwd'] =
                      e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Password</Text>
                    <TouchableOpacity
                      activeOpacity={0.6}
                      disabled={loading}
                      onPress={() =>
                        Alert.alert(
                          'Reset Password',
                          'Password reset will be available soon.',
                        )
                      }
                    >
                      <Text style={styles.forgotText}>Forgot?</Text>
                    </TouchableOpacity>
                  </View>

                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'loginPwd' &&
                        styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'loginPwd' && styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={15}
                        color={
                          focused === 'loginPwd'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      onFocus={() => handleFieldFocus('loginPwd')}
                      onBlur={handleFieldBlur}
                      placeholder="Enter your password"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showLoginPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowLoginPassword((previous) => !previous)
                      }
                      disabled={loading}
                      activeOpacity={0.7}
                      style={styles.eyeButton}
                      hitSlop={{
                        top: 12,
                        bottom: 12,
                        left: 12,
                        right: 12,
                      }}
                    >
                      <Ionicons
                        name={
                          showLoginPassword
                            ? 'eye-off-outline'
                            : 'eye-outline'
                        }
                        size={17}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SUBMIT */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.dark} />
                  ) : (
                    <View style={styles.submitButtonContent}>
                      <Text style={styles.submitButtonText}>Continue</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={COLORS.dark}
                        style={styles.submitButtonIcon}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* SECTION 01 */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionNumber}>01</Text>
                  <Text style={styles.sectionText}>Your details</Text>
                </View>

                {/* NAME */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['name'] = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Full name</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'name' && styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'name' && styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={15}
                        color={
                          focused === 'name'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      onFocus={() => handleFieldFocus('name')}
                      onBlur={handleFieldBlur}
                      placeholder="Enter your full name"
                      placeholderTextColor={COLORS.placeholder}
                      autoCapitalize="words"
                      editable={!loading}
                      style={styles.input}
                      blurOnSubmit={false}
                    />
                  </View>
                </View>

                {/* EMAIL */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['email'] = e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Email</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'email' && styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'email' && styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={15}
                        color={
                          focused === 'email'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => handleFieldFocus('email')}
                      onBlur={handleFieldBlur}
                      placeholder="you@example.com"
                      placeholderTextColor={COLORS.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      editable={!loading}
                      style={styles.input}
                      blurOnSubmit={false}
                    />
                    {emailOk && (
                      <View style={styles.checkBadge}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.success}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* PHONE */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['phone'] = e.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Phone</Text>
                    {phone.length > 0 && (
                      <Text
                        style={[
                          styles.counterText,
                          phoneOk && styles.counterTextOk,
                        ]}
                      >
                        {phoneDigits}/10
                      </Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'phone' && styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'phone' && styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="call-outline"
                        size={15}
                        color={
                          focused === 'phone'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      onFocus={() => handleFieldFocus('phone')}
                      onBlur={handleFieldBlur}
                      placeholder="10-digit number"
                      placeholderTextColor={COLORS.placeholder}
                      keyboardType="phone-pad"
                      editable={!loading}
                      style={styles.input}
                      maxLength={15}
                      blurOnSubmit={false}
                    />
                    {phoneOk && (
                      <View style={styles.checkBadge}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={COLORS.success}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {/* PASSWORD */}
                <View
                  style={styles.field}
                  onLayout={(e) => {
                    fieldYsRef.current['signupPwd'] =
                      e.nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.label}>Password</Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      focused === 'signupPwd' &&
                        styles.inputWrapperFocused,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        focused === 'signupPwd' &&
                          styles.iconBoxFocused,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={15}
                        color={
                          focused === 'signupPwd'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <TextInput
                      value={signupPassword}
                      onChangeText={setSignupPassword}
                      onFocus={() => handleFieldFocus('signupPwd')}
                      onBlur={handleFieldBlur}
                      placeholder="Create a password"
                      placeholderTextColor={COLORS.placeholder}
                      secureTextEntry={!showSignupPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      style={styles.input}
                      blurOnSubmit={false}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowSignupPassword((previous) => !previous)
                      }
                      disabled={loading}
                      activeOpacity={0.7}
                      style={styles.eyeButton}
                      hitSlop={{
                        top: 12,
                        bottom: 12,
                        left: 12,
                        right: 12,
                      }}
                    >
                      <Ionicons
                        name={
                          showSignupPassword
                            ? 'eye-off-outline'
                            : 'eye-outline'
                        }
                        size={17}
                        color={COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* STRENGTH METER */}
                  {signupPassword.length > 0 && (
                    <View style={styles.strengthRow}>
                      <View style={styles.strengthBars}>
                        {[1, 2, 3, 4].map((segment) => (
                          <View
                            key={segment}
                            style={[
                              styles.strengthBar,
                              segment <= strength.level && {
                                backgroundColor: strength.color,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text
                        style={[
                          styles.strengthLabel,
                          { color: strength.color },
                        ]}
                      >
                        {strength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* SECTION 02 */}
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionNumber}>02</Text>
                  <Text style={styles.sectionText}>Account type</Text>
                </View>

                {/* ROLE */}
                <View style={styles.roleRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleCard,
                      role === 'customer' && styles.roleCardActive,
                    ]}
                    onPress={() => setRole('customer')}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {role === 'customer' && (
                      <View style={styles.roleCheck}>
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={COLORS.dark}
                        />
                      </View>
                    )}
                    <View
                      style={[
                        styles.roleIconBox,
                        role === 'customer' && styles.roleIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name="football-outline"
                        size={20}
                        color={
                          role === 'customer'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.roleName,
                        role === 'customer' && styles.roleNameActive,
                      ]}
                    >
                      Player
                    </Text>
                    <Text
                      style={[
                        styles.roleDesc,
                        role === 'customer' && styles.roleDescActive,
                      ]}
                    >
                      Book turfs
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleCard,
                      role === 'owner' && styles.roleCardActive,
                    ]}
                    onPress={() => setRole('owner')}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {role === 'owner' && (
                      <View style={styles.roleCheck}>
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={COLORS.dark}
                        />
                      </View>
                    )}
                    <View
                      style={[
                        styles.roleIconBox,
                        role === 'owner' && styles.roleIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color={
                          role === 'owner'
                            ? COLORS.dark
                            : COLORS.textSecondary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.roleName,
                        role === 'owner' && styles.roleNameActive,
                      ]}
                    >
                      Turf Owner
                    </Text>
                    <Text
                      style={[
                        styles.roleDesc,
                        role === 'owner' && styles.roleDescActive,
                      ]}
                    >
                      Manage turfs
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* SUBMIT */}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.disabledButton,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={COLORS.dark} />
                  ) : (
                    <View style={styles.submitButtonContent}>
                      <Text style={styles.submitButtonText}>
                        Create account
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={COLORS.dark}
                        style={styles.submitButtonIcon}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* SWITCH */}
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Text>
              <TouchableOpacity
                onPress={switchMode}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.switchLink}>
                  {isLogin ? 'Sign up' : 'Log in'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FOOTER */}
          <Text style={styles.footerText}>
            By continuing you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </ScrollView>
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

  /* FONT LOADING */

  fontLoadingSafe: {
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

  /* AMBIENT BLOBS */

  blobTop: {
    position: 'absolute',
    top: -140,
    right: -120,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.primary,
    opacity: 0.18,
  },

  blobBottom: {
    position: 'absolute',
    bottom: -160,
    left: -130,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: COLORS.accent,
    opacity: 0.06,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 8,
  },

  /* BRAND */

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },

  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },

  brandText: {
    fontSize: 15,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },

  /* KICKER */

  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  kickerLine: {
    width: 24,
    height: 2,
    borderRadius: 1,
    backgroundColor: COLORS.primary,
  },

  kickerText: {
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },

  /* HERO */

  heroTitle: {
    fontSize: 32,
    fontFamily: 'Poppins_900Black',
    color: COLORS.textPrimary,
    letterSpacing: -1,
    lineHeight: 38,
  },

  heroTitleDot: {
    color: COLORS.primaryDeep,
  },

  heroSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 22,
  },

  /* CARD */

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },

  /* TABS */

  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },

  activeTab: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  tabText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: COLORS.textMuted,
    letterSpacing: 0.1,
  },

  activeTabText: {
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_800ExtraBold',
  },

  /* SECTION HEADERS */

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },

  sectionNumber: {
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.primaryDarker,
    letterSpacing: 1,
    backgroundColor: COLORS.primaryFaint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },

  sectionText: {
    fontSize: 13,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    letterSpacing: -0.1,
  },

  /* FIELDS */

  field: {
    marginBottom: 14,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  label: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textSecondary,
    marginBottom: 7,
    letterSpacing: 0.1,
  },

  forgotText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.primaryDarker,
    marginBottom: 7,
  },

  counterText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textMuted,
    marginBottom: 7,
  },

  counterTextOk: {
    color: COLORS.success,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    borderRadius: 14,
    paddingLeft: 6,
    paddingRight: 6,
    backgroundColor: COLORS.surfaceAlt,
  },

  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },

  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  iconBoxFocused: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_500Medium',
    paddingVertical: 0,
  },

  eyeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },

  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
  },

  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.borderSoft,
  },

  strengthLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.4,
    minWidth: 46,
    textAlign: 'right',
  },

  /* ROLE CARDS */

  roleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  roleCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.borderSoft,
    backgroundColor: COLORS.surfaceAlt,
    position: 'relative',
  },

  roleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFaint,
  },

  roleCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  roleIconBoxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  roleName: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    color: COLORS.textSecondary,
  },

  roleNameActive: {
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_800ExtraBold',
  },

  roleDesc: {
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    color: COLORS.textMuted,
    marginTop: 2,
  },

  roleDescActive: {
    color: COLORS.primaryDarker,
    fontFamily: 'Poppins_600SemiBold',
  },

  /* SUBMIT */

  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: COLORS.primaryDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },

  disabledButton: {
    opacity: 0.6,
  },

  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonText: {
    color: COLORS.dark,
    fontSize: 14,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: 0.1,
  },

  submitButtonIcon: {
    marginLeft: 8,
  },

  /* SWITCH */

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },

  switchText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textSecondary,
  },

  switchLink: {
    fontSize: 12,
    fontFamily: 'Poppins_800ExtraBold',
    color: COLORS.textPrimary,
    textDecorationLine: 'underline',
  },

  /* FOOTER */

  footerText: {
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: COLORS.textMuted,
    marginTop: 18,
    lineHeight: 15,
    paddingHorizontal: 20,
  },
});

export default AuthScreen;