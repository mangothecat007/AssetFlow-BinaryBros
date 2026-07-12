import React, { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// All app pages with their route paths
const ALL_PAGES = [
  { path: "dashboard",     label: "Dashboard",             roles: ["admin", "Asset Manager", "Department Head", "Employee"] },
  { path: "org-setup",     label: "Org Setup",             roles: ["admin"] },
  { path: "assets",        label: "Asset Directory",        roles: ["admin", "Asset Manager", "Department Head", "Employee"] },
  { path: "allocation",    label: "Allocation & Transfers", roles: ["admin", "Asset Manager", "Department Head"] },
  { path: "booking",       label: "Resource Booking",       roles: ["admin", "Asset Manager", "Department Head", "Employee"] },
  { path: "maintenance",   label: "Maintenance",            roles: ["admin", "Asset Manager", "Department Head", "Employee"] },
  { path: "audit",         label: "Asset Audit",            roles: ["admin", "Asset Manager"] },
  { path: "reports",       label: "Reports & Analytics",    roles: ["admin", "Asset Manager"] },
  { path: "notifications", label: "Notifications",          roles: ["admin", "Asset Manager", "Department Head", "Employee"] },
];

const TopBar = () => {
  const { role, username } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Current page segment
  const segment = location.pathname.split("/").filter(Boolean).pop();
  const current = ALL_PAGES.find(p => p.path === segment) || ALL_PAGES[0];

  // Filter pages allowed for this role
  const visiblePages = useMemo(
    () => ALL_PAGES.filter(p => p.roles.includes(role)),
    [role]
  );

  // User initials from email
  const initials = username
    ? username.split("@")[0].slice(0, 2).toUpperCase()
    : "AF";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0" style={{backgroundColor: '#ffffff', opacity: 1}}>

      {/* Left: page dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <span className="font-semibold text-gray-800 text-sm">{current.label}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px] bg-white border border-gray-200 shadow-lg rounded-lg">
          {visiblePages.map(p => (
            <DropdownMenuItem
              key={p.path}
              onClick={() => navigate(`/app/${p.path}`)}
              className={`cursor-pointer text-sm font-medium ${
                current.path === p.path ? "text-blue-600" : "text-gray-600"
              }`}
            >
              <span className="text-gray-300 mr-2">/</span>
              {p.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right: Bell + avatar */}
      <div className="flex items-center gap-3">
        <NotificationBell />

        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold select-none">
            {initials}
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-xs font-semibold text-gray-800 max-w-[130px] truncate">{username || "User"}</p>
            <p className="text-[11px] text-gray-400 capitalize">{role}</p>
          </div>
        </div>
      </div>

    </header>
  );
};

export default TopBar;
