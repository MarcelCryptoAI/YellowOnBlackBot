#!/usr/bin/env python3
"""
WebSocket Service voor real-time data streaming
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect

from config.settings import settings

logger = logging.getLogger(__name__)

class WebSocketService:
    """WebSocket service voor real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_subscriptions: Dict[str, Set[str]] = {}  # websocket_id -> set of connection_ids
        self.broadcast_tasks: Set[asyncio.Task] = set()
        
    async def initialize(self):
        """Initialize WebSocket service"""
        logger.info("🔗 Initializing WebSocket service...")
        logger.info("✅ WebSocket service initialized")
    
    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        try:
            await websocket.accept()
            
            # Generate unique connection ID
            connection_id = f"ws_{datetime.utcnow().timestamp()}"
            
            self.active_connections[connection_id] = websocket
            self.connection_subscriptions[connection_id] = set()
            
            logger.info(f"📱 New WebSocket connection: {connection_id}")
            
            # Handle messages from this connection
            await self._handle_connection(connection_id, websocket)
            
        except Exception as e:
            logger.error(f"❌ WebSocket connection error: {e}")
    
    async def _handle_connection(self, connection_id: str, websocket: WebSocket):
        """Handle messages from WebSocket connection"""
        try:
            while True:
                # Receive message from client
                data = await websocket.receive_text()
                
                try:
                    message = json.loads(data)
                    await self._handle_message(connection_id, message)
                except json.JSONDecodeError:
                    await self._send_error(websocket, "Invalid JSON format")
                except Exception as e:
                    await self._send_error(websocket, f"Message handling error: {str(e)}")
                    
        except WebSocketDisconnect:
            logger.info(f"📱 WebSocket disconnected: {connection_id}")
        except Exception as e:
            logger.error(f"❌ WebSocket error for {connection_id}: {e}")
        finally:
            await self._cleanup_connection(connection_id)
    
    async def _handle_message(self, websocket_id: str, message: Dict[str, Any]):
        """Handle incoming WebSocket message"""
        try:
            msg_type = message.get("type")
            
            if msg_type == "subscribe_connection":
                connection_id = message.get("connection_id")
                if connection_id:
                    self.connection_subscriptions[websocket_id].add(connection_id)
                    logger.debug(f"📡 WebSocket {websocket_id} subscribed to connection {connection_id}")
                    
            elif msg_type == "unsubscribe_connection":
                connection_id = message.get("connection_id")
                if connection_id:
                    self.connection_subscriptions[websocket_id].discard(connection_id)
                    logger.debug(f"📡 WebSocket {websocket_id} unsubscribed from connection {connection_id}")
                    
            elif msg_type == "ping":
                websocket = self.active_connections.get(websocket_id)
                if websocket:
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    }))
                    
            else:
                logger.warning(f"⚠️ Unknown message type: {msg_type}")
                
        except Exception as e:
            logger.error(f"❌ Failed to handle message: {e}")
    
    async def _send_error(self, websocket: WebSocket, error_message: str):
        """Send error message to WebSocket"""
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "message": error_message,
                "timestamp": datetime.utcnow().isoformat()
            }))
        except Exception as e:
            logger.error(f"❌ Failed to send error message: {e}")
    
    async def _cleanup_connection(self, connection_id: str):
        """Clean up disconnected WebSocket"""
        try:
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]
            
            if connection_id in self.connection_subscriptions:
                del self.connection_subscriptions[connection_id]
                
            logger.debug(f"🧹 Cleaned up WebSocket connection: {connection_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to cleanup connection {connection_id}: {e}")
    
    async def broadcast_market_data(self, market_data: Dict[str, Any]):
        """Broadcast market data to all connected clients"""
        if not self.active_connections:
            return
        
        message = {
            "type": "market_data",
            "data": market_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self._broadcast_to_all(message)
    
    async def broadcast_connection_update(self, connection_id: str, data: Dict[str, Any]):
        """Broadcast connection-specific data to subscribed clients"""
        if not self.active_connections:
            return
        
        message = {
            "type": "connection_update",
            "connection_id": connection_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to clients subscribed to this connection
        subscribers = [
            ws_id for ws_id, subscriptions in self.connection_subscriptions.items()
            if connection_id in subscriptions
        ]
        
        await self._broadcast_to_specific(message, subscribers)
    
    async def broadcast_portfolio_summary(self, summary: Dict[str, Any]):
        """Broadcast portfolio summary to all clients"""
        if not self.active_connections:
            return
        
        message = {
            "type": "portfolio_summary",
            "data": summary,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self._broadcast_to_all(message)
    
    async def _broadcast_to_all(self, message: Dict[str, Any]):
        """Broadcast message to all connected clients"""
        if not self.active_connections:
            return
        
        message_text = json.dumps(message)
        
        # Create tasks for all broadcasts
        tasks = []
        for ws_id, websocket in self.active_connections.items():
            task = asyncio.create_task(self._send_safe(ws_id, websocket, message_text))
            tasks.append(task)
        
        # Execute all broadcasts concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _broadcast_to_specific(self, message: Dict[str, Any], websocket_ids: list):
        """Broadcast message to specific WebSocket connections"""
        if not websocket_ids:
            return
        
        message_text = json.dumps(message)
        
        # Create tasks for specific broadcasts
        tasks = []
        for ws_id in websocket_ids:
            if ws_id in self.active_connections:
                websocket = self.active_connections[ws_id]
                task = asyncio.create_task(self._send_safe(ws_id, websocket, message_text))
                tasks.append(task)
        
        # Execute broadcasts concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    
    async def _send_safe(self, ws_id: str, websocket: WebSocket, message: str):
        """Safely send message to WebSocket (handles disconnections)"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.warning(f"⚠️ Failed to send to WebSocket {ws_id}: {e}")
            # Remove disconnected WebSocket
            await self._cleanup_connection(ws_id)
    
    def get_connection_count(self) -> int:
        """Get number of active WebSocket connections"""
        return len(self.active_connections)
    
    def get_subscription_info(self) -> Dict[str, Any]:
        """Get WebSocket subscription information"""
        return {
            "active_connections": len(self.active_connections),
            "total_subscriptions": sum(len(subs) for subs in self.connection_subscriptions.values()),
            "connections": {
                ws_id: list(subs) for ws_id, subs in self.connection_subscriptions.items()
            }
        }
    
    def is_healthy(self) -> bool:
        """Check if WebSocket service is healthy"""
        try:
            # Basic health check
            return True
        except Exception as e:
            logger.error(f"❌ WebSocket health check failed: {e}")
            return False
    
    async def cleanup(self):
        """Cleanup WebSocket service"""
        try:
            logger.info("🧹 Cleaning up WebSocket service...")
            
            # Cancel all broadcast tasks
            for task in self.broadcast_tasks:
                task.cancel()
            
            if self.broadcast_tasks:
                await asyncio.gather(*self.broadcast_tasks, return_exceptions=True)
            
            # Close all WebSocket connections
            close_tasks = []
            for ws_id, websocket in self.active_connections.items():
                try:
                    close_tasks.append(websocket.close())
                except Exception as e:
                    logger.error(f"Error closing WebSocket {ws_id}: {e}")
            
            if close_tasks:
                await asyncio.gather(*close_tasks, return_exceptions=True)
            
            self.active_connections.clear()
            self.connection_subscriptions.clear()
            self.broadcast_tasks.clear()
            
            logger.info("✅ WebSocket service cleanup completed")
            
        except Exception as e:
            logger.error(f"❌ WebSocket cleanup failed: {e}")