import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDelivery } from '../../hooks/useDelivery';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';

interface RouteParams {
  orderId: string;
  isEdit?: boolean;
}

const ShipOrderScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, isEdit } = route.params as RouteParams;

  const {
    loading,
    error,
    shipOrder,
    updateDeliveryInfo,
    getDeliveryInfo,
    clearError,
  } = useDelivery();

  // Form state
  const [courierService, setCourierService] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDeliveryDays, setEstimatedDeliveryDays] = useState('');
  const [dispatchNote, setDispatchNote] = useState('');
  const [imageUris, setImageUris] = useState<string[]>([]);

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing data if editing
  useEffect(() => {
    if (isEdit) loadDeliveryInfo();
    return () => clearError();
  }, [isEdit, orderId]);

  const loadDeliveryInfo = async () => {
    const data = await getDeliveryInfo(orderId);
    if (data) {
      setCourierService(data.courierService || '');
      setTrackingNumber(data.trackingNumber || '');
      setEstimatedDeliveryDays(
        data.estimatedDeliveryDays ? String(data.estimatedDeliveryDays) : ''
      );
      setDispatchNote(data.dispatchNote || '');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!courierService.trim()) {
      newErrors.courierService = 'Courier service is required';
    }

    if (!isEdit && imageUris.length === 0) {
      newErrors.images = 'At least one proof image is required';
    }

    if (estimatedDeliveryDays.trim()) {
      const days = parseInt(estimatedDeliveryDays);
      if (isNaN(days) || days < 1) {
        newErrors.estimatedDeliveryDays = 'Must be a positive number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickImages = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow access to your photo library to upload proof images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      const selected = result.assets.map(a => a.uri);
      setImageUris(prev => {
        const combined = [...prev, ...selected];
        return combined.slice(0, 5); // cap at 5
      });
      setErrors(prev => ({ ...prev, images: '' }));
    }
  }, []);

  const handleRemoveImage = (uri: string) => {
    setImageUris(prev => prev.filter(u => u !== uri));
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix all errors before submitting.');
      return;
    }

    const params = {
      courierService,
      trackingNumber: trackingNumber || undefined,
      estimatedDeliveryDays: estimatedDeliveryDays
        ? parseInt(estimatedDeliveryDays)
        : undefined,
      dispatchNote: dispatchNote || undefined,
    };

    let result;

    if (isEdit) {
      result = await updateDeliveryInfo({ orderId, ...params });
    } else {
      result = await shipOrder(orderId, params, imageUris);
    }

    if (result) {
      Alert.alert(
        'Success',
        isEdit ? 'Delivery info updated successfully.' : 'Order shipped successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else if (error) {
      Alert.alert('Error', error);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    errorKey: string,
    options?: {
      multiline?: boolean;
      keyboardType?: 'default' | 'phone-pad' | 'numeric';
      required?: boolean;
    }
  ) => (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>
        {label}
        {options?.required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          options?.multiline && styles.textArea,
          errors[errorKey] ? styles.inputError : null,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={options?.multiline}
        numberOfLines={options?.multiline ? 4 : 1}
        keyboardType={options?.keyboardType || 'default'}
      />
      {errors[errorKey] ? (
        <Text style={styles.errorText}>{errors[errorKey]}</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEdit ? 'Edit Delivery Info' : 'Ship Order'}
          </Text>
          <Text style={styles.subtitle}>Order ID: {orderId}</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {renderInput(
            'Courier Service',
            courierService,
            setCourierService,
            'e.g., DHL, FedEx, GIG Logistics',
            'courierService',
            { required: true }
          )}

          {renderInput(
            'Tracking Number',
            trackingNumber,
            setTrackingNumber,
            'Enter tracking number (optional)',
            'trackingNumber'
          )}

          {renderInput(
            'Estimated Delivery Days',
            estimatedDeliveryDays,
            setEstimatedDeliveryDays,
            'e.g., 3',
            'estimatedDeliveryDays',
            { keyboardType: 'numeric' }
          )}

          {renderInput(
            'Dispatch Note',
            dispatchNote,
            setDispatchNote,
            'Add any dispatch notes (optional)',
            'dispatchNote',
            { multiline: true }
          )}

          {/* Proof Images — required only when shipping */}
          {!isEdit && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                Proof Images <Text style={styles.required}>*</Text>
              </Text>
              <Text style={styles.hint}>Upload up to 5 images (handover, waybill, etc.)</Text>

              <TouchableOpacity
                style={[
                  styles.imagePickerButton,
                  errors.images ? styles.inputError : null,
                ]}
                onPress={handlePickImages}
                disabled={imageUris.length >= 5}
              >
                <Text style={styles.imagePickerText}>
                  {imageUris.length >= 5
                    ? 'Maximum images selected'
                    : `Add Images (${imageUris.length}/5)`}
                </Text>
              </TouchableOpacity>

              {errors.images ? (
                <Text style={styles.errorText}>{errors.images}</Text>
              ) : null}

              {imageUris.length > 0 && (
                <FlatList
                  data={imageUris}
                  keyExtractor={(uri) => uri}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imageList}
                  renderItem={({ item }) => (
                    <View style={styles.imageWrapper}>
                      <Image source={{ uri: item }} style={styles.previewImage} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => handleRemoveImage(item)}
                      >
                        <Text style={styles.removeImageText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          )}
        </View>

        {/* API Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {isEdit ? 'Update Info' : 'Ship Order'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
    marginTop: 30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: Colors.white,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  form: {
    backgroundColor: Colors.white,
    marginTop: 10,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
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
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 5,
  },
  imagePickerButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  imagePickerText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  imageList: {
    marginTop: 12,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    padding: 15,
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  errorMessage: {
    color: Colors.accentDark,
    fontSize: 14,
  },
  buttonContainer: {
    padding: 20,
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
  },
});

export default ShipOrderScreen;