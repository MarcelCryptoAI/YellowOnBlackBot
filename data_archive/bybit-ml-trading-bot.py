#!/usr/bin/env python3
"""
Bybit Derivatives ML Trading Bot
WAARSCHUWING: Trading met derivatives bevat significante risico's. 
Gebruik dit systeem op eigen risico en begin altijd met paper trading.
"""

import numpy as np
import pandas as pd
import ccxt
import ta
from datetime import datetime, timedelta
import json
import sqlite3
import logging
import os
from typing import Dict, List, Tuple, Optional
import asyncio
import websocket
import threading
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS

# Machine Learning imports
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, GridSearchCV
import xgboost as xgb
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
import joblib
import warnings
warnings.filterwarnings('ignore')

# Configuratie
class Config:
    # Bybit API - LIVE TRADING (GEBRUIK OP EIGEN RISICO!)
    BYBIT_API_KEY = "YOUR_API_KEY"
    BYBIT_API_SECRET = "YOUR_API_SECRET"
    BYBIT_TESTNET = False  # LIVE TRADING - WEES VOORZICHTIG!
    
    # Database
    DB_PATH = "trading_bot.db"
    
    # Trading Profiles
    TRADING_PROFILES = {
        'conservative': {
            'name': 'Conservatief (Laag Risico, Weinig Trades)',
            'lookback_period': 150,
            'target_profit': 0.003,  # 0.3% profit target
            'stop_loss': 0.001,      # 0.1% stop loss
            'max_position_size': 0.005,  # 0.5% per trade
            'max_open_positions': 2,
            'min_confidence': 0.97,  # 97% zekerheid vereist
            'trade_frequency': 'low'
        },
        'balanced': {
            'name': 'Gebalanceerd (Medium Risico, Medium Trades)',
            'lookback_period': 100,
            'target_profit': 0.005,  # 0.5% profit target
            'stop_loss': 0.002,      # 0.2% stop loss
            'max_position_size': 0.01,   # 1% per trade
            'max_open_positions': 3,
            'min_confidence': 0.93,  # 93% zekerheid vereist
            'trade_frequency': 'medium'
        },
        'aggressive': {
            'name': 'Agressief (Hoog Risico, Veel Trades)',
            'lookback_period': 50,
            'target_profit': 0.01,   # 1% profit target
            'stop_loss': 0.005,      # 0.5% stop loss
            'max_position_size': 0.02,   # 2% per trade
            'max_open_positions': 5,
            'min_confidence': 0.85,  # 85% zekerheid vereist
            'trade_frequency': 'high'
        },
        'scalper': {
            'name': 'Scalper (Zeer Veel Trades, Klein Risico)',
            'lookback_period': 20,
            'target_profit': 0.001,  # 0.1% profit target
            'stop_loss': 0.0005,     # 0.05% stop loss
            'max_position_size': 0.015,  # 1.5% per trade
            'max_open_positions': 10,
            'min_confidence': 0.80,  # 80% zekerheid vereist
            'trade_frequency': 'very_high'
        },
        'high_confidence': {
            'name': 'High Confidence (Weinig Trades, Hoge Zekerheid)',
            'lookback_period': 200,
            'target_profit': 0.008,  # 0.8% profit target
            'stop_loss': 0.003,      # 0.3% stop loss
            'max_position_size': 0.015,  # 1.5% per trade
            'max_open_positions': 2,
            'min_confidence': 0.99,  # 99% zekerheid vereist
            'trade_frequency': 'very_low'
        }
    }
    
    # Actief profiel (kan runtime gewijzigd worden)
    ACTIVE_PROFILE = 'balanced'
    
    # ML Parameters (worden overschreven door profiel)
    LOOKBACK_PERIOD = 100
    FEATURE_COLUMNS = ['open', 'high', 'low', 'close', 'volume']
    TARGET_PROFIT = 0.005
    STOP_LOSS = 0.002
    
    # Risk Management (worden overschreven door profiel)
    MAX_POSITION_SIZE = 0.01
    MAX_OPEN_POSITIONS = 3
    MIN_CONFIDENCE = 0.93
    
    # Backtesting
    INITIAL_BALANCE = 10000
    COMMISSION = 0.00075  # 0.075% taker fee
    
    @classmethod
    def set_profile(cls, profile_name: str):
        """Wijzig actief trading profiel"""
        if profile_name in cls.TRADING_PROFILES:
            profile = cls.TRADING_PROFILES[profile_name]
            cls.ACTIVE_PROFILE = profile_name
            cls.LOOKBACK_PERIOD = profile['lookback_period']
            cls.TARGET_PROFIT = profile['target_profit']
            cls.STOP_LOSS = profile['stop_loss']
            cls.MAX_POSITION_SIZE = profile['max_position_size']
            cls.MAX_OPEN_POSITIONS = profile['max_open_positions']
            cls.MIN_CONFIDENCE = profile['min_confidence']
            return True
        return False
    
    @classmethod
    def get_active_profile(cls):
        """Haal actief profiel op"""
        return cls.TRADING_PROFILES[cls.ACTIVE_PROFILE]

