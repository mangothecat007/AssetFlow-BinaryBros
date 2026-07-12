import React, { useState, useEffect } from "react";
import { BarChart3, Download, Loader2, TrendingUp, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const ReportsView = () => {
  const [data, setData] = useState({ 
    category_breakdown: [], 
    department_usage: [],
    maintenance_frequency: [],
    retirement_list: [],
    booking_heatmap: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/reports")
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data.category_breakdown.length) return toast.error("No data to export");
    
    const headers = ["Category", "Asset Count"];
    const rows = data.category_breakdown.map(c => `${c._id},${c.count}`);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `asset_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report downloaded");
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Analytics & Reports</h1>
        <button 
          onClick={exportCSV}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Department Utilization */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Department Utilization
          </h2>
          
          <div className="space-y-6 relative min-h-[200px]">
            {loading ? (
              <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              data.department_usage.map((dept, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm font-medium mb-2">
                    <span className="text-gray-700">{dept.dept}</span>
                    <span className="text-blue-700">{dept.percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-1000" 
                      style={{ width: `${dept.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Chart 2: Asset Categories */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-600" /> Category Breakdown
            </h2>
            
            <div className="space-y-6 relative min-h-[150px]">
              {loading ? (
                <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : (
                data.category_breakdown.map((cat, i) => {
                  const percentage = Math.min(100, (cat.count / 50) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm font-medium mb-1.5">
                        <span className="text-gray-700">{cat._id}</span>
                        <span className="text-emerald-700">{cat.count} items</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })
              )}
              {!loading && data.category_breakdown.length === 0 && (
                <p className="text-gray-500 text-sm text-center">No assets found.</p>
              )}
            </div>
          </div>

          {/* Chart 3: Maintenance Frequency */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" /> Most Frequent Maintained
            </h2>
            
            <div className="space-y-4 relative min-h-[150px]">
              {loading ? (
                <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
                </div>
              ) : (
                data.maintenance_frequency?.map((mf, i) => (
                  <div key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                    <span className="font-medium text-gray-800 font-mono text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200">{mf._id}</span>
                    <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">{mf.count} tickets</span>
                  </div>
                ))
              )}
              {!loading && (!data.maintenance_frequency || data.maintenance_frequency.length === 0) && (
                <p className="text-gray-500 text-sm text-center">No maintenance records.</p>
              )}
            </div>
          </div>
        </div>

        {/* Chart 4: Resource Booking Heatmap */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Resource Booking Heatmap (Peak Windows)</h2>
          <div className="space-y-2">
            {loading ? (
               <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
            ) : (
               data.booking_heatmap?.map((row, i) => (
                 <div key={i} className="flex items-center gap-4">
                   <div className="w-10 text-xs font-bold text-gray-500">{row.day}</div>
                   <div className="flex-1 flex gap-1 h-6">
                     {row.hours.map((val, j) => (
                       <div 
                         key={j} 
                         className="flex-1 rounded-sm transition-colors"
                         style={{ backgroundColor: `rgba(59, 130, 246, ${val / 100})` }}
                         title={`${val}% booked`}
                       ></div>
                     ))}
                   </div>
                 </div>
               ))
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="w-10"></div>
              <div className="flex-1 flex justify-between text-[10px] text-gray-400 font-medium">
                <span>9AM</span>
                <span>12PM</span>
                <span>3PM</span>
                <span>6PM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 5: Nearing Retirement */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-6">Assets Nearing Retirement</h2>
          <div className="space-y-3">
             {loading ? (
                <div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
             ) : (
                data.retirement_list?.map((asset, i) => (
                  <div key={i} className="flex flex-col border border-gray-100 rounded-lg p-3 bg-red-50/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs font-bold text-red-600 block">{asset.id}</span>
                        <span className="text-sm font-medium text-gray-900">{asset.name}</span>
                      </div>
                      <span className="text-xs bg-white border border-red-200 text-red-700 px-2 py-0.5 rounded-full font-bold">{asset.age_years} yrs old</span>
                    </div>
                  </div>
                ))
             )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ReportsView;
