import React from 'react';
import {View, Text, StyleSheet, Switch} from 'react-native';
import {useSelector} from 'react-redux';
import {useState} from 'react';

interface HelloWorldProps {
  name?: string;
}

const HelloWorld: React.FC<HelloWorldProps> = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const accounts = useSelector(state => state.accounts.active);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Wallet</Text>
      <Switch
        ios_backgroundColor="#3e3e3e"
        onValueChange={setIsEnabled}
        value={isEnabled}
      />
      {accounts.map((account, index) => (
        <Text key={index} style={styles.subtitle}>
          {account.currency.name}: {account.balance.toNumber()}
        </Text>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    margin: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#558B2F',
    fontStyle: 'italic',
  },
});

export default HelloWorld;
