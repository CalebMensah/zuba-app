import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

const ContactUsScreen = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const contactEmail = 'zubamobileapp@gmail.com';
  const phoneNumber = '0598785053';
  const whatsappNumber = '233598785053'; // International format for WhatsApp

  const handleEmailPress = () => {
    Linking.openURL(`mailto:${contactEmail}`);
  };

  const handlePhonePress = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleWhatsAppPress = () => {
    const url = `whatsapp://send?phone=${whatsappNumber}`;
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert(
            'WhatsApp Not Installed',
            'Please install WhatsApp to use this feature',
            [{ text: 'OK' }]
          );
        }
      })
      .catch((err) => console.error('Error opening WhatsApp:', err));
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    // Compose email with form data
    const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;

    Linking.openURL(mailtoUrl)
      .then(() => {
        Alert.alert(
          'Success',
          'Your email client has been opened. Please send the email to complete your message.',
          [
            {
              text: 'OK',
              onPress: () => {
                setName('');
                setEmail('');
                setSubject('');
                setMessage('');
              },
            },
          ]
        );
      })
      .catch((err) => {
        Alert.alert('Error', 'Unable to open email client. Please try again.');
        console.error('Error opening email:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const renderContactMethod = (
    icon: string,
    title: string,
    value: string,
    description: string,
    onPress: () => void,
    color: string
  ) => (
    <TouchableOpacity style={styles.contactMethod} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.contactMethodIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={28} color={color} />
      </View>
      <View style={styles.contactMethodContent}>
        <Text style={styles.contactMethodTitle}>{title}</Text>
        <Text style={styles.contactMethodValue}>{value}</Text>
        <Text style={styles.contactMethodDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color={Colors.gray400} />
    </TouchableOpacity>
  );

  const renderQuickAction = (icon: string, label: string, onPress: () => void, color: string) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon as any} size={24} color={Colors.white} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const renderFAQItem = (question: string, answer: string) => (
    <View style={styles.faqItem}>
      <View style={styles.faqQuestion}>
        <Ionicons name="help-circle" size={20} color={Colors.primary} />
        <Text style={styles.faqQuestionText}>{question}</Text>
      </View>
      <Text style={styles.faqAnswer}>{answer}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIconContainer}>
            <Ionicons name="chatbubbles" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.headerTitle}>Get in Touch</Text>
          <Text style={styles.headerSubtitle}>
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Contact</Text>
          <View style={styles.quickActions}>
            {renderQuickAction('mail', 'Email', handleEmailPress, Colors.primary)}
            {renderQuickAction('call', 'Call', handlePhonePress, Colors.success)}
            {renderQuickAction('logo-whatsapp', 'WhatsApp', handleWhatsAppPress, '#25D366')}
          </View>
        </View>

        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Methods</Text>
          <View style={styles.contactMethods}>
            {renderContactMethod(
              'mail-outline',
              'Email',
              contactEmail,
              'Send us an email anytime',
              handleEmailPress,
              Colors.primary
            )}
            {renderContactMethod(
              'call-outline',
              'Phone',
              phoneNumber,
              'Call us during business hours',
              handlePhonePress,
              Colors.success
            )}
            {renderContactMethod(
              'logo-whatsapp',
              'WhatsApp',
              phoneNumber,
              'Chat with us instantly',
              handleWhatsAppPress,
              '#25D366'
            )}
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <View style={styles.businessHoursCard}>
            <View style={styles.businessHoursHeader}>
              <Ionicons name="time-outline" size={24} color={Colors.primary} />
              <Text style={styles.businessHoursTitle}>Business Hours</Text>
            </View>
            <View style={styles.businessHoursList}>
              <View style={styles.businessHoursItem}>
                <Text style={styles.businessHoursDay}>Monday - Friday</Text>
                <Text style={styles.businessHoursTime}>8:00 AM - 6:00 PM</Text>
              </View>
              <View style={styles.businessHoursItem}>
                <Text style={styles.businessHoursDay}>Saturday</Text>
                <Text style={styles.businessHoursTime}>9:00 AM - 4:00 PM</Text>
              </View>
              <View style={styles.businessHoursItem}>
                <Text style={styles.businessHoursDay}>Sunday</Text>
                <Text style={styles.businessHoursTime}>Closed</Text>
              </View>
            </View>
            <View style={styles.businessHoursNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
              <Text style={styles.businessHoursNoteText}>
                We respond to all inquiries within 24 hours
              </Text>
            </View>
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send us a Message</Text>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.gray400}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="your.email@example.com"
                placeholderTextColor={Colors.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="What is this about?"
                placeholderTextColor={Colors.gray400}
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us more about your inquiry..."
                placeholderTextColor={Colors.gray400}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <Text style={styles.submitButtonText}>Sending...</Text>
              ) : (
                <>
                  <Ionicons name="send" size={20} color={Colors.white} />
                  <Text style={styles.submitButtonText}>Send Message</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-buoy-outline" size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          </View>
          <View style={styles.faqContainer}>
            {renderFAQItem(
              'How long does it take to get a response?',
              'We typically respond to all inquiries within 24 hours during business days.'
            )}
            {renderFAQItem(
              'Can I visit your office?',
              'We currently operate online only. Please contact us via email, phone, or WhatsApp for assistance.'
            )}
            {renderFAQItem(
              'What are your support hours?',
              'Our support team is available Monday to Friday, 8 AM - 6 PM, and Saturday 9 AM - 4 PM (GMT).'
            )}
            {renderFAQItem(
              'How can I report a problem?',
              'You can report any issues through this contact form, email us directly, or use the in-app report feature.'
            )}
          </View>
        </View>

        {/* Alternative Support */}
        <View style={styles.alternativeSupport}>
          <Ionicons name="information-circle" size={24} color={Colors.info} />
          <View style={styles.alternativeSupportContent}>
            <Text style={styles.alternativeSupportTitle}>Looking for Help?</Text>
            <Text style={styles.alternativeSupportText}>
              Check out our Help Center for instant answers to common questions.
            </Text>
          </View>
        </View>
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
  content: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contactMethods: {
    gap: 12,
  },
  contactMethod: {
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
  contactMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  contactMethodContent: {
    flex: 1,
  },
  contactMethodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  contactMethodValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  contactMethodDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  businessHoursCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  businessHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  businessHoursTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  businessHoursList: {
    gap: 12,
    marginBottom: 16,
  },
  businessHoursItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  businessHoursDay: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  businessHoursTime: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  businessHoursNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 12,
  },
  businessHoursNoteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.info,
    fontWeight: '500',
  },
  form: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  faqContainer: {
    gap: 12,
  },
  faqItem: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  faqAnswer: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 28,
  },
  alternativeSupport: {
    flexDirection: 'row',
    backgroundColor: Colors.infoLight,
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  alternativeSupportContent: {
    flex: 1,
  },
  alternativeSupportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.info,
    marginBottom: 4,
  },
  alternativeSupportText: {
    fontSize: 13,
    color: Colors.info,
    lineHeight: 18,
  },
});

export default ContactUsScreen;