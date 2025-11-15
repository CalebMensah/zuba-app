import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AdminUsersScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={64} color="#ccc" />
        <Text style={styles.emptyText}>No users to display</Text>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

export default AdminUsersScreen;