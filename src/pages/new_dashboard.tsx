import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { bybitApi, Position } from '../services/api';
import { AccountsAllocation, PortfolioChange, LivePositionsSection, BybitConnection } from '../components/NewDashboardSections';
import MassStrategyGenerator from '../components/MassStrategyGenerator';

// Widget types
const WIDGET_TYPE = 'widget';

interface DashboardWidget {
  id: string;
  type: 'portfolio_performance' | 'trading_performance' | 'open_positions' | 'recent_trades' | 'quick_actions' | 'bitcoin_chart' | 'portfolio_overview' | 'advanced_analytics';
  title: string;
  icon: string;
  width: number; // 1-6 columns
}

interface DashboardRow {
  id: string;
  columns: number; // 1-6
  widgets: DashboardWidget[];
}

interface DashboardLayout {
  rows: DashboardRow[];
}

// Available widgets
const AVAILABLE_WIDGETS: Omit<DashboardWidget, 'id' | 'width'>[] = [
  { type: 'portfolio_performance', title: 'Portfolio Performance', icon: '📊' },
  { type: 'trading_performance', title: 'Trading Performance', icon: '🎯' },
  { type: 'open_positions', title: 'Open Positions', icon: '📈' },
  { type: 'recent_trades', title: 'Recent Trades', icon: '🔄' },
  { type: 'quick_actions', title: 'Quick Actions', icon: '⚡' },
  { type: 'bitcoin_chart', title: 'Bitcoin Chart', icon: '₿' },
  { type: 'portfolio_overview', title: 'Portfolio Overview', icon: '💰' },
  { type: 'advanced_analytics', title: 'Advanced Analytics', icon: '📈' },
];

