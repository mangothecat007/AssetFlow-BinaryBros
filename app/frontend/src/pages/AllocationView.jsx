import React, { useState, useEffect } from "react";
import { ArrowRightLeft, ShieldAlert, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const AllocationView = () => {
  const [assets, setAssets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [targetEmployee, setTargetEmployee] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [returnModal, setReturnModal] = useState({ open: false, allocId: "", notes: "" });

  const { role, username, departmentId } = useAuth();
  const isManager = role?.toLowerCase() === "admin" || role?.toLowerCase() === "asset manager" || role?.toLowerCase() === "department head";

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, alRes, txRes, uRes, dRes] = await Promise.all([
          api.get("/assets"),
          api.get("/allocations"),
          api.get("/transfers"),
          api.get("/users"),
          api.get("/departments")
        ]);
        setAssets(aRes.data);
        setAllocations(alRes.data);
        setTransfers(txRes.data);
        setUsers(uRes.data);
        setDepartments(dRes.data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAsset || !targetEmployee) return toast.error("Please fill required fields");
    setLoading(true);
    try {
      const isAlreadyAllocated = allocations.some(al => al.asset_id === selectedAsset && al.status === "Active");
      
      if (isAlreadyAllocated) {
          await api.post("/transfers", {
              asset_id: selectedAsset,
              requested_by: isManager ? targetEmployee : username,
          });
          toast.success("Transfer request submitted!");
      } else {
          await api.post("/allocations", {
            id: String("alloc_" + Date.now()),
            asset_id: String(selectedAsset),
            allocated_to: String(targetEmployee),
            allocated_by: username ? String(username) : "System",
            allocation_date: String(new Date().toISOString().split("T")[0]),
            expected_return_date: returnDate ? String(returnDate) : null,
            status: "Active"
          });
          toast.success("Allocation processed!");
      }
      setSelectedAsset("");
      setTargetEmployee("");
      setReturnDate("");
      setNotes("");
      
      const [aRes, alRes, txRes] = await Promise.all([
        api.get("/assets"),
        api.get("/allocations"),
        api.get("/transfers")
      ]);
      setAssets(aRes.data);
      setAllocations(alRes.data);
      setTransfers(txRes.data);
      
    } catch (e) {
      const detail = e.response?.data?.detail;
      const errMsg = typeof detail === "string" ? detail : (Array.isArray(detail) ? detail[0]?.msg : "Failed to process request");
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Allocation & Transfers</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left panel: differs by role */}
      {isManager ? (
        /* ---- MANAGER: Full Allocation Form ---- */
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">New Allocation</h2>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Asset</label>
              <select 
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- Choose Asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.id} - {a.name} [{a.status}]</option>
                ))}
              </select>
            </div>

            {/* Conflict Warning */}
            {selectedAsset && allocations.find(al => al.asset_id === selectedAsset && al.status === "Active") && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 text-red-800 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Already Allocated</p>
                  <p className="mt-1">Submitting will create a Transfer Request instead.</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allocate To (Employee / Department)</label>
              <select 
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white text-gray-900" 
              >
                <option value="">-- Choose Assignee --</option>
                <optgroup label="Departments">
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Employees">
                  {users.map(u => (
                    <option key={u.email} value={u.email}>{u.name ? `${u.name} (${u.email})` : u.email}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Return Date</label>
              <input 
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" 
                rows="3" 
                placeholder="Allocation reason or notes..."
              ></textarea>
            </div>

            <button type="submit" disabled={loading} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Submit"}
            </button>
          </form>
        </div>
      ) : (
        /* ---- EMPLOYEE: Transfer Request Only ---- */
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-1 border-b pb-2">Request Transfer</h2>
          <p className="text-xs text-gray-500 mb-4 mt-2">
            Select an allocated asset and submit a transfer request. An Asset Manager will review it.
          </p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset (already allocated)</label>
              <select 
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="">-- Choose Asset --</option>
                {/* Employee only sees currently allocated assets (to request transfer) */}
                {assets.filter(a => allocations.some(al => al.asset_id === a.id && al.status === "Active")).map(a => (
                  <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                ))}
              </select>
            </div>

            {selectedAsset && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 text-sm">
                <p className="font-bold">Transfer Request</p>
                <p className="mt-1 text-xs">An Asset Manager or Department Head will approve this before the asset is re-allocated.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name / Request Reason</label>
              <input 
                type="text" 
                value={targetEmployee}
                onChange={(e) => setTargetEmployee(e.target.value)}
                placeholder="Reason for transfer (Name is auto-filled)"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white text-gray-900" 
              />
            </div>

            <button type="submit" disabled={loading || !selectedAsset} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Request Transfer"}
            </button>
          </form>
        </div>
      )}

        {/* History / Active Transfers */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Transfers & History</h2>
          </div>
          <div className="p-4 text-sm text-gray-600 space-y-3">
             
             {transfers.filter(t => {
                if (role?.toLowerCase() === "admin" || role?.toLowerCase() === "asset manager") return true;
                if (role?.toLowerCase() === "employee") return t.requested_by === username;
                if (role?.toLowerCase() === "department head") {
                   const u = users.find(usr => usr.email === t.requested_by || usr.name === t.requested_by);
                   return u && u.department_id === departmentId;
                }
                return false;
             }).map(tx => (
               <div key={tx.id} className="border border-blue-200 bg-blue-50/50 p-3 rounded-lg flex justify-between items-center mb-4">
                 <div>
                   <p className="font-medium text-gray-900">Transfer Request: Asset {tx.asset_id}</p>
                   <p className="text-xs text-gray-600">Requested by: <span className="font-bold">{tx.requested_by}</span> • Status: <span className="font-bold">{tx.status}</span></p>
                 </div>
                 <div className="flex gap-2">
                   {isManager && tx.status === "Requested" && (
                     <>
                       <button onClick={async () => {
                         await api.patch(`/transfers/${tx.id}/approve`, { status: "Rejected" });
                         toast.error("Transfer rejected");
                         api.get("/transfers").then(res => setTransfers(res.data));
                       }} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 text-xs font-bold">Reject</button>
                       <button onClick={async () => {
                         await api.patch(`/transfers/${tx.id}/approve`, { status: "Approved" });
                         toast.success("Transfer approved");
                         const [alRes, txRes] = await Promise.all([api.get("/allocations"), api.get("/transfers")]);
                         setAllocations(alRes.data);
                         setTransfers(txRes.data);
                       }} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-bold">Approve</button>
                     </>
                   )}
                 </div>
               </div>
             ))}

             {/* Active Allocations */}
             {allocations.filter(al => {
                if (role?.toLowerCase() === "admin" || role?.toLowerCase() === "asset manager") return true;
                if (role?.toLowerCase() === "employee") return al.allocated_to === username;
                if (role?.toLowerCase() === "department head") {
                   const u = users.find(usr => usr.email === al.allocated_to || usr.name === al.allocated_to);
                   return u && u.department_id === departmentId;
                }
                return false;
             }).map(al => (
               <div key={al.id} className="border-b border-gray-50 pb-3 flex justify-between items-center">
                 <div>
                   <p className="font-medium text-gray-900">Asset {al.asset_id} - Allocated to {al.allocated_to}</p>
                   <p className="text-xs text-gray-500">
                     Status: <span className="font-bold">{al.status}</span> 
                     {al.expected_return_date && ` • Return by: ${al.expected_return_date}`}
                   </p>
                 </div>
                 <div className="flex gap-2">
                   {al.status === "Active" && (role?.toLowerCase() === "admin" || role?.toLowerCase() === "asset manager") && (
                     <button onClick={() => setReturnModal({ open: true, allocId: al.id, notes: "" })} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 text-xs font-bold transition-colors">Mark Returned</button>
                   )}
                 </div>
               </div>
             ))}
              {allocations.filter(al => {
                if (role?.toLowerCase() === "admin" || role?.toLowerCase() === "asset manager") return true;
                if (role?.toLowerCase() === "employee") return al.allocated_to === username;
                if (role?.toLowerCase() === "department head") {
                   const u = users.find(usr => usr.email === al.allocated_to || usr.name === al.allocated_to);
                   return u && u.department_id === departmentId;
                }
                return false;
              }).length === 0 && <p>No allocations recorded.</p>}
          </div>
        </div>
      </div>
      
      {/* Return Modal */}
      {returnModal.open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">Return Condition Check-in</h2>
            <textarea 
              autoFocus
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-blue-500 min-h-[100px]"
              placeholder="Note any damages, missing parts, or general condition..."
              value={returnModal.notes}
              onChange={(e) => setReturnModal({ ...returnModal, notes: e.target.value })}
            ></textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReturnModal({ open: false, allocId: "", notes: "" })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={async () => {
                 await api.patch(`/allocations/${returnModal.allocId}`, { status: "Returned", return_notes: returnModal.notes });
                 toast.success("Asset returned successfully");
                 setReturnModal({ open: false, allocId: "", notes: "" });
                 api.get("/allocations").then(res => setAllocations(res.data));
              }} className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-medium">Confirm Return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllocationView;
