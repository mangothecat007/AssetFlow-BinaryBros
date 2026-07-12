import React, { useState, useEffect } from "react";
import { Wrench, Clock, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const MaintenanceView = () => {
  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { role } = useAuth();

  const [newTicket, setNewTicket] = useState({
    asset_id: "",
    issue_description: "",
    priority: "Medium",
    photo: null
  });

  const fetchTickets = async () => {
    try {
      const [mRes, aRes] = await Promise.all([
        api.get("/maintenance"),
        api.get("/assets")
      ]);
      setTickets(mRes.data);
      setAssets(aRes.data);
    } catch (e) {
      toast.error("Failed to load maintenance tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newTicket.asset_id || !newTicket.issue_description) {
      return toast.error("Asset and issue description are required");
    }
    try {
      const formData = new FormData();
      formData.append("id", `mt_${Date.now()}`);
      formData.append("asset_id", newTicket.asset_id);
      formData.append("issue_description", newTicket.issue_description);
      formData.append("priority", newTicket.priority);
      formData.append("reported_at", new Date().toISOString());
      if (newTicket.photo) formData.append("photo", newTicket.photo);

      // Post as JSON since photo is optional and backend expects MaintenanceRequest model
      await api.post("/maintenance", {
        id: `mt_${Date.now()}`,
        asset_id: newTicket.asset_id,
        requested_by: "employee",
        issue_description: newTicket.issue_description,
        priority: newTicket.priority,
        status: "Pending Approval",
        reported_at: new Date().toISOString()
      });

      toast.success("Maintenance request submitted!");
      setShowForm(false);
      setNewTicket({ asset_id: "", issue_description: "", priority: "Medium", photo: null });
      fetchTickets();
    } catch (e) {
      toast.error("Failed to submit request");
    }
  };

  // Kanban columns per workflow
  const pending    = tickets.filter(t => t.status === "Pending Approval");
  const approved   = tickets.filter(t => t.status === "Approved");
  const inProgress = tickets.filter(t => t.status === "In Progress");
  const resolved   = tickets.filter(t => t.status === "Resolved");
  const rejected   = tickets.filter(t => t.status === "Rejected");

  return (
    <div className="w-full h-full flex flex-col relative pb-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Maintenance Management</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <Wrench className="w-4 h-4" /> Raise Request
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Kanban board: horizontal scroll */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-5 h-full pb-2" style={{minWidth: 'max-content'}}>
          <KanbanColumn title="Pending Approval" count={pending.length} color="amber">
            {pending.map(t => <KanbanCard key={t.id} t={t} role={role} onUpdate={fetchTickets} />)}
            {pending.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="Approved — Awaiting Tech" count={approved.length} color="blue">
            {approved.map(t => <KanbanCard key={t.id} t={t} role={role} onUpdate={fetchTickets} />)}
            {approved.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="In Progress" count={inProgress.length} color="indigo">
            {inProgress.map(t => <KanbanCard key={t.id} t={t} role={role} onUpdate={fetchTickets} />)}
            {inProgress.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="Resolved" count={resolved.length} color="emerald">
            {resolved.map(t => <KanbanCard key={t.id} t={t} role={role} onUpdate={fetchTickets} />)}
            {resolved.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="Rejected" count={rejected.length} color="red">
            {rejected.map(t => <KanbanCard key={t.id} t={t} role={role} onUpdate={fetchTickets} />)}
            {rejected.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>
        </div>
      </div>

      {/* Raise Request Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Raise Maintenance Request</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset</label>
                <select
                  required
                  value={newTicket.asset_id}
                  onChange={e => setNewTicket({...newTicket, asset_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Select Asset --</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.id} – {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Description</label>
                <textarea
                  required
                  rows={3}
                  value={newTicket.issue_description}
                  onChange={e => setNewTicket({...newTicket, issue_description: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500"
                  placeholder="Describe the issue in detail..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTicket.priority}
                  onChange={e => setNewTicket({...newTicket, priority: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attach Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setNewTicket({...newTicket, photo: e.target.files[0]})}
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const KanbanColumn = ({ title, count, color, children }) => {
  const colorMap = {
    amber:   "bg-amber-50 border-amber-200 text-amber-800",
    blue:    "bg-blue-50 border-blue-200 text-blue-800",
    indigo:  "bg-indigo-50 border-indigo-200 text-indigo-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red:     "bg-red-50 border-red-200 text-red-800",
  };

  return (
    <div className="w-72 flex flex-col bg-gray-100 rounded-xl border border-gray-200" style={{maxHeight: '70vh'}}>
      <div className={`px-4 py-3 border-b flex justify-between items-center rounded-t-xl ${colorMap[color]}`}>
        <h3 className="font-bold text-sm">{title}</h3>
        <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {children}
      </div>
    </div>
  );
};

const KanbanCard = ({ t, role, onUpdate }) => {
  const pColor = t.priority === "High"
    ? "text-red-600 bg-red-50"
    : t.priority === "Medium"
    ? "text-amber-600 bg-amber-50"
    : "text-emerald-600 bg-emerald-50";

  const isManager = role === "admin" || role === "Asset Manager";

  const updateStatus = async (newStatus) => {
    try {
      await api.patch(`/maintenance/${t.id}/status`, { status: newStatus });
      toast.success(`Ticket moved to ${newStatus}`);
      onUpdate();
    } catch (e) {
      toast.error("Failed to update ticket");
    }
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold text-blue-600 font-mono">{t.asset_id}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pColor}`}>{t.priority || 'Medium'}</span>
      </div>
      <h4 className="font-bold text-sm text-gray-800 line-clamp-2">{t.issue_description}</h4>
      <p className="text-xs text-gray-400 mt-1">By: {t.requested_by || t.reported_by}</p>

      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
        <div className="flex items-center text-[10px] text-gray-400 gap-1">
          <Clock className="w-3 h-3" /> {new Date(t.reported_at || Date.now()).toLocaleDateString()}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {t.status === "Pending Approval" && isManager && (
            <>
              <button
                onClick={() => updateStatus("Rejected")}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold py-1.5 px-2 rounded-md transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => updateStatus("Approved")}
                className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold py-1.5 px-2 rounded-md transition-colors"
              >
                Approve
              </button>
            </>
          )}
          {t.status === "Approved" && isManager && (
            <button
              onClick={() => updateStatus("In Progress")}
              className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold py-1.5 px-2 rounded-md transition-colors"
            >
              Assign Technician
            </button>
          )}
          {t.status === "In Progress" && isManager && (
            <button
              onClick={() => updateStatus("Resolved")}
              className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold py-1.5 px-2 rounded-md transition-colors"
            >
              Mark Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceView;
