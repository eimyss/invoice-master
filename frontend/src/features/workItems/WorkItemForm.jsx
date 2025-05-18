// frontend/src/features/workItems/WorkItemForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { workItemSchema } from "./workItemSchema"; // Use the correct schema
import { useQuery } from "@tanstack/react-query"; // Import useQuery

// Services
import { getProjects, getProjectById } from "../../services/projectService";
import { getClientById } from "../../services/clientService"; // To display client name

// UI Components
import { EntityPicker } from "../../components/ui/EntityPicker";
import { InputField } from "../../components/ui/InputField";
import { TextareaField } from "../../components/ui/TextareaField";
import { SelectField } from "../../components/ui/SelectField";
import { DatePickerField } from "../../components/ui/DatePickerField";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const WorkItemForm = ({
  onSubmit,
  initialData = {},
  isLoading = false,
  submitButtonText = "Save Time Entry", // Renamed button text
  formMode,
}) => {
  // --- State ---
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialData?.project_id || "",
  );
  const [selectedProjectName, setSelectedProjectName] = useState(
    initialData?.project_name || "",
  );
  const [selectedClientName, setSelectedClientName] = useState(
    initialData?.client_name || "Loading...",
  ); // Add state for client name

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
  // --- React Hook Form Setup ---
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch, // Watch field values for dynamic calculations
    reset, // To reset form state
  } = useForm({
    resolver: zodResolver(workItemSchema),
    defaultValues: {
      project_id: initialData?.project_id || "",
      status: initialData?.status || WorkItemStatus.CREATED,
      name: initialData?.name || "",
      selectedClientName:
        initialData?.client_name || "No Client in initialData",

      date: initialData?.date ? new Date(initialData.date) : new Date(), // Default to today
      // Rename 'rates' array to 'timeEntries' and set default structure
      timeEntries:
        initialData?.timeEntries?.length > 0
          ? initialData.timeEntries
          : [
              {
                rate_name: "",
                duration: "",
                description: "",
                rate_price_per_hour: null,
              },
            ], // Default first entry
    },
  });

  // --- Field Array for Time Entries ---
  const {
    fields: timeEntryFields, // Renamed from rateFields
    append: appendTimeEntry, // Renamed
    remove: removeTimeEntry, // Renamed
  } = useFieldArray({
    control,
    name: "timeEntries", // Use the correct name matching the schema
  });

  // --- Watch relevant fields ---
  const watchedTimeEntries = watch("timeEntries"); // Watch the entire array
  const watchedProjectId = watch("project_id"); // Watch selected project ID
  // --- Fetch Project Details & Rates when Project ID changes ---
  const {
    data: projectData,
    isLoading: isLoadingProjectData,
    isFetching: isFetchingProjectData, // Add this
    isSuccess: isProjectDataSuccess, // Add this
    isError: isProjectDataError, // Add this
    error: projectDataErrorObject, // Add this
    status: projectDataStatus, // Add this: 'pending', 'error', 'success'
  } = useQuery({
    queryKey: ["project-details", watchedProjectId], // Key depends on watched project ID
    //  queryFn: () => getProjects({ projectId: watchedProjectId }), // Assuming getProjects can fetch by ID, OR use getProjectById
    queryFn: () => getProjectById(watchedProjectId), // <-- Better if you have this service
    enabled: !!watchedProjectId, // Only run when a project ID is selected
    staleTime: 1000 * 60 * 5, // Cache project details for 5 mins
    onSuccess: (data) => {
      // If getProjects returns array, take first item
      const project = Array.isArray(data) ? data[0] : data;
      console.log("Fetched project data for rates:", project);
      // Prefill selected project name if not already set (e.g., on initial load)
      if (!selectedProjectName && project?.name) {
        setSelectedProjectName(project.name);
      }
      // Reset time entries if project changes? Optional, depends on desired UX
      // setValue('timeEntries', [{ rate_name: "", duration: "", description: "", rate_price_per_hour: null }]);
    },
  });
  // Extract rates from fetched project data
  const availableRates = useMemo(() => projectData?.rates || [], [projectData]);

  // --- Fetch Client Name ---
  // Fetch client name based on the fetched project's client_id
  const projectClientId = projectData?.client_id;
  useQuery({
    queryKey: ["client-name", projectClientId],
    queryFn: () => getClientById(projectClientId),
    enabled: !!projectClientId,
    staleTime: Infinity, // Cache client names longer
    onSuccess: (client) => {
      setSelectedClientName(client?.name || "Not Found");
    },
    onError: () => {
      setSelectedClientName("Error Loading");
    },
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

  const fetchProjectsForPicker = async ({ searchTerm }) => {
    return getProjects({ searchTerm, limit: 20 });
  };

  // --- Handlers ---
  const handleProjectSelect = useCallback(
    (project) => {
      console.log("Project selected:", project);
      const newProjectId = project?._id || ""; // Use ID from selected project object
      const newProjectName = project?.name || "";
      const newClientName = project?.client_name || "";

      setSelectedProjectId(newProjectId);
      setSelectedProjectName(newProjectName);
      setSelectedClientName(newClientName); // Reset client name display
      setValue("project_id", newProjectId, {
        shouldValidate: true,
        shouldDirty: true,
      });

      // Reset time entries when project changes to avoid rate mismatches
      reset({
        ...watch(), // Keep existing form values like date
        project_id: newProjectId,
        timeEntries: [
          {
            rate_name: "",
            duration: "",
            description: "",
            rate_price_per_hour: null,
          },
        ],
      });
    },
    [setValue, reset, watch],
  );

  // Handle Rate dropdown change for a specific row
  const handleRateChange = (index, event) => {
    const selectedRateName = event.target.value;
    const selectedRate = availableRates.find(
      (r) => r.name === selectedRateName,
    );
    const price = selectedRate?.price_per_hour || null;

    // Update the specific row in the form state
    setValue(`timeEntries.${index}.rate_name`, selectedRateName, {
      shouldValidate: true,
    });
    setValue(`timeEntries.${index}.rate_price_per_hour`, price, {
      shouldValidate: true,
    });
  };

  // Form Submit
  const handleFormSubmit = (data) => {
    // Add the stored rate_price_per_hour to each entry before submit
    // Ensure duration is a number
    const processedData = {
      ...data,
      timeEntries: data.timeEntries.map((entry, index) => {
        const watchedEntry = watchedTimeEntries[index] || {}; // Get watched values for this row
        return {
          rate_name: entry.rate_name, // From dropdown selection
          // Get potentially updated price from watched state (safer)
          rate_price_per_hour:
            parseFloat(watchedEntry.rate_price_per_hour) || 0,
          duration: parseFloat(entry.duration) || 0, // Ensure duration is number
          description: entry.description,
        };
      }),
    };
    console.log("WorkItem Form submitting processed data:", processedData);
    onSubmit(processedData); // Pass processed data to parent onSubmit
  };

  // Log errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("WorkItem Form Errors:", errors);
    }
  }, [errors]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* --- Project and Client Selection --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Controller
          name="project_id"
          control={control}
          render={(
            { field }, // field is needed by Controller but we manage value via state
          ) => (
            <EntityPicker
              label="Project"
              id="project_id_picker"
              selectedValue={selectedProjectId}
              selectedDisplayValue={selectedProjectName}
              onSelect={handleProjectSelect}
              fetchFn={fetchProjectsForPicker}
              queryKeyBase="projects-picker"
              columns={projectPickerColumns}
              modalTitle="Select Project"
              searchPlaceholder="Search projects..."
              required
              error={errors.project_id}
            />
          )}
        />
        {/* Display selected client name (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Client
          </label>
          <div className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {selectedClientName ||
              (selectedProjectId ? "Loading..." : "(Select Project)")}
          </div>
        </div>
      </div>

      {/* --- Date Picker --- */}
      <DatePickerField
        label="Work Date"
        id="work_date"
        name="date" // Matches schema field name
        control={control}
        error={errors.date}
        dateFormat="yyyy-MM-dd"
        placeholderText="YYYY-MM-DD"
        required
        isClearable={false}
      />

      <InputField
        label="Name"
        id="name"
        register={register("name")}
        error={errors.name}
      />
      <InputField
        label="Status"
        id="status"
        disabled={true}
        register={register("status")}
        error={errors.status}
      />

      {/* --- Time Entries Section --- */}
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-2 mb-0 col-span-full">
        Time Logs
      </h3>
      <div className="space-y-4">
        {timeEntryFields.map((field, index) => {
          // Get watched values for this specific row to calculate amount
          const watchedEntry = watchedTimeEntries?.[index] || {};
          const duration = parseFloat(watchedEntry.duration) || 0;
          let displayAmount;

          const watchedRow = watch(`timeEntries.${index}`); // Watch the specific row object
          const currentDuration = parseFloat(watchedRow?.duration) || 0;
          const currentPricePerHour =
            parseFloat(watchedRow?.rate_price_per_hour) || 0;
          // In 'view' mode, or 'edit' mode *before* user interaction makes fields dirty for this row,
          // prefer the amount from the initial data (which is now part of react-hook-form's state via defaultValues).
          // The `field` object from `useFieldArray` reflects the current RHF state for that item.
          if (
            formMode === FORM_MODES.VIEW ||
            (formMode === FORM_MODES.EDIT &&
              field.calculatedAmount !== undefined &&
              field.calculatedAmount !== null)
          ) {
            // If field.calculatedAmount (from defaultValues/initialData) exists, use it.
            // This assumes 'calculatedAmount' was part of your defaultValues structure.
            displayAmount = (parseFloat(field.calculatedAmount) || 0).toFixed(
              2,
            );
            console.log(
              `Displaying stored amount for index ${index}: ${displayAmount}, field:`,
              field,
            );
          } else {
            // Otherwise (add mode, or edit mode after changes), calculate live
            displayAmount = (currentDuration * currentPricePerHour).toFixed(2);
            console.log(
              `Displaying calculated amount for index ${index}: ${displayAmount}`,
            );
          }

          return (
            <div
              key={field.id} // Unique key for field array item
              className="grid grid-cols-1 md:grid-cols-10 gap-x-4 gap-y-2 items-start border dark:border-gray-700 p-4 rounded-md"
            >
              {/* Rate Selection Dropdown */}
              <SelectField
                label="Rate"
                id={`timeEntries.${index}.rate_name`}
                // Use register for the dropdown value
                register={register(`timeEntries.${index}.rate_name`)}
                // Add specific onChange to update price
                onChange={(e) => handleRateChange(index, e)}
                error={errors.timeEntries?.[index]?.rate_name}
                required
                className="md:col-span-3"
                disabled={
                  !selectedProjectId ||
                  isLoadingProjectData ||
                  availableRates.length === 0
                }
              >
                <option value="">Select Rate...</option>
                {isLoadingProjectData && (
                  <option value="" disabled>
                    Loading Rates...
                  </option>
                )}
                {!isLoadingProjectData &&
                  availableRates.map((rate) => (
                    <option key={rate.name} value={rate.name}>
                      {rate.name} (€{rate.price_per_hour?.toFixed(2)}/hr)
                    </option>
                  ))}
              </SelectField>

              {/* Duration Input */}
              <InputField
                label="Duration (hrs)"
                id={`timeEntries.${index}.duration`}
                register={register(`timeEntries.${index}.duration`, {
                  valueAsNumber: true,
                })}
                error={errors.timeEntries?.[index]?.duration}
                required
                type="number"
                step="0.5"
                placeholder="e.g., 1.5"
                className="md:col-span-2"
              />

              {/* Description Input */}
              <TextareaField
                label="Description"
                id={`timeEntries.${index}.description`}
                register={register(`timeEntries.${index}.description`)}
                error={errors.timeEntries?.[index]?.description}
                required
                rows={1} // Make textarea smaller for row
                placeholder="Work performed..."
                className="md:col-span-3"
              />

              {/* Calculated Amount (Display Only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount (€)
                </label>
                <div className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {displayAmount}
                </div>
                {/* Hidden input to store rate_price_per_hour */}
                <input
                  type="hidden"
                  {...register(`timeEntries.${index}.rate_price_per_hour`)}
                />
              </div>

              {/* Remove Button */}
              <div className="flex items-center justify-center md:col-span-1 pt-5">
                {" "}
                {/* Align button */}
                {timeEntryFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTimeEntry(index)}
                    className="p-1 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                    disabled={isLoading}
                    aria-label="Remove time entry"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              {/* Display item-level errors */}
              {errors.timeEntries?.[index] && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 md:col-span-full">
                  Error in this time entry row.
                </p>
              )}
            </div>
          );
        })}
        {/* Display root error for timeEntries array */}
        {errors.timeEntries &&
          typeof errors.timeEntries === "object" &&
          !Array.isArray(errors.timeEntries) && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {errors.timeEntries.message}
            </p>
          )}
      </div>

      {/* Add Time Entry Button */}
      <button
        type="button"
        // Add new empty entry with default values matching schema
        onClick={() =>
          appendTimeEntry({
            rate_name: "",
            duration: "",
            description: "",
            rate_price_per_hour: null,
          })
        }
        disabled={isLoading || !selectedProjectId} // Disable if no project selected
        className="flex items-center px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PlusIcon className="h-4 w-4 mr-1" /> Add Time Log
      </button>

      {/* --- Submit Button --- */}
      <div className="flex justify-end pt-4 border-t dark:border-gray-700 mt-8">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Saving..." : submitButtonText}
        </button>
      </div>
    </form>
  );
};

WorkItemForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  isLoading: PropTypes.bool,
  submitButtonText: PropTypes.string,
};

export default WorkItemForm;
