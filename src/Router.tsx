import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import DashboardPage from './pages/dashboard';
import ManualOrderPage from './pages/manual_order';
import TradesPage from './pages/trades';
import StrategiesPage from './pages/strategies';
import TradingStrategyBuilder from './pages/trading_strategy_builder';
import ApiConfigPage from './components/ApiConfigPage';

const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="manual-order" element={<ManualOrderPage />} />
          <Route path="trades" element={<TradesPage />} />
          <Route path="strategies" element={<StrategiesPage />} />
          <Route path="strategies/builder" element={<TradingStrategyBuilder />} />
          <Route path="api" element={<ApiConfigPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default Router;