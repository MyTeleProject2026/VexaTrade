// AdminDepositVerificationSettings.jsx
import { useEffect, useState } from "react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

export default function AdminDepositVerificationSettings() {
  const token = localStorage.getItem("adminToken") || "";
  const { addToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = async (id, field, value) => {
    try {
      await adminApi.updateNetworkVerificationSetting(id, { [field]: value }, token);
      addToast("Setting updated", "success");
      fetchSettings();
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <ToastContainer />
      <h1 className="text-2xl font-bold text-white">Network Verification Settings</h1>
      <div className="grid gap-4">
        {settings.map((s) => (
          <div key={s.id} className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
            <div className="font-semibold text-white">{s.network}</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs text-slate-400">Prefix</label>
                <input
                  value={s.address_prefix}
                  onChange={(e) => updateSetting(s.id, 'address_prefix', e.target.value)}
                  className="w-full rounded border border-white/10 bg-[#050812] px-2 py-1 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Suffix</label>
                <input
                  value={s.address_suffix}
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
