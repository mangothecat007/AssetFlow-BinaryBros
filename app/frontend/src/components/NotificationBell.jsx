import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { api, userStore } from "@/lib/api";

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const username = userStore.getUsername();

  const fetchNotifs = async () => {
    if (!username) return;
    try {
      const res = await api.get(`/notifications/${username}`);
      setNotifications(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [username]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      fetchNotifs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50 font-bold text-sm text-gray-800 flex justify-between">
            Notifications
            {unreadCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{unreadCount} New</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No notifications</div>
            ) : (
              notifications.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  className={`p-3 border-b border-gray-50 text-sm cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50/50 hover:bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="font-semibold text-gray-800 mb-0.5">{n.title}</div>
                  <div className="text-gray-600 text-xs mb-1">{n.message}</div>
                  <div className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
