// frontend/src/components/ui/EntityPicker.jsx
import React, { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Modal } from "./Modal"; // Import modal
import {
  MagnifyingGlassIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";

export const EntityPicker = ({
  label,
  id,
  selectedValue, // The currently selected entity ID (string)
  selectedDisplayValue, // The text to display for the selected entity
  onSelect, // Function called with the selected entity object (e.g., { id: 'uuid', name: 'Client Name' })
  fetchFn, // Async function to fetch entities, receives { searchTerm }
  queryKeyBase, // Base key for react-query cache (e.g., 'clients-picker')
  searchPlaceholder = "Search...",
  modalTitle = "Select Item",
  required = false,
  error, // Error object from react-hook-form
  disabled = false,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce search handler
  const debouncedSetSearchTerm = useMemo(
    () => debounce((term) => setSearchTerm(term), 300),
    [],
  );
  const handleSearchChange = (event) =>
    debouncedSetSearchTerm(event.target.value);

  // Fetch data for the modal using React Query
  // Pass searchTerm to the fetch function via queryKey
  const queryKey = [queryKeyBase, { searchTerm }];
  const {
    data: entities,
    isLoading,
    isError,
    error: fetchError,
  } = useQuery({
    queryKey: queryKey,
    queryFn: () => fetchFn({ searchTerm }),
    enabled: isModalOpen, // Only fetch when modal is open
    staleTime: 1000 * 60, // Cache for 1 minute
  });

  const handleSelectEntity = (entity) => {
    onSelect(entity); // Call the parent's onSelect function
    setIsModalOpen(false); // Close modal
    setSearchTerm(""); // Reset search term
    debouncedSetSearchTerm(""); // Reset debounced search term
  };

  return (
    <div>
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
          {selectedDisplayValue || `Select ${label}...`}
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        size="2xl" // Adjust size as needed
      >
        {/* Search input inside modal */}
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon
              className="h-5 w-5 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
          </div>
          <input
            type="search"
            placeholder={searchPlaceholder}
            onChange={handleSearchChange}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {/* Results List/Table */}
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
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                    Details (e.g., Email/ID)
                  </th>
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
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {entity.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {entity.email || entity.id.substring(0, 8) + "..."}
                    </td>
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

EntityPicker.propTypes = {
  label: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  selectedValue: PropTypes.string, // Store the ID
  selectedDisplayValue: PropTypes.string, // Store the name/label
  onSelect: PropTypes.func.isRequired, // Callback function -> receives selected entity object
  fetchFn: PropTypes.func.isRequired, // Function to fetch data for the modal
  queryKeyBase: PropTypes.string.isRequired, // Base key for React Query
  searchPlaceholder: PropTypes.string,
  modalTitle: PropTypes.string,
  required: PropTypes.bool,
  error: PropTypes.object, // react-hook-form error object
  disabled: PropTypes.bool,
};
