// frontend/src/services/timeEntryService.js (Example - Create this if needed)
import apiClient from "../lib/apiClient";

export const getTimeEntries = async ({
  projectId,
  clientId,
  isInvoiced = false /* other filters */,
}) => {
  const params = {
    project_id: projectId,
    client_id: clientId,
    is_invoiced: isInvoiced,
    limit: 500, // Fetch many for selection initially, add pagination later if needed
  };
  // Remove undefined/null params
  Object.keys(params).forEach(
    (key) => params[key] == null && delete params[key],
  );

  console.log("Fetching time entries with params:", params);
  const response = await apiClient.get("/time-entries", { params }); // Assuming endpoint exists
  return response.data;
};
