import {
  ArrowLeftIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom"; // Added useLocation
import { useNotification } from "../../context/NotificationContext";
import {
  createWorkItem,
  getWorkItemById,
} from "../../services/workItemService";
import WorkItemForm from "./WorkItemForm";
const FORM_MODES = {
  ADD: "add",
  EDIT: "edit",
  VIEW: "view", // Optional: for a read-only view
};

const WorkItemStatus = {
  ACTIVE: "active",
  CREATED: "created",
  DISABLED: "disabled",
  CANCELED: "canceled",
  PROCESSED: "processed",
  SENT: "sent",
};
const WorkItemFormPage = () => {
  const { addNotification } = useNotification();
  const { workItemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [formMode, setFormMode] = useState(FORM_MODES.ADD);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (workItemId) {
      if (location.pathname.includes("/edit")) {
        setFormMode(FORM_MODES.EDIT);
        setIsReadOnly(false);
      } else {
        setFormMode(FORM_MODES.VIEW);
        setIsReadOnly(true);
      }
    } else {
      setFormMode(FORM_MODES.ADD);
      setIsReadOnly(false);
    }
  }, [workItemId, location.pathname]);
  const queryClient = useQueryClient();
  const {
    mutate: addWorkItemMutate,
    isLoading: isCreatingWorkItem, // More specific loading state name
    error: createWorkItemError, // More specific error state name
  } = useMutation({
    mutationFn: createWorkItem,
    onSuccess: (newlyCreatedWorkItem) => {
      console.log("WorkItem created successfully:", newlyCreatedWorkItem);

      addNotification({
        type: "success",
        title: "Work Item Created",
        message: "Work item has been successfully created.",
        duration: 5000,
      });
      // 1. Invalidate the general list of work items/time entries
      //    Use a query key that matches how you fetch the list.
      //    If your list depends on filters (like project_id), be specific.
      queryClient.invalidateQueries({ queryKey: ["workItems"] }); // General invalidation

      // 2. More specific invalidation (Better):
      //    If the list of work items is fetched per project:
      if (newlyCreatedWorkItem.project_id) {
        queryClient.invalidateQueries({
          queryKey: [
            "workItems",
            { projectId: newlyCreatedWorkItem.project_id },
          ],
        });
        // Also invalidate if you have a query for uninvoiced items for that project
        queryClient.invalidateQueries({
          queryKey: [
            "workItems",
            { projectId: newlyCreatedWorkItem.project_id, isInvoiced: false },
          ],
        });
      }

      // 3. Optionally, pre-populate cache for a "detail" view of this new item
      // queryClient.setQueryData(['workItem', newlyCreatedWorkItem.id], newlyCreatedWorkItem);
      // 5. Navigate to a relevant page
      navigate("/workItems"); // Or to the project's page, or back to where they came from
    },
    onError: (error) => {
      console.error("Error creating WorkItem:", error);
      addNotification({
        type: "error",
        title: "Work Item could not be created",
        message: "Work item cannot be created message: " + error,
        duration: 5000,
      });
      // Error message is available in `createWorkItemError` state
      // You can display this error in your UI
      // alert(`Error: ${error.message || 'Failed to create time entry.'}`);
    },
    // onSettled: () => {
    //     // Runs after success or error
    //     console.log("Create WorkItem mutation settled.");
    // }
  });

  const {
    mutate: updateWorkItemMutate,
    isLoading: isUpdating,
    error: updateError,
  } = useMutation({});

  const {
    data: existingWorkItemData, // This will be 'undefined' until fetched
    isLoading: isLoadingWorkItem,
    isError: isWorkItemError,
    error: workItemError,
    isSuccess: isWorkItemFetchSuccess, // Added for clarity
  } = useQuery({
    queryKey: ["workItem", workItemId],
    queryFn: () => getWorkItemById(workItemId),
    enabled:
      !!workItemId &&
      (formMode === FORM_MODES.EDIT || formMode === FORM_MODES.VIEW), // Fetch only in edit/view mode and if projectId exists
    staleTime: 1000 * 60 * 5,
  });

  // --- Picker Definitions ---
  const projectPickerColumns = [
    { header: "Project Name", accessor: "name" },
    {
      header: "Client ID (TEMP)",
      accessor: "client_id",
      options: { hiddenSm: true, truncate: 8 },
    },
    { header: "Status", accessor: "status", options: { hiddenMd: true } },
  ];
  const formInitialData = useMemo(() => {
    console.log(
      "ProjectFormPage: Calculating formInitialData. Mode:",
      formMode,
      "existingWorkItemData:",
      existingWorkItemData,
    );
    if (formMode === FORM_MODES.ADD) {
      return {
        rates: [{ name: "", price_per_hour: "" }],
        status: FORM_MODES.ADD === "add" ? WorkItemStatus.CREATED : undefined,
      }; // Default for new project
    }
    // For EDIT or VIEW mode, wait until existingProjectData is successfully fetched
    if (
      (formMode === FORM_MODES.EDIT || formMode === FORM_MODES.VIEW) &&
      isWorkItemFetchSuccess &&
      existingWorkItemData
    ) {
      return {
        ...existingWorkItemData,
        client_name: existingWorkItemData.client_name || "",
        // Ensure rates are properly formatted if they come from API as strings
        rates: existingWorkItemData.rates?.map((r) => ({
          ...r,
          price_per_hour: parseFloat(r.price_per_hour) || "",
        })) || [{ name: "", price_per_hour: "" }],
      };
    }
    // Return a default empty object or initial structure for add mode if data isn't ready for edit/view
    // This ensures the form has some default structure before data loads for edit/view
    return {
      rates: [{ name: "", price_per_hour: "" }],
      status: WorkItemStatus.PROCESSED,
    };
  }, [formMode, existingWorkItemData, isWorkItemFetchSuccess]); // Depend on formMode and the data itself
  // --- Form Submission Handler ---
  const handleFormSubmit = async (data) => {
    // 'data' is ProjectFormData
    console.log("Form submitted in mode:", formMode, "with data:", data);
    if (formMode === FORM_MODES.EDIT) {
      if (!workItemId) return;
      updateWorkItemMutate({ workItemId, workItemData: data });
    } else if (formMode === FORM_MODES.ADD) {
      addWorkItemMutate(data);
    } else {
      // View mode, no submission logic needed here, form is read-only
      console.log("View mode, no submission.");
    }
  };

  // --- Determine Page Title and Submit Button Text ---
  let pageTitle = "Add New Work Item";
  let submitButtonText = "Create Work Item";
  if (formMode === FORM_MODES.EDIT) {
    pageTitle = `Edit Project: ${existingWorkItemData?.name || "Loading..."}`;
    submitButtonText = "Update WorkItem";
  } else if (formMode === FORM_MODES.VIEW) {
    pageTitle = `View Project: ${existingWorkItemData?.name || "Loading..."}`;
    // No submit button in view mode or it's disabled/hidden
  }

  if (workItemId && isLoadingWorkItem) {
    return <div className="text-center p-10">Loading work Item data...</div>;
  }
  if (workItemId && isWorkItemError) {
    return (
      <div className="m-4 p-4 text-red-700 bg-red-100 rounded dark:bg-red-900/30 dark:text-red-300">
        Error loading project: {workItemError?.message || "Unknown error"}
        <button
          onClick={() => navigate(-1)}
          className="ml-4 px-2 py-1 border rounded text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }
  if (
    workItemId &&
    !isLoadingWorkItem &&
    !existingWorkItemData &&
    formMode !== FORM_MODES.ADD
  ) {
    // If we expected data (edit/view) but didn't get it after loading
    return (
      <div className="m-4 p-4 text-yellow-700 bg-yellow-100 rounded dark:bg-yellow-900/30 dark:text-yellow-300">
        Project with ID '{workItemId}' not found.
        <button
          onClick={() => navigate(-1)}
          className="ml-4 px-2 py-1 border rounded text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  // --- Determine if form should be submittable ---
  const isSubmitting = isCreatingWorkItem || isUpdating;
  const mutationError = createWorkItemError || updateError;

  // Prepare initialData for the form, including potentially fetched client_name
  // Your ProjectForm expects initialData.client_id AND initialData.client_name for the picker
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              navigate(
                formMode === FORM_MODES.ADD ? "/workItems" : `/workItems`,
              )
            } // Or navigate(-1)
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-6 w-6" />
          </button>
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
            {pageTitle}
          </h1>
        </div>
        {/* Toggle to Edit/View if applicable */}
        {formMode === FORM_MODES.VIEW && workItemId && (
          <button
            onClick={() => navigate(`/workItems/${workItemId}/edit`)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" /> Edit
          </button>
        )}
        {formMode === FORM_MODES.EDIT && workItemId && (
          <button
            onClick={() => navigate(`/workItems/${workItemId}`)} // Navigate to view mode path
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            <EyeIcon className="-ml-0.5 mr-2 h-4 w-4" /> View
          </button>
        )}
      </div>

      {/* Display General Mutation Error */}
      {mutationError && (
        <div
          className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <span className="font-medium">Error:</span>{" "}
          {mutationError?.message || "Failed to save workItem."}
        </div>
      )}

      {(formMode === FORM_MODES.ADD ||
        (formMode !== FORM_MODES.ADD && existingWorkItemData)) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <WorkItemForm
            key={workItemId || "add"} // Re-mount form when projectId changes for edit/view
            onSubmit={handleFormSubmit}
            initialData={formInitialData}
            isLoading={isSubmitting}
            submitButtonText={submitButtonText}
            isReadOnly={isReadOnly} // Pass read-only state to form
            mode={formMode} // Pass current mode to form
          />
        </div>
      )}
    </div>
  );
};

export default WorkItemFormPage;
