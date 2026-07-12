import React, { useState, useEffect } from "react";
import { Search, Filter, Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const AssetDirectory = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ name: "", category_id: "Electronics", location: "IT Dept", is_bookable: false });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await api.get("/assets");
      setAssets(res.data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    const id = "AF-" + Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    try {
      await api.post("/assets", {
        id,
        name: newAsset.name || "New Asset",
        category_id: newAsset.category_id,
        status: "Available",
        condition: "New",
        location: newAsset.location,
        is_bookable: newAsset.is_bookable
      });
      toast.success(`Asset ${id} registered!`);
      setShowModal(false);
      setNewAsset({ name: "", category_id: "Electronics", location: "IT Dept", is_bookable: false });
      fetchAssets();
    } catch (e) {
      toast.error("Failed to register asset");
    }
  };

  const filteredAssets = assets.filter(a => 
    a.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Asset Directory</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Register Asset
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[70vh]">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by tag, serial, or name..." 
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-gray-700">
              <option value="">All Categories</option>
              <option value="electronics">Electronics</option>
              <option value="furniture">Furniture</option>
            </select>
            <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-gray-700">
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="Maintenance">Under Maintenance</option>
            </select>
            <button className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 bg-white">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          )}
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider bg-gray-50">
                <th className="p-4 font-medium">Tag</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Location / Holder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssets.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900 cursor-pointer">
                  <td className="p-4 font-mono font-medium text-blue-600">{a.id}</td>
                  <td className="p-4 font-medium">{a.name}</td>
                  <td className="p-4 text-gray-600">{a.category_id}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      a.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                      a.status === 'Allocated' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>{a.status}</span>
                  </td>
                  <td className="p-4 text-gray-600">{a.location}</td>
                </tr>
              ))}
              {!loading && filteredAssets.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No assets found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="font-bold text-lg mb-4">Register New Asset</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
                <input required type="text" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. MacBook Pro M2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={newAsset.category_id} onChange={e => setNewAsset({...newAsset, category_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white">
                  <option value="Electronics">Electronics</option>
                  <option value="Furniture">Furniture</option>
                  <option value="Vehicles">Vehicles</option>
                  <option value="Shared Space">Shared Space</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location / Department</label>
                <input required type="text" value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. IT Dept" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="bookable" checked={newAsset.is_bookable} onChange={e => setNewAsset({...newAsset, is_bookable: e.target.checked})} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <label htmlFor="bookable" className="text-sm font-medium text-gray-700">Shared / Bookable Resource</label>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetDirectory;
