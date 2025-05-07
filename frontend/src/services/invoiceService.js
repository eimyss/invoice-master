// frontend/src/services/invoiceService.js
import apiClient from "../lib/apiClient";

const API_URL = "/invoices";

// Fetch Invoices (with potential filters later)
export const getInvoices = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_key, { filters, page = 1, limit = 20 }] = queryKey; // Example structure
  const params = {
    skip: (page - 1) * limit,
    limit: limit,
    // ... add filter params based on 'filters' object ...
    // status: filters?.status,
    // client_id: filters?.clientId,
  };
  console.log("Fetching invoices with params:", params);
  const response = await apiClient.get(API_URL, { params });
  // Assuming backend returns array directly, might need pagination info later
  return response.data;
};

// Create Invoice
export const createInvoice = async (creationRequest) => {
  // creationRequest should match InvoiceCreateRequest model from backend
  // { client_id: UUID, project_ids: List[UUID], time_entry_ids: List[UUID], ...overrides }
  console.log("Creating invoice with request:", creationRequest);
  const response = await apiClient.post(API_URL, creationRequest);
  return response.data; // Returns the newly created InvoiceInDB object
};

// Get Invoice PDF URL (Helper - doesn't fetch, just builds URL)
export const getInvoicePdfUrl = (invoiceId) => {
  if (!invoiceId) return "#";
  // Construct URL relative to API base (adjust if apiClient baseURL isn't setup for this)
  // Assuming apiClient.defaults.baseURL is set like 'http://host:port/api/v1'
  const baseUrl = apiClient.defaults.baseURL.replace("/api/v1", ""); // Get root URL
  return `${baseUrl}${API_URL}/${invoiceId}/pdf`;
};

// Generate Email Preview Content
export const generateInvoiceEmail = async ({ invoiceId, emailRequestData }) => {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  console.log(
    "Generating email preview for invoice:",
    invoiceId,
    emailRequestData,
  );
  // emailRequestData might contain custom subject/template overrides if needed
  const response = await apiClient.post(
    `${API_URL}/${invoiceId}/email-preview`,
    emailRequestData || {},
  );
  return response.data; // Returns { subject, body, recipient }
};

// Get Single Invoice Details (If needed for a detail page later)
export const getInvoiceById = async (invoiceId) => {
  if (!invoiceId) throw new Error("Invoice ID is required.");
  console.log("Fetching invoice by ID:", invoiceId);
  const response = await apiClient.get(`${API_URL}/${invoiceId}`);
  return response.data;
};

// TODO: Add updateInvoice function (e.g., for changing status)
// export const updateInvoiceStatus = async ({ invoiceId, status }) => { ... }
