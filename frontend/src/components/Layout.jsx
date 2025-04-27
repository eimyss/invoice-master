import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ArrowLeftOnRectangleIcon,
  UserCircleIcon,
  HomeIcon,
  BanknotesIcon,
  BriefcaseIcon,
  UsersIcon,
  DocumentTextIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";

// ThemeToggle component remains the same
const ThemeToggle = () => {
  // *** FIX: Set initial state based on localStorage, defaulting to dark ***
  const [isDark, setIsDark] = React.useState(
    localStorage.theme !== "light", // isDark is true unless theme is explicitly 'light'
  );
  // -------------------------------------------------------------------

  // This useEffect correctly updates the class and storage based on the 'isDark' state
  React.useEffect(() => {
    console.log("ThemeToggle Effect: Setting theme based on isDark =", isDark);
    const root = window.document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.theme = "dark";
    } else {
      root.classList.remove("dark");
      localStorage.theme = "light";
    }
  }, [isDark]);

  return (
    <button
      onClick={() => {
        console.log("ThemeToggle Clicked: Toggling theme");
        setIsDark(!isDark); // Toggle the state
      }}
      className="p-2 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? (
        <SunIcon className="h-6 w-6" />
      ) : (
        <MoonIcon className="h-6 w-6" />
      )}
    </button>
  );
};

const Layout = () => {
  // Destructure isAuthenticated and isLoading as well for clarity/checks
  const { userInfo, logout, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  console.log(
    "Layout Render. isLoading:",
    isLoading,
    "isAuthenticated:",
    isAuthenticated,
    "userInfo:",
    userInfo,
  ); // Add log

  const handleLogout = () => {
    // ... (implementation as before) ...
    logout();
    const endSessionUrl = import.meta.env.VITE_AUTHENTIK_END_SESSION_URL;
    if (endSessionUrl) {
      const params = new URLSearchParams({
        post_logout_redirect_uri: window.location.origin + "/login",
      });
      window.location.href = `${endSessionUrl}?${params.toString()}`;
    } else {
      navigate("/login", { replace: true });
    }
  };

  const navigation = [
    // ... (navigation items as before) ...
    { name: "Dashboard", href: "/", icon: HomeIcon },
    { name: "Clients", href: "/clients", icon: UsersIcon },
    { name: "Invoices", href: "/invoices", icon: DocumentTextIcon },
    { name: "Projects", href: "/projects", icon: BriefcaseIcon },
    { name: "Work Items", href: "/workItems", icon: BanknotesIcon },
  ];

  // --- Explicit Loading/Auth Check ---
  // Although ProtectedRoute handles this, an extra layer inside Layout
  // can prevent errors during rapid state transitions.
  if (isLoading) {
    console.log("Layout: Auth context is loading, rendering placeholder.");
    // You might want a more integrated loading spinner here
    return (
      <div className="flex justify-center items-center h-screen">
        Loading Layout...
      </div>
    );
  }

  if (!isAuthenticated) {
    // This case should technically be handled by ProtectedRoute redirecting,
    // but as a safeguard:
    console.log("Layout: Not authenticated (should have been redirected).");
    // Could render null or redirect again, though ProtectedRoute should handle it.
    return null; // Or <Navigate to="/login" replace />;
  }
  // ------------------------------------

  // --- User Info Display Logic ---
  // Ensure userInfo exists before trying to access properties
  const displayUsername = userInfo
    ? userInfo.email || userInfo.name || "User"
    : "Loading User...";
  console.log("Layout: Displaying username as:", displayUsername);
  // -------------------------------

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 shadow-lg flex flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center h-16 flex-shrink-0">
          {" "}
          {/* Fixed height */}
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 truncate">
            Rechnung Meister
          </h1>
          <ThemeToggle />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                `group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors duration-150 ease-in-out ${
                  // Adjusted padding
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 shadow-sm" // More subtle active state, added shadow
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700/50" // Softer hover
                }`
              }
            >
              {(
                { isActive }, // Function as child for icon styling
              ) => (
                <>
                  <item.icon
                    className={`mr-3 h-6 w-6 flex-shrink-0 ${isActive ? "active-icon" : "default-icon"}`} // Simplified
                    aria-hidden="true"
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {/* Footer / User section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center mb-3">
            <UserCircleIcon className="h-8 w-8 text-gray-500 dark:text-gray-400 mr-2" />
            {/* *** Use the safe displayUsername variable *** */}
            <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
              {displayUsername}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full group flex items-center justify-center ..." // Simplified
          >
            <ArrowLeftOnRectangleIcon className="mr-3 h-6 w-6 ..." />
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
