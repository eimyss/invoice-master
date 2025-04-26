// frontend/src/features/clients/ClientForm.jsx
import React from "react";
import PropTypes from "prop-types"; // Import PropTypes
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema } from "./clientSchema"; // Keep zod schema import for resolver
// Assuming these are standard JS/JSX components now
import { InputField, TextareaField } from "../../components/ui/FormFields";

// --- No TypeScript Interface ---

// Standard JavaScript Functional Component
// Destructure props directly with default values
const ClientForm = ({
  onSubmit,
  initialData = {},
  isLoading = false,
  submitButtonText = "Save Client",
}) => {
  // Remove generic type from useForm
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(clientSchema), // Still use Zod resolver
    defaultValues: initialData,
  });

  // Remove type annotation from 'data'
  const handleFormSubmit = (data) => {
    console.log("Form submitting with data:", data);
    onSubmit(data);
  };

  return (
    // --- JSX remains the same ---
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* --- Basic Info --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField
          label="Client Name"
          id="name"
          register={register("name")}
          error={errors.name}
          required
        />
        <InputField
          label="Email"
          id="email"
          type="email"
          register={register("email")}
          error={errors.email}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField
          label="Contact Person"
          id="contact_person"
          register={register("contact_person")}
          error={errors.contact_person}
        />
        <InputField
          label="Phone"
          id="phone"
          register={register("phone")}
          error={errors.phone}
        />
      </div>
      <InputField
        label="VAT ID (USt-IdNr.)"
        id="vat_id"
        register={register("vat_id")}
        error={errors.vat_id}
      />

      {/* --- Address --- */}
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-2 mb-4">
        Address
      </h3>
      <InputField
        label="Street & No."
        id="address_street"
        register={register("address_street")}
        error={errors.address_street}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <InputField
          label="ZIP Code"
          id="address_zip"
          register={register("address_zip")}
          error={errors.address_zip}
        />
        <InputField
          label="City"
          id="address_city"
          register={register("address_city")}
          error={errors.address_city}
        />
        <InputField
          label="Country"
          id="address_country"
          register={register("address_country")}
          error={errors.address_country}
        />
      </div>

      {/* --- Notes --- */}
      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-600 pb-2 mb-4">
        Notes
      </h3>
      <TextareaField
        label="Notes"
        id="notes"
        register={register("notes")}
        error={errors.notes}
        rows={4}
      />

      {/* --- Submit Button --- */}
      <div className="flex justify-end pt-4">
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

// --- Add PropTypes for runtime type checking (optional but recommended) ---
ClientForm.propTypes = {
  onSubmit: PropTypes.func.isRequired, // Expect a function, mark as required
  initialData: PropTypes.object, // Expect an object, optional
  isLoading: PropTypes.bool, // Expect a boolean, optional
  submitButtonText: PropTypes.string, // Expect a string, optional
};
// -------------------------------------------------------------------------

export default ClientForm;
