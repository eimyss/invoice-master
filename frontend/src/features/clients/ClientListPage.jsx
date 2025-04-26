// frontend/src/features/clients/ClientListPage.jsx
import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClients, deleteClient } from "../../services/clientService";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { debounce } from "lodash";

// Reusable Table Component (can be moved to components/ui)
const ClientTable = ({ clients, onDelete, isLoadingDelete }) => {
  // ... (table implementation remains the same) ...
  if (!clients || clients.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-10">
        No clients found.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        {/* ... thead ... */}
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell"
            >
              Email
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell"
            >
              City
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {/* ... tbody ... */}
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {clients.map((client) => (
            <tr
              key={client.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              {/* ... table cells ... */}
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                <Link
                  to={`/clients/${client.id}/edit`}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {client.name}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {client.email || "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {client.address_city || "-"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                <Link
                  to={`/clients/${client.id}/edit`}
                  title="Edit"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                >
                  <PencilIcon className="h-5 w-5 inline" />
                </Link>
                <button
                  onClick={() => onDelete(client.id, client.name)}
                  title="Delete"
                  disabled={isLoadingDelete}
                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                >
                  <TrashIcon className="h-5 w-5 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function ClientListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const debouncedSetSearchTerm = useMemo(
    () => debounce((term) => setSearchTerm(term), 300),
    [],
  );

  // *** FIX: Remove TypeScript type annotation from parameter ***
  const handleSearchChange = (event) => {
    debouncedSetSearchTerm(event.target.value);
  };
  // ***********************************************************

  const queryKey = ["clients", { searchTerm }];
  const {
    data: clients,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKey,
    queryFn: getClients,
    placeholderData: (prevData) => prevData,
    staleTime: 1000 * 60 * 2,
  });

  const { mutate: deleteClientMutate, isLoading: isLoadingDelete } =
    useMutation({
      mutationFn: deleteClient,
      onSuccess: (deletedClientId) => {
        console.log("Client deleted successfully:", deletedClientId);
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        // alert('Client deleted!'); // Replace with toast/snackbar
      },
      onError: (err) => {
        console.error("Error deleting client:", err);
        alert(
          `Failed to delete client: ${err instanceof Error ? err.message : "Unknown error"}`,
        ); // Replace with toast/snackbar
      },
    });

  const handleDelete = useCallback(
    (clientId, clientName) => {
      // Removed type annotations here too for consistency
      if (
        window.confirm(
          `Are you sure you want to delete client "${clientName}"? This cannot be undone.`,
        )
      ) {
        deleteClientMutate(clientId);
      }
    },
    [deleteClientMutate],
  );

  return (
    <div className="space-y-6">
      {/* ... Header section with Search and Add button ... */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Clients
        </h1>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          </div>
          <input
            type="search"
            placeholder="Search by name, email, city..."
            onChange={handleSearchChange} // Use the fixed handler
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <Link
          to="/clients/new"
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add New Client
        </Link>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Loading clients...
        </p>
      )}
      {isError && (
        <div className="text-center text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 p-4 rounded-md">
          Error loading clients:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      {/* Client Table */}
      {!isLoading && !isError && (
        <ClientTable
          clients={clients}
          onDelete={handleDelete}
          isLoadingDelete={isLoadingDelete}
        />
      )}

      {/* TODO: Add Pagination controls if needed */}
    </div>
  );
}

export default ClientListPage;
