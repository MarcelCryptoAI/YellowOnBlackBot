#!/usr/bin/env python3
"""
Authentication & Security Service - CTB Trading Bot
JWT-based authentication met role-based access control en API key management
"""

import os
import jwt
import bcrypt
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import uuid
import hashlib
import hmac
from functools import wraps

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .database import get_database

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", secrets.token_urlsafe(64))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30

class UserRole(Enum):
    ADMIN = "ADMIN"
    TRADER = "TRADER"
    VIEWER = "VIEWER"
    API_USER = "API_USER"

class SessionStatus(Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"

@dataclass
class User:
    id: str
    username: str
    email: str
    password_hash: str
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    failed_login_attempts: int = 0
    account_locked_until: Optional[datetime] = None
    two_factor_enabled: bool = False
    two_factor_secret: Optional[str] = None

@dataclass
class Session:
    id: str
    user_id: str
    access_token: str
    refresh_token: str
    status: SessionStatus
    created_at: datetime
    expires_at: datetime
    last_activity: datetime
    ip_address: str
    user_agent: str

@dataclass
class APIKey:
    id: str
    user_id: str
    name: str
    key_hash: str
    permissions: List[str]
    is_active: bool
    created_at: datetime
    expires_at: Optional[datetime]
    last_used: Optional[datetime]
    usage_count: int = 0

class AuthService:
    """
    Comprehensive authentication en security service
    """
    
    def __init__(self):
        self.db = get_database()
        self.security = HTTPBearer()
        self.init_auth_tables()
        
        # Rate limiting
        self.login_attempts = {}
        self.api_rate_limits = {}
        
        # Security settings
        self.max_login_attempts = 5
        self.lockout_duration_minutes = 15
        self.session_timeout_minutes = 60
        self.api_rate_limit_per_minute = 100
        
    def init_auth_tables(self):
        """Initialize authentication database tables"""
        try:
            with self.db.get_connection() as conn:
                # Users table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        role TEXT NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_login TIMESTAMP,
                        failed_login_attempts INTEGER DEFAULT 0,
                        account_locked_until TIMESTAMP,
                        two_factor_enabled BOOLEAN DEFAULT FALSE,
                        two_factor_secret TEXT
                    )
                """)
                
                # Sessions table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        access_token TEXT NOT NULL,
                        refresh_token TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP NOT NULL,
                        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        ip_address TEXT,
                        user_agent TEXT,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                """)
                
                # API Keys table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS api_keys (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        name TEXT NOT NULL,
                        key_hash TEXT NOT NULL,
                        permissions TEXT NOT NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP,
                        last_used TIMESTAMP,
                        usage_count INTEGER DEFAULT 0,
                        FOREIGN KEY (user_id) REFERENCES users (id)
                    )
                """)
                
                # Audit log table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS auth_audit_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        action TEXT NOT NULL,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        success BOOLEAN NOT NULL,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                conn.commit()
                logger.info("✅ Authentication tables initialized")
                
                # Create default admin user if none exists
                self._create_default_admin()
                
        except Exception as e:
            logger.error(f"❌ Error initializing auth tables: {e}")
    
    def _create_default_admin(self):
        """Create default admin user if none exists"""
        try:
            with self.db.get_connection() as conn:
                admin_exists = conn.execute(
                    "SELECT id FROM users WHERE role = ?", ("ADMIN",)
                ).fetchone()
                
                if not admin_exists:
                    admin_id = str(uuid.uuid4())
                    password_hash = self._hash_password("admin123!CTB")
                    
                    conn.execute("""
                        INSERT INTO users (id, username, email, password_hash, role, is_active)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        admin_id,
                        "admin",
                        "admin@ctb-trading.com",
                        password_hash,
                        "ADMIN",
                        True
                    ))
                    conn.commit()
                    
                    logger.info("✅ Default admin user created - admin/admin123!CTB")
                    
        except Exception as e:
            logger.error(f"❌ Error creating default admin: {e}")
    
    def _hash_password(self, password: str) -> str:
        """Hash password with bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    def _verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    
    def _generate_jwt_token(self, user_id: str, token_type: str = "access") -> str:
        """Generate JWT token"""
        now = datetime.utcnow()
        
        if token_type == "access":
            expire = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        else:  # refresh
            expire = now + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        
        payload = {
            "user_id": user_id,
            "type": token_type,
            "iat": now,
            "exp": expire
        }
        
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    def _verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode JWT token"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    def _log_auth_event(self, user_id: Optional[str], action: str, details: str,
                       ip_address: str, user_agent: str, success: bool):
        """Log authentication event"""
        try:
            with self.db.get_connection() as conn:
                conn.execute("""
                    INSERT INTO auth_audit_log 
                    (user_id, action, details, ip_address, user_agent, success)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, action, details, ip_address, user_agent, success))
                conn.commit()
        except Exception as e:
            logger.error(f"Error logging auth event: {e}")
    
    def register_user(self, username: str, email: str, password: str, 
                     role: UserRole = UserRole.TRADER) -> Tuple[bool, str]:
        """Register new user"""
        try:
            # Validate password strength
            if not self._validate_password_strength(password):
                return False, "Password does not meet security requirements"
            
            # Check if user exists
            with self.db.get_connection() as conn:
                existing = conn.execute(
                    "SELECT id FROM users WHERE username = ? OR email = ?",
                    (username, email)
                ).fetchone()
                
                if existing:
                    return False, "Username or email already exists"
                
                # Create user
                user_id = str(uuid.uuid4())
                password_hash = self._hash_password(password)
                
                conn.execute("""
                    INSERT INTO users (id, username, email, password_hash, role, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (user_id, username, email, password_hash, role.value, True))
                conn.commit()
                
                logger.info(f"✅ User registered: {username}")
                return True, "User registered successfully"
                
        except Exception as e:
            logger.error(f"Error registering user: {e}")
            return False, f"Registration failed: {str(e)}"
    
    def _validate_password_strength(self, password: str) -> bool:
        """Validate password strength"""
        if len(password) < 8:
            return False
        if not any(c.isupper() for c in password):
            return False
        if not any(c.islower() for c in password):
            return False
        if not any(c.isdigit() for c in password):
            return False
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            return False
        return True
    
    def login(self, username: str, password: str, ip_address: str, 
             user_agent: str) -> Tuple[bool, Dict[str, Any]]:
        """User login with rate limiting and account lockout"""
        try:
            # Check rate limiting
            if self._is_rate_limited(ip_address, "login"):
                self._log_auth_event(None, "LOGIN_RATE_LIMITED", f"IP: {ip_address}", 
                                   ip_address, user_agent, False)
                return False, {"error": "Too many login attempts. Please try again later."}
            
            # Get user
            with self.db.get_connection() as conn:
                user_row = conn.execute(
                    "SELECT * FROM users WHERE username = ? OR email = ?",
                    (username, username)
                ).fetchone()
                
                if not user_row:
                    self._track_login_attempt(ip_address, "login", False)
                    self._log_auth_event(None, "LOGIN_FAILED", f"User not found: {username}", 
                                       ip_address, user_agent, False)
                    return False, {"error": "Invalid credentials"}
                
                user = User(**dict(user_row))
                
                # Check if account is locked
                if user.account_locked_until and user.account_locked_until > datetime.now(timezone.utc):
                    self._log_auth_event(user.id, "LOGIN_BLOCKED", "Account locked", 
                                       ip_address, user_agent, False)
                    return False, {"error": "Account is temporarily locked"}
                
                # Check if account is active
                if not user.is_active:
                    self._log_auth_event(user.id, "LOGIN_BLOCKED", "Account inactive", 
                                       ip_address, user_agent, False)
                    return False, {"error": "Account is inactive"}
                
                # Verify password
                if not self._verify_password(password, user.password_hash):
                    # Increment failed attempts
                    failed_attempts = user.failed_login_attempts + 1
                    
                    # Lock account if too many attempts
                    if failed_attempts >= self.max_login_attempts:
                        lockout_until = datetime.now(timezone.utc) + timedelta(minutes=self.lockout_duration_minutes)
                        conn.execute("""
                            UPDATE users SET failed_login_attempts = ?, account_locked_until = ?
                            WHERE id = ?
                        """, (failed_attempts, lockout_until, user.id))
                    else:
                        conn.execute("""
                            UPDATE users SET failed_login_attempts = ? WHERE id = ?
                        """, (failed_attempts, user.id))
                    
                    conn.commit()
                    
                    self._track_login_attempt(ip_address, "login", False)
                    self._log_auth_event(user.id, "LOGIN_FAILED", "Invalid password", 
                                       ip_address, user_agent, False)
                    return False, {"error": "Invalid credentials"}
                
                # Successful login - reset failed attempts
                conn.execute("""
                    UPDATE users SET failed_login_attempts = 0, account_locked_until = NULL,
                                   last_login = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (user.id,))
                conn.commit()
                
                # Create session
                session = self._create_session(user.id, ip_address, user_agent)
                
                self._log_auth_event(user.id, "LOGIN_SUCCESS", "User logged in", 
                                   ip_address, user_agent, True)
                
                return True, {
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "role": user.role.value,
                        "is_active": user.is_active
                    },
                    "session": {
                        "access_token": session.access_token,
                        "refresh_token": session.refresh_token,
                        "expires_at": session.expires_at.isoformat()
                    }
                }
                
        except Exception as e:
            logger.error(f"Error during login: {e}")
            return False, {"error": "Login failed"}
    
    def _is_rate_limited(self, identifier: str, action: str) -> bool:
        """Check if identifier is rate limited for action"""
        now = datetime.now(timezone.utc)
        key = f"{identifier}:{action}"
        
        if key not in self.login_attempts:
            self.login_attempts[key] = []
        
        # Remove old attempts (older than 1 minute)
        self.login_attempts[key] = [
            attempt for attempt in self.login_attempts[key]
            if now - attempt < timedelta(minutes=1)
        ]
        
        return len(self.login_attempts[key]) >= 10  # Max 10 attempts per minute
    
    def _track_login_attempt(self, identifier: str, action: str, success: bool):
        """Track login attempt for rate limiting"""
        now = datetime.now(timezone.utc)
        key = f"{identifier}:{action}"
        
        if key not in self.login_attempts:
            self.login_attempts[key] = []
        
        if not success:
            self.login_attempts[key].append(now)
    
    def _create_session(self, user_id: str, ip_address: str, user_agent: str) -> Session:
        """Create new session"""
        session_id = str(uuid.uuid4())
        access_token = self._generate_jwt_token(user_id, "access")
        refresh_token = self._generate_jwt_token(user_id, "refresh")
        
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        
        session = Session(
            id=session_id,
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            status=SessionStatus.ACTIVE,
            created_at=now,
            expires_at=expires_at,
            last_activity=now,
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        # Save to database
        with self.db.get_connection() as conn:
            conn.execute("""
                INSERT INTO sessions 
                (id, user_id, access_token, refresh_token, status, expires_at, 
                 last_activity, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session.id, session.user_id, session.access_token, session.refresh_token,
                session.status.value, session.expires_at, session.last_activity,
                session.ip_address, session.user_agent
            ))
            conn.commit()
        
        return session
    
    def verify_token(self, credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> Dict[str, Any]:
        """Verify JWT token and return user info"""
        try:
            token = credentials.credentials
            payload = self._verify_jwt_token(token)
            
            # Check if session is still active
            with self.db.get_connection() as conn:
                session_row = conn.execute(
                    "SELECT * FROM sessions WHERE access_token = ? AND status = ?",
                    (token, SessionStatus.ACTIVE.value)
                ).fetchone()
                
                if not session_row:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session not found or expired"
                    )
                
                # Update last activity
                conn.execute(
                    "UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?",
                    (dict(session_row)["id"],)
                )
                conn.commit()
                
                # Get user info
                user_row = conn.execute(
                    "SELECT * FROM users WHERE id = ?",
                    (payload["user_id"],)
                ).fetchone()
                
                if not user_row:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User not found"
                    )
                
                user = dict(user_row)
                return {
                    "user_id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "role": user["role"],
                    "is_active": user["is_active"]
                }
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed"
            )
    
    def require_role(self, required_roles: List[UserRole]):
        """Decorator to require specific roles"""
        def decorator(current_user: Dict = Depends(self.verify_token)):
            user_role = UserRole(current_user["role"])
            if user_role not in required_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            return current_user
        return decorator
    
    def logout(self, token: str) -> bool:
        """Logout user by revoking session"""
        try:
            with self.db.get_connection() as conn:
                conn.execute(
                    "UPDATE sessions SET status = ? WHERE access_token = ?",
                    (SessionStatus.REVOKED.value, token)
                )
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error during logout: {e}")
            return False
    
    def create_api_key(self, user_id: str, name: str, permissions: List[str],
                      expires_at: Optional[datetime] = None) -> Tuple[bool, str, str]:
        """Create API key for user"""
        try:
            # Generate API key
            api_key = f"ctb_{secrets.token_urlsafe(32)}"
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            
            key_id = str(uuid.uuid4())
            
            with self.db.get_connection() as conn:
                conn.execute("""
                    INSERT INTO api_keys 
                    (id, user_id, name, key_hash, permissions, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    key_id, user_id, name, key_hash,
                    ",".join(permissions), expires_at
                ))
                conn.commit()
            
            logger.info(f"✅ API key created for user {user_id}")
            return True, api_key, key_id
            
        except Exception as e:
            logger.error(f"Error creating API key: {e}")
            return False, "", ""
    
    def verify_api_key(self, api_key: str) -> Optional[Dict[str, Any]]:
        """Verify API key and return user info"""
        try:
            key_hash = hashlib.sha256(api_key.encode()).hexdigest()
            
            with self.db.get_connection() as conn:
                key_row = conn.execute("""
                    SELECT ak.*, u.username, u.email, u.role, u.is_active
                    FROM api_keys ak
                    JOIN users u ON ak.user_id = u.id
                    WHERE ak.key_hash = ? AND ak.is_active = TRUE
                """, (key_hash,)).fetchone()
                
                if not key_row:
                    return None
                
                key_data = dict(key_row)
                
                # Check expiration
                if key_data["expires_at"]:
                    expires_at = datetime.fromisoformat(key_data["expires_at"])
                    if expires_at < datetime.now(timezone.utc):
                        return None
                
                # Update usage
                conn.execute("""
                    UPDATE api_keys 
                    SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (key_data["id"],))
                conn.commit()
                
                return {
                    "user_id": key_data["user_id"],
                    "username": key_data["username"],
                    "email": key_data["email"],
                    "role": key_data["role"],
                    "permissions": key_data["permissions"].split(","),
                    "api_key_id": key_data["id"]
                }
                
        except Exception as e:
            logger.error(f"Error verifying API key: {e}")
            return None
    
    def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get active sessions for user"""
        try:
            with self.db.get_connection() as conn:
                rows = conn.execute("""
                    SELECT id, created_at, last_activity, ip_address, user_agent, status
                    FROM sessions 
                    WHERE user_id = ? AND status = ?
                    ORDER BY last_activity DESC
                """, (user_id, SessionStatus.ACTIVE.value)).fetchall()
                
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting user sessions: {e}")
            return []
    
    def revoke_session(self, session_id: str, user_id: str) -> bool:
        """Revoke specific session"""
        try:
            with self.db.get_connection() as conn:
                conn.execute("""
                    UPDATE sessions SET status = ?
                    WHERE id = ? AND user_id = ?
                """, (SessionStatus.REVOKED.value, session_id, user_id))
                conn.commit()
                return True
        except Exception as e:
            logger.error(f"Error revoking session: {e}")
            return False
    
    def cleanup_expired_sessions(self):
        """Cleanup expired sessions"""
        try:
            with self.db.get_connection() as conn:
                conn.execute("""
                    UPDATE sessions SET status = ?
                    WHERE expires_at < CURRENT_TIMESTAMP AND status = ?
                """, (SessionStatus.EXPIRED.value, SessionStatus.ACTIVE.value))
                conn.commit()
        except Exception as e:
            logger.error(f"Error cleaning up sessions: {e}")

# Global auth service instance
auth_service = AuthService()

# Export commonly used dependencies
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    """Get current authenticated user"""
    return auth_service.verify_token(credentials)

def require_admin():
    """Require admin role"""
    return auth_service.require_role([UserRole.ADMIN])

def require_trader():
    """Require trader or admin role"""
    return auth_service.require_role([UserRole.ADMIN, UserRole.TRADER])

def require_viewer():
    """Require any authenticated user"""
    return auth_service.require_role([UserRole.ADMIN, UserRole.TRADER, UserRole.VIEWER])