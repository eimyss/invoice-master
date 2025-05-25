# RechnungMeister (InvoiceMaster) - Modern Invoicing Application

RechnungMeister is a modern, full-stack invoicing application designed for freelancers and small businesses to manage clients, projects, work items (time entries), and generate professional PDF invoices. It features a React/Tailwind CSS frontend and a Python FastAPI backend with MongoDB storage, along with Authentik integration for authentication.

## Features

- **Authentication:** Secure login via an external Authentik server (OIDC/OAuth2).
- **Multi-User Support:** Designed for individual freelancers or small teams.
- **Dashboard Overview:** At-a-glance view of key metrics like monthly hours, revenue, pending invoices.
- **Client Management:** CRUD operations for clients, including addresses, contact details, and VAT IDs (USt-IdNr.).
- **Project Management:** CRUD operations for projects, linkable to clients, with definable rates per project.
- **Work Item / Time Tracking:**
  - Log work items (time entries) against projects, specifying duration and selecting applicable rates.
  - (Future) Calendar overview for visualizing work logs.
- **Invoice Generation:**
  - Create invoices from selected uninvoiced work items for a client/project.
  - Automatic calculation of line items, subtotals, taxes (MwSt.), and grand totals.
  - Sequential and unique invoice numbering (e.g., RE-YYYY-NNNN).
  - **PDF Generation:** Creates professional, German-standard compliant PDF invoices.
  - Stores generated PDF with the invoice record in the database.
- **Invoice Management:**
  - List of all generated invoices with status (Draft, Sent, Paid, Overdue).
  - Track payment status.
- **Email Preparation:** Generates an email template with invoice details and attaches the PDF for easy sending to clients.
- **Event Logging:** Tracks key application events (e.g., invoice created, work item logged) for auditing or calendar display.
- **Modern UI:** Minimalist and responsive interface built with React and Tailwind CSS.
- **API:** Robust FastAPI backend providing a clear API for the frontend.
- **Extensible:** Designed with best practices to be easily extensible for future features.

## Tech Stack

**Frontend:**

- **React.js (with Vite):** For building the user interface.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **TanStack Query (React Query):** For server state management (data fetching, caching, mutations).
- **React Hook Form & Zod:** For form handling and validation.
- **React Router:** For client-side routing.
- **Axios:** For making HTTP requests to the backend.
- **MSW (Mock Service Worker):** For API mocking during frontend testing.
- **Vitest & React Testing Library:** For unit and integration testing.
- **(Libraries for UI components like Date Pickers, Modals, Charts - e.g., `react-datepicker`, `recharts`)**

**Backend:**

- **Python 3.10+**
- **FastAPI:** Modern, fast web framework for building APIs.
- **Pydantic:** For data validation and settings management.
- **Motor:** Asynchronous MongoDB driver.
- **Uvicorn:** ASGI server for running FastAPI.
- **python-jose & passlib:** For JWT handling (though primary auth is via Authentik).
- **WeasyPrint & Jinja2:** For PDF generation from HTML templates.
- **Pytest:** For backend testing.

**Database:**

- **MongoDB:** NoSQL document database.

**Authentication:**

- **Authentik:** External OpenID Connect (OIDC) / OAuth 2.0 provider.

**DevOps & Deployment (Planned):**

- **Docker & Docker Compose:** For containerization and local development setup.
- **Kubernetes (K8s):** For orchestration and deployment in a server environment.

## Project Structure

rechnung-meister/
├── backend/ # FastAPI backend application
│ ├── app/ # Main application code
│ │ ├── api/ # API endpoints (routers)
│ │ ├── core/ # Core logic (config, security, db connection)
│ │ ├── crud/ # CRUD operations for database interaction
│ │ ├── models/ # Pydantic models for data validation & schemas
│ │ ├── services/ # Business logic services (PDF gen, email, events)
│ │ └── templates/ # HTML templates for PDF generation
│ ├── tests/ # Backend tests
│ ├── .env.example
│ ├── Dockerfile
│ └── requirements.txt
│
├── frontend/ # React frontend application
│ ├── public/
│ ├── src/
│ │ ├── assets/
│ │ ├── components/ # Reusable UI components (generic)
│ │ ├── contexts/ # React contexts (e.g., AuthContext)
│ │ ├── features/ # Feature-specific components, pages, services
│ │ ├── hooks/ # Custom React hooks
│ │ ├── lib/ # Utility functions, API client setup
│ │ ├── mocks/ # MSW mocks for testing
│ │ ├── pages/ # Top-level page components (Dashboard, Login)
│ │ ├── services/ # API service functions
│ │ ├── setupTests.js # Test setup for Vitest
│ │ ├── App.jsx
│ │ └── main.jsx
│ ├── .env.example
│ ├── Dockerfile
│ ├── index.html
│ ├── package.json
│ └── vite.config.js
│
├── .gitignore
├── docker-compose.yml # For local development orchestration
└── README.md # This file

