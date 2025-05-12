// frontend/src/features/invoices/InvoiceListPage.jsx

import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom"; // For linking to detail page later
import { Modal } from "../../components/ui/Modal"; // Your general Modal component
import { getInvoicePdfBlob } from "../../services/invoiceService"; // Import new service
import { useEntityList } from "../../hooks/useCrudQueries"; // Generic hook
import {
  getInvoices,
  generateInvoiceEmail,
  getInvoicePdfUrl,
} from "../../services/invoiceService";
import { useMutation } from "@tanstack/react-query";
import {
  DocumentArrowDownIcon,
  EnvelopeIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { PrepareEmailModal } from "../../components/ui/PrepareEmailModal"; // Import the modal

import { PdfViewer } from "../../components/ui/PdfViewer"; // Import PdfViewer
// Helper to format date strings
const formatDate = (dateString) => {
  if (!dateString) return "-";
  try {
    // Assuming backend sends ISO date string (YYYY-MM-DD)
    return new Date(dateString).toLocaleDateString("de-DE", {
      // German locale
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (e) {
    return dateString; // Fallback
  }
};

// Helper to format currency
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return "-";
  return amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
};

// --- Invoice Table Component --- (Can be moved to ui)
const InvoiceTable = ({
  invoices,
  onPrepareEmail,
  isLoadingEmail,
  onViewPdf,
}) => {
  if (!invoices || invoices.length === 0) {
    return (
      <p className="text-center text-gray-500 dark:text-gray-400 py-10">
        No invoices found.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Client
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">
              Issue Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
              Due Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                {/* TODO: Link to invoice detail page */}
                <Link to={`/invoices/${invoice.id}`}>
                  {invoice.invoice_number}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-200">
                {invoice.client_snapshot?.name || "N/A"}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                {formatDate(invoice.issue_date)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden md:table-cell">
                {formatDate(invoice.due_date)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-right">
                {formatCurrency(invoice.total_amount)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                {/* TODO: Add badge styling for status */}
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 capitalize">
                  {invoice.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                {/* TODO: Link to Detail View */}
                {/* <Link to={`/invoices/${invoice.id}`} title="View Details" className="p-1 text-gray-400 hover:text-blue-600"><EyeIcon className="h-5 w-5 inline"/></Link> */}
                <button
                  onClick={() => onViewPdf(invoice._id, invoice.invoice_number)} // Call onViewPdf
                  title="View PDF"
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <EyeIcon className="h-5 w-5 inline" />
                </button>
                <button
                  onClick={() =>
                    onPrepareEmail(invoice.id, invoice.client_snapshot?.email)
                  }
                  title="Prepare Email"
                  disabled={isLoadingEmail === invoice.id} // Disable only for the one being loaded
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
                >
                  <EnvelopeIcon className="h-5 w-5 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

function InvoiceListPage() {
  const [filters, setFilters] = useState({}); // State for filters later
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [selectedInvoiceIdForEmail, setSelectedInvoiceIdForEmail] =
    useState(null);
  const [emailContent, setEmailContent] = useState(null);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [pdfFileName, setPdfFileName] = useState("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  // --- Fetch Invoices ---
  const {
    data: invoices,
    isLoading,
    isError,
    error,
  } = useEntityList(
    "invoices", // Query Key Base
    ({ filters }) => getInvoices({ queryKey: ["invoices", { filters }] }), // Pass filters from options
    { filters }, // Options object passed to useQuery
  );

  const handleViewPdf = useCallback(async (invoiceId, invoiceNumber) => {
    if (!invoiceId) {
      console.log("no Invoice ID provided");
      return;
    }
    console.log("Viewing PDF for invoice:", invoiceId);
    setIsLoadingPdf(true);
    setPdfBlob(null); // Clear previous blob
    setIsPdfModalOpen(true); // Open modal immediately to show loading state
    setPdfFileName(
      `Rechnung_${invoiceNumber}_${new Date().toISOString().split("T")[0]}.pdf`,
    );

    try {
      const blob = await getInvoicePdfBlob(invoiceId);
      setPdfBlob(blob);
    } catch (error) {
      console.error("Error fetching PDF blob:", error);
      alert(`Failed to load PDF: ${error.message || "Unknown error"}`);
      setIsPdfModalOpen(false); // Close modal on error
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  const closePdfModal = () => {
    setIsPdfModalOpen(false);
    setPdfBlob(null); // Clean up blob state
  };
  // --- Mutation for Preparing Email ---
  const { mutate: prepareEmailMutate, isLoading: isLoadingEmailPrep } =
    useMutation({
      mutationFn: generateInvoiceEmail, // Expects { invoiceId, emailRequestData }
      onSuccess: (data) => {
        console.log("Email content generated:", data);
        setEmailContent(data); // Store fetched content
        setIsEmailModalOpen(true); // Open the modal
      },
      onError: (err) => {
        console.error("Error preparing email:", err);
        alert(`Failed to prepare email: ${err.message || "Unknown error"}`);
        setSelectedInvoiceIdForEmail(null); // Reset loading state indicator
      },
    });

  const handlePrepareEmail = (invoiceId, recipientEmail) => {
    console.log("Preparing email for invoice:", invoiceId);
    setSelectedInvoiceIdForEmail(invoiceId); // Track which invoice email is loading
    setEmailContent(null); // Clear previous content
    // Pass default/minimal request data, can be customized later
    prepareEmailMutate({
      invoiceId,
      emailRequestData: { recipient_email: recipientEmail },
    });
  };

  const closeEmailModal = () => {
    setIsEmailModalOpen(false);
    setEmailContent(null);
    setSelectedInvoiceIdForEmail(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">
          Invoices
        </h1>
        {/* TODO: Add Filters (Status Dropdown, Client Picker, Date Range) */}
        {/* <div className="flex gap-4"> ... Filters ... </div> */}
        <Link
          to="/invoices/new" // Link to the new invoice creation page
          className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 whitespace-nowrap"
        >
          {/* Using PlusIcon might be confusing here, maybe different icon or just text */}
          Create New Invoice
        </Link>
      </div>

      {/* Loading and Error States */}
      {isLoading && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Loading invoices...
        </p>
      )}
      {isError && (
        <div className="text-center text-red-600 ...">
          Error: {error?.message || "Failed to load invoices"}
        </div>
      )}

      {/* Invoice Table */}
      {!isLoading && !isError && (
        <InvoiceTable
          invoices={invoices}
          onPrepareEmail={handlePrepareEmail}
          // Pass the ID being loaded so only that button's icon shows loading state
          isLoadingEmail={selectedInvoiceIdForEmail}
          onViewPdf={handleViewPdf} // Pass new handler
        />
      )}

      {/* Pagination TODO */}

      {/* Email Preview Modal */}
      <PrepareEmailModal
        isOpen={isEmailModalOpen}
        onClose={closeEmailModal}
        emailContent={emailContent}
        isLoading={isLoadingEmailPrep && !emailContent} // Show loading only while mutate runs and no content yet
      />
      <Modal
        isOpen={isPdfModalOpen}
        onClose={closePdfModal}
        title={`Viewing PDF: ${pdfFileName}`}
        size="4xl" // Use a larger size for PDFs
      >
        {isLoadingPdf && <div className="p-10 text-center">Loading PDF...</div>}
        {!isLoadingPdf && pdfBlob && (
          <div className="h-[80vh] w-full">
            {" "}
            {/* Set height for the viewer */}
            <PdfViewer blob={pdfBlob} fileName={pdfFileName} />
          </div>
        )}
        {!isLoadingPdf && !pdfBlob && !isPdfModalOpen && (
          /* Only if error occurred and modal closed */ <div className="p-10 text-center text-red-500">
            Failed to load PDF.
          </div>
        )}
      </Modal>
    </div>
  );
}

export default InvoiceListPage;
