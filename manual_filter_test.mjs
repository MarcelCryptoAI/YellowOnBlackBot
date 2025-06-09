import fs from 'fs';

// Test the copy trading filter manually
console.log('🔄 Testing copy trading filter...');

try {
  // Read the current coin data
  const data = JSON.parse(fs.readFileSync('./bybit_usdt_perpetuals.json', 'utf8'));
  console.log('📊 Total coins in file:', data.total);
  
  // Apply copy trading filter (symbol-based only since we don't have leverage data)
  const filteredSymbols = data.symbols.filter(symbol => {
    // Copy trading specific filters
    const isCopyTradingCompatible = 
      // Exclude high multiplier meme coins (this filters out ~126 coins)
      !symbol.includes('1000000') && // Extreme meme coins (1M multiplier)
      !symbol.includes('10000') &&   // High multiplier tokens (10K multiplier)  
      !symbol.includes('1000');      // Standard meme coin multipliers (1K multiplier)
    
    return isCopyTradingCompatible;
  });
  
  console.log('✅ Copy trading compatible contracts:', filteredSymbols.length);
  console.log('📊 Filtered out:', data.total - filteredSymbols.length, 'coins');
  
  // Show some examples of what was filtered out
  const excluded = data.symbols.filter(symbol => 
    symbol.includes('1000000') || 
    symbol.includes('10000') || 
    symbol.includes('1000')
  );
  
  console.log('❌ Examples of excluded coins:', excluded.slice(0, 10));
  console.log('✅ Examples of included coins:', filteredSymbols.slice(0, 10));
  
} catch (error) {
  console.error('❌ Error:', error.message);
}