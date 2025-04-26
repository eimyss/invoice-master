// frontend/src/components/ui/SelectField.jsx
import React from "react";
import PropTypes from "prop-types";

export const SelectField = ({
  label,
  id,
  register,
  error,
  required,
  children,
  className = "",
  ...rest
}) => (
  <div className={className}>
    <label
      htmlFor={id}
      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      id={id}
      {...register}
      {...rest}
      className={`block w-full px-3 py-2 border ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600"} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed appearance-none`} // Added appearance-none for custom arrow styling later if needed
      aria-invalid={error ? "true" : "false"}
    >
      {children} {/* Options are passed as children */}
    </select>
    {error && (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
        {error.message}
      </p>
    )}
  </div>
);

SelectField.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  register: PropTypes.object.isRequired,
  error: PropTypes.object,
  required: PropTypes.bool,
  children: PropTypes.node.isRequired, // Options
  className: PropTypes.string,
};
