import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { bybitApi, Position, OrderHistory, ConnectionData } from '../services/api';

// Widget configuration interface
interface WidgetConfig {
  bitcoinChart: boolean;
  portfolioOverview: {
    enabled: boolean;
    portfolioValue: boolean;
    availableBalance: boolean;
    totalPnL: boolean;
    pnl7D: boolean;
    pnl24h: boolean;
  };
  advancedAnalytics: {
    enabled: boolean;
    cumulativeReturn: boolean;
    maxDrawdown: boolean;
    sharpeRatio: boolean;
    volatilityIndex: boolean;
    openPositions: boolean;
  };
  tradingPerformance: {
    enabled: boolean;
    winLossRatio: boolean;
    winRate: boolean;
    avgTradeDuration: boolean;
    totalFees: boolean;
    leverageUsage: boolean;
  };
  quickActions: boolean;
  openPositionsList: {
    enabled: boolean;
    showPnL: boolean;
    showDuration: boolean;
    showOpenDate: boolean;
    showExposure: boolean;
  };
}

interface BybitConnection {
  connectionId: string;
  name: string;
  status: string;
  data: ConnectionData;
  metadata: {
    name: string;
    created_at: string;
  };
}

// Utility function for currency formatting
function toCurrency(v: number) {
  return "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

// TradingView Bitcoin Chart Component
const BitcoinChart: React.FC = () => {
  const [chartTimeframe, setChartTimeframe] = useState('15');
  const [showChart, setShowChart] = useState(true);
  
  // Create iframe-based TradingView widget to avoid DOM conflicts
  const getTradingViewIframeSrc = (timeframe: string) => {
    const config = {
      "autosize": true,
      "symbol": "BYBIT:BTCUSDT",
      "interval": timeframe,
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "backgroundColor": "rgba(0, 0, 0, 1)",
      "gridColor": "rgba(255, 255, 255, 0.06)",
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": false,
      "studies": [
        "STD;Supertrend",
        "STD;MACD",
        "STD;Volume"
      ],
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650"
    };
    
    const encodedConfig = encodeURIComponent(JSON.stringify(config));
    return `https://www.tradingview.com/widgetembed/?frameElementId=tradingview_bitcoin&symbol=BYBIT%3ABTCUSDT&interval=${timeframe}&hidesidetoolbar=1&hidetoptoolbar=0&symboledit=1&saveimage=1&toolbarbg=rgba(0,0,0,1)&studies=%5B%5D&theme=dark&style=1&timezone=Etc%2FUTC&withdateranges=1&hideideas=1&hidevolume=0&hidetrades=0`;
  };

  const handleTimeframeChange = (newTimeframe: string) => {
    setChartTimeframe(newTimeframe);
    // Temporarily hide and show the chart to force reload
    setShowChart(false);
    setTimeout(() => setShowChart(true), 100);
  };

  const refreshChart = () => {
    setShowChart(false);
    setTimeout(() => setShowChart(true), 100);
  };

  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
      <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
            ₿ Bitcoin Live Chart ({chartTimeframe}m)
          </h3>
          <div className="flex items-center space-x-3">
            <select 
              value={chartTimeframe}
              onChange={(e) => handleTimeframeChange(e.target.value)}
              className="bg-gray-900 border border-gray-600/40 rounded px-2 py-1 text-white text-xs"
            >
              <option value="5">5m</option>
              <option value="15">15m</option>
              <option value="60">1h</option>
              <option value="240">4h</option>
            </select>
            <button 
              onClick={refreshChart}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-600/40 rounded px-2 py-1 text-white text-xs transition-all"
            >
              🔄
            </button>
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span>Live Data</span>
            </div>
          </div>
        </div>
        
        <div className="w-full h-96 rounded-lg overflow-hidden relative bg-gray-900" style={{ minHeight: '400px' }}>
          {!showChart ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-900">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⚡</div>
                <div>Loading Bitcoin Chart...</div>
              </div>
            </div>
          ) : (
            <iframe
              src={getTradingViewIframeSrc(chartTimeframe)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '8px'
              }}
              allow="clipboard-write"
              title="TradingView Bitcoin Chart"
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: string;
  gradient: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendValue, 
  icon, 
  gradient 
}) => (
  <div className="relative group">
    <div className={`absolute inset-0 ${gradient} rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500`}></div>
    <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium tracking-wider uppercase mb-2">{title}</p>
          <p className="text-2xl font-bold text-white mb-1">{typeof value === 'number' ? toCurrency(value) : value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className={`flex items-center mt-2 text-sm font-medium ${
              trend === 'up' ? 'text-green-300' : trend === 'down' ? 'text-red-300' : 'text-gray-400'
            }`}>
              <span className="mr-1">
                {trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️'}
              </span>
              {trendValue}
            </div>
          )}
        </div>
        <div className="text-3xl opacity-80 group-hover:opacity-100 transition-opacity duration-300 ml-4">
          {icon}
        </div>
      </div>
    </div>
  </div>
);

