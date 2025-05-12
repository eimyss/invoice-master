// frontend/src/components/ui/EntityPicker.jsx
import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Modal } from "./Modal";
import {
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";

// --- Helper function to safely get nested values ---
// Used by columns definition
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  const pathArray = path.split(".");
  return pathArray.reduce(
    (current, key) =>
      current && current[key] !== undefined ? current[key] : undefined,
    obj,
  );
};
// --------------------------------------------------

export const EntityPicker = ({
  label,
  id,
  selectedValue,
  selectedDisplayValue,
  onSelect,
  fetchFn,
  queryKeyBase,
  // *** NEW: columns prop ***
  columns, // Array of { header: string, accessor: string | function, options?: { className?: string, hiddenSm?: boolean, hiddenMd?: boolean } }
  // *** ----------------- ***
  searchPlaceholder = "Search...",
  modalTitle = "Select Item",
  required = false,
  error,
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  console.log(
    "EntityPicker RENDERED. selectedDisplayValue:",
    selectedDisplayValue,
  );
  const debouncedSetSearchTerm = useMemo(
    () => debounce((term) => setSearchTerm(term), 300),
    [],
  );
  const handleSearchChange = (event) =>
    debouncedSetSearchTerm(event.target.value);

  const queryKey = [queryKeyBase, { searchTerm }];
  const {
    data: entities,
    isLoading,
    isError,
    error: fetchError,
  } = useQuery({
    queryKey: queryKey,
    queryFn: () => fetchFn({ searchTerm }),
    enabled: isModalOpen,
    staleTime: 1000 * 60,
  });

  const handleSelectEntity = (entity) => {
    onSelect(entity);
    setIsModalOpen(false);
    setSearchTerm("");
    debouncedSetSearchTerm("");
  };

  // --- Default Columns if not provided ---
  const defaultColumns = [
    { header: "Name", accessor: "name" }, // Assume a 'name' field exists
    {
      header: "ID",
      accessor: "id",
      options: { className: "hidden sm:table-cell", truncate: 8 },
    }, // Show part of ID on larger screens
  ];
  const displayColumns =
    columns && columns.length > 0 ? columns : defaultColumns;
  // ----------------------------------------

  return (
    <div>
      {/* --- Button remains the same --- */}
      <label
        htmlFor={`${id}-button`}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        id={`${id}-button`}
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className={`relative w-full bg-white dark:bg-gray-700 border ${error ? "border-red-500" : "border-gray-300 dark:border-gray-600"} rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-haspopup="listbox"
        aria-expanded={isModalOpen}
      >
        <span
          className={`block truncate ${selectedValue ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"}`}
        >
          {selectedDisplayValue || `Select ${label}...`}{" "}
          {/* This line uses selectedDisplayValue */}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronUpDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </span>
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}

      {/* --- Modal --- */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        size="4xl" // Often need larger modal for tables
      >
        {/* Search input */}
        <div className="mb-4 relative">
          {/* ... search input jsx ... */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          </div>
          <input
            type="search"
            placeholder={searchPlaceholder}
            onChange={handleSearchChange} // Use the fixed handler
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {/* Results Table - Now uses displayColumns */}
        <div className="max-h-[50vh] overflow-y-auto border dark:border-gray-600 rounded-md">
          {isLoading && (
            <p className="p-4 text-center text-gray-500 dark:text-gray-400">
              Loading...
            </p>
          )}
          {isError && (
            <p className="p-4 text-center text-red-600 dark:text-red-400">
              Error: {fetchError?.message}
            </p>
          )}
          {!isLoading && !isError && (!entities || entities.length === 0) && (
            <p className="p-4 text-center text-gray-500 dark:text-gray-400">
              No results found.
            </p>
          )}
          {!isLoading && !isError && entities && entities.length > 0 && (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  {displayColumns.map((col) => (
                    <th
                      key={col.accessor.toString()} // Use accessor as key
                      scope="col"
                      className={`px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${col.options?.hiddenSm ? "hidden sm:table-cell" : ""} ${col.options?.hiddenMd ? "hidden md:table-cell" : ""} ${col.options?.className || ""}`}
                    >
                      {col.header}
                    </th>
                  ))}
                  <th className="relative px-4 py-2">
                    <span className="sr-only">Select</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {entities.map((entity) => (
                  <tr
                    key={entity._id}
                    className="hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {displayColumns.map((col) => {
                      const value =
                        typeof col.accessor === "function"
                          ? col.accessor(entity) // Call function if it is one
                          : getNestedValue(entity, col.accessor); // Get potentially nested value
                      const displayValue = col.options?.truncate
                        ? String(value ?? "").substring(
                            0,
                            col.options.truncate,
                          ) +
                          (String(value ?? "").length > col.options.truncate
                            ? "..."
                            : "")
                        : value;

                      return (
                        <td
                          key={col.accessor.toString()}
                          className={`px-4 py-2 whitespace-nowrap text-sm ${col.options?.hiddenSm ? "hidden sm:table-cell" : ""} ${col.options?.hiddenMd ? "hidden md:table-cell" : ""} ${col.options?.className || "text-gray-900 dark:text-gray-100"}`}
                          title={value} // Show full value on hover
                        >
                          {displayValue ?? "-"} {/* Handle null/undefined */}
                        </td>
                      );
                    })}
                    {/* ----------------------------- */}
                    <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => handleSelectEntity(entity)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </div>
  );
};

// --- Updated PropTypes ---
EntityPicker.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  selectedValue: PropTypes.string,
  selectedDisplayValue: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  fetchFn: PropTypes.func.isRequired,
  queryKeyBase: PropTypes.string.isRequired,
  // Define shape for columns prop
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      header: PropTypes.string.isRequired, // Column title
      accessor: PropTypes.oneOfType([
        // Key to access data or function
        PropTypes.string,
        PropTypes.func,
      ]).isRequired,
      options: PropTypes.shape({
        // Optional display settings
        className: PropTypes.string, // Custom class for <th> and <td>
        hiddenSm: PropTypes.bool, // Hide on small screens
        hiddenMd: PropTypes.bool, // Hide on medium screens
        truncate: PropTypes.number, // Max chars to display before '...'
      }),
    }),
  ),
  searchPlaceholder: PropTypes.string,
  modalTitle: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.object,
  disabled: PropTypes.bool,
};
