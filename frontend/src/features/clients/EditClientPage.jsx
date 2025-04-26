// frontend/src/features/clients/EditClientPage.jsx
import React from "react"; // No need for FC type import
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientSchema } from "./clientSchema";
import { getClientById, updateClient } from "../../services/clientService";
// ClientFormData type import might still be useful for reference, but not used in function signatures here
// import { ClientFormData } from './clientSchema';
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

const EditClientPage = () => {
  // Removed : React.FC
  const { clientId } = useParams(); // Removed <{ clientId: string }> generic
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Fetch existing client data ---
  const {
    data: clientData,
    isLoading: isLoadingClient,
    isError: isClientError,
    error: clientError,
  } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => getClientById(clientId), // No need for non-null assertion '!' here if checked below
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
  });

  // --- Mutation for updating client ---
  const {
    mutate: updateClientMutate,
    isLoading: isUpdating,
    error: updateError,
  } = useMutation({
    mutationFn: updateClient,
    onSuccess: (updatedClient) => {
      console.log("Client updated:", updatedClient);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.setQueryData(["client", clientId], updatedClient);
      navigate("/clients");
      // TODO: Show success notification
    },
    onError: (err) => {
      console.error("Error updating client:", err);
      // Error message handled below
    },
  });

  // Removed type annotation from 'data' parameter
  const handleFormSubmit = async (data) => {
    if (!clientId) return;
    updateClientMutate({ clientId, clientData: data });
  };

  // --- Loading and Error States for Fetching ---
  if (isLoadingClient) {
    return <div className="text-center p-10">Loading client data...</div>;
  }

  // Display specific error for client fetch failure
  if (isClientError) {
    return (
      <div className="m-4 p-4 text-red-700 bg-red-100 rounded dark:bg-red-900/30 dark:text-red-300">
        Error loading client:{" "}
        {clientError instanceof Error ? clientError.message : "Unknown error"}
        <button
          onClick={() => navigate(-1)}
          className="ml-4 px-2 py-1 border rounded text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  // Handle case where data fetch succeeded but returned nothing (e.g., 404 handled gracefully)
  if (!clientData) {
    return (
      <div className="m-4 p-4 text-yellow-700 bg-yellow-100 rounded dark:bg-yellow-900/30 dark:text-yellow-300">
        Client with ID '{clientId}' not found.
        <button
          onClick={() => navigate(-1)}
          className="ml-4 px-2 py-1 border rounded text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  // --- Render Page Content ---
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        {/* Use optional chaining just in case clientData is briefly null */}
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Edit Client: {clientData?.name}
        </h1>
      </div>

      {/* Display General Update Error */}
      {updateError instanceof Error && (
        <div
          className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <span className="font-medium">Update Error:</span>{" "}
          {updateError.message || "Failed to update client."}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        {/* Pass fetched data to pre-fill the form */}
        {/* ClientForm should also be using standard JS/JSX */}
        <ClientForm
          onSubmit={handleFormSubmit}
          initialData={clientData}
          isLoading={isUpdating}
          submitButtonText="Update Client"
        />
      </div>
    </div>
  );
};

export default EditClientPage;
