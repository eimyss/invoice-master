import axios from "axios";

const AUTH_STORAGE_KEY = "authTokens"; // Use the same key as AuthContext
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// --- Request Interceptor ---
apiClient.interceptors.request.use(
  (config) => {
    const storedTokens = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedTokens) {
      const tokens = JSON.parse(storedTokens);
      if (tokens.accessToken) {
        config.headers["Authorization"] = `Bearer ${tokens.accessToken}`;
        console.debug("Attaching token to request:", config.url);
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// --- Response Interceptor (for token refresh) ---

// Promise to handle concurrent token refresh requests
let isRefreshing = false;
let refreshSubscribers = []; // Queue of requests waiting for refresh

const onRefreshed = (newAccessToken) => {
  refreshSubscribers.map((callback) => callback(newAccessToken));
  refreshSubscribers = []; // Clear subscribers
};

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

apiClient.interceptors.response.use(
  (response) => {
    // If request is successful, just return the response
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response ? error.response.status : null;
    const storedTokens = localStorage.getItem(AUTH_STORAGE_KEY);
    const currentTokens = storedTokens ? JSON.parse(storedTokens) : null;

    // Check if it's a 401 error, we have a refresh token, and we haven't already retried
    if (
      status === 401 &&
      currentTokens?.refreshToken &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true; // Mark that we've attempted a retry

      if (!isRefreshing) {
        isRefreshing = true;
        console.log(
          "Access token expired or invalid (401). Initiating refresh...",
        );

        // Call the standalone refresh function (defined in AuthContext or here)
        // We need a similar function here or import it if exported from AuthContext
        const refreshSuccess = await performTokenRefreshInternal(
          currentTokens.refreshToken,
        );
        isRefreshing = false; // Reset flag after attempt

        if (refreshSuccess) {
          console.log("Refresh successful, retrying original request.");
          const newTokens = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
          onRefreshed(newTokens.accessToken); // Notify queued requests
          originalRequest.headers["Authorization"] =
            `Bearer ${newTokens.accessToken}`;
          return apiClient(originalRequest); // Retry the original request with the new token
        } else {
          console.error("Refresh token failed. Logging out.");
          // Trigger logout (cannot directly call context's logout here easily)
          // Redirecting or relying on subsequent checks is common
          localStorage.removeItem(AUTH_STORAGE_KEY); // Clear tokens immediately
          window.location.href = "/login?error=session_expired"; // Force reload/redirect
          return Promise.reject(error); // Reject the original request
        }
      } else {
        // If already refreshing, queue the original request to be retried later
        console.log(
          "Token refresh already in progress. Queuing request:",
          originalRequest.url,
        );
        return new Promise((resolve) => {
          addRefreshSubscriber((newAccessToken) => {
            console.log(
              "Retrying queued request with new token:",
              originalRequest.url,
            );
            originalRequest.headers["Authorization"] =
              `Bearer ${newAccessToken}`;
            resolve(apiClient(originalRequest)); // Resolve with the retried request
          });
        });
      }
    }

    // For errors other than 401 or if refresh is not possible, reject the promise
    return Promise.reject(error);
  },
);

// --- Internal Refresh Function (similar to the one in AuthContext) ---
// Needed because interceptor doesn't have direct context access
async function performTokenRefreshInternal(refreshToken) {
  const tokenUrl = import.meta.env.VITE_AUTHENTIK_TOKEN_URL;
  const clientId = import.meta.env.VITE_AUTHENTIK_CLIENT_ID;

  if (!refreshToken || !tokenUrl || !clientId) return false;

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", clientId);

  try {
    // Use a separate fetch/axios instance that *doesn't* use the interceptor
    // to avoid infinite loops if the refresh endpoint itself returns 401
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed inside interceptor:", data);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return false;
    }

    const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: expiresAt,
        idToken: data.id_token,
      }),
    );
    return true;
  } catch (error) {
    console.error("Error during token refresh request in interceptor:", error);
    return false;
  }
}

export default apiClient;
