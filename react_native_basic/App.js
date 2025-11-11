import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from './src/login';
import Menu from './src/menu';
import Map from './src/map';
import Swipe from './src/swipe';
import Dashboard from './src/dashboard';

const Stack = createNativeStackNavigator();

console.log('Web app is loading');

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login" 
        screenOptions={{
          headerStyle: {
            backgroundColor: '#FF69B4', // Ярко розовый фон заголовка
            height: 70, // Уменьшенная высота заголовка
          },
          headerTintColor: '#FFFFFF', // Белый цвет текста заголовка
          headerTitleStyle: {
            fontSize: 18, // Уменьшенный размер текста заголовка
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ title: 'Добро пожаловать!' }}
        />
        <Stack.Screen
          name="Menu"
          component={Menu}
          options={{ title: 'Меню' }}
        />
        <Stack.Screen
          name="Map"
          component={Map}
          options={{ title: 'Карта' }}
        />
        <Stack.Screen
          name="Swipe"
          component={Swipe}
          options={{ title: 'Свайп' }}
        />
        <Stack.Screen
          name="Dashboard"
          component={Dashboard}
          options={{ title: 'Дашбоард' }}
        />
      </Stack.Navigator>
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}