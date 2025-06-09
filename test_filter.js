// Test copy trading filter
import fs from 'fs';

function testCopyTradingFilter() {
  try {
    console.log('🔄 Testing copy trading filter...');
    
    // Read the current coin data
    const data = JSON.parse(fs.readFileSync('./bybit_usdt_perpetuals.json', 'utf8'));
    console.log('📊 Total coins in file:', data.total);
    
    // Apply copy trading filter
    const filteredSymbols = data.symbols.filter(symbol => {
      // Copy trading specific filters
      const isCopyTradingCompatible = 
        !symbol.includes('1000000') && // Exclude extreme meme coins
        !symbol.includes('10000') &&   // Exclude high multiplier tokens
        !symbol.includes('1000CAT') && // Exclude specific meme patterns
        !symbol.includes('1000TOSHI'); // Exclude other meme patterns
      
      return isCopyTradingCompatible;
    });
    
    console.log('✅ Copy trading compatible contracts:', filteredSymbols.length);
    console.log('📊 Filtered out:', data.total - filteredSymbols.length, 'coins');
    
    // Show some examples of what was filtered out
    const excluded = data.symbols.filter(symbol => 
      symbol.includes('1000000') || 
      symbol.includes('10000') || 
      symbol.includes('1000CAT') || 
      symbol.includes('1000TOSHI')
    );
    
    console.log('❌ Examples of excluded coins:', excluded.slice(0, 10));
    console.log('✅ Examples of included coins:', filteredSymbols.slice(0, 10));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCopyTradingFilter();