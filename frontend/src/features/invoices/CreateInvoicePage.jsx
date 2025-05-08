// frontend/src/features/invoices/CreateInvoicePage.jsx
import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClients } from "../../services/clientService";
import { getProjects } from "../../services/projectService";
import { getTimeEntries } from "../../services/timeEntryService"; // Needs to exist!
import { createInvoice } from "../../services/invoiceService";
import { EntityPicker } from "../../components/ui/EntityPicker";
import { InputField } from "../../components/ui/InputField"; // For optional overrides
import { TextareaField } from "../../components/ui/TextareaField"; // For notes
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Checkbox } from "../../components/ui/Checkbox"; // Assuming you create Checkbox.jsx

// --- Helper Components --- (Define here or import from ui)
const CheckboxLocal = ({ id, label, register, ...rest }) => (
  <div className="flex items-center">
    <input
      id={id}
      type="checkbox"
      {...register}
      {...rest}
      className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:checked:bg-blue-500"
    />
    <label
      htmlFor={id}
      className="ml-2 block text-sm text-gray-900 dark:text-gray-300"
    >
      {label}
    </label>
  </div>
);

const formatDate = (dateString) => {
  /* ... as in InvoiceList ... */
};
const formatCurrency = (amount) => {
  /* ... as in InvoiceList ... */
};

function CreateInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- State ---
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(""); // Allow selecting ONE project for simplicity first
  // const [selectedProjectIds, setSelectedProjectIds] = useState([]); // For multi-project selection later
  const [selectedTimeEntryIds, setSelectedTimeEntryIds] = useState(new Set()); // Use a Set for efficient add/remove/check
  const [dueDateDays, setDueDateDays] = useState(14);
  const [taxRate, setTaxRate] = useState(19.0);
  const [notes, setNotes] = useState("");

  // --- Pickers Config ---
  const clientPickerColumns = [
    { header: "Client Name", accessor: "name" } /* ... */,
  ];
  const projectPickerColumns = [
    { header: "Project Name", accessor: "name" } /* ... */,
  ];
  const fetchClientsForPicker = async ({ searchTerm }) =>
    getClients({ queryKey: ["clients", { searchTerm, limit: 20 }] });
  // Fetch only projects for the selected client
  const fetchProjectsForPicker = async ({ searchTerm }) => {
    if (!selectedClientId) return []; // Don't fetch if no client selected
    return getProjects({ searchTerm, limit: 20, clientId: selectedClientId });
  };

  // --- Fetch Uninvoiced Time Entries ---
  const {
    data: timeEntries = [],
    isLoading: isLoadingTimeEntries,
    isError: isErrorTimeEntries,
    error: timeEntryError,
  } = useQuery({
    // Query key depends on selected client and project
    queryKey: [
      "timeEntries",
      {
        clientId: selectedClientId,
        projectId: selectedProjectId,
        isInvoiced: false,
      },
    ],
    queryFn: () =>
      getTimeEntries({
        clientId: selectedClientId,
        projectId: selectedProjectId,
        isInvoiced: false,
      }),
    enabled: !!selectedClientId && !!selectedProjectId, // Only fetch when both client and project are selected
    staleTime: 1000 * 30, // Refetch relatively often during creation process
  });

  // --- Handlers ---
  const handleClientSelect = useCallback((client) => {
    const newClientId = client?._id || "";
    setSelectedClientId(newClientId);
    setSelectedClientName(client?.name || "");
    setSelectedProjectId(""); // Reset project when client changes
    // setSelectedProjectIds([]);
    setSelectedTimeEntryIds(new Set()); // Clear selected entries
  }, []);

  const handleProjectSelect = useCallback((project) => {
    const newProjectId = project?._id || "";
    setSelectedProjectId(newProjectId);
    // setSelectedProjectIds(project ? [project.id] : []); // For multi-select later
    setSelectedTimeEntryIds(new Set()); // Clear selected entries
  }, []);

  const handleTimeEntrySelect = (entryId, isSelected) => {
    setSelectedTimeEntryIds((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(entryId);
      } else {
        newSet.delete(entryId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      setSelectedTimeEntryIds(new Set(timeEntries.map((t) => t.id)));
    } else {
      setSelectedTimeEntryIds(new Set());
    }
  };

  // --- Calculations ---
  const { totalSelectedAmount, totalSelectedHours } = useMemo(() => {
    let hours = 0;
    let amount = 0;
    if (timeEntries && selectedTimeEntryIds.size > 0) {
      timeEntries.forEach((entry) => {
        if (selectedTimeEntryIds.has(entry.id)) {
          hours += entry.duration || 0;
          amount += entry.amount || 0; // Use pre-calculated amount from time entry
        }
      });
    }
    return { totalSelectedHours: hours, totalSelectedAmount: amount };
  }, [timeEntries, selectedTimeEntryIds]);

  // --- Create Invoice Mutation ---
  const {
    mutate: createInvoiceMutate,
    isLoading,
    error: createError,
  } = useMutation({
    mutationFn: createInvoice,
    onSuccess: (newInvoice) => {
      console.log("Invoice Created:", newInvoice);
      queryClient.invalidateQueries({ queryKey: ["invoices"] }); // Refetch invoice list
      queryClient.invalidateQueries({ queryKey: ["timeEntries"] }); // Refetch time entries (as they are now invoiced)
      alert(`Invoice ${newInvoice.invoice_number} created successfully!`); // Replace with toast
      navigate("/invoices"); // Go to invoice list
    },
    onError: (err) => {
      console.error("Invoice creation error:", err);
      // Error shown below form
    },
  });

  const handleCreateInvoice = () => {
    if (
      !selectedClientId ||
      !selectedProjectId ||
      selectedTimeEntryIds.size === 0
    ) {
      alert("Please select a client, project, and at least one time entry.");
      return;
    }
    const requestData = {
      client_id: selectedClientId,
      project_ids: [selectedProjectId], // Send array even for one project
      time_entry_ids: Array.from(selectedTimeEntryIds), // Convert Set to Array
      due_date_days: parseInt(dueDateDays, 10) || 14,
      tax_rate: parseFloat(taxRate) || 19.0,
      notes: notes || null,
      // Let backend calculate service dates for now
    };
    console.log("Submitting invoice request:", requestData);
    createInvoiceMutate(requestData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 ...">
          <ArrowLeftIcon className="h-6 w-6" />
        </button>
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Create New Invoice
        </h1>
      </div>

      {/* Error Display */}
      {createError && (
        <div
          className="p-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-900/30 dark:text-red-300"
          role="alert"
        >
          <span className="font-medium">Error:</span>{" "}
          {createError?.message || "Failed to create invoice."}
        </div>
      )}

      {/* Step 1: Select Client & Project */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-medium border-b dark:border-gray-700 pb-2">
          1. Select Client & Project
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EntityPicker
            label="Client *"
            id="client_id_picker"
            selectedValue={selectedClientId}
            selectedDisplayValue={selectedClientName}
            onSelect={handleClientSelect}
            fetchFn={fetchClientsForPicker}
            queryKeyBase="clients-picker-invoice"
            columns={clientPickerColumns}
            modalTitle="Select Client"
            searchPlaceholder="Search clients..."
            required // Visually indicate required, actual validation on submit
          />
          <EntityPicker
            label="Project *"
            id="project_id_picker"
            selectedValue={selectedProjectId}
            // Need to fetch/display project name if loading initial data
            selectedDisplayValue={
              selectedProjectId ? timeEntries?.[0]?.project_info?.name : ""
            }
            onSelect={handleProjectSelect}
            fetchFn={fetchProjectsForPicker}
            queryKeyBase={`projects-picker-invoice-${selectedClientId}`} // Key changes when client changes
            columns={projectPickerColumns}
            modalTitle="Select Project"
            searchPlaceholder="Search projects..."
            required
            disabled={!selectedClientId} // Disable until client is selected
          />
        </div>
      </div>

      {/* Step 2: Select Time Entries */}
      <div
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4 ${!selectedClientId || !selectedProjectId ? "opacity-50 pointer-events-none" : ""}`}
      >
        <h2 className="text-lg font-medium border-b dark:border-gray-700 pb-2">
          2. Select Billable Time Entries
        </h2>
        {isLoadingTimeEntries && (
          <p className="text-center py-4">Loading time entries...</p>
        )}
        {isErrorTimeEntries && (
          <p className="text-center py-4 text-red-500">
            Error loading time entries: {timeEntryError?.message}
          </p>
        )}
        {!isLoadingTimeEntries &&
          !isErrorTimeEntries &&
          timeEntries.length === 0 &&
          selectedClientId &&
          selectedProjectId && (
            <p className="text-center py-4 text-gray-500">
              No uninvoiced time entries found for this project.
            </p>
          )}
        {!isLoadingTimeEntries &&
          !isErrorTimeEntries &&
          timeEntries.length > 0 && (
            <div className="overflow-x-auto border dark:border-gray-600 rounded-md max-h-[50vh]">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 w-10">
                      <Checkbox
                        id="select-all-time"
                        label=""
                        checked={
                          selectedTimeEntryIds.size > 0 &&
                          selectedTimeEntryIds.size === timeEntries.length
                        }
                        onChange={handleSelectAll}
                        aria-label="Select all time entries"
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-2 text-left font-medium uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-2 text-right font-medium uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-4 py-2 text-right font-medium uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {timeEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td className="px-4 py-2">
                        <Checkbox
                          id={`time-entry-${entry._id}`}
                          label=""
                          checked={selectedTimeEntryIds.has(entry._id)}
                          onChange={(e) =>
                            handleTimeEntrySelect(entry._id, e.target.checked)
                          }
                        />
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-2">{entry.description}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {entry.name}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {entry.timeEntries[0]?.duration?.toFixed(2)} hrs
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {formatCurrency(entry.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        {/* Summary */}
        {timeEntries.length > 0 && (
          <div className="pt-4 text-right font-medium">
            Selected: {selectedTimeEntryIds.size} Entries /{" "}
            {totalSelectedHours.toFixed(2)} hrs /{" "}
            {formatCurrency(totalSelectedAmount)}
          </div>
        )}
      </div>

      {/* Step 3: Invoice Options */}
      <div
        className={`p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4 ${selectedTimeEntryIds.size === 0 ? "opacity-50 pointer-events-none" : ""}`}
      >
        <h2 className="text-lg font-medium border-b dark:border-gray-700 pb-2">
          3. Invoice Options
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputField
            label="Payment Due (Days from Issue Date)"
            id="due_date_days"
            type="number"
            value={dueDateDays}
            onChange={(e) => setDueDateDays(e.target.value)}
            min="0"
            step="1"
            placeholder="e.g., 14"
          />
          <InputField
            label="Tax Rate (%)"
            id="tax_rate"
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            min="0"
            max="100"
            step="0.01"
            placeholder="e.g., 19.0"
          />
        </div>
        <TextareaField
          label="Notes (Optional)"
          id="invoice_notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes to appear on the invoice"
        />
      </div>

      {/* Submit Area */}
      <div className="flex justify-end pt-4 border-t dark:border-gray-700 mt-8">
        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={
            isLoading ||
            selectedTimeEntryIds.size === 0 ||
            !selectedProjectId ||
            !selectedClientId
          }
          className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Generating..." : "Generate Invoice"}
        </button>
      </div>
    </div> // End outer container
  );
}

export default CreateInvoicePage;
