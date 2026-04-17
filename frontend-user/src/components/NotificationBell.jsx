import { useEffect, useState } from "react";
import { userApi } from "../services/api";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await userApi.getNotifications();
      setNotifications(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications");
    }
  };

  useEffect(() => {
    fetchNotifications();

    const interval = setInterval(fetchNotifications, 5000); // auto refresh
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id) => {
    await userApi.markNotificationRead(id);
    fetchNotifications();
  };

  const deleteNotification = async (id) => {
    await userApi.deleteNotification(id);
    fetchNotifications();
  };

  return (
    <div className="relative">
      {/* 🔔 Bell */}
      <button onClick={() => setOpen(!open)} className="relative text-white">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-xs px-2 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-[#050812] border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3 font-bold border-b border-gray-700">
            Notifications
          </div>

          {notifications.length === 0 && (
            <div className="p-4 text-gray-400">No notifications</div>
          )}

          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 border-b border-gray-700 ${
                n.is_read ? "opacity-60" : ""
              }`}
            >
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm text-gray-300">{n.message}</div>

              <div className="flex gap-2 mt-2">
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-green-400 text-xs"
                  >
                    Mark read
                  </button>
                )}

                <button
                  onClick={() => deleteNotification(n.id)}
                  className="text-red-400 text-xs"
                >
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