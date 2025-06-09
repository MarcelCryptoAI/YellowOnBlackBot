#!/bin/bash

# Fetch all USDT perpetual coins from Bybit API
echo "Fetching USDT perpetual coins from Bybit..."

# Make the API call and save to a JSON file
curl -s -X GET "https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000" | \
python3 -c "
import json
import sys

data = json.load(sys.stdin)
if data['retCode'] == 0:
    symbols = []
    coin_data = {}
    
    for item in data['result']['list']:
        if item['quoteCoin'] == 'USDT' and item['status'] == 'Trading':
            symbol = item['symbol']
            symbols.append(symbol)
            
            # Extract additional info
            coin_data[symbol] = {
                'symbol': symbol,
                'baseCoin': item['baseCoin'],
                'quoteCoin': item['quoteCoin'],
                'minPrice': item['priceFilter']['minPrice'],
                'maxPrice': item['priceFilter']['maxPrice'],
                'tickSize': item['priceFilter']['tickSize'],
                'minQty': item['lotSizeFilter']['minOrderQty'],
                'maxQty': item['lotSizeFilter']['maxOrderQty'],
                'qtyStep': item['lotSizeFilter']['qtyStep'],
                'maxLeverage': item['leverageFilter']['maxLeverage'],
                'minLeverage': item['leverageFilter']['minLeverage']
            }
    
    # Save to file
    output = {
        'total': len(symbols),
        'symbols': symbols,
        'details': coin_data
    }
    
    with open('bybit_usdt_perpetuals.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f'✅ Successfully fetched {len(symbols)} USDT perpetual coins')
    print(f'📁 Data saved to bybit_usdt_perpetuals.json')
    print(f'\\n📊 Sample coins:')
    for symbol in symbols[:10]:
        leverage = coin_data[symbol]['maxLeverage']
        print(f'  - {symbol} (max leverage: {leverage}x)')
else:
    print(f'❌ Error: {data[\"retMsg\"]}')
"