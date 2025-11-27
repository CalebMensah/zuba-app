import React, { useState, useEffect } from 'react';
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../../hooks/useStore';
import { Colors } from '../../constants/colors';

// Region options based on Ghana's regions
const REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Eastern',
  'Central',
  'Northern',
  'Upper East',
  'Upper West',
  'Volta',
  'Oti',
  'Bono',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Western North',
];

// Store categories
const CATEGORIES = [
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

interface EditStoreProps {
  navigation: any;
  route: any;
}

export default function EditStoreScreen({ navigation, route }: EditStoreProps) {
  const { store: storeFromRoute } = route.params || {};
  const { updateStore, loading, error, clearError } = useStore();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [logo, setLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // UI state
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Initialize form with existing store data
  useEffect(() => {
    if (storeFromRoute) {
      setName(storeFromRoute.name || '');
      setDescription(storeFromRoute.description || '');
      setLocation(storeFromRoute.location || '');
      setCategory(storeFromRoute.category || '');
      setRegion(storeFromRoute.region || '');
      setExistingLogoUrl(storeFromRoute.logo || null);
    }
  }, [storeFromRoute]);

  // Request media library permissions
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Sorry, we need camera roll permissions to upload store logo!'
          );
        }
      }
    })();
  }, []);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLogo(result.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Store name is required';
    } else if (name.trim().length < 3) {
      errors.name = 'Store name must be at least 3 characters';
    }

    if (!location.trim()) {
      errors.location = 'Location is required';
    }

    if (!category) {
      errors.category = 'Please select a category';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      return;
    }

    if (!storeFromRoute?.id) {
      Alert.alert('Error', 'Store ID not found');
      return;
    }

    try {
      const updateData: any = {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim(),
        category,
      };

      // Only include logo if a new one was selected
      if (logo) {
        updateData.logo = logo;
      }

      const result = await updateStore(storeFromRoute.id, updateData);

      if (result) {
        Alert.alert(
          'Success',
          'Store updated successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else if (error) {
        Alert.alert('Error', error);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update store');
    }
  };

  const renderCategoryPicker = () => (
    <View style={styles.pickerModal}>
      <ScrollView style={styles.pickerScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.pickerItem,
              category === cat && styles.pickerItemSelected,
            ]}
            onPress={() => {
              setCategory(cat);
              setShowCategoryPicker(false);
              setFormErrors({ ...formErrors, category: '' });
            }}
          >
            <Text
              style={[
                styles.pickerItemText,
                category === cat && styles.pickerItemTextSelected,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity
        style={styles.pickerCloseButton}
        onPress={() => setShowCategoryPicker(false)}
      >
        <Text style={styles.pickerCloseText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderRegionPicker = () => (
    <View style={styles.pickerModal}>
      <ScrollView style={styles.pickerScroll}>
        {REGIONS.map((reg) => (
          <TouchableOpacity
            key={reg}
            style={[
              styles.pickerItem,
              region === reg && styles.pickerItemSelected,
            ]}
            onPress={() => {
              setRegion(reg);
              setShowRegionPicker(false);
            }}
          >
            <Text
              style={[
                styles.pickerItemText,
                region === reg && styles.pickerItemTextSelected,
              ]}
            >
              {reg}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity
        style={styles.pickerCloseButton}
        onPress={() => setShowRegionPicker(false)}
      >
        <Text style={styles.pickerCloseText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  // Check if verification prevents editing
  const isVerificationPending = storeFromRoute?.verification?.status === 'pending';
  const isVerified = storeFromRoute?.verification?.status === 'verified';
  const canEdit = !isVerificationPending && !isVerified;

  if (!canEdit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Store</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.restrictedContainer}>
          <Text style={styles.restrictedTitle}>Cannot Edit Store</Text>
          <Text style={styles.restrictedMessage}>
            {isVerificationPending
              ? 'Your store verification is pending. You cannot make changes until the verification is complete.'
              : 'Your store is verified. Please contact support to make changes.'}
          </Text>
          <TouchableOpacity
            style={styles.backButtonLarge}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonLargeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Store</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Logo</Text>
          <TouchableOpacity style={styles.logoContainer} onPress={pickImage}>
            {logo ? (
              <Image source={{ uri: logo.uri }} style={styles.logoImage} />
            ) : existingLogoUrl ? (
              <Image source={{ uri: existingLogoUrl }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>📷</Text>
                <Text style={styles.logoPlaceholderSubtext}>Tap to upload</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Recommended: Square image, at least 200x200px
          </Text>
        </View>

        {/* Store Name */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Store Name <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, formErrors.name && styles.inputError]}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setFormErrors({ ...formErrors, name: '' });
            }}
            placeholder="Enter store name"
            placeholderTextColor={Colors.gray400}
          />
          {formErrors.name && (
            <Text style={styles.errorText}>{formErrors.name}</Text>
          )}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your store (optional)"
            placeholderTextColor={Colors.gray400}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, formErrors.location && styles.inputError]}
            value={location}
            onChangeText={(text) => {
              setLocation(text);
              setFormErrors({ ...formErrors, location: '' });
            }}
            placeholder="e.g., Kumasi, Ashanti Region"
            placeholderTextColor={Colors.gray400}
          />
          {formErrors.location && (
            <Text style={styles.errorText}>{formErrors.location}</Text>
          )}
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.picker, formErrors.category && styles.inputError]}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text
              style={[
                styles.pickerText,
                !category && styles.pickerPlaceholder,
              ]}
            >
              {category || 'Select category'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
          {formErrors.category && (
            <Text style={styles.errorText}>{formErrors.category}</Text>
          )}
        </View>

        {/* Region */}
        <View style={styles.section}>
          <Text style={styles.label}>Region</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowRegionPicker(true)}
          >
            <Text
              style={[
                styles.pickerText,
                !region && styles.pickerPlaceholder,
              ]}
            >
              {region || 'Select region (optional)'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}

        {/* Update Button */}
        <TouchableOpacity
          style={[styles.updateButton, loading && styles.updateButtonDisabled]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.updateButtonText}>Update Store</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Category Picker Modal */}
      {showCategoryPicker && renderCategoryPicker()}

      {/* Region Picker Modal */}
      {showRegionPicker && renderRegionPicker()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  required: {
    color: Colors.error,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  picker: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerPlaceholder: {
    color: Colors.gray400,
  },
  pickerArrow: {
    fontSize: 12,
    color: Colors.gray500,
  },
  logoContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gray100,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  logoPlaceholderText: {
    fontSize: 32,
  },
  logoPlaceholderSubtext: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: Colors.gray500,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorMessage: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  updateButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
  pickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerScroll: {
    maxHeight: '85%',
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerItemSelected: {
    backgroundColor: Colors.primaryLight + '15',
  },
  pickerItemText: {
    fontSize: 16,
    color: Colors.textPrimary,
  },
  pickerItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  pickerCloseButton: {
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pickerCloseText: {
    fontSize: 16,
    color: Colors.gray600,
    fontWeight: '600',
  },
  restrictedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  restrictedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  restrictedMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButtonLarge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  backButtonLargeText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});