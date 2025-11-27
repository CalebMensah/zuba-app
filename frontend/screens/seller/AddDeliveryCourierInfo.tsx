import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDelivery } from '../../hooks/useDeliveryInfo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors } from '../../constants/colors';

interface RouteParams {
  orderId: string;
  isEdit?: boolean;
}

const AddDeliveryCourierInfo = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { orderId, isEdit } = route.params as RouteParams;

  const {
    loading,
    error,
    assignCourier,
    getDeliveryInfo,
    editDeliveryInfo,
    setDeliveryStatus,
    clearError,
  } = useDelivery();

  // Form state
  const [courierService, setCourierService] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverVehicleNumber, setDriverVehicleNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing data if editing
  useEffect(() => {
    if (isEdit) {
      loadDeliveryInfo();
    }
  }, [isEdit, orderId]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      clearError();
    };
  }, []);

  const loadDeliveryInfo = async () => {
    const data = await getDeliveryInfo(orderId);
    if (data) {
      setCourierService(data.courierService || '');
      setDriverName(data.driverName || '');
      setDriverPhone(data.driverPhone || '');
      setDriverVehicleNumber(data.driverVehicleNumber || '');
      setTrackingNumber(data.trackingNumber || '');
      setTrackingUrl(data.trackingUrl || '');
      setNotes(data.notes || '');
      setCurrentStatus(data.status);
      if (data.estimatedDelivery) {
        setEstimatedDelivery(new Date(data.estimatedDelivery));
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!courierService.trim()) {
      newErrors.courierService = 'Courier service is required';
    }

    if (!driverName.trim()) {
      newErrors.driverName = 'Driver name is required';
    }

    if (!driverVehicleNumber.trim()) {
      newErrors.driverVehicleNumber = 'Vehicle number is required';
    }

    if (driverPhone && !/^\+?[\d\s-()]+$/.test(driverPhone)) {
      newErrors.driverPhone = 'Invalid phone number format';
    }

    if (trackingUrl && !isValidUrl(trackingUrl)) {
      newErrors.trackingUrl = 'Invalid URL format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix all errors before submitting');
      return;
    }

    const params = {
      orderId,
      courierService,
      driverName,
      driverVehicleNumber,
      driverPhone: driverPhone || undefined,
      trackingNumber: trackingNumber || undefined,
      trackingUrl: trackingUrl || undefined,
      estimatedDelivery: estimatedDelivery?.toISOString(),
      notes: notes || undefined,
    };

    let result;
    if (isEdit) {
      result = await editDeliveryInfo(params);
    } else {
      result = await assignCourier(params);
    }

    if (result) {
      Alert.alert(
        'Success',
        isEdit ? 'Delivery info updated successfully' : 'Courier assigned successfully',
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
  };

  const handleMarkAsDelivered = () => {
    Alert.alert(
      'Mark as Delivered',
      'Are you sure you want to mark this order as delivered?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const result = await setDeliveryStatus({
              orderId,
              status: 'DELIVERED',
            });

            if (result) {
              Alert.alert('Success', 'Order marked as delivered', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } else if (error) {
              Alert.alert('Error', error);
            }
          },
        },
      ]
    );
  };

  const handleMarkAsOutForDelivery = async () => {
    const result = await setDeliveryStatus({
      orderId,
      status: 'OUT_FOR_DELIVERY',
    });

    if (result) {
      Alert.alert('Success', 'Order marked as out for delivery');
      setCurrentStatus('OUT_FOR_DELIVERY');
    } else if (error) {
      Alert.alert('Error', error);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEstimatedDelivery(selectedDate);
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
      keyboardType?: 'default' | 'phone-pad' | 'url';
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
          errors[errorKey] && styles.inputError,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={options?.multiline}
        numberOfLines={options?.multiline ? 4 : 1}
        keyboardType={options?.keyboardType || 'default'}
      />
      {errors[errorKey] && (
        <Text style={styles.errorText}>{errors[errorKey]}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>
            {isEdit ? 'Edit Delivery Info' : 'Assign Courier'}
          </Text>
          <Text style={styles.subtitle}>Order ID: {orderId}</Text>
          {currentStatus && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{currentStatus}</Text>
            </View>
          )}
        </View>

        <View style={styles.form}>
          {renderInput(
            'Courier Service',
            courierService,
            setCourierService,
            'e.g., DHL, FedEx, UPS',
            'courierService',
            { required: true }
          )}

          {renderInput(
            'Driver Name',
            driverName,
            setDriverName,
            'Enter driver name',
            'driverName',
            { required: true }
          )}

          {renderInput(
            'Driver Phone',
            driverPhone,
            setDriverPhone,
            'Enter phone number',
            'driverPhone',
            { keyboardType: 'phone-pad' }
          )}

          {renderInput(
            'Vehicle Number',
            driverVehicleNumber,
            setDriverVehicleNumber,
            'Enter vehicle number',
            'driverVehicleNumber',
            { required: true }
          )}

          {renderInput(
            'Tracking Number',
            trackingNumber,
            setTrackingNumber,
            'Enter tracking number',
            'trackingNumber'
          )}

          {renderInput(
            'Tracking URL',
            trackingUrl,
            setTrackingUrl,
            'https://tracking.example.com',
            'trackingUrl',
            { keyboardType: 'url' }
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Estimated Delivery Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {estimatedDelivery
                  ? estimatedDelivery.toLocaleDateString()
                  : 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={estimatedDelivery || new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
              minimumDate={new Date()}
            />
          )}

          {renderInput(
            'Notes',
            notes,
            setNotes,
            'Add any additional notes',
            'notes',
            { multiline: true }
          )}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorMessage}>{error}</Text>
          </View>
        )}

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
                {isEdit ? 'Update Info' : 'Assign Courier'}
              </Text>
            )}
          </TouchableOpacity>

          {isEdit && currentStatus === 'SHIPPED' && (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleMarkAsOutForDelivery}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Mark Out for Delivery</Text>
            </TouchableOpacity>
          )}

          {isEdit &&
            ['SHIPPED', 'OUT_FOR_DELIVERY'].includes(currentStatus) && (
              <TouchableOpacity
                style={[styles.button, styles.successButton]}
                onPress={handleMarkAsDelivered}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Mark as Delivered</Text>
              </TouchableOpacity>
            )}

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
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  statusText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
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
  dateButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: Colors.white,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.textPrimary,
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
  secondaryButton: {
    backgroundColor: Colors.warning,
  },
  successButton: {
    backgroundColor: Colors.success,
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

export default AddDeliveryCourierInfo;