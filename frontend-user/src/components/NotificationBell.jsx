import { useCallback, useEffect, useRef, useState } from "react";
import { userApi } from "../services/api";

const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const mountedRef = useRef(true);
  const requestInFlightRef = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    let timer;

    try {
      const response = await Promise.race([
        userApi.getNotifications(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("Notification request timed out")), REQUEST_TIMEOUT_MS);
        }),
      ]);

      if (!mountedRef.current) return;
      const data = response?.data?.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      if (mountedRef.current) console.error("Failed to fetch notifications", err);
    } finally {
      if (timer) clearTimeout(timer);
      requestInFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchNotifications();

    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    try {
      await userApi.markNotificationRead(id);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await userApi.deleteNotification(id);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative text-white" aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-xs px-2 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[#050812] border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 font-bold border-b border-gray-700">Notifications</div>

          {notifications.length === 0 && (
            <div className="p-4 text-gray-400">No notifications</div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 border-b border-gray-700 ${n.is_read ? "opacity-60" : ""}`}
            >
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-gray-300">{n.message}</div>

              <div className="flex gap-2 mt-2">
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-green-400 text-xs">
                    Mark read
                  </button>
                )}
                <button onClick={() => deleteNotification(n.id)} className="text-red-400 text-xs">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
