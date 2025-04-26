// frontend/src/services/clientService.js
import apiClient from "../lib/apiClient"; // Your configured axios instance

const API_URL = "/clients"; // Base URL for client endpoints

// Fetch Clients (with search/pagination)
export const getClients = async ({ queryKey }) => {
  // eslint-disable-next-line no-unused-vars
  const [_key, { searchTerm, page, limit }] = queryKey; // Example: Use queryKey for params
  console.log("Fetching clients with params:", { searchTerm, page, limit });
  const response = await apiClient.get(API_URL, {
    params: {
      search: searchTerm || "",
      skip: page ? (page - 1) * (limit || 10) : 0, // Calculate skip based on page/limit
      limit: limit || 10,
    },
  });
  return response.data; // Assuming backend returns the array directly
};

// Fetch Single Client by ID
export const getClientById = async (clientId) => {
  if (!clientId) throw new Error("Client ID is required.");
  console.log("Fetching client by ID:", clientId);
  const response = await apiClient.get(`${API_URL}/${clientId}`);
  return response.data;
};

// Create New Client
export const createClient = async (clientData) => {
  console.log("Creating client:", clientData);
  const response = await apiClient.post(API_URL, clientData);
  return response.data;
};

// Update Client
export const updateClient = async ({ clientId, clientData }) => {
  if (!clientId) throw new Error("Client ID is required for update.");
  console.log("Updating client:", clientId, clientData);
  const response = await apiClient.put(`${API_URL}/${clientId}`, clientData);
  return response.data;
};

// Delete Client
export const deleteClient = async (clientId) => {
  if (!clientId) throw new Error("Client ID is required for delete.");
  console.log("Deleting client:", clientId);
  // Delete requests often don't have a response body or return 204
  await apiClient.delete(`${API_URL}/${clientId}`);
  return clientId; // Return ID for cache invalidation purposes
};
