import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
// import DashboardPage from './pages/dashboard'; // Old dashboard disabled
import NewDashboard from './pages/new_dashboard'; // Drag & drop dashboard
import ManualOrderPage from './pages/manual_order';
import TradesPage from './pages/trades';
import StrategiesPage from './pages/strategies';
import NewStrategies from './pages/new_strategies';
import TradingStrategyBuilder from './pages/trading_strategy_builder';
import AdvancedStrategyBuilder from './pages/advanced_strategy_builder';
import ApiConfigPage from './components/ApiConfigPage';
import PositionsOrdersPage from './pages/positions_orders';

// New automation components
import StrategyEngineDashboard from './components/StrategyEngineDashboard';
import RiskManagementDashboard from './components/RiskManagementDashboard';
import MonitoringDashboard from './components/MonitoringDashboard';
import MassTradingDashboard from './components/MassTradingDashboard';
import AutomatedStrategyGenerator from './pages/AutomatedStrategyGenerator';

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<NewDashboard />} />
          {/* <Route path="dashboard-old" element={<DashboardPage />} /> */}
          <Route path="manual-order" element={<ManualOrderPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="strategies-builder" element={<AdvancedStrategyBuilder />} />
          <Route path="strategies-old" element={<NewStrategies />} />
          <Route path="strategies/builder" element={<TradingStrategyBuilder />} />
          <Route path="api" element={<ApiConfigPage />} />
          <Route path="positions-orders" element={<PositionsOrdersPage />} />
          
          {/* New automation routes */}
          <Route path="automation/engine" element={<StrategyEngineDashboard />} />
          <Route path="automation/risk" element={<RiskManagementDashboard />} />
          <Route path="automation/monitoring" element={<MonitoringDashboard />} />
          <Route path="automation/generator" element={<AutomatedStrategyGenerator />} />
          <Route path="mass-trading" element={<MassTradingDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;