import React, { useState } from 'react';

// Types
interface ApiCredentials {
  bybit: {
    apiKey: string;
    secretKey: string;
    testnet: boolean;
  };
  openai: {
    apiKey: string;
    organization: string;
  };
}

interface SystemStatus {
  backend: boolean;
  frontend: boolean;
  openai: boolean;
  bybit: boolean;
  mexc: boolean;
  binance: boolean;
}

interface ApiConfigPageProps {
  apiCredentials: ApiCredentials;
  systemStatus: SystemStatus;
  isTestingBybit: boolean;
  isTestingOpenAI: boolean;
  lastSaved: string;
  onUpdateBybitCredentials: (field: string, value: string | boolean) => void;
  onUpdateOpenAICredentials: (field: string, value: string) => void;
  onTestBybitConnection: () => void;
  onTestOpenAIConnection: () => void;
  onSaveApiSettings: () => void;
}

const ApiConfigPage: React.FC<ApiConfigPageProps> = ({
  apiCredentials,
  systemStatus,
  isTestingBybit,
  isTestingOpenAI,
  lastSaved,
  onUpdateBybitCredentials,
  onUpdateOpenAICredentials,
  onTestBybitConnection,
  onTestOpenAIConnection,
  onSaveApiSettings
}) => {
  const [showSecrets, setShowSecrets] = useState({
    bybitApiKey: false,
    bybitSecret: false,
    openaiKey: false
  });

  const toggleSecret = (field: keyof typeof showSecrets) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-yellow-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-yellow-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
          <h1 className="text-3xl font-bold flex items-center">
            <span className="mr-4 text-4xl">🔧</span>
            <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
              API CONFIGURATION
            </span>
          </h1>
          <p className="text-gray-400 mt-2">Configure your exchange and AI service connections</p>
          {lastSaved && (
            <p className="text-green-300 text-sm mt-2">✅ Last saved: {lastSaved}</p>
          )}
        </div>
      </div>

      {/* System Status Overview */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-yellow-400/5 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-white/30 transition-all duration-300 shadow-2xl shadow-black/50">
          <h3 className="text-xl font-bold mb-6 flex items-center">
            <span className="mr-3 text-2xl">🛡️</span>
            <span className="bg-gradient-to-r from-white via-gray-200 to-yellow-400 bg-clip-text text-transparent drop-shadow-lg">
              SYSTEM STATUS
            </span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(systemStatus).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-gray-900 to-black border border-gray-700/40 shadow-inner">
                <span className="text-gray-200 capitalize font-medium tracking-wide">{key}</span>
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{value ? '✅' : '❌'}</span>
                  <span className={`text-sm font-bold uppercase tracking-wider ${
                    value ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {value ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ByBit Configuration */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-orange-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-orange-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <div className="flex items-center mb-6">
              <img src="/bybit-logo.png" alt="ByBit" className="w-8 h-8 mr-3" onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }} />
              <h3 className="text-xl font-bold text-white">ByBit Configuration</h3>
              <div className={`ml-auto w-3 h-3 rounded-full ${
                systemStatus.bybit ? 'bg-green-400 shadow-green-400/50' : 'bg-red-400 shadow-red-400/50'
              } shadow-lg`}></div>
            </div>

            <div className="space-y-4">
              {/* API Key */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider">
                  🔑 API Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.bybitApiKey ? "text" : "password"}
                    placeholder="Enter your ByBit API Key"
                    value={apiCredentials.bybit.apiKey}
                    onChange={(e) => onUpdateBybitCredentials('apiKey', e.target.value)}
                    className="w-full bg-gradient-to-r from-gray-900 to-black border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all duration-300 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('bybitApiKey')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-200"
                  >
                    {showSecrets.bybitApiKey ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider">
                  🔐 Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.bybitSecret ? "text" : "password"}
                    placeholder="Enter your ByBit Secret Key"
                    value={apiCredentials.bybit.secretKey}
                    onChange={(e) => onUpdateBybitCredentials('secretKey', e.target.value)}
                    className="w-full bg-gradient-to-r from-gray-900 to-black border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-all duration-300 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('bybitSecret')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-400 transition-colors duration-200"
                  >
                    {showSecrets.bybitSecret ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Testnet Toggle */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-700/50">
                <div>
                  <span className="text-white font-medium">Testnet Mode</span>
                  <p className="text-gray-400 text-sm">Use ByBit testnet for safe testing</p>
                </div>
                <button
                  onClick={() => onUpdateBybitCredentials('testnet', !apiCredentials.bybit.testnet)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                    apiCredentials.bybit.testnet ? 'bg-orange-500' : 'bg-gray-600'
                  }`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${
                    apiCredentials.bybit.testnet ? 'transform translate-x-6' : ''
                  }`}></div>
                </button>
              </div>

              {/* Test Connection Button */}
              <button
                onClick={onTestBybitConnection}
                disabled={isTestingBybit || !apiCredentials.bybit.apiKey || !apiCredentials.bybit.secretKey}
                className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-orange-400/30 flex items-center justify-center space-x-2"
              >
                {isTestingBybit ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    <span>Test ByBit Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* OpenAI Configuration */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 to-green-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          <div className="relative bg-gradient-to-br from-black to-gray-900 p-6 rounded-xl border border-gray-600/30 hover:border-green-400/40 transition-all duration-300 shadow-2xl shadow-black/50">
            <div className="flex items-center mb-6">
              <div className="w-8 h-8 mr-3 bg-gradient-to-r from-green-400 to-green-500 rounded-lg flex items-center justify-center text-white font-bold">
                AI
              </div>
              <h3 className="text-xl font-bold text-white">OpenAI Configuration</h3>
              <div className={`ml-auto w-3 h-3 rounded-full ${
                systemStatus.openai ? 'bg-green-400 shadow-green-400/50' : 'bg-red-400 shadow-red-400/50'
              } shadow-lg`}></div>
            </div>

            <div className="space-y-4">
              {/* API Key */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider">
                  🤖 API Key
                </label>
                <div className="relative">
                  <input
                    type={showSecrets.openaiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={apiCredentials.openai.apiKey}
                    onChange={(e) => onUpdateOpenAICredentials('apiKey', e.target.value)}
                    className="w-full bg-gradient-to-r from-gray-900 to-black border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 transition-all duration-300 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecret('openaiKey')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-green-400 transition-colors duration-200"
                  >
                    {showSecrets.openaiKey ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300 uppercase tracking-wider">
                  🏢 Organization (Optional)
                </label>
                <input
                  type="text"
                  placeholder="org-..."
                  value={apiCredentials.openai.organization}
                  onChange={(e) => onUpdateOpenAICredentials('organization', e.target.value)}
                  className="w-full bg-gradient-to-r from-gray-900 to-black border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-green-400 focus:ring-2 focus:ring-green-400/20 transition-all duration-300"
                />
              </div>

              {/* Model Information */}
              <div className="p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-lg border border-gray-700/50">
                <h4 className="font-medium text-white mb-2">Available Models:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">GPT-4</span>
                    <span className="text-green-300">High accuracy, higher cost</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">GPT-3.5 Turbo</span>
                    <span className="text-yellow-300">Good balance, medium cost</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">GPT-3.5</span>
                    <span className="text-blue-300">Fast response, low cost</span>
                  </div>
                </div>
              </div>

              {/* Test Connection Button */}
              <button
                onClick={onTestOpenAIConnection}
                disabled={isTestingOpenAI || !apiCredentials.openai.apiKey}
                className="w-full bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-green-400/30 flex items-center justify-center space-x-2"
              >
                {isTestingOpenAI ? (
                  <>
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <span>🤖</span>
                    <span>Test OpenAI Connection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Settings */}
      <div className="flex justify-center pt-6">
        <button
          onClick={onSaveApiSettings}
          className="bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-2xl hover:shadow-yellow-400/30 flex items-center space-x-3"
        >
          <span className="text-2xl">💾</span>
          <span>SAVE API SETTINGS</span>
        </button>
      </div>

      {/* Security Notice */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
        <div className="relative bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-blue-500/30 shadow-2xl shadow-black/50">
          <div className="flex items-start space-x-4">
            <div className="text-3xl">🔒</div>
            <div>
              <h4 className="font-bold text-blue-300 mb-2">Security Notice</h4>
              <ul className="text-gray-300 text-sm space-y-1">
                <li>• API keys are encrypted before being stored</li>
                <li>• Never share your API keys with anyone</li>
                <li>• Use testnet mode for development and testing</li>
                <li>• Regularly rotate your API keys for security</li>
                <li>• Set appropriate permissions on your exchange APIs</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiConfigPage;