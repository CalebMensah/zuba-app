import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useVerification } from '../../hooks/useVerification';
import { Colors } from '../../constants/colors';

interface DocumentState {
  uri: string | null;
  name: string | null;
  type: string | null;
  file: any;
}

const StoreVerificationScreen = ({ navigation }: any) => {
  const {
    verification,
    loading,
    error,
    submitVerification,
    getMyVerificationStatus,
    clearError,
  } = useVerification();

  const [ghanaCardFront, setGhanaCardFront] = useState<DocumentState>({
    uri: null,
    name: null,
    type: null,
    file: null,
  });
  const [ghanaCardBack, setGhanaCardBack] = useState<DocumentState>({
    uri: null,
    name: null,
    type: null,
    file: null,
  });
  const [selfie, setSelfie] = useState<DocumentState>({
    uri: null,
    name: null,
    type: null,
    file: null,
  });
  const [businessDoc, setBusinessDoc] = useState<DocumentState>({
    uri: null,
    name: null,
    type: null,
    file: null,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadVerificationStatus();
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert(
          'Permissions Required',
          'Camera and photo library permissions are required to upload verification documents.'
        );
      }
    }
  };

  const loadVerificationStatus = async () => {
    const result = await getMyVerificationStatus();
    if (result.success && result.data) {
      // If verification exists, show status
      console.log('Verification status:', result.data.status);
    }
  };

  const pickImage = async (setter: React.Dispatch<React.SetStateAction<DocumentState>>, useCamera = false) => {
    try {
      let result;

      if (useCamera) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Create file object for upload
        const file = {
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        };

        setter({
          uri: asset.uri,
          name: file.name,
          type: file.type,
          file: file,
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickDocument = async (setter: React.Dispatch<React.SetStateAction<DocumentState>>) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if ('assets' in result && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
        };

        setter({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          file: file,
        });
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const showImageOptions = (setter: React.Dispatch<React.SetStateAction<DocumentState>>, isDocument = false) => {
    Alert.alert(
      'Choose Option',
      'How would you like to upload the document?',
      [
        {
          text: 'Take Photo',
          onPress: () => pickImage(setter, true),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => pickImage(setter, false),
        },
        ...(isDocument
          ? [
              {
                text: 'Choose Document',
                onPress: () => pickDocument(setter),
              },
            ]
          : []),
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const removeDocument = (setter: React.Dispatch<React.SetStateAction<DocumentState>>) => {
    setter({
      uri: null,
      name: null,
      type: null,
      file: null,
    });
  };

  const validateForm = (): boolean => {
    if (!ghanaCardFront.file) {
      Alert.alert('Missing Document', 'Please upload Ghana Card Front');
      return false;
    }
    if (!ghanaCardBack.file) {
      Alert.alert('Missing Document', 'Please upload Ghana Card Back');
      return false;
    }
    if (!selfie.file) {
      Alert.alert('Missing Document', 'Please upload a Selfie');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Show confirmation if resubmitting
    if (verification && verification.status === 'rejected') {
      Alert.alert(
        'Resubmit Verification',
        'Are you sure you want to resubmit your verification documents?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', onPress: () => submitDocuments() },
        ]
      );
    } else {
      submitDocuments();
    }
  };

  const submitDocuments = async () => {
    setSubmitting(true);

    try {
      // Create FormData
      const formData = new FormData();
      
      // Append required documents
      formData.append('ghanaCardFront', {
        uri: ghanaCardFront.file.uri,
        name: ghanaCardFront.file.name,
        type: ghanaCardFront.file.type,
      } as any);

      formData.append('ghanaCardBack', {
        uri: ghanaCardBack.file.uri,
        name: ghanaCardBack.file.name,
        type: ghanaCardBack.file.type,
      } as any);

      formData.append('selfie', {
        uri: selfie.file.uri,
        name: selfie.file.name,
        type: selfie.file.type,
      } as any);

      // Append optional business document
      if (businessDoc.file) {
        formData.append('businessDoc', {
          uri: businessDoc.file.uri,
          name: businessDoc.file.name,
          type: businessDoc.file.type,
        } as any);
      }

      // Add rejection reason if resubmitting
      if (verification?.status === 'rejected' && rejectionReason) {
        formData.append('rejectionReason', rejectionReason);
      }

      const result = await submitVerification(
        {
          ghanaCardFront: ghanaCardFront.file as any,
          ghanaCardBack: ghanaCardBack.file as any,
          selfie: selfie.file as any,
          businessDoc: businessDoc.file as any,
        },
        verification?.status === 'rejected' ? rejectionReason : undefined
      );

      if (result.success) {
        Alert.alert(
          'Success',
          'Your verification documents have been submitted successfully. We will review them within 24-48 hours.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form
                setGhanaCardFront({ uri: null, name: null, type: null, file: null });
                setGhanaCardBack({ uri: null, name: null, type: null, file: null });
                setSelfie({ uri: null, name: null, type: null, file: null });
                setBusinessDoc({ uri: null, name: null, type: null, file: null });
                setRejectionReason('');
                
                // Reload status
                loadVerificationStatus();
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to submit verification documents');
      }
    } catch (error: any) {
      console.error('Verification submission error:', error);
      Alert.alert('Error', error.message || 'An error occurred during submission');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return Colors.success;
      case 'rejected':
        return Colors.error;
      case 'pending':
        return Colors.warning;
      default:
        return Colors.gray500;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  // Show verification status if exists
  if (verification && verification.status !== 'rejected') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification Status</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor(verification.status) + '20' }]}>
              <Ionicons
                name={getStatusIcon(verification.status) as any}
                size={64}
                color={getStatusColor(verification.status)}
              />
            </View>

            <Text style={styles.statusTitle}>
              {verification.status === 'verified' ? 'Store Verified!' : 'Verification Pending'}
            </Text>

            <Text style={styles.statusDescription}>
              {verification.status === 'verified'
                ? 'Your store has been verified and is now live on Zuba!'
                : 'Your documents are currently under review. We will notify you once the review is complete.'}
            </Text>

            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(verification.status) }]}>
              <Text style={styles.statusBadgeText}>{verification.status.toUpperCase()}</Text>
            </View>

            {verification.verifiedAt && (
              <Text style={styles.verifiedDate}>
                Verified on {new Date(verification.verifiedAt).toLocaleDateString()}
              </Text>
            )}

            {verification.status === 'verified' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate('StoreDashboard')}
              >
                <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
                <Ionicons name="arrow-forward" size={20} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={Colors.info} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>What's Next?</Text>
              <Text style={styles.infoText}>
                {verification.status === 'verified'
                  ? 'You can now start adding products and managing your store.'
                  : 'Please wait while we review your documents. This usually takes 24-48 hours. You will receive an email notification once the review is complete.'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Show submission form
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Verification</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Introduction Card */}
        <View style={styles.introCard}>
          <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
          <Text style={styles.introTitle}>Verify Your Store</Text>
          <Text style={styles.introText}>
            To start selling on Zuba, we need to verify your identity and business documents.
            This helps us maintain a safe and trustworthy marketplace.
          </Text>
        </View>

        {/* Rejection Notice (if resubmitting) */}
        {verification?.status === 'rejected' && (
          <View style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <Ionicons name="alert-circle" size={24} color={Colors.error} />
              <Text style={styles.rejectionTitle}>Verification Rejected</Text>
            </View>
            <Text style={styles.rejectionReason}>{verification.rejectionReason}</Text>
            <Text style={styles.rejectionNote}>
              Please review the feedback above and resubmit your documents.
            </Text>
          </View>
        )}

        {/* Required Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Required Documents *</Text>

          {/* Ghana Card Front */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="card" size={20} color={Colors.primary} />
              <Text style={styles.documentTitle}>Ghana Card (Front)</Text>
            </View>
            <Text style={styles.documentDescription}>
              Clear photo of the front side of your Ghana Card
            </Text>

            {ghanaCardFront.uri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: ghanaCardFront.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeDocument(setGhanaCardFront)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => showImageOptions(setGhanaCardFront)}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Ghana Card Back */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="card" size={20} color={Colors.primary} />
              <Text style={styles.documentTitle}>Ghana Card (Back)</Text>
            </View>
            <Text style={styles.documentDescription}>
              Clear photo of the back side of your Ghana Card
            </Text>

            {ghanaCardBack.uri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: ghanaCardBack.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeDocument(setGhanaCardBack)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => showImageOptions(setGhanaCardBack)}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Selfie */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="person" size={20} color={Colors.primary} />
              <Text style={styles.documentTitle}>Selfie with Ghana Card</Text>
            </View>
            <Text style={styles.documentDescription}>
              Take a selfie while holding your Ghana Card next to your face
            </Text>

            {selfie.uri ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selfie.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeDocument(setSelfie)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => showImageOptions(setSelfie)}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={Colors.primary} />
                <Text style={styles.uploadButtonText}>Upload Selfie</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Optional Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Optional Documents</Text>

          {/* Business Document */}
          <View style={styles.documentCard}>
            <View style={styles.documentHeader}>
              <Ionicons name="document-text" size={20} color={Colors.textSecondary} />
              <Text style={styles.documentTitle}>Business Registration (Optional)</Text>
            </View>
            <Text style={styles.documentDescription}>
              Business registration certificate or any official business document
            </Text>

            {businessDoc.uri ? (
              <View style={styles.filePreview}>
                <Ionicons name="document" size={32} color={Colors.primary} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {businessDoc.name}
                </Text>
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => removeDocument(setBusinessDoc)}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadButton, styles.optionalUploadButton]}
                onPress={() => showImageOptions(setBusinessDoc, true)}
              >
                <Ionicons name="cloud-upload-outline" size={24} color={Colors.textSecondary} />
                <Text style={styles.optionalUploadButtonText}>Upload Document (Optional)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Guidelines */}
        <View style={styles.guidelinesCard}>
          <Text style={styles.guidelinesTitle}>Document Guidelines</Text>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.guidelineText}>Ensure all documents are clear and readable</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.guidelineText}>Photos should be well-lit and in focus</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.guidelineText}>All text and details must be visible</Text>
          </View>
          <View style={styles.guidelineItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.guidelineText}>Accepted formats: JPG, PNG, PDF</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (submitting || !ghanaCardFront.file || !ghanaCardBack.file || !selfie.file) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || !ghanaCardFront.file || !ghanaCardBack.file || !selfie.file}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={styles.submitButtonText}>Submit for Verification</Text>
              <Ionicons name="arrow-forward" size={20} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: Colors.white,
    margin: 16,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  statusBadgeText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  verifiedDate: {
    fontSize: 14,
    color: Colors.textTertiary,
    marginBottom: 24,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.info,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.info,
    lineHeight: 20,
  },
  introCard: {
    backgroundColor: Colors.white,
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 12,
  },
  introText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  rejectionCard: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
  },
  rejectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  rejectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
  },
  rejectionReason: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 20,
  },
  rejectionNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  documentCard: {
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  documentDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight + '20',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  optionalUploadButton: {
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
  },
  optionalUploadButtonText: {
    color: Colors.textSecondary,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    gap: 12,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  removeFileButton: {
    padding: 4,
  },
  guidelinesCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
  },
  bottomSpacer: {
    height: 100,
  },
  bottomContainer: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default StoreVerificationScreen;