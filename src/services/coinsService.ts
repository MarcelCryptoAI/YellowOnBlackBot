// Standalone Coins Service - Copy Trading Compatible Contracts
interface CoinData {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  minPrice: string;
  maxPrice: string;
  tickSize: string;
  minQty: string;
  maxQty: string;
  qtyStep: string;
  maxLeverage: string;
  minLeverage: string;
  status: string;
}

interface CoinsDatabase {
  timestamp: number;
  total: number;
  symbols: string[];
  details: { [symbol: string]: CoinData };
  lastFetch: string;
  accountType: string;
}

class CoinsService {
  private static instance: CoinsService;
  private coinsData: CoinsDatabase | null = null;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  
  static getInstance(): CoinsService {
    if (!CoinsService.instance) {
      CoinsService.instance = new CoinsService();
    }
    return CoinsService.instance;
  }

  // Get copy trading compatible USDT perpetual coins (specific whitelist)
  async fetchCoinsFromBybit(progressCallback?: (progress: string) => void): Promise<CoinsDatabase> {
    try {
      progressCallback?.('🔄 Loading copy trading compatible contracts...');
      
      // Specific list of copy trading compatible contracts from Bybit
      const copyTradingSymbols = [
        'BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'BCHUSDT', 'LTCUSDT', 'XTZUSDT', 'LINKUSDT', 'ADAUSDT', 'DOTUSDT', 'UNIUSDT',
        'XEMUSDT', 'SUSHIUSDT', 'AAVEUSDT', 'DOGEUSDT', 'ETCUSDT', 'BNBUSDT', 'FILUSDT', 'SOLUSDT', 'XLMUSDT', 'TRXUSDT',
        'VETUSDT', 'THETAUSDT', 'COMPUSDT', 'AXSUSDT', 'SANDUSDT', 'MANAUSDT', 'KSMUSDT', 'ATOMUSDT', 'AVAXUSDT', 'CHZUSDT',
        'CRVUSDT', 'ENJUSDT', 'GRTUSDT', 'SHIB1000USDT', 'YFIUSDT', 'BSVUSDT', 'ICPUSDT', 'ALGOUSDT', 'DYDXUSDT', 'NEARUSDT',
        'IOSTUSDT', 'DASHUSDT', 'GALAUSDT', 'CELRUSDT', 'HBARUSDT', 'ONEUSDT', 'C98USDT', 'AGLDUSDT', 'MKRUSDT', 'COTIUSDT',
        'ALICEUSDT', 'EGLDUSDT', 'RUNEUSDT', 'ILVUSDT', 'FLOWUSDT', 'WOOUSDT', 'LRCUSDT', 'ENSUSDT', 'IOTXUSDT', 'CHRUSDT',
        'BATUSDT', 'STORJUSDT', 'SNXUSDT', 'SLPUSDT', 'ANKRUSDT', 'LPTUSDT', 'QTUMUSDT', 'CROUSDT', 'SXPUSDT', 'YGGUSDT',
        'ZECUSDT', 'IMXUSDT', 'SFPUSDT', 'AUDIOUSDT', 'ZENUSDT', 'SKLUSDT', 'CVCUSDT', 'RSRUSDT', 'STXUSDT', 'MASKUSDT',
        'REQUSDT', '1INCHUSDT', 'SPELLUSDT', 'ARUSDT', 'XMRUSDT', 'PEOPLEUSDT', 'IOTAUSDT', 'ICXUSDT', 'CELOUSDT', 'WAVESUSDT',
        'RVNUSDT', 'KNCUSDT', 'KAVAUSDT', 'ROSEUSDT', 'JASMYUSDT', 'QNTUSDT', 'ZILUSDT', 'NEOUSDT', 'CKBUSDT', 'SUNUSDT',
        'JSTUSDT', 'BANDUSDT', 'API3USDT', 'PAXGUSDT', 'KDAUSDT', 'APEUSDT', 'GMTUSDT', 'OGNUSDT', 'CTSIUSDT', 'ARPAUSDT',
        'ALPHAUSDT', 'ZRXUSDT', 'GLMRUSDT', 'SCRTUSDT', 'BAKEUSDT', 'ASTRUSDT', 'FXSUSDT', 'MINAUSDT', 'BOBAUSDT', '1000XECUSDT',
        'ACHUSDT', 'BALUSDT', 'MTLUSDT', 'CVXUSDT', 'XCNUSDT', 'FLMUSDT', 'CTCUSDT', 'LUNA2USDT', 'OPUSDT', 'ONTUSDT',
        'TRBUSDT', 'BELUSDT', 'USDCUSDT', 'LDOUSDT', 'INJUSDT', 'STGUSDT', '1000LUNCUSDT', 'ETHWUSDT', 'GMXUSDT', 'APTUSDT',
        'TWTUSDT', 'MAGICUSDT', '1000BONKUSDT', 'HIGHUSDT', 'COREUSDT', 'BLURUSDT', 'CFXUSDT', '1000FLOKIUSDT', 'SSVUSDT', 'RPLUSDT',
        'TUSDT', 'TRUUSDT', 'LQTYUSDT', 'HFTUSDT', 'RLCUSDT', 'ARBUSDT', 'IDUSDT', 'JOEUSDT', 'SUIUSDT', '1000PEPEUSDT',
        'EDUUSDT', 'ORDIUSDT', '10000LADYSUSDT', 'PHBUSDT', 'LEVERUSDT', 'RADUSDT', 'UMAUSDT', 'TONUSDT', 'MBOXUSDT', 'VRUSDT',
        'MAVUSDT', 'MDTUSDT', 'XVGUSDT', 'PENDLEUSDT', 'WLDUSDT', 'ARKMUSDT', 'AUCTIONUSDT', 'FORTHUSDT', 'ARKUSDT', 'KASUSDT',
        'BNTUSDT', 'GLMUSDT', 'CYBERUSDT', 'SEIUSDT', 'HIFIUSDT', 'OGUSDT', 'NMRUSDT', 'PERPUSDT', 'XVSUSDT', 'MNTUSDT',
        'ORBSUSDT', 'WAXPUSDT', 'BIGTIMEUSDT', 'GASUSDT', 'POLYXUSDT', 'POWRUSDT', 'STEEMUSDT', 'TIAUSDT', 'SNTUSDT', 'MEMEUSDT',
        'CAKEUSDT', 'TOKENUSDT', 'BEAMUSDT', '10000SATSUSDT', 'AERGOUSDT', 'AGIUSDT', 'PYTHUSDT', 'GODSUSDT', '1000RATSUSDT', 'MOVRUSDT',
        'SUPERUSDT', 'USTCUSDT', 'RAREUSDT', 'ONGUSDT', 'AXLUSDT', 'JTOUSDT', 'ACEUSDT', 'METISUSDT', 'XAIUSDT', 'WIFUSDT',
        'AIUSDT', 'MANTAUSDT', 'MYROUSDT', 'ONDOUSDT', 'ALTUSDT', 'TAOUSDT', '10000WENUSDT', 'JUPUSDT', 'ZETAUSDT', 'CETUSUSDT',
        'DYMUSDT', 'MAVIAUSDT', 'VTHOUSDT', 'PIXELUSDT', 'STRKUSDT', 'MOBILEUSDT', '1000TURBOUSDT', 'PORTALUSDT', 'SCAUSDT', 'AEVOUSDT',
        'VANRYUSDT', 'BOMEUSDT', 'OMUSDT', 'SLERFUSDT', 'ETHFIUSDT', 'ZKUSDT', 'POPCATUSDT', 'ORCAUSDT', 'DEGENUSDT', 'ENAUSDT',
        'WUSDT', 'TNSRUSDT', 'SAGAUSDT', 'ZBCNUSDT', 'OMNIUSDT', 'MERLUSDT', 'MEWUSDT', 'MELANIAUSDT', 'BRETTUSDT', 'SAFEUSDT',
        'REZUSDT', 'BBUSDT', 'VELOUSDT', 'NOTUSDT', '1000000MOGUSDT', 'DRIFTUSDT', 'PHAUSDT', 'RAYDIUMUSDT', 'GRIFFAINUSDT', 'DOGUSDT',
        'TRUMPUSDT', 'PONKEUSDT', 'TAIKOUSDT', '1000000BABYDOGEUSDT', 'IOUSDT', 'ZKJUSDT', 'ATHUSDT', 'LISTAUSDT', 'ZROUSDT', 'AEROUSDT',
        'AKTUSDT', 'AIXBTUSDT', '10000QUBICUSDT', 'HIVEUSDT', 'BIOUSDT', 'MOCAUSDT', 'PRCLUSDT', 'ZEREBROUSDT', 'UXLINKUSDT', 'A8USDT',
        'BANANAUSDT', 'ARCUSDT', 'AVAILUSDT', 'DEXEUSDT', 'GUSDT', 'RENDERUSDT', 'AI16ZUSDT', 'CGPTUSDT', 'SWARMSUSDT', 'EIGENUSDT',
        'NEIROETHUSDT', 'DOGSUSDT', 'SYNUSDT', 'SUNDOGUSDT', 'SLFUSDT', 'CHESSUSDT', 'POLUSDT', 'AVAAIUSDT', 'KMNOUSDT', 'PRIMEUSDT',
        'FLUXUSDT', 'CATIUSDT', 'HMSTRUSDT', '1000CATUSDT', 'REXUSDT', '1000MUMUUSDT', 'ALEOUSDT', '1000NEIROCTOUSDT', 'FBUSDT', 'COOKIEUSDT',
        'FIDAUSDT', 'MOODENGUSDT', 'ALCHUSDT', 'SOLVUSDT', 'GRASSUSDT', 'ACTUSDT', 'SCRUSDT', 'PUFFERUSDT', 'CARVUSDT', 'SPXUSDT',
        'DEEPUSDT', 'GOATUSDT', 'ALUUSDT', 'LUMIAUSDT', '1000XUSDT', 'TAIUSDT', 'VIRTUALUSDT', 'KAIAUSDT', 'SWELLUSDT', 'PNUTUSDT',
        'COWUSDT', 'HYPEUSDT', 'MAJORUSDT', 'FARTCOINUSDT', 'BANUSDT', 'USUALUSDT', 'FLOCKUSDT', 'SUSDT', 'MORPHOUSDT', 'OLUSDT',
        'CHILLGUYUSDT', 'ZRCUSDT', 'MEUSDT', '1000000CHEEMSUSDT', 'COOKUSDT', 'THEUSDT', 'PENGUUSDT', 'SOLOUSDT', '1000TOSHIUSDT', 'MOVEUSDT',
        'XIONUSDT', 'ACXUSDT', 'GIGAUSDT', 'KOMAUSDT', 'VELODROMEUSDT', 'VANAUSDT', 'PLUMEUSDT', 'ANIMEUSDT', 'VINEUSDT', '10000ELONUSDT',
        'VVVUSDT', 'JELLYJELLYUSDT', 'BERAUSDT', 'IPUSDT', 'TSTBSCUSDT', 'XDCUSDT', 'SOLAYERUSDT', 'B3USDT', 'SHELLUSDT', 'KAITOUSDT',
        'GPSUSDT', 'AVLUSDT', 'REDUSDT', 'XTERUSDT', 'NILUSDT', 'ROAMUSDT', 'SERAPHUSDT', 'BMTUSDT', 'FORMUSDT', 'MUBARAKUSDT',
        'SIRENUSDT', 'PARTIUSDT', 'WALUSDT', 'BANANAS31USDT', 'GUNUSDT', 'BABYUSDT', 'XAUTUSDT', 'MLNUSDT', 'INITUSDT', 'KERNELUSDT',
        'WCTUSDT', 'BANKUSDT', 'EPTUSDT', 'HYPERUSDT', 'OBTUSDT', 'SIGNUSDT', 'PUNDIXUSDT', 'SXTUSDT', 'OBOLUSDT', 'SKYAIUSDT',
        'SYRUPUSDT', 'SOONUSDT', 'BUSDT', 'HUMAUSDT', 'AUSDT', 'SOPHUSDT', 'LAUSDT'
      ];

      progressCallback?.('📊 Processing copy trading compatible contracts...');

      const symbols: string[] = [];
      const details: { [symbol: string]: CoinData } = {};

      // Coin-specific leverage limits (based on Bybit's actual limits)
      const leverageLimits: { [key: string]: string } = {
        // Major coins - Higher leverage
        'BTCUSDT': '100',
        'ETHUSDT': '100',
        
        // Large caps - High leverage
        'SOLUSDT': '75',
        'BNBUSDT': '75',
        'XRPUSDT': '75',
        'ADAUSDT': '75',
        'DOGEUSDT': '75',
        'MATICUSDT': '75',
        'DOTUSDT': '50',
        'LINKUSDT': '75',
        'LTCUSDT': '75',
        'AVAXUSDT': '50',
        'UNIUSDT': '50',
        'ATOMUSDT': '50',
        'XLMUSDT': '75',
        'TRXUSDT': '75',
        
        // Mid caps - Medium leverage
        'ARBUSDT': '50',
        'OPUSDT': '50',
        'INJUSDT': '50',
        'SUIUSDT': '50',
        'APTUSDT': '50',
        'NEARUSDT': '50',
        'FILUSDT': '50',
        'AAVEUSDT': '50',
        'MKRUSDT': '50',
        'AXSUSDT': '50',
        'SANDUSDT': '50',
        'MANAUSDT': '50',
        'GALAUSDT': '50',
        'APEUSDT': '50',
        'GMTUSDT': '50',
        'WLDUSDT': '50',
        
        // Default for others
        'default': '25'
      };

      // Add all symbols with coin-specific leverage data
      copyTradingSymbols.forEach(symbol => {
        symbols.push(symbol);
        const maxLeverage = leverageLimits[symbol] || leverageLimits['default'];
        
        details[symbol] = {
          symbol: symbol,
          baseCoin: symbol.replace('USDT', ''),
          quoteCoin: 'USDT',
          minPrice: '0.01',
          maxPrice: '1000000',
          tickSize: '0.01',
          minQty: '0.001',
          maxQty: '100000',
          qtyStep: '0.001',
          maxLeverage: maxLeverage,
          minLeverage: '1',
          status: 'Trading'
        };
      });

      progressCallback?.(`✅ Found ${symbols.length} copy trading compatible contracts`);

      const coinsDatabase: CoinsDatabase = {
        timestamp: Date.now(),
        total: symbols.length,
        symbols: symbols.sort(), // Sort alphabetically
        details,
        lastFetch: new Date().toISOString(),
        accountType: 'copy-trading'
      };

      // Save to localStorage
      this.saveToLocalStorage(coinsDatabase);
      this.coinsData = coinsDatabase;

      progressCallback?.('💾 Saved copy trading contracts to storage');
      
      return coinsDatabase;
    } catch (error: any) {
      progressCallback?.(`❌ Error: ${error.message}`);
      throw error;
    }
  }

