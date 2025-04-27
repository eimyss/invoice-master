// frontend/src/services/workItemService.js
import apiClient from "../lib/apiClient";

const API_URL = "/workItems";

// Fetch WorkItems
export const getWorkItems = async ({
  searchTerm = "",
  page = 1,
  limit = 10,
  clientId = null,
}) => {
  console.log("Fetching workItems with params:", {
    searchTerm,
    page,
    limit,
    clientId,
  });
  const response = await apiClient.get(API_URL, {
    params: {
      search: searchTerm,
      skip: (page - 1) * limit,
      limit: limit,
      client_id: clientId, // Pass client_id filter
    },
  });
  return response.data;
};

// Fetch Single WorkItem by ID
export const getWorkItemById = async (workItemId) => {
  if (!workItemId) throw new Error("WorkItem ID is required.");
  console.log("Fetching workItem by ID:", workItemId);
  const response = await apiClient.get(`${API_URL}/${workItemId}`);
  return response.data;
};

// Create New WorkItem
export const createWorkItem = async (workItemData) => {
  console.log("Creating workItem:", workItemData);
  const response = await apiClient.post(API_URL, workItemData);
  return response.data;
};

// Update WorkItem
export const updateWorkItem = async ({ workItemId, workItemData }) => {
  if (!workItemId) throw new Error("WorkItem ID is required for update.");
  console.log("Updating workItem:", workItemId, workItemData);
  const response = await apiClient.put(
    `${API_URL}/${workItemId}`,
    workItemData,
  );
  return response.data;
};

// Delete WorkItem
export const deleteWorkItem = async (workItemId) => {
  if (!workItemId) throw new Error("WorkItem ID is required for delete.");
  console.log("Deleting workItem:", workItemId);
  await apiClient.delete(`${API_URL}/${workItemId}`);
  return workItemId; // Return ID for cache invalidation
};
