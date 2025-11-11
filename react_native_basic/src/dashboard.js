import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  ImageBackground,
  Alert,
  ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

// Базовый URL для API запросов
const API_BASE_URL = 'http://localhost:8000/api';

const DashboardScreen = () => {
  const navigation = useNavigation();
  
  // Состояния компонента
  const [data, setData] = useState(null); // Данные с сервера
  const [loading, setLoading] = useState(true); // Статус загрузки
  const [actionLoading, setActionLoading] = useState({ upload: false, analysis: false }); // Статусы выполнения скриптов

  // Настройка заголовка навигации
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Menu')} 
          style={{ marginLeft: 15 }}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Функция загрузки данных с сервера
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/dashboard/data`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Функция запуска скриптов (загрузка данных или анализ)
  const runScript = async (endpoint, actionName) => {
    try {
      setActionLoading(prev => ({ ...prev, [actionName]: true }));
      
      const response = await fetch(`${API_BASE_URL}/dashboard/${endpoint}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      Alert.alert('Успех', result.message);
      
      // Обновляем данные после выполнения скрипта
      setTimeout(() => {
        fetchDashboardData();
      }, 2000);
      
    } catch (error) {
      Alert.alert('Ошибка', `Не удалось выполнить ${actionName}`);
      console.error(error);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionName]: false }));
    }
  };

  // Рендер таблицы с прогнозами для каждой модели
  const renderForecastTable = (title, forecastData) => (
    <View style={styles.tableContainer} key={title}>
      <Text style={styles.tableTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderText}>Год</Text>
        <Text style={styles.tableHeaderText}>Прогноз</Text>
        <Text style={styles.tableHeaderText}>R²</Text>
      </View>
      {forecastData?.map((item, index) => (
        <View key={index} style={styles.tableRow}>
          <Text style={styles.tableCell}>{item.year}</Text>
          <Text style={styles.tableCell}>{item.crude_oil_forecast.toFixed(2)}</Text>
          <Text style={[
            styles.tableCell, 
            { color: item.r2 > 0 ? '#FF69B4' : '#E91E63' } // Розовые цвета для положительных/отрицательных значений
          ]}>
            {item.r2.toFixed(4)}
          </Text>
        </View>
      ))}
    </View>
  );

  // Рендер графика сравнения моделей
  const renderComparisonChart = () => {
    if (!data?.comparison_data) return null;

    const chartData = {
      labels: data.comparison_data.map(item => item.year.toString()),
      datasets: [
        {
          data: data.comparison_data.map(item => item.linear),
          color: () => '#FF69B4', // Основной розовый
          strokeWidth: 2,
        },
        {
          data: data.comparison_data.map(item => item.gradient_boosting),
          color: () => '#E91E63', // Темно-розовый
          strokeWidth: 2,
        },
        {
          data: data.comparison_data.map(item => item.neural_network),
          color: () => '#F8BBD0', // Светло-розовый
          strokeWidth: 2,
        },
        {
          data: data.comparison_data.map(item => item.random_forest),
          color: () => '#AD1457', // Бордовый
          strokeWidth: 2,
        },
      ],
      legend: ['Linear', 'Gradient Boosting', 'Neural Network', 'Random Forest']
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Сравнение прогнозов разных моделей</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  // Рендер графика исторических данных и прогнозов
  const renderForecastChart = () => {
    if (!data?.historical_data || !data?.comparison_data) return null;

    const historicalYears = data.historical_data.slice(-10).map(item => item.year);
    const historicalValues = data.historical_data.slice(-10).map(item => item.crude_oil);
    const forecastYears = data.comparison_data.map(item => item.year);
    const forecastValues = data.comparison_data.map(item => item.linear);

    const chartData = {
      labels: [...historicalYears, ...forecastYears],
      datasets: [
        {
          data: [...historicalValues, ...forecastValues],
          color: () => '#FF69B4', // Основной розовый цвет
          strokeWidth: 2,
        },
      ],
    };

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Прогноз Crude Oil 2024-2028</Text>
        <LineChart
          data={chartData}
          width={Dimensions.get('window').width - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
      </View>
    );
  };

  // Конфигурация графиков
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(255, 105, 180, ${opacity})`, // Розовый градиент
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`, // Черный для текста
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#FF69B4' // Розовые точки
    }
  };

  // Экран загрузки
  if (loading) {
    return (
      <ImageBackground
        source={require('../assets/background.jpg')}
        style={styles.background}
        resizeMode="stretch"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF69B4" /> {/* Розовый индикатор */}
          <Text style={styles.loadingText}>Загрузка данных...</Text>
        </View>
      </ImageBackground>
    );
  }

  // Основной рендер компонента
  return (
    <ImageBackground
      source={require('../assets/background.jpg')}
      style={styles.background}
      resizeMode="stretch"
    >
      <View style={styles.screenContainer}>
        <ScrollView contentContainerStyle={styles.container}>
          
          {/* Контейнер кнопок действий */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity 
              style={[styles.actionButton, actionLoading.upload && styles.buttonDisabled]}
              onPress={() => runScript('upload-data', 'upload')}
              disabled={actionLoading.upload}
            >
              {actionLoading.upload ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="cloud-upload" size={20} color="white" />
              )}
              <Text style={styles.actionButtonText}>
                {actionLoading.upload ? 'Выгрузка...' : 'Выгрузить данные в PostgreSQL'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, actionLoading.analysis && styles.buttonDisabled]}
              onPress={() => runScript('run-analysis', 'analysis')}
              disabled={actionLoading.analysis}
            >
              {actionLoading.analysis ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="analytics" size={20} color="white" />
              )}
              <Text style={styles.actionButtonText}>
                {actionLoading.analysis ? 'Анализ...' : 'Выполнить анализ (ИИ)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Графики сравнения и прогнозов */}
          {renderComparisonChart()}
          {renderForecastChart()}

          {/* Контейнер таблиц с прогнозами */}
          <View style={styles.tablesContainer}>
            {data?.improved_linear && renderForecastTable('Linear Regression', data.improved_linear)}
            {data?.gradient_boosting && renderForecastTable('Gradient Boosting', data.gradient_boosting)}
            {data?.improved_nn && renderForecastTable('Neural Network', data.improved_nn)}
            {data?.improved_rf && renderForecastTable('Random Forest', data.improved_rf)}
          </View>

        </ScrollView>
      </View>
    </ImageBackground>
  );
};

