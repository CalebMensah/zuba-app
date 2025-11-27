import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVerification } from '../../hooks/useVerification';
import { Colors } from '../../constants/colors';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const IMAGE_WIDTH = (width - 64) / 2;

interface VerificationDetailsProps {
  navigation: any;
  route: any;
}

export default function VerificationDetailsScreen({
  navigation,
  route,
}: VerificationDetailsProps) {
  const { verificationId } = route.params || {};
  const {
    verification,
    loading,
    error,
    getVerificationDetails,
    updateVerificationStatus,
  } = useVerification();

  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (verificationId) {
      fetchVerificationDetails();
    }
  }, [verificationId]);

  const fetchVerificationDetails = async () => {
    await getVerificationDetails(verificationId);
  };

  const handleVerifyStore = () => {
    Alert.alert(
      'Verify Store',
      'Are you sure you want to verify this store? This will activate the store and make it publicly visible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            const result = await updateVerificationStatus(
              verificationId,
              'verified'
            );
            setActionLoading(false);

            if (result.success) {
              Alert.alert('Success', 'Store verified successfully!', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } else {
              Alert.alert('Error', result.message || 'Failed to verify store');
            }
          },
        },
      ]
    );
  };

  const handleRejectStore = () => {
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!rejectionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for rejection');
      return;
    }

    setShowRejectModal(false);
    setActionLoading(true);

    const result = await updateVerificationStatus(
      verificationId,
      'rejected',
      rejectionReason.trim()
    );
    setActionLoading(false);

    if (result.success) {
      Alert.alert('Success', 'Store verification rejected', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else {
      Alert.alert('Error', result.message || 'Failed to reject verification');
    }

    setRejectionReason('');
  };

  const handleStorePress = () => {
    if (verification?.store) {
      navigation.navigate('StoreDetails', {
        storeId: verification.store.id,
      });
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
        return Colors.textSecondary;
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

  if (loading && !verification) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading verification...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !verification) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Error Loading Verification</Text>
          <Text style={styles.errorMessage}>
            {error || 'Could not load verification details'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={fetchVerificationDetails}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verification Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: `${getStatusColor(verification.status)}20` },
          ]}
        >
          <Ionicons
            name={getStatusIcon(verification.status)}
            size={24}
            color={getStatusColor(verification.status)}
          />
          <Text
            style={[
              styles.statusText,
              { color: getStatusColor(verification.status) },
            ]}
          >
            {verification.status.charAt(0).toUpperCase() +
              verification.status.slice(1)}
          </Text>
        </View>

        {/* Store Information */}
        {verification.store && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Store Information</Text>
            <TouchableOpacity
              style={styles.storeCard}
              onPress={handleStorePress}
              activeOpacity={0.7}
            >
              <View style={styles.storeHeader}>
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{verification.store.name}</Text>
                  <Text style={styles.storeUrl}>@{verification.store.url}</Text>
                  <View style={styles.storeStatusBadge}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: verification.store.isActive
                            ? Colors.success
                            : Colors.error,
                        },
                      ]}
                    />
                    <Text style={styles.storeStatusText}>
                      {verification.store.isActive ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={Colors.textSecondary}
                />
              </View>

              {verification.store.user && (
                <View style={styles.ownerInfo}>
                  <Ionicons name="person" size={16} color={Colors.textSecondary} />
                  <Text style={styles.ownerText}>
                    {verification.store.user.firstName}
                  </Text>
                  {verification.store.user.email && (
                    <>
                      <Text style={styles.dividerDot}>•</Text>
                      <Text style={styles.ownerText}>
                        {verification.store.user.email}
                      </Text>
                    </>
                  )}
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Verification Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Documents</Text>

          {/* Ghana Card Front */}
          <View style={styles.documentSection}>
            <Text style={styles.documentLabel}>Ghana Card (Front)</Text>
            <TouchableOpacity
              style={styles.documentImageContainer}
              onPress={() => setSelectedImage(verification.ghanaCardFront)}
            >
              <Image
                source={{ uri: verification.ghanaCardFront }}
                style={styles.documentImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand" size={24} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Ghana Card Back */}
          <View style={styles.documentSection}>
            <Text style={styles.documentLabel}>Ghana Card (Back)</Text>
            <TouchableOpacity
              style={styles.documentImageContainer}
              onPress={() => setSelectedImage(verification.ghanaCardBack)}
            >
              <Image
                source={{ uri: verification.ghanaCardBack }}
                style={styles.documentImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand" size={24} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Selfie */}
          <View style={styles.documentSection}>
            <Text style={styles.documentLabel}>Selfie with ID</Text>
            <TouchableOpacity
              style={styles.documentImageContainer}
              onPress={() => setSelectedImage(verification.selfie)}
            >
              <Image
                source={{ uri: verification.selfie }}
                style={styles.documentImage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="expand" size={24} color={Colors.white} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Business Document (Optional) */}
          {verification.businessDoc && (
            <View style={styles.documentSection}>
              <Text style={styles.documentLabel}>Business Document</Text>
              <TouchableOpacity
                style={styles.documentImageContainer}
                onPress={() => setSelectedImage(verification.businessDoc!)}
              >
                <Image
                  source={{ uri: verification.businessDoc }}
                  style={styles.documentImage}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand" size={24} color={Colors.white} />
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Rejection Reason */}
        {verification.status === 'rejected' && verification.rejectionReason && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejection Reason</Text>
            <View style={styles.rejectionReasonCard}>
              <Ionicons name="information-circle" size={20} color={Colors.error} />
              <Text style={styles.rejectionReasonText}>
                {verification.rejectionReason}
              </Text>
            </View>
          </View>
        )}

        {/* Timestamps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dates</Text>
          <View style={styles.timestampCard}>
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Submitted</Text>
              <Text style={styles.timestampValue}>
                {new Date(verification.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {verification.verifiedAt && (
              <View style={styles.timestampRow}>
                <Text style={styles.timestampLabel}>Verified</Text>
                <Text style={styles.timestampValue}>
                  {new Date(verification.verifiedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            )}
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>Last Updated</Text>
              <Text style={styles.timestampValue}>
                {new Date(verification.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        {verification.status === 'pending' && (
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleRejectStore}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.verifyButton]}
              onPress={handleVerifyStore}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Verify Store</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reject Verification</Text>
              <TouchableOpacity onPress={() => setShowRejectModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Please provide a detailed reason for rejection. This will be sent to
              the store owner.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              numberOfLines={4}
              value={rejectionReason}
              onChangeText={setRejectionReason}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalRejectButton]}
                onPress={submitRejection}
              >
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity
            style={styles.closeImageButton}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close" size={32} color={Colors.white} />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    gap: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: Colors.white,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  storeCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  storeUrl: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 8,
  },
  storeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storeStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ownerText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  dividerDot: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  documentSection: {
    marginBottom: 20,
  },
  documentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  documentImageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  documentImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.gray100,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.overlay,
    borderRadius: 8,
    padding: 8,
  },
  rejectionReasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.errorLight,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  rejectionReasonText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.error,
  },
  timestampCard: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
  },
  timestampRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  timestampLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timestampValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  verifyButton: {
    backgroundColor: Colors.success,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  reasonInput: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    minHeight: 120,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: Colors.backgroundTertiary,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalRejectButton: {
    backgroundColor: Colors.error,
  },
  modalRejectText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: Colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeImageButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    backgroundColor: Colors.overlay,
    borderRadius: 20,
    padding: 8,
  },
  previewImage: {
    width: width,
    height: '80%',
  },
  bottomSpacer: {
    height: 32,
  },
});