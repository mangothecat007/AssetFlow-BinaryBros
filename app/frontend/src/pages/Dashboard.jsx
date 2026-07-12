import React, { useEffect, useState } from "react";
import { 
  Briefcase, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ArrowRightLeft,
  CalendarDays
} from "lucide-react";
import { userStore } from "@/lib/api";

const Dashboard = () => {
  const [stats, setStats] = useState({
    assetsAvailable: 128,
    assetsAllocated: 76,
    maintenanceToday: 4,
    activeBookings: 9,
    pendingTransfers: 3,
    upcomingReturns: 12
  });

  const role = userStore.getRole();

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Today's Overview</h1>
        <div className="flex gap-2">
          {["theadmin", "Asset Manager"].includes(role) && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              + Register Asset
            </button>
          )}
          <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
            Book Resource
          </button>
          <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
            Raise Request
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <StatCard title="Available" value={stats.assetsAvailable} icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} />
        <StatCard title="Allocated" value={stats.assetsAllocated} icon={<Briefcase className="w-5 h-5 text-blue-500" />} />
        <StatCard title="Maintenance" value={stats.maintenanceToday} icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} />
        <StatCard title="Active Bookings" value={stats.activeBookings} icon={<CalendarDays className="w-5 h-5 text-indigo-500" />} />
        <StatCard title="Pending Transfers" value={stats.pendingTransfers} icon={<ArrowRightLeft className="w-5 h-5 text-purple-500" />} />
        <StatCard title="Upcoming Returns" value={stats.upcomingReturns} icon={<Clock className="w-5 h-5 text-orange-500" />} />
      </div>

      {/* Alerts */}
      <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <span className="text-red-800 font-medium">3 assets overdue for return - Flagged for follow-up</span>
        </div>
        <button className="text-red-700 text-sm font-bold hover:underline">View All</button>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Activity</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">Laptop AF-0114 - allocated to Priya Shah (IT Dept)</p>
              <p className="text-xs text-gray-500 mt-1">2 mins ago</p>
            </div>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">Allocation</span>
          </div>
          <div className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">Room B2 - booking confirmed (2:00 to 3:00 PM)</p>
              <p className="text-xs text-gray-500 mt-1">15 mins ago</p>
            </div>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-md">Booking</span>
          </div>
          <div className="p-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-900">Projector AF-0062 - maintenance resolved</p>
              <p className="text-xs text-gray-500 mt-1">1 hour ago</p>
            </div>
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">Maintenance</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon }) => (
  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-2">
      <span className="text-sm font-medium text-gray-500">{title}</span>
      {icon}
    </div>
    <span className="text-2xl font-bold text-gray-900">{value}</span>
  </div>
);

export default Dashboard;
