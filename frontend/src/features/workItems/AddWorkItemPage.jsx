// frontend/src/features/clients/AddClientPage.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createWorkItem } from "../../services/workItemService";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import WorkItemForm from "./WorkItemForm";
import { useNotification } from "../../context/NotificationContext";

const AddWorkItemPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

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
      
      // Show success notification
      addNotification({
        type: 'success',
        title: 'Work Item Created',
        message: 'Work item has been successfully created.',
        duration: 5000,
      });
      
      // Navigate back to the work items list
      navigate("/workItems");
    },
    onError: (err) => {
      console.error("Error creating work item:", err);
      // Show error notification
      addNotification({
        type: 'error',
        title: 'Error',
        message: err.message || 'Failed to create work item.',
        duration: 7000,
      });
    },
  });

  const handleFormSubmit = async (data) => {
    console.log("Submitting new work item data:", data);
    addWorkItemMutate(data);
  };

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
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Add New Work Item
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <WorkItemForm
          onSubmit={handleFormSubmit}
          isLoading={isLoading}
          submitButtonText="Create Work Item"
        />
      </div>
    </div>
  );
};

export default AddWorkItemPage;
