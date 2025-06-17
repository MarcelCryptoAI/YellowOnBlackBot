import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineStyle } from 'lightweight-charts';
import { GlassCard } from './GlassCard';

interface TradingChartProps {
  data?: Array<{
    time: string;
    value: number;
  }>;
  height?: number;
  variant?: 'portfolio' | 'price' | 'pnl';
}

export const TradingChart: React.FC<TradingChartProps> = ({ 
  data = [], 
  height = 400,
  variant = 'portfolio'
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use provided data or show loading state
  const chartData = data;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Chart configuration based on variant
    const getChartConfig = () => {
      const baseConfig = {
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#e5e7eb',
          fontSize: 12,
          fontFamily: 'Inter, sans-serif',
        },
        grid: {
          vertLines: { color: 'rgba(0, 212, 255, 0.1)' },
          horzLines: { color: 'rgba(0, 212, 255, 0.1)' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: 'rgba(0, 212, 255, 0.5)',
            width: 1,
            style: LineStyle.Dashed,
          },
          horzLine: {
            color: 'rgba(0, 212, 255, 0.5)',
            width: 1,
            style: LineStyle.Dashed,
          },
        },
        rightPriceScale: {
          borderColor: 'rgba(0, 212, 255, 0.2)',
          textColor: '#06b6d4',
        },
        timeScale: {
          borderColor: 'rgba(0, 212, 255, 0.2)',
          textColor: '#06b6d4',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      };

      return baseConfig;
    };

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      ...getChartConfig(),
    });

    chartRef.current = chart;

    // Create area series with variant-specific styling
    const getSeriesConfig = () => {
      switch (variant) {
        case 'portfolio':
          return {
            topColor: 'rgba(0, 212, 255, 0.4)',
            bottomColor: 'rgba(0, 212, 255, 0.05)',
            lineColor: 'rgba(0, 212, 255, 1)',
            lineWidth: 3,
          };
        case 'price':
          return {
            topColor: 'rgba(168, 85, 247, 0.4)',
            bottomColor: 'rgba(168, 85, 247, 0.05)',
            lineColor: 'rgba(168, 85, 247, 1)',
            lineWidth: 3,
          };
        case 'pnl':
          const isPositive = chartData[chartData.length - 1]?.value >= (chartData[0]?.value || 0);
          return {
            topColor: isPositive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
            bottomColor: isPositive ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
            lineColor: isPositive ? 'rgba(16, 185, 129, 1)' : 'rgba(239, 68, 68, 1)',
            lineWidth: 3,
          };
        default:
          return {
            topColor: 'rgba(0, 212, 255, 0.4)',
            bottomColor: 'rgba(0, 212, 255, 0.05)',
            lineColor: 'rgba(0, 212, 255, 1)',
            lineWidth: 3,
          };
      }
    };

    const areaSeries = chart.addAreaSeries(getSeriesConfig());
    seriesRef.current = areaSeries;

    // Set data
    areaSeries.setData(chartData);

    // Fit content to show all data
    chart.timeScale().fitContent();

    setIsLoading(false);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [chartData, height, variant]);

  const getTitle = () => {
    switch (variant) {
      case 'portfolio': return '💎 Portfolio Performance';
      case 'price': return '📈 Price Action';
      case 'pnl': return '💰 P&L Chart';
      default: return '📊 Trading Chart';
    }
  };

  const getCurrentValue = () => {
    if (chartData.length === 0) return '$0.00';
    const current = chartData[chartData.length - 1].value;
    return variant === 'pnl' 
      ? `${current >= 0 ? '+' : ''}$${current.toFixed(2)}`
      : `$${current.toLocaleString()}`;
  };

  const getPercentChange = () => {
    if (chartData.length < 2) return '+0.00%';
    const start = chartData[0].value;
    const end = chartData[chartData.length - 1].value;
    const change = ((end - start) / start) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  };

  const isPositive = chartData.length > 1 && 
    chartData[chartData.length - 1].value >= chartData[0].value;

  return (
    <GlassCard className="animate-fadeInUp relative" variant="default">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="section-title text-xl">{getTitle()}</h3>
          <div className="flex items-center space-x-4 mt-2">
            <span className="text-2xl font-bold text-white">
              {getCurrentValue()}
            </span>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              isPositive 
                ? 'text-success-green-light bg-success-green/20' 
                : 'text-danger-red-light bg-danger-red/20'
            }`}>
              {getPercentChange()}
            </span>
          </div>
        </div>
        
        {/* Live indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-success-green rounded-full"></div>
          <span className="text-success-green-light text-sm font-medium">Live</span>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl backdrop-blur-sm z-10">
            <div className="flex items-center space-x-3">
              <div className="animate-spin text-2xl">📊</div>
              <span className="text-info-cyan-light font-medium">Loading chart...</span>
            </div>
          </div>
        )}
        
        <div 
          ref={chartContainerRef} 
          className="w-full rounded-xl overflow-hidden border border-primary-blue/20"
          style={{ height: `${height}px` }}
        />
        
        {/* Chart overlay effects */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"></div>
      </div>

      {/* Chart Stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-gray-400 font-medium">24h High</div>
          <div className="text-white font-bold">
            ${Math.max(...chartData.map(d => d.value)).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 font-medium">24h Low</div>
          <div className="text-white font-bold">
            ${Math.min(...chartData.map(d => d.value)).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 font-medium">Volume</div>
          <div className="text-info-cyan-light font-bold">
            $2.4M
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default TradingChart;