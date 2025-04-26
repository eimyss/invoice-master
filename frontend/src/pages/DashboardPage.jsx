import React from "react";
import { useAuth } from "../contexts/AuthContext"; // Example: Access user info

const DashboardPage = () => {
  const { user } = useAuth(); // Get user info if needed

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 mb-4">Dashboard</h1>
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-700 mb-2">
          Welcome, {user?.name || user?.email || "User"}!
        </h2>
        <p className="text-gray-600">
          This is your main overview page. Add your key metrics and widgets
          here.
        </p>
        {/* Example Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-blue-800">Hours This Month</h3>
            <p className="text-2xl font-bold text-blue-900">--</p>{" "}
            {/* Replace with actual data */}
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-green-800">Revenue This Month</h3>
            <p className="text-2xl font-bold text-green-900">€ --,--</p>{" "}
            {/* Replace with actual data */}
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow-sm">
            <h3 className="font-medium text-yellow-800">Pending Invoices</h3>
            <p className="text-2xl font-bold text-yellow-900">--</p>{" "}
            {/* Replace with actual data */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
