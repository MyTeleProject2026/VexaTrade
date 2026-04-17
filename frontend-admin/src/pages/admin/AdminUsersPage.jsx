import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Eye, MailCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { adminApi, getApiErrorMessage } from "../../services/api";

function formatMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusBadge({ value }) {
  const status = String(value || "").toLowerCase();

  let className =
    "border border-white/10 bg-white/[0.04] text-slate-300";

  if (["active", "approved", "verified"].includes(status)) {
    className =
      "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  } else if (["pending"].includes(status)) {
    className =
      "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  } else if (
    ["disabled", "blocked", "rejected", "frozen", "not verified"].includes(status)
  ) {
    className =
      "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {String(value || "-").replaceAll("_", " ")}
    </span>
  );
}

function SmallStat({ label, value, valueClass = "text-white" }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-[#0a0e1a] p-4 shadow-xl">
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const token =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("admin_token") ||
    "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  async function loadUsers(silent = false) {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      setError("");
      const res = await adminApi.getUsers(token);
      setUsers(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      return [
        user.id,
        user.uid,
        user.name,
        user.first_name,
        user.last_name,
        user.email,
        user.country,
        user.status,
        user.kyc_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [users, search]);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-white/10 bg-[#0a0e1a] p-5 text-sm text-slate-300">
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_18%),linear-gradient(180deg,#111827_0%,#020617_100%)] p-5 shadow-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-cyan-300">
              User Security Control
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Users</h1>
            <p className="mt-2 text-sm text-slate-400">
              Review user account security, verification, wallet balance, and status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadUsers(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <section className="rounded-[24px] border border-white/10 bg-[#0a0e1a] shadow-xl">
        <div className="border-b border-white/10 px-4 py-4 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, UID, status, country..."
                className="w-full rounded-2xl border border-white/10 bg-[#050812]/70 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-cyan-500"
              />
            </div>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#050812]/70 px-4 py-3 text-sm text-slate-300">
              <Users size={15} />
              {filteredUsers.length} User{filteredUsers.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b border-white/10 bg-[#050812]/40 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 sm:px-5">User</th>
                <th className="px-4 py-3 sm:px-5">Balance</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 sm:px-5">KYC</th>
                <th className="px-4 py-3 sm:px-5">Email</th>
                <th className="px-4 py-3 sm:px-5">Country</th>
                <th className="px-4 py-3 text-right sm:px-5">Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-white/5 text-sm text-slate-300 ${
                    String(user.status || "").toLowerCase() === "frozen"
                      ? "bg-red-500/5"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 align-top sm:px-5">
                    <div className="font-semibold text-white">
                      {user.name || "-"}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      UID: {user.uid || "--"}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {user.email || "-"}
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top sm:px-5">
                    <div className="font-semibold text-white">
                      {formatMoney(user.balance)} USDT
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top sm:px-5">
                    <StatusBadge value={user.status || "active"} />
                  </td>

                  <td className="px-4 py-3 align-top sm:px-5">
                    <StatusBadge value={user.kyc_status || "not_submitted"} />
                  </td>

                  <td className="px-4 py-3 align-top sm:px-5">
                    <div className="inline-flex items-center gap-2">
                      <MailCheck size={13} className="text-slate-500" />
                      <StatusBadge
                        value={Number(user.email_verified || 0) === 1 ? "verified" : "not verified"}
                      />
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top sm:px-5">
                    <span className="text-sm text-slate-300">{user.country || "-"}</span>
                  </td>

                  <td className="px-4 py-3 align-top text-right sm:px-5">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                      <Eye size={15} />
                      View
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredUsers.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <SmallStat
          label="Active users"
          value={
            filteredUsers.filter(
              (item) => String(item.status || "").toLowerCase() === "active"
            ).length
          }
          valueClass="text-emerald-300"
        />

        <SmallStat
          label="Verified email"
          value={
            filteredUsers.filter((item) => Number(item.email_verified || 0) === 1)
              .length
          }
          valueClass="text-cyan-300"
        />

        <SmallStat
          label="KYC approved"
          value={
            filteredUsers.filter(
              (item) =>
                String(item.kyc_status || "").toLowerCase() === "approved"
            ).length
          }
          valueClass="text-cyan-300"
        />
      </section>
    </div>
  );
}