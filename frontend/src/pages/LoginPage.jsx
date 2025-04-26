import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

const LoginPage = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/"; // Get redirect path or default to root

  const handleLogin = () => {
    login(); // This will redirect to Authentik
  };

  // If user is already authenticated, redirect them away from login page
  if (isAuthenticated) {
    return <Navigate to={from} replace />; // Redirect back to where they came from
  }

  // Show loading state if login process is happening
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 max-w-sm w-full bg-white rounded-lg border border-gray-200 shadow-md">
        <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">
          Login
        </h2>
        <p className="text-center text-gray-600 mb-6">
          Click the button below to log in using your Authentik account.
        </p>
        <button
          onClick={handleLogin}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          disabled={isLoading} // Disable button while loading
        >
          {isLoading ? "Redirecting..." : "Login with Authentik"}
        </button>
        {/* Add error message display here if login fails */}
      </div>
    </div>
  );
};

export default LoginPage;
