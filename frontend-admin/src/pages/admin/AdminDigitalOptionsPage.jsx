import { useEffect, useState } from "react";
import { adminApi } from "../../services/api";

const EMPTY_SETTINGS = {
  payout_rate: "",
  max_stake_usdt: "",
  manual_outcome_override: "false",
};

export default function AdminDigitalOptionsPage() {
  const [rows, setRows] = useState([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [message, setMessage] = useState("");
  const token = localStorage.getItem("adminToken") || "";

  const load = async () => {
    try {
      const [queueResponse, settingsResponse] = await Promise.all([
        adminApi.getDigitalOptionsPending(token),
        adminApi.getDigitalOptionsSettings(token),
      ]);

      setRows(queueResponse.data?.data || []);

      const list = settingsResponse.data?.data || [];
      setSettings((current) => ({
        ...current,
        ...Object.fromEntries(
          list.map((item) => [item.setting_key, item.setting_value])
        ),
      }));
    } catch (error) {
      setMessage(
        error?.response?.data?.message ||
          "Unable to load Digital Options settings and settlement queue."
      );
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  const override = async (tradeId, outcome) => {
    try {
      await adminApi.overrideDigitalOption(
        {
          tradeId,
          outcome,
          note: "Admin settlement review",
        },
        token
      );
      setMessage(`Trade #${tradeId} updated.`);
      await load();
    } catch (error) {
      setMessage(
        error?.response?.data?.message || "Digital Options override failed."
      );
    }
  };

  const saveSettings = async () => {
    try {
      await adminApi.updateDigitalOptionsSettings(
        {
          payout_rate: Number(settings.payout_rate),
          max_stake_usdt: Number(settings.max_stake_usdt),
          manual_outcome_override:
            String(settings.manual_outcome_override) === "true",
        },
        token
      );
      setMessage("Digital Options settings saved.");
      await load();
    } catch (error) {
      setMessage(
        error?.response?.data?.message || "Digital Options settings update failed."
      );
    }
  };

  return (
    <div className="p-4 text-white">
      <div className="mx-auto max-w-6xl space-y-4">
        <header>
          <h1 className="text-2xl font-bold">
            Long-Horizon Digital Options
          </h1>
          <p className="text-xs text-slate-400">
            Live settlement queue and controlled settings.
          </p>
        </header>

        {message && (
          <div className="rounded-xl border border-white/10 p-3 text-xs">
            {message}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((trade) => (
            <article
              key={trade.id}
              className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4"
            >
              <b>
                #{trade.id} {trade.asset_pair} {trade.direction}
              </b>

              <div className="mt-2 text-xs text-slate-400">
                {trade.email}
                <br />
                Stake {Number(trade.stake_amount).toFixed(2)} USDT
                <br />
                Expires {new Date(trade.expiration_time).toLocaleString()}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => override(trade.id, "FORCE_WIN")}
                  className="rounded-lg bg-emerald-500/15 p-2 text-xs text-emerald-300"
                >
                  Win
                </button>
                <button
                  type="button"
                  onClick={() => override(trade.id, "FORCE_LOSS")}
                  className="rounded-lg bg-rose-500/15 p-2 text-xs text-rose-300"
                >
                  Loss
                </button>
                <button
                  type="button"
                  onClick={() => override(trade.id, "FORCE_REFUND")}
                  className="rounded-lg bg-cyan-500/15 p-2 text-xs text-cyan-300"
                >
                  Refund
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
          <h2 className="font-bold">Settings</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">
              Payout rate
              <input
                value={settings.payout_rate || ""}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    payout_rate: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] p-2 text-white"
              />
            </label>

            <label className="text-xs text-slate-400">
              Max stake USDT
              <input
                value={settings.max_stake_usdt || ""}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    max_stake_usdt: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] p-2 text-white"
              />
            </label>

            <label className="text-xs text-slate-400">
              Manual outcome override
              <select
                value={String(settings.manual_outcome_override || "false")}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    manual_outcome_override: event.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-white/10 bg-[#050812] p-2 text-white"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            className="mt-4 rounded-xl border border-cyan-300/20 px-4 py-3 text-xs font-bold text-cyan-200"
          >
            Save settings
          </button>
        </section>
      </div>
    </div>
  );
}
