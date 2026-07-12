import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Edit2, Plus, X, ToggleLeft, ToggleRight } from "lucide-react";

const OrgSetup = () => {
  const [activeTab, setActiveTab] = useState("departments");

  return (
    <div className="w-full pb-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Organization Setup</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <TabButton 
            label="Departments" 
            isActive={activeTab === "departments"} 
            onClick={() => setActiveTab("departments")} 
          />
          <TabButton 
            label="Asset Categories" 
            isActive={activeTab === "categories"} 
            onClick={() => setActiveTab("categories")} 
          />
          <TabButton 
            label="Employee Directory" 
            isActive={activeTab === "employees"} 
            onClick={() => setActiveTab("employees")} 
          />
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {activeTab === "departments" && <DepartmentsManager />}
          {activeTab === "categories" && <CategoriesTable />}
          {activeTab === "employees" && <EmployeesTable />}
        </div>
      </div>
    </div>
  );
};

const TabButton = ({ label, isActive, onClick }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${
      isActive 
        ? "border-blue-600 text-blue-700 bg-white" 
        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
    }`}
  >
    {label}
  </button>
);

// --- DEPARTMENTS MANAGER ---
const DepartmentsManager = () => {
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [newDept, setNewDept] = useState({ name: "", head_id: "", parent_id: "", status: "Active" });
  const [editingDept, setEditingDept] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchData = async () => {
    try {
      const [deptRes, empRes] = await Promise.all([
        api.get("/departments"),
        api.get("/users")
      ]);
      setDepartments(deptRes.data);
      setEmployees(empRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDept.name) return;
    try {
      await api.post("/departments", {
        id: "dept_" + Date.now(),
        name: newDept.name,
        head_id: newDept.head_id || null,
        parent_id: newDept.parent_id || null,
        status: newDept.status
      });
      toast.success("Department added!");
      setNewDept({ name: "", head_id: "", parent_id: "", status: "Active" });
      setShowAddModal(false);
      fetchData();
    } catch (e) {
      toast.error("Failed to add department");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/departments/${editingDept.id}`, {
        name: editingDept.name,
        head_id: editingDept.head_id || null,
        parent_id: editingDept.parent_id || null,
        status: editingDept.status
      });
      toast.success("Department updated!");
      setEditingDept(null);
      fetchData();
    } catch (e) {
      toast.error("Failed to update department");
    }
  };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm text-gray-500 font-medium">{departments.length} Departments Registered</span>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-colors"
        >
          <Plus size={16} /> Add Department
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="p-4 font-medium">Department</th>
            <th className="p-4 font-medium">Head</th>
            <th className="p-4 font-medium">Parent Department</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {departments.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
              <td className="p-4 font-medium">{d.name}</td>
              <td className="p-4 text-gray-600">{d.head_id || "Unassigned"}</td>
              <td className="p-4 text-gray-600">
                {departments.find(dept => dept.id === d.parent_id)?.name || "None"}
              </td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  d.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {d.status}
                </span>
              </td>
              <td className="p-4">
                <button 
                  onClick={() => setEditingDept(d)} 
                  className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {departments.length === 0 && (
            <tr><td colSpan="5" className="p-4 text-center text-gray-500">No departments found</td></tr>
          )}
        </tbody>
      </table>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Add New Department</h2>
              <button onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department Name</label>
                <input required type="text" value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="e.g. Engineering" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department Head</label>
                <select value={newDept.head_id} onChange={e => setNewDept({...newDept, head_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="">Select Department Head</option>
                  {employees.map(emp => <option key={emp.email} value={emp.name || emp.email}>{emp.name || emp.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Parent Department</label>
                <select value={newDept.parent_id} onChange={e => setNewDept({...newDept, parent_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="">None (Top Level)</option>
                  {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                <select value={newDept.status} onChange={e => setNewDept({...newDept, status: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors">Create Department</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Department</h2>
              <button onClick={() => setEditingDept(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department Name</label>
                <input required type="text" value={editingDept.name} onChange={e => setEditingDept({...editingDept, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department Head</label>
                <select value={editingDept.head_id || ""} onChange={e => setEditingDept({...editingDept, head_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="">Select Department Head</option>
                  {employees.map(emp => <option key={emp.email} value={emp.name || emp.email}>{emp.name || emp.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Parent Department</label>
                <select value={editingDept.parent_id || ""} onChange={e => setEditingDept({...editingDept, parent_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="">None (Top Level)</option>
                  {departments.filter(dept => dept.id !== editingDept.id).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                <select value={editingDept.status} onChange={e => setEditingDept({...editingDept, status: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- ASSET CATEGORIES MANAGER ---
const CategoriesTable = () => {
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState({ name: "", fieldsString: "" });
  const [editingCat, setEditingCat] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCats = async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newCat.name) return;
    const customFields = newCat.fieldsString 
      ? newCat.fieldsString.split(",").map(f => f.trim()).filter(Boolean)
      : [];
    try {
      await api.post("/categories", {
        id: "cat_" + Date.now(),
        name: newCat.name,
        custom_fields: customFields
      });
      toast.success("Category added!");
      setNewCat({ name: "", fieldsString: "" });
      setShowAddModal(false);
      fetchCats();
    } catch (e) {
      toast.error("Failed to add category");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const customFields = editingCat.fieldsString 
      ? editingCat.fieldsString.split(",").map(f => f.trim()).filter(Boolean)
      : [];
    try {
      await api.patch(`/categories/${editingCat.id}`, {
        name: editingCat.name,
        custom_fields: customFields
      });
      toast.success("Category updated!");
      setEditingCat(null);
      fetchCats();
    } catch (e) {
      toast.error("Failed to update category");
    }
  };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm text-gray-500 font-medium">{categories.length} Asset Categories</span>
        <button 
          onClick={() => setShowAddModal(true)} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1 transition-colors"
        >
          <Plus size={16} /> Add Category
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="p-4 font-medium">Category Name</th>
            <th className="p-4 font-medium">Custom Fields</th>
            <th className="p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categories.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
              <td className="p-4 font-medium">{c.name}</td>
              <td className="p-4 text-gray-600">
                {c.custom_fields && c.custom_fields.length > 0 
                  ? c.custom_fields.join(", ") 
                  : "None"}
              </td>
              <td className="p-4">
                <button 
                  onClick={() => setEditingCat({ ...c, fieldsString: c.custom_fields?.join(", ") || "" })} 
                  className="p-1 text-gray-500 hover:text-emerald-600 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr><td colSpan="3" className="p-4 text-center text-gray-500">No categories found</td></tr>
          )}
        </tbody>
      </table>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Add Asset Category</h2>
              <button onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Category Name</label>
                <input required type="text" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="e.g. Vehicles" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Custom Fields (comma-separated)</label>
                <input type="text" value={newCat.fieldsString} onChange={e => setNewCat({...newCat, fieldsString: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" placeholder="e.g. warranty_period, color, model_year" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-sm transition-colors">Create Category</button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Category</h2>
              <button onClick={() => setEditingCat(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Category Name</label>
                <input required type="text" value={editingCat.name} onChange={e => setEditingCat({...editingCat, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Custom Fields (comma-separated)</label>
                <input type="text" value={editingCat.fieldsString} onChange={e => setEditingCat({...editingCat, fieldsString: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded text-sm transition-colors">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- EMPLOYEES TABLE ---
const EmployeesTable = () => {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editingEmp, setEditingEmp] = useState(null);

  const fetchData = async () => {
    try {
      const [empRes, deptRes] = await Promise.all([
        api.get("/users"),
        api.get("/departments")
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/users/${editingEmp.email}`, {
        name: editingEmp.name,
        department_id: editingEmp.department_id || null,
        status: editingEmp.status,
        role: editingEmp.role
      });
      toast.success("Employee updated!");
      setEditingEmp(null);
      fetchData();
    } catch (e) {
      toast.error("Failed to update employee");
    }
  };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-sm text-gray-500 font-medium">{employees.length} Users Registered</span>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="p-4 font-medium">Name</th>
            <th className="p-4 font-medium">Email</th>
            <th className="p-4 font-medium">Department</th>
            <th className="p-4 font-medium">Role</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {employees.map((emp) => (
            <tr key={emp.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
              <td className="p-4 font-medium">{emp.name || "Unset"}</td>
              <td className="p-4 text-gray-600">{emp.email}</td>
              <td className="p-4 text-gray-600">
                {departments.find(d => d.id === emp.department_id)?.name || "Unassigned"}
              </td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                  emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                  emp.role === 'Asset Manager' ? 'bg-blue-100 text-blue-700' : 
                  emp.role === 'Department Head' ? 'bg-emerald-100 text-emerald-700' : 
                  'bg-gray-100 text-gray-700'
                }`}>
                  {emp.role}
                </span>
              </td>
              <td className="p-4">
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  emp.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                }`}>
                  {emp.status}
                </span>
              </td>
              <td className="p-4">
                <button 
                  onClick={() => setEditingEmp(emp)} 
                  className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
              </td>
            </tr>
          ))}
          {employees.length === 0 && (
            <tr><td colSpan="6" className="p-4 text-center text-gray-500">No employees found</td></tr>
          )}
        </tbody>
      </table>

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Edit Employee Profile</h2>
              <button onClick={() => setEditingEmp(null)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Full Name</label>
                <input required type="text" value={editingEmp.name || ""} onChange={e => setEditingEmp({...editingEmp, name: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Department</label>
                <select value={editingEmp.department_id || ""} onChange={e => setEditingEmp({...editingEmp, department_id: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="">Unassigned</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Role</label>
                <select value={editingEmp.role} onChange={e => setEditingEmp({...editingEmp, role: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="Employee">Employee</option>
                  <option value="Asset Manager">Asset Manager</option>
                  <option value="Department Head">Department Head</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Status</label>
                <select value={editingEmp.status} onChange={e => setEditingEmp({...editingEmp, status: e.target.value})} className="w-full border border-gray-300 rounded p-2 text-sm bg-white">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded text-sm transition-colors">Save Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgSetup;
