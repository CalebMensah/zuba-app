// screens/legal/TermsConditionsScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';

type TermsScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Terms'>;

interface Props {
  navigation: TermsScreenNavigationProp;
}

const TermsConditionsScreen: React.FC<Props> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.lastUpdated}>Last Updated: November 16, 2025</Text>
          <Text style={styles.intro}>
            Welcome to ZUBA! By creating an account and using our platform, you agree to these Terms and Conditions. Please read them carefully.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. About ZUBA</Text>
          <Text style={styles.text}>
            ZUBA is a social commerce platform connecting buyers and sellers in Ghana. We provide:
          </Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              A marketplace for sellers to create stores and list products
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              A platform for buyers to discover and purchase products
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              An escrow system to protect both parties during transactions
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Tools for order management, payments, and delivery tracking
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Account Requirements</Text>
          
          <Text style={styles.subsectionTitle}>General Requirements</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>You must be at least 18 years old to use ZUBA</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>You must provide accurate and complete information</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>You are responsible for maintaining your account security</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>One person cannot create multiple accounts</Text>
          </View>

          <Text style={styles.subsectionTitle}>Seller Verification</Text>
          <Text style={styles.text}>
            To create and operate a store, sellers must:
          </Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Submit a Ghana Card (front and back) for identity verification
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Provide business registration documents (if applicable)
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Upload a clear selfie for identity confirmation
            </Text>
          </View>
          <View style={styles.highlightBox}>
            <Text style={styles.highlightText}>
              ⚠️ Submitting false or fraudulent documents will result in immediate account suspension and may lead to legal action.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Buyer Responsibilities</Text>
          <Text style={styles.text}>As a buyer, you agree to:</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Provide accurate delivery information
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Pay for orders in full at the time of purchase
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Confirm receipt of items within 4 days of delivery
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Report any issues with orders immediately
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Not misuse the dispute or refund system
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Seller Responsibilities</Text>
          <Text style={styles.text}>As a seller, you agree to:</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              List only products you legally own or have rights to sell
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Provide accurate product descriptions and images
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Honor the prices and terms listed for your products
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Ship orders within the stated timeframe
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Respond to buyer inquiries within 24 hours
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Not sell counterfeit, illegal, or prohibited items
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Escrow System</Text>
          <Text style={styles.text}>
            Our escrow system protects both buyers and sellers:
          </Text>
          
          <Text style={styles.subsectionTitle}>How It Works</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>1.</Text>
            <Text style={styles.bulletText}>
              When a buyer places an order, payment is held in escrow
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>2.</Text>
            <Text style={styles.bulletText}>
              The seller ships the order and updates the tracking information
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>3.</Text>
            <Text style={styles.bulletText}>
              The buyer receives the order and has 4 days to confirm
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>4.</Text>
            <Text style={styles.bulletText}>
              Funds are released to the seller after confirmation or automatically after 4 days
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Dispute Resolution</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              If there's an issue, buyers can open a dispute within the 4-day window
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA will review the case and make a fair decision
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Funds will be released to the appropriate party based on the resolution
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Payments & Fees</Text>
          
          <Text style={styles.subsectionTitle}>Payment Processing</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              All payments are processed through secure, certified payment gateways
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA does not store your complete payment card details
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              All transactions are encrypted and secure
            </Text>
          </View>

          <Text style={styles.subsectionTitle}>Seller Fees</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA charges a commission on each successful sale
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Payment processing fees apply to all transactions
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Fees are automatically deducted before funds are released
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Prohibited Activities</Text>
          <Text style={styles.text}>You may not:</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Sell counterfeit, illegal, or stolen items
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Manipulate prices or engage in price fixing
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Create fake reviews or ratings
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Attempt to bypass ZUBA's payment system
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Harass, threaten, or abuse other users
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Use bots or automated systems to manipulate the platform
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Account Suspension & Termination</Text>
          <Text style={styles.text}>
            ZUBA reserves the right to suspend or terminate accounts that:
          </Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Violate these Terms and Conditions</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Engage in fraudulent activities</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Repeatedly receive complaints from other users</Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>Fail to meet seller performance standards</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Intellectual Property</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA and its logo are trademarks owned by ZUBA
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              You retain ownership of content you upload (product images, descriptions)
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              By uploading content, you grant ZUBA a license to display it on the platform
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              You must not infringe on others' intellectual property rights
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA is a platform connecting buyers and sellers; we are not party to transactions
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              Sellers are responsible for product quality and fulfillment
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              ZUBA is not liable for disputes between buyers and sellers
            </Text>
          </View>
          <View style={styles.bulletPoint}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.bulletText}>
              We do not guarantee uninterrupted or error-free service
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Changes to Terms</Text>
          <Text style={styles.text}>
            We may update these Terms and Conditions from time to time. Significant changes will be communicated via email or in-app notification. Continued use of ZUBA after changes constitutes acceptance of the new terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Governing Law</Text>
          <Text style={styles.text}>
            These Terms and Conditions are governed by the laws of Ghana. Any disputes will be resolved in the courts of Ghana.
          </Text>
        </View>

        <View style={[styles.section, styles.contactSection]}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.text}>
            If you have questions about these Terms and Conditions, please contact us:
          </Text>
          <View style={styles.contactBox}>
            <Text style={styles.contactText}>📧 Email: support@zuba.com</Text>
            <Text style={styles.contactText}>📱 Phone: +233 XX XXX XXXX</Text>
            <Text style={styles.contactText}>📍 Address: Accra, Ghana</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using ZUBA, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

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
    backgroundColor: Colors.white,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
    marginBottom: 8,
  },
  lastUpdated: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    color: Colors.primary,
    marginRight: 8,
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  highlightBox: {
    backgroundColor: Colors.warningLight,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  highlightText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
    fontWeight: '500',
  },
  contactSection: {
    marginBottom: 32,
  },
  contactBox: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactText: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 8,
    lineHeight: 22,
  },
  footer: {
    backgroundColor: Colors.backgroundTertiary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TermsConditionsScreen;