  // Get coins from cache or fetch if expired
  async getCoins(forceRefresh = false, progressCallback?: (progress: string) => void): Promise<CoinsDatabase> {
    try {
      // Check if we have cached data and it's not expired
      if (!forceRefresh && this.coinsData) {
        const age = Date.now() - this.coinsData.timestamp;
        if (age < this.CACHE_DURATION) {
          progressCallback?.(`📦 Using cached copy trading contracts (${this.coinsData.total} contracts)`);
          return this.coinsData;
        }
      }

      // Try to load from localStorage if not in memory
      if (!forceRefresh && !this.coinsData) {
        const cachedData = this.loadFromLocalStorage();
        if (cachedData) {
          const age = Date.now() - cachedData.timestamp;
          if (age < this.CACHE_DURATION) {
            this.coinsData = cachedData;
            progressCallback?.(`📦 Loaded from storage (${cachedData.total} copy trading contracts)`);
            return cachedData;
          }
        }
      }

      // Fetch fresh data
      progressCallback?.('🔄 Fetching fresh copy trading contracts...');
      return await this.fetchCoinsFromBybit(progressCallback);
    } catch (error) {
      // If all else fails, return cached data even if expired
      const cachedData = this.loadFromLocalStorage();
      if (cachedData) {
        progressCallback?.('⚠️ Using expired cache due to API error');
        return cachedData;
      }
      throw error;
    }
  }

