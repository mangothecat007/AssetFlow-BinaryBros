import React, { useState, useEffect } from "react";
import { Wrench, Clock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const MaintenanceView = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const res = await api.get("/maintenance");
      setTickets(res.data);
    } catch (e) {
      toast.error("Failed to load maintenance tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const pending = tickets.filter(t => t.status === "Pending Approval");
  const approved = tickets.filter(t => t.status === "Approved");
  const inProgress = tickets.filter(t => t.status === "In Progress");
  const resolved = tickets.filter(t => t.status === "Resolved");

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Maintenance Management</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
          <Wrench className="w-4 h-4" /> Raise Request
        </button>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-6 min-w-max h-full pb-4">
          
          <KanbanColumn title="Pending Approval" count={pending.length} color="amber">
            {pending.map(t => <KanbanCard key={t.id} t={t} onUpdate={fetchTickets} />)}
            {pending.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="Approved (Waiting Tech)" count={approved.length} color="blue">
            {approved.map(t => <KanbanCard key={t.id} t={t} onUpdate={fetchTickets} />)}
            {approved.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="In Progress" count={inProgress.length} color="indigo">
            {inProgress.map(t => <KanbanCard key={t.id} t={t} onUpdate={fetchTickets} />)}
            {inProgress.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

          <KanbanColumn title="Resolved" count={resolved.length} color="emerald">
            {resolved.map(t => <KanbanCard key={t.id} t={t} onUpdate={fetchTickets} />)}
            {resolved.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No tickets</p>}
          </KanbanColumn>

        </div>
      </div>
    </div>
  );
};

const KanbanColumn = ({ title, count, color, children }) => {
  const colorMap = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };

  const headerStyle = colorMap[color];

  return (
    <div className="w-80 flex flex-col bg-gray-100 rounded-xl border border-gray-200 max-h-full">
      <div className={`px-4 py-3 border-b flex justify-between items-center rounded-t-xl ${headerStyle}`}>
        <h3 className="font-bold text-sm">{title}</h3>
        <span className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold">{count}</span>
      </div>
      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        {children}
      </div>
    </div>
  );
};

const KanbanCard = ({ t, onUpdate }) => {
  const pColor = t.priority === "High" ? "text-red-600 bg-red-50" : t.priority === "Medium" ? "text-amber-600 bg-amber-50" : "text-emerald-600 bg-emerald-50";

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
      <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{t.issue_description}</h4>
      
      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col gap-2">
        <div className="flex justify-between items-center text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {new Date(t.reported_at || Date.now()).toLocaleDateString()}
          </div>
        </div>
        <div className="flex gap-2">
          {t.status === "Pending Approval" && (
            <button onClick={() => updateStatus("Approved")} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-bold py-1 rounded">Approve</button>
          )}
          {t.status === "Approved" && (
            <button onClick={() => updateStatus("In Progress")} className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold py-1 rounded">Assign Tech</button>
          )}
          {t.status === "In Progress" && (
            <button onClick={() => updateStatus("Resolved")} className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold py-1 rounded">Mark Resolved</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MaintenanceView;
