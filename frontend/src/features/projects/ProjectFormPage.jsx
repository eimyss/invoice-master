// frontend/src/features/projects/ProjectFormPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom"; // Added useLocation
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProjectForm from "./ProjectForm"; // Your existing project form component
import {
  createProject,
  getProjectById,
  updateProject,
} from "../../services/projectService";
// import { ProjectFormData } from './projectSchema'; // Not strictly needed if form handles types
import {
  ArrowLeftIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

// Define modes
const FORM_MODES = {
  ADD: "add",
  EDIT: "edit",
  VIEW: "view", // Optional: for a read-only view
};

const ProjectStatus = {
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};

const ProjectFormPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [formMode, setFormMode] = useState(FORM_MODES.ADD);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (projectId) {
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
  }, [projectId, location.pathname]);

  // Fetch Existing Project Data (ALWAYS CALL useQuery)
  const {
    data: existingProjectData, // This will be 'undefined' until fetched
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
    isSuccess: isProjectFetchSuccess, // Added for clarity
  } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProjectById(projectId),
    enabled:
      !!projectId &&
      (formMode === FORM_MODES.EDIT || formMode === FORM_MODES.VIEW), // Fetch only in edit/view mode and if projectId exists
    staleTime: 1000 * 60 * 5,
  });

  // Mutations (ALWAYS CALL useMutation)
  const {
    mutate: addProjectMutate,
    isLoading: isAdding,
    error: addError,
  } = useMutation({
    /* ... */
  });
  const {
    mutate: updateProjectMutate,
    isLoading: isUpdating,
    error: updateError,
  } = useMutation({
    /* ... */
  });

  // --- Prepare initialData for the form (ALWAYS CALL useMemo) ---
  const formInitialData = useMemo(() => {
    console.log(
      "ProjectFormPage: Calculating formInitialData. Mode:",
      formMode,
      "existingProjectData:",
      existingProjectData,
    );
    if (formMode === FORM_MODES.ADD) {
      return {
        rates: [{ name: "", price_per_hour: "" }],
        status: FORM_MODES.ADD === "add" ? ProjectStatus.ACTIVE : undefined,
      }; // Default for new project
    }
    // For EDIT or VIEW mode, wait until existingProjectData is successfully fetched
    if (
      (formMode === FORM_MODES.EDIT || formMode === FORM_MODES.VIEW) &&
      isProjectFetchSuccess &&
      existingProjectData
    ) {
      return {
        ...existingProjectData,
        // Ensure client_name is derived correctly.
        // If getProjectById doesn't return client_name, ProjectForm's useEffect will fetch it.
        client_name: existingProjectData.client_snapshot?.name || "",
        // Ensure rates are properly formatted if they come from API as strings
        rates: existingProjectData.rates?.map((r) => ({
          ...r,
          price_per_hour: parseFloat(r.price_per_hour) || "",
        })) || [{ name: "", price_per_hour: "" }],
      };
    }
    // Return a default empty object or initial structure for add mode if data isn't ready for edit/view
    // This ensures the form has some default structure before data loads for edit/view
    return {
      rates: [{ name: "", price_per_hour: "" }],
      status: ProjectStatus.ACTIVE,
    };
  }, [formMode, existingProjectData, isProjectFetchSuccess]); // Depend on formMode and the data itself
  // --- Form Submission Handler ---
  const handleFormSubmit = async (data) => {
    // 'data' is ProjectFormData
    console.log("Form submitted in mode:", formMode, "with data:", data);
    if (formMode === FORM_MODES.EDIT) {
      if (!projectId) return;
      updateProjectMutate({ projectId, projectData: data });
    } else if (formMode === FORM_MODES.ADD) {
      addProjectMutate(data);
    } else {
      // View mode, no submission logic needed here, form is read-only
      console.log("View mode, no submission.");
    }
  };

  // --- Determine Page Title and Submit Button Text ---
  let pageTitle = "Add New Project";
  let submitButtonText = "Create Project";
  if (formMode === FORM_MODES.EDIT) {
    pageTitle = `Edit Project: ${existingProjectData?.name || "Loading..."}`;
    submitButtonText = "Update Project";
  } else if (formMode === FORM_MODES.VIEW) {
    pageTitle = `View Project: ${existingProjectData?.name || "Loading..."}`;
    // No submit button in view mode or it's disabled/hidden
  }

  // --- Loading and Error States for Fetching Existing Project ---
  if (projectId && isLoadingProject) {
    return <div className="text-center p-10">Loading project data...</div>;
  }
  if (projectId && isProjectError) {
    return (
      <div className="m-4 p-4 text-red-700 bg-red-100 rounded dark:bg-red-900/30 dark:text-red-300">
        Error loading project: {projectError?.message || "Unknown error"}
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
    projectId &&
    !isLoadingProject &&
    !existingProjectData &&
    formMode !== FORM_MODES.ADD
  ) {
    // If we expected data (edit/view) but didn't get it after loading
    return (
      <div className="m-4 p-4 text-yellow-700 bg-yellow-100 rounded dark:bg-yellow-900/30 dark:text-yellow-300">
        Project with ID '{projectId}' not found.
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
  const isSubmitting = isAdding || isUpdating;
  const mutationError = addError || updateError;

  // Prepare initialData for the form, including potentially fetched client_name
  // Your ProjectForm expects initialData.client_id AND initialData.client_name for the picker
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              navigate(formMode === FORM_MODES.ADD ? "/projects" : `/projects`)
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
        {formMode === FORM_MODES.VIEW && projectId && (
          <button
            onClick={() => navigate(`/projects/${projectId}/edit`)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" /> Edit
          </button>
        )}
        {formMode === FORM_MODES.EDIT && projectId && (
          <button
            onClick={() => navigate(`/projects/${projectId}`)} // Navigate to view mode path
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
          {mutationError?.message || "Failed to save project."}
        </div>
      )}

      {/* Conditionally render ProjectForm only when data is ready for edit/view modes */}
      {(formMode === FORM_MODES.ADD ||
        (formMode !== FORM_MODES.ADD && existingProjectData)) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <ProjectForm
            key={projectId || "add"} // Re-mount form when projectId changes for edit/view
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

export default ProjectFormPage;
