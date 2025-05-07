// frontend/src/components/ui/Checkbox.jsx
import React from "react";
import PropTypes from "prop-types";

export const Checkbox = ({ id, label, register, className = "", ...rest }) => {
  return (
    <div className={`flex items-center ${className}`}>
      <input
        id={id}
        type="checkbox"
        {...(register ? register : {})} // Conditionally spread register if provided
        {...rest}
        className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-offset-0 focus:ring-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 bg-white dark:bg-gray-700 dark:checked:bg-blue-500 dark:checked:border-blue-500"
      />
      {label && ( // Only render label if provided
        <label
          htmlFor={id}
          className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
        >
          {label}
        </label>
      )}
    </div>
  );
};

Checkbox.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string, // Label is now optional
  register: PropTypes.object, // Optional: only needed if using RHF validation on checkbox itself
  className: PropTypes.string,
};
