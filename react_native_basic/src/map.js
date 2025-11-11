// Импортируем нужные хуки и компоненты из React и React Native
import React, { useState, useEffect, useRef } from "react";
import { Platform, View, Text, TouchableOpacity, StyleSheet } from "react-native";

// Основной компонент экрана с универсальной картой
export default function UniversalMapScreen() {

  // Состояние — готова ли карта к использованию
  const [mapReady, setMapReady] = useState(false);

  // Состояние — текущее местоположение пользователя (latitude, longitude)
  const [location, setLocation] = useState(null);

  // Состояние — текст ошибки, если возникнет при загрузке карты или геолокации
  const [error, setError] = useState(null);

  // Состояние — хранит компонент карты (для нативных платформ)
  const [MapComponent, setMapComponent] = useState(null);

  // Ссылка на саму карту (используется для управления ею напрямую)
  const mapRef = useRef(null);

  // useEffect срабатывает один раз при монтировании компонента
  useEffect(() => {
    // Проверяем платформу
    if (Platform.OS === 'web') {
      // Если это web, инициализируем Leaflet карту
      initWebMap();
      // Помечаем, что используется web-карта
      setMapComponent('web');
      // Помечаем, что карта готова
      setMapReady(true);
    } else {
      // Если не web — подгружаем react-native-maps динамически
      loadNativeMaps();
    }
  }, []);

  // Функция динамической загрузки react-native-maps
  const loadNativeMaps = async () => {
    try {
      // Импортируем библиотеку только на мобильных платформах
      const ReactNativeMaps = await import('react-native-maps');
      
      // Определяем компонент карты для iOS/Android
      const NativeMap = ({ region, onMapReady, children }) => (
        <ReactNativeMaps.default
          ref={mapRef} // сохраняем ссылку на карту
          style={styles.nativeMap} // задаем стили
          region={region} // передаем координаты
          onMapReady={onMapReady} // колбэк при готовности
          showsUserLocation={true} // показываем местоположение пользователя
        >
          {children}
        </ReactNativeMaps.default>
      );

      // Сохраняем компонент и маркер в состояние
      setMapComponent({
        Map: NativeMap,
        Marker: ReactNativeMaps.Marker
      });

      // Помечаем, что карта готова
      setMapReady(true);
    } catch (error) {
      // Если не удалось импортировать — выводим ошибку
      console.log('react-native-maps not available:', error);
      setError('Карта недоступна на этом устройстве');
    }
  };

  // Функция инициализации карты на Web
  const initWebMap = () => {
    // Проверяем, загружен ли уже Leaflet
    if (window.L && document.getElementById('map-container')) {
      // Если да — создаем карту
      createWebMap();
      return;
    }
    // Иначе подгружаем Leaflet с CDN
    loadLeaflet();
  };

  // Загрузка скрипта и стилей Leaflet
  const loadLeaflet = () => {
    // Если уже есть Leaflet в window — просто создаем карту
    if (window.L) {
      createWebMap();
      return;
    }

    // Создаем тег <script> для подгрузки Leaflet.js
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      // Когда скрипт загрузится — создаем карту
      setTimeout(createWebMap, 100);
    };
    script.onerror = () => setError('Не удалось загрузить карту');
    document.head.appendChild(script);

    // Создаем тег <link> для подключения CSS Leaflet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  };

  // Создание и отображение карты Leaflet
  const createWebMap = () => {
    const mapContainer = document.getElementById('map-container'); // div для карты
    if (!mapContainer || !window.L) {
      // Если карта еще не готова — подождем
      setTimeout(createWebMap, 100);
      return;
    }

    try {
      // Если старая карта уже есть — удаляем
      if (window.leafletMap) window.leafletMap.remove();

      // Создаем новую карту с координатами Пензы
      const map = window.L.map('map-container').setView([53.1959, 45.0183], 13);
      
      // Добавляем слой с тайлами OpenStreetMap
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Сохраняем ссылку на карту
      window.leafletMap = map;
      mapRef.current = map;

      // Помечаем, что карта готова
      setMapReady(true);
      setError(null);
    } catch (err) {
      console.error('Leaflet init error:', err);
      setError('Ошибка инициализации карты');
    }
  };

  // Обработчик кнопки "Найти меня"
  const handleFindMe = async () => {
    if (Platform.OS === "web") {
      // Если web — используем HTML5 Geolocation API
      findWebLocation();
    } else {
      // Если iOS/Android — используем expo-location
      await findMobileLocation();
    }
  };

  // Геолокация для web
  const findWebLocation = () => {
    // Проверяем поддержку API
    if (!navigator.geolocation) {
      alert("Геолокация не поддерживается браузером");
      return;
    }

    // Получаем текущее местоположение
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        centerWebMap(latitude, longitude); // центрируем карту
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Не удалось получить местоположение');
      }
    );
  };

  // Центрирование карты Leaflet на web
  const centerWebMap = (lat, lng) => {
    if (!window.leafletMap) return;

    // Перемещаем центр карты
    window.leafletMap.setView([lat, lng], 15);
    
    // Если маркер уже был — удаляем
    if (window.currentMarker) {
      window.leafletMap.removeLayer(window.currentMarker);
    }
    
    // Добавляем новый маркер на текущие координаты
    window.currentMarker = window.L.marker([lat, lng])
      .addTo(window.leafletMap)
      .bindPopup(`
        <div style="text-align: center;">
          <strong>Вы здесь!</strong><br>
          Широта: ${lat.toFixed(6)}<br>
          Долгота: ${lng.toFixed(6)}
        </div>
      `)
      .openPopup();
  };

  // Геолокация для мобильных устройств (через expo-location)
  const findMobileLocation = async () => {
    try {
      // Импортируем функции из expo-location
      const { requestForegroundPermissionsAsync, getCurrentPositionAsync } = await import('expo-location');
      
      // Запрашиваем разрешение
      const { status } = await requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Разрешение на доступ к геолокации отклонено");
        return;
      }

      // Получаем координаты
      const loc = await getCurrentPositionAsync({});
      const newLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(newLocation);
      setError(null);

      // Центрируем карту на полученных координатах
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...newLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }, 1000);
      }
    } catch (err) {
      console.error("Location error:", err);
      setError('Ошибка получения местоположения');
    }
  };

  // Рендер карты для iOS/Android
  const renderNativeMap = () => {
    if (!MapComponent || !MapComponent.Map) return null;

    // Определяем регион карты
    const region = location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : {
          latitude: 53.1959,
          longitude: 45.0183,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

    // Возвращаем компонент карты
    return (
      <MapComponent.Map 
        region={region}
        onMapReady={() => setMapReady(true)}
      >
        {/* Если есть координаты — показываем маркер */}
        {location && MapComponent.Marker && (
          <MapComponent.Marker 
            coordinate={location} 
            title="Вы здесь 📍"
          />
        )}
      </MapComponent.Map>
    );
  };

  // Рендер карты для Web
  const renderWebMap = () => (
    <View style={styles.mapContainer}>
      {/* Контейнер для Leaflet-карты */}
      <div 
        id="map-container" 
        style={styles.webMap}
      />
      
      {/* Плашка загрузки, пока карта не готова */}
      {!mapReady && !error && (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Загрузка карты...</Text>
        </View>
      )}
    </View>
  );

  // Основной рендер всего компонента
  return (
    <View style={styles.container}>
      {/* Отображаем нужную карту в зависимости от платформы */}
      {Platform.OS === 'web' ? renderWebMap() : renderNativeMap()}

      {/* Кнопка "Найти меня" */}
      <TouchableOpacity 
        style={[
          styles.button, 
          !mapReady && styles.buttonDisabled // дизейблим, если карта не готова
        ]} 
        onPress={handleFindMe}
        disabled={!mapReady}
      >
        <Text style={styles.buttonText}>Найти меня</Text>
      </TouchableOpacity>

      {/* Если есть ошибка — показываем сообщение */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {/* На web добавляем кнопку "Повторить" */}
          {Platform.OS === 'web' && (
            <TouchableOpacity 
              style={[styles.button, styles.retryButton]} 
              onPress={initWebMap}
            >
              <Text style={styles.buttonText}>Повторить</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Отображаем сообщение о загрузке на мобильных устройствах */}
      {!mapReady && Platform.OS !== 'web' && !error && (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Загрузка карты...</Text>
        </View>
      )}
    </View>
  );
}

// Стили для всех элементов
const styles = StyleSheet.create({
  container: { 
    flex: 1,
    position: 'relative',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webMap: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#f0f0f0'
  },
  nativeMap: { 
    flex: 1 
  },
  center: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 1000
  },
  button: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "#007AFF",
    paddingHorizontal: 25,
    paddingVertical: 14,
    borderRadius: 25,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }
    })
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "bold",
    fontSize: 16
  },
  mapControls: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 1000
  },
  controlInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc'
  },
  controlText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center'
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center'
  },
  errorContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF3B30',
    zIndex: 1000,
    alignItems: 'center'
  },
  retryButton: {
    marginTop: 10,
    backgroundColor: "#FF3B30",
  }
});
