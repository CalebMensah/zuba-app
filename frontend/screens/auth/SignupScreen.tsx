// screens/auth/SignupScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList, UserRole } from '../../types/navigation';
import { authAPI, SignupData } from '../../services/api';
import { Colors } from '../../constants/colors';
import { useGoogleLogin } from '../../hooks/useGoogle';

type SignupScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: '',
  });
  const [role, setRole] = useState<UserRole>('BUYER');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const { signInWithGoogle, isLoading: googleLoading, error: googleError } = useGoogleLogin();

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const signupData: SignupData = {
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        password: formData.password,
        role,
      };

      const response = await authAPI.signup(signupData);

      if (response.success) {
        Alert.alert(
          'Success',
          'Account created! Please check your email for verification code.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('VerifyEmail', { email: formData.email }),
            },
          ]
        );
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Signup failed. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with Back Button */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Create Account</Text>
            <Text style={styles.welcomeSubtitle}>
              Join thousands of users on Zuba
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Role Selection */}
            <View style={styles.roleSection}>
              <Text style={styles.roleSectionLabel}>I want to</Text>
              <View style={styles.roleToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleToggle,
                    role === 'BUYER' && styles.roleToggleActive,
                  ]}
                  onPress={() => setRole('BUYER')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="bag-handle" 
                    size={20} 
                    color={role === 'BUYER' ? Colors.white : Colors.textSecondary} 
                  />
                  <Text style={[styles.roleToggleText, role === 'BUYER' && styles.roleToggleTextActive]}>
                    Buy
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleToggle,
                    role === 'SELLER' && styles.roleToggleActive,
                  ]}
                  onPress={() => setRole('SELLER')}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name="storefront" 
                    size={20} 
                    color={role === 'SELLER' ? Colors.white : Colors.textSecondary} 
                  />
                  <Text style={[styles.roleToggleText, role === 'SELLER' && styles.roleToggleTextActive]}>
                    Sell
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Name Fields in Row */}
            <View style={styles.rowContainer}>
              <View style={[styles.inputWrapper, styles.halfWidth]}>
                <Text style={styles.label}>First Name</Text>
                <View style={[styles.inputContainer, errors.firstName && styles.inputContainerError]}>
                  <Ionicons name="person" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                  <TextInput
                    style={styles.input}
                    value={formData.firstName}
                    onChangeText={(value) => updateFormData('firstName', value)}
                    placeholder="John"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
                {errors.firstName && (
                  <Text style={styles.errorText}>{errors.firstName}</Text>
                )}
              </View>

              <View style={[styles.inputWrapper, styles.halfWidth]}>
                <Text style={styles.label}>Last Name</Text>
                <View style={[styles.inputContainer, errors.lastName && styles.inputContainerError]}>
                  <Ionicons name="person" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                  <TextInput
                    style={styles.input}
                    value={formData.lastName}
                    onChangeText={(value) => updateFormData('lastName', value)}
                    placeholder="Doe"
                    placeholderTextColor={Colors.textTertiary}
                    autoCapitalize="words"
                    editable={!loading}
                  />
                </View>
                {errors.lastName && (
                  <Text style={styles.errorText}>{errors.lastName}</Text>
                )}
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email</Text>
              <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
                <MaterialIcons name="email" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(value) => updateFormData('email', value)}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputContainer, errors.phone && styles.inputContainerError]}>
                <Ionicons name="call" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(value) => updateFormData('phone', value)}
                  placeholder="+233 XX XXX XXXX"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
                <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
                <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} style={styles.inputIconStyle} />
                <TextInput
                  style={styles.input}
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  placeholder="Re-enter password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Signup Button */}
            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => navigation.navigate('Terms' as any)}
              >
                Terms
              </Text>
              {' & '}
              <Text 
                style={styles.termsLink}
                onPress={() => navigation.navigate('Privacy' as any)}
              >
                Privacy Policy
              </Text>
            </Text>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            {/* Google Sign Up Button */}
            <TouchableOpacity
              style={[styles.googleButton, (loading || googleLoading) && styles.googleButtonDisabled]}
              onPress={signInWithGoogle}
              disabled={loading || googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.textPrimary} size="small" />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color={Colors.textPrimary} style={styles.googleIcon} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Login Section */}
            <View style={styles.loginSection}>
              <Text style={styles.loginText}>Already have an account?</Text>
              <TouchableOpacity 
                onPress={() => navigation.navigate('Login')}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
    letterSpacing: 1,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    alignSelf: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    alignSelf: 'center',
  },
  form: {
    flex: 1,
  },
  roleSection: {
    marginBottom: 24,
  },
  roleSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  roleToggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roleToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  roleToggleActive: {
    backgroundColor: Colors.primary,
  },
  roleToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  roleToggleTextActive: {
    color: Colors.white,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  halfWidth: {
    flex: 1,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
  },
  inputContainerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  inputIconStyle: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
    fontWeight: '500',
  },
  signupButton: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signupButtonDisabled: {
    opacity: 0.6,
  },
  signupButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginHorizontal: 16,
  },
  loginSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  loginText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700',
  },
  googleButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    marginBottom: 24,
    shadowColor: Colors.gray400,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default SignupScreen;