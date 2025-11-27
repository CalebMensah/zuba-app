import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../hooks/useStore';
import { Colors } from '../../constants/colors';

// Ghana regions
const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Central',
  'Eastern',
  'Northern',
  'Upper East',
  'Upper West',
  'Volta',
  'Oti',
  'Bono',
  'Bono East',
  'Ahafo',
  'Western North',
  'North East',
  'Savannah',
];

// Store categories
const STORE_CATEGORIES = [
  'Electronics',
  'Fashion & Clothing',
  'Home & Garden',
  'Health & Beauty',
  'Sports & Outdoors',
  'Toys & Games',
  'Books & Media',
  'Food & Beverages',
  'Automotive',
  'Jewelry & Accessories',
  'Art & Crafts',
  'Pet Supplies',
  'Office Supplies',
  'Baby & Kids',
  'Other',
];

const CreateStoreScreen = () => {
  const navigation = useNavigation();
  const { createStore, loading, error, clearError } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    category: '',
    region: '',
  });

  const [logo, setLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Request media library permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Sorry, we need camera roll permissions to upload images.'
      );
      return false;
    }
    return true;
  };

  // Pick logo image
  const pickLogo = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogo(result.assets[0]);
        setErrors({ ...errors, logo: '' });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Remove logo
  const removeLogo = () => {
    Alert.alert('Remove Logo', 'Are you sure you want to remove this logo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setLogo(null),
      },
    ]);
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Store name is required';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Store name must be at least 3 characters';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    if (!formData.region) {
      newErrors.region = 'Region is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    const result = await createStore({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      location: formData.location.trim(),
      category: formData.category,
      region: formData.region,
      logo: logo || undefined,
    });

    if (result) {
      Alert.alert(
        'Success',
        'Store created successfully! Please submit verification documents to activate your store.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Store</Text>
          <Text style={styles.subtitle}>
            Set up your seller account to start selling
          </Text>
        </View>

        {/* Logo Upload */}
        <View style={styles.section}>
          <Text style={styles.label}>Store Logo</Text>
          <Text style={styles.helperText}>Upload a square logo (optional)</Text>

          <TouchableOpacity
            style={styles.logoContainer}
            onPress={pickLogo}
            activeOpacity={0.7}
          >
            {logo ? (
              <View style={styles.logoWrapper}>
                <Image source={{ uri: logo.uri }} style={styles.logoImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={removeLogo}
                >
                  <Ionicons name="close-circle" size={28} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.logoPlaceholder}>
                <Ionicons name="camera" size={40} color={Colors.gray400} />
                <Text style={styles.logoPlaceholderText}>
                  Tap to upload logo
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Store Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Store Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Enter your store name"
            placeholderTextColor={Colors.gray400}
            value={formData.name}
            onChangeText={(text) => {
              setFormData({ ...formData, name: text });
              setErrors({ ...errors, name: '' });
            }}
            maxLength={50}
          />
          {errors.name && (
            <Text style={styles.errorText}>{errors.name}</Text>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell customers about your store (optional)"
            placeholderTextColor={Colors.gray400}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            multiline
            numberOfLines={4}
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>
            {formData.description.length}/500
          </Text>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.location && styles.inputError]}
            placeholder="e.g., Accra, Kumasi, Tamale"
            placeholderTextColor={Colors.gray400}
            value={formData.location}
            onChangeText={(text) => {
              setFormData({ ...formData, location: text });
              setErrors({ ...errors, location: '' });
            }}
            maxLength={50}
          />
          {errors.location && (
            <Text style={styles.errorText}>{errors.location}</Text>
          )}
        </View>

        {/* Region Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Region <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.pickerButton,
              errors.region && styles.inputError,
            ]}
            onPress={() => setShowRegionPicker(!showRegionPicker)}
          >
            <Text
              style={[
                styles.pickerButtonText,
                !formData.region && styles.pickerPlaceholder,
              ]}
            >
              {formData.region || 'Select region'}
            </Text>
            <Ionicons
              name={showRegionPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.gray500}
            />
          </TouchableOpacity>
          {errors.region && (
            <Text style={styles.errorText}>{errors.region}</Text>
          )}

          {showRegionPicker && (
            <View style={styles.pickerList}>
              {GHANA_REGIONS.map((region) => (
                <TouchableOpacity
                  key={region}
                  style={[
                    styles.pickerItem,
                    formData.region === region && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, region });
                    setShowRegionPicker(false);
                    setErrors({ ...errors, region: '' });
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      formData.region === region && styles.pickerItemTextSelected,
                    ]}
                  >
                    {region}
                  </Text>
                  {formData.region === region && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Category Picker */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.pickerButton,
              errors.category && styles.inputError,
            ]}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          >
            <Text
              style={[
                styles.pickerButtonText,
                !formData.category && styles.pickerPlaceholder,
              ]}
            >
              {formData.category || 'Select category'}
            </Text>
            <Ionicons
              name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={Colors.gray500}
            />
          </TouchableOpacity>
          {errors.category && (
            <Text style={styles.errorText}>{errors.category}</Text>
          )}

          {showCategoryPicker && (
            <View style={styles.pickerList}>
              {STORE_CATEGORIES.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.pickerItem,
                    formData.category === category && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, category });
                    setShowCategoryPicker(false);
                    setErrors({ ...errors, category: '' });
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      formData.category === category &&
                        styles.pickerItemTextSelected,
                    ]}
                  >
                    {category}
                  </Text>
                  {formData.category === category && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.info} />
          <Text style={styles.infoText}>
            After creating your store, you'll need to submit verification
            documents to activate it and start selling.
          </Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
              <Text style={styles.submitButtonText}>Create Store</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  logoWrapper: {
    position: 'relative',
  },
  logoImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
  },
  removeButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: Colors.white,
    borderRadius: 14,
  },
  logoPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: Colors.backgroundTertiary,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  pickerButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerPlaceholder: {
    color: Colors.gray400,
  },
  pickerList: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 250,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerItemSelected: {
    backgroundColor: Colors.infoLight,
  },
  pickerItemText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.info,
    lineHeight: 20,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateStoreScreen;