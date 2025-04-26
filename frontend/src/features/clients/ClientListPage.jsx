import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import apiClient from "../../lib/apiClient"; // Use your configured axios instance
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../contexts/AuthContext"; // To ensure user is authenticated

function ClientListPage() {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth(); // Ensure we only fetch if authenticated

  // Function to fetch clients
  const fetchClients = async (search = "") => {
    setIsLoading(true);
    setError(null);
    try {
      // API client should automatically include the token via interceptor
      const response = await apiClient.get("/clients/", {
        params: { search: search, limit: 50 }, // Pass search param
      });
      setClients(response.data);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
      setError(
        err.response?.data?.detail ||
          "Failed to load clients. Check API connection and permissions.",
      );
      setClients([]); // Clear clients on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch clients on component mount and when search term changes (debounced ideally)
  useEffect(() => {
    if (isAuthenticated) {
      // Only fetch if user is logged in
      // Basic debounce example (replace with lodash.debounce or similar for robustness)
      const delayDebounceFn = setTimeout(() => {
        fetchClients(searchTerm);
      }, 500); // Debounce API calls by 500ms

      return () => clearTimeout(delayDebounceFn); // Cleanup timeout on unmount or change
    } else {
      // Handle case where user is not authenticated (shouldn't happen with ProtectedRoute)
      setError("User not authenticated.");
      setClients([]);
      setIsLoading(false);
    }
  }, [searchTerm, isAuthenticated]); // Re-run effect if searchTerm or auth status changes

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleDelete = async (clientId, clientName) => {
    if (
      window.confirm(`Are you sure you want to delete client "${clientName}"?`)
    ) {
      setIsLoading(true); // Indicate loading during delete
      try {
        await apiClient.delete(`/clients/${clientId}`);
        // Refetch the list after deletion
        await fetchClients(searchTerm);
        // Or remove from local state for faster UI update:
        // setClients(clients.filter(c => c.id !== clientId));
      } catch (err) {
        console.error("Failed to delete client:", err);
        setError(err.response?.data?.detail || "Failed to delete client.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="p-0 md:p-0">
      {" "}
      {/* Remove padding if Layout provides it */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-semibold text-gray-800">Clients</h1>
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400"
              aria-hidden="true"
            />
          </div>
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <Link
          to="/clients/new" // TODO: Create this page/modal
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Client
        </Link>
      </div>
      {/* Loading and Error States */}
      {isLoading && (
        <p className="text-center text-gray-500 py-4">Loading clients...</p>
      )}
      {error && (
        <div className="text-center text-red-600 bg-red-100 border border-red-400 p-4 rounded-md">
          {error}
        </div>
      )}
      {/* Client Table */}
      {!isLoading && !error && (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                >
                  VAT ID
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients.length > 0 ? (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {/* TODO: Link to client detail page */}
                      <Link
                        to={`/clients/${client.id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                      {client.email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {client.vat_id || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      {/* TODO: Link to client edit page */}
                      <Link
                        to={`/clients/${client.id}/edit`}
                        title="Edit"
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <PencilIcon className="h-5 w-5 inline" />
                      </Link>
                      <button
                        onClick={() => handleDelete(client.id, client.name)}
                        title="Delete"
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="4"
                    className="text-center py-10 text-sm text-gray-500"
                  >
                    No clients found.{" "}
                    {searchTerm && "Try adjusting your search."}
                    {!searchTerm && (
                      <Link
                        to="/clients/new"
                        className="text-blue-600 hover:underline ml-1"
                      >
                        Add your first client?
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* TODO: Add Pagination Controls */}
    </div>
  );
}

export default ClientListPage;
