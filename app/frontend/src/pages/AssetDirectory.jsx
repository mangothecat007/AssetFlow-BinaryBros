import React, { useState, useEffect } from "react";
import { Search, Filter, Plus, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

const AssetDirectory = () => {
  const { role, username, departmentId } = useAuth();
  // Only Asset Manager and Admin can register new assets (problem statement §4)
  const canRegister = role === "admin" || role === "Asset Manager";
  const [assets, setAssets] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newAsset, setNewAsset] = useState({ 
    name: "", 
    category_id: "", 
    location: "IT Dept", 
    photo: null, 
    is_bookable: false,
    serial_number: "",
    purchase_date: new Date().toISOString().split("T")[0],
    purchase_cost: "",
    condition: "Good"
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assetRes, catRes, allocRes, userRes] = await Promise.all([
        api.get("/assets"),
        api.get("/categories"),
        api.get("/allocations"),
        api.get("/users")
      ]);
      setAssets(assetRes.data);
      setCategories(catRes.data);
      setAllocations(allocRes.data);
      setUsers(userRes.data);
      if (catRes.data.length > 0 && !newAsset.category_id) {
        setNewAsset(prev => ({ ...prev, category_id: catRes.data[0].id }));
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("name", newAsset.name || "New Asset");
      formData.append("category_id", newAsset.category_id || (categories[0]?.id || ""));
      formData.append("department_id", "General");
      formData.append("location", newAsset.location);
      formData.append("status", "Available");
      formData.append("purchase_date", newAsset.purchase_date);
      formData.append("purchase_cost", newAsset.purchase_cost || 0);
      formData.append("serial_number", newAsset.serial_number);
      formData.append("condition", newAsset.condition);
      formData.append("is_bookable", newAsset.is_bookable);
      
      if (newAsset.photo) {
          formData.append("photo", newAsset.photo);
      }

      await api.post("/assets", formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Asset registered!`);
      setShowModal(false);
      setNewAsset({ 
        name: "", 
        category_id: categories[0]?.id || "", 
        location: "IT Dept", 
        photo: null, 
        is_bookable: false,
        serial_number: "",
        purchase_date: new Date().toISOString().split("T")[0],
        purchase_cost: "",
        condition: "Good"
      });
      fetchData();
    } catch (e) {
      toast.error("Failed to register asset");
    }
  };

  const filteredAssets = assets.filter(a => {
    if (role === "Employee") {
      const isMyAsset = allocations.some(al => al.asset_id === a.id && al.allocated_to === username && al.status === "Active");
      if (!isMyAsset) return false;
    }
    
    if (role === "Department Head") {
      const activeAlloc = allocations.find(al => al.asset_id === a.id && al.status === "Active");
      if (activeAlloc) {
         const allocUser = users.find(u => u.email === activeAlloc.allocated_to || u.name === activeAlloc.allocated_to);
         if (allocUser && allocUser.department_id !== departmentId) return false;
      } else {
         if (a.department_id !== departmentId && a.department_id !== "General") return false;
      }
    }

    const matchesSearch = a.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (a.serial_number && a.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategoryFilter === "" || a.category_id === selectedCategoryFilter;
    const matchesStatus = selectedStatusFilter === "" || a.status === selectedStatusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Asset Directory</h1>
        {canRegister && (
          <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Asset
          </button>
        )}
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
            <select 
              value={selectedCategoryFilter} 
              onChange={e => setSelectedCategoryFilter(e.target.value)} 
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-gray-700"
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select 
              value={selectedStatusFilter} 
              onChange={e => setSelectedStatusFilter(e.target.value)} 
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none bg-white text-gray-700"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Allocated">Allocated</option>
              <option value="Under Maintenance">Under Maintenance</option>
              <option value="Lost">Lost</option>
              <option value="Retired">Retired</option>
              <option value="Disposed">Disposed</option>
            </select>
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
                <th className="p-4 font-medium">Condition</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Location / Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssets.map(a => {
                const activeAlloc = allocations.find(al => al.asset_id === a.id && al.status === "Active");
                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900 cursor-pointer">
                    <td className="p-4 font-mono font-medium text-blue-600">{a.id}</td>
                    <td className="p-4 font-medium">{a.name}</td>
                    <td className="p-4 text-gray-600">
                      {categories.find(c => c.id === a.category_id)?.name || a.category_id}
                    </td>
                    <td className="p-4 text-gray-600">{a.condition || "Good"}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        a.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                        a.status === 'Allocated' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-800'
                      }`}>{a.status}</span>
                    </td>
                    <td className="p-4 text-gray-600">
                      {activeAlloc ? <span className="font-semibold text-blue-700">Held by: {activeAlloc.allocated_to}</span> : a.location}
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredAssets.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">No assets found matching your criteria.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-4">Register New Asset</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Name</label>
                <input required type="text" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. MacBook Pro M2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={newAsset.category_id} onChange={e => setNewAsset({...newAsset, category_id: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                  <input type="text" value={newAsset.serial_number} onChange={e => setNewAsset({...newAsset, serial_number: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. SN-123456" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Date</label>
                  <input type="date" value={newAsset.purchase_date} onChange={e => setNewAsset({...newAsset, purchase_date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Acquisition Cost ($)</label>
                  <input type="number" value={newAsset.purchase_cost} onChange={e => setNewAsset({...newAsset, purchase_cost: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. 1200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select value={newAsset.condition} onChange={e => setNewAsset({...newAsset, condition: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500 bg-white">
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <input required type="text" value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-blue-500" placeholder="e.g. Server Room" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Photo (Optional)</label>
                <input type="file" accept="image/*" onChange={e => setNewAsset({...newAsset, photo: e.target.files[0]})} className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-blue-500 bg-white" />
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
