import React, { useState } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { Wifi, WifiOff, Sync, CheckCircle, AlertCircle, Clock, HardDrive } from 'lucide-react';

export default function EnhancedOfflineIndicator() {
  const { isOnline, isSyncing, pendingCount, forceSync } = useOffline();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'bg-red-500';
    if (isSyncing) return 'bg-blue-500';
    if (pendingCount > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline Mode';
    if (isSyncing) return 'Syncing...';
    if (pendingCount > 0) return `${pendingCount} Pending`;
    return 'Online';
  };

  const getOfflineFeatures = () => [
    { icon: CheckCircle, text: 'View your progress', available: true },
    { icon: Database, text: 'Add daily check-ins', available: true },
    { icon: CheckCircle, text: 'Take progress photos', available: true },
    { icon: CheckCircle, text: 'Complete skin assessments', available: true },
    { icon: WifiOff, text: 'Real-time sync', available: false },
    { icon: WifiOff, text: 'Send messages', available: false }
  ];

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 max-w-sm mx-auto">
        {/* Main Status Bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`} />
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="w-4 h-4 text-gray-600" /> : <WifiOff className="w-4 h-4 text-gray-600" />}
              <span className="font-medium text-gray-900">{getStatusText()}</span>
            </div>
          </div>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Toggle offline details"
          >
            <AlertCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Progress */}
        {isSyncing && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Sync className="w-4 h-4 animate-spin" />
              <span>Syncing your data...</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-1 mt-2">
              <div className="bg-blue-500 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Pending Items */}
        {pendingCount > 0 && isOnline && !isSyncing && (
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <Clock className="w-4 h-4" />
                <span>{pendingCount} items waiting to sync</span>
              </div>
              <button
                onClick={forceSync}
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition-colors"
                disabled={isSyncing}
              >
                Sync Now
              </button>
            </div>
          </div>
        )}

        {/* Detailed Information */}
        {showDetails && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            {!isOnline && (
              <div className="mb-3">
                <h4 className="font-medium text-gray-900 mb-2">Offline Mode Active</h4>
                <p className="text-sm text-gray-600 mb-3">
                  You're currently offline. Your data will be saved locally and synced automatically when you're back online.
                </p>
                
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">Available Features:</h5>
                  <div className="grid grid-cols-1 gap-2">
                    {getOfflineFeatures().map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {feature.available ? (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-gray-400" />
                        )}
                        <span className={feature.available ? 'text-gray-700' : 'text-gray-400'}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isOnline && pendingCount > 0 && (
              <div className="mb-3">
                <h4 className="font-medium text-gray-900 mb-2">Pending Sync</h4>
                <p className="text-sm text-gray-600">
                  {pendingCount} items will be synced automatically. You can also sync manually.
                </p>
              </div>
            )}

            {/* Data Usage Info */}
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <HardDrive className="w-4 h-4" />
                <span>Local storage: Using offline database</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Data is encrypted and stored securely on your device
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
