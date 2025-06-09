#!/usr/bin/env python3
"""
Veilige opslag service voor API credentials en configuratie
Gebruikt AES-256 encryptie voor gevoelige data
"""

import os
import json
import asyncio
import aiofiles
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from config.settings import settings

logger = logging.getLogger(__name__)

class SecureStorageService:
    """Veilige opslag voor credentials en configuratie"""
    
    def __init__(self):
        self.storage_path = settings.STORAGE_PATH
        self.credentials_file = os.path.join(self.storage_path, settings.CREDENTIALS_FILE)
        self.backup_file = os.path.join(self.storage_path, "backup_" + settings.CREDENTIALS_FILE)
        self._cipher_suite = None
        self._data_cache = {}
        self._last_modified = None
    
    async def initialize(self):
        """Initialize storage service"""
        logger.info("🔐 Initializing secure storage service...")
        
        # Create storage directory
        os.makedirs(self.storage_path, exist_ok=True)
        
        # Initialize encryption
        await self._initialize_encryption()
        
        # Load existing data
        await self._load_data()
        
        logger.info("✅ Secure storage service initialized")
    
    async def _initialize_encryption(self):
        """Initialize encryption with derived key"""
        try:
            # Use custom encryption key or derive from secret
            if settings.ENCRYPTION_KEY:
                key_material = settings.ENCRYPTION_KEY.encode()
            else:
                key_material = settings.SECRET_KEY.encode()
            
            # Derive encryption key using PBKDF2
            salt = b'ctb_trading_bot_salt'  # In productie: gebruik random salt per installatie
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(key_material))
            self._cipher_suite = Fernet(key)
            
            logger.info("🔑 Encryption initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize encryption: {e}")
            raise
    
    async def _load_data(self):
        """Load and decrypt stored data"""
        try:
            if os.path.exists(self.credentials_file):
                async with aiofiles.open(self.credentials_file, 'rb') as f:
                    encrypted_data = await f.read()
                
                if encrypted_data:
                    decrypted_data = self._cipher_suite.decrypt(encrypted_data)
                    self._data_cache = json.loads(decrypted_data.decode())
                    self._last_modified = os.path.getmtime(self.credentials_file)
                    logger.info(f"📥 Loaded {len(self._data_cache)} connections from storage")
                else:
                    self._data_cache = {}
            else:
                self._data_cache = {}
                logger.info("📁 No existing credentials file found, starting fresh")
                
        except Exception as e:
            logger.error(f"❌ Failed to load data: {e}")
            # Try backup if main file is corrupted
            await self._try_load_backup()
    
    async def _try_load_backup(self):
        """Try to load from backup file"""
        try:
            if os.path.exists(self.backup_file):
                logger.warning("🔄 Attempting to restore from backup...")
                async with aiofiles.open(self.backup_file, 'rb') as f:
                    encrypted_data = await f.read()
                
                decrypted_data = self._cipher_suite.decrypt(encrypted_data)
                self._data_cache = json.loads(decrypted_data.decode())
                logger.info("✅ Successfully restored from backup")
            else:
                self._data_cache = {}
                logger.warning("⚠️ No backup file available, starting with empty storage")
                
        except Exception as e:
            logger.error(f"❌ Failed to load backup: {e}")
            self._data_cache = {}
    
    async def _save_data(self):
        """Encrypt and save data to disk"""
        try:
            # Add timestamp
            save_data = {
                "version": "2.0.0",
                "created_at": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
                "connections": self._data_cache
            }
            
            # Encrypt data
            json_data = json.dumps(save_data, indent=2)
            encrypted_data = self._cipher_suite.encrypt(json_data.encode())
            
            # Create backup of existing file
            if os.path.exists(self.credentials_file) and settings.BACKUP_ENABLED:
                async with aiofiles.open(self.credentials_file, 'rb') as src:
                    backup_data = await src.read()
                async with aiofiles.open(self.backup_file, 'wb') as dst:
                    await dst.write(backup_data)
            
            # Write new data
            async with aiofiles.open(self.credentials_file, 'wb') as f:
                await f.write(encrypted_data)
            
            self._last_modified = os.path.getmtime(self.credentials_file)
            logger.debug("💾 Data saved to encrypted storage")
            
        except Exception as e:
            logger.error(f"❌ Failed to save data: {e}")
            raise
    
    async def store_connection(
        self,
        connection_id: str,
        name: str,
        credentials: Dict[str, Any],
        markets: Dict[str, bool]
    ):
        """Store connection data securely"""
        try:
            connection_data = {
                "name": name,
                "credentials": credentials,
                "markets": markets,
                "created_at": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
                "status": "active"
            }
            
            self._data_cache[connection_id] = connection_data
            await self._save_data()
            
            logger.info(f"💾 Stored connection: {connection_id} ({name})")
            
        except Exception as e:
            logger.error(f"❌ Failed to store connection {connection_id}: {e}")
            raise
    
    async def get_connection(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Get connection data"""
        try:
            # Reload if file was modified externally
            if self._file_was_modified():
                await self._load_data()
            
            return self._data_cache.get(connection_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to get connection {connection_id}: {e}")
            return None
    
    async def get_all_connections(self) -> Dict[str, Dict[str, Any]]:
        """Get all connections"""
        try:
            # Reload if file was modified externally
            if self._file_was_modified():
                await self._load_data()
            
            return self._data_cache.copy()
            
        except Exception as e:
            logger.error(f"❌ Failed to get all connections: {e}")
            return {}
    
    async def remove_connection(self, connection_id: str) -> bool:
        """Remove connection"""
        try:
            if connection_id in self._data_cache:
                del self._data_cache[connection_id]
                await self._save_data()
                logger.info(f"🗑️ Removed connection: {connection_id}")
                return True
            return False
            
        except Exception as e:
            logger.error(f"❌ Failed to remove connection {connection_id}: {e}")
            return False
    
    async def update_connection_status(self, connection_id: str, status: str):
        """Update connection status"""
        try:
            if connection_id in self._data_cache:
                self._data_cache[connection_id]["status"] = status
                self._data_cache[connection_id]["last_updated"] = datetime.utcnow().isoformat()
                await self._save_data()
                
        except Exception as e:
            logger.error(f"❌ Failed to update connection status {connection_id}: {e}")
    
    def _file_was_modified(self) -> bool:
        """Check if file was modified externally"""
        try:
            if not os.path.exists(self.credentials_file):
                return False
            
            current_mtime = os.path.getmtime(self.credentials_file)
            return current_mtime != self._last_modified
            
        except Exception:
            return False
    
    async def is_healthy(self) -> bool:
        """Check if storage service is healthy"""
        try:
            # Check if we can encrypt/decrypt
            test_data = {"test": "data"}
            json_data = json.dumps(test_data)
            encrypted = self._cipher_suite.encrypt(json_data.encode())
            decrypted = self._cipher_suite.decrypt(encrypted)
            
            return json.loads(decrypted.decode()) == test_data
            
        except Exception as e:
            logger.error(f"❌ Storage health check failed: {e}")
            return False
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """Get storage information"""
        try:
            file_size = 0
            if os.path.exists(self.credentials_file):
                file_size = os.path.getsize(self.credentials_file)
            
            return {
                "connections_count": len(self._data_cache),
                "file_size_bytes": file_size,
                "file_exists": os.path.exists(self.credentials_file),
                "backup_exists": os.path.exists(self.backup_file),
                "last_modified": self._last_modified,
                "encryption_enabled": self._cipher_suite is not None,
                "storage_path": self.storage_path
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to get storage info: {e}")
            return {}
    
    async def export_connections(self, include_credentials: bool = False) -> Dict[str, Any]:
        """Export connections (optionally without credentials for backup)"""
        try:
            export_data = {}
            
            for conn_id, conn_data in self._data_cache.items():
                export_item = {
                    "name": conn_data.get("name"),
                    "markets": conn_data.get("markets"),
                    "created_at": conn_data.get("created_at"),
                    "last_updated": conn_data.get("last_updated"),
                    "status": conn_data.get("status")
                }
                
                if include_credentials:
                    export_item["credentials"] = conn_data.get("credentials")
                
                export_data[conn_id] = export_item
            
            return {
                "version": "2.0.0",
                "exported_at": datetime.utcnow().isoformat(),
                "include_credentials": include_credentials,
                "connections": export_data
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to export connections: {e}")
            return {}
    
    async def cleanup(self):
        """Cleanup storage service"""
        try:
            # Final save
            if self._data_cache:
                await self._save_data()
            
            logger.info("🧹 Storage service cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ Storage cleanup failed: {e}")