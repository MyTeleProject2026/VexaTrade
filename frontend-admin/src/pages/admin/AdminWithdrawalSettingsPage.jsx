import { useEffect, useState } from "react";
import { RefreshCw, Save, TrendingUp } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";
import useToast from "../../components/ToastNotification";

export default function AdminWithdrawalSettingsPage() {
  const token = localStorage.getItem("adminToken") || localStorage.getItem("admin_token") || "";
  const { addToast, ToastContainer } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    min_withdrawal_from_profit: 10,
    max_withdrawal_from_profit: 1000,
    allow_withdrawal_before_target: true,
    restriction_message: "⚠️ Target not achieved yet. You can only withdraw from your profits."
  });
  
  async function loadSettings() {
    try {
      setLoading(true);
      const res = await adminApi.getWithdrawalSettings(token);
      if (res.data?.success) {
        setSettings(res.data.data);
      }
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSave() {
    try {
      setSaving(true);
      await adminApi.updateWithdrawalSettings(settings, token);
      addToast("Withdrawal settings updated successfully", "success");
    } catch (err) {
      addToast(getApiErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">Loading settings...</div>;
  }
  
  return (
    <div className="space-y-5">
      <ToastContainer />
      
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(163,230,53,0.10),transparent_18%)] p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-lime-300">Platform Controls</p>
          <h1 className="mt-2 text-2xl font-bold text-white">Profit Withdrawal Settings</h1>
          <p className="mt-2 text-sm text-slate-400">Configure withdrawal limits for users who haven't achieved their target yet.</p>
        </div>
      </section>
      
      <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-5">
        <h2 className="text-lg font-semibold text-white">Withdrawal Limits</h2>
        <p className="mt-1 text-sm text-slate-400">Users can only withdraw from profits until target is achieved</p>
        
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">Minimum Withdrawal (USDT)</label>
            <input
              type="number"
              min="1"
              value={settings.min_withdrawal_from_profit}
              onChange={(e) => setSettings({...settings, min_withdrawal_from_profit: Number(e.target.value)})}
              className="w-full rounded-xl border border-white/10 bg-[#050812] px-4 py-3 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-2">Maximum Withdrawal per Request (USDT)</label>
            <input
              type="number"
              min="1"
              value={settings.max_withdrawal_from_profit}
              onChange={(e) => setSettings({...settings, max_withdrawal_from_profit: Number(e.target.value)})}
              className="w-full rounded-xl border border-white/10 bg-[#050812] px-4 py-3 text-white"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.allow_withdrawal_before_target}
              onChange={(e) => setSettings({...settings, allow_withdrawal_before_target: e.target.checked})}
              className="h-4 w-4"
            />
            <label className="text-sm text-slate-300">Allow withdrawals before target achieved</label>
          </div>
          
          <div>
            <label className="block text-sm text-slate-300 mb-2">Warning Message</label>
            <textarea
              rows={3}
              value={settings.restriction_message}
              onChange={(e) => setSettings({...settings, restriction_message: e.target.value})}
              className="w-full rounded-xl border border-white/10 bg-[#050812] px-4 py-3 text-white"
              placeholder="Enter message shown to users when trying to withdraw before target"
            />
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
          >
            <Save size={16} className="inline mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
