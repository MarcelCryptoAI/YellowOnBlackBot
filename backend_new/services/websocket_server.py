#!/usr/bin/env python3
"""
WebSocket Server for Real-time Communication
Handles real-time updates between backend services and frontend
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Any
import websockets
from websockets.server import WebSocketServerProtocol

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    """
    WebSocket server voor real-time communicatie met frontend
    """
    
    def __init__(self, host: str = "localhost", port: int = 8001):
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.subscriptions: Dict[str, Set[WebSocketServerProtocol]] = {
            'market_data': set(),
            'strategy_updates': set(),
            'risk_alerts': set(),
            'monitoring_alerts': set(),
            'system_health': set(),
        }
        self.client_info: Dict[WebSocketServerProtocol, Dict[str, Any]] = {}
        
        # Statistics
        self.stats = {
            'connections': 0,
            'messages_sent': 0,
            'messages_received': 0,
            'start_time': datetime.now(timezone.utc)
        }
    
    async def start_server(self):
        """Start WebSocket server"""
        logger.info(f"🔌 Starting WebSocket server on {self.host}:{self.port}")
        
        start_server = websockets.serve(
            self.handle_client,
            self.host,
            self.port,
            ping_interval=30,
            ping_timeout=10,
            max_size=1024*1024,  # 1MB
            max_queue=32
        )
        
        await start_server
        logger.info(f"✅ WebSocket server running on ws://{self.host}:{self.port}")
    
    async def handle_client(self, websocket: WebSocketServerProtocol, path: str):
        """Handle nieuwe client connectie"""
        self.clients.add(websocket)
        self.client_info[websocket] = {
            'connected_at': datetime.now(timezone.utc),
            'subscriptions': set(),
            'remote_address': websocket.remote_address
        }
        self.stats['connections'] += 1
        
        logger.info(f"🔗 Client connected: {websocket.remote_address}")
        
        try:
            # Send welcome message
            await self.send_to_client(websocket, {
                'type': 'connection_established',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'message': 'Welcome to CTB Trading Bot WebSocket'
            })
            
            # Handle messages
            async for message in websocket:
                await self.handle_message(websocket, message)
                
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"🔌 Client disconnected: {websocket.remote_address}")
        except Exception as e:
            logger.error(f"❌ Error handling client {websocket.remote_address}: {e}")
        finally:
            await self.cleanup_client(websocket)
    
    async def handle_message(self, websocket: WebSocketServerProtocol, message: str):
        """Handle incoming message from client"""
        try:
            data = json.loads(message)
            self.stats['messages_received'] += 1
            
            message_type = data.get('type')
            
            if message_type == 'subscribe_market_data':
                symbols = data.get('symbols', [])
                await self.subscribe_client(websocket, 'market_data')
                logger.info(f"Client {websocket.remote_address} subscribed to market data for {symbols}")
                
            elif message_type == 'unsubscribe_market_data':
                await self.unsubscribe_client(websocket, 'market_data')
                logger.info(f"Client {websocket.remote_address} unsubscribed from market data")
                
            elif message_type == 'subscribe_strategy':
                strategy_id = data.get('strategy_id')
                await self.subscribe_client(websocket, 'strategy_updates')
                logger.info(f"Client {websocket.remote_address} subscribed to strategy {strategy_id}")
                
            elif message_type == 'unsubscribe_strategy':
                await self.unsubscribe_client(websocket, 'strategy_updates')
                
            elif message_type == 'subscribe_risk_alerts':
                await self.subscribe_client(websocket, 'risk_alerts')
                logger.info(f"Client {websocket.remote_address} subscribed to risk alerts")
                
            elif message_type == 'subscribe_monitoring_alerts':
                await self.subscribe_client(websocket, 'monitoring_alerts')
                logger.info(f"Client {websocket.remote_address} subscribed to monitoring alerts")
                
            elif message_type == 'ping':
                await self.send_to_client(websocket, {
                    'type': 'pong',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })
                
            else:
                logger.warning(f"Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON from client {websocket.remote_address}: {message}")
        except Exception as e:
            logger.error(f"Error handling message from {websocket.remote_address}: {e}")
    
    async def subscribe_client(self, websocket: WebSocketServerProtocol, subscription_type: str):
        """Subscribe client to updates"""
        if subscription_type in self.subscriptions:
            self.subscriptions[subscription_type].add(websocket)
            self.client_info[websocket]['subscriptions'].add(subscription_type)
    
    async def unsubscribe_client(self, websocket: WebSocketServerProtocol, subscription_type: str):
        """Unsubscribe client from updates"""
        if subscription_type in self.subscriptions:
            self.subscriptions[subscription_type].discard(websocket)
            self.client_info[websocket]['subscriptions'].discard(subscription_type)
    
    async def cleanup_client(self, websocket: WebSocketServerProtocol):
        """Cleanup when client disconnects"""
        self.clients.discard(websocket)
        
        # Remove from all subscriptions
        for subscription_set in self.subscriptions.values():
            subscription_set.discard(websocket)
        
        # Remove client info
        self.client_info.pop(websocket, None)
    
    async def send_to_client(self, websocket: WebSocketServerProtocol, data: Dict[str, Any]):
        """Send data to specific client"""
        try:
            message = json.dumps(data, default=str)
            await websocket.send(message)
            self.stats['messages_sent'] += 1
        except Exception as e:
            logger.error(f"Error sending to client {websocket.remote_address}: {e}")
    
    async def broadcast_to_subscription(self, subscription_type: str, data: Dict[str, Any]):
        """Broadcast data to all subscribers of a type"""
        if subscription_type not in self.subscriptions:
            return
        
        subscribers = self.subscriptions[subscription_type].copy()
        if not subscribers:
            return
        
        message = json.dumps(data, default=str)
        disconnected_clients = []
        
        for client in subscribers:
            try:
                await client.send(message)
                self.stats['messages_sent'] += 1
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.append(client)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected_clients.append(client)
        
        # Cleanup disconnected clients
        for client in disconnected_clients:
            await self.cleanup_client(client)
    
    async def broadcast_to_all(self, data: Dict[str, Any]):
        """Broadcast data to all connected clients"""
        if not self.clients:
            return
        
        message = json.dumps(data, default=str)
        disconnected_clients = []
        
        for client in self.clients.copy():
            try:
                await client.send(message)
                self.stats['messages_sent'] += 1
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.append(client)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected_clients.append(client)
        
        # Cleanup disconnected clients
        for client in disconnected_clients:
            await self.cleanup_client(client)
    
    # Event broadcasting methods for integration with other services
    
    async def broadcast_market_update(self, data: Dict[str, Any]):
        """Broadcast market data update"""
        await self.broadcast_to_subscription('market_data', {
            'type': 'market_update',
            'data': data,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_price_change(self, symbol: str, price: float, change: float):
        """Broadcast price change"""
        await self.broadcast_to_subscription('market_data', {
            'type': 'price_change',
            'symbol': symbol,
            'price': price,
            'change': change,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_strategy_signal(self, strategy_id: str, signal: Dict[str, Any]):
        """Broadcast strategy signal"""
        await self.broadcast_to_subscription('strategy_updates', {
            'type': 'strategy_signal',
            'strategy_id': strategy_id,
            'signal': signal,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_strategy_execution(self, strategy_id: str, execution: Dict[str, Any]):
        """Broadcast strategy execution"""
        await self.broadcast_to_subscription('strategy_updates', {
            'type': 'strategy_execution',
            'strategy_id': strategy_id,
            'execution': execution,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_strategy_status_change(self, strategy_id: str, status: str):
        """Broadcast strategy status change"""
        await self.broadcast_to_subscription('strategy_updates', {
            'type': 'strategy_status_change',
            'strategy_id': strategy_id,
            'status': status,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_risk_alert(self, alert: Dict[str, Any]):
        """Broadcast risk alert"""
        await self.broadcast_to_subscription('risk_alerts', {
            'type': 'risk_alert',
            'alert': alert,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_emergency_stop(self, reason: str):
        """Broadcast emergency stop"""
        await self.broadcast_to_all({
            'type': 'emergency_stop',
            'reason': reason,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_portfolio_update(self, metrics: Dict[str, Any]):
        """Broadcast portfolio update"""
        await self.broadcast_to_subscription('risk_alerts', {
            'type': 'portfolio_update',
            'metrics': metrics,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_system_health_update(self, health: Dict[str, Any]):
        """Broadcast system health update"""
        await self.broadcast_to_subscription('monitoring_alerts', {
            'type': 'system_health_update',
            'health': health,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_alert_created(self, alert: Dict[str, Any]):
        """Broadcast new alert created"""
        await self.broadcast_to_subscription('monitoring_alerts', {
            'type': 'alert_created',
            'alert': alert,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_alert_resolved(self, alert_id: str):
        """Broadcast alert resolved"""
        await self.broadcast_to_subscription('monitoring_alerts', {
            'type': 'alert_resolved',
            'alert_id': alert_id,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    def get_stats(self) -> Dict[str, Any]:
        """Get server statistics"""
        uptime = (datetime.now(timezone.utc) - self.stats['start_time']).total_seconds()
        
        return {
            'connected_clients': len(self.clients),
            'total_connections': self.stats['connections'],
            'messages_sent': self.stats['messages_sent'],
            'messages_received': self.stats['messages_received'],
            'uptime_seconds': uptime,
            'subscriptions': {
                subscription_type: len(subscribers) 
                for subscription_type, subscribers in self.subscriptions.items()
            },
            'start_time': self.stats['start_time'].isoformat()
        }

# Global WebSocket server instance
websocket_server = WebSocketServer()

async def start_websocket_server():
    """Start the WebSocket server"""
    await websocket_server.start_server()

# Integration functions for other services
async def notify_market_update(data: Dict[str, Any]):
    """Notify clients of market data update"""
    await websocket_server.broadcast_market_update(data)

async def notify_strategy_signal(strategy_id: str, signal: Dict[str, Any]):
    """Notify clients of strategy signal"""
    await websocket_server.broadcast_strategy_signal(strategy_id, signal)

async def notify_strategy_execution(strategy_id: str, execution: Dict[str, Any]):
    """Notify clients of strategy execution"""
    await websocket_server.broadcast_strategy_execution(strategy_id, execution)

async def notify_risk_alert(alert: Dict[str, Any]):
    """Notify clients of risk alert"""
    await websocket_server.broadcast_risk_alert(alert)

async def notify_emergency_stop(reason: str):
    """Notify all clients of emergency stop"""
    await websocket_server.broadcast_emergency_stop(reason)

async def notify_system_health(health: Dict[str, Any]):
    """Notify clients of system health update"""
    await websocket_server.broadcast_system_health_update(health)

async def notify_alert_created(alert: Dict[str, Any]):
    """Notify clients of new alert"""
    await websocket_server.broadcast_alert_created(alert)

if __name__ == "__main__":
    asyncio.run(start_websocket_server())