#!/usr/bin/env python3
"""
Fetch All ByBit Trading Symbols
"""

import asyncio
import json
from pybit.unified_trading import HTTP

async def get_all_bybit_symbols():
    print('🔍 Fetching ALL available ByBit trading pairs...')
    
    try:
        # Import ByBit connection
        with open('live_connections.json', 'r') as f:
            connections_data = json.load(f)
        
        # Use first active connection
        session = None
        for conn_id, conn_data in connections_data.items():
            if conn_data.get('status') == 'active':
                session = HTTP(
                    testnet=False,
                    api_key=conn_data['apiKey'],
                    api_secret=conn_data['secretKey']
                )
                break
        
        if not session:
            print('❌ No active ByBit connection found')
            return []
        
        # Get all USDT perpetual contracts
        print('📡 Fetching instruments from ByBit API...')
        instruments = session.get_instruments_info(category='linear')
        
        if instruments['retCode'] != 0:
            print(f'❌ Error fetching instruments: {instruments}')
            return []
            
        # Filter for USDT pairs and active trading
        usdt_pairs = []
        for instrument in instruments['result']['list']:
            if (instrument['quoteCoin'] == 'USDT' and 
                instrument['status'] == 'Trading' and
                instrument['contractType'] == 'LinearPerpetual'):
                usdt_pairs.append(instrument['symbol'])
        
        print(f'✅ Found {len(usdt_pairs)} active USDT trading pairs!')
        print()
        print('📊 First 20 symbols:')
        for i, symbol in enumerate(usdt_pairs[:20]):
            print(f'   {i+1:3d}. {symbol}')
        
        if len(usdt_pairs) > 20:
            print(f'   ... and {len(usdt_pairs) - 20} more symbols')
        
        print()
        print('💡 Sample of available trading pairs:')
        
        # Show some interesting categories
        btc_pairs = [s for s in usdt_pairs if 'BTC' in s][:5]
        eth_pairs = [s for s in usdt_pairs if 'ETH' in s][:5] 
        meme_pairs = [s for s in usdt_pairs if any(meme in s for meme in ['DOGE', 'SHIB', 'PEPE', 'FLOKI'])][:5]
        
        print(f'   🟠 BTC pairs: {btc_pairs}')
        print(f'   🔵 ETH pairs: {eth_pairs}')
        print(f'   🐕 Meme coins: {meme_pairs}')
        
        return usdt_pairs
        
    except Exception as e:
        print(f'❌ Error: {e}')
        import traceback
        traceback.print_exc()
        return []

if __name__ == "__main__":
    symbols = asyncio.run(get_all_bybit_symbols())
    print(f'\n🎯 Total symbols available for AI analysis: {len(symbols)}')