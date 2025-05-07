from fastapi import APIRouter

# Import endpoint routers
from .endpoints import clients, auth, projects, workItems, invoices
# Import other endpoint modules here (e.g., projects, invoices)


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_router.include_router(workItems.router, prefix="/workItems", tags=["WorkItems"])
api_router.include_router(
    invoices.router, prefix="/invoices", tags=["Invoices"]
)  # Add invoices
api_router.include_router(
    projects.router, prefix="/projects", tags=["Projects"]
)  # Add projects
# api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
# api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
# Add authentication routes if needed (e.g., /auth for token info or logout)
