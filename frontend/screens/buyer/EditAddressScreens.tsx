import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { useAddress } from '../../hooks/useAddress';
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


export const EditAddressScreen = ({ route, navigation }: any) => {
  const { address } = route.params as { address: Address };
  const [formData, setFormData] = useState({
    recipient: address.recipient,
    phone: address.phone,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    region: address.region,
    country: address.country,
    postalCode: address.postalCode || '',
    isDefault: address.isDefault,
  });
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const { loading, error, updateAddress } = useAddress();

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

    const result = await updateAddress(address.id, {
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
      Alert.alert('Success', 'Address updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert('Error', error || 'Failed to update address');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
              onPress={() => setShowRegionPicker(!showRegionPicker)}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  !formData.region && styles.placeholderText,
                ]}
              >
                {formData.region || 'Select region'}
              </Text>
              <Ionicons
                name={showRegionPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#757575"
              />
            </TouchableOpacity>

            {showRegionPicker && (
              <View style={styles.pickerContainer}>
                <ScrollView style={styles.pickerScroll}>
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
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color="#FF6B35"
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
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
            onPress={() =>
              handleInputChange('isDefault', !formData.isDefault)
            }
          >
            <View
              style={[
                styles.checkbox,
                formData.isDefault && styles.checkboxChecked,
              ]}
            >
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
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Update Address</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 200,
  },
  pickerScroll: {
    maxHeight: 200,
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
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default  EditAddressScreen;