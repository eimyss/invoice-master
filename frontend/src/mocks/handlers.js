// frontend/src/mocks/handlers.js
import { http, HttpResponse } from "msw"; // Using http object from msw v2+

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

// Store mock data here (can be more sophisticated)
let mockClients = [
  {
    id: "1",
    name: "Mock Client Alpha",
    email: "alpha@mock.com",
    user_id: "mock-user-123",
  },
  {
    id: "2",
    name: "Mock Client Beta",
    email: "beta@mock.com",
    user_id: "mock-user-123",
  },
];
let nextClientId = 3;

export const handlers = [
  // Mock GET /clients
  http.get(`${API_BASE_URL}/clients`, ({ request }) => {
    const url = new URL(request.url);
    const searchTerm = url.searchParams.get("search") || "";
    const filteredClients = mockClients.filter((client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    console.log(
      "[MSW] GET /clients - search:",
      searchTerm,
      "result:",
      filteredClients,
    );
    return HttpResponse.json(filteredClients);
  }),

  // Mock POST /clients
  http.post(`${API_BASE_URL}/clients`, async ({ request }) => {
    const newClientData = await request.json();
    console.log("[MSW] POST /clients - received:", newClientData);

    // Basic validation simulation (real validation is by backend Pydantic/Zod)
    if (!newClientData.name) {
      return HttpResponse.json(
        {
          detail: [
            { loc: ["body", "name"], msg: "Field required", type: "missing" },
          ],
        },
        { status: 422 },
      );
    }

    const client = {
      id: String(nextClientId++),
      user_id: "mock-user-123", // Assume a mock user
      ...newClientData, // Spread incoming data
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockClients.push(client);
    console.log("[MSW] POST /clients - created:", client);
    return HttpResponse.json(client, { status: 201 });
  }),

  // Mock GET /clients/:clientId
  http.get(`${API_BASE_URL}/clients/:clientId`, ({ params }) => {
    const { clientId } = params;
    const client = mockClients.find((c) => c.id === clientId);
    console.log(
      "[MSW] GET /clients/:clientId - id:",
      clientId,
      "found:",
      client,
    );
    if (client) {
      return HttpResponse.json(client);
    }
    return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
  }),

  // Mock PUT /clients/:clientId
  http.put(`${API_BASE_URL}/clients/:clientId`, async ({ request, params }) => {
    const { clientId } = params;
    const updates = await request.json();
    console.log(
      "[MSW] PUT /clients/:clientId - id:",
      clientId,
      "updates:",
      updates,
    );
    const clientIndex = mockClients.findIndex((c) => c.id === clientId);
    if (clientIndex > -1) {
      mockClients[clientIndex] = {
        ...mockClients[clientIndex],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      console.log(
        "[MSW] PUT /clients/:clientId - updated client:",
        mockClients[clientIndex],
      );
      return HttpResponse.json(mockClients[clientIndex]);
    }
    return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
  }),

  // Mock DELETE /clients/:clientId
  http.delete(`${API_BASE_URL}/clients/:clientId`, ({ params }) => {
    const { clientId } = params;
    console.log("[MSW] DELETE /clients/:clientId - id:", clientId);
    const initialLength = mockClients.length;
    mockClients = mockClients.filter((c) => c.id !== clientId);
    if (mockClients.length < initialLength) {
      console.log("[MSW] DELETE /clients/:clientId - success");
      return new HttpResponse(null, { status: 204 }); // No content
    }
    return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
  }),
];

// Helper to reset mock data between tests if needed
export const resetMockClients = () => {
  mockClients = [
    {
      id: "1",
      name: "Mock Client Alpha",
      email: "alpha@mock.com",
      user_id: "mock-user-123",
    },
    {
      id: "2",
      name: "Mock Client Beta",
      email: "beta@mock.com",
      user_id: "mock-user-123",
    },
  ];
  nextClientId = 3;
};
