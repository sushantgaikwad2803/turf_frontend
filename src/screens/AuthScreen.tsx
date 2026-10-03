import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/* =========================================================
   API CONFIGURATION
========================================================= */

const RAW_API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!RAW_API_BASE_URL) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is missing. Please check your .env file.',
  );
}

// Remove accidental whitespace and trailing slashes.
const API_BASE_URL = RAW_API_BASE_URL.trim().replace(/\/+$/, '');

// Make sure Android always receives a valid absolute URL.
const NORMALIZED_API_BASE_URL = /^https?:\/\//i.test(API_BASE_URL)
  ? API_BASE_URL
  : `https://${API_BASE_URL}`;

const getApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.trim().replace(/^\/+/, '');
  return `${NORMALIZED_API_BASE_URL}/${cleanEndpoint}`;
};

// console.log('========================================');
// console.log('TURFBOOK API BASE URL:', NORMALIZED_API_BASE_URL);
// console.log('========================================');

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

  bg: '#FFFFFF',
  bgSoft: '#F7FDF9',
  card: '#FFFFFF',

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

  white: '#FFFFFF',
  overlaySoft: 'rgba(255,255,255,0.85)',
  overlayFaint: 'rgba(255,255,255,0.18)',
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
   COMPONENT
========================================================= */

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
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

  /* RESET */
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
    resetForms();
    setIsLogin((previous) => !previous);
  };

  /* VALIDATE LOGIN */
  const validateLogin = () => {
    const cleanIdentifier = identifier.trim();
    const cleanPassword = loginPassword.trim();

    if (!cleanIdentifier) {
      Alert.alert('Missing Information', 'Please enter your email or phone number.');
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    if (!cleanPhone) {
      Alert.alert('Missing Information', 'Please enter your phone number.');
      return false;
    }

    const phoneDigits = cleanPhone.replace(/\D/g, '');

    if (phoneDigits.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
      return false;
    }

    if (!cleanPassword) {
      Alert.alert('Missing Information', 'Please create a password.');
      return false;
    }

    if (cleanPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must contain at least 6 characters.');
      return false;
    }

    return true;
  };

  /* LOGIN */
  const handleLogin = async () => {
    if (!validateLogin()) return;

    try {
      setLoading(true);

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
          'Login succeeded but user information was not returned by the server.'
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
          ]
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
          'Signup succeeded but user information was not returned by the server.'
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
        ]
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
    if (isLogin) {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Background decorative blobs */}
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />
      <View style={styles.bgBlob3} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* LOGO / BRAND */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>T</Text>
              </View>

              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>⚽</Text>
              </View>
            </View>

            <Text style={styles.appName}>TURFBOOK</Text>

            <View style={styles.brandUnderline} />

            <Text style={styles.tagline}>
              BOOK YOUR GAME. PLAY YOUR GAME.
            </Text>
          </View>

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
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  LOGIN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => {
                  if (isLogin) switchMode();
                }}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.tabText, !isLogin && styles.activeTabText]}
                >
                  SIGN UP
                </Text>
              </TouchableOpacity>
            </View>

            {isLogin ? (
              <>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>
                  Login to continue booking your favorite turf.
                </Text>

                {/* IDENTIFIER */}
                <Text style={styles.label}>EMAIL OR PHONE</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>📧</Text>
                  <TextInput
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Enter email or phone"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                    style={styles.input}
                  />
                </View>

                {/* PASSWORD */}
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.passwordWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="Enter password"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry={!showLoginPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setShowLoginPassword((previous) => !previous)
                    }
                    disabled={loading}
                    style={styles.showButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showButtonText}>
                      {showLoginPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  Create your TurfBook account and start booking.
                </Text>

                {/* NAME */}
                <Text style={styles.label}>FULL NAME</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>👤</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your full name"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="words"
                    editable={!loading}
                    style={styles.input}
                  />
                </View>

                {/* EMAIL */}
                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>📧</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    placeholderTextColor={COLORS.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!loading}
                    style={styles.input}
                  />
                </View>

                {/* PHONE */}
                <Text style={styles.label}>PHONE NUMBER</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>📱</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Enter 10-digit phone number"
                    placeholderTextColor={COLORS.placeholder}
                    keyboardType="phone-pad"
                    editable={!loading}
                    style={styles.input}
                    maxLength={15}
                  />
                </View>

                {/* PASSWORD */}
                <Text style={styles.label}>PASSWORD</Text>
                <View style={styles.passwordWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    value={signupPassword}
                    onChangeText={setSignupPassword}
                    placeholder="Create password"
                    placeholderTextColor={COLORS.placeholder}
                    secureTextEntry={!showSignupPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setShowSignupPassword((previous) => !previous)
                    }
                    disabled={loading}
                    style={styles.showButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.showButtonText}>
                      {showSignupPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.helperText}>Minimum 6 characters</Text>

                {/* ROLE */}
                <Text style={styles.label}>I AM A</Text>

                <View style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      role === 'customer' && styles.selectedRoleButton,
                    ]}
                    onPress={() => setRole('customer')}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.roleIconCircle,
                        role === 'customer' && styles.selectedRoleIconCircle,
                      ]}
                    >
                      <Text style={styles.roleIcon}>⚽</Text>
                    </View>

                    <View style={styles.roleTextBlock}>
                      <Text
                        style={[
                          styles.roleTitle,
                          role === 'customer' && styles.selectedRoleTitle,
                        ]}
                      >
                        PLAYER
                      </Text>

                      <Text
                        style={[
                          styles.roleDescription,
                          role === 'customer' &&
                            styles.selectedRoleDescription,
                        ]}
                      >
                        Book turfs
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        role === 'customer' && styles.radioSelected,
                      ]}
                    >
                      {role === 'customer' && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleButton,
                      role === 'owner' && styles.selectedRoleButton,
                    ]}
                    onPress={() => setRole('owner')}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.roleIconCircle,
                        role === 'owner' && styles.selectedRoleIconCircle,
                      ]}
                    >
                      <Text style={styles.roleIcon}>🏟️</Text>
                    </View>

                    <View style={styles.roleTextBlock}>
                      <Text
                        style={[
                          styles.roleTitle,
                          role === 'owner' && styles.selectedRoleTitle,
                        ]}
                      >
                        TURF OWNER
                      </Text>

                      <Text
                        style={[
                          styles.roleDescription,
                          role === 'owner' && styles.selectedRoleDescription,
                        ]}
                      >
                        Manage turfs
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radio,
                        role === 'owner' && styles.radioSelected,
                      ]}
                    >
                      {role === 'owner' && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* SUBMIT */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <View style={styles.submitButtonContent}>
                  <Text style={styles.submitButtonText}>
                    {isLogin ? 'KICK OFF' : 'JOIN NOW'}
                  </Text>
                  <Text style={styles.submitButtonIcon}>→</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* SWITCH */}
            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Text>

              <TouchableOpacity onPress={switchMode} disabled={loading}>
                <Text style={styles.switchLink}>
                  {isLogin ? ' SIGN UP' : ' LOGIN'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footerContainer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerText}>TURFBOOK © 2026</Text>
            <View style={styles.footerLine} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  /* Background blobs */

  bgBlob1: {
    position: 'absolute',
    top: -90,
    right: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.55,
  },

  bgBlob2: {
    position: 'absolute',
    top: 260,
    left: -110,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.accentLight,
    opacity: 0.4,
  },

  bgBlob3: {
    position: 'absolute',
    bottom: -70,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.primaryLight,
    opacity: 0.45,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  /* LOGO */

  logoContainer: {
    alignItems: 'center',
    marginBottom: 26,
  },

  logoWrapper: {
    position: 'relative',
    marginBottom: 14,
  },

  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },

  logoText: {
    color: COLORS.white,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1,
  },

  logoBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },

  logoBadgeText: {
    fontSize: 14,
  },

  appName: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 6,
    marginBottom: 8,
  },

  brandUnderline: {
    width: 46,
    height: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginBottom: 14,
  },

  tagline: {
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 2,
    fontWeight: '700',
  },

  /* CARD */

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },

  /* TABS */

  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 5,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },

  activeTab: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  tabText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },

  activeTabText: {
    color: COLORS.white,
  },

  /* TITLE */

  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 6,
    letterSpacing: 0.3,
  },

  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 22,
    fontWeight: '500',
  },

  /* LABEL */

  label: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: 8,
    marginTop: 4,
    letterSpacing: 1,
  },

  /* INPUT */

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primarySoft,
    marginBottom: 16,
  },

  inputIcon: {
    fontSize: 16,
    marginRight: 10,
  },

  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  /* PASSWORD */

  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.primarySoft,
    marginBottom: 16,
  },

  passwordInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  showButton: {
    paddingHorizontal: 6,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  showButtonText: {
    color: COLORS.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  helperText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: -8,
    marginBottom: 16,
    fontWeight: '500',
  },

  /* ROLE */

  roleContainer: {
    gap: 10,
    marginBottom: 20,
  },

  roleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    borderWidth: 1.5,
    borderColor: COLORS.borderLight,
    borderRadius: 14,
    padding: 12,
    backgroundColor: COLORS.primarySoft,
  },

  selectedRoleButton: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },

  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },

  selectedRoleIconCircle: {
    borderColor: COLORS.primary,
  },

  roleIcon: {
    fontSize: 20,
  },

  roleTextBlock: {
    flex: 1,
  },

  roleTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },

  selectedRoleTitle: {
    color: COLORS.primaryDark,
  },

  roleDescription: {
    marginTop: 3,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  selectedRoleDescription: {
    color: COLORS.primary,
  },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: COLORS.white,
  },

  radioSelected: {
    borderColor: COLORS.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },

  /* SUBMIT */

  submitButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },

  disabledButton: {
    opacity: 0.65,
  },

  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },

  submitButtonIcon: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '900',
    marginLeft: 10,
  },

  /* SWITCH */

  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },

  switchText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  switchLink: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primaryDark,
    letterSpacing: 0.5,
  },

  /* FOOTER */

  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    gap: 12,
  },

  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
    maxWidth: 60,
  },

  footerText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

export default AuthScreen;