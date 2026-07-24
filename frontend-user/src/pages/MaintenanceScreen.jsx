// frontend-user/src/pages/MaintenanceScreen.jsx
import { useState } from 'react';
import { RefreshCw, Shield, Clock, AlertTriangle } from 'lucide-react';
import { maintenanceApi } from '../services/maintenanceApi';

export default function MaintenanceScreen({ message, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(message);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await maintenanceApi.getStatus();
      if (response.success && !response.data.maintenance) {
        // Maintenance is over, reload the page
        window.location.reload();
      } else if (response.success && response.data.message) {
        setStatusMessage(response.data.message);
      }
    } catch (_) {
      // If error, keep showing maintenance
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050812] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <Shield size={40} className="text-cyan-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-cyan-400">VexaTrade</h1>
          <p className="text-sm text-slate-400 mt-1">Maintenance Mode</p>
        </div>

        {/* Maintenance Icon */}
        <div className="mb-6">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <Clock size={48} className="text-amber-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Message Card */}
        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-6 shadow-xl mb-6">
          <div className="flex items-center gap-2 justify-center mb-3">
            <AlertTriangle size={18} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">System Maintenance</span>
          </div>
          <p className="text-slate-300 leading-relaxed">{statusMessage}</p>
          <div className="mt-4 text-xs text-slate-500 border-t border-white/10 pt-4">
            <p>We're working to improve your experience.</p>
            <p className="mt-1">Estimated downtime: <span className="text-slate-400">Please check back shortly</span></p>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition disabled:opacity-60"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Checking...' : 'Check Status'}
        </button>

        <div className="mt-6 text-xs text-slate-500">
          <p>If you continue to see this message, please contact support.</p>
        </div>
      </div>
    </div>
  );
}
