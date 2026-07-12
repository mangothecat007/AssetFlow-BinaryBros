import React from "react";
import { ClipboardCheck, AlertCircle, FileCheck } from "lucide-react";

const AuditView = () => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Asset Audit</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
          + Start Audit Cycle
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Active Audit Cycles */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Active Audit Cycles</h2>
          </div>
          <div className="p-6">
             <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 flex justify-between items-center">
               <div>
                 <h3 className="font-bold text-blue-900">Q3 Audit: Engineering Dept (1-15 Jul)</h3>
                 <p className="text-sm text-gray-600 mt-1">Auditors: A. Rao, S. Iqbal</p>
                 <div className="mt-3 text-sm font-medium text-blue-800">Progress: 45 / 120 Assets Verified</div>
               </div>
               <div className="flex flex-col gap-2">
                 <button className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded font-medium text-sm hover:bg-blue-50">Verify Assets</button>
                 <button className="bg-white border border-red-200 text-red-700 px-3 py-1.5 rounded font-medium text-sm hover:bg-red-50">Close Cycle</button>
               </div>
             </div>
          </div>
        </div>

        {/* Verification Example Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">Verification Sheet</h2>
            <div className="flex items-center gap-2 text-sm text-red-600 font-bold bg-red-50 px-3 py-1 rounded-md border border-red-100">
              <AlertCircle className="w-4 h-4" /> 2 Discrepancies Auto-Flagged
            </div>
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Asset</th>
                <th className="p-4 font-medium">Expected Location</th>
                <th className="p-4 font-medium text-center">Status Mark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50 text-sm">
                <td className="p-4 font-medium">AF-0114 - Dell Laptop</td>
                <td className="p-4 text-gray-600">Desk 312</td>
                <td className="p-4 text-center"><span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">Verified</span></td>
              </tr>
              <tr className="hover:bg-gray-50 text-sm bg-red-50/30">
                <td className="p-4 font-medium">AF-0921 - Office Chair</td>
                <td className="p-4 text-gray-600">Desk 314</td>
                <td className="p-4 text-center"><span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-bold text-xs">Missing</span></td>
              </tr>
              <tr className="hover:bg-gray-50 text-sm">
                <td className="p-4 font-medium">AF-0825 - Monitor</td>
                <td className="p-4 text-gray-600">Desk 315</td>
                <td className="p-4 text-center"><span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-xs">Damaged</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditView;
