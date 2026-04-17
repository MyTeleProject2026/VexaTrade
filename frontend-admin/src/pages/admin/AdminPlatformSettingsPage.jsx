import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Wallet, Percent, LifeBuoy, BadgeDollarSign } from "lucide-react";
import { adminApi, getApiErrorMessage } from "../../services/api";

function StatCard({ title, value, tone = "text-white" }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{title}</div>
      <div className={`mt-3 text-2xl font-semibold sm:text-3xl ${tone}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, valueClassName = "text-white" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right text-sm ${valueClassName}`}>{value}</span>
    </div>
  );
}

export default function AdminPlatformSettingsPage() {
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    wallet_label: "Main Wallet",
    default_convert_fee_percent: "0.20",
    support_channel: "Telegram",
    support_contact: "",
    support_link: "",
    support_note: "",
    withdrawal_fee_btc_bep20: "0",
    withdrawal_fee_eth_erc20: "0",
    withdrawal_fee_usdt_trc20: "0",
    withdrawal_fee_usdt_erc20: "0",
    withdrawal_fee_usdt_bep20: "0",
  });

  useEffect(() => {
    loadSettings(true);
  }, [token]);

  async function loadSettings(isFirstLoad = false) {
    try {
      if (isFirstLoad) setLoading(true);
      else setRefreshing(true);

      setError("");
      setSuccess("");

      const [settingsRes, supportRes, feeRes] = await Promise.allSettled([
        adminApi.getSettings(token),
        adminApi.getSupportSettings(token),
        adminApi.getWithdrawalFees(token),
      ]);

      const nextForm = {
        wallet_label: "Main Wallet",
        default_convert_fee_percent: "0.20",
        support_channel: "Telegram",
        support_contact: "",
        support_link: "",
        support_note: "",
        withdrawal_fee_btc_bep20: "0",
        withdrawal_fee_eth_erc20: "0",
        withdrawal_fee_usdt_trc20: "0",
        withdrawal_fee_usdt_erc20: "0",
        withdrawal_fee_usdt_bep20: "0",
      };

      if (settingsRes.status === "fulfilled") {
        const rows = Array.isArray(settingsRes.value.data?.data)
          ? settingsRes.value.data.data
          : [];

        rows.forEach((item) => {
          const key = String(item.setting_key || item.key || "");
          const value = String(item.setting_value || item.value || "");

          if (key === "wallet_label") nextForm.wallet_label = value || "Main Wallet";
          if (key === "default_convert_fee_percent") {
            nextForm.default_convert_fee_percent = value || "0.20";
          }
        });
      }

      if (supportRes.status === "fulfilled") {
        const support = supportRes.value.data?.data || {};
        nextForm.support_channel = support.channel || "Telegram";
        nextForm.support_contact = support.contact || "";
        nextForm.support_link = support.link || "";
        nextForm.support_note = support.note || "";
      }

      if (feeRes.status === "fulfilled") {
        const fees = Array.isArray(feeRes.value.data?.data)
          ? feeRes.value.data.data
          : [];

        fees.forEach((fee) => {
          const coin = String(fee.coin || "").toUpperCase();
          const network = String(fee.network || "").toUpperCase();
          const amount = String(fee.fee_amount ?? "0");

          if (coin === "BTC" && network === "BEP20") {
            nextForm.withdrawal_fee_btc_bep20 = amount;
          }
          if (coin === "ETH" && network === "ERC20") {
            nextForm.withdrawal_fee_eth_erc20 = amount;
          }
          if (coin === "USDT" && network === "TRC20") {
            nextForm.withdrawal_fee_usdt_trc20 = amount;
          }
          if (coin === "USDT" && network === "ERC20") {
            nextForm.withdrawal_fee_usdt_erc20 = amount;
          }
          if (coin === "USDT" && network === "BEP20") {
            nextForm.withdrawal_fee_usdt_bep20 = amount;
          }
        });
      }

      setForm(nextForm);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function saveBaseSettings() {
    await Promise.all([
      adminApi.updateSetting(
        "wallet_label",
        { value: String(form.wallet_label || "").trim() },
        token
      ),
      adminApi.updateSetting(
        "default_convert_fee_percent",
        { value: String(form.default_convert_fee_percent || "0").trim() },
        token
      ),
    ]);
  }

  async function saveSupportSettings() {
    await adminApi.updateSupportSettings(
      {
        channel: String(form.support_channel || "").trim(),
        contact: String(form.support_contact || "").trim(),
        link: String(form.support_link || "").trim(),
        note: String(form.support_note || "").trim(),
      },
      token
    );
  }

  async function saveWithdrawalFees() {
    const feePayloads = [
      {
        coin: "BTC",
        network: "BEP20",
        fee_amount: Number(form.withdrawal_fee_btc_bep20 || 0),
        fee_type: "fixed",
        status: "active",
      },
      {
        coin: "ETH",
        network: "ERC20",
        fee_amount: Number(form.withdrawal_fee_eth_erc20 || 0),
        fee_type: "fixed",
        status: "active",
      },
      {
        coin: "USDT",
        network: "TRC20",
        fee_amount: Number(form.withdrawal_fee_usdt_trc20 || 0),
        fee_type: "fixed",
        status: "active",
      },
      {
        coin: "USDT",
        network: "ERC20",
        fee_amount: Number(form.withdrawal_fee_usdt_erc20 || 0),
        fee_type: "fixed",
        status: "active",
      },
      {
        coin: "USDT",
        network: "BEP20",
        fee_amount: Number(form.withdrawal_fee_usdt_bep20 || 0),
        fee_type: "fixed",
        status: "active",
      },
    ];

    await Promise.all(
      feePayloads.map((payload) => adminApi.saveWithdrawalFee(payload, token))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await saveBaseSettings();
      await saveSupportSettings();
      await saveWithdrawalFees();

      setSuccess("Platform settings updated successfully.");
      await loadSettings(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    return {
      wallet: form.wallet_label || "Main Wallet",
      convertFee: `${Number(form.default_convert_fee_percent || 0).toFixed(2)}%`,
      support: form.support_channel || "Telegram",
      usdtTrc20: Number(form.withdrawal_fee_usdt_trc20 || 0).toFixed(2),
    };
  }, [form]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-300">
        Loading platform settings...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.10),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-violet-300">
              Platform Settings
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Global Platform Control
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage wallet label, convert fee, support contact, and withdrawal fees from one page.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                refreshing
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                  : "border-white/10 bg-slate-950/70 text-slate-300"
              }`}
            >
              <span
                className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
                  refreshing ? "animate-pulse bg-cyan-400" : "bg-emerald-400"
                }`}
              />
              {refreshing ? "Refreshing..." : "Settings Ready"}
            </span>

            <button
              type="button"
              onClick={() => loadSettings(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Wallet Label" value={summary.wallet} />
        <StatCard title="Convert Fee" value={summary.convertFee} tone="text-cyan-300" />
        <StatCard title="Support Channel" value={summary.support} tone="text-emerald-300" />
        <StatCard title="USDT TRC20 Fee" value={summary.usdtTrc20} tone="text-amber-300" />
      </section>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
            <div className="mb-5 flex items-center gap-3">
              <Wallet className="h-4 w-4 text-violet-300" />
              <h2 className="text-lg font-semibold text-white">General Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Wallet Label
                </label>
                <input
                  type="text"
                  name="wallet_label"
                  value={form.wallet_label}
                  onChange={handleChange}
                  placeholder="Main Wallet"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Default Convert Fee Percent
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="default_convert_fee_percent"
                  value={form.default_convert_fee_percent}
                  onChange={handleChange}
                  placeholder="0.20"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 space-y-2 text-sm">
                <DetailRow label="Wallet Label" value={form.wallet_label || "Main Wallet"} />
                <DetailRow
                  label="Convert Fee"
                  value={`${Number(form.default_convert_fee_percent || 0).toFixed(2)}%`}
                  valueClassName="text-cyan-300"
                />
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
            <div className="mb-5 flex items-center gap-3">
              <LifeBuoy className="h-4 w-4 text-emerald-300" />
              <h2 className="text-lg font-semibold text-white">Support Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Support Channel
                </label>
                <input
                  type="text"
                  name="support_channel"
                  value={form.support_channel}
                  onChange={handleChange}
                  placeholder="Telegram / WhatsApp / Line"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Support Contact
                </label>
                <input
                  type="text"
                  name="support_contact"
                  value={form.support_contact}
                  onChange={handleChange}
                  placeholder="@support_username or phone number"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Support Link
                </label>
                <input
                  type="text"
                  name="support_link"
                  value={form.support_link}
                  onChange={handleChange}
                  placeholder="https://t.me/your_support"
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-300">
                  Support Note
                </label>
                <textarea
                  name="support_note"
                  value={form.support_note}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Available hours, response time, special instructions..."
                  className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-xl sm:p-5">
          <div className="mb-5 flex items-center gap-3">
            <BadgeDollarSign className="h-4 w-4 text-cyan-300" />
            <h2 className="text-lg font-semibold text-white">Withdrawal Fees by Network</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm text-slate-300">
                BTC BEP20
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                name="withdrawal_fee_btc_bep20"
                value={form.withdrawal_fee_btc_bep20}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                ETH ERC20
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                name="withdrawal_fee_eth_erc20"
                value={form.withdrawal_fee_eth_erc20}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                USDT TRC20
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                name="withdrawal_fee_usdt_trc20"
                value={form.withdrawal_fee_usdt_trc20}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                USDT ERC20
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                name="withdrawal_fee_usdt_erc20"
                value={form.withdrawal_fee_usdt_erc20}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-300">
                USDT BEP20
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                name="withdrawal_fee_usdt_bep20"
                value={form.withdrawal_fee_usdt_bep20}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm space-y-2">
            <DetailRow label="BTC BEP20" value={form.withdrawal_fee_btc_bep20 || "0"} />
            <DetailRow label="ETH ERC20" value={form.withdrawal_fee_eth_erc20 || "0"} />
            <DetailRow label="USDT TRC20" value={form.withdrawal_fee_usdt_trc20 || "0"} valueClassName="text-cyan-300" />
            <DetailRow label="USDT ERC20" value={form.withdrawal_fee_usdt_erc20 || "0"} />
            <DetailRow label="USDT BEP20" value={form.withdrawal_fee_usdt_bep20 || "0"} />
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Platform Settings"}
          </button>

          <button
            type="button"
            onClick={() => loadSettings(false)}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5"
          >
            Reload Data
          </button>
        </div>
      </form>
    </div>
  );
}