class DataCollector:
    """Verzamelt en verwerkt marktdata van Bybit"""
    
    def __init__(self):
        self.exchange = self._init_exchange()
        self.scaler = StandardScaler()
        
    def _init_exchange(self):
        exchange_class = ccxt.bybit
        exchange = exchange_class({
            'apiKey': Config.BYBIT_API_KEY,
            'secret': Config.BYBIT_API_SECRET,
            'enableRateLimit': True,
            'options': {
                'defaultType': 'future',  # Voor derivatives
                # LIVE TRADING - GEEN TESTNET!
            }
        })
        
        # Als testnet is ingeschakeld, gebruik die settings
        if Config.BYBIT_TESTNET:
            exchange.set_sandbox_mode(True)
            
        return exchange
    
    def fetch_ohlcv(self, symbol: str, timeframe: str = '5m', limit: int = 1000) -> pd.DataFrame:
        """Haalt OHLCV data op van Bybit"""
        try:
            ohlcv = self.exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            return df
        except Exception as e:
            logging.error(f"Error fetching OHLCV: {e}")
            return pd.DataFrame()
    
    def add_technical_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Voegt technische indicatoren toe voor ML features"""
        # Price features
        df['returns'] = df['close'].pct_change()
        df['log_returns'] = np.log(df['close'] / df['close'].shift(1))
        
        # Volatility
        df['volatility'] = df['returns'].rolling(window=20).std()
        df['atr'] = ta.volatility.average_true_range(df['high'], df['low'], df['close'])
        
        # Trend indicators
        df['sma_20'] = ta.trend.sma_indicator(df['close'], window=20)
        df['sma_50'] = ta.trend.sma_indicator(df['close'], window=50)
        df['ema_12'] = ta.trend.ema_indicator(df['close'], window=12)
        df['ema_26'] = ta.trend.ema_indicator(df['close'], window=26)
        
        # MACD
        macd = ta.trend.MACD(df['close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()
        
        # RSI
        df['rsi'] = ta.momentum.rsi(df['close'], window=14)
        
        # Bollinger Bands
        bb = ta.volatility.BollingerBands(df['close'])
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_mid'] = bb.bollinger_mavg()
        df['bb_width'] = df['bb_high'] - df['bb_low']
        
        # Volume indicators
        df['volume_sma'] = df['volume'].rolling(window=20).mean()
        df['volume_ratio'] = df['volume'] / df['volume_sma']
        
        # Support/Resistance levels
        df['resistance'] = df['high'].rolling(window=20).max()
        df['support'] = df['low'].rolling(window=20).min()
        
        # Pattern recognition features
        df['higher_high'] = (df['high'] > df['high'].shift(1)).astype(int)
        df['lower_low'] = (df['low'] < df['low'].shift(1)).astype(int)
        
        # Clean data
        df.dropna(inplace=True)
        
        return df
    
    def prepare_ml_data(self, df: pd.DataFrame, lookback: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """Bereidt data voor voor ML training"""
        # Selecteer features
        feature_cols = ['open', 'high', 'low', 'close', 'volume', 'returns', 
                       'volatility', 'rsi', 'macd', 'sma_20', 'sma_50', 
                       'bb_width', 'volume_ratio']
        
        # Normaliseer features
        features = df[feature_cols].values
        features_scaled = self.scaler.fit_transform(features)
        
        # Maak sequences voor LSTM
        X, y = [], []
        for i in range(lookback, len(features_scaled)):
            X.append(features_scaled[i-lookback:i])
            # Target: 1 als prijs omhoog gaat, 0 als omlaag
            future_return = df['returns'].iloc[i]
            y.append(1 if future_return > Config.TARGET_PROFIT else 0)
        
        return np.array(X), np.array(y)

class MLModels:
    """Machine Learning modellen voor prijsvoorspelling"""
    
    def __init__(self):
        self.models = {
            'lstm': None,
            'random_forest': None,
            'xgboost': None,
            'svm': None
        }
        self.best_model = None
        self.best_accuracy = 0
        
    def create_lstm_model(self, input_shape: Tuple) -> Sequential:
        """Maakt LSTM neural network"""
        model = Sequential([
            LSTM(128, return_sequences=True, input_shape=input_shape),
            Dropout(0.2),
            LSTM(64, return_sequences=True),
            Dropout(0.2),
            LSTM(32),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(1, activation='sigmoid')
        ])
        
        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='binary_crossentropy',
            metrics=['accuracy']
        )
        
        return model
    
    def train_models(self, X: np.ndarray, y: np.ndarray) -> Dict[str, float]:
        """Traint alle ML modellen en selecteert de beste"""
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        accuracies = {}
        
        # 1. LSTM
        print("Training LSTM model...")
        lstm_model = self.create_lstm_model((X.shape[1], X.shape[2]))
        
        # Early stopping voor betere generalisatie
        early_stop = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', 
            patience=10, 
            restore_best_weights=True
        )
        
        history = lstm_model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=50,
            batch_size=32,
            callbacks=[early_stop],
            verbose=0
        )
        
        lstm_accuracy = lstm_model.evaluate(X_test, y_test, verbose=0)[1]
        self.models['lstm'] = lstm_model
        accuracies['lstm'] = lstm_accuracy
        
        # Voor andere modellen: flatten de 3D data naar 2D
        X_train_2d = X_train.reshape(X_train.shape[0], -1)
        X_test_2d = X_test.reshape(X_test.shape[0], -1)
        
        # 2. Random Forest met hyperparameter tuning
        print("Training Random Forest model...")
        rf_params = {
            'n_estimators': [100, 200, 300],
            'max_depth': [10, 20, None],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        
        rf = RandomForestClassifier(random_state=42)
        rf_grid = GridSearchCV(rf, rf_params, cv=5, scoring='accuracy', n_jobs=-1)
        rf_grid.fit(X_train_2d, y_train)
        
        self.models['random_forest'] = rf_grid.best_estimator_
        accuracies['random_forest'] = rf_grid.score(X_test_2d, y_test)
        
        # 3. XGBoost
        print("Training XGBoost model...")
        xgb_params = {
            'n_estimators': [100, 200],
            'max_depth': [3, 5, 7],
            'learning_rate': [0.01, 0.1, 0.3],
            'subsample': [0.8, 1.0]
        }
        
        xgb_model = xgb.XGBClassifier(random_state=42, use_label_encoder=False)
        xgb_grid = GridSearchCV(xgb_model, xgb_params, cv=5, scoring='accuracy', n_jobs=-1)
        xgb_grid.fit(X_train_2d, y_train)
        
        self.models['xgboost'] = xgb_grid.best_estimator_
        accuracies['xgboost'] = xgb_grid.score(X_test_2d, y_test)
        
        # 4. SVM
        print("Training SVM model...")
        svm_params = {
            'C': [0.1, 1, 10],
            'kernel': ['rbf', 'poly'],
            'gamma': ['scale', 'auto']
        }
        
        svm = SVC(probability=True, random_state=42)
        svm_grid = GridSearchCV(svm, svm_params, cv=5, scoring='accuracy', n_jobs=-1)
        svm_grid.fit(X_train_2d, y_train)
        
        self.models['svm'] = svm_grid.best_estimator_
        accuracies['svm'] = svm_grid.score(X_test_2d, y_test)
        
        # Selecteer beste model
        self.best_model = max(accuracies, key=accuracies.get)
        self.best_accuracy = accuracies[self.best_model]
        
        print(f"\nModel Accuracies:")
        for model, acc in accuracies.items():
            print(f"{model}: {acc:.4f}")
        print(f"\nBest model: {self.best_model} with accuracy: {self.best_accuracy:.4f}")
        
        return accuracies
    
    def predict(self, X: np.ndarray, model_name: Optional[str] = None) -> Tuple[np.ndarray, np.ndarray]:
        """Maakt voorspellingen met gespecificeerd of beste model"""
        if model_name is None:
            model_name = self.best_model
        
        model = self.models[model_name]
        
        if model_name == 'lstm':
            predictions = model.predict(X)
            probabilities = predictions
        else:
            # Flatten voor non-LSTM modellen
            X_flat = X.reshape(X.shape[0], -1)
            predictions = model.predict(X_flat)
            probabilities = model.predict_proba(X_flat)[:, 1]
        
        return predictions, probabilities
    
    def save_models(self, path: str = "models/"):
        """Slaat alle modellen op"""
        import os
        os.makedirs(path, exist_ok=True)
        
        # LSTM
        self.models['lstm'].save(f"{path}lstm_model.h5")
        
        # Andere modellen
        for name in ['random_forest', 'xgboost', 'svm']:
            joblib.dump(self.models[name], f"{path}{name}_model.pkl")
        
        # Save best model info
        with open(f"{path}best_model.json", 'w') as f:
            json.dump({
                'best_model': self.best_model,
                'accuracy': self.best_accuracy
            }, f)

class RiskManager:
    """Beheert risico en positie sizing"""
    
    def __init__(self, initial_balance: float = 10000):
        self.balance = initial_balance
        self.positions = []
        self.max_drawdown = 0
        self.peak_balance = initial_balance
        
    def calculate_position_size(self, confidence: float, volatility: float) -> float:
        """Berekent veilige positie grootte gebaseerd op confidence en volatility"""
        # Kelly Criterion aangepast voor veiligheid
        base_size = self.balance * Config.MAX_POSITION_SIZE
        
        # Pas aan voor confidence (hogere confidence = grotere positie)
        confidence_multiplier = min(confidence - 0.9, 0.1) * 10  # 0 tot 1
        
        # Pas aan voor volatility (hogere volatility = kleinere positie)
        volatility_multiplier = 1 / (1 + volatility * 10)
        
        position_size = base_size * confidence_multiplier * volatility_multiplier
        
        # Extra veiligheid: nooit meer dan 1% van balance
        return min(position_size, self.balance * 0.01)
    
    def check_risk_limits(self) -> bool:
        """Controleert of we binnen risico limieten blijven"""
        # Check aantal open posities
        if len(self.positions) >= Config.MAX_OPEN_POSITIONS:
            return False
        
        # Check drawdown
        current_drawdown = (self.peak_balance - self.balance) / self.peak_balance
        if current_drawdown > 0.1:  # Max 10% drawdown
            return False
        
        return True
    
    def update_balance(self, pnl: float):
        """Update balance en track performance metrics"""
        self.balance += pnl
        
        if self.balance > self.peak_balance:
            self.peak_balance = self.balance
        
        drawdown = (self.peak_balance - self.balance) / self.peak_balance
        self.max_drawdown = max(self.max_drawdown, drawdown)

class BacktestEngine:
    """Engine voor het backtesten van strategieën"""
    
    def __init__(self):
        self.results = []
        self.trades = []
        
    def run_backtest(self, data: pd.DataFrame, model: MLModels, 
                    initial_balance: float = 10000) -> Dict:
        """Voert backtest uit op historische data"""
        risk_manager = RiskManager(initial_balance)
        data_collector = DataCollector()
        
        # Bereid data voor
        X, y = data_collector.prepare_ml_data(data)
        
        # Simuleer trading
        for i in range(100, len(X)):  # Start na lookback period
            # Maak voorspelling
            X_current = X[i:i+1]
            prediction, probability = model.predict(X_current)
            
            # Check confidence
            confidence = probability[0]
            if confidence < Config.MIN_CONFIDENCE:
                continue
            
            # Check risk limits
            if not risk_manager.check_risk_limits():
                continue
            
            # Bereken position size
            current_volatility = data['volatility'].iloc[i]
            position_size = risk_manager.calculate_position_size(confidence, current_volatility)
            
            # Simuleer trade
            entry_price = data['close'].iloc[i]
            
            # Bepaal exit (simplified - in werkelijkheid complexer)
            if prediction > 0.5:  # Long signal
                exit_price = entry_price * (1 + Config.TARGET_PROFIT)
                stop_loss = entry_price * (1 - Config.STOP_LOSS)
                
                # Check volgende prijzen
                for j in range(i+1, min(i+20, len(data))):
                    if data['high'].iloc[j] >= exit_price:
                        # Take profit hit
                        pnl = position_size * Config.TARGET_PROFIT * (1 - Config.COMMISSION)
                        risk_manager.update_balance(pnl)
                        self.trades.append({
                            'entry_time': data.index[i],
                            'exit_time': data.index[j],
                            'type': 'long',
                            'entry_price': entry_price,
                            'exit_price': exit_price,
                            'pnl': pnl,
                            'confidence': confidence
                        })
                        break
                    elif data['low'].iloc[j] <= stop_loss:
                        # Stop loss hit
                        pnl = -position_size * Config.STOP_LOSS * (1 + Config.COMMISSION)
                        risk_manager.update_balance(pnl)
                        self.trades.append({
                            'entry_time': data.index[i],
                            'exit_time': data.index[j],
                            'type': 'long',
                            'entry_price': entry_price,
                            'exit_price': stop_loss,
                            'pnl': pnl,
                            'confidence': confidence
                        })
                        break
        
        # Bereken statistics
        winning_trades = [t for t in self.trades if t['pnl'] > 0]
        losing_trades = [t for t in self.trades if t['pnl'] <= 0]
        
        results = {
            'total_trades': len(self.trades),
            'winning_trades': len(winning_trades),
            'losing_trades': len(losing_trades),
            'win_rate': len(winning_trades) / len(self.trades) if self.trades else 0,
            'total_pnl': risk_manager.balance - initial_balance,
            'roi': (risk_manager.balance - initial_balance) / initial_balance * 100,
            'max_drawdown': risk_manager.max_drawdown * 100,
            'sharpe_ratio': self._calculate_sharpe_ratio(),
            'final_balance': risk_manager.balance
        }
        
        return results
    
    def _calculate_sharpe_ratio(self) -> float:
        """Berekent Sharpe ratio"""
        if not self.trades:
            return 0
        
        returns = [t['pnl'] for t in self.trades]
        if len(returns) < 2:
            return 0
        
        avg_return = np.mean(returns)
        std_return = np.std(returns)
        
        if std_return == 0:
            return 0
        
        # Annualized Sharpe ratio (assuming 5min bars, ~105k per year)
        return (avg_return / std_return) * np.sqrt(105000)

class ParameterOptimizer:
    """Continue parameter optimalisatie met genetic algorithms"""
    
    def __init__(self):
        self.population_size = 50
        self.generations = 20
        self.mutation_rate = 0.1
        
    def create_individual(self) -> Dict:
        """Maakt random parameter set"""
        return {
            'lookback_period': np.random.randint(50, 200),
            'target_profit': np.random.uniform(0.001, 0.005),
            'stop_loss': np.random.uniform(0.0005, 0.002),
            'min_confidence': np.random.uniform(0.9, 0.99),
            'max_position_size': np.random.uniform(0.005, 0.02)
        }
    
    def evaluate_fitness(self, individual: Dict, data: pd.DataFrame, model: MLModels) -> float:
        """Evalueert fitness van parameter set"""
        # Update config met individual parameters
        original_config = {
            'lookback': Config.LOOKBACK_PERIOD,
            'target': Config.TARGET_PROFIT,
            'stop': Config.STOP_LOSS,
            'confidence': Config.MIN_CONFIDENCE,
            'position': Config.MAX_POSITION_SIZE
        }
        
        Config.LOOKBACK_PERIOD = individual['lookback_period']
        Config.TARGET_PROFIT = individual['target_profit']
        Config.STOP_LOSS = individual['stop_loss']
        Config.MIN_CONFIDENCE = individual['min_confidence']
        Config.MAX_POSITION_SIZE = individual['max_position_size']
        
        # Run backtest
        backtest = BacktestEngine()
        results = backtest.run_backtest(data, model)
        
        # Fitness function: balans tussen winrate en ROI
        fitness = results['win_rate'] * 0.7 + min(results['roi'] / 100, 1) * 0.3
        
        # Restore original config
        Config.LOOKBACK_PERIOD = original_config['lookback']
        Config.TARGET_PROFIT = original_config['target']
        Config.STOP_LOSS = original_config['stop']
        Config.MIN_CONFIDENCE = original_config['confidence']
        Config.MAX_POSITION_SIZE = original_config['position']
        
        return fitness
    
    def optimize(self, data: pd.DataFrame, model: MLModels) -> Dict:
        """Genetic algorithm optimalisatie"""
        # Initialiseer populatie
        population = [self.create_individual() for _ in range(self.population_size)]
        
        best_individual = None
        best_fitness = 0
        
        for generation in range(self.generations):
            # Evalueer fitness
            fitness_scores = []
            for individual in population:
                fitness = self.evaluate_fitness(individual, data, model)
                fitness_scores.append((individual, fitness))
            
            # Sorteer op fitness
            fitness_scores.sort(key=lambda x: x[1], reverse=True)
            
            # Track beste
            if fitness_scores[0][1] > best_fitness:
                best_fitness = fitness_scores[0][1]
                best_individual = fitness_scores[0][0].copy()
            
            # Selectie en voortplanting
            new_population = []
            
            # Elite selection (top 20%)
            elite_size = int(0.2 * self.population_size)
            for i in range(elite_size):
                new_population.append(fitness_scores[i][0].copy())
            
            # Crossover en mutatie voor rest
            while len(new_population) < self.population_size:
                parent1 = fitness_scores[np.random.randint(0, elite_size)][0]
                parent2 = fitness_scores[np.random.randint(0, elite_size)][0]
                
                child = self.crossover(parent1, parent2)
                child = self.mutate(child)
                
                new_population.append(child)
            
            population = new_population
            
            print(f"Generation {generation + 1}/{self.generations}, Best fitness: {best_fitness:.4f}")
        
        return best_individual
    
    def crossover(self, parent1: Dict, parent2: Dict) -> Dict:
        """Crossover tussen twee parents"""
        child = {}
        for key in parent1:
            if np.random.random() < 0.5:
                child[key] = parent1[key]
            else:
                child[key] = parent2[key]
        return child
    
    def mutate(self, individual: Dict) -> Dict:
        """Mutatie van individual"""
        for key in individual:
            if np.random.random() < self.mutation_rate:
                if key == 'lookback_period':
                    individual[key] = np.random.randint(50, 200)
                elif key == 'target_profit':
                    individual[key] = np.random.uniform(0.001, 0.005)
                elif key == 'stop_loss':
                    individual[key] = np.random.uniform(0.0005, 0.002)
                elif key == 'min_confidence':
                    individual[key] = np.random.uniform(0.9, 0.99)
                elif key == 'max_position_size':
                    individual[key] = np.random.uniform(0.005, 0.02)
        
        return individual

class LiveTrader:
    """Live trading engine met Bybit API"""
    
    def __init__(self, model: MLModels):
        self.model = model
        self.exchange = self._init_exchange()
        self.risk_manager = RiskManager()
        self.data_collector = DataCollector()
        self.running = False
        self.positions = {}
        
    def _init_exchange(self):
        exchange = ccxt.bybit({
            'apiKey': Config.BYBIT_API_KEY,
            'secret': Config.BYBIT_API_SECRET,
            'enableRateLimit': True,
            'options': {
                'defaultType': 'future',  # Voor derivatives
                # LIVE TRADING - GEEN TESTNET!
            }
        })
        
        # Als testnet is ingeschakeld, gebruik die settings
        if Config.BYBIT_TESTNET:
            exchange.set_sandbox_mode(True)
            
        return exchange
    
    async def start_trading(self, symbol: str):
        """Start live trading loop"""
        self.running = True
        
        # Bepaal check interval gebaseerd op profiel
        profile = Config.get_active_profile()
        trade_frequency = profile.get('trade_frequency', 'medium')
        
        check_intervals = {
            'very_low': 3600,    # 1 uur
            'low': 900,          # 15 minuten  
            'medium': 300,       # 5 minuten
            'high': 60,          # 1 minuut
            'very_high': 30      # 30 seconden
        }
        
        interval = check_intervals.get(trade_frequency, 300)
        
        logging.info(f"Starting trading with {Config.ACTIVE_PROFILE} profile, checking every {interval} seconds")
        
        while self.running:
            try:
                # Fetch latest data
                df = self.data_collector.fetch_ohlcv(symbol)
                df = self.data_collector.add_technical_indicators(df)
                
                # Prepare data voor ML
                X, _ = self.data_collector.prepare_ml_data(df)
                
                if len(X) > 0:
                    # Maak voorspelling
                    prediction, probability = self.model.predict(X[-1:])
                    confidence = probability[0]
                    
                    # Log prediction details
                    logging.info(f"Prediction: {prediction[0]:.4f}, Confidence: {confidence:.4f}, Required: {Config.MIN_CONFIDENCE:.4f}")
                    
                    # Check signaal
                    if confidence >= Config.MIN_CONFIDENCE:
                        await self.execute_trade(symbol, prediction[0], confidence, df)
                
                # Check open posities
                await self.manage_positions(symbol)
                
                # Wacht voor volgende iteratie
                await asyncio.sleep(interval)
                
            except Exception as e:
                logging.error(f"Trading error: {e}")
                await asyncio.sleep(60)
    
    async def execute_trade(self, symbol: str, signal: float, confidence: float, df: pd.DataFrame):
        """Voert trade uit op Bybit"""
        try:
            # Check risk limits
            if not self.risk_manager.check_risk_limits():
                return
            
            # Bereken position size
            volatility = df['volatility'].iloc[-1]
            position_size = self.risk_manager.calculate_position_size(confidence, volatility)
            
            # Get current price
            ticker = self.exchange.fetch_ticker(symbol)
            current_price = ticker['last']
            
            # Bepaal order type
            side = 'buy' if signal > 0.5 else 'sell'
            
            # Plaats order
            order = self.exchange.create_order(
                symbol=symbol,
                type='limit',
                side=side,
                amount=position_size / current_price,
                price=current_price,
                params={
                    'stopLoss': current_price * (1 - Config.STOP_LOSS) if side == 'buy' else current_price * (1 + Config.STOP_LOSS),
                    'takeProfit': current_price * (1 + Config.TARGET_PROFIT) if side == 'buy' else current_price * (1 - Config.TARGET_PROFIT)
                }
            )
            
            # Track position
            self.positions[order['id']] = {
                'symbol': symbol,
                'side': side,
                'entry_price': current_price,
                'size': position_size,
                'confidence': confidence,
                'timestamp': datetime.now()
            }
            
            logging.info(f"Order placed: {side} {position_size} {symbol} @ {current_price}")
            
        except Exception as e:
            logging.error(f"Order execution error: {e}")
    
    async def manage_positions(self, symbol: str):
        """Beheert open posities"""
        try:
            # Fetch open orders
            open_orders = self.exchange.fetch_open_orders(symbol)
            
            for order in open_orders:
                if order['id'] in self.positions:
                    position = self.positions[order['id']]
                    
                    # Check of position te lang open staat
                    age = datetime.now() - position['timestamp']
                    if age > timedelta(hours=24):
                        # Sluit oude positie
                        self.exchange.cancel_order(order['id'], symbol)
                        del self.positions[order['id']]
                        logging.info(f"Closed old position: {order['id']}")
            
    async def emergency_stop(self):
        """Noodstop - sluit alle posities onmiddellijk"""
        logging.critical("EMERGENCY STOP ACTIVATED - Closing all positions!")
        
        try:
            # Stop trading loop
            self.running = False
            
            # Haal alle open posities op
            positions = self.exchange.fetch_positions()
            
            for position in positions:
                if position['contracts'] > 0:
                    # Sluit positie met market order
                    symbol = position['symbol']
                    side = 'sell' if position['side'] == 'long' else 'buy'
                    amount = position['contracts']
                    
                    order = self.exchange.create_market_order(
                        symbol=symbol,
                        side=side,
                        amount=amount,
                        params={'reduce_only': True}
                    )
                    
                    logging.critical(f"Emergency close: {symbol} {side} {amount}")
            
            # Cancel alle open orders
            open_orders = self.exchange.fetch_open_orders()
            for order in open_orders:
                self.exchange.cancel_order(order['id'], order['symbol'])
                logging.critical(f"Cancelled order: {order['id']}")
                
        except Exception as e:
            logging.critical(f"EMERGENCY STOP ERROR: {e}")
            # Bij fout, probeer nogmaals
            raise e

class DatabaseManager:
    """Beheert database voor trades en performance tracking"""
    
    def __init__(self):
        self.conn = sqlite3.connect(Config.DB_PATH)
        self.create_tables()
    
    def create_tables(self):
        """Maakt database tabellen"""
        cursor = self.conn.cursor()
        
        # Trades table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS trades (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                symbol TEXT,
                side TEXT,
                entry_price REAL,
                exit_price REAL,
                size REAL,
                pnl REAL,
                confidence REAL,
                model_used TEXT
            )
        ''')
        
        # Performance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date DATE,
                balance REAL,
                daily_pnl REAL,
                win_rate REAL,
                total_trades INTEGER
            )
        ''')
        
        # Model performance table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS model_performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME,
                model_name TEXT,
                accuracy REAL,
                sharpe_ratio REAL,
                max_drawdown REAL
            )
        ''')
        
        self.conn.commit()
    
    def record_trade(self, trade: Dict):
        """Slaat trade op in database"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO trades (timestamp, symbol, side, entry_price, exit_price, size, pnl, confidence, model_used)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trade['timestamp'],
            trade['symbol'],
            trade['side'],
            trade['entry_price'],
            trade['exit_price'],
            trade['size'],
            trade['pnl'],
            trade['confidence'],
            trade['model_used']
        ))
        self.conn.commit()
    
    def get_performance_stats(self) -> Dict:
        """Haalt performance statistieken op"""
        cursor = self.conn.cursor()
        
        # Trades stats
        cursor.execute('''
            SELECT 
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_trades,
                SUM(pnl) as total_pnl,
                AVG(confidence) as avg_confidence
            FROM trades
            WHERE timestamp > datetime('now', '-30 days')
        ''')
        
        stats = cursor.fetchone()
        
        return {
            'total_trades': stats[0] or 0,
            'winning_trades': stats[1] or 0,
            'total_pnl': stats[2] or 0,
            'avg_confidence': stats[3] or 0,
            'win_rate': (stats[1] / stats[0] * 100) if stats[0] > 0 else 0
        }

