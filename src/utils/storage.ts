// Crypto utilities voor veilige opslag van API gegevens
import CryptoJS from 'crypto-js';

// Basis gebruiker info (later uit te breiden naar volledige gebruikersbeheer)
export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}

// Encrypted API credentials structuur
export interface EncryptedApiCredentials {
  userId: string;
  bybitConnections: Array<{
    id: string;
    name: string;
    apiKey: string; // encrypted
    secretKey: string; // encrypted
    testnet: boolean;
    markets: {
      spot: boolean;
      usdtPerpetual: boolean;
      inverseUsd: boolean;
    };
    createdAt: string;
    lastUsed: string;
  }>;
  openai: {
    apiKey: string; // encrypted
    organization: string;
    lastUsed: string;
  };
  encryptedAt: string;
}

// Storage keys
const STORAGE_KEYS = {
  USER_DATA: 'ctb_user_data',
  API_CREDENTIALS: 'ctb_api_credentials',
  ENCRYPTION_SALT: 'ctb_encryption_salt'
};

// Genereer een unieke sleutel voor deze gebruiker/sessie
const generateEncryptionKey = (userId: string, masterPassword: string = 'CTB_Marcel_2025'): string => {
  return CryptoJS.PBKDF2(masterPassword + userId, getSalt(), {
    keySize: 256 / 32,
    iterations: 1000
  }).toString();
};

// Verkrijg of maak een salt voor encryptie
const getSalt = (): string => {
  let salt = localStorage.getItem(STORAGE_KEYS.ENCRYPTION_SALT);
  if (!salt) {
    salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    localStorage.setItem(STORAGE_KEYS.ENCRYPTION_SALT, salt);
  }
  return salt;
};

// Encrypt data
const encryptData = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

// Decrypt data
const decryptData = (encryptedData: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Gebruikersbeheer functies
export const userStorage = {
  // Verkrijg of maak de standaard gebruiker Marcel
  getCurrentUser: (): User => {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.warn('Corrupted user data, creating new user');
      }
    }
    
    // Maak standaard gebruiker Marcel
    const marcel: User = {
      id: 'marcel_001',
      name: 'Marcel',
      email: 'marcel@ctb.local',
      createdAt: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(marcel));
    return marcel;
  },

  // Update gebruiker gegevens
  updateUser: (user: User): void => {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }
};

// API credentials opslag functies
export const apiStorage = {
  // Sla API credentials veilig op
  saveCredentials: (credentials: {
    bybitConnections: any[];
    openai: { apiKey: string; organization: string; };
  }): boolean => {
    try {
      const user = userStorage.getCurrentUser();
      const encryptionKey = generateEncryptionKey(user.id);
      
      // Prepare data voor encryptie
      const dataToEncrypt: EncryptedApiCredentials = {
        userId: user.id,
        bybitConnections: credentials.bybitConnections.map(conn => ({
          id: conn.id,
          name: conn.name,
          apiKey: encryptData(conn.apiKey, encryptionKey),
          secretKey: encryptData(conn.secretKey, encryptionKey),
          testnet: conn.testnet,
          markets: conn.markets,
          createdAt: conn.createdAt,
          lastUsed: new Date().toISOString()
        })),
        openai: {
          apiKey: credentials.openai.apiKey ? encryptData(credentials.openai.apiKey, encryptionKey) : '',
          organization: credentials.openai.organization,
          lastUsed: new Date().toISOString()
        },
        encryptedAt: new Date().toISOString()
      };
      
      // Sla encrypted data op
      localStorage.setItem(STORAGE_KEYS.API_CREDENTIALS, JSON.stringify(dataToEncrypt));
      
      console.log('✅ API credentials veilig opgeslagen voor gebruiker:', user.name);
      return true;
    } catch (error) {
      console.error('❌ Fout bij opslaan API credentials:', error);
      return false;
    }
  },

  // Laad API credentials veilig
  loadCredentials: (): {
    bybitConnections: any[];
    openai: { apiKey: string; organization: string; };
  } | null => {
    try {
      const user = userStorage.getCurrentUser();
      const stored = localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS);
      
      if (!stored) {
        console.log('📝 Geen opgeslagen API credentials gevonden');
        return null;
      }
      
      const encryptedData: EncryptedApiCredentials = JSON.parse(stored);
      
      // Controleer of data voor juiste gebruiker is
      if (encryptedData.userId !== user.id) {
        console.warn('⚠️  API credentials zijn voor andere gebruiker');
        return null;
      }
      
      const encryptionKey = generateEncryptionKey(user.id);
      
      // Decrypt en return credentials
      const decryptedCredentials = {
        bybitConnections: encryptedData.bybitConnections.map(conn => ({
          ...conn,
          apiKey: conn.apiKey ? decryptData(conn.apiKey, encryptionKey) : '',
          secretKey: conn.secretKey ? decryptData(conn.secretKey, encryptionKey) : ''
        })),
        openai: {
          apiKey: encryptedData.openai.apiKey ? decryptData(encryptedData.openai.apiKey, encryptionKey) : '',
          organization: encryptedData.openai.organization
        }
      };
      
      console.log('✅ API credentials succesvol geladen voor gebruiker:', user.name);
      return decryptedCredentials;
    } catch (error) {
      console.error('❌ Fout bij laden API credentials:', error);
      return null;
    }
  },

  // Verwijder alle opgeslagen credentials
  clearCredentials: (): void => {
    localStorage.removeItem(STORAGE_KEYS.API_CREDENTIALS);
    console.log('🗑️  API credentials verwijderd');
  },

  // Check of er opgeslagen credentials zijn
  hasStoredCredentials: (): boolean => {
    const user = userStorage.getCurrentUser();
    const stored = localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS);
    
    if (!stored) return false;
    
    try {
      const encryptedData: EncryptedApiCredentials = JSON.parse(stored);
      return encryptedData.userId === user.id;
    } catch {
      return false;
    }
  },

  // Verkrijg info over opgeslagen credentials zonder te decrypten
  getStorageInfo: () => {
    const user = userStorage.getCurrentUser();
    const stored = localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS);
    
    if (!stored) return null;
    
    try {
      const encryptedData: EncryptedApiCredentials = JSON.parse(stored);
      return {
        userId: encryptedData.userId,
        userName: user.name,
        bybitConnectionsCount: encryptedData.bybitConnections.length,
        hasOpenAI: !!encryptedData.openai.apiKey,
        lastSaved: encryptedData.encryptedAt,
        isCurrentUser: encryptedData.userId === user.id
      };
    } catch {
      return null;
    }
  }
};

// Utility functies
export const storageUtils = {
  // Maak een backup van alle data
  exportBackup: (): string => {
    const user = userStorage.getCurrentUser();
    const credentials = localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS);
    
    const backup = {
      user,
      credentials: credentials ? JSON.parse(credentials) : null,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    return JSON.stringify(backup, null, 2);
  },

  // Reset alle storage (voorzichtig gebruiken!)
  resetAllStorage: (): void => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🔄 Alle storage data gereset');
  },

  // Verkrijg storage statistieken
  getStorageStats: () => {
    const storageInfo = apiStorage.getStorageInfo();
    const user = userStorage.getCurrentUser();
    
    return {
      currentUser: user,
      hasCredentials: apiStorage.hasStoredCredentials(),
      storageInfo,
      totalStorageUsed: new Blob([JSON.stringify({
        user,
        credentials: localStorage.getItem(STORAGE_KEYS.API_CREDENTIALS)
      })]).size
    };
  }
};