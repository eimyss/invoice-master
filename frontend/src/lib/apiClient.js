import axios from "axios";

// Retrieve the base URL from environment variables
const baseURL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Axios Interceptor for Authentication ---
// This is where you'll add the logic to attach the JWT token
apiClient.interceptors.request.use(
  (config) => {
    // TODO: Retrieve the token from where you store it (localStorage, sessionStorage, context)
    const token = localStorage.getItem("accessToken"); // Example: using localStorage

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// --- Axios Interceptor for Response Handling (Optional) ---
// Example: Handle 401 Unauthorized errors globally (e.g., redirect to login)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // TODO: Implement logout logic or token refresh logic
      console.error("Unauthorized access - 401");
      // Example: Redirect to login page
      // window.location.href = '/login'; // Or use React Router's navigate
      // Clear stored token
      localStorage.removeItem("accessToken");
    }
    return Promise.reject(error);
  },
);

export default apiClient;
