#!/usr/bin/env python3
"""
AI Trading Optimizer - CTB Trading Bot
Real-time AI-powered parameter optimization en signal generation
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from openai import OpenAI
from dataclasses import dataclass

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AITradingSignal:
    symbol: str
    action: str  # BUY, SELL, HOLD
    confidence: float  # 0.0 - 1.0
    stop_loss_pct: float
    take_profit_pct: float
    position_size: float
    leverage: int
    reasoning: str
    timestamp: datetime

class AITradingOptimizer:
    """
    AI-powered trading optimizer voor real-time parameter optimization
    """
    
    def __init__(self):
        self.openai_client = None
        self.is_initialized = False
        self._setup_openai()
        
    def _setup_openai(self):
        """Setup OpenAI client"""
        try:
            # Load OpenAI API key
            with open('live_openai_connections.json', 'r') as f:
                openai_config = json.load(f)
                
            # Find active OpenAI connection
            for conn_id, config in openai_config.items():
                if config.get('status') == 'active':
                    api_key = config.get('apiKey')
                    if api_key and api_key != "YOUR_OPENAI_API_KEY_HERE":
                        self.openai_client = OpenAI(api_key=api_key)
                        self.is_initialized = True
                        logger.info("✅ OpenAI client initialized")
                        return
                        
            logger.warning("⚠️ No valid OpenAI API key found - AI features disabled")
            
        except Exception as e:
            logger.error(f"❌ Error setting up OpenAI: {e}")
    
    async def optimize_strategy_for_symbol(
        self,
        symbol: str,
        strategy_config: Dict[str, Any],
        criteria: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Optimize a strategy configuration for a specific symbol using AI and backtesting
        """
        try:
            logger.info(f"🎯 Optimizing strategy for {symbol}")
            
            # Get market data for the symbol
            market_data = await self._get_market_data(symbol)
            if not market_data:
                return None
            
            # Use AI to optimize strategy parameters
            optimization_prompt = f"""
            Optimize trading strategy parameters for {symbol} cryptocurrency.
            
            Current market data:
            - Price: ${market_data.get('price', 0)}
            - 24h Change: {market_data.get('change_24h', 0)}%
            - Volume: {market_data.get('volume_24h', 0)}
            - Volatility: {market_data.get('volatility', 'medium')}
            
            Strategy Configuration:
            {strategy_config}
            
            Optimization Criteria:
            - Minimum Win Rate: {criteria.get('min_win_rate', 60)}%
            - Maximum Drawdown: {criteria.get('max_drawdown', 15)}%
            - Minimum Total Trades: {criteria.get('min_total_trades', 50)}
            - Minimum Profit Factor: {criteria.get('min_profit_factor', 1.5)}
            - Minimum Sharpe Ratio: {criteria.get('min_sharpe_ratio', 1.0)}
            
            Optimize the strategy parameters to meet these criteria. Return a JSON response with:
            {{
                "meets_criteria": true/false,
                "optimized_params": {{
                    "entry_threshold": number,
                    "exit_threshold": number,
                    "stop_loss_percent": number,
                    "take_profit_percent": number,
                    "position_size": 5.0,
                    "leverage": 25
                }},
                "expected_performance": {{
                    "win_rate": number,
                    "profit_factor": number,
                    "max_drawdown": number,
                    "sharpe_ratio": number
                }},
                "reasoning": "explanation of optimization"
            }}
            """
            
            # Get AI optimization suggestions
            client = openai.OpenAI(api_key=self.openai_api_key)
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert cryptocurrency trading strategy optimizer. Always respond with valid JSON."},
                    {"role": "user", "content": optimization_prompt}
                ],
                max_tokens=1000,
                temperature=0.3
            )
            
            ai_response = response.choices[0].message.content
            
            try:
                optimization_result = json.loads(ai_response)
                
                # Validate the optimization result
                if optimization_result.get("meets_criteria", False):
                    # Run quick backtest simulation
                    backtest_results = await self._simulate_backtest(symbol, optimization_result["optimized_params"])
                    
                    # Check if backtest meets criteria
                    if self._meets_criteria(backtest_results, criteria):
                        return {
                            "config": optimization_result["optimized_params"],
                            "meets_criteria": True,
                            "performance": backtest_results,
                            "reasoning": optimization_result.get("reasoning", "AI optimized parameters")
                        }
                
                return {"meets_criteria": False, "reasoning": "Does not meet optimization criteria"}
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON response from AI for {symbol}")
                return None
                
        except Exception as e:
            logger.error(f"Error optimizing strategy for {symbol}: {e}")
            return None
    
    async def _get_market_data(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get current market data for a symbol"""
        try:
            # This would integrate with your market data service
            # For now, return simulated data
            import random
            return {
                "price": random.uniform(0.1, 100.0),
                "change_24h": random.uniform(-10, 10),
                "volume_24h": random.uniform(1000000, 10000000),
                "volatility": random.choice(["low", "medium", "high"])
            }
        except Exception as e:
            logger.error(f"Error getting market data for {symbol}: {e}")
            return None
    
    async def _simulate_backtest(self, symbol: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Simulate backtest results for optimized parameters"""
        try:
            # This would run actual backtesting
            # For now, return simulated realistic results
            import random
            
            win_rate = random.uniform(45, 85)
            total_trades = random.randint(30, 200)
            profit_factor = random.uniform(0.8, 3.0)
            max_drawdown = random.uniform(5, 25)
            sharpe_ratio = random.uniform(0.5, 2.5)
            
            return {
                "win_rate": win_rate,
                "total_trades": total_trades,
                "profit_factor": profit_factor,
                "max_drawdown": max_drawdown,
                "sharpe_ratio": sharpe_ratio,
                "total_pnl": random.uniform(-100, 500)
            }
        except Exception as e:
            logger.error(f"Error simulating backtest for {symbol}: {e}")
            return {}
    
    def _meets_criteria(self, backtest_results: Dict[str, Any], criteria: Dict[str, Any]) -> bool:
        """Check if backtest results meet the optimization criteria"""
        try:
            return (
                backtest_results.get("win_rate", 0) >= criteria.get("min_win_rate", 60) and
                backtest_results.get("max_drawdown", 100) <= criteria.get("max_drawdown", 15) and
                backtest_results.get("total_trades", 0) >= criteria.get("min_total_trades", 50) and
                backtest_results.get("profit_factor", 0) >= criteria.get("min_profit_factor", 1.5) and
                backtest_results.get("sharpe_ratio", 0) >= criteria.get("min_sharpe_ratio", 1.0)
            )
        except Exception as e:
            logger.error(f"Error checking criteria: {e}")
            return False

    async def analyze_market_and_generate_signal(
        self, 
        symbol: str, 
        market_data: Dict[str, Any],
        current_price: float
    ) -> Optional[AITradingSignal]:
        """
        Generate AI-powered trading signal met dynamische stop loss en take profit
        """
        if not self.is_initialized:
            return None
            
        try:
            # Prepare market analysis prompt
            prompt = f"""
You are an expert cryptocurrency trading AI analyzing {symbol} for optimal entry/exit parameters.

Current Market Data:
- Symbol: {symbol}
- Current Price: ${current_price}
- 24h Volume: {market_data.get('volume24h', 'N/A')}
- Price Change 24h: {market_data.get('priceChange24h', 'N/A')}%
- High 24h: ${market_data.get('high24h', 'N/A')}
- Low 24h: ${market_data.get('low24h', 'N/A')}

Trading Parameters:
- Position Size: $5 base
- Leverage: x25
- Max Risk per Trade: $25 (with leverage)

Analyze the market and provide:
1. Trading Action: BUY, SELL, or HOLD
2. Confidence Level: 0.0 - 1.0 (minimum 0.75 for execution)
3. Stop Loss Percentage: Optimal % based on volatility
4. Take Profit Percentage: Optimal % based on market conditions
5. Reasoning: Brief explanation

Respond in JSON format:
{{
    "action": "BUY|SELL|HOLD",
    "confidence": 0.85,
    "stop_loss_pct": 4.0,
    "take_profit_pct": 8.0,
    "reasoning": "Market shows strong bullish momentum with low volatility, ideal for leveraged position"
}}

Consider:
- Volatility for stop loss sizing
- Support/resistance levels
- Market sentiment
- Risk-reward ratio (minimum 1:2)
- Leverage amplification effects
"""

            # Make OpenAI API call
            response = await self._make_openai_request(prompt)
            
            if response:
                return AITradingSignal(
                    symbol=symbol,
                    action=response['action'],
                    confidence=response['confidence'],
                    stop_loss_pct=response['stop_loss_pct'],
                    take_profit_pct=response['take_profit_pct'],
                    position_size=5.0,  # Base $5
                    leverage=25,
                    reasoning=response['reasoning'],
                    timestamp=datetime.now(timezone.utc)
                )
                
        except Exception as e:
            logger.error(f"❌ Error generating AI signal for {symbol}: {e}")
            
        return None
    
    async def optimize_strategy_parameters(
        self,
        symbol: str,
        current_performance: Dict[str, Any],
        market_conditions: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Optimize strategy parameters based on performance and market conditions
        """
        if not self.is_initialized:
            return {}
            
        try:
            prompt = f"""
You are a quantitative trading strategist optimizing parameters for {symbol}.

Current Strategy Performance:
- Win Rate: {current_performance.get('win_rate', 0)}%
- Total PnL: ${current_performance.get('total_pnl', 0)}
- Total Trades: {current_performance.get('total_trades', 0)}
- Max Drawdown: {current_performance.get('max_drawdown', 0)}%

Market Conditions:
- Volatility: {market_conditions.get('volatility', 'N/A')}
- Trend Strength: {market_conditions.get('trend_strength', 'N/A')}
- Volume Profile: {market_conditions.get('volume_profile', 'N/A')}

Optimize these parameters for better performance:
1. Short MA Period (5-15)
2. Long MA Period (15-50)
3. RSI Period (10-21)
4. RSI Oversold Level (20-35)
5. RSI Overbought Level (65-80)

Respond in JSON format:
{{
    "short_ma": 8,
    "long_ma": 21,
    "rsi_period": 14,
    "rsi_oversold": 30,
    "rsi_overbought": 70,
    "confidence": 0.85,
    "reasoning": "Adjusted for current market volatility"
}}
"""

            response = await self._make_openai_request(prompt)
            return response or {}
            
        except Exception as e:
            logger.error(f"❌ Error optimizing parameters for {symbol}: {e}")
            return {}
    
    async def assess_portfolio_risk(
        self,
        current_positions: List[Dict[str, Any]],
        pending_signal: AITradingSignal
    ) -> Dict[str, Any]:
        """
        AI-powered portfolio risk assessment
        """
        if not self.is_initialized:
            return {"risk_level": "UNKNOWN", "recommendation": "HOLD"}
            
        try:
            positions_summary = []
            total_exposure = 0
            
            for pos in current_positions:
                positions_summary.append(f"{pos['symbol']}: ${pos['size']} (PnL: {pos['pnl']}%)")
                total_exposure += pos['size']
            
            prompt = f"""
You are a portfolio risk manager analyzing a new trade opportunity.

Current Portfolio:
- Active Positions: {len(current_positions)}
- Total Exposure: ${total_exposure}
- Position Details: {'; '.join(positions_summary)}

Pending Trade:
- Symbol: {pending_signal.symbol}
- Action: {pending_signal.action}
- Size: ${pending_signal.position_size} (x{pending_signal.leverage} leverage = ${pending_signal.position_size * pending_signal.leverage} exposure)
- AI Confidence: {pending_signal.confidence}

Risk Limits:
- Max Concurrent Positions: 10
- Max Total Exposure: $250 (with leverage)
- Max Position Size: $125 (with leverage)

Assess the risk and provide recommendation:

Respond in JSON format:
{{
    "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
    "recommendation": "EXECUTE|REDUCE_SIZE|HOLD|REJECT",
    "adjusted_size": 5.0,
    "reasoning": "Portfolio diversification is good, new position adds minimal correlation risk"
}}
"""

            response = await self._make_openai_request(prompt)
            return response or {"risk_level": "HIGH", "recommendation": "HOLD"}
            
        except Exception as e:
            logger.error(f"❌ Error assessing portfolio risk: {e}")
            return {"risk_level": "HIGH", "recommendation": "HOLD"}
    
    async def _make_openai_request(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Make OpenAI API request with error handling
        """
        try:
            response = await asyncio.to_thread(
                self.openai_client.chat.completions.create,
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert cryptocurrency trading AI. Always respond with valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3
            )
            
            content = response.choices[0].message.content.strip()
            
            # Parse JSON response
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
                
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {e}")
            return None

# Global AI optimizer instance
ai_optimizer = AITradingOptimizer()