// frontend-admin/src/pages/admin/MaintenanceSettings.jsx
import { useState, useEffect } from 'react';
import { Shield, RefreshCw, AlertCircle, Save, Clock, X } from 'lucide-react';
import { adminApi } from '../../services/api';

export default function MaintenanceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    message: 'VexaTrade is currently undergoing scheduled maintenance. Please check back later.',
    auto_enabled: true,
    started_at: null
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const res = await adminApi.getMaintenanceSettings(token);
      if (res.data?.success) {
        setSettings(res.data.data);
      } else {
        setError('Failed to load maintenance settings');
      }
    } catch (err) {
      console.error('Load maintenance error:', err);
      setError(err.response?.data?.message || 'Failed to load maintenance settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const res = await adminApi.toggleMaintenance({
        enabled: settings.enabled,
        message: settings.message,
        auto_enabled: settings.auto_enabled
      }, token);
      
      if (res.data?.success) {
        setSuccess(res.data.message || 'Maintenance settings saved successfully');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(res.data?.message || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Save maintenance error:', err);
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Helper to format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch (_) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Maintenance Mode</h1>
          <p className="text-sm text-slate-400">Manage system maintenance settings</p>
        </div>
        <button
          onClick={loadSettings}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#0a0e1a] px-4 py-2 text-sm text-white hover:bg-white/5 transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 flex items-start justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-200">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 flex items-start justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-200">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-6 space-y-6">
        {/* Maintenance Toggle */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield size={18} className={settings.enabled ? 'text-amber-400' : 'text-emerald-400'} />
              <span className="font-semibold text-white">Maintenance Mode</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {settings.enabled 
                ? '⚠️ Maintenance mode is currently ACTIVE. Users will see the maintenance screen.' 
                : '✅ Maintenance mode is DISABLED. Users can access the platform normally.'}
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
              settings.enabled ? 'bg-amber-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                settings.enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Message Editor */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Maintenance Message
          </label>
          <textarea
            value={settings.message}
            onChange={(e) => setSettings({ ...settings, message: e.target.value })}
            rows={4}
            className="w-full rounded-xl border border-white/10 bg-[#050812] px-4 py-3 text-white outline-none focus:border-cyan-500 transition"
            placeholder="Enter the message users will see during maintenance..."
          />
          <p className="text-xs text-slate-500 mt-2">
            This message will be shown to all users when maintenance mode is active.
          </p>
        </div>

        {/* Auto-Maintenance Toggle */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-cyan-400" />
              <span className="font-semibold text-white">Auto-Maintenance</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {settings.auto_enabled 
                ? 'Auto-maintenance is ENABLED. System errors will automatically trigger maintenance mode.' 
                : 'Auto-maintenance is DISABLED. Maintenance must be enabled manually.'}
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, auto_enabled: !settings.auto_enabled })}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
              settings.auto_enabled ? 'bg-cyan-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                settings.auto_enabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Status Info - when maintenance is active */}
        {settings.enabled && settings.started_at && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-300 flex items-center gap-2">
              <Clock size={16} className="animate-pulse" />
              Maintenance started at: {formatDate(settings.started_at)}
            </p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 transition disabled:opacity-60 w-full sm:w-auto"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Preview Card */}
      <div className="rounded-xl border border-white/10 bg-[#0a0e1a] p-6">
        <h3 className="text-sm font-semibold text-slate-400 mb-3">Preview</h3>
        <div className="rounded-xl border border-white/10 bg-[#050812] p-6 text-center">
          <div className="flex items-center gap-2 justify-center mb-2">
            <Clock size={18} className="text-amber-400 animate-pulse" />
            <span className="text-sm font-semibold text-amber-300">System Maintenance</span>
          </div>
          <p className="text-slate-300">{settings.message}</p>
          <div className="mt-4 text-xs text-slate-500 border-t border-white/10 pt-4">
            <p>VexaTrade is currently under maintenance. Please check back later.</p>
            <button className="mt-2 inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs hover:bg-cyan-500/20 transition">
              <RefreshCw size={12} /> Check Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
