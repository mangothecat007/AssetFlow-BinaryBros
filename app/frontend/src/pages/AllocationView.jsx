import React, { useState, useEffect } from "react";
import { ArrowRightLeft, ShieldAlert, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const AllocationView = () => {
  const [assets, setAssets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [targetEmployee, setTargetEmployee] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, alRes] = await Promise.all([
          api.get("/assets"),
          api.get("/allocations")
        ]);
        setAssets(aRes.data);
        setAllocations(alRes.data);
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
      await api.post("/allocations/transfer", {
        id: "alloc_" + Date.now(),
        asset_id: selectedAsset,
        allocated_to: targetEmployee,
        status: "Active"
      });
      toast.success("Transfer requested successfully!");
      setSelectedAsset("");
      setTargetEmployee("");
      setNotes("");
      const alRes = await api.get("/allocations");
      setAllocations(alRes.data);
    } catch (e) {
      if (e.response && e.response.status === 409) {
        toast.error(e.response.data.detail || "Conflict: Asset already allocated");
      } else {
        toast.error("Failed to request transfer");
      }
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
        {/* Allocation Form */}
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
                  <option key={a.id} value={a.id}>{a.id} - {a.name}</option>
                ))}
              </select>
            </div>
            
            {/* Conflict Warning Mockup */}
            {selectedAsset && allocations.find(al => al.asset_id === selectedAsset && al.status === "Active") && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 text-red-800 text-sm">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Already Allocated</p>
                  <p className="mt-1">Direct re-allocation might be blocked. Submitting will result in a transfer request.</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transfer Request</label>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <span className="text-xs text-gray-500">To Employee</span>
                  <input 
                    type="text" 
                    value={targetEmployee}
                    onChange={(e) => setTargetEmployee(e.target.value)}
                    placeholder="e.g. Raj Kumar"
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white text-gray-900" 
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" 
                rows="3" 
                placeholder="Explain why this transfer is needed..."
              ></textarea>
            </div>

            <button type="submit" disabled={loading} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Submit Request"}
            </button>
          </form>
        </div>

        {/* History / Active Transfers */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">Allocation History</h2>
          </div>
          <div className="p-4 text-sm text-gray-600 space-y-3">
             {allocations.map(al => (
               <div key={al.id} className="border-b border-gray-50 pb-2">
                 <p className="font-medium text-gray-900">Asset {al.asset_id} - Allocated to {al.allocated_to}</p>
                 <p className="text-xs text-gray-500">Status: <span className="font-bold">{al.status}</span></p>
               </div>
             ))}
             {allocations.length === 0 && <p>No allocations recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllocationView;
