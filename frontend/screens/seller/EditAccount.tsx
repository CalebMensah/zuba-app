import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { usePaymentAccount, PaymentAccountInput } from '../../hooks/useAccountDetails';

type AccountType = 'bank' | 'mobile_money';

export default function EditAddress({ navigation, route }: any) {
  const { paymentAccount: existingAccount } = route.params || {};
  const { loading, error, upsertPaymentAccount, clearError } = usePaymentAccount();
  
  const [accountType, setAccountType] = useState<AccountType>(
    existingAccount?.accountType || 'bank'
  );
  
  // Bank account fields
  const [bankName, setBankName] = useState(existingAccount?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(existingAccount?.accountNumber || '');
  const [accountName, setAccountName] = useState(existingAccount?.accountName || '');
  
  // Mobile money fields
  const [provider, setProvider] = useState(existingAccount?.provider || '');
  const [mobileNumber, setMobileNumber] = useState(existingAccount?.mobileNumber || '');

  useEffect(() => {
    if (!existingAccount) {
      Alert.alert('Error', 'No payment account data found', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    }
  }, [existingAccount, navigation]);

  const validateBankAccount = (): boolean => {
    if (!bankName.trim()) {
      Alert.alert('Validation Error', 'Please enter bank name');
      return false;
    }
    if (!accountNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter account number');
      return false;
    }
    if (!accountName.trim()) {
      Alert.alert('Validation Error', 'Please enter account name');
      return false;
    }
    return true;
  };

  const validateMobileMoneyAccount = (): boolean => {
    if (!provider.trim()) {
      Alert.alert('Validation Error', 'Please enter provider name');
      return false;
    }
    if (!mobileNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter mobile number');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    clearError();

    let accountData: PaymentAccountInput;

    if (accountType === 'bank') {
      if (!validateBankAccount()) return;
      
      accountData = {
        accountType: 'bank',
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        isPrimary: true,
        isActive: true,
      };
    } else {
      if (!validateMobileMoneyAccount()) return;
      
      accountData = {
        accountType: 'mobile_money',
        provider: provider.trim(),
        mobileNumber: mobileNumber.trim(),
        isPrimary: true,
        isActive: true,
      };
    }

    const result = await upsertPaymentAccount(accountData);

    if (result) {
      Alert.alert('Success', 'Payment account updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } else if (error) {
      Alert.alert('Error', error);
    }
  };

  const handleAccountTypeChange = (type: AccountType) => {
    Alert.alert(
      'Change Account Type',
      'Changing account type will clear the current form. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            setAccountType(type);
            // Clear all fields
            setBankName('');
            setAccountNumber('');
            setAccountName('');
            setProvider('');
            setMobileNumber('');
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Edit Payment Account</Text>
          <Text style={styles.subtitle}>
            Update your payment account details
          </Text>
        </View>

        {/* Account Type Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Account Type</Text>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                accountType === 'bank' && styles.tabActive,
              ]}
              onPress={() => {
                if (accountType !== 'bank') {
                  handleAccountTypeChange('bank');
                }
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  accountType === 'bank' && styles.tabTextActive,
                ]}
              >
                Bank Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                accountType === 'mobile_money' && styles.tabActive,
              ]}
              onPress={() => {
                if (accountType !== 'mobile_money') {
                  handleAccountTypeChange('mobile_money');
                }
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  accountType === 'mobile_money' && styles.tabTextActive,
                ]}
              >
                Mobile Money
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bank Account Fields */}
        {accountType === 'bank' && (
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bank Name</Text>
              <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g., GCB Bank, Ecobank"
                placeholderTextColor={Colors.gray400}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Number</Text>
              <TextInput
                style={styles.input}
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Enter account number"
                placeholderTextColor={Colors.gray400}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Account Name</Text>
              <TextInput
                style={styles.input}
                value={accountName}
                onChangeText={setAccountName}
                placeholder="Enter account holder name"
                placeholderTextColor={Colors.gray400}
              />
            </View>
          </View>
        )}

        {/* Mobile Money Fields */}
        {accountType === 'mobile_money' && (
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Provider</Text>
              <TextInput
                style={styles.input}
                value={provider}
                onChangeText={setProvider}
                placeholder="e.g., MTN, Vodafone, AirtelTigo"
                placeholderTextColor={Colors.gray400}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={mobileNumber}
                onChangeText={setMobileNumber}
                placeholder="e.g., 0241234567"
                placeholderTextColor={Colors.gray400}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonText}>Update Payment Account</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.gray100,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: Colors.disabled,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});