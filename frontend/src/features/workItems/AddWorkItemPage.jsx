// frontend/src/features/clients/AddClientPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkItem } from "../../services/workItemService";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import WorkItemForm from "./WorkItemForm";

const AddWorkItemPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    mutate: addWorkItemMutate,
    isLoading,
    error,
  } = useMutation({
    mutationFn: createWorkItem,
    onSuccess: (newWorkItem) => {
      console.log("WorkItem created:", newWorkItem);
      // Invalidate client list cache to show the new client
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Optionally pre-populate cache for the new client's detail view if needed
      // queryClient.setQueryData(['client', newClient.id], newClient);
      // Navigate back to the client list (or to the new client's detail page)
      navigate("/projects");
      // TODO: Show success notification
    },
    onError: (err) => {
      console.error("Error creating client:", err);
      // Error message is handled by the form display logic below
    },
  });

  const handleFormSubmit = async (data) => {
    // Comments remain the same
    // Wrap mutate call in async/await if you need to do something after it finishes *here*
    // Otherwise, onSuccess/onError handle the follow-up actions

    console.log("Submitting new client data:", data); // Optional: Log the data being submitted
    addWorkItemMutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)} // Go back to previous page
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          aria-label="Go back"
        >
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Add New Client
        </h1>
      </div>

      {/* Display General Mutation Error */}
      {error instanceof Error && (
        <div
          className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <span className="font-medium">Error:</span>{" "}
          {error.message || "Failed to create client."}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <WorkItemForm
          onSubmit={handleFormSubmit}
          isLoading={isLoading}
          submitButtonText="Create Client"
        />
      </div>
    </div>
  );
};

export default AddWorkItemPage;