  // Get just the symbols array
  async getSymbols(forceRefresh = false, progressCallback?: (progress: string) => void): Promise<string[]> {
    const data = await this.getCoins(forceRefresh, progressCallback);
    return data.symbols;
  }

  // Get TradingView compatible symbols (with .P suffix for perpetuals)
  async getTradingViewSymbols(forceRefresh = false, progressCallback?: (progress: string) => void): Promise<string[]> {
    const symbols = await this.getSymbols(forceRefresh, progressCallback);
    return symbols.map(symbol => symbol.replace('USDT', 'USDT.P'));
  }

  // Convert Bybit symbol to TradingView format
  toTradingViewSymbol(symbol: string): string {
    return symbol.replace('USDT', 'USDT.P');
  }

  // Convert TradingView symbol to Bybit format
  fromTradingViewSymbol(symbol: string): string {
    return symbol.replace('USDT.P', 'USDT');
  }

  // Get leverage limits for a specific symbol
  getLeverageLimits(symbol: string): { min: number; max: number } {
    if (this.coinsData?.details[symbol]) {
      const coin = this.coinsData.details[symbol];
      return {
        min: parseFloat(coin.minLeverage),
        max: parseFloat(coin.maxLeverage)
      };
    }
    // Default fallback
    return { min: 1, max: 25 };
  }