## Getting Started

### Prerequisites

- Node.js (v18+ recommended) and npm/yarn
- Python (v3.10+ recommended) and pip
- Docker and Docker Compose
- An instance of Authentik server (or willingness to mock auth for local dev without it)
- MongoDB instance (can be run via Docker Compose)

### Local Development Setup

1. **Clone the Repository:**

    ```bash
    git clone <your-repository-url>
    cd rechnung-meister
    ```

2. **Backend Setup:**

    - Navigate to the `backend` directory: `cd backend`
    - Create and activate a Python virtual environment:

      ```bash
      python -m venv venv
      source venv/bin/activate  # On Windows: venv\Scripts\activate
      ```

    - Install Python dependencies:

      ```bash
      pip install -r requirements.txt
      pip install -r requirements-dev.txt # For testing
      ```

    - Create a `.env` file from `.env.example` and fill in your details:

      ```bash
      cp .env.example .env
      # Edit .env with your MONGODB_URL, Authentik details, SECRET_KEY, etc.
      # For local Docker Compose MongoDB, MONGODB_URL is usually mongodb://mongo:27017/your_db_name
      ```

3. **Frontend Setup:**

    - Navigate to the `frontend` directory: `cd ../frontend`
    - Install Node.js dependencies:

      ```bash
      npm install
      ```

    - Create a `.env` file from `.env.example` and fill in your details:

      ```bash
      cp .env.example .env
      # Edit .env with VITE_API_BASE_URL (e.g., http://localhost:8000/api/v1)
      # and your VITE_AUTHENTIK_... URLs and Client ID.
      ```

4. **Run with Docker Compose (Recommended for easy DB setup):**

    - From the root `rechnung-meister/` directory:

      ```bash
      docker-compose up --build -d
      ```

    - This will start:
      - MongoDB on port 27017 (by default).
      - The FastAPI backend (usually on `http://localhost:8000`).
      - The React frontend dev server (usually on `http://localhost:5173`).
    - Access the frontend at `http://localhost:5173`.
    - Access backend API docs at `http://localhost:8000/docs`.

5. **Run Manually (If not using Docker Compose for backend/frontend dev servers):**
    - **Start MongoDB:** Ensure your MongoDB instance is running.
    - **Start Backend:**

      ```bash
      cd backend
      source venv/bin/activate
      # Set APP_ENV_FILE if you use specific .env files for local dev
      # export APP_ENV_FILE=.env.local
      uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
      ```

    - **Start Frontend:**

      ```bash
      cd frontend
      npm run dev
      ```

### Authentik Configuration

For authentication to work, you need to configure an Application and a Provider in your Authentik instance:

1. **Create an Application** in Authentik.
2. **Create an OAuth2/OIDC Provider** linked to this application.
    - **Client Type:** Public (for the React frontend).
    - **Redirect URIs:** Add `http://localhost:5173/auth/callback` (for local frontend dev) and any other URIs for deployed environments.
    - **Scopes:** Ensure `openid`, `email`, `profile`, and `offline_access` (if you want refresh tokens directly on frontend, though BFF is recommended) are enabled.
    - Note the **Client ID**.
    - Note the **OpenID Configuration URL** (e.g., `https://authentik.yourdomain.com/application/o/your-app-slug/.well-known/openid-configuration`). This will give you the `authorization_endpoint`, `token_endpoint`, `jwks_uri`, and `issuer`.
3. Update your frontend (`.env`) and backend (`.env`) files with the correct Authentik URLs, Client ID, and Issuer.
4. For the **Backend-for-Frontend (BFF) token exchange pattern**, your backend will also act as an OAuth2 client (potentially with the same Client ID if it's public, or a separate confidential Client ID and Secret). Ensure the `redirect_uri` used by the backend in the token exchange request matches one configured in Authentik.

## Running Tests

### Backend Tests

- Ensure your test MongoDB is accessible.
- Navigate to the `backend` directory.
- Activate the virtual environment.
- Run:

  ```bash
  python -m pytest
  # Or just:
  # pytest
  ```

### Frontend Tests

- Navigate to the `frontend` directory.
- Run:

  ```bash
  npm test
  # For UI mode (if @vitest/ui is installed):
  # npm run test:ui
  # For coverage:
  # npm run coverage
  ```

## PDF Invoice Templates

- PDFs are generated from HTML templates using WeasyPrint.
- Default templates are located in `backend/app/templates/`.
- You can customize `invoice_default.html` and `invoice_style.css` or create new templates.
- The `template_id` field on the `Invoice` model can be used to specify which template to use for rendering a particular invoice (future enhancement).

## Contributing

TODO

## License

## TODO
