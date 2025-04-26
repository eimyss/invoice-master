// frontend/src/features/projects/ProjectForm.jsx
import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema } from "./projectSchema";
// Reusable Components
// API Service (for client picker)
import { getClients } from "../../services/clientService"; // Fetch clients for picker
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { EntityPicker } from "../../components/ui/EntityPicker";
import { InputField } from "../../components/ui/InputField";
import { TextareaField } from "../../components/ui/TextareaField";
import { SelectField } from "../../components/ui/SelectField";

// Define possible project statuses (match schema)
const ProjectStatus = {
  ACTIVE: "active",
  ON_HOLD: "on_hold",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};

const ProjectForm = ({
  onSubmit,
  initialData = {}, // Expects initialData.client_id and initialData.client_name if editing
  isLoading = false,
  submitButtonText = "Save Project",
}) => {
  // --- State for Client Picker ---
  // Store both ID and Name separately for display vs. form value
  const [selectedClientId, setSelectedClientId] = useState(
    initialData?.client_id || "",
  );
  const [selectedClientName, setSelectedClientName] = useState(
    initialData?.client_name || "",
  ); // Need initial client name for display on edit

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      ...initialData,
      client_id: initialData?.client_id || "", // Ensure client_id is initialized for zod
      status: initialData?.status || ProjectStatus.ACTIVE, // Default status
      rates:
        initialData?.rates && initialData.rates.length > 0
          ? initialData.rates
          : [{ name: "", price_per_hour: "" }], // Default with one empty rate row
    },
  });

  // --- Field Array for Rates ---
  const {
    fields: rateFields,
    append: appendRate,
    remove: removeRate,
  } = useFieldArray({
    control,
    name: "rates",
  });

  // --- Client Picker Handler ---
  const handleClientSelect = (client) => {
    console.log("Client selected:", client);
    if (client && client._id) {
      setSelectedClientId(client._id);
      setSelectedClientName(client.name);
      // IMPORTANT: Manually set the value in react-hook-form
      setValue("client_id", client._id, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      // Handle clear selection if needed
      setSelectedClientId("");
      setSelectedClientName("");
      setValue("client_id", "", { shouldValidate: true, shouldDirty: true });
    }
  };

  // Fetch function specific for the client picker
  const fetchClientsForPicker = async ({ searchTerm }) => {
    // Use the existing getClients service, maybe adjust limit for picker
    return getClients({ queryKey: ["clients", { searchTerm, limit: 20 }] }); // Fetch ~20 for picker
  };

  // --- Form Submit Handler ---
  const handleFormSubmit = (data) => {
    // Convert rate prices back to numbers before submitting if they became strings
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
  };

  // Log errors for debugging
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log("Project Form Errors:", errors);
    }
  }, [errors]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* --- Basic Info --- */}
      <InputField
        label="Project Name"
        id="name"
        register={register("name")}
        error={errors.name}
        required
        className="col-span-full" // Example of using className prop
      />

      {/* --- Client Picker --- */}
      <Controller
        name="client_id" // Name must match the schema field
        control={control}
        render={(
          { field }, // field contains value, onChange etc. but we manage value via state/setValue
        ) => (
          <EntityPicker
            label="Client"
            id="client_id_picker"
            selectedValue={selectedClientId} // Controlled by state
            selectedDisplayValue={selectedClientName} // Controlled by state
            onSelect={handleClientSelect} // Our handler updates state & form value
            fetchFn={fetchClientsForPicker}
            queryKeyBase="clients-picker" // Unique key for this picker instance
            modalTitle="Select Client"
            searchPlaceholder="Search clients by name..."
            required
            error={errors.client_id} // Display validation error for client_id
          />
        )}
      />

      <SelectField
        label="Status"
        id="status"
        register={register("status")}
        error={errors.status}
        required
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
        className="col-span-full"
      />

      {/* --- Rates Section --- */}
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-2 mb-0 col-span-full">
        Rates
      </h3>
      <div className="space-y-4">
        {rateFields.map((field, index) => (
          <div
            key={field.id}
            className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start border dark:border-gray-700 p-4 rounded-md"
          >
            {/* Rate Name */}
            <InputField
              label={`Rate #${index + 1} Name`}
              id={`rates.${index}.name`}
              // Use field array registration
              register={register(`rates.${index}.name`)}
              error={errors.rates?.[index]?.name}
              required
              placeholder="e.g., Development"
              className="md:col-span-3" // Adjust grid span
            />
            {/* Rate Price */}
            <InputField
              label="Price/Hour (€)"
              id={`rates.${index}.price_per_hour`}
              // Use field array registration
              register={register(`rates.${index}.price_per_hour`, {
                valueAsNumber: true,
              })} // Attempt to register as number
              error={errors.rates?.[index]?.price_per_hour}
              required
              type="number" // Use number input
              step="0.01" // Allow decimals
              placeholder="e.g., 80.00"
              className="md:col-span-3" // Adjust grid span
            />
            {/* Remove Button */}
            <div className="flex items-end justify-end md:col-span-1 h-full">
              {rateFields.length > 1 && ( // Only show remove if more than one rate
                <button
                  type="button"
                  onClick={() => removeRate(index)}
                  className="p-2 mt-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                  disabled={isLoading}
                  aria-label="Remove rate"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
            {/* Display array-level errors if any */}
            {errors.rates?.[index] &&
              !errors.rates?.[index]?.name &&
              !errors.rates?.[index]?.price_per_hour && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 md:col-span-full">
                  Error in this rate entry.
                </p>
              )}
          </div>
        ))}
        {/* Display root error for rates array (e.g., min length) */}
        {errors.rates && !Array.isArray(errors.rates) && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {errors.rates.message}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => appendRate({ name: "", price_per_hour: "" })} // Add new empty rate
        disabled={isLoading}
        className="flex items-center px-3 py-1.5 border border-dashed border-gray-400 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <PlusIcon className="h-4 w-4 mr-1" /> Add Rate
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

ProjectForm.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  isLoading: PropTypes.bool,
  submitButtonText: PropTypes.string,
};

export default ProjectForm;
