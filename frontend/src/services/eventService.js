// frontend/src/services/invoiceService.js
import apiClient from "../lib/apiClient";

const API_URL = "/events";

// Fetch Invoices (with potential filters later)
export const getEvents = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_key, { filters, page = 1, limit = 20 }] = queryKey; // Example structure
  const params = {
    skip: (page - 1) * limit,
    limit: limit,
    // ... add filter params based on 'filters' object ...
    // status: filters?.status,
    // client_id: filters?.clientId,
  };
  console.log("Fetching events with params:", params);
  const response = await apiClient.get(API_URL, { params });
  // Assuming backend returns array directly, might need pagination info later
  return response.data;
};

export const getEventById = async (eventId) => {
  if (!eventId) throw new Error("event ID is required.");
  console.log("Fetching invoice by ID:", eventId);
  const response = await apiClient.get(`${API_URL}/${eventId}`);
  return response.data;
};
