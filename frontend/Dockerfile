# Stage 1: Build the React app
FROM node:18-alpine as build-stage

WORKDIR /app

COPY package*.json ./

# Use ci for potentially faster/more reliable installs in CI/CD
RUN npm ci

COPY . .

# Set build-time args from environment variables
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_AUTHENTIK_URL
ENV VITE_AUTHENTIK_URL=$VITE_AUTHENTIK_URL
ARG VITE_AUTHENTIK_AUTHORIZE_URL
ENV VITE_AUTHENTIK_AUTHORIZE_URL=$VITE_AUTHENTIK_AUTHORIZE_URL
ARG VITE_AUTHENTIK_CLIENT_ID
ENV VITE_AUTHENTIK_CLIENT_ID=$VITE_AUTHENTIK_CLIENT_ID
ARG VITE_AUTHENTIK_REDIRECT_URI
ENV VITE_AUTHENTIK_REDIRECT_URI=$VITE_AUTHENTIK_REDIRECT_URI
ARG VITE_AUTHENTIK_SCOPE
ENV VITE_AUTHENTIK_SCOPE=$VITE_AUTHENTIK_SCOPE


# Build the application
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:stable-alpine

# Copy built files from build stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Copy nginx config for SPA routing
# Create this file if needed: frontend/nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
