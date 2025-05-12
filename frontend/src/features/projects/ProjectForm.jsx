// frontend/src/features/projects/ProjectForm.jsx
import React, { useState, useEffect, useMemo } from "react"; // Added useMemo
import PropTypes from "prop-types";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema } from "./projectSchema";
import { EntityPicker } from "../../components/ui/EntityPicker";
import { TextareaField } from "../../components/ui/TextareaField";
import { SelectField } from "../../components/ui/SelectField";
import { InputField } from "../../components/ui/InputField";
import { getClients } from "../../services/clientService";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

import { getClientById } from "../../services/clientService";
// Define possible project statuses (match schema)
const ProjectStatus = {
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};

const ProjectForm = ({
  onSubmit,
  initialData = {},
  isLoading = false,
  submitButtonText = "Save Project",
  isReadOnly = false, // New prop
  mode = "add", // New prop: 'add', 'edit', 'view'
}) => {
  const [selectedClientId, setSelectedClientId] = useState(
    initialData?.client_id || "",
  );
  const [selectedClientName, setSelectedClientName] = useState(
    initialData?.client_name || "",
  );
  console.log(
    "ProjectForm RENDERED. selectedClientName:",
    selectedClientName,
    "selectedClientId:",
    selectedClientId,
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: useMemo(
      () => ({
        // Use useMemo for defaultValues if initialData can change
        client_id: initialData?.client_id || "",
        name: initialData?.name || "",
        description: initialData?.description || "",
        status: initialData?.status || ProjectStatus.ACTIVE,
        rates:
          initialData?.rates && initialData.rates.length > 0
            ? initialData.rates.map((r) => ({
                ...r,
                price_per_hour: parseFloat(r.price_per_hour) || "",
              })) // Ensure numbers
            : [{ name: "", price_per_hour: "" }],
      }),
      [initialData],
    ), // Recalculate defaultValues if initialData changes
  });

  // --- Fetch Client Name for display in Edit/View Mode when initialData is set ---
  // OR WHEN MODE CHANGES
  const initialClientForPicker = initialData?.client_id;
  useEffect(() => {
    if ((mode === "edit" || mode === "view") && initialClientForPicker) {
      if (initialData.client_name) {
        setSelectedClientName(initialData.client_name);
      } else {
        console.log(
          "ProjectForm: (Edit/View) Attempting to fetch client name for ID:",
          initialClientForPicker,
        );
        getClientById(initialClientForPicker)
          .then((client) => {
            if (client) setSelectedClientName(client.name);
          })
          .catch((err) =>
            console.error("Failed to fetch client name for form:", err),
          );
      }
      // No need to setSelectedClientId here as it's derived from initialData
    }
  }, [mode, initialClientForPicker, initialData?.client_name]); // Removed selectedClientId from here

  // Effect for resetting form based on initialData or mode change
  useEffect(() => {
    console.log(
      "ProjectForm: useEffect for main form reset triggered. Mode:",
      mode,
      "InitialData ID:",
      initialData?.client_id,
    );

    if (mode === "edit" || mode === "view") {
      if (initialData && Object.keys(initialData).length > 0) {
        // Ensure initialData is not empty
        console.log(
          "ProjectForm: Resetting form for edit/view mode with initialData.",
        );
        reset({
          client_id: initialData.client_id || "",
          name: initialData.name || "",
          description: initialData.description || "",
          status: initialData.status || ProjectStatus.ACTIVE,
          rates:
            initialData.rates && initialData.rates.length > 0
              ? initialData.rates.map((r) => ({
                  ...r,
                  price_per_hour: parseFloat(r.price_per_hour) || "",
                }))
              : [{ name: "", price_per_hour: "" }],
          // ... other fields from initialData
        });
        // Set the selected client from initialData
        setSelectedClientId(initialData.client_id || "");
        // selectedClientName is handled by the other useEffect
      } else if (
        initialData === null ||
        Object.keys(initialData).length === 0
      ) {
        // Handle case where initialData might be loading or not found yet for edit/view
        console.log(
          "ProjectForm: (Edit/View) initialData is null/empty, not resetting form fields yet.",
        );
      }
    } else if (mode === "add") {
      console.log(
        "ProjectForm: Resetting form for add mode (initial setup or explicit add).",
      );
      // Only reset to blank for 'add' mode if initialData is also truly for 'add' (e.g. empty)
      // This prevents wiping selected client if mode is 'add' but user just picked one.
      // This reset is mostly for the very first render in 'add' mode or if navigating to 'add' explicitly.
      if (!initialData || Object.keys(initialData).length === 0) {
        reset({
          client_id: "",
          name: "",
          description: "",
          status: ProjectStatus.ACTIVE,
          rates: [{ name: "", price_per_hour: "" }],
        });
        setSelectedClientId("");
        setSelectedClientName("");
      }
    }
    // Key dependencies: initialData and mode.
    // 'reset' is a stable function from useForm.
  }, [initialData, mode, reset]);

  const {
    fields: rateFields,
    append: appendRate,
    remove: removeRate,
  } = useFieldArray({
    control,
    name: "rates",
  });

  const handleClientSelect = (client) => {
    console.log("Client selected:", client);
    if (client && client._id) {
      setSelectedClientId(client._id);
      setSelectedClientName(client.name);

      console.log("ID in Object is: " + client._id);
      console.log("ID in State is: " + selectedClientId);
      console.log("Name in Object is: " + client.name);
      console.log("Name  in State is: " + selectedClientName);
      // IMPORTANT: Manually set the value in react-hook-form
      setValue("client_id", client._id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      console.log("Client is empty");
      // Handle clear selection if needed
      setSelectedClientId("");
      setSelectedClientName("");
      setValue("client_id", "", { shouldValidate: true, shouldDirty: true });
    }
  };
  const fetchClientsForPicker = async ({ searchTerm }) => {
    // Use the existing getClients service, maybe adjust limit for picker
    return getClients({ queryKey: ["clients", { searchTerm, limit: 20 }] }); // Fetch ~20 for picker
  };

  const handleFormSubmitInternal = (data) => {
    const processedData = {
      ...data,
      rates:
        data.rates?.map((rate) => ({
          ...rate,
          price_per_hour: parseFloat(rate.price_per_hour) || 0, // Ensure it's a number
        })) || [],
    };
    console.log("Project Form submitting processed data:", processedData);
    onSubmit(processedData);
  }; // Renamed to avoid prop name clash

  return (
    // Pass readOnly to disable fields
    <form
      onSubmit={handleSubmit(handleFormSubmitInternal)}
      className="space-y-6"
    >
      <InputField
        label="Project Name"
        id="name"
        register={register("name")}
        error={errors.name}
        required
        disabled={isReadOnly} // Disable if read-only
      />
      <Controller
        name="client_id"
        control={control}
        render={({ field }) => (
          <EntityPicker
            label="Client"
            id="client_id_picker"
            selectedValue={selectedClientId}
            selectedDisplayValue={selectedClientName}
            onSelect={handleClientSelect}
            fetchFn={fetchClientsForPicker}
            queryKeyBase="clients-picker"
            columns={[
              { header: "Client Name", accessor: "name" },
            ]} /* simplified */
            modalTitle="Select Client"
            searchPlaceholder="Search clients..."
            required
            error={errors.client_id}
            disabled={isReadOnly} // Disable if read-only
          />
        )}
      />
      <SelectField
        label="Status"
        id="status"
        register={register("status")}
        error={errors.status}
        required
        disabled={isReadOnly}
      >
        {Object.entries(ProjectStatus).map(([key, value]) => (
          <option key={value} value={value} className="capitalize">
            {value.replace("_", " ")}
          </option>
        ))}
      </SelectField>
      <TextareaField
        label="Description"
        id="description"
        register={register("description")}
        error={errors.description}
        rows={3}
        disabled={isReadOnly}
      />

      {/* Rates Section */}
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-2 mb-0 col-span-full">
        Rates
      </h3>
      <div className="space-y-4">
        {rateFields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start border dark:border-gray-700 p-4 rounded-md"
          >
            <InputField
              label={`Rate #${index + 1} Name`}
              id={`rates.${index}.name`}
              register={register(`rates.${index}.name`)}
              error={errors.rates?.[index]?.name}
              required
              placeholder="e.g., Development"
              className="md:col-span-3"
              disabled={isReadOnly}
            />
            <InputField
              label="Price/Hour (€)"
              id={`rates.${index}.price_per_hour`}
              register={register(`rates.${index}.price_per_hour`, {
                valueAsNumber: true,
              })}
              error={errors.rates?.[index]?.price_per_hour}
              required
              type="number"
              step="0.01"
              placeholder="e.g., 80.00"
              className="md:col-span-3"
              disabled={isReadOnly}
            />

            <div className="flex items-end justify-end md:col-span-1 h-full">
              {!isReadOnly &&
                rateFields.length > 1 && ( // Only show remove if not read-only
                  <button
                    type="button"
                    className="p-2 mt-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                    onClick={() => removeRate(index)}
                    disabled={isLoading || isReadOnly} /* ... */
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
      {!isReadOnly && ( // Only show Add Rate button if not read-only
        <button
          type="button"
          onClick={() => appendRate({ name: "", price_per_hour: "" })}
          disabled={isLoading || isReadOnly}
          className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-4 w-4 mr-1" /> Add Rate
        </button>
      )}

      {/* Submit Button - Only show if not in view mode */}
      {mode !== "view" && (
        <div className="flex justify-end pt-4 border-t dark:border-gray-700 mt-8">
          <button type="submit" disabled={isLoading || isReadOnly} /* ... */>
            {isLoading ? "Saving..." : submitButtonText}
          </button>
        </div>
      )}
    </form>
  );
};

ProjectForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  isLoading: PropTypes.bool,
  submitButtonText: PropTypes.string,
  isReadOnly: PropTypes.bool, // New prop
  mode: PropTypes.oneOf(["add", "edit", "view"]), // New prop
};

export default ProjectForm;
