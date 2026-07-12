import React, { useState, useEffect } from "react";
import { ShieldAlert, CheckCircle2, AlertTriangle, FileText, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const AuditView = () => {
  const [audits, setAudits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [showCreate, setShowCreate] = useState(false);
  const [newAudit, setNewAudit] = useState({ name: "", department_id: "", start_date: "", end_date: "", auditor: "" });
  
  const [selectedAudit, setSelectedAudit] = useState(null);

  const { role, username } = useAuth();

  const fetchData = async () => {
    try {
      const [audRes, depRes, usrRes] = await Promise.all([
        api.get("/audits"),
        api.get("/departments"),
        api.get("/users")
      ]);
      setAudits(audRes.data);
      setDepartments(depRes.data);
      setUsers(usrRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/audits", {
        ...newAudit,
        auditors: [newAudit.auditor]
      });
      toast.success("Audit Cycle Created");
      setShowCreate(false);
      fetchData();
    } catch (e) {
      toast.error("Failed to create cycle");
    }
  };

  const handleVerify = async (auditId, assetId, status) => {
    try {
      await api.patch(`/audits/${auditId}`, { action: "verify_asset", asset_id: assetId, status });
      toast.success(`Marked as ${status}`);
      // update local state for fast UI
      if (selectedAudit && selectedAudit.id === auditId) {
        setSelectedAudit({
          ...selectedAudit,
          verifications: selectedAudit.verifications.map(v => v.asset_id === assetId ? { ...v, status } : v)
        });
      }
      fetchData();
    } catch (e) {
      toast.error("Failed to verify asset");
    }
  };

  const handleClose = async (auditId) => {
    try {
      await api.patch(`/audits/${auditId}`, { action: "close_cycle" });
      toast.success("Audit Cycle Closed. Asset statuses updated.");
      setSelectedAudit(null);
      fetchData();
    } catch (e) {
      toast.error("Failed to close cycle");
    }
  };

  if (selectedAudit) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">{selectedAudit.name}</h1>
          <div className="flex gap-2">
            {role === "admin" && selectedAudit.status === "Active" && (
              <button onClick={() => handleClose(selectedAudit.id)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">
                Close Cycle
              </button>
            )}
            <button onClick={() => setSelectedAudit(null)} className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors shadow-sm">
              Back
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="p-4 font-medium">Asset ID</th>
                <th className="p-4 font-medium">Asset Name</th>
                <th className="p-4 font-medium">Current Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {selectedAudit.verifications.map(v => (
                <tr key={v.asset_id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono font-bold text-blue-600">{v.asset_id}</td>
                  <td className="p-4 text-gray-800">{v.asset_name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                      v.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                      v.status === 'Missing' ? 'bg-red-100 text-red-700' :
                      v.status === 'Damaged' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{v.status}</span>
                  </td>
                  <td className="p-4">
                    {selectedAudit.status === "Active" && v.status === "Pending" && (
                       <div className="flex gap-2">
                         <button onClick={() => handleVerify(selectedAudit.id, v.asset_id, 'Verified')} className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 text-xs font-bold">Verify</button>
                         <button onClick={() => handleVerify(selectedAudit.id, v.asset_id, 'Missing')} className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 text-xs font-bold">Missing</button>
                         <button onClick={() => handleVerify(selectedAudit.id, v.asset_id, 'Damaged')} className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 text-xs font-bold">Damaged</button>
                       </div>
                    )}
                  </td>
                </tr>
              ))}
              {selectedAudit.verifications.length === 0 && (
                <tr><td colSpan="4" className="p-4 text-center text-gray-500">No assets in this department scope</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Compliance & Audit</h1>
        {role === "admin" && (
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Audit Cycle
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Audit Cycles */}
        <div className="lg:col-span-2 space-y-4">
           {audits.filter(a => a.status === 'Active').map(a => {
             const isAuditor = a.auditors.includes(username) || role === "admin";
             const verifiedCount = a.verifications.filter(v => v.status === 'Verified').length;
             const totalCount = a.verifications.length;
             const progress = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;

             return (
               <div key={a.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-5 flex justify-between items-center">
                 <div>
                   <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                     <AlertTriangle className="w-5 h-5 text-amber-500" /> {a.name}
                   </h3>
                   <p className="text-sm text-gray-500 mt-1">Scope: {a.department_id || "Global"} | Auditors: {a.auditors.join(', ')}</p>
                   <div className="mt-4 flex items-center gap-3 w-64">
                     <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                       <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                     </div>
                     <span className="text-xs font-bold text-gray-500">{verifiedCount}/{totalCount} Done</span>
                   </div>
                 </div>
                 {isAuditor && (
                   <button onClick={() => setSelectedAudit(a)} className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold text-sm border border-blue-200 hover:bg-blue-100">
                     Open Audit Workspace
                   </button>
                 )}
               </div>
             );
           })}
           {audits.filter(a => a.status === 'Active').length === 0 && (
             <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 shadow-sm">
               No active audit cycles.
             </div>
           )}
        </div>

        {/* Audit History */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 max-h-[80vh] overflow-y-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" /> Closed Audits
          </h2>
          <div className="space-y-4">
             {audits.filter(a => a.status === 'Closed').map(a => (
               <div key={a.id} className="flex gap-3 text-sm border-b border-gray-100 pb-3">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                 <div>
                   <p className="font-medium text-gray-900 cursor-pointer hover:underline" onClick={() => setSelectedAudit(a)}>{a.name}</p>
                   <p className="text-xs text-gray-500">Ended: {a.end_date}</p>
                 </div>
               </div>
             ))}
             {audits.filter(a => a.status === 'Closed').length === 0 && <p className="text-xs text-gray-500">No closed audits.</p>}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-lg">Create Audit Cycle</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Name</label>
                <input required type="text" value={newAudit.name} onChange={e => setNewAudit({...newAudit, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. Q3 IT Hardware Audit" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department Scope (Optional)</label>
                <select value={newAudit.department_id} onChange={e => setNewAudit({...newAudit, department_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white">
                  <option value="">-- All Departments --</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Auditor</label>
                <select required value={newAudit.auditor} onChange={e => setNewAudit({...newAudit, auditor: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white">
                  <option value="">-- Select Employee --</option>
                  {users.map(u => <option key={u.id} value={u.username}>{u.username} ({u.role})</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input required type="date" value={newAudit.start_date} onChange={e => setNewAudit({...newAudit, start_date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input required type="date" value={newAudit.end_date} onChange={e => setNewAudit({...newAudit, end_date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" />
                </div>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-4">
                Initialize Cycle
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditView;
