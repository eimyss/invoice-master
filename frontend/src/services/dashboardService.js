// frontend/src/services/dashboardService.js
import apiClient from "../lib/apiClient";

const API_URL = "/dashboard"; // Base URL for dashboard endpoints

export const getHoursSummary = async () => {
  console.log("Fetching hours summary for dashboard...");
  // The queryKey is not needed by the service function itself,
  // it's used by useQuery. We don't need to pass it here.
  const response = await apiClient.get(`${API_URL}/summary/hours-this-month`);
  return response.data; // Expects data matching HoursSummaryResponse model
};

// You can add other dashboard-related service functions here later
// export const getRevenueSummary = async () => { ... };