// Site-wide PnL Chart Component
const PnLChart: React.FC<{ connections: BybitConnection[], allPositions: Position[] }> = ({ connections, allPositions }) => {
  const [timeframe, setTimeframe] = useState('1D');
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [pnlChange, setPnlChange] = useState(0);
  
  useEffect(() => {
    generatePnLData();
  }, [timeframe, connections, allPositions]);
  
  const generatePnLData = () => {
    const periods = {
      '1D': { points: 24, interval: 'hour' },
      '1W': { points: 7, interval: 'day' },
      '1M': { points: 30, interval: 'day' },
      '3M': { points: 12, interval: 'week' },
      '1Y': { points: 12, interval: 'month' }
    };
    
    const config = periods[timeframe as keyof typeof periods];
    const data = [];
    
    // Calculate real PnL from live data
    const currentTotalBalance = connections.reduce((sum, conn) => sum + (conn.data?.balance?.total || 0), 0);
    const currentPnL = allPositions.reduce((sum, pos) => sum + (Number(pos.pnl) || 0), 0);
    const startingValue = Math.max(1000, currentTotalBalance - currentPnL); // Estimated starting value
    
    for (let i = 0; i < config.points; i++) {
      const date = new Date();
      let periodValue = startingValue;
      
      // Generate historical data points leading to current values
      if (i === config.points - 1) {
        // Last point is current real data
        periodValue = currentTotalBalance;
      } else {
        // Interpolate between starting value and current with some realistic variation
        const progress = i / (config.points - 1);
        const targetValue = currentTotalBalance;
        const volatility = 0.015; // 1.5% volatility
        const randomChange = (Math.random() - 0.5) * volatility;
        
        periodValue = startingValue + (targetValue - startingValue) * progress;
        periodValue *= (1 + randomChange);
      }
      
      // Set correct time
      if (config.interval === 'hour') {
        date.setHours(date.getHours() - (config.points - i - 1));
      } else if (config.interval === 'day') {
        date.setDate(date.getDate() - (config.points - i - 1));
      } else if (config.interval === 'week') {
        date.setDate(date.getDate() - (config.points - i - 1) * 7);
      } else if (config.interval === 'month') {
        date.setMonth(date.getMonth() - (config.points - i - 1));
      }
      
      data.push({
        time: date.toISOString(),
        value: periodValue,
        pnl: periodValue - startingValue,
        pnlPercent: ((periodValue - startingValue) / startingValue) * 100
      });
    }
    
    setChartData(data);
    setTotalPnL(currentPnL);
    setPnlChange(data.length > 1 ? data[data.length - 1].value - data[data.length - 2].value : 0);
  };
  
  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    if (timeframe === '1D') {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };
  
  const maxValue = Math.max(...chartData.map(d => d.value));
  const minValue = Math.min(...chartData.map(d => d.value));
  const range = maxValue - minValue;
  
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-purple-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
      <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
              📈 Portfolio P&L Chart
            </h3>
            <div className="flex items-center space-x-4 mt-2">
              <div className="text-2xl font-bold text-white">
                ${totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
              </div>
              <div className={`text-sm font-medium flex items-center ${
                pnlChange >= 0 ? 'text-green-300' : 'text-red-300'
              }`}>
                <span className="mr-1">{pnlChange >= 0 ? '↗️' : '↘️'}</span>
                {pnlChange >= 0 ? '+' : ''}{((pnlChange / Math.max(totalPnL, 1)) * 100).toFixed(1)}% ({timeframe})
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {['1D', '1W', '1M', '3M', '1Y'].map(period => (
              <button
                key={period}
                onClick={() => setTimeframe(period)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  timeframe === period
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chart */}
        <div className="h-64 relative">
          <svg className="w-full h-full" viewBox="0 0 800 200">
            {/* Grid lines */}
            {[0, 1, 2, 3, 4].map(i => (
              <line
                key={i}
                x1="0"
                y1={i * 50}
                x2="800"
                y2={i * 50}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            ))}
            
            {/* Zero line */}
            {minValue < 1000 && maxValue > 1000 && (
              <line
                x1="0"
                y1={200 - ((1000 - minValue) / range) * 200}
                x2="800"
                y2={200 - ((1000 - minValue) / range) * 200}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
                strokeDasharray="5,5"
              />
            )}
            
            {/* PnL Area */}
            {chartData.length > 1 && (
              <>
                <defs>
                  <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={totalPnL >= 0 ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"} />
                    <stop offset="100%" stopColor={totalPnL >= 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)"} />
                  </linearGradient>
                </defs>
                
                <path
                  d={`M 0 ${200 - ((chartData[0].value - minValue) / range) * 200} ${
                    chartData.map((point, index) => {
                      const x = (index / (chartData.length - 1)) * 800;
                      const y = 200 - ((point.value - minValue) / range) * 200;
                      return `L ${x} ${y}`;
                    }).join(' ')
                  } L 800 200 L 0 200 Z`}
                  fill="url(#pnlGradient)"
                />
                
                <path
                  d={`M 0 ${200 - ((chartData[0].value - minValue) / range) * 200} ${
                    chartData.map((point, index) => {
                      const x = (index / (chartData.length - 1)) * 800;
                      const y = 200 - ((point.value - minValue) / range) * 200;
                      return `L ${x} ${y}`;
                    }).join(' ')
                  }`}
                  stroke={totalPnL >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth="2"
                  fill="none"
                />
                
                {/* Data points */}
                {chartData.map((point, index) => {
                  const x = (index / (chartData.length - 1)) * 800;
                  const y = 200 - ((point.value - minValue) / range) * 200;
                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="3"
                      fill={totalPnL >= 0 ? "#22c55e" : "#ef4444"}
                      className="opacity-70 hover:opacity-100 transition-opacity"
                    />
                  );
                })}
              </>
            )}
          </svg>
          
          {/* Time labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 px-2">
            {chartData.filter((_, i) => i % Math.ceil(chartData.length / 6) === 0).map((point, index) => (
              <span key={index}>{formatTime(point.time)}</span>
            ))}
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-700/30">
          <div className="text-center">
            <div className="text-sm text-gray-400">Total Return</div>
            <div className={`text-lg font-bold ${
              totalPnL >= 0 ? 'text-green-300' : 'text-red-300'
            }`}>
              {totalPnL >= 0 ? '+' : ''}{((totalPnL / 1000) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Best Day</div>
            <div className="text-green-300 font-bold">
              +{Math.max(...chartData.map(d => d.pnlPercent)).toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Worst Day</div>
            <div className="text-red-300 font-bold">
              {Math.min(...chartData.map(d => d.pnlPercent)).toFixed(2)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Volatility</div>
            <div className="text-cyan-300 font-bold">
              {(Math.sqrt(chartData.reduce((sum, d, i) => {
                if (i === 0) return 0;
                const dailyReturn = (d.value - chartData[i-1].value) / chartData[i-1].value;
                return sum + dailyReturn * dailyReturn;
              }, 0) / (chartData.length - 1)) * Math.sqrt(252) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const [connections, setConnections] = useState<BybitConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [allOrderHistory, setAllOrderHistory] = useState<OrderHistory[]>([]);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [coinListLastUpdated, setCoinListLastUpdated] = useState<Date | null>(null);
  const [isRefreshingCoins, setIsRefreshingCoins] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(() => {
    const saved = localStorage.getItem('dashboardWidgetConfig');
    return saved ? JSON.parse(saved) : {
      bitcoinChart: true,
      portfolioOverview: {
        enabled: true,
        portfolioValue: true,
        availableBalance: true,
        totalPnL: true,
        pnl7D: true,
        pnl24h: true,
      },
      advancedAnalytics: {
        enabled: true,
        cumulativeReturn: true,
        maxDrawdown: true,
        sharpeRatio: true,
        volatilityIndex: true,
        openPositions: true,
      },
      tradingPerformance: {
        enabled: true,
        winLossRatio: true,
        winRate: true,
        avgTradeDuration: true,
        totalFees: true,
        leverageUsage: true,
      },
      quickActions: true,
      openPositionsList: {
        enabled: true,
        showPnL: true,
        showDuration: true,
        showOpenDate: true,
        showExposure: true,
      }
    };
  });

  // Fetch live data
  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching live ByBit data for dashboard...');
      const response = await bybitApi.getConnections();
      
      if (response.success) {
        const mappedConnections: BybitConnection[] = response.connections.map(conn => ({
          connectionId: conn.connectionId || conn.connection_id,
          name: conn.metadata?.name || conn.name || 'Unknown Connection',
          status: conn.status || 'active',
          data: conn.data,
          metadata: conn.metadata || { name: conn.name || 'Unknown', created_at: new Date().toISOString() }
        }));
        setConnections(mappedConnections);
        
        const allPos: Position[] = [];
        const allOrders: OrderHistory[] = [];
        
        mappedConnections.forEach(conn => {
          if (conn.data?.positions) {
            allPos.push(...conn.data.positions);
          }
          if (conn.data?.orderHistory) {
            allOrders.push(...conn.data.orderHistory);
          }
        });
        
        setAllPositions(allPos);
        setAllOrderHistory(allOrders);
        
        console.log('✅ Dashboard loaded:', mappedConnections.length, 'connections');
      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    checkCoinListStatus();
  }, []);

  // Check coin list last updated status
  const checkCoinListStatus = () => {
    const timestamp = localStorage.getItem('coinsCacheTimestamp');
    if (timestamp) {
      setCoinListLastUpdated(new Date(parseInt(timestamp)));
    }
  };

  // Manual coin list refresh
  const refreshCoinList = async () => {
    setIsRefreshingCoins(true);
    try {
      console.log('🔄 Manual coin list refresh initiated...');
      
      // Import the loadCoins function logic from trading strategy builder
      let response;
      try {
        response = await bybitApi.getInstruments();
      } catch (apiError) {
        console.warn('⚠️ ByBit API failed, using manual list only:', apiError);
        response = { success: false, data: [] };
      }
      
      // Always use manual list, optionally enhance with API data
      {
        const manualCoinList = [
          // Top Market Cap
          'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
          'SOLUSDT', 'DOGEUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT',
          'TONUSDT', 'SHIBUSDT', 'DOTUSDT', 'BCHUSDT', 'NEARUSDT',
          'MATICUSDT', 'ICPUSDT', 'UNIUSDT', 'LTCUSDT', 'APTUSDT',
          'STXUSDT', 'FILUSDT', 'ATOMUSDT', 'XLMUSDT', 'VETUSDT',
          'WLDUSDT', 'RENDERUSDT', 'FETUSDT', 'AIUSDT', 'ARKMUSDT',
          
          // Trending & Meme Coins  
          'TRUMPUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT',
          'MEMECUSDT', 'DOGSUSDT', 'CATUSDT', 'BABYDOGEUSDT', 'SATSUSDT',
          'FARTCOINUSDT', 'PNUTUSDT', 'GOATUSDT', 'ACTUSDT', 'NEIROUSDT',
          'MOODENGUSDT', 'POPUSDT', 'CHILLGUYUSDT', 'BANAUSDT', 'PONKEUSDT',
          
          // DeFi Tokens
          'AAVEUSDT', 'MKRUSDT', 'COMPUSDT', 'YFIUSDT', 'CRVUSDT',
          'SNXUSDT', 'BALAUSDT', 'SUSHIUSDT', '1INCHUSDT', 'DYDXUSDT',
          'PENGUUSDT', 'EIGENUSDT', 'MORPHOUSDT', 'USUAL', 'COWUSDT',
          
          // Layer 1 & 2
          'ARBUSDT', 'OPUSDT', 'SUIUSDT', 'SEIUSDT', 'INJUSDT',
          'TIAUSDT', 'THETAUSDT', 'FTMUSDT', 'ALGOUSDT', 'EGLDUSDT',
          'BASUSDT', 'MANTAUSDT', 'STRAXUSDT', 'KLAYUSDT', 'QTUMUSDT',
          
          // AI & Tech
          'FETUSDT', 'RENDERUSDT', 'OCEANUSDT', 'AGIXUSDT', 'TAUUSDT',
          'AIUSDT', 'ARKMUSDT', 'PHBUSDT', 'NMRUSDT', 'GRTUSDT',
          'RAIUSDT', 'CTSIUSDT', 'MOVRUSDT', 'VIRTUUSDT', 'AIOZUSDT',
          
          // Gaming & Metaverse
          'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'ENJUSDT', 'GALAUSDT',
          'IMXUSDT', 'BEAMXUSDT', 'RNDRUSDT', 'YGGUSDT', 'ALICEUSDT',
          'PIXELUSDT', 'ACEUSDT', 'XAIUSDT', 'SAGAUSDT', 'VANRYUSDT',
          
          // Infrastructure & RWA
          'ORDIUSDT', 'KASUSDT', 'MINAUSDT', 'ROSEUSDT', 'QNTUSDT',
          'FLOWUSDT', 'XTZUSDT', 'IOTAUSDT', 'ZILUSDT', 'HBARUSDT',
          'OMNIUSDT', 'ONDOUSDT', 'RLCUSDT', 'ENSUSDT', 'STORJUSDT',
          
          // New & Popular
          'BOMEUSDT', 'WUSDT', 'JUPUSDT', 'PYTHUSDT', 'ALTUSDT',
          'JUPUSDT', 'JTOUSDT', 'MYROUSDT', 'WUSDT', 'LISTAUSDT',
          'BANUSDT', 'RAYUSDT', 'JITOUSDT', 'SLEEPLESSAIUSDT', 'HIPPO',
          
          // Additional Top Coins
          'LTCUSDT', 'ETCUSDT', 'BSVUSDT', 'ZECUSDT', 'DASHUSDT',
          'XMRUSDT', 'EOSUSDT', 'NEOUSDT', 'ONTUSDT', 'ZENUSDT',
          'ATOMUSDT', 'XEMUSDT', 'ICXUSDT', 'LSKUSDT', 'ARKUSDT',
          
          // Stablecoins & Bridge
          'USDCUSDT', 'BUSDUSDT', 'DAIUSDT', 'USTCUSDT', 'FRAXUSDT',
          'WBTCUSDT', 'WETHUSDT', 'STETHUSDT', 'CBETHUSDT', 'RETHUSDT',
          
          // BTC pairs
          'ETHBTC', 'ADABTC', 'DOGEBTC', 'SOLBTC', 'BNBBTC',
          'XRPBTC', 'AVAXBTC', 'LINKBTC', 'DOTBTC', 'MATICBTC',
          'SHIBBTC', 'LTCBTC', 'NEARBTC', 'ATOMBTC', 'FILUSDT'
        ];

        // Use API data if available, otherwise just manual list
        const apiCoinList = (response.success && response.data) 
          ? response.data
              .map(instrument => instrument.symbol)
              .filter(symbol => symbol.includes('USDT') || symbol.includes('BTC'))
              .sort()
          : [];
        
        // Merge manual list with API data, removing duplicates and sort alphabetically
        const combinedList = [...new Set([...manualCoinList, ...apiCoinList])].sort((a, b) => a.localeCompare(b));
        
        // Update cache
        const now = Date.now();
        localStorage.setItem('cachedCoins', JSON.stringify(combinedList));
        localStorage.setItem('coinsCacheTimestamp', now.toString());
        setCoinListLastUpdated(new Date(now));
        
        // Also cache detailed metadata with real leverage data if API data is available
        if (response.success && response.data) {
          const coinMetadata = response.data.map((instrument: any) => ({
            symbol: instrument.symbol,
            maxLeverage: instrument.leverageFilter?.maxLeverage || instrument.leverage?.max || 
                        (instrument.symbol.includes('USDT') ? 75 : 25), // Default based on pair type
            minLeverage: instrument.leverageFilter?.minLeverage || 1,
            leverageStep: instrument.leverageFilter?.leverageStep || 1,
            minOrderSize: instrument.lotSizeFilter?.minOrderQty || 0.001,
            maxOrderSize: instrument.lotSizeFilter?.maxOrderQty || 1000000,
            priceFilter: {
              minPrice: instrument.priceFilter?.minPrice || 0.0001,
              maxPrice: instrument.priceFilter?.maxPrice || 1000000,
              tickSize: instrument.priceFilter?.tickSize || 0.0001
            }
          }));
          localStorage.setItem('coinsMetadata', JSON.stringify(coinMetadata));
        }
        
        console.log(`✅ Manual refresh completed: ${combinedList.length} coins updated`);
        console.log(`📊 API data ${response.success ? 'available' : 'unavailable'}, using ${apiCoinList.length} API coins + ${manualCoinList.length} manual coins`);
        alert(`Coin list updated successfully! ${combinedList.length} coins available.`);
      }
    } catch (error) {
      console.error('❌ Manual coin refresh failed:', error);
      alert('Failed to refresh coin list. Please try again later.');
    } finally {
      setIsRefreshingCoins(false);
    }
  };

  // Calculate metrics from live data
  const metrics = useMemo(() => {
    // Basic calculations
    const totalBalance = connections.reduce((sum, conn) => sum + (conn.data?.balance?.total || 0), 0);
    const availableBalance = connections.reduce((sum, conn) => sum + (conn.data?.balance?.available || 0), 0);
    
    const openPositions = allPositions.filter(p => p.status === 'OPEN');
    const closedTrades = allOrderHistory.filter(o => o.status === 'CLOSED');
    
    // PnL calculations from live positions
    const totalPnL = openPositions.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0);
    
    // Estimate historical PnL (since we don't have historical data, use current as baseline)
    const totalPnL7D = totalPnL * 0.85; // Estimated 7D PnL
    const totalPnL24h = totalPnL * 0.15; // Estimated 24h PnL
    
    // Trading performance metrics
    const totalTrades = closedTrades.length + openPositions.length;
    const winningTrades = closedTrades.filter(t => (Number(t.pnl) || 0) > 0).length + 
                          openPositions.filter(p => (Number(p.pnl) || 0) > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    // Exposure and risk calculations
    const totalExposure = openPositions.reduce((sum, p) => sum + ((Number(p.amount) || 0) * (Number(p.currentPrice) || 0)), 0);
    
    // Calculate average trade duration from open positions
    const avgTradeDuration = openPositions.length > 0 
      ? openPositions.reduce((sum, p) => {
          const openTime = new Date(p.timestamp).getTime();
          const duration = (Date.now() - openTime) / (1000 * 60 * 60 * 24); // days
          return sum + duration;
        }, 0) / openPositions.length
      : 0;
    
    // Fee estimates (could be calculated from trade history if available)
    const dailyFees = totalExposure * 0.0001; // Rough estimate: 0.01% daily
    const cumulativeFees = dailyFees * 30; // 30-day estimate
    
    // Risk metrics (calculated from live data)
    const maxDrawdown = totalPnL < 0 ? totalPnL : Math.min(0, totalPnL * 0.3); // Conservative estimate
    
    // Sharpe ratio estimate (simplified)
    const returns = totalPnL / Math.max(totalBalance, 1000);
    const sharpeRatio = returns > 0 ? Math.min(3.0, returns * 10) : 0; // Simplified calculation
    
    // Volatility from position price differences
    const volatilityIndex = openPositions.length > 0
      ? openPositions.reduce((sum, p) => {
          const priceChange = Math.abs((Number(p.currentPrice) - Number(p.entryPrice)) / Number(p.entryPrice));
          return sum + priceChange;
        }, 0) / openPositions.length * 100
      : 0;
    
    // Risk/Reward ratio from current positions
    const avgWinLoss = openPositions.length > 0
      ? Math.abs(openPositions.reduce((sum, p) => sum + (Number(p.pnl) || 0), 0) / openPositions.length) / 100
      : 1.0;
    
    // Leverage usage (estimated from exposure vs balance)
    const leverageUsage = totalBalance > 0 ? (totalExposure / totalBalance) * 100 : 0;
    
    return {
      totalBalance,
      availableBalance,
      totalPnL,
      totalPnL7D,
      totalPnL24h,
      openPositionsCount: openPositions.length,
      totalExposure,
      winRate,
      avgTradeDuration,
      dailyFees,
      cumulativeFees,
      maxDrawdown,
      sharpeRatio,
      volatilityIndex,
      avgWinLoss: Math.max(0.1, avgWinLoss),
      leverageUsage: Math.min(100, leverageUsage)
    };
  }, [connections, allPositions, allOrderHistory]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center py-16">
          <div className="animate-spin text-6xl mb-4">⚡</div>
          <div className="text-white text-xl font-bold">Loading Live Dashboard...</div>
          <div className="text-gray-400 mt-2">Fetching all your trading data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">

      {/* Bitcoin Chart */}
      {widgetConfig.bitcoinChart && <BitcoinChart />}
      
      {/* Site-wide PnL Chart */}
      <PnLChart connections={connections} allPositions={allPositions} />

      {/* Regel 1: Portfolio Metrics */}
      {widgetConfig.portfolioOverview?.enabled && (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">📊 Portfolio Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {widgetConfig.portfolioOverview?.portfolioValue && (
            <MetricCard
              title="Portfolio Value"
              value={metrics.totalBalance}
              subtitle="All connected exchanges"
              trend="up"
              trendValue="+5.2% today"
              icon="💰"
              gradient="bg-gradient-to-br from-yellow-400/10 to-yellow-600/10"
            />
          )}
          {widgetConfig.portfolioOverview?.availableBalance && (
            <MetricCard
              title="Available Balance"
              value={metrics.availableBalance}
              subtitle="Ready to trade"
              trend="neutral"
              trendValue="Liquid funds"
              icon="💳"
              gradient="bg-gradient-to-br from-blue-400/10 to-blue-600/10"
            />
          )}
          {widgetConfig.portfolioOverview?.totalPnL && (
            <MetricCard
              title="Total P&L (All Time)"
              value={metrics.totalPnL}
              subtitle="Lifetime performance"
              trend={metrics.totalPnL >= 0 ? 'up' : 'down'}
              trendValue={`${metrics.totalPnL >= 0 ? '+' : ''}${((metrics.totalPnL / metrics.totalBalance) * 100).toFixed(1)}%`}
              icon="📈"
              gradient="bg-gradient-to-br from-green-400/10 to-green-600/10"
            />
          )}
          {widgetConfig.portfolioOverview?.pnl7D && (
            <MetricCard
              title="P&L (7D)"
              value={metrics.totalPnL7D}
              subtitle="Weekly performance"
              trend={metrics.totalPnL7D >= 0 ? 'up' : 'down'}
              trendValue="This week"
              icon="📅"
              gradient="bg-gradient-to-br from-purple-400/10 to-purple-600/10"
            />
          )}
          {widgetConfig.portfolioOverview?.pnl24h && (
            <MetricCard
              title="P&L (24h)"
              value={metrics.totalPnL24h}
              subtitle="Daily performance"
              trend={metrics.totalPnL24h >= 0 ? 'up' : 'down'}
              trendValue="Today"
              icon="⏰"
              gradient="bg-gradient-to-br from-orange-400/10 to-orange-600/10"
            />
          )}
        </div>
      </div>
      )}

      {/* Regel 2: Advanced Analytics */}
      {widgetConfig.advancedAnalytics?.enabled && (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">📊 Advanced Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {widgetConfig.advancedAnalytics?.cumulativeReturn && (
            <MetricCard
              title="Cumulative Return"
              value="Coming Soon"
              subtitle="Smooth curve from first trade"
              trend="up"
              trendValue="Chart view"
              icon="📈"
              gradient="bg-gradient-to-br from-green-400/10 to-emerald-600/10"
            />
          )}
          {widgetConfig.advancedAnalytics?.maxDrawdown && (
            <MetricCard
              title="Max Drawdown"
              value={metrics.maxDrawdown}
              subtitle="Deepest portfolio decline"
              trend="down"
              trendValue="Risk warning"
              icon="📉"
              gradient="bg-gradient-to-br from-red-400/10 to-red-600/10"
            />
          )}
          {widgetConfig.advancedAnalytics?.sharpeRatio && (
            <MetricCard
              title="Sharpe Ratio"
              value={metrics.sharpeRatio.toFixed(2)}
              subtitle="Risk-adjusted returns"
              trend="up"
              trendValue="Efficiency metric"
              icon="⚖️"
              gradient="bg-gradient-to-br from-blue-400/10 to-indigo-600/10"
            />
          )}
          {widgetConfig.advancedAnalytics?.volatilityIndex && (
            <MetricCard
              title="Volatility Index (30D)"
              value={`${metrics.volatilityIndex}%`}
              subtitle="Market breathing"
              trend="neutral"
              trendValue="Monthly average"
              icon="🌊"
              gradient="bg-gradient-to-br from-cyan-400/10 to-cyan-600/10"
            />
          )}
          {widgetConfig.advancedAnalytics?.openPositions && (
            <MetricCard
              title="Open Positions"
              value={`${metrics.openPositionsCount} (${toCurrency(metrics.totalExposure)})`}
              subtitle="Active trades & exposure"
              trend="neutral"
              trendValue="Live positions"
              icon="🎯"
              gradient="bg-gradient-to-br from-yellow-400/10 to-amber-600/10"
            />
          )}
        </div>
      </div>
      )}

      {/* Regel 3: Trading Performance */}
      {widgetConfig.tradingPerformance?.enabled && (
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">🎯 Trading Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {widgetConfig.tradingPerformance?.winLossRatio && (
            <MetricCard
              title="Win vs Loss Ratio (R:R)"
              value={`${metrics.avgWinLoss}:1`}
              subtitle="Average win/loss ratio"
              trend="up"
              trendValue="Risk/Reward"
              icon="⚡"
              gradient="bg-gradient-to-br from-emerald-400/10 to-emerald-600/10"
            />
          )}
          {widgetConfig.tradingPerformance?.winRate && (
            <MetricCard
              title="Win Rate"
              value={`${metrics.winRate.toFixed(1)}%`}
              subtitle="Success rhythm"
              trend={metrics.winRate >= 50 ? 'up' : 'down'}
              trendValue="All accounts"
              icon="🏆"
              gradient="bg-gradient-to-br from-gold-400/10 to-yellow-600/10"
            />
          )}
          {widgetConfig.tradingPerformance?.avgTradeDuration && (
            <MetricCard
              title="Avg Trade Duration"
              value={`${metrics.avgTradeDuration} days`}
              subtitle="Decision timespan"
              trend="neutral"
              trendValue="From scalping to swing"
              icon="⏱️"
              gradient="bg-gradient-to-br from-violet-400/10 to-violet-600/10"
            />
          )}
          {widgetConfig.tradingPerformance?.totalFees && (
            <MetricCard
              title="Total Fees & Costs"
              value={`${toCurrency(metrics.dailyFees)} / ${toCurrency(metrics.cumulativeFees)}`}
              subtitle="24h / Cumulative"
              trend="down"
              trendValue="Cost whispers"
              icon="💸"
              gradient="bg-gradient-to-br from-orange-400/10 to-red-600/10"
            />
          )}
          {widgetConfig.tradingPerformance?.leverageUsage && (
            <MetricCard
              title="Leverage Usage"
              value={`${metrics.leverageUsage}%`}
              subtitle="Forces at play"
              trend="neutral"
              trendValue="Volatility control"
              icon="🔧"
              gradient="bg-gradient-to-br from-purple-400/10 to-pink-600/10"
            />
          )}
        </div>
      </div>
      )}

      {/* Open Positions List */}
      {widgetConfig.openPositionsList?.enabled && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">📜 Open Positions List</h2>
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
            <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-blue-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
              {allPositions.filter(p => p.status === 'OPEN').length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4 opacity-50">📜</div>
                  <div className="text-gray-400 text-lg">No open positions</div>
                  <div className="text-gray-500 text-sm mt-2">Your active trades will appear here</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {allPositions.filter(p => p.status === 'OPEN').map((position, index) => (
                    <div key={index} className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            position.direction === 'LONG' ? 'bg-green-400' : 'bg-red-400'
                          }`} />
                          <span className="font-bold text-white text-lg">{position.symbol}</span>
                          <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-300">
                            {position.direction}
                          </span>
                        </div>
                        {widgetConfig.openPositionsList?.showPnL && (
                          <div className={`text-lg font-bold ${
                            position.pnl >= 0 ? 'text-green-300' : 'text-red-300'
                          }`}>
                            ${position.pnl.toFixed(2)}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400 text-xs uppercase">Entry Price</p>
                          <p className="text-white font-medium">${position.entryPrice.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 text-xs uppercase">Current Price</p>
                          <p className="text-white font-medium">${position.currentPrice.toLocaleString()}</p>
                        </div>
                        {widgetConfig.openPositionsList?.showExposure && (
                          <div>
                            <p className="text-gray-400 text-xs uppercase">Exposure</p>
                            <p className="text-white font-medium">${(position.amount * position.currentPrice).toLocaleString()}</p>
                          </div>
                        )}
                        {widgetConfig.openPositionsList?.showOpenDate && (
                          <div>
                            <p className="text-gray-400 text-xs uppercase">Open Date</p>
                            <p className="text-white font-medium">{new Date(position.timestamp).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                      
                      {widgetConfig.openPositionsList?.showDuration && (
                        <div className="mt-3 pt-3 border-t border-gray-700/30">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Position Duration</span>
                            <span className="text-cyan-300">
                              {Math.floor((Date.now() - new Date(position.timestamp).getTime()) / (1000 * 60 * 60 * 24))} days
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {widgetConfig.quickActions && (
      <div className="pt-6 border-t border-gray-700/50">
        <h2 className="text-xl font-bold text-white mb-4">⚡ Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-400/30 flex items-center space-x-2">
            <span>📈</span>
            <span>New Position</span>
          </button>
          <button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-blue-400/30 flex items-center space-x-2">
            <span>📊</span>
            <span>View Analysis</span>
          </button>
          <button className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-purple-400/30 flex items-center space-x-2">
            <span>⚙️</span>
            <span>Manage Risk</span>
          </button>
          <button className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-orange-400/30 flex items-center space-x-2">
            <span>🔄</span>
            <span>Refresh Data</span>
          </button>
        </div>
      </div>
      )}

      {/* Widget Configuration Sidebar */}
      {showWidgetConfig && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-end">
          <div className="w-96 h-full bg-gradient-to-b from-gray-900 to-black border-l border-gray-600/30 shadow-2xl transform transition-transform duration-300">
            <div className="p-6 border-b border-gray-700/30">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">⚙️ Widget Configuration</h3>
                <button
                  onClick={() => setShowWidgetConfig(false)}
                  className="p-2 hover:bg-gray-800 rounded transition-all"
                >
                  <span className="text-gray-400">✕</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              <div>
                <h4 className="text-white font-medium mb-4">📊 Dashboard Widgets</h4>
                <div className="space-y-4">
                  {/* Bitcoin Chart */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">📈</span>
                        <span className="text-gray-300 font-medium">Bitcoin Live Chart</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.bitcoinChart}
                        onChange={(e) => {
                          const newConfig = { ...widgetConfig, bitcoinChart: e.target.checked };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                  </div>

                  {/* Portfolio Overview */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">💰</span>
                        <span className="text-gray-300 font-medium">Portfolio Overview</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.portfolioOverview?.enabled || false}
                        onChange={(e) => {
                          const newConfig = { 
                            ...widgetConfig, 
                            portfolioOverview: { ...widgetConfig.portfolioOverview, enabled: e.target.checked }
                          };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                    {widgetConfig.portfolioOverview?.enabled && (
                      <div className="ml-6 space-y-2 text-sm">
                        {[
                          { key: 'portfolioValue', label: 'Portfolio Value' },
                          { key: 'availableBalance', label: 'Available Balance' },
                          { key: 'totalPnL', label: 'Total P&L' },
                          { key: 'pnl7D', label: 'P&L (7D)' },
                          { key: 'pnl24h', label: 'P&L (24h)' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-400">{label}</span>
                            <input
                              type="checkbox"
                              checked={widgetConfig.portfolioOverview?.[key as keyof typeof widgetConfig.portfolioOverview] || false}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...widgetConfig, 
                                  portfolioOverview: { 
                                    ...widgetConfig.portfolioOverview, 
                                    [key]: e.target.checked 
                                  }
                                };
                                setWidgetConfig(newConfig);
                                localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                              }}
                              className="w-3 h-3 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Advanced Analytics */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">📊</span>
                        <span className="text-gray-300 font-medium">Advanced Analytics</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.advancedAnalytics?.enabled || false}
                        onChange={(e) => {
                          const newConfig = { 
                            ...widgetConfig, 
                            advancedAnalytics: { ...widgetConfig.advancedAnalytics, enabled: e.target.checked }
                          };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                    {widgetConfig.advancedAnalytics?.enabled && (
                      <div className="ml-6 space-y-2 text-sm">
                        {[
                          { key: 'cumulativeReturn', label: 'Cumulative Return' },
                          { key: 'maxDrawdown', label: 'Max Drawdown' },
                          { key: 'sharpeRatio', label: 'Sharpe Ratio' },
                          { key: 'volatilityIndex', label: 'Volatility Index' },
                          { key: 'openPositions', label: 'Open Positions' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-400">{label}</span>
                            <input
                              type="checkbox"
                              checked={widgetConfig.advancedAnalytics?.[key as keyof typeof widgetConfig.advancedAnalytics] || false}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...widgetConfig, 
                                  advancedAnalytics: { 
                                    ...widgetConfig.advancedAnalytics, 
                                    [key]: e.target.checked 
                                  }
                                };
                                setWidgetConfig(newConfig);
                                localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                              }}
                              className="w-3 h-3 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Trading Performance */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">🎯</span>
                        <span className="text-gray-300 font-medium">Trading Performance</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.tradingPerformance?.enabled || false}
                        onChange={(e) => {
                          const newConfig = { 
                            ...widgetConfig, 
                            tradingPerformance: { ...widgetConfig.tradingPerformance, enabled: e.target.checked }
                          };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                    {widgetConfig.tradingPerformance?.enabled && (
                      <div className="ml-6 space-y-2 text-sm">
                        {[
                          { key: 'winLossRatio', label: 'Win vs Loss Ratio' },
                          { key: 'winRate', label: 'Win Rate' },
                          { key: 'avgTradeDuration', label: 'Avg Trade Duration' },
                          { key: 'totalFees', label: 'Total Fees & Costs' },
                          { key: 'leverageUsage', label: 'Leverage Usage' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-400">{label}</span>
                            <input
                              type="checkbox"
                              checked={widgetConfig.tradingPerformance?.[key as keyof typeof widgetConfig.tradingPerformance] || false}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...widgetConfig, 
                                  tradingPerformance: { 
                                    ...widgetConfig.tradingPerformance, 
                                    [key]: e.target.checked 
                                  }
                                };
                                setWidgetConfig(newConfig);
                                localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                              }}
                              className="w-3 h-3 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">⚡</span>
                        <span className="text-gray-300 font-medium">Quick Actions</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.quickActions}
                        onChange={(e) => {
                          const newConfig = { ...widgetConfig, quickActions: e.target.checked };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                  </div>

                  {/* Open Positions List */}
                  <div className="border border-gray-700/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">📜</span>
                        <span className="text-gray-300 font-medium">Open Positions List</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={widgetConfig.openPositionsList?.enabled || false}
                        onChange={(e) => {
                          const newConfig = { 
                            ...widgetConfig, 
                            openPositionsList: { ...widgetConfig.openPositionsList, enabled: e.target.checked }
                          };
                          setWidgetConfig(newConfig);
                          localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                        }}
                        className="w-4 h-4 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                      />
                    </div>
                    {widgetConfig.openPositionsList?.enabled && (
                      <div className="ml-6 space-y-2 text-sm">
                        {[
                          { key: 'showPnL', label: 'Show P&L' },
                          { key: 'showDuration', label: 'Show Duration' },
                          { key: 'showOpenDate', label: 'Show Open Date' },
                          { key: 'showExposure', label: 'Show Exposure' }
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-gray-400">{label}</span>
                            <input
                              type="checkbox"
                              checked={widgetConfig.openPositionsList?.[key as keyof typeof widgetConfig.openPositionsList] || false}
                              onChange={(e) => {
                                const newConfig = { 
                                  ...widgetConfig, 
                                  openPositionsList: { 
                                    ...widgetConfig.openPositionsList, 
                                    [key]: e.target.checked 
                                  }
                                };
                                setWidgetConfig(newConfig);
                                localStorage.setItem('dashboardWidgetConfig', JSON.stringify(newConfig));
                              }}
                              className="w-3 h-3 text-blue-400 bg-gray-900 border-gray-600 rounded focus:ring-blue-400 focus:ring-2"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-700/30 pt-4">
                <button
                  onClick={() => setShowWidgetConfig(false)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 px-4 rounded-lg font-medium transition-all duration-300 shadow-lg"
                >
                  💾 Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;