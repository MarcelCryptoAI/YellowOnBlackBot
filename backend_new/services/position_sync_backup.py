#!/usr/bin/env python3
"""
Position Synchronization Service - CTB Trading Bot
Real-time synchronization van live positions tussen ByBit en frontend
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import time

from pybit.unified_trading import HTTP
from .database import get_database
from .websocket_server import websocket_server

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PositionSyncService:
    """
    Service voor real-time position synchronization
    """
    
    def __init__(self):
        self.active_connections: Dict[str, HTTP] = {}
        self.current_positions: Dict[str, Dict[str, Any]] = {}
        self.is_running = False
        self.sync_task = None
        
        # Sync statistics
        self.stats = {
            'positions_synced': 0,
            'sync_errors': 0,
            'last_sync': None,
            'start_time': datetime.now(timezone.utc)
        }
        
        # Position change tracking
        self.position_changes = []
        
    async def start_sync(self, connections: Dict[str, HTTP]):
        """Start position synchronization"""
        if self.is_running:
            logger.warning("Position sync is al actief")
            return
            
        self.active_connections = connections
        self.is_running = True
        
        logger.info("🔄 Position synchronization gestart")
        
        # Start sync loop
        self.sync_task = asyncio.create_task(self._sync_loop())
        
        # Initial sync
        await self._sync_all_positions()
    
    async def stop_sync(self):
        """Stop position synchronization"""
        self.is_running = False
        
        if self.sync_task:
            self.sync_task.cancel()
            
        logger.info("🛑 Position synchronization gestopt")
    
    async def _sync_loop(self):
        """Main synchronization loop"""
        while self.is_running:
            try:
                await self._sync_all_positions()
                await asyncio.sleep(5)  # Sync every 5 seconds
                
            except Exception as e:
                logger.error(f"Error in position sync loop: {e}")
                self.stats['sync_errors'] += 1
                await asyncio.sleep(10)
    
    async def _sync_all_positions(self):
        """Sync positions from all connections"""
        try:
            all_positions = {}
            
            for connection_id, session in self.active_connections.items():
                positions = await self._fetch_positions(connection_id, session)
                if positions:
                    all_positions[connection_id] = positions
            
            # Check for changes
            changes = self._detect_position_changes(all_positions)
            
            if changes:
                # Update database
                await self._update_positions_in_db(changes)
                
                # Broadcast changes
                await self._broadcast_position_changes(changes)
            
            # Update current positions
            self.current_positions = all_positions
            self.stats['last_sync'] = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error syncing positions: {e}")
            self.stats['sync_errors'] += 1
    
    async def _fetch_positions(self, connection_id: str, session: HTTP) -> List[Dict[str, Any]]:
        """Fetch positions from ByBit"""
        try:
            result = session.get_positions(category="linear")
            
            if result['retCode'] == 0:
                positions = []
                
                for pos in result['result']['list']:
                    if float(pos['size']) > 0:  # Only positions with size > 0
                        position = {
                            'connection_id': connection_id,
                            'symbol': pos['symbol'],
                            'side': pos['side'],
                            'size': float(pos['size']),
                            'entry_price': float(pos['avgPrice']) if pos['avgPrice'] else 0,
                            'mark_price': float(pos['markPrice']) if pos['markPrice'] else 0,
                            'unrealized_pnl': float(pos['unrealisedPnl']),
                            'percentage': float(pos['unrealisedPnl']) / float(pos['positionValue']) * 100 if float(pos['positionValue']) > 0 else 0,
                            'leverage': float(pos['leverage']) if pos['leverage'] else 1,
                            'position_value': float(pos['positionValue']),
                            'take_profit': float(pos['takeProfit']) if pos['takeProfit'] else None,
                            'stop_loss': float(pos['stopLoss']) if pos['stopLoss'] else None,
                            'margin_mode': pos.get('tradeMode', 'cross'),
                            'position_status': pos.get('positionStatus', 'Normal'),
                            'created_time': pos.get('createdTime'),
                            'updated_time': pos.get('updatedTime'),
                            'last_sync': datetime.now(timezone.utc).isoformat()
                        }
                        
                        positions.append(position)
                
                return positions
            else:
                logger.error(f"Failed to fetch positions for {connection_id}: {result}")
                return []
                
        except Exception as e:
            logger.error(f"Error fetching positions for {connection_id}: {e}")
            return []
    
    def _detect_position_changes(self, new_positions: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Detect changes in positions"""
        changes = []
        
        try:
            # Check for new/updated positions
            for connection_id, positions in new_positions.items():
                old_positions = self.current_positions.get(connection_id, [])
                old_pos_map = {pos['symbol']: pos for pos in old_positions}
                
                for new_pos in positions:
                    symbol = new_pos['symbol']
                    old_pos = old_pos_map.get(symbol)
                    
                    if not old_pos:
                        # New position
                        changes.append({
                            'type': 'NEW',
                            'connection_id': connection_id,
                            'position': new_pos
                        })
                    else:
                        # Check for significant changes
                        if self._has_significant_change(old_pos, new_pos):
                            changes.append({
                                'type': 'UPDATED',
                                'connection_id': connection_id,
                                'old_position': old_pos,
                                'new_position': new_pos
                            })
            
            # Check for closed positions
            for connection_id, old_positions in self.current_positions.items():
                new_positions_for_conn = new_positions.get(connection_id, [])
                new_symbols = {pos['symbol'] for pos in new_positions_for_conn}
                
                for old_pos in old_positions:
                    if old_pos['symbol'] not in new_symbols:
                        # Position closed
                        changes.append({
                            'type': 'CLOSED',
                            'connection_id': connection_id,
                            'position': old_pos
                        })
            
            return changes
            
        except Exception as e:
            logger.error(f"Error detecting position changes: {e}")
            return []
    
    def _has_significant_change(self, old_pos: Dict[str, Any], new_pos: Dict[str, Any]) -> bool:
        """Check if position has significant changes"""
        # Check for changes in key metrics
        thresholds = {
            'size': 0.001,  # 0.1% change in size
            'unrealized_pnl': 0.01,  # $0.01 change in PnL
            'mark_price': 0.01,  # $0.01 change in price
            'percentage': 0.01  # 0.01% change in percentage
        }
        
        for field, threshold in thresholds.items():
            old_val = old_pos.get(field, 0)
            new_val = new_pos.get(field, 0)
            
            if abs(new_val - old_val) > threshold:
                return True
        
        return False
    
    async def _update_positions_in_db(self, changes: List[Dict[str, Any]]):
        """Update positions in database"""
        try:\n            db = get_database()\n            \n            for change in changes:\n                position = change.get('new_position') or change['position']\n                \n                if change['type'] in ['NEW', 'UPDATED']:\n                    # Save/update position\n                    position_data = {\n                        'id': f\"pos_{position['connection_id']}_{position['symbol']}\",\n                        'connection_id': position['connection_id'],\n                        'symbol': position['symbol'],\n                        'side': position['side'].lower(),\n                        'size': position['size'],\n                        'entry_price': position['entry_price'],\n                        'current_price': position['mark_price'],\n                        'unrealized_pnl': position['unrealized_pnl'],\n                        'leverage': position['leverage'],\n                        'margin_mode': position['margin_mode'],\n                        'take_profit': position['take_profit'],\n                        'stop_loss': position['stop_loss'],\n                        'status': 'OPEN',\n                        'metadata': position\n                    }\n                    \n                    db.save_position(position_data)\n                    \n                elif change['type'] == 'CLOSED':\n                    # Mark position as closed\n                    position_data = {\n                        'id': f\"pos_{position['connection_id']}_{position['symbol']}\",\n                        'connection_id': position['connection_id'],\n                        'symbol': position['symbol'],\n                        'side': position['side'].lower(),\n                        'size': 0,\n                        'entry_price': position['entry_price'],\n                        'current_price': position['mark_price'],\n                        'unrealized_pnl': 0,\n                        'realized_pnl': position['unrealized_pnl'],  # Final PnL\n                        'leverage': position['leverage'],\n                        'status': 'CLOSED',\n                        'closed_at': datetime.now(timezone.utc).isoformat(),\n                        'metadata': position\n                    }\n                    \n                    db.save_position(position_data)\n            \n            self.stats['positions_synced'] += len(changes)\n            \n        except Exception as e:\n            logger.error(f\"Error updating positions in database: {e}\")\n    \n    async def _broadcast_position_changes(self, changes: List[Dict[str, Any]]):\n        \"\"\"Broadcast position changes to WebSocket clients\"\"\"\n        try:\n            for change in changes:\n                await websocket_server.broadcast_to_subscription('position_updates', {\n                    'type': 'position_change',\n                    'change_type': change['type'],\n                    'connection_id': change['connection_id'],\n                    'position': change.get('new_position') or change['position'],\n                    'timestamp': datetime.now(timezone.utc).isoformat()\n                })\n            \n            # Also broadcast summary\n            summary = self.get_position_summary()\n            await websocket_server.broadcast_to_subscription('portfolio_updates', {\n                'type': 'portfolio_summary',\n                'summary': summary,\n                'timestamp': datetime.now(timezone.utc).isoformat()\n            })\n            \n        except Exception as e:\n            logger.error(f\"Error broadcasting position changes: {e}\")\n    \n    def get_all_positions(self) -> Dict[str, List[Dict[str, Any]]]:\n        \"\"\"Get all current positions\"\"\"\n        return self.current_positions.copy()\n    \n    def get_positions_for_connection(self, connection_id: str) -> List[Dict[str, Any]]:\n        \"\"\"Get positions for specific connection\"\"\"\n        return self.current_positions.get(connection_id, [])\n    \n    def get_position_summary(self) -> Dict[str, Any]:\n        \"\"\"Get position summary statistics\"\"\"\n        try:\n            total_positions = 0\n            total_unrealized_pnl = 0\n            total_position_value = 0\n            winning_positions = 0\n            losing_positions = 0\n            \n            for positions in self.current_positions.values():\n                for pos in positions:\n                    total_positions += 1\n                    total_unrealized_pnl += pos['unrealized_pnl']\n                    total_position_value += pos['position_value']\n                    \n                    if pos['unrealized_pnl'] > 0:\n                        winning_positions += 1\n                    elif pos['unrealized_pnl'] < 0:\n                        losing_positions += 1\n            \n            return {\n                'total_positions': total_positions,\n                'winning_positions': winning_positions,\n                'losing_positions': losing_positions,\n                'total_unrealized_pnl': total_unrealized_pnl,\n                'total_position_value': total_position_value,\n                'win_rate': winning_positions / total_positions if total_positions > 0 else 0,\n                'last_sync': self.stats['last_sync'].isoformat() if self.stats['last_sync'] else None\n            }\n            \n        except Exception as e:\n            logger.error(f\"Error calculating position summary: {e}\")\n            return {}\n    \n    def get_stats(self) -> Dict[str, Any]:\n        \"\"\"Get sync statistics\"\"\"\n        uptime = (datetime.now(timezone.utc) - self.stats['start_time']).total_seconds()\n        \n        return {\n            **self.stats,\n            'is_running': self.is_running,\n            'active_connections': len(self.active_connections),\n            'total_positions': sum(len(positions) for positions in self.current_positions.values()),\n            'uptime_seconds': uptime,\n            'last_sync_iso': self.stats['last_sync'].isoformat() if self.stats['last_sync'] else None\n        }\n    \n    async def force_sync(self):\n        \"\"\"Force immediate synchronization\"\"\"\n        logger.info(\"🔄 Forcing position sync...\")\n        await self._sync_all_positions()\n    \n    async def close_position(self, connection_id: str, symbol: str, quantity: Optional[float] = None) -> bool:\n        \"\"\"Close position via API\"\"\"\n        try:\n            if connection_id not in self.active_connections:\n                logger.error(f\"Connection {connection_id} not found\")\n                return False\n            \n            session = self.active_connections[connection_id]\n            \n            # Get current position to determine close parameters\n            current_positions = self.get_positions_for_connection(connection_id)\n            position = next((p for p in current_positions if p['symbol'] == symbol), None)\n            \n            if not position:\n                logger.error(f\"Position {symbol} not found for {connection_id}\")\n                return False\n            \n            # Close position\n            close_qty = quantity or position['size']\n            close_side = \"Sell\" if position['side'].lower() == \"buy\" else \"Buy\"\n            \n            result = session.place_order(\n                category=\"linear\",\n                symbol=symbol,\n                side=close_side,\n                orderType=\"Market\",\n                qty=str(close_qty),\n                reduceOnly=True,\n                timeInForce=\"IOC\"\n            )\n            \n            if result['retCode'] == 0:\n                logger.info(f\"✅ Position {symbol} close order placed: {result['result']['orderId']}\")\n                \n                # Force sync to update positions\n                await asyncio.sleep(1)  # Wait for order execution\n                await self.force_sync()\n                \n                return True\n            else:\n                logger.error(f\"❌ Failed to close position {symbol}: {result}\")\n                return False\n                \n        except Exception as e:\n            logger.error(f\"Error closing position {symbol}: {e}\")\n            return False\n\n# Global position sync instance\nposition_sync = PositionSyncService()"}