// Draggable Widget Component
const DraggableWidget: React.FC<{ 
  widget: DashboardWidget; 
  onRemove: (id: string) => void;
  onResize: (id: string, width: number) => void;
  connections: BybitConnection[];
}> = ({ widget, onRemove, onResize, connections }) => {
  const [{ isDragging }, drag] = useDrag({
    type: WIDGET_TYPE,
    item: { id: widget.id, type: widget.type },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={`bg-gray-900 border border-gray-700 rounded-lg p-4 cursor-move transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      style={{ gridColumn: `span ${widget.width}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{widget.icon}</span>
          <h3 className="text-white font-medium text-sm">{widget.title}</h3>
        </div>
        <div className="flex items-center space-x-2">
          {/* Width selector */}
          <select
            value={widget.width}
            onChange={(e) => onResize(widget.id, parseInt(e.target.value))}
            className="bg-gray-800 text-white text-xs border border-gray-600 rounded px-1 py-0.5"
          >
            {[1, 2, 3, 4, 5, 6].map(w => (
              <option key={w} value={w}>{w} col</option>
            ))}
          </select>
          <button
            onClick={() => onRemove(widget.id)}
            className="text-gray-400 hover:text-red-400 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="text-gray-300 text-sm">
        {renderWidgetContent(widget.type, connections)}
      </div>
    </div>
  );
};

// Drop Zone Component
const DropZone: React.FC<{ 
  rowId: string; 
  onDrop: (item: any, rowId: string) => void;
  children: React.ReactNode;
}> = ({ rowId, onDrop, children }) => {
  const [{ isOver }, drop] = useDrop({
    accept: WIDGET_TYPE,
    drop: (item: any) => onDrop(item, rowId),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      className={`min-h-24 border-2 border-dashed rounded-lg transition-all ${
        isOver 
          ? 'border-blue-500 bg-blue-500/10' 
          : 'border-gray-700 bg-gray-900/20'
      }`}
    >
      {children}
    </div>
  );
};

// Widget content renderer
const renderWidgetContent = (type: DashboardWidget['type'], connections?: BybitConnection[]) => {
  // Calculate live data from connections
  const totalValue = connections?.reduce((sum, conn) => sum + (conn.data?.balance?.total || 0), 0) || 0;
  const totalPnL = connections?.reduce((sum, conn) => {
    const positions = conn.data?.positions || [];
    return sum + positions.reduce((pSum, pos) => pSum + (Number(pos.pnl) || 0), 0);
  }, 0) || 0;
  const winRate = connections?.reduce((sum, conn) => {
    const orders = conn.data?.orderHistory || [];
    const winningTrades = orders.filter(order => Number(order.pnl) > 0).length;
    return sum + (orders.length > 0 ? (winningTrades / orders.length) * 100 : 0);
  }, 0) / Math.max(connections?.length || 1, 1) || 0;
  const roi = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;

  switch (type) {
    case 'portfolio_performance':
      return (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total P&L:</span>
            <span className={totalPnL >= 0 ? "text-green-400" : "text-red-400"}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Win Rate:</span>
            <span>{winRate.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span>ROI:</span>
            <span className={roi >= 0 ? "text-green-400" : "text-red-400"}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    
    case 'trading_performance':
      const todayTrades = connections?.reduce((sum, conn) => {
        const orders = conn.data?.orderHistory || [];
        const today = new Date().toDateString();
        return sum + orders.filter(order => new Date(order.timestamp).toDateString() === today).length;
      }, 0) || 0;
      const bestTrade = connections?.reduce((best, conn) => {
        const orders = conn.data?.orderHistory || [];
        const maxPnL = Math.max(...orders.map(order => Number(order.pnl) || 0));
        return Math.max(best, maxPnL);
      }, 0) || 0;
      return (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Trades Today:</span>
            <span>{todayTrades}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Trades:</span>
            <span>{connections?.reduce((sum, conn) => sum + (conn.data?.orderHistory?.length || 0), 0) || 0}</span>
          </div>
          <div className="flex justify-between">
            <span>Best Trade:</span>
            <span className={bestTrade >= 0 ? "text-green-400" : "text-red-400"}>
              {bestTrade >= 0 ? '+' : ''}${bestTrade.toFixed(2)}
            </span>
          </div>
        </div>
      );
    
    case 'open_positions':
      const openPositions = connections?.reduce((positions, conn) => {
        const connPositions = conn.data?.positions?.filter(pos => pos.status === 'OPEN') || [];
        return [...positions, ...connPositions];
      }, [] as any[]) || [];
      return (
        <div className="space-y-2">
          <div className="text-xs">
            {openPositions.length > 0 ? (
              openPositions.slice(0, 3).map((pos, idx) => (
                <div key={idx} className="flex justify-between py-1">
                  <span>{pos.symbol}</span>
                  <span className={Number(pos.pnl) >= 0 ? "text-green-400" : "text-red-400"}>
                    {Number(pos.pnl) >= 0 ? '+' : ''}{((Number(pos.pnl) / Number(pos.entryPrice || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-2">No open positions</div>
            )}
          </div>
        </div>
      );
    
    case 'recent_trades':
      const recentTrades = connections?.reduce((trades, conn) => {
        const connTrades = conn.data?.orderHistory?.filter(order => order.status === 'CLOSED').slice(0, 5) || [];
        return [...trades, ...connTrades];
      }, [] as any[]) || [];
      recentTrades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return (
        <div className="space-y-1 text-xs">
          {recentTrades.length > 0 ? (
            recentTrades.slice(0, 3).map((trade, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{trade.symbol} {trade.direction}</span>
                <span className={Number(trade.pnl) >= 0 ? "text-green-400" : "text-red-400"}>
                  {Number(trade.pnl) >= 0 ? '+' : ''}${Number(trade.pnl).toFixed(2)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-gray-500 text-center py-2">No recent trades</div>
          )}
        </div>
      );
    
    case 'quick_actions':
      return (
        <div className="grid grid-cols-2 gap-2">
          <button className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-xs">Buy</button>
          <button className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-xs">Sell</button>
          <button className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-xs">Close All</button>
          <button className="bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-xs">Strategy</button>
        </div>
      );
    
    case 'bitcoin_chart':
      return (
        <div className="h-32 bg-gray-800 rounded flex items-center justify-center">
          <span className="text-gray-500">Chart Widget</span>
        </div>
      );
    
    case 'portfolio_overview':
      const availableBalance = connections?.reduce((sum, conn) => sum + (conn.data?.balance?.available || 0), 0) || 0;
      return (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Value:</span>
            <span>${totalValue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Available:</span>
            <span>${availableBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Accounts:</span>
            <span>{connections?.length || 0}</span>
          </div>
        </div>
      );
    
    case 'advanced_analytics':
      return (
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Sharpe:</span>
            <span>1.85</span>
          </div>
          <div className="flex justify-between">
            <span>Max DD:</span>
            <span className="text-red-400">-8.2%</span>
          </div>
        </div>
      );
    
    default:
      return <div>Widget content</div>;
  }
};

// Main Dashboard Component
const NewDashboard: React.FC = () => {
  const [layout, setLayout] = useState<DashboardLayout>({
    rows: [
      {
        id: 'row1',
        columns: 6,
        widgets: [
          { id: 'w1', type: 'portfolio_performance', title: 'Portfolio Performance', icon: '📊', width: 2 },
          { id: 'w2', type: 'trading_performance', title: 'Trading Performance', icon: '🎯', width: 2 },
          { id: 'w3', type: 'open_positions', title: 'Open Positions', icon: '📈', width: 2 },
        ]
      },
      {
        id: 'row2',
        columns: 4,
        widgets: [
          { id: 'w4', type: 'recent_trades', title: 'Recent Trades', icon: '🔄', width: 2 },
          { id: 'w5', type: 'quick_actions', title: 'Quick Actions', icon: '⚡', width: 2 },
        ]
      }
    ]
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({ status: 'Connected', count: 2 });
  const [connections, setConnections] = useState<BybitConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Save layout to localStorage
  useEffect(() => {
    localStorage.setItem('dashboardLayout', JSON.stringify(layout));
  }, [layout]);

  // Load layout from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) {
      try {
        setLayout(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load dashboard layout');
      }
    }
  }, []);

  // Fetch live data with auto-refresh
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log('🔄 Fetching fresh ByBit connection data...');
        const response = await bybitApi.getConnections();
        
        if (response.success) {
          const mappedConnections: BybitConnection[] = response.connections.map((conn: any) => ({
            connectionId: conn.connectionId || conn.connection_id,
            name: conn.metadata?.name || conn.name || 'Unknown Connection',
            status: conn.status || 'active',
            data: conn.data,
            metadata: conn.metadata || { name: conn.name || 'Unknown', created_at: new Date().toISOString() }
          }));
          
          console.log(`✅ Loaded ${mappedConnections.length} connections:`, mappedConnections.map(c => ({
            name: c.name,
            balance: c.data?.balance?.total || 0,
            positions: c.data?.positions?.length || 0
          })));
          
          setConnections(mappedConnections);
          setConnectionStatus({ 
            status: 'Connected', 
            count: mappedConnections.length 
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setConnectionStatus({ status: 'Disconnected', count: 0 });
      }
      setLoading(false);
    };

    // Initial fetch
    fetchData();
    
    // Set up auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      console.log('⏰ Auto-refreshing dashboard data...');
      fetchData();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  const addRow = (columns: number) => {
    const newRow: DashboardRow = {
      id: `row${Date.now()}`,
      columns,
      widgets: []
    };
    setLayout(prev => ({
      ...prev,
      rows: [...prev.rows, newRow]
    }));
  };

  const removeRow = (rowId: string) => {
    setLayout(prev => ({
      ...prev,
      rows: prev.rows.filter(row => row.id !== rowId)
    }));
  };

  const addWidget = (widgetType: DashboardWidget['type'], rowId: string) => {
    const widgetTemplate = AVAILABLE_WIDGETS.find(w => w.type === widgetType);
    if (!widgetTemplate) return;

    const newWidget: DashboardWidget = {
      ...widgetTemplate,
      id: `widget${Date.now()}`,
      width: 2
    };

    setLayout(prev => ({
      ...prev,
      rows: prev.rows.map(row => 
        row.id === rowId 
          ? { ...row, widgets: [...row.widgets, newWidget] }
          : row
      )
    }));
  };

  const removeWidget = (widgetId: string) => {
    setLayout(prev => ({
      ...prev,
      rows: prev.rows.map(row => ({
        ...row,
        widgets: row.widgets.filter(w => w.id !== widgetId)
      }))
    }));
  };

  const resizeWidget = (widgetId: string, width: number) => {
    setLayout(prev => ({
      ...prev,
      rows: prev.rows.map(row => ({
        ...row,
        widgets: row.widgets.map(w => 
          w.id === widgetId ? { ...w, width } : w
        )
      }))
    }));
  };

  const handleDrop = (item: any, rowId: string) => {
    // For now, just add the widget to the row
    // In a more complex implementation, you'd handle moving between rows
    console.log('Dropped', item, 'on row', rowId);
  };

  const refreshConnections = async () => {
    console.log('🔄 Manual refresh triggered...');
    setLoading(true);
    try {
      const response = await bybitApi.getConnections();
      
      if (response.success) {
        const mappedConnections: BybitConnection[] = response.connections.map((conn: any) => ({
          connectionId: conn.connectionId || conn.connection_id,
          name: conn.metadata?.name || conn.name || 'Unknown Connection',
          status: conn.status || 'active',
          data: conn.data,
          metadata: conn.metadata || { name: conn.name || 'Unknown', created_at: new Date().toISOString() }
        }));
        
        console.log(`✅ Manual refresh complete - ${mappedConnections.length} connections loaded`);
        setConnections(mappedConnections);
        setConnectionStatus({ 
          status: 'Connected', 
          count: mappedConnections.length 
        });
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      setConnectionStatus({ status: 'Disconnected', count: 0 });
    }
    setLoading(false);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="min-h-screen bg-black text-white p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400">
              {connectionStatus.status} • {connectionStatus.count} accounts
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={refreshConnections}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Refresh connections"
            >
              <span className="text-gray-300">🔄</span>
            </button>
            
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              title="Dashboard settings"
            >
              <span className="text-gray-300">⚙️</span>
            </button>
          </div>
        </div>

        {/* New Dashboard Sections - Matching Design Exactly */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Section 1: Accounts Allocation (Left) */}
          <AccountsAllocation connections={connections} />
          
          {/* Section 2: Portfolio Change (Center) */}
          <PortfolioChange connections={connections} />
          
          {/* Section 3: Live Positions (Right) */}
          <LivePositionsSection connections={connections} />
        </div>

        {/* Mass Strategy Generator */}
        <div className="mb-6">
          <MassStrategyGenerator />
        </div>

        {/* Dashboard Grid */}
        <div className="space-y-6">
          {layout.rows.map((row) => (
            <div key={row.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">
                  Row • {row.columns} columns
                </span>
                <button
                  onClick={() => removeRow(row.id)}
                  className="text-gray-400 hover:text-red-400 text-sm"
                >
                  Remove Row
                </button>
              </div>
              
              <DropZone rowId={row.id} onDrop={handleDrop}>
                <div 
                  className="grid gap-4 p-4"
                  style={{ gridTemplateColumns: `repeat(${row.columns}, 1fr)` }}
                >
                  {row.widgets.map((widget) => (
                    <DraggableWidget
                      key={widget.id}
                      widget={widget}
                      onRemove={removeWidget}
                      onResize={resizeWidget}
                      connections={connections}
                    />
                  ))}
                </div>
              </DropZone>
              
              {/* Add Widget Button */}
              <div className="flex space-x-2">
                {AVAILABLE_WIDGETS.map((widgetType) => (
                  <button
                    key={widgetType.type}
                    onClick={() => addWidget(widgetType.type, row.id)}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs transition-colors"
                  >
                    {widgetType.icon} {widgetType.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add Row Controls */}
        <div className="mt-8 p-4 border border-gray-700 rounded-lg">
          <h3 className="text-white font-medium mb-3">Add New Row</h3>
          <div className="flex space-x-2">
            {[1, 2, 3, 4, 5, 6].map(cols => (
              <button
                key={cols}
                onClick={() => addRow(cols)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
              >
                {cols} Column{cols > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-medium">Dashboard Settings</h3>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => {
                    localStorage.removeItem('dashboardLayout');
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  Reset Layout
                </button>
                
                <button
                  onClick={() => {
                    const layoutData = JSON.stringify(layout, null, 2);
                    navigator.clipboard.writeText(layoutData);
                    alert('Layout copied to clipboard');
                  }}
                  className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  Export Layout
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default NewDashboard;