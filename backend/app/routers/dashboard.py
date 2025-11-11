from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any
import pandas as pd
import psycopg2
import subprocess
import os
import sys
from sqlalchemy import create_engine

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Настройки подключения к БД
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "postgres"
}

def get_db_connection():
    """Создание подключения к базе данных"""
    return psycopg2.connect(**DB_CONFIG)

def get_sqlalchemy_engine():
    """Создание SQLAlchemy engine для pandas"""
    return create_engine(f"postgresql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")

class ForecastData(BaseModel):
    year: int
    crude_oil_forecast: float
    model_name: str
    mae: float
    rmse: float
    r2: float

class HistoricalData(BaseModel):
    year: int
    crude_oil: float

class ChartData(BaseModel):
    year: int
    linear: float
    gradient_boosting: float
    neural_network: float
    random_forest: float

class DashboardResponse(BaseModel):
    improved_linear: List[ForecastData]
    gradient_boosting: List[ForecastData]
    improved_nn: List[ForecastData]
    improved_rf: List[ForecastData]
    historical_data: List[HistoricalData]
    comparison_data: List[ChartData]
    metrics_summary: Dict[str, Any]

@router.get("/data", response_model=DashboardResponse)
async def get_dashboard_data():
    """Получение всех данных для дашборда"""
    try:
        # Получаем данные прогнозов из всех таблиц
        improved_linear = get_forecast_data("improved_linear_crude_oil_forecast")
        gradient_boosting = get_forecast_data("gradient_boosting_crude_oil_forecast")
        improved_nn = get_forecast_data("improved_nn_crude_oil_forecast")
        improved_rf = get_forecast_data("improved_rf_crude_oil_forecast")
        
        # Получаем исторические данные
        historical_data = get_historical_data()
        
        # Подготавливаем данные для графиков
        comparison_data = prepare_comparison_data(
            improved_linear, gradient_boosting, improved_nn, improved_rf
        )
        
        # Сводка по метрикам
        metrics_summary = prepare_metrics_summary(
            improved_linear, gradient_boosting, improved_nn, improved_rf
        )
        
        return DashboardResponse(
            improved_linear=improved_linear,
            gradient_boosting=gradient_boosting,
            improved_nn=improved_nn,
            improved_rf=improved_rf,
            historical_data=historical_data,
            comparison_data=comparison_data,
            metrics_summary=metrics_summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных: {str(e)}")

def get_forecast_data(table_name: str) -> List[ForecastData]:
    """Получение данных прогноза из указанной таблицы"""
    engine = get_sqlalchemy_engine()
    try:
        query = f"SELECT year, crude_oil_forecast, model_name, mae, rmse, r2 FROM {table_name} ORDER BY year"
        df = pd.read_sql(query, engine)
        
        return [
            ForecastData(
                year=int(row['year']),
                crude_oil_forecast=float(row['crude_oil_forecast']),
                model_name=str(row['model_name']),
                mae=float(row['mae']),
                rmse=float(row['rmse']),
                r2=float(row['r2'])
            )
            for _, row in df.iterrows()
        ]
    except Exception as e:
        print(f"Error reading table {table_name}: {e}")
        return []
    finally:
        engine.dispose()

def get_historical_data() -> List[HistoricalData]:
    """Получение исторических данных crude_oil"""
    engine = get_sqlalchemy_engine()
    try:
        query = "SELECT year, crude_oil FROM full_steak_dataset WHERE year BETWEEN 1960 AND 2023 ORDER BY year"
        df = pd.read_sql(query, engine)
        
        return [
            HistoricalData(
                year=int(row['year']), 
                crude_oil=float(row['crude_oil']) if pd.notna(row['crude_oil']) else 0.0
            )
            for _, row in df.iterrows()
        ]
    except Exception as e:
        print(f"Error reading historical data: {e}")
        return []
    finally:
        engine.dispose()

def prepare_comparison_data(linear_data, gb_data, nn_data, rf_data):
    """Подготовка данных для графика сравнения моделей"""
    comparison_data = []
    
    # Проверяем, что все данные есть
    if not all([linear_data, gb_data, nn_data, rf_data]):
        return comparison_data
    
    for i in range(min(len(linear_data), len(gb_data), len(nn_data), len(rf_data))):
        comparison_data.append(ChartData(
            year=linear_data[i].year,
            linear=linear_data[i].crude_oil_forecast,
            gradient_boosting=gb_data[i].crude_oil_forecast,
            neural_network=nn_data[i].crude_oil_forecast,
            random_forest=rf_data[i].crude_oil_forecast
        ))
    
    return comparison_data

def prepare_metrics_summary(linear_data, gb_data, nn_data, rf_data):
    """Подготовка сводки по метрикам"""
    summary = {}
    
    if linear_data:
        summary["linear_regression"] = {
            "mae": linear_data[0].mae,
            "rmse": linear_data[0].rmse,
            "r2": linear_data[0].r2
        }
    
    if gb_data:
        summary["gradient_boosting"] = {
            "mae": gb_data[0].mae,
            "rmse": gb_data[0].rmse,
            "r2": gb_data[0].r2
        }
    
    if nn_data:
        summary["neural_network"] = {
            "mae": nn_data[0].mae,
            "rmse": nn_data[0].rmse,
            "r2": nn_data[0].r2
        }
    
    if rf_data:
        summary["random_forest"] = {
            "mae": rf_data[0].mae,
            "rmse": rf_data[0].rmse,
            "r2": rf_data[0].r2
        }
    
    return summary

@router.post("/upload-data")
async def upload_data(background_tasks: BackgroundTasks):
    """Запуск скрипта загрузки данных"""
    try:
        # Определяем путь к скрипту относительно корня проекта
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        script_path = os.path.join(base_dir, "scripts", "upload.py")
        
        print(f"Looking for script at: {script_path}")
        
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail=f"Скрипт upload.py не найден по пути: {script_path}")
        
        # Запускаем в фоне
        background_tasks.add_task(run_script, script_path, "upload")
        
        return {"message": "Запущен процесс выгрузки данных в PostgreSQL"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка запуска скрипта: {str(e)}")

@router.post("/run-analysis")
async def run_analysis(background_tasks: BackgroundTasks):
    """Запуск скрипта анализа"""
    try:
        # Определяем путь к скрипту относительно корня проекта
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        script_path = os.path.join(base_dir, "scripts", "analysis.py")
        
        print(f"Looking for script at: {script_path}")
        
        if not os.path.exists(script_path):
            raise HTTPException(status_code=404, detail=f"Скрипт analysis.py не найден по пути: {script_path}")
        
        # Запускаем в фоне
        background_tasks.add_task(run_script, script_path, "analysis")
        
        return {"message": "Запущен процесс анализа данных ИИ"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка запуска скрипта: {str(e)}")

def run_script(script_path: str, script_name: str):
    """Запуск Python скрипта"""
    try:
        print(f"Running script: {script_path}")
        
        # Меняем рабочую директорию на директорию скрипта
        script_dir = os.path.dirname(script_path)
        original_cwd = os.getcwd()
        os.chdir(script_dir)
        
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 минут таймаут
        )
        
        # Возвращаемся обратно
        os.chdir(original_cwd)
        
        if result.returncode != 0:
            print(f"Ошибка выполнения скрипта {script_name}: {result.stderr}")
        else:
            print(f"Скрипт {script_name} выполнен успешно: {result.stdout}")
            
    except subprocess.TimeoutExpired:
        print(f"Скрипт {script_name} превысил время выполнения")
    except Exception as e:
        print(f"Ошибка при запуске скрипта {script_name}: {str(e)}")