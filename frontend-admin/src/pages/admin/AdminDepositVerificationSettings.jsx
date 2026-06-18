// AdminDepositVerificationSettings.jsx
import { useEffect, useState } from "react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

export default function AdminDepositVerificationSettings() {
  const token = localStorage.getItem("adminToken") || "";
  const { addToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await adminApi.getNetworkVerificationSettings(token);
      setSettings(res.data?.data || []);
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (id, field, value) => {
    try {
      await adminApi.updateNetworkVerificationSetting(id, { [field]: value }, token);
      addToast("Setting updated", "success");
      fetchSettings();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  };

  // ✅ Sync function
  const syncSettings = async () => {
    try {
      setSyncing(true);
      await adminApi.syncNetworkVerificationSettings(token);
      addToast("Settings synchronized from deposit wallets", "success");
      await fetchSettings();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <ToastContainer />

      {/* Header with Sync button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Network Verification Settings</h1>
        <button
          onClick={syncSettings}
          disabled={syncing}
          className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "🔄 Sync from Wallets"}
        </button>
      </div>

      <p className="text-sm text-slate-400">
        Prefix and suffix are automatically extracted from deposit wallet addresses.
        Click "Sync from Wallets" to update verification settings based on your deposit networks.
      </p>

      <div className="grid gap-4">
        {settings.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{s.network}</div>
              <span className={`text-xs ${s.is_active === 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                {s.is_active === 1 ? '✅ Active' : '❌ Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs text-slate-400">Prefix</label>
                <input
                  value={s.address_prefix || ''}
                  onChange={(e) => updateSetting(s.id, 'address_prefix', e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050812] px-2 py-1 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Suffix</label>
                <input
                  value={s.address_suffix || ''}
                  onChange={(e) => updateSetting(s.id, 'address_suffix', e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050812] px-2 py-1 text-white"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
