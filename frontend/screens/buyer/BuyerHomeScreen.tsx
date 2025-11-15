import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';

const BuyerHomeScreen: React.FC = () => {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, {user?.firstName}!</Text>
      <Text style={styles.subtitle}>Buyer Dashboard</Text>
      <View style={styles.pointsContainer}>
        <Text style={styles.pointsLabel}>Your Points:</Text>
        <Text style={styles.pointsValue}>{user?.points || 0}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  pointsContainer: {
    backgroundColor: '#f0f0f0',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
  },
});

export default BuyerHomeScreen;