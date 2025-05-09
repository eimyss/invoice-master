// frontend/src/features/clients/ClientListPage.test.jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest"; // Import from vitest
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { http, HttpResponse } from "msw";
import ClientListPage from "./ClientListPage";
import AddClientPage from "./AddClientPage"; // For testing navigation
import EditClientPage from "./EditClientPage"; // For testing navigation
import { MockAuthProvider } from "../../mocks/AuthMock"; // Your mock auth provider
import { handlers, resetMockClients } from "../../mocks/handlers"; // MSW handlers
import { server } from "../../mocks/server"; // MSW server

// Helper to wrap components for testing
const renderWithProviders = (
  ui,
  { route = "/", initialEntries = [route] } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }, // Disable retries for tests
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        {" "}
        {/* Use mocked auth */}
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/clients" element={ui} />
            {/* Add other routes needed for navigation tests */}
            <Route path="/clients/new" element={<AddClientPage />} />
            <Route
              path="/clients/:clientId/edit"
              element={<EditClientPage />}
            />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>,
  );
};

describe("ClientListPage", () => {
  beforeEach(() => {
    // Reset MSW handlers and mock data before each test
    server.resetHandlers(...handlers); // Ensure fresh handlers
    resetMockClients();
  });

  it("renders the client list page title and add button", async () => {
    renderWithProviders(<ClientListPage />, { route: "/clients" });
    expect(
      screen.getByRole("heading", { name: /clients/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /add new client/i }),
    ).toBeInTheDocument();
  });

  it("fetches and displays clients from the API", async () => {
    renderWithProviders(<ClientListPage />, { route: "/clients" });

    // Wait for mock clients to be displayed
    expect(await screen.findByText("Mock Client Alpha")).toBeInTheDocument();
    expect(screen.getByText("Mock Client Beta")).toBeInTheDocument();
    expect(screen.queryByText("Loading clients...")).not.toBeInTheDocument();
  });

  it("allows searching for clients", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientListPage />, { route: "/clients" });

    expect(await screen.findByText("Mock Client Alpha")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(
      /search by name, email, city.../i,
    );
    await user.type(searchInput, "Alpha");

    // Wait for filtering to apply
    await waitFor(() => {
      expect(screen.getByText("Mock Client Alpha")).toBeInTheDocument();
      expect(screen.queryByText("Mock Client Beta")).not.toBeInTheDocument();
    });

    await user.clear(searchInput);
    await user.type(searchInput, "NonExistent");
    await waitFor(() => {
      expect(screen.getByText("No clients found.")).toBeInTheDocument();
    });
  });

  it('navigates to add client page when "Add New Client" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClientListPage />, { route: "/clients" });

    const addButton = screen.getByRole("link", { name: /add new client/i });
    await user.click(addButton);

    // Check if the AddClientPage content is rendered (e.g., its title)
    // This requires AddClientPage to be a route in renderWithProviders
    expect(
      await screen.findByRole("heading", { name: /add new client/i }),
    ).toBeInTheDocument();
  });

  // Test for delete (more complex due to confirmation)
  it("deletes a client after confirmation", async () => {
    const user = userEvent.setup();
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderWithProviders(<ClientListPage />, { route: "/clients" });

    // Wait for clients to load
    const deleteButtons = await screen.findAllByTitle(/delete/i);
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Delete "Mock Client Alpha"
    // Find the row for "Mock Client Alpha", then its delete button
    const alphaRow = screen.getByText("Mock Client Alpha").closest("tr");
    const alphaDeleteButton = alphaRow.querySelector('button[title="Delete"]');

    await user.click(alphaDeleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      'Are you sure you want to delete client "Mock Client Alpha"? This cannot be undone.',
    );

    // Wait for the client to be removed from the list
    await waitFor(() => {
      expect(screen.queryByText("Mock Client Alpha")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Mock Client Beta")).toBeInTheDocument(); // Ensure other client remains

    confirmSpy.mockRestore(); // Clean up spy
  });
});
