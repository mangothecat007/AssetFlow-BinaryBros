import React, { useState, useEffect } from "react";
import { 
  Package, Wrench, ShieldAlert, CheckCircle2, TrendingUp, Clock, CalendarDays, Undo2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_assets: 0,
    allocated_assets: 0,
    maintenance_active: 0,
    overdue_returns: 0,
    active_bookings: 0,
    upcoming_returns: 0
  });
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get("/analytics/dashboard");
        setStats(res.data.metrics);
        setActivity(res.data.recent_activity);
      } catch (e) {
        console.error("Failed to load dashboard", e);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Live Environment
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <StatCard title="Total Assets" value={loading ? "..." : stats.total_assets} trend="+12" icon={<Package className="w-5 h-5 text-blue-600" />} color="blue" />
        <StatCard title="Allocated" value={loading ? "..." : stats.allocated_assets} trend="+5" icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} color="emerald" />
        <StatCard title="Active Bookings" value={loading ? "..." : stats.active_bookings} trend="+2" icon={<CalendarDays className="w-5 h-5 text-indigo-600" />} color="indigo" />
        <StatCard title="Upcoming Returns" value={loading ? "..." : stats.upcoming_returns} trend="+3" icon={<Undo2 className="w-5 h-5 text-amber-600" />} color="amber" />
        <StatCard title="Maintenance" value={loading ? "..." : stats.maintenance_active} trend="-2" icon={<Wrench className="w-5 h-5 text-amber-600" />} color="amber" />
        <StatCard title="Overdue Returns" value={loading ? "..." : stats.overdue_returns} trend="+1" icon={<ShieldAlert className="w-5 h-5 text-red-600" />} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" /> Recent Activity
          </h2>
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-500 text-sm">Loading activity...</p>
            ) : activity.length > 0 ? (
              activity.map(act => (
                <div key={act.id} className="flex gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                  <div className={`p-2 rounded-full h-fit ${act.type === 'allocation' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                    {act.type === 'allocation' ? <Package className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{act.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(act.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent activity.</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Action Center</h2>
          <div className="space-y-3">
             <button onClick={() => navigate("/app/assets")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
               + Register New Asset
             </button>
             <button onClick={() => navigate("/app/allocation")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors">
               + Process Allocation
             </button>
             <button onClick={() => navigate("/app/maintenance")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors">
               + Raise Maintenance Ticket
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, trend, icon, color }) => {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    red: "bg-red-50 border-red-100",
    indigo: "bg-indigo-50 border-indigo-100",
  };
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-50 transition-transform group-hover:scale-150 ${colorMap[color]}`}></div>
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
          <TrendingUp className="w-3 h-3" /> {trend}
        </div>
      </div>
      <div className="relative z-10">
        <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
};

export default Dashboard;
