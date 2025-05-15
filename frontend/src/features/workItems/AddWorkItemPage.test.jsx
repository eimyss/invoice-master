// frontend/src/features/workItems/AddWorkItemPage.test.jsx
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { debug } from "vitest-preview";
import { http, HttpResponse } from "msw";
import AddWorkItemPage from "./AddWorkItemPage";
import WorkItemListPage from "./WorkItemListPage"; // For navigation back
import { MockAuthProvider } from "../../mocks/AuthMock";
import { server } from "../../mocks/server";
import { NotificationProvider } from "../../context/NotificationContext";
import {
  resetMockWorkItems,
  handlers,
  resetMockClients,
  resetMockProjects,
} from "../../mocks/handlers";

const renderWithProviders = (
  ui,
  { route = "/workItems/new", initialEntries = [route] } = {},
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <NotificationProvider>
      <QueryClientProvider client={queryClient}>
        <MockAuthProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route path="/workItems/new" element={ui} />
              <Route path="/workItems" element={<WorkItemListPage />} />
            </Routes>
          </MemoryRouter>
        </MockAuthProvider>
      </QueryClientProvider>
      ,
    </NotificationProvider>,
  );
};

describe("AddWorkItemPage", () => {
  beforeEach(() => {
    server.resetHandlers(...handlers);
    resetMockWorkItems();
  });

  it("renders the add workItem form with correct fields", () => {
    renderWithProviders(<AddWorkItemPage />);
    expect(
      screen.getByRole("heading", { name: /Add New Work Item/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Project/i)).toBeInTheDocument();
    //expect(screen.getByLabelText(/Client/i)).toBeInTheDocument();

    // --- Testing the "Client" Display ---
    // 1. Find the label "Client" itself
    expect(
      screen.getByText((content, element) => {
        // A more robust way to find the label if it doesn't have specific attributes for queryByRole
        // This checks if the element is a <label> and its text content matches /Client/i
        return (
          element.tagName.toLowerCase() === "label" && /Client/i.test(content)
        );
      }),
    ).toBeInTheDocument();

    // 2. Find the displayed text for the client
    // Initially, it should show "(Select Project)" or "Loading..." or be empty
    // depending on your selectedProjectId state
    // Let's assume selectedProjectId is initially empty, so it shows "(Select Project)"
    expect(screen.getByLabelText(/Project/i)).toBeInTheDocument();
    // Or, if you want to be more specific about the div containing it:
    // const clientDisplayDiv = screen.getByText(/\(Select Project\)/i).closest('div');
    // expect(clientDisplayDiv).toHaveClass('your-specific-class-for-this-div'); // If you have one

    expect(screen.getByLabelText(/Work Date/i)).toBeInTheDocument();

    // Check for the "Project" picker button (assuming EntityPicker has role="button" or similar)
    // Or you might just check for the "Project" label text itself if the picker is complex
    expect(
      screen.getByText((content, element) => {
        // Check if the element is a label and its text content is "Project"
        return (
          element.tagName.toLowerCase() === "label" && /Project/i.test(content)
        );
      }),
    ).toBeInTheDocument();
    // Add more checks for other fields
    expect(
      screen.getByRole("button", { name: /create Work Item/i }),
    ).toBeInTheDocument();
  });

  it("shows validation error for required fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddWorkItemPage />);

    const submitButton = screen.getByRole("button", {
      name: /create Work Item/i,
    });
    await user.click(submitButton);

    // Zod error message from schema
    expect(
      await screen.findByText(/workItem name is required/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Valid client must be selected/i),
    ).toBeInTheDocument();
    // Email is optional, so no error expected for it initially
  });

  it("displays API error message if submission fails", async () => {
    const user = userEvent.setup();

    debug(); // 👈 Add this line
    // Override MSW handler for this test to simulate an error
    server.use(
      http.post(`${import.meta.env.VITE_API_BASE_URL}/workItems`, () => {
        return HttpResponse.json(
          { detail: "Simulated server error creating workItem." },
          { status: 500 },
        );
      }),
    );

    renderWithProviders(<AddWorkItemPage />);

    await user.type(screen.getByLabelText(/name/i), "Error WorkItem");

    const submitButton = screen.getByRole("button", {
      name: /create work Item/i,
    });
    await user.click(submitButton);
    try {
      // Your assertion that might fail
      await waitFor(() => {
        expect(
          screen.getByText(/Error in this time entry row./i),
        ).toBeInTheDocument();
      });
    } catch (error) {
      console.error("Test Assertion Failed! Current DOM state:");
      screen.debug(undefined, Infinity); // Print the entire DOM without truncation
      throw error; // Re-throw the error so the test still fails
    }
  });
});
describe("AddWorkItemPage - Form Submission with EntityPicker", () => {
  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  let mockAlert;

  beforeEach(() => {
    server.resetHandlers();
    server.use(...handlers); // Apply default generic handlers
    resetMockClients(); // Reset any mock data if needed
    resetMockProjects(); // Reset project mock data
    mockAlert = vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("allows selecting a rate from the dropdown after a project is selected", async () => {
    const user = userEvent.setup({ delay: null });

    // --- Mock Data ---
    const mockProjectForRates = {
      // Ensure this object has the rates
      _id: "proj-rates-123",
      name: "Project With Rates",
      client_id: "client-xyz",
      rates: [
        { name: "Development", price_per_hour: 80.0 },
        { name: "Consulting", price_per_hour: 120.0 },
      ],
    };
    const mockClientForThisProject = {
      id: "client-xyz",
      name: "Client For Rates Project",
    };

    server.use(
      // Mock for Project Picker's initial list
      http.get(`${API_BASE_URL}/projects`, ({ request }) => {
        // Assuming this list is just for the picker, not for detail yet
        return HttpResponse.json([
          {
            _id: mockProjectForRates._id,
            name: mockProjectForRates.name,
            client_id: mockProjectForRates.client_id,
          },
          // ... other projects for picker ...
        ]);
      }),
      // Mock for fetching THE selected project's details (which includes rates)
      http.get(
        `${API_BASE_URL}/projects/${mockProjectForRates._id}`,
        ({ params }) => {
          console.log(
            `[MSW Test] GET /projects/${mockProjectForRates._id} - Returning project with rates`,
          );
          return HttpResponse.json(mockProjectForRates);
        },
      ),
      // Mock for client name display (if your form fetches it)
      http.get(
        `${API_BASE_URL}/clients/${mockProjectForRates.client_id}`,
        ({ params }) => {
          return HttpResponse.json(mockClientForThisProject);
        },
      ),
      // Add POST /workItems mock later for full submission test
    );
    // -----------------------------------------

    renderWithProviders(<AddWorkItemPage />);

    // 1. Select a Project
    const projectPickerButton = screen.getByRole("button", {
      name: /Project/i,
    });
    await user.click(projectPickerButton);
    const projectInModal = await screen.findByText(mockProjectForRates.name, {
      selector: "td",
    });
    const projectRow = projectInModal.closest("tr");
    const selectProjectButtonInModal = within(projectRow).getByRole("button", {
      name: /select/i,
    });
    await user.click(selectProjectButtonInModal);
    await waitFor(() => {
      expect(projectPickerButton).toHaveTextContent(mockProjectForRates.name);
    });

    // 2. Find the Rate Dropdown for the first time entry
    // It might initially be disabled or show "Loading Rates..."
    const rateDropdown = await screen.findByLabelText(/Rate/i); // Use regex
    expect(rateDropdown).toBeInTheDocument();

    // 3. Wait for the "Loading Rates..." option to DISAPPEAR (or options to appear)
    // This indicates that the useQuery for project details has likely finished.
    await waitFor(
      () => {
        // Option A: Wait for loading option to disappear
        expect(
          screen.queryByRole("option", { name: /Loading Rates.../i }),
        ).not.toBeInTheDocument();
        // Option B: Wait for a specific expected option to be present AND not disabled
        const devOption = screen.getByRole("option", {
          name: /Development \(€80.00\/hr\)/i,
        });
        expect(devOption).toBeInTheDocument();
        expect(devOption).not.toBeDisabled();
      },
      { timeout: 5000 },
    ); // Increase timeout if fetching is slow in test environment

    // 4. Now that options are expected to be there, assert their presence
    expect(
      within(rateDropdown).getByRole("option", {
        name: /Development \(€80.00\/hr\)/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(rateDropdown).getByRole("option", {
        name: /Consulting \(€120.00\/hr\)/i,
      }),
    ).toBeInTheDocument();

    // 5. Simulate selecting an option
    await user.selectOptions(
      rateDropdown,
      screen.getByRole("option", { name: /Consulting \(€120.00\/hr\)/i }),
    );

    // 6. Verify the selection
    expect(rateDropdown).toHaveValue("Consulting");

    // ... (rest of the test: fill duration, description, submit, etc.)
  });
  it("allows selecting a project using the EntityPicker and submits valid data", async () => {
    const user = userEvent.setup({ delay: null }); // delay: null for faster typing in tests

    // --- Mock API responses for the pickers ---
    const mockSelectedProject = {
      _id: "b55ea0a6-571d-4027-95bb-efd0b30a593c",
      name: "Test Project Alpha",
      client_id: "client-abc",
      rates: [
        {
          name: "Development",
          price_per_hour: 80.0,
        },
        {
          name: "Consulting",
          price_per_hour: 120.0,
        },
      ],
    };
    const mockOtherProject = {
      _id: "a55ea0a6-571d-4027-95aa-efd0b30a593c",
      name: "Another Project",
      client_id: "client-def",
      rates: [
        {
          name: "Admin",
          price_per_hour: 100.0,
        },
        {
          name: "Consulting",
          price_per_hour: 100.0,
        },
      ],
    };

    server.use(
      // Mock for Project Picker's fetchFn
      http.get(`${API_BASE_URL}/projects`, ({ request }) => {
        const url = new URL(request.url);
        const searchTerm = url.searchParams.get("search") || "";
        console.log("[MSW Test] Project Picker Fetch. Search:", searchTerm);
        let projectsToReturn = [mockSelectedProject, mockOtherProject];
        if (searchTerm) {
          projectsToReturn = projectsToReturn.filter((p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()),
          );
        }
        return HttpResponse.json(projectsToReturn);
      }),

      /*
        *
        *
        *{
  name: 'My New Work Item',
  timeEntries: [
    {
      rate_name: 'Consulting',
      rate_price_per_hour: 120,
      duration: 2.5,
      description: 'Worked on feature X'
    }
  ],
  project_id: 'b55ea0a6-571d-4027-95bb-efd0b30a593c',
  status: 'created'
}
        *
        */
      // Mock for the final WorkItem POST
      http.post(`${API_BASE_URL}/workItems`, async ({ request }) => {
        // Adjust URL if different
        const submittedData = await request.json();
        console.log("[MSW Test] WorkItem POST received:", submittedData);
        // Assertions for the submitted data can also go here if desired,
        // or you can spy on the createWorkItem service function.
        expect(submittedData.project_id).toBe(mockSelectedProject._id);
        expect(submittedData.name).toBe("My New Work Item");

        expect(submittedData.timeEntries.length).toBe(1);
        expect(submittedData.timeEntries[0].rate_name).toBe("Consulting");
        expect(submittedData.timeEntries[0].rate_price_per_hour).toBe(120);
        expect(submittedData.timeEntries[0].duration).toBe(2.5);
        expect(submittedData.timeEntries[0].description).toBe(
          "Worked on feature X",
        );
        // ... other assertions ...

        // Simulate successful creation
        return HttpResponse.json(
          { id: "wi-789", ...submittedData },
          { status: 201 },
        );
      }),
      http.get(`${API_BASE_URL}/projects/:projectId`, ({ params }) => {
        if (params.projectId === mockSelectedProject._id) {
          console.log(
            "[MSW Test] Fetching project details for rates:",
            mockSelectedProject,
          );
          return HttpResponse.json(mockSelectedProject); // Ensure this returns the project WITH rates
        }
        return HttpResponse.json(
          { detail: "Project not found" },
          { status: 404 },
        );
      }),
    );
    // -----------------------------------------

    renderWithProviders(<AddWorkItemPage />);

    // 1. Fill in other form fields
    await user.type(screen.getByLabelText(/Name/i), "My New Work Item"); // Assuming "Name" is for WorkItem name
    // Assuming 'Work Date' is a DatePickerField handled by react-hook-form Controller
    // For DatePicker, direct typing is tricky. If it's a text input under the hood:
    // await user.type(screen.getByLabelText(/Work Date/i), '2024-05-10');
    // More robust: Click to open, then select. Or use fireEvent for simplicity if userEvent is hard.
    // For now, let's assume date is handled or pre-filled and focus on picker.
    // You'd also fill timeEntries array: rate_name, duration, description. This is more complex.
    // Let's simplify for this example and assume only one time entry for now
    // and that your form allows creating one without detailed rate selection first.
    // This part needs to align with your actual WorkItemForm structure.

    // 2. Interact with the Project EntityPicker
    const projectPickerButton = screen.getByRole("button", {
      name: /Project/i,
    });
    expect(projectPickerButton).toBeInTheDocument();
    await user.click(projectPickerButton);

    // 3. Modal opens - wait for it and its content
    // The modal title is defined in EntityPicker prop `modalTitle`
    expect(
      await screen.findByRole("heading", { name: /select project/i }),
    ).toBeInTheDocument();

    // Wait for the project list within the modal to appear
    // (based on the mockSelectedProject.name)
    const projectInModal = await screen.findByText(mockSelectedProject.name, {
      selector: "td",
    });
    expect(projectInModal).toBeInTheDocument();
    expect(
      screen.getByText(mockOtherProject.name, { selector: "td" }),
    ).toBeInTheDocument();

    // 4. (Optional) Simulate search within the modal
    const modalSearchInput = screen.getByPlaceholderText(/search projects.../i);
    await user.type(modalSearchInput, "Alpha");
    await waitFor(() => {
      expect(
        screen.getByText(mockSelectedProject.name, { selector: "td" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(mockOtherProject.name, { selector: "td" }),
      ).not.toBeInTheDocument();
    });

    // 5. Select the project
    // Find the "Select" button within the row of the desired project
    const projectRow = screen
      .getByText(mockSelectedProject.name, { selector: "td" })
      .closest("tr");
    const selectButtonInModal = within(projectRow).getByRole("button", {
      name: /select/i,
    });
    await user.click(selectButtonInModal);

    // 6. Verify modal closes and picker displays the selected project name
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /select project/i }),
      ).not.toBeInTheDocument(); // Modal closed
    });
    // The picker button itself should now show the selected project's name
    expect(projectPickerButton).toHaveTextContent(mockSelectedProject.name);

    await waitFor(() => {
      // Wait for modal to close and project name to appear
      expect(projectPickerButton).toHaveTextContent(mockSelectedProject.name);
    });
    // ----------------------------------------------------------------------------

    const rateDropdown = await screen.findByLabelText(/Rate/i);

    expect(rateDropdown).toBeInTheDocument();
    expect(rateDropdown).not.toBeDisabled(); // Ensure it's enabled after project load

    // Check if options are populated (wait for them)
    // The value of the option is the rate.name
    await waitFor(
      () => {
        // Option A: Wait for loading option to disappear
        expect(
          screen.queryByRole("option", { name: /Loading Rates.../i }),
        ).not.toBeInTheDocument();
        // Option B: Wait for a specific expected option to be present AND not disabled
        const devOption = screen.getByRole("option", {
          name: /Development/i,
        });
        expect(devOption).toBeInTheDocument();
        expect(devOption).not.toBeDisabled();
      },
      { timeout: 4000 },
    ); // Increase timeout if fetching is slow in test environment

    // --- 3. Simulate selecting an option ---
    // Method A: Select by the value attribute of the <option>
    // await user.selectOptions(rateDropdown, 'Development');

    // Method B: Select by the displayed text (more robust if value might change but text is stable)
    // You need to pass the <select> element and the <option> element you want to select.
    // Or pass the <select> element and the string/regex matching the displayed text of the option.
    await user.selectOptions(
      rateDropdown,
      screen.getByRole("option", { name: /Consulting \(€120.00\/hr\)/i }),
    );
    // --------------------------------------

    // --- 4. Verify the selection ---
    // Check the value of the select element
    expect(rateDropdown).toHaveValue("Consulting"); // Assumes 'Consulting' is the value
    // 7. Fill other necessary fields for time entries based on your form structure
    // This part is highly dependent on how you implemented the timeEntries field array.
    // Example for a single time entry:
    await user.type(screen.getByLabelText(/Duration \(hrs\)/i), "2.5");
    await user.type(
      screen.getByLabelText(/Description/i, { selector: "textarea" }),
      "Worked on feature X",
    );

    // 8. Click the main form submit button
    const mainSubmitButton = screen.getByRole("button", {
      name: /create Work Item/i,
    }); // Or "Save Time Entry"
    await user.click(mainSubmitButton);

    // 9. Wait for navigation (WorkItemListPage should render its title)
    // and successful API call (MSW handler for POST /workItems will run)
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /WorkItems/i }),
      ).toBeInTheDocument(); // Or "Time Entries"
    });
    // Check if the success alert (or your notification) was called
  });
});
