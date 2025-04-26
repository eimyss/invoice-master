import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate, useLocation, useSearchParams } from "react-router-dom"; // Added useSearchParams

const LoginPage = () => {
  const { login, isAuthenticated, isLoading, authError } = useAuth(); // Get authError
  const location = useLocation();
  const [searchParams] = useSearchParams(); // To read query params like ?error=...

  const from = location.state?.from?.pathname || "/";

  // Get error message from query params OR from auth context
  const queryError = searchParams.get("error");
  const errorMessage = queryError
    ? `Login failed: ${queryError.replace(/_/g, " ")}`
    : authError;

  const handleLogin = () => {
    login();
  };

  if (isAuthenticated && !isLoading) {
    // Ensure loading is false before redirecting
    return <Navigate to={from} replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-8 max-w-sm w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md">
        <h2 className="text-2xl font-semibold text-center text-gray-800 dark:text-gray-100 mb-6">
          Login
        </h2>

        {/* Display Error Message */}
        {errorMessage && (
          <div className="mb-4 p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-md border border-red-300 dark:border-red-600">
            {errorMessage}
          </div>
        )}

        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Log in using your Authentik account.
        </p>
        <button
          onClick={handleLogin}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? "Processing..." : "Login with Authentik"}
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
