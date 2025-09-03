
# Stage 1: Build the Angular application
FROM node:20.11.0 AS build


WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm install --force

# Copy the application source code
COPY . .

# Build the Angular application
RUN npm run build

# Debug: List the contents of the build directory to ensure the build succeeded
#RUN ls -al /app/dist/enterprice/browser

# Stage 2: Serve the application with Nginx
FROM nginx:1.17.1-alpine

# Copy the built application from the previous stage
COPY --from=build /app/dist/browser /usr/share/nginx/html

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]
