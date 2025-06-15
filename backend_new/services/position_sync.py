import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from services.database import get_database
from services.websocket_server import websocket_server

logger = logging.getLogger(__name__)

class PositionSyncService:
    def __init__(self):
        self.current_positions: Dict[str, List[Dict[str, Any]]] = {}
        self.active_connections: Dict[str, Any] = {}
        self.is_running = False
        self.sync_interval = 5  # seconds
        self.stats = {
            'total_syncs': 0,
            'positions_synced': 0,
            'last_sync': None,
            'errors': 0,
            'start_time': datetime.now(timezone.utc)
        }

    async def start(self):
        """Start the position sync service"""
        if self.is_running:
            logger.warning("Position sync already running")
            return
        
        self.is_running = True
        logger.info("🚀 Position sync service started")
        
        # Start sync loop
        asyncio.create_task(self._sync_loop())

    async def stop(self):
        """Stop the position sync service"""
        self.is_running = False
        logger.info("🛑 Position sync service stopped")

    async def add_connection(self, connection_id: str, session: Any):
        """Add a connection to sync"""
        self.active_connections[connection_id] = session
        self.current_positions[connection_id] = []
        logger.info(f"📡 Added connection {connection_id} to position sync")

    async def remove_connection(self, connection_id: str):
        """Remove a connection from sync"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.current_positions:
            del self.current_positions[connection_id]
        logger.info(f"🔌 Removed connection {connection_id} from position sync")

    async def _sync_loop(self):
        """Main sync loop"""
        while self.is_running:
            try:
                await self._sync_all_positions()
                await asyncio.sleep(self.sync_interval)
            except Exception as e:
                logger.error(f"Error in position sync loop: {e}")
                self.stats['errors'] += 1
                await asyncio.sleep(self.sync_interval)

    async def _sync_all_positions(self):
        """Sync positions for all connections"""
        if not self.active_connections:
            return
        
        logger.debug(f"🔄 Syncing positions for {len(self.active_connections)} connections")
        
        try:
            # Get fresh positions from all connections
            new_positions = await self._fetch_all_positions()
            
            # Detect changes
            changes = self._detect_position_changes(new_positions)
            
            if changes:
                logger.info(f"📊 Detected {len(changes)} position changes")
                
                # Update database
                await self._update_positions_in_db(changes)
                
                # Broadcast changes
                await self._broadcast_position_changes(changes)
            
            # Update current positions
            self.current_positions = new_positions
            
            # Update stats
            self.stats['total_syncs'] += 1
            self.stats['last_sync'] = datetime.now(timezone.utc)
            
        except Exception as e:
            logger.error(f"Error syncing positions: {e}")
            self.stats['errors'] += 1

    async def _fetch_all_positions(self) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch positions from all connections"""
        positions = {}
        
        for connection_id, session in self.active_connections.items():
            try:
                result = session.get_positions(
                    category="linear",
                    settleCoin="USDT"
                )
                
                if result['retCode'] == 0:
                    raw_positions = result['result']['list']
                    processed_positions = []
                    
                    for pos in raw_positions:
                        if float(pos['size']) > 0:  # Only active positions
                            processed_position = {
                                'connection_id': connection_id,
                                'symbol': pos['symbol'],
                                'side': pos['side'],
                                'size': float(pos['size']),
                                'entry_price': float(pos['avgPrice']),
                                'mark_price': float(pos['markPrice']),
                                'unrealized_pnl': float(pos['unrealisedPnl']),
                                'position_value': float(pos['positionValue']),
                                'leverage': float(pos['leverage']),
                                'margin_mode': pos['tradeMode'],
                                'take_profit': float(pos['takeProfit']) if pos['takeProfit'] else None,
                                'stop_loss': float(pos['stopLoss']) if pos['stopLoss'] else None,
                                'percentage': float(pos['unrealisedPnl']) / float(pos['positionValue']) * 100 if float(pos['positionValue']) > 0 else 0,
                                'last_updated': datetime.now(timezone.utc).isoformat()
                            }
                            processed_positions.append(processed_position)
                    
                    positions[connection_id] = processed_positions
                    logger.debug(f"📊 {connection_id}: {len(processed_positions)} positions")
                else:
                    logger.error(f"Failed to fetch positions for {connection_id}: {result}")
                    positions[connection_id] = []
                    
            except Exception as e:
                logger.error(f"Error fetching positions for {connection_id}: {e}")
                positions[connection_id] = []
        
        return positions

    def _detect_position_changes(self, new_positions: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Detect changes in positions"""
        changes = []
        
        try:
            # Check for new and updated positions
            for connection_id, new_positions_for_conn in new_positions.items():
                old_positions_for_conn = self.current_positions.get(connection_id, [])
                old_symbols = {pos['symbol']: pos for pos in old_positions_for_conn}
                
                for new_pos in new_positions_for_conn:
                    symbol = new_pos['symbol']
                    old_pos = old_symbols.get(symbol)
                    
                    if old_pos is None:
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
        try:
            db = get_database()
            
            for change in changes:
                position = change.get('new_position') or change['position']
                
                if change['type'] in ['NEW', 'UPDATED']:
                    # Save/update position
                    position_data = {
                        'id': f"pos_{position['connection_id']}_{position['symbol']}",
                        'connection_id': position['connection_id'],
                        'symbol': position['symbol'],
                        'side': position['side'].lower(),
                        'size': position['size'],
                        'entry_price': position['entry_price'],
                        'current_price': position['mark_price'],
                        'unrealized_pnl': position['unrealized_pnl'],
                        'leverage': position['leverage'],
                        'margin_mode': position['margin_mode'],
                        'take_profit': position['take_profit'],
                        'stop_loss': position['stop_loss'],
                        'status': 'OPEN',
                        'metadata': position
                    }
                    
                    db.save_position(position_data)
                    
                elif change['type'] == 'CLOSED':
                    # Mark position as closed
                    position_data = {
                        'id': f"pos_{position['connection_id']}_{position['symbol']}",
                        'connection_id': position['connection_id'],
                        'symbol': position['symbol'],
                        'side': position['side'].lower(),
                        'size': 0,
                        'entry_price': position['entry_price'],
                        'current_price': position['mark_price'],
                        'unrealized_pnl': 0,
                        'realized_pnl': position['unrealized_pnl'],  # Final PnL
                        'leverage': position['leverage'],
                        'status': 'CLOSED',
                        'closed_at': datetime.now(timezone.utc).isoformat(),
                        'metadata': position
                    }
                    
                    db.save_position(position_data)
            
            self.stats['positions_synced'] += len(changes)
            
        except Exception as e:
            logger.error(f"Error updating positions in database: {e}")
    
    async def _broadcast_position_changes(self, changes: List[Dict[str, Any]]):
        """Broadcast position changes to WebSocket clients"""
        try:
            for change in changes:
                await websocket_server.broadcast_to_subscription('position_updates', {
                    'type': 'position_change',
                    'change_type': change['type'],
                    'connection_id': change['connection_id'],
                    'position': change.get('new_position') or change['position'],
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })
            
            # Also broadcast summary
            summary = self.get_position_summary()
            await websocket_server.broadcast_to_subscription('portfolio_updates', {
                'type': 'portfolio_summary',
                'summary': summary,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
        except Exception as e:
            logger.error(f"Error broadcasting position changes: {e}")
    
    def get_all_positions(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get all current positions"""
        return self.current_positions.copy()
    
    def get_positions_for_connection(self, connection_id: str) -> List[Dict[str, Any]]:
        """Get positions for specific connection"""
        return self.current_positions.get(connection_id, [])
    
    def get_position_summary(self) -> Dict[str, Any]:
        """Get position summary statistics"""
        try:
            total_positions = 0
            total_unrealized_pnl = 0
            total_position_value = 0
            winning_positions = 0
            losing_positions = 0
            
            for positions in self.current_positions.values():
                for pos in positions:
                    total_positions += 1
                    total_unrealized_pnl += pos['unrealized_pnl']
                    total_position_value += pos['position_value']
                    
                    if pos['unrealized_pnl'] > 0:
                        winning_positions += 1
                    elif pos['unrealized_pnl'] < 0:
                        losing_positions += 1
            
            return {
                'total_positions': total_positions,
                'winning_positions': winning_positions,
                'losing_positions': losing_positions,
                'total_unrealized_pnl': total_unrealized_pnl,
                'total_position_value': total_position_value,
                'win_rate': winning_positions / total_positions if total_positions > 0 else 0,
                'last_sync': self.stats['last_sync'].isoformat() if self.stats['last_sync'] else None
            }
            
        except Exception as e:
            logger.error(f"Error calculating position summary: {e}")
            return {}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get sync statistics"""
        uptime = (datetime.now(timezone.utc) - self.stats['start_time']).total_seconds()
        
        return {
            **self.stats,
            'is_running': self.is_running,
            'active_connections': len(self.active_connections),
            'total_positions': sum(len(positions) for positions in self.current_positions.values()),
            'uptime_seconds': uptime,
            'last_sync_iso': self.stats['last_sync'].isoformat() if self.stats['last_sync'] else None
        }
    
    async def force_sync(self):
        """Force immediate synchronization"""
        logger.info("🔄 Forcing position sync...")
        await self._sync_all_positions()
    
    async def close_position(self, connection_id: str, symbol: str, quantity: Optional[float] = None) -> bool:
        """Close position via API"""
        try:
            if connection_id not in self.active_connections:
                logger.error(f"Connection {connection_id} not found")
                return False
            
            session = self.active_connections[connection_id]
            
            # Get current position to determine close parameters
            current_positions = self.get_positions_for_connection(connection_id)
            position = next((p for p in current_positions if p['symbol'] == symbol), None)
            
            if not position:
                logger.error(f"Position {symbol} not found for {connection_id}")
                return False
            
            # Close position
            close_qty = quantity or position['size']
            close_side = "Sell" if position['side'].lower() == "buy" else "Buy"
            
            result = session.place_order(
                category="linear",
                symbol=symbol,
                side=close_side,
                orderType="Market",
                qty=str(close_qty),
                reduceOnly=True,
                timeInForce="IOC"
            )
            
            if result['retCode'] == 0:
                logger.info(f"✅ Position {symbol} close order placed: {result['result']['orderId']}")
                
                # Force sync to update positions
                await asyncio.sleep(1)  # Wait for order execution
                await self.force_sync()
                
                return True
            else:
                logger.error(f"❌ Failed to close position {symbol}: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Error closing position {symbol}: {e}")
            return False

# Global position sync instance
position_sync = PositionSyncService()