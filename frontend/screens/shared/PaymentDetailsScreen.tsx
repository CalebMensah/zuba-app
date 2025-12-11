import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { usePayment } from '../../hooks/usePayment';

const PaymentDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { paymentId } = route.params as { paymentId: string };

  const {
    getPaymentDetails,
    paymentDetails,
    loading,
    error,
    clearPaymentDetails,
  } = usePayment();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPaymentDetails();
    return () => clearPaymentDetails();
  }, [paymentId]);

  const loadPaymentDetails = async () => {
    try {
      await getPaymentDetails(paymentId);
    } catch (err) {
      console.error('Failed to load payment details:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPaymentDetails();
    setRefreshing(false);
  };

  const handleCopyReference = async () => {
    if (paymentDetails?.gatewayRef) {
      // For React Native, you'd use Clipboard from '@react-native-clipboard/clipboard'
      // await Clipboard.setString(paymentDetails.gatewayRef);
      Alert.alert('Copied', 'Payment reference copied to clipboard');
    }
  };

  const handleContactSupport = () => {
    const email = 'support@zuba.com';
    const subject = `Payment Issue - Ref: ${paymentDetails?.gatewayRef}`;
    const body = `Payment ID: ${paymentDetails?.id}\nOrder ID: ${paymentDetails?.orderId}`;
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`);
  };

  const handleViewOrder = () => {
    if (paymentDetails?.orderId) {
      (navigation as any).navigate('OrderDetails' as never, { orderId: paymentDetails.orderId } as never);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return Colors.success;
      case 'PENDING':
        return Colors.warning;
      case 'FAILED':
        return Colors.error;
      default:
        return Colors.gray500;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return '#D1FAE5';
      case 'PENDING':
        return Colors.warningLight;
      case 'FAILED':
        return Colors.errorLight;
      default:
        return Colors.gray100;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'checkmark-circle';
      case 'PENDING':
        return 'time';
      case 'FAILED':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusBanner = () => {
    if (!paymentDetails) return null;

    const status = paymentDetails.status;
    const color = getStatusColor(status);
    const bgColor = getStatusBgColor(status);
    const icon = getStatusIcon(status);

    let message = '';
    let description = '';

    switch (status) {
      case 'SUCCESS':
        message = 'Payment Successful';
        description = 'Your payment has been processed successfully';
        break;
      case 'PENDING':
        message = 'Payment Pending';
        description = 'Your payment is being processed';
        break;
      case 'FAILED':
        message = 'Payment Failed';
        description = 'There was an issue processing your payment';
        break;
    }

    return (
      <View style={[styles.statusBanner, { backgroundColor: bgColor }]}>
        <View style={styles.statusIconContainer}>
          <Ionicons name={icon as any} size={48} color={color} />
        </View>
        <Text style={[styles.statusMessage, { color }]}>{message}</Text>
        <Text style={styles.statusDescription}>{description}</Text>
      </View>
    );
  };

  const renderInfoCard = (title: string, children: React.ReactNode) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderInfoRow = (label: string, value: string, icon?: string, copiable?: boolean) => (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        {icon && <Ionicons name={icon as any} size={18} color={Colors.textSecondary} />}
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <View style={styles.infoRowRight}>
        <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
        {copiable && (
          <TouchableOpacity onPress={handleCopyReference}>
            <Ionicons name="copy-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEscrowCard = () => {
    if (!paymentDetails?.escrow) return null;

    const escrow = paymentDetails.escrow;
    const releaseDate = new Date(escrow.releaseDate);
    const now = new Date();
    const isReleased = escrow.status === 'RELEASED';
    const daysUntilRelease = Math.ceil((releaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return (
      <View style={styles.escrowCard}>
        <View style={styles.escrowHeader}>
          <View style={styles.escrowIconContainer}>
            <Ionicons 
              name={isReleased ? 'shield-checkmark' : 'shield-outline'} 
              size={24} 
              color={isReleased ? Colors.success : Colors.info} 
            />
          </View>
          <View style={styles.escrowHeaderText}>
            <Text style={styles.escrowTitle}>Escrow Protection</Text>
            <Text style={styles.escrowSubtitle}>
              {isReleased ? 'Funds Released' : 'Funds Held Securely'}
            </Text>
          </View>
          <View style={[
            styles.escrowStatusBadge,
            { backgroundColor: isReleased ? '#D1FAE5' : Colors.infoLight }
          ]}>
            <Text style={[
              styles.escrowStatusText,
              { color: isReleased ? Colors.success : Colors.info }
            ]}>
              {escrow.status}
            </Text>
          </View>
        </View>

        <View style={styles.escrowDivider} />

        <View style={styles.escrowDetails}>
          <View style={styles.escrowDetailRow}>
            <Text style={styles.escrowDetailLabel}>Amount Held</Text>
            <Text style={styles.escrowDetailValue}>
              {formatCurrency(escrow.amountHeld, escrow.currency)}
            </Text>
          </View>
          <View style={styles.escrowDetailRow}>
            <Text style={styles.escrowDetailLabel}>
              {isReleased ? 'Release Date' : 'Scheduled Release'}
            </Text>
            <Text style={styles.escrowDetailValue}>
              {formatDate(escrow.releaseDate)}
            </Text>
          </View>
          {!isReleased && daysUntilRelease > 0 && (
            <View style={styles.escrowCountdown}>
              <Ionicons name="time-outline" size={16} color={Colors.info} />
              <Text style={styles.escrowCountdownText}>
                {daysUntilRelease} day{daysUntilRelease !== 1 ? 's' : ''} until release
              </Text>
            </View>
          )}
        </View>

        <View style={styles.escrowInfo}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.escrowInfoText}>
            {isReleased 
              ? 'Funds have been released to the seller'
              : 'Funds will be held in escrow for 4 days to ensure order delivery'}
          </Text>
        </View>
      </View>
    );
  };

  const renderOrderItems = () => {
    if (!paymentDetails?.order?.items || paymentDetails.order.items.length === 0) return null;

    return (
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Order Items</Text>
        {paymentDetails.order.items.map((item: any, index: number) => (
          <View key={item.id} style={styles.orderItem}>
            <View style={styles.orderItemLeft}>
              <View style={styles.orderItemImagePlaceholder}>
                <Ionicons name="cube-outline" size={24} color={Colors.gray400} />
              </View>
              <View style={styles.orderItemInfo}>
                <Text style={styles.orderItemName} numberOfLines={2}>
                  {item.product.name}
                </Text>
                <Text style={styles.orderItemQuantity}>Qty: {item.quantity}</Text>
              </View>
            </View>
            <Text style={styles.orderItemPrice}>
              {formatCurrency(item.price * item.quantity, paymentDetails.currency)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderActionButtons = () => {
    if (!paymentDetails) return null;

    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButtonPrimary}
          onPress={handleViewOrder}
        >
          <Ionicons name="receipt-outline" size={20} color={Colors.white} />
          <Text style={styles.actionButtonPrimaryText}>View Order</Text>
        </TouchableOpacity>

        {paymentDetails.status === 'FAILED' && (
          <TouchableOpacity 
            style={styles.actionButtonSecondary}
            onPress={handleContactSupport}
          >
            <Ionicons name="headset-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonSecondaryText}>Contact Support</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading && !paymentDetails) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  if (error && !paymentDetails) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={Colors.error} />
        <Text style={styles.errorTitle}>Failed to Load</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadPaymentDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!paymentDetails) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[Colors.primary]}
          tintColor={Colors.primary}
        />
      }
    >
      {renderStatusBanner()}

      {/* Payment Information */}
      {renderInfoCard('Payment Information', (
        <>
          {renderInfoRow(
            'Amount',
            formatCurrency(paymentDetails.amount, paymentDetails.currency),
            'cash-outline'
          )}
          {renderInfoRow('Reference', paymentDetails.gatewayRef, 'barcode-outline', true)}
          {renderInfoRow('Gateway', paymentDetails.gateway.toUpperCase(), 'card-outline')}
          {renderInfoRow(
            'Gateway Status',
            paymentDetails.gatewayStatus.toUpperCase(),
            'swap-horizontal-outline'
          )}
          {renderInfoRow('Payment Date', formatDate(paymentDetails.createdAt), 'calendar-outline')}
          {paymentDetails.updatedAt !== paymentDetails.createdAt && (
            renderInfoRow('Last Updated', formatDate(paymentDetails.updatedAt), 'time-outline')
          )}
        </>
      ))}

      {/* Escrow Card */}
      {renderEscrowCard()}

      {/* Order Information */}
      {renderInfoCard('Order Information', (
        <>
          {renderInfoRow('Order ID', paymentDetails.orderId, 'receipt-outline')}
          {renderInfoRow(
            'Order Status',
            paymentDetails.order.status,
            'information-circle-outline'
          )}
          {renderInfoRow(
            'Order Total',
            formatCurrency(paymentDetails.order.totalAmount, paymentDetails.currency),
            'calculator-outline'
          )}
          {paymentDetails.order.checkoutSession && (
            renderInfoRow(
              'Checkout Session',
              paymentDetails.order.checkoutSession.slice(0, 20) + '...',
              'git-merge-outline'
            )
          )}
        </>
      ))}

      {/* Buyer Information */}
      {renderInfoCard('Buyer Information', (
        <>
          {renderInfoRow(
            'Name',
            paymentDetails.order.buyer.firstName,
            'person-outline'
          )}
          {renderInfoRow('Email', paymentDetails.order.buyer.email, 'mail-outline')}
        </>
      ))}

      {/* Seller Information */}
      {renderInfoCard('Seller Information', (
        <>
          {renderInfoRow(
            'Name',
            paymentDetails.order.store.user.firstName,
            'person-outline'
          )}
          {renderInfoRow('Email', paymentDetails.order.store.user.email, 'mail-outline')}
        </>
      ))}

      {/* Order Items */}
      {renderOrderItems()}

      {/* Transaction Timeline */}
      {renderInfoCard('Transaction Timeline', (
        <View style={styles.timeline}>
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, { backgroundColor: Colors.success }]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Payment Initiated</Text>
              <Text style={styles.timelineDate}>{formatDate(paymentDetails.createdAt)}</Text>
            </View>
          </View>
          
          {paymentDetails.status === 'SUCCESS' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.success }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Payment Successful</Text>
                <Text style={styles.timelineDate}>{formatDate(paymentDetails.updatedAt)}</Text>
              </View>
            </View>
          )}

          {paymentDetails.status === 'FAILED' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.error }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Payment Failed</Text>
                <Text style={styles.timelineDate}>{formatDate(paymentDetails.updatedAt)}</Text>
              </View>
            </View>
          )}

          {paymentDetails.escrow && paymentDetails.escrow.status === 'RELEASED' && (
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: Colors.info }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Escrow Released</Text>
                <Text style={styles.timelineDate}>
                  {paymentDetails.escrow.releaseDate 
                    ? formatDate(paymentDetails.escrow.releaseDate)
                    : 'Pending'}
                </Text>
              </View>
            </View>
          )}
        </View>
      ))}

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Need Help Section */}
      <View style={styles.helpCard}>
        <Ionicons name="help-circle-outline" size={24} color={Colors.primary} />
        <Text style={styles.helpTitle}>Need Help?</Text>
        <Text style={styles.helpText}>
          If you have any questions about this payment, please contact our support team.
        </Text>
        <TouchableOpacity style={styles.helpButton} onPress={handleContactSupport}>
          <Text style={styles.helpButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: 32,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  statusBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  statusIconContainer: {
    marginBottom: 12,
  },
  statusMessage: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  infoRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'right',
  },
  escrowCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: Colors.info,
  },
  escrowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  escrowIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.infoLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  escrowHeaderText: {
    flex: 1,
  },
  escrowTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  escrowSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  escrowStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  escrowStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  escrowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  escrowDetails: {
    gap: 12,
  },
  escrowDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  escrowDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  escrowDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  escrowCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  escrowCountdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.info,
  },
  escrowInfo: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  escrowInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  orderItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  orderItemQuantity: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  orderItemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 12,
  },
  timeline: {
    gap: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  actionButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  helpCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  helpButton: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  helpButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
});

export default PaymentDetailsScreen;