# Web Interface
app = Flask(__name__)
CORS(app)

# Global variables voor web interface
trader = None
ml_models = None
optimizer = None

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Bybit ML Trading Bot - LIVE VERSION</title>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <style>
            body {
                font-family: Arial, sans-serif;
                background: #1a1a1a;
                color: #fff;
                margin: 0;
                padding: 20px;
            }
            .container {
                max-width: 1400px;
                margin: 0 auto;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            .card {
                background: #2a2a2a;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            }
            .stat {
                font-size: 24px;
                font-weight: bold;
                color: #4CAF50;
            }
            .warning {
                background: #ff0000;
                color: #fff;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                text-align: center;
                font-weight: bold;
                animation: blink 2s infinite;
            }
            @keyframes blink {
                0%, 50%, 100% { opacity: 1; }
                25%, 75% { opacity: 0.5; }
            }
            .profile-card {
                background: #333;
                border: 2px solid #555;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all 0.3s;
            }
            .profile-card:hover {
                border-color: #4CAF50;
                background: #3a3a3a;
            }
            .profile-card.active {
                border-color: #4CAF50;
                background: #2a4a2a;
            }
            button {
                background: #4CAF50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                margin: 5px;
            }
            button:hover {
                background: #45a049;
            }
            .stop {
                background: #f44336;
            }
            .stop:hover {
                background: #da190b;
            }
            select {
                background: #2a2a2a;
                color: white;
                border: 1px solid #555;
                padding: 10px;
                border-radius: 5px;
                font-size: 16px;
                width: 100%;
                margin-bottom: 10px;
            }
            input[type="text"] {
                background: #2a2a2a;
                color: white;
                border: 1px solid #555;
                padding: 10px;
                border-radius: 5px;
                font-size: 16px;
                width: 100%;
                margin-bottom: 10px;
            }
            .chart-container {
                position: relative;
                height: 400px;
                margin-top: 30px;
            }
            .log {
                background: #1a1a1a;
                padding: 10px;
                border-radius: 5px;
                max-height: 200px;
                overflow-y: auto;
                font-family: monospace;
                font-size: 12px;
            }
            .risk-indicator {
                display: inline-block;
                padding: 5px 10px;
                border-radius: 5px;
                font-weight: bold;
                margin-left: 10px;
            }
            .risk-low { background: #4CAF50; }
            .risk-medium { background: #ff9800; }
            .risk-high { background: #f44336; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 Bybit ML Trading Bot - LIVE TRADING</h1>
                <div class="warning">
                    ⚠️ KRITIEKE WAARSCHUWING: DIT IS LIVE TRADING MET ECHT GELD! ⚠️<br>
                    U kunt uw VOLLEDIGE inleg verliezen! Handel alleen met geld dat u zich kunt veroorloven te verliezen!
                
            <div class="card" style="grid-column: 1/-1;">
                <h3>⚙️ Trading Profiel Selectie</h3>
                <div id="profileSelection">
                    <div class="profile-card" onclick="selectProfile('conservative')">
                        <h4>🛡️ Conservatief</h4>
                        <span class="risk-indicator risk-low">LAAG RISICO</span>
                        <p>• Weinig trades (1-3 per dag)</p>
                        <p>• 0.5% risico per trade</p>
                        <p>• 97% zekerheid vereist</p>
                        <p>• Geschikt voor beginners</p>
                    </div>
                    
                    <div class="profile-card active" onclick="selectProfile('balanced')">
                        <h4>⚖️ Gebalanceerd</h4>
                        <span class="risk-indicator risk-medium">MEDIUM RISICO</span>
                        <p>• Gemiddeld aantal trades (3-10 per dag)</p>
                        <p>• 1% risico per trade</p>
                        <p>• 93% zekerheid vereist</p>
                        <p>• Goede balans risico/rendement</p>
                    </div>
                    
                    <div class="profile-card" onclick="selectProfile('aggressive')">
                        <h4>🚀 Agressief</h4>
                        <span class="risk-indicator risk-high">HOOG RISICO</span>
                        <p>• Veel trades (10-20 per dag)</p>
                        <p>• 2% risico per trade</p>
                        <p>• 85% zekerheid vereist</p>
                        <p>• Voor ervaren traders</p>
                    </div>
                    
                    <div class="profile-card" onclick="selectProfile('scalper')">
                        <h4>⚡ Scalper</h4>
                        <span class="risk-indicator risk-medium">MEDIUM RISICO</span>
                        <p>• Zeer veel trades (20+ per dag)</p>
                        <p>• 1.5% risico, kleine targets</p>
                        <p>• 80% zekerheid vereist</p>
                        <p>• Snelle kleine winsten</p>
                    </div>
                    
                    <div class="profile-card" onclick="selectProfile('high_confidence')">
                        <h4>🎯 High Confidence</h4>
                        <span class="risk-indicator risk-low">LAAG RISICO</span>
                        <p>• Zeer weinig trades (1-2 per week)</p>
                        <p>• 1.5% risico per trade</p>
                        <p>• 99% zekerheid vereist</p>
                        <p>• Alleen de beste setups</p>
                    </div>
                </div>
            </div>
            </div>
            
            <div class="grid">
                <div class="card">
                    <h3>📊 Performance</h3>
                    <p>Win Rate: <span class="stat" id="winRate">0%</span></p>
                    <p>Total P&L: <span class="stat" id="totalPnl">$0</span></p>
                    <p>Active Trades: <span class="stat" id="activeTrades">0</span></p>
                    <p>Actief Profiel: <span id="activeProfile" style="color: #ff9800;">Gebalanceerd</span></p>
                </div>
                
                <div class="card">
                    <h3>🧠 ML Model</h3>
                    <select id="modelSelect">
                        <option value="lstm">LSTM Neural Network</option>
                        <option value="random_forest">Random Forest</option>
                        <option value="xgboost">XGBoost</option>
                        <option value="svm">Support Vector Machine</option>
                    </select>
                    <p>Model Accuracy: <span class="stat" id="modelAccuracy">0%</span></p>
                    <button onclick="trainModel()">Train Model</button>
                </div>
                
                <div class="card">
                    <h3>🎯 Trading Control</h3>
                    <input type="text" id="symbol" placeholder="Symbol (e.g., BTC/USDT)" value="BTC/USDT">
                    <input type="text" id="apiKey" placeholder="Bybit API Key" type="password">
                    <input type="text" id="apiSecret" placeholder="Bybit API Secret" type="password">
                    <button onclick="startTrading()" style="background: #ff6b6b;">START LIVE TRADING</button>
                    <button onclick="stopTrading()" class="stop">STOP TRADING</button>
                    <button onclick="emergencyStop()" style="background: #ff0000; font-weight: bold;">🚨 EMERGENCY STOP</button>
                    <p>Status: <span id="tradingStatus" style="color: #f44336;">Stopped</span></p>
                </div>
                
                <div class="card">
                    <h3>⚙️ Optimization</h3>
                    <button onclick="optimizeParameters()">Optimize Parameters</button>
                    <p>Profile Parameters:</p>
                    <div id="profileParams" style="font-size: 12px;">
                        <p>Min Confidence: <span id="paramConfidence">93%</span></p>
                        <p>Target Profit: <span id="paramTarget">0.5%</span></p>
                        <p>Stop Loss: <span id="paramStop">0.2%</span></p>
                        <p>Max Position: <span id="paramPosition">1%</span></p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3>📈 Backtest Results</h3>
                <button onclick="runBacktest()">Run Backtest</button>
                <div class="chart-container">
                    <canvas id="backtestChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>📝 System Log</h3>
                <div class="log" id="systemLog">
                    System initialized...
                </div>
            </div>
        </div>
        
        <script>
            let chart = null;
            let selectedProfile = 'balanced';
            
            function log(message) {
                const logDiv = document.getElementById('systemLog');
                const timestamp = new Date().toLocaleTimeString();
                logDiv.innerHTML += `<br>[${timestamp}] ${message}`;
                logDiv.scrollTop = logDiv.scrollHeight;
            }
            
            function selectProfile(profile) {
                // Update UI
                document.querySelectorAll('.profile-card').forEach(card => {
                    card.classList.remove('active');
                });
                event.currentTarget.classList.add('active');
                
                selectedProfile = profile;
                
                // Update profile parameters display
                updateProfileDisplay(profile);
                
                // Send to backend
                fetch('/api/set_profile', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({profile: profile})
                }).then(response => response.json())
                .then(data => {
                    log(`Profile changed to: ${data.profile_name}`);
                    document.getElementById('activeProfile').textContent = data.profile_name;
                });
            }
            
            function updateProfileDisplay(profile) {
                const profiles = {
                    'conservative': {confidence: '97%', target: '0.3%', stop: '0.1%', position: '0.5%'},
                    'balanced': {confidence: '93%', target: '0.5%', stop: '0.2%', position: '1%'},
                    'aggressive': {confidence: '85%', target: '1%', stop: '0.5%', position: '2%'},
                    'scalper': {confidence: '80%', target: '0.1%', stop: '0.05%', position: '1.5%'},
                    'high_confidence': {confidence: '99%', target: '0.8%', stop: '0.3%', position: '1.5%'}
                };
                
                const params = profiles[profile];
                document.getElementById('paramConfidence').textContent = params.confidence;
                document.getElementById('paramTarget').textContent = params.target;
                document.getElementById('paramStop').textContent = params.stop;
                document.getElementById('paramPosition').textContent = params.position;
            }
            
            async function trainModel() {
                log('Starting model training...');
                const modelName = document.getElementById('modelSelect').value;
                
                try {
                    const response = await fetch('/api/train', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({model: modelName})
                    });
                    
                    const data = await response.json();
                    document.getElementById('modelAccuracy').textContent = 
                        (data.accuracy * 100).toFixed(2) + '%';
                    log(`Model trained successfully. Accuracy: ${(data.accuracy * 100).toFixed(2)}%`);
                } catch (error) {
                    log(`Error training model: ${error}`);
                }
            }
            
            async function startTrading() {
                const symbol = document.getElementById('symbol').value;
                const apiKey = document.getElementById('apiKey').value;
                const apiSecret = document.getElementById('apiSecret').value;
                
                if (!apiKey || !apiSecret) {
                    alert('Vul eerst uw Bybit API credentials in!');
                    return;
                }
                
                const confirmed = confirm(
                    `⚠️ WAARSCHUWING ⚠️\n\n` +
                    `U staat op het punt LIVE TRADING te starten met ECHT GELD!\n\n` +
                    `Profiel: ${selectedProfile.toUpperCase()}\n` +
                    `Symbol: ${symbol}\n\n` +
                    `Weet u ZEKER dat u wilt doorgaan?\n\n` +
                    `U handelt volledig op eigen risico!`
                );
                
                if (!confirmed) return;
                
                log(`Starting LIVE trading for ${symbol} with ${selectedProfile} profile...`);
                
                try {
                    const response = await fetch('/api/start_trading', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            symbol: symbol,
                            api_key: apiKey,
                            api_secret: apiSecret,
                            profile: selectedProfile
                        })
                    });
                    
                    if (response.ok) {
                        document.getElementById('tradingStatus').textContent = 'LIVE TRADING ACTIVE';
                        document.getElementById('tradingStatus').style.color = '#ff0000';
                        log('⚠️ LIVE TRADING STARTED - REAL MONEY AT RISK!');
                        
                        // Start updating stats
                        setInterval(updateStats, 5000);
                    }
                } catch (error) {
                    log(`Error starting trading: ${error}`);
                }
            }
            
            async function stopTrading() {
                log('Stopping trading...');
                
                try {
                    const response = await fetch('/api/stop_trading', {method: 'POST'});
                    
                    if (response.ok) {
                        document.getElementById('tradingStatus').textContent = 'Stopped';
                        document.getElementById('tradingStatus').style.color = '#f44336';
                        log('Trading stopped');
                    }
                } catch (error) {
                    log(`Error stopping trading: ${error}`);
                }
            }
            
            async function runBacktest() {
                log(`Running backtest with ${selectedProfile} profile...`);
                
                try {
                    const response = await fetch('/api/backtest', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({profile: selectedProfile})
                    });
                    const data = await response.json();
                    
                    log(`Backtest complete. Win rate: ${(data.win_rate * 100).toFixed(2)}%, ROI: ${data.roi.toFixed(2)}%`);
                    
                    // Update chart
                    if (data.equity_curve) {
                        updateBacktestChart(data.equity_curve);
                    }
                } catch (error) {
                    log(`Error running backtest: ${error}`);
                }
            }
            
            async function optimizeParameters() {
                log(`Starting parameter optimization for ${selectedProfile} profile...`);
                
                try {
                    const response = await fetch('/api/optimize', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({profile: selectedProfile})
                    });
                    const data = await response.json();
                    
                    // Update display with optimized parameters
                    document.getElementById('paramConfidence').textContent = (data.min_confidence * 100).toFixed(1) + '%';
                    document.getElementById('paramTarget').textContent = (data.target_profit * 100).toFixed(2) + '%';
                    document.getElementById('paramStop').textContent = (data.stop_loss * 100).toFixed(2) + '%';
                    document.getElementById('paramPosition').textContent = (data.max_position_size * 100).toFixed(1) + '%';
                    
                    log('Optimization complete - parameters updated');
                } catch (error) {
                    log(`Error optimizing: ${error}`);
                }
            }
            
            async function emergencyStop() {
                const confirmed = confirm(
                    '🚨 NOODSTOP ACTIVEREN? 🚨\n\n' +
                    'Dit zal ALLE posities ONMIDDELLIJK sluiten!\n' +
                    'Gebruik dit alleen in noodgevallen!\n\n' +
                    'Weet u het ZEKER?'
                );
                
                if (!confirmed) return;
                
                log('🚨 ACTIVATING EMERGENCY STOP...');
                
                try {
                    const response = await fetch('/api/emergency_stop', {method: 'POST'});
                    
                    if (response.ok) {
                        document.getElementById('tradingStatus').textContent = 'EMERGENCY STOPPED';
                        document.getElementById('tradingStatus').style.color = '#ff0000';
                        log('🚨 EMERGENCY STOP ACTIVATED - ALL POSITIONS CLOSED');
                        alert('NOODSTOP GEACTIVEERD!\nAlle posities zijn gesloten.\nControleer uw Bybit account!');
                    }
                } catch (error) {
                    log(`EMERGENCY STOP ERROR: ${error}`);
                    alert('FOUT BIJ NOODSTOP! Sluit posities handmatig op Bybit!');
                }
            }
            
            async function updateStats() {
                try {
                    const response = await fetch('/api/stats');
                    const data = await response.json();
                    
                    document.getElementById('winRate').textContent = 
                        data.win_rate.toFixed(2) + '%';
                    document.getElementById('totalPnl').textContent = 
                        '
    </body>
    </html>
    '''

@app.route('/api/set_profile', methods=['POST'])
def api_set_profile():
    data = request.json
    profile_name = data.get('profile', 'balanced')
    
    if Config.set_profile(profile_name):
        profile = Config.get_active_profile()
        return jsonify({
            'status': 'success',
            'profile': profile_name,
            'profile_name': profile['name']
        })
    else:
        return jsonify({'error': 'Invalid profile'}), 400

@app.route('/api/train', methods=['POST'])
def api_train():
    global ml_models
    
    data = request.json
    model_name = data.get('model', 'lstm')
    
    # Fetch training data
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Prepare ML data
    X, y = collector.prepare_ml_data(df)
    
    # Train models
    ml_models = MLModels()
    accuracies = ml_models.train_models(X, y)
    
    return jsonify({
        'accuracy': accuracies.get(model_name, 0),
        'all_accuracies': accuracies
    })

@app.route('/api/start_trading', methods=['POST'])
def api_start_trading():
    global trader, ml_models
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    data = request.json
    symbol = data.get('symbol', 'BTC/USDT')
    api_key = data.get('api_key')
    api_secret = data.get('api_secret')
    profile = data.get('profile', 'balanced')
    
    # Update API credentials
    if api_key and api_secret:
        Config.BYBIT_API_KEY = api_key
        Config.BYBIT_API_SECRET = api_secret
    
    # Set profile
    Config.set_profile(profile)
    
    trader = LiveTrader(ml_models)
    
    # Start trading in background thread
    thread = threading.Thread(
        target=asyncio.run, 
        args=(trader.start_trading(symbol),)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'started', 'profile': profile})

@app.route('/api/stop_trading', methods=['POST'])
def api_stop_trading():
    global trader
    
    if trader:
        trader.running = False
    
    return jsonify({'status': 'stopped'})

@app.route('/api/backtest', methods=['POST'])
def api_backtest():
    global ml_models
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    data = request.json
    profile = data.get('profile', Config.ACTIVE_PROFILE)
    
    # Set profile for backtest
    Config.set_profile(profile)
    
    # Fetch data for backtest
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Run backtest
    backtest = BacktestEngine()
    results = backtest.run_backtest(df, ml_models)
    
    # Create equity curve
    equity_curve = [Config.INITIAL_BALANCE]
    current_balance = Config.INITIAL_BALANCE
    
    for trade in backtest.trades:
        current_balance += trade['pnl']
        equity_curve.append(current_balance)
    
    results['equity_curve'] = equity_curve
    results['profile_used'] = profile
    
    return jsonify(results)

@app.route('/api/optimize', methods=['POST'])
def api_optimize():
    global ml_models, optimizer
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    data = request.json
    profile = data.get('profile', Config.ACTIVE_PROFILE)
    
    # Set base profile
    Config.set_profile(profile)
    
    # Fetch data
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Run optimization
    optimizer = ParameterOptimizer()
    best_params = optimizer.optimize(df, ml_models)
    
    # Apply optimized parameters
    Config.LOOKBACK_PERIOD = best_params['lookback_period']
    Config.TARGET_PROFIT = best_params['target_profit']
    Config.STOP_LOSS = best_params['stop_loss']
    Config.MIN_CONFIDENCE = best_params['min_confidence']
    Config.MAX_POSITION_SIZE = best_params['max_position_size']
    
    return jsonify(best_params)

@app.route('/api/emergency_stop', methods=['POST'])
def api_emergency_stop():
    global trader
    
    if trader:
        # Run emergency stop
        thread = threading.Thread(
            target=asyncio.run,
            args=(trader.emergency_stop(),)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({'status': 'emergency_stop_activated'})
    else:
        return jsonify({'error': 'No active trader'}), 400

@app.route('/api/stats')
def api_stats():
    db = DatabaseManager()
    stats = db.get_performance_stats()
    
    # Add active trades count
    if trader and hasattr(trader, 'positions'):
        stats['active_trades'] = len(trader.positions)
    else:
        stats['active_trades'] = 0
    
    return jsonify(stats)

def main():
    """Main function om bot te starten"""
    print("=" * 60)
    print("🤖 Bybit ML Trading Bot - LIVE VERSION")
    print("=" * 60)
    print("\n⚠️  KRITIEKE WAARSCHUWING:")
    print("    DIT IS LIVE TRADING MET ECHT GELD!")
    print("    U kunt uw VOLLEDIGE inleg verliezen!")
    print("    Gebruik alleen geld dat u zich kunt veroorloven te verliezen!")
    print("=" * 60)
    
    print("\n📊 Opening web interface on http://localhost:5000")
    print("\n✅ Trading Profielen:")
    print("- Conservative: Laag risico, weinig trades (1-3/dag)")
    print("- Balanced: Medium risico, gemiddeld trades (3-10/dag)")
    print("- Aggressive: Hoog risico, veel trades (10-20/dag)")
    print("- Scalper: Medium risico, zeer veel trades (20+/dag)")
    print("- High Confidence: Laag risico, zeer weinig trades (1-2/week)")
    
    print("\n✅ Features:")
    print("- 4 ML models (LSTM, Random Forest, XGBoost, SVM)")
    print("- 5 Trading profiles voor verschillende risiconiveaus")
    print("- Automatic parameter optimization")
    print("- Advanced risk management")
    print("- Backtesting engine")
    print("- Web interface voor monitoring")
    
    print("\n⚠️  BELANGRIJK:")
    print("1. Train eerst een model voordat u begint")
    print("2. Test ALTIJD eerst met backtest")
    print("3. Begin met Conservative profiel")
    print("4. Monitor actief tijdens trading")
    print("5. Gebruik stop loss orders!")
    
    print("\n🚀 Starting web server...")
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Check if running on Heroku
    port = int(os.environ.get('PORT', 5000))
    
    # Start Flask app
    app.run(debug=False, host='0.0.0.0', port=port)

if __name__ == "__main__":
    # Als direct uitgevoerd (niet via Heroku)
    if not os.environ.get('DYNO'):
        main()
    else:
        # Heroku environment - skip print statements
        logging.info("Starting on Heroku...")
        port = int(os.environ.get('PORT', 5000))
        app.run(debug=False, host='0.0.0.0', port=port)
 + data.total_pnl.toFixed(2);
                    document.getElementById('activeTrades').textContent = 
                        data.active_trades;
                } catch (error) {
                    console.error('Error updating stats:', error);
                }
            }
            
            function updateBacktestChart(equityCurve) {
                const ctx = document.getElementById('backtestChart').getContext('2d');
                
                if (chart) {
                    chart.destroy();
                }
                
                chart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: equityCurve.map((_, i) => i),
                        datasets: [{
                            label: 'Portfolio Value',
                            data: equityCurve,
                            borderColor: '#4CAF50',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: {color: '#fff'}
                            }
                        },
                        scales: {
                            x: {
                                grid: {color: '#333'},
                                ticks: {color: '#fff'}
                            },
                            y: {
                                grid: {color: '#333'},
                                ticks: {color: '#fff'}
                            }
                        }
                    }
                });
            }
            
            // Initial stats update
            updateStats();
            updateProfileDisplay('balanced');
        </script>
    </body>
    </html>
    '''

@app.route('/api/train', methods=['POST'])
def api_train():
    global ml_models
    
    data = request.json
    model_name = data.get('model', 'lstm')
    
    # Fetch training data
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Prepare ML data
    X, y = collector.prepare_ml_data(df)
    
    # Train models
    ml_models = MLModels()
    accuracies = ml_models.train_models(X, y)
    
    return jsonify({
        'accuracy': accuracies.get(model_name, 0),
        'all_accuracies': accuracies
    })

@app.route('/api/start_trading', methods=['POST'])
def api_start_trading():
    global trader, ml_models
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    data = request.json
    symbol = data.get('symbol', 'BTC/USDT')
    
    trader = LiveTrader(ml_models)
    
    # Start trading in background thread
    thread = threading.Thread(
        target=asyncio.run, 
        args=(trader.start_trading(symbol),)
    )
    thread.daemon = True
    thread.start()
    
    return jsonify({'status': 'started'})

@app.route('/api/stop_trading', methods=['POST'])
def api_stop_trading():
    global trader
    
    if trader:
        trader.running = False
    
    return jsonify({'status': 'stopped'})

@app.route('/api/backtest', methods=['POST'])
def api_backtest():
    global ml_models
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    # Fetch data for backtest
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Run backtest
    backtest = BacktestEngine()
    results = backtest.run_backtest(df, ml_models)
    
    # Create equity curve
    equity_curve = [Config.INITIAL_BALANCE]
    current_balance = Config.INITIAL_BALANCE
    
    for trade in backtest.trades:
        current_balance += trade['pnl']
        equity_curve.append(current_balance)
    
    results['equity_curve'] = equity_curve
    
    return jsonify(results)

@app.route('/api/optimize', methods=['POST'])
def api_optimize():
    global ml_models, optimizer
    
    if not ml_models:
        return jsonify({'error': 'Please train a model first'}), 400
    
    # Fetch data
    collector = DataCollector()
    df = collector.fetch_ohlcv('BTC/USDT', '5m', 2000)
    df = collector.add_technical_indicators(df)
    
    # Run optimization
    optimizer = ParameterOptimizer()
    best_params = optimizer.optimize(df, ml_models)
    
    return jsonify(best_params)

@app.route('/api/stats')
def api_stats():
    db = DatabaseManager()
    stats = db.get_performance_stats()
    
    # Add active trades count
    if trader and hasattr(trader, 'positions'):
        stats['active_trades'] = len(trader.positions)
    else:
        stats['active_trades'] = 0
    
    return jsonify(stats)

def main():
    """Main function om bot te starten"""
    print("🤖 Bybit ML Trading Bot Starting...")
    print("📊 Opening web interface on http://localhost:5000")
    print("\n⚠️  IMPORTANT: This bot is configured for TESTNET by default.")
    print("⚠️  Never use real API keys without thorough testing!")
    print("\n✅ Features:")
    print("- 4 ML models (LSTM, Random Forest, XGBoost, SVM)")
    print("- Automatic parameter optimization")
    print("- Risk management with <1% risk per trade")
    print("- Backtesting engine")
    print("- Web interface for monitoring")
    print("\n🚀 Starting web server...")
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Start Flask app
    app.run(debug=False, host='0.0.0.0', port=5000)

if __name__ == "__main__":
    main()
