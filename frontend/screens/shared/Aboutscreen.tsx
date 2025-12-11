import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const AboutScreen = () => {
  const handleEmailPress = () => {
    Linking.openURL('mailto:support@zubaapp.com');
  };

  const handleWebsitePress = () => {
    Linking.openURL('https://www.zubaapp.com');
  };

  const handleSocialPress = (platform: string) => {
    const urls: { [key: string]: string } = {
      facebook: 'https://facebook.com/zubaapp',
      twitter: 'https://twitter.com/zubaapp',
      instagram: 'https://instagram.com/zubaapp',
      linkedin: 'https://linkedin.com/company/zubaapp',
    };
    
    if (urls[platform]) {
      Linking.openURL(urls[platform]);
    }
  };

  const renderFeatureItem = (icon: string, title: string, description: string) => (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon as any} size={24} color={Colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );

  const renderStatCard = (value: string, label: string, icon: string) => (
    <View style={styles.statCard}>
      <View style={styles.statIconContainer}>
        <Ionicons name={icon as any} size={28} color={Colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const renderContactItem = (icon: string, label: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.contactItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.contactIconContainer}>
        <Ionicons name={icon as any} size={20} color={Colors.primary} />
      </View>
      <View style={styles.contactContent}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
    </TouchableOpacity>
  );

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/zuba-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Zuba</Text>
        <Text style={styles.tagline}>Buy and sell with trust, all in one app</Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </View>

      {/* Stats Section */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Our Impact</Text>
        <View style={styles.statsGrid}>
          {renderStatCard('10K+', 'Active Users', 'people-outline')}
          {renderStatCard('5K+', 'Products', 'cube-outline')}
          {renderStatCard('2K+', 'Sellers', 'storefront-outline')}
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>About Zuba</Text>
        </View>
        <Text style={styles.bodyText}>
          Zuba is a trusted online marketplace that connects buyers and sellers across Ghana. 
          Whether you want to sell your items or find something new, Zuba makes it easy, fast, and safe.
        </Text>
        <Text style={styles.bodyText}>
          We leverage cutting-edge technology to provide a seamless buying and selling experience, 
          with features like secure payments, escrow protection, and real-time order tracking.
        </Text>
      </View>

      {/* Mission Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="rocket-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Our Mission</Text>
        </View>
        <View style={styles.missionCard}>
          <Text style={styles.missionText}>
            At Zuba, our mission is to simplify buying and selling, build trust between users, 
            and empower everyday sellers to reach more buyers without the hassle.
          </Text>
          <View style={styles.missionHighlight}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            <Text style={styles.missionHighlightText}>
              Building trust through transparency and security
            </Text>
          </View>
        </View>
      </View>

      {/* Features Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="star-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Key Features</Text>
        </View>
        <View style={styles.featuresContainer}>
          {renderFeatureItem(
            'storefront',
            'Create Your Store',
            'Set up your own store in minutes and start selling'
          )}
          {renderFeatureItem(
            'search',
            'Browse Products',
            'Discover products across multiple sellers with ease'
          )}
          {renderFeatureItem(
            'shield-checkmark',
            'Secure Payments',
            'Protected transactions with escrow system for peace of mind'
          )}
          {renderFeatureItem(
            'checkmark-done',
            'Verified Sellers',
            'Buy with confidence from verified and trusted sellers'
          )}
          {renderFeatureItem(
            'notifications',
            'Real-time Updates',
            'Stay informed with instant order and delivery updates'
          )}
          {renderFeatureItem(
            'chatbubbles',
            'Direct Messaging',
            'Chat directly with sellers and buyers for smooth communication'
          )}
        </View>
      </View>

      {/* Values Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="heart-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Our Values</Text>
        </View>
        <View style={styles.valuesContainer}>
          <View style={styles.valueItem}>
            <View style={[styles.valueDot, { backgroundColor: Colors.primary }]} />
            <Text style={styles.valueText}>Trust & Transparency</Text>
          </View>
          <View style={styles.valueItem}>
            <View style={[styles.valueDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.valueText}>Customer Satisfaction</Text>
          </View>
          <View style={styles.valueItem}>
            <View style={[styles.valueDot, { backgroundColor: Colors.info }]} />
            <Text style={styles.valueText}>Innovation & Excellence</Text>
          </View>
          <View style={styles.valueItem}>
            <View style={[styles.valueDot, { backgroundColor: Colors.accent }]} />
            <Text style={styles.valueText}>Community Empowerment</Text>
          </View>
        </View>
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="mail-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Contact Us</Text>
        </View>
        <View style={styles.contactContainer}>
          {renderContactItem(
            'mail',
            'Email Support',
            'support@zubaapp.com',
            handleEmailPress
          )}
          {renderContactItem(
            'globe',
            'Website',
            'www.zubaapp.com',
            handleWebsitePress
          )}
        </View>
      </View>

      {/* Social Media Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="share-social-outline" size={24} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Follow Us</Text>
        </View>
        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialPress('facebook')}
          >
            <Ionicons name="logo-facebook" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialPress('twitter')}
          >
            <Ionicons name="logo-twitter" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialPress('instagram')}
          >
            <Ionicons name="logo-instagram" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => handleSocialPress('linkedin')}
          >
            <Ionicons name="logo-linkedin" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Legal Section */}
      <View style={styles.legalSection}>
        <TouchableOpacity style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Terms of Service</Text>
        </TouchableOpacity>
        <Text style={styles.legalSeparator}>•</Text>
        <TouchableOpacity style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          © 2024 Zuba. All rights reserved.
        </Text>
        <Text style={styles.footerSubtext}>
          Made with ❤️ in Ghana
        </Text>
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
    paddingBottom: 40,
  },
  heroSection: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    width: 70,
    height: 70,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  versionBadge: {
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 12,
  },
  missionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  missionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  missionHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.backgroundSecondary,
    padding: 12,
    borderRadius: 12,
  },
  missionHighlightText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  featuresContainer: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  valuesContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    gap: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  valueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  valueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  valueText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contactContainer: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  legalSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 12,
  },
  legalLink: {
    padding: 4,
  },
  legalLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  legalSeparator: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
});

export default AboutScreen;