from fastapi import APIRouter

# Import endpoint routers
from .endpoints import clients
# Import other endpoint modules here (e.g., projects, invoices)

api_router = APIRouter()

# Include routers from endpoint modules
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
# api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
# api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
# Add authentication routes if needed (e.g., /auth for token info or logout)
