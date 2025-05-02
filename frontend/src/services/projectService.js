// frontend/src/services/projectService.js
import apiClient from "../lib/apiClient";

const API_URL = "/projects";

const RATE_API_URL = "/projects/{id}/rates";
// Fetch Projects
export const getProjects = async ({
  searchTerm = "",
  page = 1,
  limit = 10,
  clientId = null,
}) => {
  console.log("Fetching projects with params:", {
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

export const getRatesByProjectId = async (projectId) => {
  if (!projectId) throw new Error("Project ID is required.");
  console.log("Fetching Rates project by ID:", projectId);
  const response = await apiClient.get(`${API_URL}/${projectId}`);
  return response.data.rates;
};
// Fetch Single Project by ID
export const getProjectById = async (projectId) => {
  if (!projectId) throw new Error("Project ID is required.");
  console.log("Fetching project by ID:", projectId);
  const response = await apiClient.get(`${API_URL}/${projectId}`);
  return response.data;
};

// Create New Project
export const createProject = async (projectData) => {
  console.log("Creating project:", projectData);
  const response = await apiClient.post(API_URL, projectData);
  return response.data;
};

// Update Project
export const updateProject = async ({ projectId, projectData }) => {
  if (!projectId) throw new Error("Project ID is required for update.");
  console.log("Updating project:", projectId, projectData);
  const response = await apiClient.put(`${API_URL}/${projectId}`, projectData);
  return response.data;
};

// Delete Project
export const deleteProject = async (projectId) => {
  if (!projectId) throw new Error("Project ID is required for delete.");
  console.log("Deleting project:", projectId);
  await apiClient.delete(`${API_URL}/${projectId}`);
  return projectId; // Return ID for cache invalidation
};
