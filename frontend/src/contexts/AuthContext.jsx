import React, { createContext, useState, useContext, useEffect } from "react";
// You might need a library for OIDC flow, e.g., oidc-client-ts or react-oidc-context
// For simplicity, this is a placeholder showing manual flow concepts

const AuthContext = createContext(null);

// Placeholder: You'll need functions to generate PKCE codes
const generateCodeVerifier = () => "dummyCodeVerifier"; // Replace with actual implementation
const generateCodeChallenge = async (verifier) => "dummyCodeChallenge"; // Replace with actual implementation (SHA256 hash)

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Store decoded token payload or user info
  const [token, setToken] = useState(localStorage.getItem("accessToken")); // Load token on init
  const [isLoading, setIsLoading] = useState(true); // Track initial loading state

  // Load initial state or validate existing token
  useEffect(() => {
    const storedToken = localStorage.getItem("accessToken");
    if (storedToken) {
      // TODO: Validate the token locally (check expiration)
      // In a real app, you might want to verify it against the backend or refresh it
      console.log("Found token in storage, assuming authenticated for now.");
      setToken(storedToken);
      // Decode token payload to set user info (use jwt-decode library)
      // try {
      //   const decoded = jwtDecode(storedToken);
      //   setUser(decoded);
      //   setIsAuthenticated(true);
      // } catch (error) {
      //   console.error("Failed to decode token:", error);
      //   logout(); // Clear invalid token
      // }
      setIsAuthenticated(true); // Simplified: Assume valid if exists
    }
    setIsLoading(false);
  }, []);

  const login = async () => {
    console.log("Initiating login flow...");
    setIsLoading(true);
    // --- OIDC Authorization Code Flow with PKCE ---
    const state = Math.random().toString(36).substring(7); // Random state
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store state and code verifier for callback
    localStorage.setItem("oauth_state", state);
    localStorage.setItem("oauth_code_verifier", codeVerifier);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
      redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,
      scope: import.meta.env.VITE_AUTHENTIK_SCOPE,
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256", // Use S256 for PKCE
    });

    const authorizeUrl = `${import.meta.env.VITE_AUTHENTIK_AUTHORIZE_URL}?${params.toString()}`;
    console.log("Redirecting to Authentik:", authorizeUrl);
    window.location.href = authorizeUrl; // Redirect user to Authentik
  };

  const handleAuthenticationCallback = async (code, receivedState) => {
    console.log("Handling authentication callback...");
    setIsLoading(true);
    const storedState = localStorage.getItem("oauth_state");
    const codeVerifier = localStorage.getItem("oauth_code_verifier");

    // Clean up stored values
    localStorage.removeItem("oauth_state");
    localStorage.removeItem("oauth_code_verifier");

    if (receivedState !== storedState) {
      console.error("Invalid state parameter received.");
      setIsLoading(false);
      // Handle error - maybe redirect to login with error message
      return;
    }

    if (!code || !codeVerifier) {
      console.error("Missing code or verifier for token exchange.");
      setIsLoading(false);
      // Handle error
      return;
    }

    // --- Exchange code for token (Backend-for-Frontend recommended) ---
    // **SECURITY NOTE:** Ideally, this token exchange should happen on your backend (BFF pattern)
    // to keep the client secret confidential. The code below demonstrates the concept
    // but doing it directly in the frontend is less secure for confidential clients.
    // If your Authentik client is public, this is acceptable.

    try {
      console.log(
        "Exchanging code for token (Frontend - check security implications)...",
      );
      // This requires a TOKEN endpoint on your backend OR direct call to Authentik
      // Assuming a backend endpoint /auth/token that proxies to Authentik
      /*
          const response = await apiClient.post('/auth/token', {
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,
              code_verifier: codeVerifier,
              client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID, // May not be needed if backend handles it
          });
          */

      // --- Placeholder: Assume token is received ---
      const fakeTokenData = {
        access_token:
          "fake-jwt-token-from-authentik" /* ... other token data */,
      };
      console.warn("Using FAKE token data - Implement actual token exchange!");

      const accessToken = fakeTokenData.access_token; // Replace with actual token from response
      localStorage.setItem("accessToken", accessToken);
      setToken(accessToken);
      setIsAuthenticated(true);
      // Decode token to set user, etc.
      // const decoded = jwtDecode(accessToken);
      // setUser(decoded);
      console.log("Authentication successful (simulated).");
    } catch (error) {
      console.error("Error during token exchange:", error);
      // Handle error display to user
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log("Logging out...");
    setIsLoading(true);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("accessToken");
    // TODO: Optionally redirect to Authentik's end_session_endpoint
    // const endSessionUrl = `${import.meta.env.VITE_AUTHENTIK_URL}/.../end-session?...`
    // window.location.href = endSessionUrl;
    console.log("Logged out locally.");
    setIsLoading(false);
    // Navigate to login page using router if needed
  };

  const value = {
    isAuthenticated,
    user,
    token,
    isLoading,
    login,
    logout,
    handleAuthenticationCallback,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
