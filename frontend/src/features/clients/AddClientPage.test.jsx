// frontend/src/features/clients/AddClientPage.test.jsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { debug } from "vitest-preview";
import { http, HttpResponse } from "msw";
import AddClientPage from "./AddClientPage";
import ClientListPage from "./ClientListPage"; // For navigation back
import { MockAuthProvider } from "../../mocks/AuthMock";
import { server } from "../../mocks/server";

import { resetMockClients, handlers } from "../../mocks/handlers";

const renderWithProviders = (
  ui,
  { route = "/clients/new", initialEntries = [route] } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MockAuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/clients/new" element={ui} />
            <Route path="/clients" element={<ClientListPage />} />
          </Routes>
        </MemoryRouter>
      </MockAuthProvider>
    </QueryClientProvider>,
  );
};

describe("AddClientPage", () => {
  beforeEach(() => {
    server.resetHandlers(...handlers);
    resetMockClients();
  });

  it("renders the add client form with correct fields", () => {
    renderWithProviders(<AddClientPage />);
    expect(
      screen.getByRole("heading", { name: /add new client/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/client name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Add more checks for other fields
    expect(
      screen.getByRole("button", { name: /create client/i }),
    ).toBeInTheDocument();
  });

  it("shows validation error for required fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddClientPage />);

    const submitButton = screen.getByRole("button", { name: /create client/i });
    await user.click(submitButton);

    // Zod error message from schema
    expect(
      await screen.findByText(/client name is required/i),
    ).toBeInTheDocument();
    // Email is optional, so no error expected for it initially
  });

  it("submits valid data and navigates to client list on success", async () => {
    const user = userEvent.setup();
    const mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {}); // Mock alert

    renderWithProviders(<AddClientPage />);

    await user.type(screen.getByLabelText(/client name/i), "New Test Client");
    await user.type(screen.getByLabelText(/email/i), "new@test.com");
    // Fill other fields as needed by your schema

    const submitButton = screen.getByRole("button", { name: /create client/i });
    await user.click(submitButton);

    // Wait for navigation (ClientListPage should render its title)
    // And successful API call (MSW handler for POST /clients will run)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /clients/i }),
      ).toBeInTheDocument();
    });
    // Optionally, check if the success alert was called
    // This depends on what your onSuccess in useMutation does
    // expect(mockAlert).toHaveBeenCalledWith(expect.stringContaining('Client created'));

    mockAlert.mockRestore();
  });

  it("displays API error message if submission fails", async () => {
    const user = userEvent.setup();

    debug(); // 👈 Add this line
    // Override MSW handler for this test to simulate an error
    server.use(
      http.post(`${import.meta.env.VITE_API_BASE_URL}/clients`, () => {
        return HttpResponse.json(
          { detail: "Simulated server error creating client." },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<AddClientPage />);

    await user.type(screen.getByLabelText(/client name/i), "Error Client");
    await user.type(screen.getByLabelText(/email/i), "error@client.com");

    const submitButton = screen.getByRole("button", { name: /create client/i });
    await user.click(submitButton);
    try {
      // Your assertion that might fail
      await waitFor(() => {
        expect(
          screen.getByText(/Request failed with status code 500/i),
        ).toBeInTheDocument();
      });
    } catch (error) {
      console.error("Test Assertion Failed! Current DOM state:");
      screen.debug(undefined, Infinity); // Print the entire DOM without truncation
      throw error; // Re-throw the error so the test still fails
    }
  });
});
describe("AddClientPage - Form Submission", () => {
  beforeEach(() => {
    server.resetHandlers(); // Clear overrides from previous tests
    server.use(...handlers); // Apply default handlers
    resetMockClients();
    vi.spyOn(window, "alert").mockImplementation(() => {}); // Mock alert
  });

  afterEach(() => {
    vi.restoreAllMocks(); // Clean up spies
  });

  it("sends the correct data in the request body when submitting the form", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddClientPage />);

    // --- Data to fill in the form ---
    const clientInputData = {
      name: "Awesome New Client",
      email: "awesome@example.com",
      address_street: "123 Main St",
      address_zip: "90210",
      address_city: "Beverly Hills",
      address_country: "USA",
      vat_id: "US123456789",
      contact_person: "John Doe",
      phone: "555-1234",
      notes: "This is a very important client.",
    };

    // --- Spy on the actual fetch/apiClient.post or override MSW handler ---
    // Option A: Spy on apiClient.post (if your createClient service uses it directly)
    // This requires apiClient to be mockable or you import the service and spy on its method.
    // For simplicity with MSW, let's use a more targeted MSW override.

    // Option B: Override the MSW handler to capture the request
    const mockSubmitHandler = vi.fn(async ({ request }) => {
      const requestBody = await request.json();
      console.log("[Test MSW Handler] Captured request body:", requestBody);

      // Perform assertions on the requestBody here
      expect(requestBody.name).toBe(clientInputData.name);
      expect(requestBody.email).toBe(clientInputData.email);
      expect(requestBody.address_street).toBe(clientInputData.address_street);
      expect(requestBody.address_zip).toBe(clientInputData.address_zip);
      expect(requestBody.address_city).toBe(clientInputData.address_city);
      expect(requestBody.address_country).toBe(clientInputData.address_country);
      expect(requestBody.vat_id).toBe(clientInputData.vat_id);
      expect(requestBody.contact_person).toBe(clientInputData.contact_person);
      expect(requestBody.phone).toBe(clientInputData.phone);
      expect(requestBody.notes).toBe(clientInputData.notes);
      // Add checks for any other fields expected by your backend's ClientCreate model

      // Return a successful mock response
      return HttpResponse.json(
        {
          id: "mock-new-id",
          ...requestBody, // Echo back what was received
          user_id: "mock-user-123",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { status: 201 },
      );
    });

    server.use(
      http.post(
        `${import.meta.env.VITE_API_BASE_URL}/clients`,
        mockSubmitHandler,
      ),
    );
    // ---------------------------------------------------------------

    // --- Fill out the form ---
    await user.type(
      screen.getByLabelText(/client name/i),
      clientInputData.name,
    );
    await user.type(screen.getByLabelText(/email/i), clientInputData.email);
    await user.type(
      screen.getByLabelText(/street & no./i),
      clientInputData.address_street,
    );
    await user.type(
      screen.getByLabelText(/zip code/i),
      clientInputData.address_zip,
    );
    await user.type(
      screen.getByLabelText(/city/i),
      clientInputData.address_city,
    );
    await user.type(
      screen.getByLabelText(/country/i),
      clientInputData.address_country,
    );
    await user.type(screen.getByLabelText(/vat id/i), clientInputData.vat_id);
    await user.type(
      screen.getByLabelText(/contact person/i),
      clientInputData.contact_person,
    );
    await user.type(screen.getByLabelText(/phone/i), clientInputData.phone);
    await user.type(screen.getByLabelText(/^notes$/i), clientInputData.notes); // Use regex for exact "Notes" label

    // --- Click Submit ---
    const submitButton = screen.getByRole("button", {
      name: /create client/i,
    });
    await user.click(submitButton);

    // --- Assertions ---
    // Check that our mock handler was called
    await waitFor(() => {
      expect(mockSubmitHandler).toHaveBeenCalledTimes(1);
    });

    // Navigation to client list (or other success behavior) should occur
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /clients/i }),
      ).toBeInTheDocument();
    });
  });
});
