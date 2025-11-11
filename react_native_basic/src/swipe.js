// Импортируем нужные хуки и компоненты из React и React Native
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  ImageBackground
} from "react-native";

// Получаем ширину и высоту экрана устройства
const { width, height } = Dimensions.get("window");

// Массив карточек (для примера используем одинаковые изображения)
const cards = [
  { id: "01", image: require("../assets/robot_01.jpg") },
  { id: "02", image: require("../assets/robot_02.jpg") },
  { id: "03", image: require("../assets/robot_03.jpg") },
  { id: "04", image: require("../assets/robot_04.jpg") },
  { id: "05", image: require("../assets/robot_05.jpg") },
];

// Карта переходов при свайпе: для каждой карточки указано, куда перейти при свайпе влево/вправо
const swipeMap = {
  "01": { left: "03", right: "02" },
  "02": { left: "04", right: "05" },
  "03": { left: "04", right: "05" },
  "04": { left: "01", right: "02" },
  "05": { left: "02", right: "01" },
};

// Основной компонент экрана свайпа
export default function SwipeScreen() {

  // Состояние — индекс текущей отображаемой карточки
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animated.ValueXY — хранит координаты анимации по X и Y
  const position = useRef(new Animated.ValueXY()).current;

  // Создаем обработчик жестов PanResponder
  const panResponder = useRef(
    PanResponder.create({
      // Разрешаем реагировать на касания
      onStartShouldSetPanResponder: () => true,

      // Обновляем позицию карточки при движении пальца
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy }); // dx — смещение по X, dy — по Y
      },

      // Когда пользователь отпускает палец
      onPanResponderRelease: (_, gesture) => {
        // Если свайп вправо (dx > 100) — листаем вправо
        if (gesture.dx > 100) {
          swipe("right");
        }
        // Если свайп влево (dx < -100) — листаем влево
        else if (gesture.dx < -100) {
          swipe("left");
        }
        // Если свайп короткий — возвращаем карточку обратно в центр
        else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // Функция для обработки свайпа
  const swipe = (direction) => {
    // Получаем id текущей карточки
    const cardId = cards[currentIndex].id;

    // Определяем id следующей карточки в зависимости от направления
    const nextId = direction === "left" ? swipeMap[cardId].left : swipeMap[cardId].right;

    // Находим индекс карточки с нужным id
    const nextIndex = cards.findIndex((c) => c.id === nextId);

    // Анимируем уход текущей карточки за экран
    Animated.timing(position, {
      toValue: { x: direction === "left" ? -width : width, y: 0 }, // направление ухода
      duration: 200, // скорость анимации
      useNativeDriver: false,
    }).start(() => {
      // После завершения анимации сбрасываем позицию обратно в центр
      position.setValue({ x: 0, y: 0 });
      // Устанавливаем новую активную карточку
      setCurrentIndex(nextIndex >= 0 ? nextIndex : 0);
    });
  };

  // Рендеринг отдельной карточки
  const renderCard = (card, index) => {
    // Отображаем только текущую карточку
    if (index !== currentIndex) return null;

    // Интерполяция значения X в угол поворота (для эффекта наклона при свайпе)
    const rotate = position.x.interpolate({
      inputRange: [-width, 0, width], // диапазон смещения
      outputRange: ["-15deg", "0deg", "15deg"], // диапазон поворота
    });

    // Возвращаем Animated.View, чтобы анимации могли работать
    return (
      <Animated.View
        {...panResponder.panHandlers} // подключаем обработчик свайпа
        style={[
          styles.card, // базовый стиль
          { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] }, // применяем анимацию перемещения и поворота
        ]}
        key={card.id} // уникальный ключ
      >
        {/* Изображение карточки */}
        <Image source={card.image} style={styles.image} resizeMode="contain" />
        {/* Текст карточки (id) */}
        <Text style={styles.cardText}>{card.id}</Text>
      </Animated.View>
    );
  };

  // Основной рендер компонента
  return (
    <ImageBackground
      source={require('../assets/background.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        {/* Полупрозрачный оверлей для лучшей читаемости */}
        <View style={styles.overlay} />
        
        {/* Рендерим текущую карточку */}
        {cards.map((card, index) => renderCard(card, index))}

        {/* Нижняя панель с индикаторами карточек */}
        <View style={styles.bottomBar}>
          {cards.map((c, idx) => (
            <Text
              key={c.id}
              // Подсвечиваем активную карточку
              style={[styles.bottomText, idx === currentIndex ? styles.activeText : null]}
            >
              {c.id}
            </Text>
          ))}
        </View>

        {/* Инструкция для пользователя */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>
            Свайпните влево или вправо
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

// Стили для компонентов
const styles = StyleSheet.create({
  // Background стиль
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  
  // Основной контейнер экрана
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Полупрозрачный оверлей для улучшения читаемости поверх background
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Темный полупрозрачный оверлей
  },

  // Стиль карточки
  card: {
    position: "absolute", // чтобы карточки накладывались друг на друга
    width: width * 0.8, // 80% ширины экрана
    height: height * 0.6, // 60% высоты экрана
    borderRadius: 20, // скругленные углы
    backgroundColor: 'rgba(177, 177, 177, 0.95)', // полупрозрачный белый фон карточки
    justifyContent: "center",
    alignItems: "center",
    // Тень для iOS
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    // Тень для Android
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  // Изображение на карточке
  image: {
    width: "75%", // 75% ширины карточки
    height: "75%", // 75% высоты карточки
    borderRadius: 10,
  },

  // Текст (id карточки)
  cardText: {
    marginTop: 15,
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  // Нижняя панель с индикаторами
  bottomBar: {
    position: "absolute",
    bottom: 60, // отступ от низа экрана
    flexDirection: "row", // расположение элементов по горизонтали
    justifyContent: "space-around", // равномерно распределяем
    width: "80%", // ширина панели
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // полупрозрачный белый фон
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    // Тень для панели
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },

  // Стиль текста карточки в нижней панели
  bottomText: {
    fontSize: 18,
    color: "#666", // серый цвет
    fontWeight: "600",
  },

  // Стиль активной карточки в панели
  activeText: {
    color: "#FF69B4", // розовый цвет (согласовано с дизайном логина)
    fontWeight: "bold",
    fontSize: 22,
    textShadowColor: 'rgba(255, 105, 180, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  // Контейнер для инструкции
  instructionContainer: {
    position: "absolute",
    top: 80, // отступ от верха экрана
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    // Тень
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },

  // Текст инструкции
  instructionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
});