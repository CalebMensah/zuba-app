import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Modal,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useAddress } from '../../hooks/useAddress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

interface Address {
  id: string;
  userId: string;
  recipient: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  country: string;
  postalCode?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const GHANA_REGIONS = [
  'Ahafo',
  'Ashanti',
  'Bono',
  'Bono East',
  'Central',
  'Eastern',
  'Greater Accra',
  'North East',
  'Northern',
  'Oti',
  'Savannah',
  'Upper East',
  'Upper West',
  'Volta',
  'Western',
  'Western North',
];

export const AddAddressScreen = ({ navigation }: any) => {
  const { user, isLoading: authLoading } = useAuth();

  // FIX: fullUser declared before the useEffect that references it
  const [fullUser, setFullUser] = useState(null);

  const [formData, setFormData] = useState({
    recipient: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'Ghana',
    postalCode: '',
    isDefault: false,
  });
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const { loading, error, createAddress } = useAddress();

  const effectiveUser = fullUser || user;
  const fullName = effectiveUser
    ? `${effectiveUser.firstName || ''} ${effectiveUser.lastName || ''}`.trim()
    : '';

  useEffect(() => {
    const fetchFullUser = async () => {
      if (!user || fullUser || authLoading) return;

      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.user && data.user.phone) {
          setFullUser(data.user);
        }
      } catch (err) {
        console.error('Failed to fetch full user:', err);
      }
    };

    if (user && !user.phone) {
      fetchFullUser();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (effectiveUser && !authLoading && fullName) {
      setFormData((prev) => ({
        ...prev,
        recipient: fullName,
        phone: effectiveUser.phone || '',
      }));
    }
  }, [effectiveUser, authLoading, fullName]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.recipient.trim()) {
      Alert.alert('Validation Error', 'Recipient name is required');
      return false;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Phone number is required');
      return false;
    }
    if (!formData.addressLine1.trim()) {
      Alert.alert('Validation Error', 'Address line 1 is required');
      return false;
    }
    // FIX: match backend minimum of 3 characters
    if (formData.addressLine1.trim().length < 3) {
      Alert.alert('Validation Error', 'Address line 1 must be at least 3 characters');
      return false;
    }
    if (!formData.city.trim()) {
      Alert.alert('Validation Error', 'City is required');
      return false;
    }
    if (!formData.region) {
      Alert.alert('Validation Error', 'Region is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const result = await createAddress({
      recipient: formData.recipient.trim(),
      phone: formData.phone.trim(),
      addressLine1: formData.addressLine1.trim(),
      addressLine2: formData.addressLine2.trim() || undefined,
      city: formData.city.trim(),
      region: formData.region,
      country: formData.country,
      postalCode: formData.postalCode.trim() || undefined,
      isDefault: formData.isDefault,
    });

    if (result) {
      Alert.alert('Success', 'Address added successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert('Error', error || 'Failed to add address');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {authLoading ? (
            <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1 }} />
          ) : user ? (
            <View style={styles.userInfoContainer}>
              <Text style={styles.userInfoTitle}>Using your account details:</Text>
              <View style={styles.userInfoRow}>
                <Ionicons name="person-outline" size={20} color="#3B82F6" />
                <Text style={styles.userInfoName}>{fullName}</Text>
              </View>
              <View style={styles.userInfoRow}>
                <Ionicons name="call-outline" size={20} color="#3B82F6" />
                <Text style={styles.userInfoPhone}>
                  {effectiveUser?.phone || 'No phone set'}
                </Text>
              </View>
              <Text style={styles.userInfoNote}>
                You can edit these details below if needed
              </Text>
            </View>
          ) : null}

          <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Recipient Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter recipient name"
                value={formData.recipient}
                onChangeText={(value) => handleInputChange('recipient', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Phone Number <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="+233 XXX XXX XXX"
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Address Line 1 <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Street address, P.O. box"
                value={formData.addressLine1}
                onChangeText={(value) => handleInputChange('addressLine1', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address Line 2</Text>
              <TextInput
                style={styles.input}
                placeholder="Apartment, suite, unit, building, floor, etc."
                value={formData.addressLine2}
                onChangeText={(value) => handleInputChange('addressLine2', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                City <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter city"
                value={formData.city}
                onChangeText={(value) => handleInputChange('city', value)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Region <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowRegionPicker(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pickerButtonText,
                    !formData.region && styles.placeholderText,
                  ]}
                >
                  {formData.region || 'Select region'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#757575" />
              </TouchableOpacity>

              <Modal
                visible={showRegionPicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRegionPicker(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setShowRegionPicker(false)}
                >
                  <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Select Region</Text>
                    <ScrollView>
                      {GHANA_REGIONS.map((region) => (
                        <TouchableOpacity
                          key={region}
                          style={[
                            styles.pickerItem,
                            formData.region === region && styles.pickerItemSelected,
                          ]}
                          onPress={() => {
                            handleInputChange('region', region);
                            setShowRegionPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.pickerItemText,
                              formData.region === region &&
                                styles.pickerItemTextSelected,
                            ]}
                          >
                            {region}
                          </Text>
                          {formData.region === region && (
                            <Ionicons name="checkmark" size={20} color="#FF6B35" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter postal code"
                value={formData.postalCode}
                onChangeText={(value) => handleInputChange('postalCode', value)}
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => handleInputChange('isDefault', !formData.isDefault)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, formData.isDefault && styles.checkboxChecked]}>
                {formData.isDefault && (
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>Set as default address</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Add Address</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    marginTop: 40,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  formContainer: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#212121',
  },
  pickerButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#212121',
  },
  placeholderText: {
    color: '#9E9E9E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: Dimensions.get('window').height * 0.6,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  userInfoContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  userInfoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  userInfoPhone: {
    fontSize: 16,
    color: '#212121',
    flex: 1,
  },
  userInfoNote: {
    fontSize: 14,
    color: '#757575',
    fontStyle: 'italic',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  pickerItemSelected: {
    backgroundColor: '#FFF3E0',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#212121',
  },
  pickerItemTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#424242',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AddAddressScreen;