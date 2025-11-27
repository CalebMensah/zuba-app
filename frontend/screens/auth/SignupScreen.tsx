// screens/auth/SignupScreen.tsx
import React, { useState } from 'react';
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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList, UserRole } from '../../types/navigation';
import { authAPI, SignupData } from '../../services/api';
import { Colors } from '../../constants/colors';

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
        {/* Decorative Background Elements */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
        <View style={styles.decorativeCircle3} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandContainer}>
              <Text style={styles.brandName}>ZUBA</Text>
              <View style={styles.brandAccent} />
            </View>
            <Text style={styles.title}>Join the Movement</Text>
            <Text style={styles.subtitle}>Create your account and start your journey</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Role Selection - Compact Design */}
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
                  <Text style={styles.errorText}>⚠ {errors.firstName}</Text>
                )}
              </View>

              <View style={[styles.inputWrapper, styles.halfWidth]}>
                <Text style={styles.label}>Last Name</Text>
                <View style={[styles.inputContainer, errors.lastName && styles.inputContainerError]}>
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
                  <Text style={styles.errorText}>⚠ {errors.lastName}</Text>
                )}
              </View>
            </View>

            {/* Email */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(value) => updateFormData('email', value)}
                  placeholder="john.doe@example.com"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              {errors.email && (
                <Text style={styles.errorText}>⚠ {errors.email}</Text>
              )}
            </View>

            {/* Phone */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputContainer, errors.phone && styles.inputContainerError]}>
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
                <Text style={styles.errorText}>⚠ {errors.phone}</Text>
              )}
            </View>

            {/* Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  placeholder="Create a strong password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.password && (
                <Text style={styles.errorText}>⚠ {errors.password}</Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputContainer, errors.confirmPassword && styles.inputContainerError]}>
                <TextInput
                  style={styles.input}
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  placeholder="Confirm your password"
                  placeholderTextColor={Colors.textTertiary}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>⚠ {errors.confirmPassword}</Text>
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
                <Text style={styles.signupButtonText}>Join Now</Text>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => navigation.navigate('Terms')}
              >
                Terms and Conditions
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => navigation.navigate('Privacy')}
              >
                Privacy Policy
              </Text>
            </Text>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.divider} />
              <View style={styles.dividerTextContainer}>
                <Text style={styles.dividerText}>Already a member?</Text>
              </View>
              <View style={styles.divider} />
            </View>

            {/* Login Link */}
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>Sign In to Your Account</Text>
            </TouchableOpacity>
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
  decorativeCircle1: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primaryLight + '15',
  },
  decorativeCircle2: {
    position: 'absolute',
    top: 200,
    left: -80,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.success + '10',
  },
  decorativeCircle3: {
    position: 'absolute',
    bottom: 100,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: Colors.accent + '10',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 36,
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandName: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 2,
  },
  brandAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginLeft: 6,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleToggle: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
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
    marginBottom: 20,
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
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
  },
  inputContainerError: {
    borderColor: Colors.error,
    backgroundColor: Colors.errorLight,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  signupButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  signupButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerTextContainer: {
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loginButton: {
    height: 56,
    backgroundColor: Colors.background,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    marginBottom: 20,
  },
  loginButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '700',
  },
});

export default SignupScreen;