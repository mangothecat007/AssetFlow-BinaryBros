import React, { useState, useEffect } from "react";
import { Bell, Package, Wrench, FileText, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const Notifications = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get("/activity_logs");
        setLogs(res.data);
      } catch (e) {
        console.error("Failed to fetch logs", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'allocation': return <Package className="w-5 h-5 text-blue-600" />;
      case 'maintenance': return <Wrench className="w-5 h-5 text-amber-600" />;
      case 'audit': return <FileText className="w-5 h-5 text-emerald-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBg = (type) => {
    switch (type) {
      case 'allocation': return 'bg-blue-100';
      case 'maintenance': return 'bg-amber-100';
      case 'audit': return 'bg-emerald-100';
      default: return 'bg-gray-100';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Bell className="w-6 h-6" /> Activity Logs & Notifications
        </h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h2 className="font-bold text-gray-700">System Feed</h2>
          <button className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Mark all as read
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading logs...</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors items-start">
                <div className={`p-2 rounded-full flex-shrink-0 mt-1 ${getBg(log.type)}`}>
                  {getIcon(log.type)}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 font-medium">{log.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="p-8 text-center text-gray-500">No activity recorded yet.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
