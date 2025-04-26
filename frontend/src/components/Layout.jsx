import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
  HomeIcon,
  UsersIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline"; // Example icons

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login"); // Redirect to login after logout
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: HomeIcon },
    { name: "Clients", href: "/clients", icon: UsersIcon },
    // Add other navigation items here
    // { name: 'Projects', href: '/projects', icon: BriefcaseIcon },
    { name: "Invoices", href: "/invoices", icon: DocumentTextIcon },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-md flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-800">
            Rechnung Meister
          </h1>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"} // Match root path exactly
              className={({ isActive }) =>
                `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <item.icon
                className="mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                aria-hidden="true"
              />
              {item.name}
            </NavLink>
          ))}
        </nav>
        {/* Footer / User section */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center mb-2">
            <UserCircleIcon className="h-8 w-8 text-gray-500 mr-2" />
            <span className="text-sm text-gray-600">
              {user?.email || user?.name || "User"}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full group flex items-center justify-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-red-50 hover:text-red-700"
          >
            <ArrowLeftOnRectangleIcon
              className="mr-3 h-6 w-6 flex-shrink-0 text-gray-400 group-hover:text-red-500"
              aria-hidden="true"
            />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
          <div className="container mx-auto px-6 py-8">
            {/* Outlet renders the matched child route component */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
