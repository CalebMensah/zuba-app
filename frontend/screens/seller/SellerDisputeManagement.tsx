import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SellerDisputeManagement: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Seller Dispute Management Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default SellerDisputeManagement;
