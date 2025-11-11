import pandas as pd
import numpy as np
import psycopg2
from sqlalchemy import create_engine
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, LSTM, Dropout, BatchNormalization
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import warnings
warnings.filterwarnings('ignore')

# Базовые функции из предыдущего скрипта
def connect_to_db():
    """Подключение к PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host='localhost',
            database='postgres',
            user='postgres',
            password='postgres',
            port=5432
        )
        print("Успешное подключение к базе данных")
        return conn
    except Exception as e:
        print(f"Ошибка подключения: {e}")
        return None

def load_data():
    """Загрузка данных из базы"""
    conn = connect_to_db()
    if conn:
        query = "SELECT * FROM full_steak_dataset ORDER BY year"
        df = pd.read_sql(query, conn)
        conn.close()
        print(f"Загружено {len(df)} строк данных")
        return df
    else:
        raise Exception("Не удалось подключиться к базе данных")

def handle_missing_values(df):
    """Обработка пропущенных значений"""
    print("\n=== ОБРАБОТКА ПРОПУЩЕННЫХ ЗНАЧЕНИЙ ===")
    
    # Создаем копию DataFrame
    df_clean = df.copy()
    
    # Список числовых столбцов для обработки
    numeric_columns = ['crude_oil', 'natural_gas', 'soybeans', 'sunflower', 'wheat', 
                      'phosphate_rock', 'dap', 'tsp', 'urea', 'potassium_chloride', 'population']
    
    for column in numeric_columns:
        if column in df_clean.columns:
            missing_count = df_clean[column].isnull().sum()
            if missing_count > 0:
                print(f"Столбец {column}: {missing_count} пропущенных значений")
                
                # Заполняем пропуски интерполяцией
                df_clean[column] = df_clean[column].interpolate(method='linear')
                
                # Если остались пропуски (в начале/конце), заполняем соседними значениями
                df_clean[column] = df_clean[column].fillna(method='bfill').fillna(method='ffill')
                
                print(f"  Заполнено {missing_count} пропусков")
    
    print("Обработка пропущенных значений завершена")
    return df_clean

def save_forecasts_to_db(forecasts, future_years, metrics):
    """Сохранение прогнозов в базу данных"""
    print("\n=== СОХРАНЕНИЕ В БАЗУ ДАННЫХ ===")
    
    try:
        engine = create_engine('postgresql://postgres:postgres@localhost:5432/postgres')
        
        for model_name, values in forecasts.items():
            # Создание DataFrame с прогнозами
            forecast_df = pd.DataFrame({
                'year': future_years,
                'crude_oil_forecast': values,
                'model_name': model_name,
                'mae': metrics[model_name]['MAE'],
                'rmse': metrics[model_name]['RMSE'],
                'r2': metrics[model_name]['R2']
            })
            
            # Имя таблицы
            table_name = f"{model_name.lower()}_crude_oil_forecast"
            
            # Сохранение в базу
            forecast_df.to_sql(table_name, engine, if_exists='replace', index=False)
            print(f"Сохранено в таблицу: {table_name}")
            
    except Exception as e:
        print(f"Ошибка при сохранении в базу: {e}")

# Улучшенные функции
def create_time_features(df):
    """Создание временных признаков"""
    df_temp = df.copy()
    
    # Лаговые признаки (значения за предыдущие годы)
    for lag in [1, 2, 3]:
        df_temp[f'crude_oil_lag_{lag}'] = df_temp['crude_oil'].shift(lag)
        df_temp[f'population_lag_{lag}'] = df_temp['population'].shift(lag)
    
    # Скользящие средние
    for window in [3, 5]:
        df_temp[f'crude_oil_ma_{window}'] = df_temp['crude_oil'].rolling(window=window).mean()
        df_temp[f'soybeans_ma_{window}'] = df_temp['soybeans'].rolling(window=window).mean()
    
    # Темпы роста
    df_temp['crude_oil_growth'] = df_temp['crude_oil'].pct_change()
    df_temp['population_growth'] = df_temp['population'].pct_change()
    
    # Заполняем пропуски, образовавшиеся при создании признаков
    df_temp = df_temp.fillna(method='bfill').fillna(method='ffill')
    
    return df_temp

def analyze_trends(df):
    """Анализ трендов и сезонности"""
    print("Анализ трендов...")
    
    try:
        from statsmodels.tsa.stattools import adfuller
        
        result = adfuller(df['crude_oil'].dropna())
        print(f"Тест на стационарность crude_oil: p-value = {result[1]:.4f}")
        if result[1] > 0.05:
            print("  Ряд нестационарен, учитываем тренд")
    except ImportError:
        print("  statsmodels не установлен, пропускаем тест на стационарность")
    
    # Визуализация тренда
    plt.figure(figsize=(12, 6))
    plt.plot(df['year'], df['crude_oil'], label='Crude Oil')
    
    # Линейный тренд
    z = np.polyfit(df['year'], df['crude_oil'], 1)
    p = np.poly1d(z)
    plt.plot(df['year'], p(df['year']), "r--", alpha=0.7, label='Линейный тренд')
    
    plt.title('Тренд crude_oil с течением времени')
    plt.xlabel('Год')
    plt.ylabel('Crude Oil')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.savefig('trend_analysis.png')
    plt.close()
    print("График тренда сохранен в trend_analysis.png")

def improved_feature_selection(df):
    """Улучшенный отбор признаков"""
    # Все возможные признаки (исключаем целевую переменную и год)
    all_features = [col for col in df.columns if col not in ['year', 'crude_oil']]
    
    # Удаляем признаки с высокой корреляцией между собой
    correlation_matrix = df[all_features].corr()
    
    # Находим пары с корреляцией > 0.95
    high_corr_pairs = []
    for i in range(len(correlation_matrix.columns)):
        for j in range(i+1, len(correlation_matrix.columns)):
            if abs(correlation_matrix.iloc[i, j]) > 0.95:
                high_corr_pairs.append((
                    correlation_matrix.columns[i], 
                    correlation_matrix.columns[j],
                    correlation_matrix.iloc[i, j]
                ))
    
    if high_corr_pairs:
        print("Высококоррелированные пары (>0.95):")
        for pair in high_corr_pairs:
            print(f"  {pair[0]} - {pair[1]}: {pair[2]:.3f}")
    
    # Отбираем признаки с лучшей корреляцией с целевой переменной
    correlations_with_target = df[all_features].corrwith(df['crude_oil']).abs().sort_values(ascending=False)
    
    # Берем топ-8 признаков
    selected_features = correlations_with_target.head(8).index.tolist()
    
    # Добавляем временные признаки, если они есть
    time_features = [col for col in df.columns if any(x in col for x in ['lag', 'ma', 'growth'])]
    selected_features.extend(time_features[:2])  # Добавляем 2 лучших временных признака
    
    return selected_features

def prepare_improved_data(df, features_to_use):
    """Улучшенная подготовка данных"""
    # Убедимся, что все признаки существуют
    available_features = [f for f in features_to_use if f in df.columns]
    X = df[available_features]
    y = df['crude_oil']
    
    # Используем RobustScaler для устойчивости к выбросам
    scaler_X = RobustScaler()
    scaler_y = RobustScaler()
    
    X_scaled = scaler_X.fit_transform(X)
    y_scaled = scaler_y.fit_transform(y.values.reshape(-1, 1)).flatten()
    
    # Для временных рядов используем последовательное разделение
    split_idx = int(0.8 * len(X))
    
    X_train = X_scaled[:split_idx]
    X_test = X_scaled[split_idx:]
    y_train = y_scaled[:split_idx]
    y_test = y_scaled[split_idx:]
    
    print(f"Размер train: {len(X_train)}, test: {len(X_test)}")
    
    return X_train, X_test, y_train, y_test, scaler_X, scaler_y

def create_improved_linear_model(X_train, X_test, y_train, y_test, scaler_y):
    """Улучшенные линейные модели"""
    # Тестируем разные регуляризации
    models = {
        'Ridge': Ridge(alpha=1.0),
        'Lasso': Lasso(alpha=0.1),
        'Linear': LinearRegression()
    }
    
    best_model = None
    best_r2 = -np.inf
    best_pred = None
    
    for name, model in models.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        
        # Обратное масштабирование
        y_test_original = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
        y_pred_original = scaler_y.inverse_transform(y_pred.reshape(-1, 1)).flatten()
        
        r2 = r2_score(y_test_original, y_pred_original)
        
        if r2 > best_r2:
            best_r2 = r2
            best_model = model
            best_pred = y_pred_original
    
    # Метрики для лучшей модели
    y_test_original = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
    mae = mean_absolute_error(y_test_original, best_pred)
    rmse = np.sqrt(mean_squared_error(y_test_original, best_pred))
    r2 = best_r2
    
    print(f"Лучшая линейная модель: R2 = {r2:.4f}")
    print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}")
    
    return best_model, best_pred, {'MAE': mae, 'RMSE': rmse, 'R2': r2}

def create_improved_random_forest(X_train, X_test, y_train, y_test, scaler_y):
    """Улучшенный случайный лес"""
    # Используем оптимизированные параметры
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Обратное масштабирование
    y_test_original = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
    y_pred_original = scaler_y.inverse_transform(y_pred.reshape(-1, 1)).flatten()
    
    mae = mean_absolute_error(y_test_original, y_pred_original)
    rmse = np.sqrt(mean_squared_error(y_test_original, y_pred_original))
    r2 = r2_score(y_test_original, y_pred_original)
    
    print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}, R2: {r2:.4f}")
    
    return model, y_pred_original, {'MAE': mae, 'RMSE': rmse, 'R2': r2}

def create_gradient_boosting(X_train, X_test, y_train, y_test, scaler_y):
    """Градиентный бустинг"""
    model = GradientBoostingRegressor(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=4,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    # Обратное масштабирование
    y_test_original = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
    y_pred_original = scaler_y.inverse_transform(y_pred.reshape(-1, 1)).flatten()
    
    mae = mean_absolute_error(y_test_original, y_pred_original)
    rmse = np.sqrt(mean_squared_error(y_test_original, y_pred_original))
    r2 = r2_score(y_test_original, y_pred_original)
    
    print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}, R2: {r2:.4f}")
    
    return model, y_pred_original, {'MAE': mae, 'RMSE': rmse, 'R2': r2}

def create_improved_neural_network(X_train, X_test, y_train, y_test, scaler_y):
    """Улучшенная нейронная сеть"""
    # Упрощаем архитектуру для небольших данных
    model = Sequential([
        Dense(32, activation='relu', input_shape=(X_train.shape[1],)),
        BatchNormalization(),
        Dropout(0.3),
        Dense(16, activation='relu'),
        BatchNormalization(),
        Dropout(0.2),
        Dense(8, activation='relu'),
        Dense(1)
    ])
    
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='mse',
        metrics=['mae']
    )
    
    # Колбэки для предотвращения переобучения
    callbacks = [
        EarlyStopping(patience=20, restore_best_weights=True),
        ReduceLROnPlateau(factor=0.5, patience=10)
    ]
    
    # Обучение с validation split
    history = model.fit(
        X_train, y_train,
        epochs=200,
        batch_size=8,
        validation_split=0.2,
        callbacks=callbacks,
        verbose=0
    )
    
    # Предсказания
    y_pred = model.predict(X_test, verbose=0).flatten()
    
    # Обратное масштабирование
    y_test_original = scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
    y_pred_original = scaler_y.inverse_transform(y_pred.reshape(-1, 1)).flatten()
    
    mae = mean_absolute_error(y_test_original, y_pred_original)
    rmse = np.sqrt(mean_squared_error(y_test_original, y_pred_original))
    r2 = r2_score(y_test_original, y_pred_original)
    
    print(f"MAE: {mae:.2f}, RMSE: {rmse:.2f}, R2: {r2:.4f}")
    
    return model, y_pred_original, {'MAE': mae, 'RMSE': rmse, 'R2': r2}

def improved_forecast(models_dict, df, features_to_use, scalers_dict):
    """Улучшенное прогнозирование"""
    print("\n=== ПРОГНОЗ НА 2024-2028 ГОДЫ ===")
    
    future_years = [2024, 2025, 2026, 2027, 2028]
    forecasts = {}
    
    # Используем последние известные значения
    last_known_data = df[features_to_use].iloc[-1:].values
    
    for model_name, model_info in models_dict.items():
        model = model_info['model']
        scaler_X = scalers_dict['scaler_X']
        scaler_y = scalers_dict['scaler_y']
        
        future_predictions = []
        current_features = last_known_data.copy()
        
        for year in range(5):
            current_scaled = scaler_X.transform(current_features)
            
            if hasattr(model, 'predict'):
                # Scikit-learn модели
                next_pred_scaled = model.predict(current_scaled)
            else:
                # Keras модели
                next_pred_scaled = model.predict(current_scaled, verbose=0)
            
            next_pred = scaler_y.inverse_transform(next_pred_scaled.reshape(-1, 1))[0, 0]
            future_predictions.append(next_pred)
            
            # Обновляем признаки для следующего прогноза
            current_features[0, 0] = next_pred  # Обновляем первый признак
        
        forecasts[model_name] = np.array(future_predictions)
        print(f"{model_name}: {[f'{x:.2f}' for x in future_predictions]}")
    
    return forecasts, future_years

def plot_improved_results(df, forecasts, future_years, metrics):
    """Улучшенная визуализация результатов"""
    plt.figure(figsize=(15, 10))
    
    # Основной график с прогнозами
    plt.subplot(2, 2, 1)
    plt.plot(df['year'], df['crude_oil'], 'b-', label='Исторические данные', linewidth=2)
    
    colors = ['red', 'green', 'orange', 'purple', 'brown']
    for i, (model_name, values) in enumerate(forecasts.items()):
        plt.plot(future_years, values, 'o-', color=colors[i % len(colors)], 
                label=f'{model_name}', linewidth=2, markersize=6)
    
    plt.title('Прогноз crude_oil на 2024-2028 годы')
    plt.xlabel('Год')
    plt.ylabel('Crude Oil')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    # Сравнение метрик
    plt.subplot(2, 2, 2)
    metrics_df = pd.DataFrame(metrics).T
    metrics_df[['MAE', 'RMSE']].plot(kind='bar', ax=plt.gca())
    plt.title('Сравнение метрик MAE и RMSE')
    plt.xticks(rotation=45)
    plt.ylabel('Значение метрики')
    plt.grid(True, alpha=0.3)
    
    # R2 score
    plt.subplot(2, 2, 3)
    plt.bar(metrics_df.index, metrics_df['R2'], color=['red' if x < 0 else 'green' for x in metrics_df['R2']])
    plt.title('Коэффициент детерминации R2')
    plt.xticks(rotation=45)
    plt.ylabel('R2 Score')
    plt.axhline(y=0, color='black', linestyle='-', alpha=0.3)
    plt.grid(True, alpha=0.3)
    
    # Сравнение прогнозов
    plt.subplot(2, 2, 4)
    for i, (model_name, values) in enumerate(forecasts.items()):
        plt.plot(future_years, values, 'o-', label=model_name, linewidth=2)
    plt.title('Сравнение прогнозов разных моделей')
    plt.xlabel('Год')
    plt.ylabel('Crude Oil')
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('improved_forecasts.png')
    plt.close()
    print("Графики сохранены в improved_forecasts.png")

def provide_improvement_recommendations(metrics_df, df):
    """Рекомендации по дальнейшему улучшению"""
    print("\n=== РЕКОМЕНДАЦИИ ПО УЛУЧШЕНИЮ ===")
    
    best_model = metrics_df.loc[metrics_df['R2'].idxmax()]
    best_r2 = best_model['R2']
    
    print(f"Лучшая модель: R2 = {best_r2:.4f}")
    
    if best_r2 < 0.5:
        print("Рекомендации для улучшения:")
        print("1. Соберите больше данных (больше лет наблюдений)")
        print("2. Добавьте внешние экономические показатели (ВВП, инфляция, курс валют)")
        print("3. Используйте более сложные методы feature engineering")
        print("4. Рассмотрите модели временных рядов (ARIMA, Prophet)")
        print("5. Проведите более тщательную очистку данных от выбросов")
    
    # Анализ данных
    print(f"\nИнформация о данных:")
    print(f"Количество наблюдений: {len(df)}")
    print(f"Диапазон лет: {df['year'].min()} - {df['year'].max()}")
    print(f"Изменчивость crude_oil: {df['crude_oil'].std():.2f}")

def improved_main():
    """Улучшенная версия основной функции"""
    print("=== УЛУЧШЕННОЕ ПРОГНОЗИРОВАНИЕ CRUDE_OIL ===")
    
    # 1. Загрузка данных
    df = load_data()
    df_clean = handle_missing_values(df)
    
    # 2. Расширенный анализ данных
    print("\n=== РАСШИРЕННЫЙ АНАЛИЗ ДАННЫХ ===")
    
    # Добавляем временные признаки
    df_clean = create_time_features(df_clean)
    
    # Анализ трендов
    analyze_trends(df_clean)
    
    # 3. Улучшенный отбор признаков
    features_to_use = improved_feature_selection(df_clean)
    print(f"Отобранные признаки: {features_to_use}")
    
    # 4. Подготовка данных с учетом временных рядов
    X_train, X_test, y_train, y_test, scaler_X, scaler_y = prepare_improved_data(df_clean, features_to_use)
    
    models_dict = {}
    metrics = {}
    
    # 5. Улучшенные модели
    # 5.1 Улучшенная линейная регрессия
    print("\n=== УЛУЧШЕННАЯ ЛИНЕЙНАЯ РЕГРЕССИЯ ===")
    lr_model, lr_pred, lr_metrics = create_improved_linear_model(X_train, X_test, y_train, y_test, scaler_y)
    models_dict['improved_linear'] = {'model': lr_model, 'pred': lr_pred}
    metrics['improved_linear'] = lr_metrics
    
    # 5.2 Улучшенный случайный лес
    print("\n=== УЛУЧШЕННЫЙ СЛУЧАЙНЫЙ ЛЕС ===")
    rf_model, rf_pred, rf_metrics = create_improved_random_forest(X_train, X_test, y_train, y_test, scaler_y)
    models_dict['improved_rf'] = {'model': rf_model, 'pred': rf_pred}
    metrics['improved_rf'] = rf_metrics
    
    # 5.3 Градиентный бустинг
    print("\n=== ГРАДИЕНТНЫЙ БУСТИНГ ===")
    gb_model, gb_pred, gb_metrics = create_gradient_boosting(X_train, X_test, y_train, y_test, scaler_y)
    models_dict['gradient_boosting'] = {'model': gb_model, 'pred': gb_pred}
    metrics['gradient_boosting'] = gb_metrics
    
    # 5.4 Улучшенная нейронная сеть
    print("\n=== УЛУЧШЕННАЯ НЕЙРОННАЯ СЕТЬ ===")
    nn_model, nn_pred, nn_metrics = create_improved_neural_network(X_train, X_test, y_train, y_test, scaler_y)
    models_dict['improved_nn'] = {'model': nn_model, 'pred': nn_pred}
    metrics['improved_nn'] = nn_metrics
    
    # 6. Прогнозирование
    scalers_dict = {
        'scaler_X': scaler_X,
        'scaler_y': scaler_y,
        'X_data': scaler_X.transform(df_clean[features_to_use])
    }
    
    forecasts, future_years = improved_forecast(models_dict, df_clean, features_to_use, scalers_dict)
    
    # 7. Сохранение и визуализация
    save_forecasts_to_db(forecasts, future_years, metrics)
    plot_improved_results(df_clean, forecasts, future_years, metrics)
    
    # 8. Анализ результатов
    print("\n=== АНАЛИЗ РЕЗУЛЬТАТОВ ===")
    metrics_df = pd.DataFrame(metrics).T
    print(metrics_df.round(4))
    
    # Рекомендации по улучшению
    provide_improvement_recommendations(metrics_df, df_clean)

# Запускаем улучшенную версию
if __name__ == "__main__":
    improved_main()