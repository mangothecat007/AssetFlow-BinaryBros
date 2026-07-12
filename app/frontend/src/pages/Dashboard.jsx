import React, { useState, useEffect } from "react";
import { 
  Package, Wrench, ShieldAlert, CheckCircle2, TrendingUp, Clock, CalendarDays, Undo2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Dashboard = () => {
  const { role } = useAuth();
  // Per problem statement: Asset Manager and Admin can register/allocate assets
  const canManageAssets = role === "admin" || role === "Asset Manager";
  // Department Head can also process allocations
  const canAllocate = canManageAssets || role === "Department Head";
  const [stats, setStats] = useState({
    total_assets: 0,
    allocated_assets: 0,
    maintenance_active: 0,
    overdue_returns: 0,
    active_bookings: 0,
    upcoming_returns: 0,
    pending_transfers: 0
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
        
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard title="Available Assets" value={loading ? "..." : (stats.total_assets - stats.allocated_assets - stats.maintenance_active)} icon={<Package className="w-5 h-5 text-blue-600" />} color="blue" />
        <StatCard title="Allocated" value={loading ? "..." : stats.allocated_assets} icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} color="emerald" />
        <StatCard title="Active Bookings" value={loading ? "..." : stats.active_bookings} icon={<CalendarDays className="w-5 h-5 text-indigo-600" />} color="indigo" />
        <StatCard title="Upcoming Returns" value={loading ? "..." : stats.upcoming_returns} icon={<Undo2 className="w-5 h-5 text-amber-600" />} color="amber" />
        <StatCard title="Pending Transfers" value={loading ? "..." : stats.pending_transfers} icon={<TrendingUp className="w-5 h-5 text-purple-600" />} color="purple" />
        <StatCard title="Overdue Returns" value={loading ? "..." : stats.overdue_returns} icon={<ShieldAlert className="w-5 h-5 text-red-600" />} color="red" urgent={stats.overdue_returns > 0} />
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

        {/* Quick Actions - gated by role per problem statement */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Action Center</h2>
          <div className="space-y-3">
             {/* Admin + Asset Manager only */}
             {canManageAssets && (
               <button onClick={() => navigate("/app/assets")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                 + Register New Asset
               </button>
             )}
             {/* Admin + Asset Manager + Department Head */}
             {canAllocate && (
               <button onClick={() => navigate("/app/allocation")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors">
                 + Process Allocation
               </button>
             )}
             {/* All roles can book resources and raise maintenance */}
             <button onClick={() => navigate("/app/booking")} className="w-full text-left p-3 border border-gray-200 rounded-lg text-sm font-medium hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors">
               + Book Resource
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

const StatCard = ({ title, value, icon, color, urgent }) => {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100",
    emerald: "bg-emerald-50 border-emerald-100",
    amber: "bg-amber-50 border-amber-100",
    red: "bg-red-50 border-red-100",
    indigo: "bg-indigo-50 border-indigo-100",
    purple: "bg-purple-50 border-purple-100",
  };
  return (
    <div className={`p-5 rounded-xl border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow ${
      urgent ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
    }`}>
      <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-40 transition-transform group-hover:scale-150 ${colorMap[color]}`}></div>
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        {urgent && <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full animate-pulse">Overdue!</span>}
      </div>
      <div className="relative z-10">
        <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wide">{title}</h3>
        <p className={`text-3xl font-bold mt-1 ${urgent ? "text-red-700" : "text-gray-900"}`}>{value}</p>
      </div>
    </div>
  );
};

export default Dashboard;
