import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login.jsx";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Dashboard from "@/pages/Dashboard.jsx";
import OrgSetup from "@/pages/OrgSetup.jsx";
import AssetDirectory from "@/pages/AssetDirectory.jsx";
import AllocationView from "@/pages/AllocationView.jsx";
import BookingView from "@/pages/BookingView.jsx";
import MaintenanceView from "@/pages/MaintenanceView.jsx";
import AuditView from "@/pages/AuditView.jsx";
import ReportsView from "@/pages/ReportsView.jsx";
import { userStore } from "@/lib/api";
import { NavLink, Outlet } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

// Sidebar Navigation Item
const NavItem = ({ to, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `p-2 rounded font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}
  >
    {label}
  </NavLink>
);

// Main ERP Layout
const AppLayout = () => {
  const role = userStore.getRole();
  return (
    <div className="flex h-screen bg-[#f3f4f6] text-gray-900">
      <aside className="w-64 bg-white border-r border-gray-200 p-4 hidden md:flex flex-col">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">AF</div>
          <h1 className="text-xl font-bold text-gray-800">AssetFlow</h1>
        </div>
        <nav className="flex flex-col gap-2">
          <NavItem to="/app/dashboard" label="Dashboard" />
          <NavItem to="/app/org-setup" label="Org Setup" />
          <NavItem to="/app/assets" label="Asset Directory" />
          <NavItem to="/app/allocation" label="Allocation & Transfers" />
          <NavItem to="/app/booking" label="Resource Booking" />
          <NavItem to="/app/maintenance" label="Maintenance" />
          <NavItem to="/app/audit" label="Asset Audit" />
          <NavItem to="/app/reports" label="Reports & Analytics" />
        </nav>
        <div className="mt-auto p-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-800">Logged in as {role}</p>
          <a href="/login" className="text-xs text-red-600 hover:underline mt-1 inline-block">Sign Out</a>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <Navigate to="/login" replace />} 
        />
        
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <Login />} 
        />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="org-setup" element={<OrgSetup />} />
          <Route path="assets" element={<AssetDirectory />} />
          <Route path="allocation" element={<AllocationView />} />
          <Route path="booking" element={<BookingView />} />
          <Route path="maintenance" element={<MaintenanceView />} />
          <Route path="audit" element={<AuditView />} />
          <Route path="reports" element={<ReportsView />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500 text-lg">Coming soon in Phase 4...</div>} />
        </Route>
        
        <Route 
          path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
};

function App() {
  return (
    <div className="App min-h-screen bg-[#f3f4f6]">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