// Стили компонента
const styles = StyleSheet.create({
  // Фоновое изображение
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // Основной контейнер с полупрозрачным серым фоном
  screenContainer: {
    flex: 1, 
    backgroundColor: 'rgba(128, 128, 128, 0.7)' // Серый полупрозрачный
  },
  // Контейнер контента с отступами
  container: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 10,
  },
  // Контейнер загрузки
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Текст загрузки
  loadingText: {
    color: 'white', // Белый текст
    marginTop: 10,
    fontSize: 16,
  },
  // Контейнер кнопок действий
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  // Кнопка действия
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF69B4', // Основной розовый
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    flex: 0.45,
    justifyContent: 'center',
  },
  // Отключенная кнопка
  buttonDisabled: {
    backgroundColor: '#9E9E9E', // Серый для отключенного состояния
  },
  // Текст кнопки действия
  actionButtonText: {
    color: 'white', // Белый текст
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 12,
    textAlign: 'center',
  },
  // Контейнер графика
  chartContainer: {
    backgroundColor: 'rgba(177, 177, 177, 0.95)', // Белый фон
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000', // Черная тень
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Заголовок графика
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: 'white', // Темно-серый текст
  },
  // Стиль графика
  chart: {
    borderRadius: 10,
  },
  // Контейнер таблиц
  tablesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  // Контейнер отдельной таблицы
  tableContainer: {
    backgroundColor: 'rgba(177, 177, 177, 0.95)', // Белый фон
    borderRadius: 10,
    padding: 10,
    marginBottom: 15,
    width: '48%',
    elevation: 2,
    shadowColor: '#000', // Черная тень
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  // Заголовок таблицы
  tableTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: 'white', // Темно-серый текст
  },
  // Шапка таблицы
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#BDBDBD', // Серый разделитель
    paddingBottom: 5,
    marginBottom: 5,
  },
  // Текст в шапке таблицы
  tableHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 10,
    textAlign: 'center',
    color: '#424242', // Серый текст
  },
  // Строка таблицы
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE', // Светло-серый разделитель
  },
  // Ячейка таблицы
  tableCell: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
    color: '#212121', // Темно-серый текст
  },
});

export default DashboardScreen;