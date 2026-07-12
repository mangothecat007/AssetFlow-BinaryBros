import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

const OrgSetup = () => {
  const [activeTab, setActiveTab] = useState("departments");

  return (
    <div className="w-full">
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

const DepartmentsManager = () => {
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState("");

  const fetchDepts = async () => {
    try {
      const res = await api.get("/departments");
      setDepartments(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDepts();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newDept) return;
    try {
      await api.post("/departments", {
        id: "dept_" + Date.now(),
        name: newDept,
        status: "Active"
      });
      toast.success("Department added!");
      setNewDept("");
      fetchDepts();
    } catch (e) {
      toast.error("Failed to add department");
    }
  };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <form onSubmit={handleAdd} className="flex gap-4 max-w-lg">
          <input 
            type="text" 
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
            placeholder="New Department Name" 
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm" 
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold">Add</button>
        </form>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="p-4 font-medium">Department</th>
            <th className="p-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {departments.map((d) => (
            <tr key={d.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
              <td className="p-4 font-medium">{d.name}</td>
              <td className="p-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">{d.status}</span></td>
            </tr>
          ))}
          {departments.length === 0 && (
            <tr><td colSpan="2" className="p-4 text-center text-gray-500">No departments found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const CategoriesTable = () => {
  const [categories, setCategories] = useState([]);
  const [newCat, setNewCat] = useState("");

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
    if (!newCat) return;
    try {
      await api.post("/categories", {
        id: "cat_" + Date.now(),
        name: newCat
      });
      toast.success("Category added!");
      setNewCat("");
      fetchCats();
    } catch (e) {
      toast.error("Failed to add category");
    }
  };

  return (
    <div>
      <div className="p-4 bg-gray-50 border-b border-gray-100">
        <form onSubmit={handleAdd} className="flex gap-4 max-w-lg">
          <input 
            type="text" 
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New Category Name (e.g. Vehicles)" 
            className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm" 
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-sm font-bold transition-colors">Add Category</button>
        </form>
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
            <th className="p-4 font-medium">Category Name</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {categories.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
              <td className="p-4 font-medium">{c.name}</td>
            </tr>
          ))}
          {categories.length === 0 && (
            <tr><td className="p-4 text-center text-gray-500">No categories found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const EmployeesTable = () => {
  const [employees, setEmployees] = useState([]);
  
  const fetchEmployees = async () => {
    try {
      const res = await api.get("/users");
      setEmployees(res.data);
    } catch(e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const promoteUser = async (email, newRole) => {
    try {
      await api.patch(`/users/${email}/role`, { role: newRole });
      toast.success(`${email} promoted to ${newRole}`);
      fetchEmployees();
    } catch (e) {
      toast.error("Failed to update role");
    }
  };

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-white border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
          <th className="p-4 font-medium">Email</th>
          <th className="p-4 font-medium">Role</th>
          <th className="p-4 font-medium">Status</th>
          <th className="p-4 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {employees.map((emp) => (
          <tr key={emp.id} className="hover:bg-gray-50 transition-colors text-sm text-gray-900">
            <td className="p-4 font-medium">{emp.email}</td>
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
            <td className="p-4"><span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">{emp.status}</span></td>
            <td className="p-4 flex gap-2">
              {emp.role === 'Employee' && (
                <>
                  <button onClick={() => promoteUser(emp.email, 'Asset Manager')} className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded font-medium transition-colors">
                    Make Asset Manager
                  </button>
                  <button onClick={() => promoteUser(emp.email, 'Department Head')} className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded font-medium transition-colors">
                    Make Dept Head
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
        {employees.length === 0 && (
          <tr><td colSpan="4" className="p-4 text-center text-gray-500">No employees found</td></tr>
        )}
      </tbody>
    </table>
  );
};

export default OrgSetup;
