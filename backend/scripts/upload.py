import pandas as pd
import psycopg2
from sqlalchemy import create_engine, text
import os

def excel_to_postgres():
    # Параметры подключения к PostgreSQL
    db_config = {
        'host': 'localhost',
        'database': 'postgres',
        'user': 'postgres',
        'password': 'postgres',
        'port': 5432
    }
    
    # Путь к файлу dataset.xlsx
    excel_file = 'dataset.xlsx'
    
    try:
        # Сначала проверим структуру файла
        print("Анализ структуры Excel файла...")
        
        # Читаем весь файл без пропусков для диагностики
        df_raw = pd.read_excel(excel_file, sheet_name='Y', header=None)
        print(f"Всего строк в файле: {len(df_raw)}")
        print(f"Всего столбцов в файле: {len(df_raw.columns)}")
        print("\nПервые 10 строк файла:")
        print(df_raw.head(10))
        
        # Покажем что в 6-й строке (индекс 5)
        print(f"\nСодержимое 6-й строки (будущие заголовки):")
        print(df_raw.iloc[5] if len(df_raw) > 5 else "6-я строка отсутствует!")
        
        # Теперь читаем с пропуском 5 строк
        df = pd.read_excel(
            excel_file, 
            sheet_name='Y',  # указываем конкретное имя листа
            skiprows=5,      # пропускаем первые 5 строк
            header=0         # используем следующую строку как заголовки
        )
        
        print(f"\nПосле пропуска 5 строк:")
        print(f"Прочитано {len(df)} строк из файла {excel_file}")
        print(f"Столбцы: {list(df.columns)}")
        
        if len(df) == 0:
            print("\nВНИМАНИЕ: Данные не найдены! Возможные причины:")
            print("1. Неправильное имя листа")
            print("2. Меньше 6 строк в файле")
            print("3. Пустые строки после заголовков")
            return
        
        # Проверяем структуру данных
        print("\nПервые 5 строк данных:")
        print(df.head())
        
        print("\nИнформация о типах данных:")
        print(df.dtypes)
        
        # Создаем строку подключения для SQLAlchemy
        connection_string = f"postgresql://{db_config['user']}:{db_config['password']}@{db_config['host']}:{db_config['port']}/{db_config['database']}"
        
        # Создаем движок SQLAlchemy
        engine = create_engine(connection_string)
        
        # Имя таблицы в базе данных
        table_name = 'full_steak_dataset'
        
        # Сохраняем данные в PostgreSQL
        df.to_sql(
            table_name,
            engine,
            if_exists='replace',  # заменяем таблицу если существует
            index=False,          # не сохраняем индексы pandas
            method='multi'        # для более быстрой вставки
        )
        
        print(f"\nДанные успешно сохранены в таблицу '{table_name}'")
        
        # Проверяем сохраненные данные (исправленная версия)
        with engine.connect() as conn:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()
            print(f"В таблице сохранено {count} записей")
            
    except FileNotFoundError:
        print(f"Ошибка: Файл {excel_file} не найден в текущей директории")
        print(f"Текущая директория: {os.getcwd()}")
    except Exception as e:
        print(f"Произошла ошибка: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    excel_to_postgres()