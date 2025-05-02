// frontend/src/components/ui/DatePickerField.jsx
import React from "react";
import PropTypes from "prop-types";
import { Controller } from "react-hook-form"; // Import Controller
import DatePicker from "react-datepicker";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

// Import default date-picker styles AND your dark theme overrides
import "react-datepicker/dist/react-datepicker.css";
import "../../datepicker-dark.css"; // Adjust path if needed

export const DatePickerField = ({
  label,
  id, // Use 'id' for consistency, but pass 'name' to Controller
  name, // Name for react-hook-form
  control, // Control object from useForm
  error,
  required,
  placeholderText = "Select date",
  dateFormat = "dd/MM/yyyy", // Example format
  className = "",
  ...rest // Pass other react-datepicker props like minDate, maxDate, etc.
}) => {
  return (
    <div className={className}>
      <label
        htmlFor={id || name}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {/* Use Controller to wrap the DatePicker */}
      <Controller
        name={name}
        control={control}
        render={(
          { field }, // Provides field object: { onChange, onBlur, value, ref }
        ) => (
          <div className="relative">
            <DatePicker
              id={id || name}
              ref={field.ref} // Connect ref
              selected={field.value ? new Date(field.value) : null} // Ensure value is Date object or null
              onChange={(date) => field.onChange(date)} // Update RHF value on change
              onBlur={field.onBlur} // Connect blur handler
              dateFormat={dateFormat}
              placeholderText={placeholderText}
              className={`block w-full pl-10 pr-3 py-2 border ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600"} rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed`}
              autoComplete="off" // Disable browser autofill
              aria-invalid={error ? "true" : "false"}
              {...rest} // Spread other DatePicker props passed in
            />
            {/* Calendar Icon */}
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarDaysIcon
                className="h-5 w-5 text-gray-400 dark:text-gray-500"
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
};

DatePickerField.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string, // Optional, name is used for RHF
  name: PropTypes.string.isRequired, // Required for react-hook-form Controller
  control: PropTypes.object.isRequired, // Required: control object from useForm
  error: PropTypes.object,
  required: PropTypes.bool,
  placeholderText: PropTypes.string,
  dateFormat: PropTypes.string,
  className: PropTypes.string,
  // You can add specific proptypes for common react-datepicker props if desired
  // minDate: PropTypes.instanceOf(Date),
  // maxDate: PropTypes.instanceOf(Date),
};
