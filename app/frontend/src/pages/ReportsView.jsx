import React from "react";
import { BarChart, PieChart, Activity, Download } from "lucide-react";

const ReportsView = () => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
        <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        {/* Utilization Chart Placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-blue-500" /> Utilization by Department
          </h2>
          <div className="flex-1 flex items-end justify-center gap-6 pb-4 border-b border-gray-100">
            {/* Simple CSS Bar Chart Mockup */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 bg-blue-500 rounded-t-md h-32"></div>
              <span className="text-xs font-medium text-gray-500">ENG</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 bg-indigo-500 rounded-t-md h-48"></div>
              <span className="text-xs font-medium text-gray-500">IT</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 bg-emerald-500 rounded-t-md h-24"></div>
              <span className="text-xs font-medium text-gray-500">FAC</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 bg-amber-500 rounded-t-md h-16"></div>
              <span className="text-xs font-medium text-gray-500">MKT</span>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Most used assets:</strong> Room B2 (34 bookings this month)</p>
          </div>
        </div>

        {/* Maintenance Frequency Placeholder */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" /> Maintenance Frequency
          </h2>
          <div className="flex-1 flex items-center justify-center border border-dashed border-gray-200 rounded-lg bg-gray-50 mb-4">
             <span className="text-gray-400 font-medium">Line Chart Visualization</span>
          </div>
          <div className="text-sm text-gray-600 space-y-2">
            <p className="text-red-700"><strong>Assets due for maintenance / nearing retirement:</strong></p>
            <ul className="list-disc pl-5">
              <li>Forklift AF-0092 : service due in 5 days</li>
              <li>Laptop AF-0020 : 4 years old (nearing retirement)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsView;
