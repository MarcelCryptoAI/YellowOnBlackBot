// Quick test of coinsService
import axios from 'axios';

const BYBIT_API_URL = 'https://api.bybit.com/v5/market/instruments-info';

async function testCoinsApi() {
  try {
    console.log('🔄 Testing Bybit API directly...');
    
    const response = await axios.get(BYBIT_API_URL, {
      params: {
        category: 'linear',
        limit: 1000
      },
      timeout: 15000
    });

    console.log('📊 API Response status:', response.status);
    console.log('📊 Data retCode:', response.data.retCode);
    
    if (response.data.retCode === 0) {
      const total = response.data.result.list.length;
      console.log('📊 Total instruments:', total);
      
      // Filter for copy trading compatible contracts
      let copyTradingCount = 0;
      response.data.result.list.forEach((item) => {
        if (item.quoteCoin === 'USDT' && item.status === 'Trading') {
          const maxLeverage = parseFloat(item.leverageFilter.maxLeverage);
          const minLeverage = parseFloat(item.leverageFilter.minLeverage);
          
          const isCopyTradingCompatible = 
            maxLeverage <= 100 &&
            maxLeverage >= 5 &&
            minLeverage >= 1 &&
            !item.symbol.includes('1000000') &&
            !item.symbol.includes('10000') &&
            !item.symbol.includes('1000CAT') &&
            !item.symbol.includes('1000TOSHI');
          
          if (isCopyTradingCompatible) {
            copyTradingCount++;
          }
        }
      });
      
      console.log('✅ Copy trading compatible contracts:', copyTradingCount);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCoinsApi();