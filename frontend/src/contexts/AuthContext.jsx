import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
// Remove Router hooks from here
// import { useNavigate, useLocation } from 'react-router-dom';
import pkceChallenge from "pkce-challenge";

import apiClient from "../lib/apiClient"; // Use your configured axios instance
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = "authTokens";

// Standalone function to perform token refresh - Remains the same
async function performTokenRefresh(refreshToken) {
  // ... (implementation as before) ...
  console.log("Attempting token refresh...");
  const tokenUrl = import.meta.env.VITE_AUTHENTIK_TOKEN_URL;
  const clientId = import.meta.env.VITE_AUTHENTIK_CLIENT_ID;

  if (!refreshToken) {
    console.error("No refresh token available.");
    return false;
  }
  if (!tokenUrl || !clientId) {
    console.error("Missing Authentik token URL or Client ID for refresh.");
    return false;
  }

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);
  params.append("client_id", clientId);

  try {
    // Use fetch directly to avoid interceptor loop on refresh failure
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Token refresh failed:", data);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return false;
    }

    console.log("Token refresh successful");
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer
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
    console.error("Error during token refresh request:", error);
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [authTokens, setAuthTokens] = useState(
    /* ... load initial ... */ () => {
      const storedTokens = localStorage.getItem(AUTH_STORAGE_KEY);
      return storedTokens ? JSON.parse(storedTokens) : null;
    },
  );
  const [userInfo, setUserInfo] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null); // Add state for errors

  // No Router hooks here:
  // const navigate = useNavigate(); <--- REMOVE
  // const location = useLocation(); <--- REMOVE

  const processTokenData = useCallback((tokens) => {
    // ... (implementation as before) ...
    setAuthError(null); // Clear error on successful processing
    if (tokens?.accessToken) {
      try {
        const decoded = jwtDecode(tokens.idToken || tokens.accessToken);
        setUserInfo(decoded);
        setIsAuthenticated(true);
        console.log("User authenticated, user info set:", decoded);
      } catch (error) {
        console.error("Failed to decode token:", error);
        setAuthError("Invalid token format."); // Set error state
        // Logout clears state
        setAuthTokens(null);
        setUserInfo(null);
        setIsAuthenticated(false);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } else {
      setUserInfo(null);
      setIsAuthenticated(false);
    }
  }, []);

  // Check token validity on load - Remains similar
  useEffect(() => {
    // ... (checkAuthStatus implementation as before, calling processTokenData and logoutInternal) ...
    const checkAuthStatus = async () => {
      setIsLoading(true);
      setAuthError(null);
      const storedTokens = localStorage.getItem(AUTH_STORAGE_KEY);
      const currentTokens = storedTokens ? JSON.parse(storedTokens) : null;

      if (currentTokens?.accessToken) {
        if (currentTokens.expiresAt && Date.now() < currentTokens.expiresAt) {
          console.log("Token valid on load.");
          setAuthTokens(currentTokens);
          processTokenData(currentTokens);
        } else {
          console.log("Token expired, attempting refresh on load...");
          const refreshSuccess = await performTokenRefresh(
            currentTokens.refreshToken,
          );
          if (refreshSuccess) {
            const refreshedTokens = JSON.parse(
              localStorage.getItem(AUTH_STORAGE_KEY),
            );
            setAuthTokens(refreshedTokens);
            processTokenData(refreshedTokens);
          } else {
            console.log("Refresh failed on load, clearing state.");
            setAuthError("Session expired. Please login again.");
            logoutInternal(); // Clear state without navigation attempt
          }
        }
      } else {
        console.log("No tokens found on load.");
        logoutInternal(); // Clear state without navigation attempt
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, [processTokenData]);

  const login = async () => {
    // Already async, perfect!
    console.log("AuthContext: login function initiated.");
    setIsLoading(true);
    setAuthError(null);

    let code_verifier, code_challenge;
    try {
      console.log(
        "AuthContext: login - Calling pkceChallenge() and awaiting...",
      );
      // *** FIX: Use await to get the resolved value ***
      const pkceResult = await pkceChallenge();
      // ---------------------------------------------

      console.log(
        "AuthContext: login - Resolved pkceChallenge() result:",
        pkceResult,
      ); // Log the resolved object

      // Destructure safely (still good practice)
      if (pkceResult && typeof pkceResult === "object") {
        code_verifier = pkceResult.code_verifier;
        code_challenge = pkceResult.code_challenge;
        console.log("AuthContext: login - Extracted Verifier:", code_verifier); // Log extracted value
        console.log(
          "AuthContext: login - Extracted Challenge:",
          code_challenge,
        ); // Log extracted value
      } else {
        console.error(
          "AuthContext: login - pkceChallenge() did not resolve to expected object.",
        );
        setAuthError("Failed to generate security challenge object.");
        setIsLoading(false);
        return;
      }
    } catch (error) {
      console.error(
        "AuthContext: login - Error awaiting/calling pkceChallenge():",
        error,
      );
      setAuthError("Error generating security challenge.");
      setIsLoading(false);
      return; // Stop login process
    }

    // Check if variables were successfully assigned AFTER await
    if (!code_verifier || !code_challenge) {
      console.error(
        "AuthContext: login - code_verifier or code_challenge is missing after await.",
      );
      setAuthError("Failed to get security challenge components after await.");
      setIsLoading(false);
      return;
    }

    const state = Math.random().toString(36).substring(7);
    console.log("AuthContext: login - Storing in localStorage:", {
      state,
      code_verifier,
    }); // Log the values being stored
    localStorage.setItem("oauth_state", state);
    localStorage.setItem("oauth_code_verifier", code_verifier);
    const storedVerifier = localStorage.getItem("oauth_code_verifier");
    console.log(
      "AuthContext: login - Verifier immediately after setItem:",
      storedVerifier,
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,
      scope: import.meta.env.VITE_AUTHENTIK_SCOPE,
      state: state,
      code_challenge: code_challenge, // Use the correctly awaited value
      code_challenge_method: "S256",
    });

    const authorizeUrl = `${import.meta.env.VITE_AUTHENTIK_AUTHORIZE_URL}?${params.toString()}`;
    console.log("AuthContext: login - Redirecting to Authentik:", authorizeUrl); // Check the final URL
    window.location.href = authorizeUrl;
  };

  // Modified: Return success/failure status
  const handleAuthenticationCallback = useCallback(
    async (code, receivedState) => {
      console.log(
        "Handling authentication callback via Backend-for-Frontend...",
      );
      setIsLoading(true);
      setAuthError(null);
      const storedState = localStorage.getItem("oauth_state");
      // *** FIX: Retrieve code_verifier correctly ***
      const codeVerifier = localStorage.getItem("oauth_code_verifier");

      // Clean up storage immediately after retrieving
      localStorage.removeItem("oauth_state");
      localStorage.removeItem("oauth_code_verifier"); // Remove it here

      console.log("Received State:", receivedState); // Log received state
      console.log("Stored State:", storedState); // Log stored state
      console.log("Retrieved Code Verifier:", codeVerifier); // *** ADDED: Log the retrieved verifier ***

      // Check if state matches
      if (receivedState !== storedState) {
        console.error("Invalid state parameter.");
        setAuthError("Login failed: Invalid state.");
        setIsLoading(false);
        return false;
      }
      // *** FIX: Check if codeVerifier was actually retrieved ***
      if (!code || !codeVerifier) {
        // Check both code and verifier
        console.error("Missing code or verifier from storage/redirect.");
        setAuthError(`Login failed: Missing ${!code ? "code" : "verifier"}.`);
        setIsLoading(false);
        return false;
      }

      // --- Call YOUR backend's token endpoint ---
      try {
        console.log(
          `Sending to backend: code=${code}, code_verifier=${codeVerifier}`,
        ); // Log what's being sent
        const response = await apiClient.post("/auth/token", {
          code: code, // Send code
          code_verifier: codeVerifier, // *** FIX: Send the retrieved verifier ***
        });

        // ... rest of the success/error handling for the API call ...
        const data = response.data;
        if (!data || !data.access_token) {
          console.error(
            "Token exchange via backend failed: Invalid response format",
            data,
          );
          setAuthError(
            `Login failed: ${data?.detail || "Invalid response from backend"}`,
          );
          setIsLoading(false);
          return false;
        }
        console.log("Token exchange via backend successful:", data);
        const expiresAt = Date.now() + (data.expires_in - 60) * 1000;
        const newTokens = {
          /* ... */
        };
        newTokens.accessToken = data.access_token;
        newTokens.refreshToken = data.refresh_token;
        newTokens.expiresAt = expiresAt;
        newTokens.idToken = data.id_token;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newTokens));
        setAuthTokens(newTokens);
        processTokenData(newTokens);
        setIsLoading(false);
        return true;
      } catch (error) {
        // ... error handling ...
        console.error("Error during token exchange via backend:", error);
        const errorMsg =
          error.response?.data?.detail ||
          error.message ||
          "Login failed: Error contacting backend for token exchange.";
        setAuthError(errorMsg);
        setIsLoading(false);
        return false;
      }
    },
    [processTokenData],
  );
  // Internal logout function to clear state
  const logoutInternal = () => {
    setAuthTokens(null);
    setUserInfo(null);
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem("oauth_state");
    localStorage.removeItem("oauth_code_verifier");
    console.log("Auth state cleared.");
  };

  // Exposed logout function - only clears state now
  const logout = useCallback(() => {
    console.log("Logout initiated...");
    logoutInternal(); // Call internal function to clear state

    // Optional: Redirect to Authentik end session endpoint - handled by calling component now
    const endSessionUrl = import.meta.env.VITE_AUTHENTIK_END_SESSION_URL;
    if (endSessionUrl) {
      // You might need to include id_token_hint and post_logout_redirect_uri
      // This redirection should happen in the UI component triggering logout
      console.log(
        "Authentik end session URL configured, redirection should be handled by UI.",
      );
      // Example (should be in Layout.jsx):
      // const params = new URLSearchParams({ post_logout_redirect_uri: window.location.origin + '/login' });
      // window.location.href = `${endSessionUrl}?${params.toString()}`;
    }
  }, []);

  // Provide context value
  const value = {
    isAuthenticated,
    userInfo,
    authTokens,
    isLoading,
    authError, // Provide error state
    login,
    logout, // This now only clears state
    handleAuthenticationCallback, // This now returns true/false
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// useAuth hook remains the same
export const useAuth = () => {
  // ... (implementation as before) ...
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ...
export { AuthContext };
