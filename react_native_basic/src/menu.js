import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Image, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
//import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const CropsScreen = () => {
  const navigation = useNavigation();
//  const [resetModalVisible, setResetModalVisible] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Login')} 
          style={{ marginLeft: 15 }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const crops = [
    { title: "Карта", source: require('../assets/map_icon.jpg'), navigateTo: 'Map' },
    { title: "Свайп", source: require('../assets/swipe_icon.jpg'), navigateTo: 'Swipe' },
    { title: "Дашборд", source: require('../assets/dashboard_icon.jpg'), navigateTo: 'Dashboard' },
  ];

  const renderCard = (crop, index) => (
    <TouchableOpacity 
      key={index} 
      style={[
        styles.card,
        crop.isDestructive && styles.destructiveCard
      ]} 
      onPress={crop.action || (() => navigation.navigate(crop.navigateTo))}
    >
      <View style={styles.imageContainer}>
        <Image source={crop.source} style={styles.image} />
        <View style={styles.overlay}>
          <Text style={styles.text}>{crop.title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
    source={require('../assets/background.jpg')}
    style={styles.background}
    resizeMode="stretch">
    <View style={styles.screenContainer}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.grid}>
          {crops.map((crop, index) => renderCard(crop, index))}
        </View>
       </ScrollView>
    </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenContainer: {
    flex: 1, 
    backgroundColor: 'rgba(206, 204, 204, 0.7)'
  },
  container: {
    flexGrow: 1,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  card: {
    width: '45%',
    marginBottom: 20,
    alignItems: 'center',
  },
  destructiveCard: {
    opacity: 0.8,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 150,
    height: 150,
    borderRadius: 10,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  text: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    paddingVertical: 5,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 5,
    textAlign: 'center',
  },
  // Стили для модального окна
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#555',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '40%',
  },
  cancelButton: {
    backgroundColor: '#f1f1f1',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  confirmButton: {
    backgroundColor: '#e74c3c',
  },
  buttonIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CropsScreen;