  // Check if data needs refresh (24h+)
  needsRefresh(): boolean {
    if (!this.coinsData) return true;
    const age = Date.now() - this.coinsData.timestamp;
    return age >= this.CACHE_DURATION;
  }

  // Get cache age in hours
  getCacheAgeHours(): number {
    if (!this.coinsData) return 0;
    const age = Date.now() - this.coinsData.timestamp;
    return age / (60 * 60 * 1000);
  }

  private saveToLocalStorage(data: CoinsDatabase): void {
    try {
      localStorage.setItem('bybit_copy_trading_contracts', JSON.stringify(data));
      console.log('💾 Copy trading contracts saved to localStorage');
    } catch (error) {
      console.error('Failed to save contracts to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): CoinsDatabase | null {
    try {
      const data = localStorage.getItem('bybit_copy_trading_contracts');
      if (data) {
        const parsed = JSON.parse(data);
        console.log('📦 Loaded copy trading contracts from localStorage:', parsed.total, 'contracts');
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load contracts from localStorage:', error);
    }
    return null;
  }

  // Get contracts data info
  getInfo(): { total: number; lastFetch: string; cacheAge: number; accountType: string } | null {
    if (!this.coinsData) return null;
    return {
      total: this.coinsData.total,
      lastFetch: this.coinsData.lastFetch,
      cacheAge: this.getCacheAgeHours(),
      accountType: this.coinsData.accountType || 'copy-trading'
    };
  }
}

// Export singleton instance
export const coinsService = CoinsService.getInstance();
export type { CoinsDatabase, CoinData };