#!/usr/bin/env python3
"""
Settings en configuratie voor CTB Trading Bot
"""

import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "CTB Trading Bot"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str = "ctb-trading-bot-secret-key-change-in-production"
    ENCRYPTION_KEY: Optional[str] = None
    
    # Storage
    STORAGE_PATH: str = "./storage"
    CREDENTIALS_FILE: str = "encrypted_credentials.json"
    BACKUP_ENABLED: bool = True
    BACKUP_INTERVAL: int = 3600  # seconds
    
    # ByBit API
    BYBIT_TESTNET_URL: str = "https://api-testnet.bybit.com"
    BYBIT_MAINNET_URL: str = "https://api.bybit.com"
    BYBIT_TIMEOUT: int = 30
    BYBIT_RATE_LIMIT: int = 120  # requests per minute
    
    # WebSocket
    WS_PING_INTERVAL: int = 20
    WS_PING_TIMEOUT: int = 10
    WS_MAX_CONNECTIONS: int = 100
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: Optional[str] = None
    
    # Data fetching intervals (seconds)
    BALANCE_UPDATE_INTERVAL: int = 30
    POSITION_UPDATE_INTERVAL: int = 15
    MARKET_DATA_INTERVAL: int = 5
    
    # Risk management
    MAX_CONNECTIONS_PER_USER: int = 10
    MAX_POSITIONS_PER_CONNECTION: int = 50
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

# Global settings instance
settings = Settings()