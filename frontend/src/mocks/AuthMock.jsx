// frontend/src/mocks/AuthMock.jsx
import React from "react";
import { AuthContext } from "../contexts/AuthContext"; // Adjust path as needed
import { vi } from "vitest";
export const MockAuthProvider = ({
  children,
  isAuthenticated = true,
  isLoading = false,
  userInfo = null,
}) => {
  const mockAuthValue = {
    isAuthenticated: isAuthenticated,
    isLoading: isLoading,
    userInfo:
      userInfo ||
      (isAuthenticated
        ? { sub: "mock-user-123", name: "Mock User", email: "mock@example.com" }
        : null),
    authTokens: isAuthenticated
      ? { accessToken: "mock-access-token", refreshToken: "mock-refresh-token" }
      : null,
    login: vi.fn(), // Use vi.fn() from Vitest for spies
    logout: vi.fn(),
    handleAuthenticationCallback: vi.fn().mockResolvedValue(true),
    authError: null,
  };

  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};
