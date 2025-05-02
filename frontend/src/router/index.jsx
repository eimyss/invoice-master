import React, { useEffect, useState, useRef } from "react"; // Added useRef
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

import AddClientPage from "../features/clients/AddClientPage"; // Import Add page
import EditClientPage from "../features/clients/EditClientPage"; // Import Edit page
// --- Layouts & Pages ---
// Ensure these paths are correct based on your project structure
import Layout from "../components/Layout";
import DashboardPage from "../pages/DashboardPage";
import LoginPage from "../pages/LoginPage";
import ClientListPage from "../features/clients/ClientListPage";
import ProjectListPage from "../features/projects/ProjectListPage";
import AddProjectPage from "../features/projects/AddProjectPage";
import WorkItemListPage from "../features/workItems/WorkItemListPage";
import AddWorkItemPage from "../features/workItems/AddWorkItemPage";
// Import other pages as needed
// import ProjectListPage from '../features/projects/ProjectListPage';
// import InvoiceListPage from '../features/invoices/InvoiceListPage';

// --- Auth Callback Component ---
const AuthCallback = () => {
  console.log("AuthCallback: Component Rendered/Re-rendered");
  const {
    handleAuthenticationCallback,
    isLoading: isAuthLoading,
    authError,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  // Use useRef to track if processing has been initiated, helps prevent double calls
  // more reliably than state in some StrictMode scenarios if state updates trigger effect re-run too quickly
  const processingInitiated = useRef(false);

  useEffect(() => {
    console.log("AuthCallback: useEffect triggered.", {
      search: location.search,
      hasProcessed: processingInitiated.current,
    });

    // --- Prevent re-processing ---
    if (processingInitiated.current) {
      console.log(
        "AuthCallback: Processing already initiated, skipping effect run.",
      );
      return;
    }
    // -----------------------------

    const processCallback = async () => {
      console.log("AuthCallback: Starting processCallback async function.");
      // Mark as initiated *before* the async call
      processingInitiated.current = true;
      setIsProcessing(true); // Ensure loading state is active

      const params = new URLSearchParams(location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");
      const errorDescription = params.get("error_description");

      console.log("AuthCallback: Extracted Params:", {
        code,
        state,
        error,
        errorDescription,
      });

      if (error) {
        console.error("AuthCallback: Error received directly from Authentik:", {
          error,
          errorDescription,
        });
        const errorMsg = `${error}${errorDescription ? `: ${errorDescription}` : ""}`;
        navigate(`/login?error=${encodeURIComponent(errorMsg)}`, {
          replace: true,
        });
        setIsProcessing(false); // Ensure processing stops
        return; // Stop processing
      }

      if (code && state) {
        console.log(
          "AuthCallback: Code and state found, calling handleAuthenticationCallback...",
        );
        const success = await handleAuthenticationCallback(code, state); // This function now sets authError in context on failure
        if (success) {
          console.log(
            "AuthCallback: handleAuthenticationCallback successful. Navigating to '/'.",
          );
          // Navigate to dashboard on success
          navigate("/", { replace: true });
        } else {
          // Error should be set in AuthContext by handleAuthenticationCallback
          console.error(
            "AuthCallback: handleAuthenticationCallback failed. Navigating to '/login'.",
          );
          navigate("/login", { replace: true }); // LoginPage will display the error from context
        }
      } else {
        console.error("AuthCallback: Missing code or state in URL params.");
        // Navigate to login with error if essential params are missing
        navigate("/login?error=missing_callback_params", { replace: true });
      }
      console.log("AuthCallback: processCallback finished.");
      // Setting state might trigger re-render, but processingInitiated.current prevents re-execution
      setIsProcessing(false); // Mark processing finished
    };

    processCallback();

    // No dependencies needed if we use ref to prevent re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount

  // Loading Indicator: Show while AuthContext is initially loading OR while this component is processing the callback
  if (isAuthLoading || isProcessing) {
    console.log("AuthCallback: Rendering loading state...", {
      isAuthLoading,
      isProcessing,
    });
    return (
      <div className="flex justify-center items-center h-screen">
        Processing login...
      </div>
    );
  }

  // Fallback/Redirecting message (should ideally not be seen if navigation works)
  console.log("AuthCallback: Rendering final state (likely redirecting).", {
    isAuthLoading,
    isProcessing,
    authError,
  });
  return (
    <div className="flex justify-center items-center h-screen">
      Redirecting...
    </div>
  );
};

// --- Protected Route Component ---
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  console.log("ProtectedRoute: Checking auth status...", {
    isAuthenticated,
    isLoading,
    pathname: location.pathname,
  });

  if (isLoading) {
    console.log("ProtectedRoute: Auth is loading, showing loading indicator.");
    // Show loading indicator while auth state is being determined
    return (
      <div className="flex justify-center items-center h-screen">
        Loading Authentication...
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log(
      "ProtectedRoute: User not authenticated. Redirecting to login.",
    );
    // Redirect them to the /login page, passing the current location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("ProtectedRoute: User authenticated. Rendering children.");
  // If authenticated, render the requested component
  return children;
};

// --- Main Router Setup ---
const AppRouter = () => {
  console.log("AppRouter: Rendering.");
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected Routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          {/* Client Routes */}
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/new" element={<AddClientPage />} />{" "}
          {/* Add New Route */}
          <Route
            path="clients/:clientId/edit"
            element={<EditClientPage />}
          />{" "}
          <Route path="projects" element={<ProjectListPage />} />
          <Route path="projects/new" element={<AddProjectPage />} />{" "}
          {/* Edit Route */}
          <Route path="workItems" element={<WorkItemListPage />} />
          <Route path="workItems/new" element={<AddWorkItemPage />} />
          {/* Optional Detail Route: <Route path="clients/:clientId" element={<ClientDetailPage />} /> */}
          {/* Other feature routes */}
          {/* <Route path="projects" element={<ProjectListPage />} /> */}
          {/* <Route path="invoices" element={<InvoiceListPage />} /> */}
        </Route>

        {/* 404 */}
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
