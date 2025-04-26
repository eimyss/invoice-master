import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Layouts & Pages
import Layout from "../components/Layout";
import DashboardPage from "../pages/DashboardPage";
import LoginPage from "../pages/LoginPage";
import ClientListPage from "../features/clients/ClientListPage"; // Corrected import path

// Placeholder for Auth Callback Page/Component
const AuthCallback = () => {
  const { handleAuthenticationCallback, isLoading } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      handleAuthenticationCallback(code, state);
    } else {
      // Handle error - missing code or state
      console.error("Missing code or state in auth callback");
      // Navigate away or show error message
    }
    // Navigate away after handling or on error, potentially to '/'?
    // Be careful with infinite loops if handleAuthenticationCallback fails.
  }, [handleAuthenticationCallback, location]);

  // Show loading indicator while processing
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Processing login...
      </div>
    );
  }

  // Redirect to dashboard after processing (or handle error state)
  // This redirect should ideally happen within handleAuthenticationCallback logic upon success
  return <Navigate to="/" replace />;
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation(); // Get current location

  if (isLoading) {
    // Show loading indicator while auth state is being determined
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to. This allows us to send them back after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />{" "}
        {/* Authentik Redirect URI */}
        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout /> {/* Main application layout */}
            </ProtectedRoute>
          }
        >
          {/* Index route for the root path */}
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<ClientListPage />} />
          {/* Add other protected routes here */}
          {/* <Route path="projects" element={<ProjectListPage />} /> */}
          {/* <Route path="invoices" element={<InvoiceListPage />} /> */}
        </Route>
        {/* Catch-all for not found routes (optional) */}
        <Route path="*" element={<div>404 Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
