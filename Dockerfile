# Stage 1: Build React app
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy build files
COPY --from=build /app/build /usr/share/nginx/html

# Copy template
COPY public/env-config.template.js /usr/share/nginx/html/env-config.template.js

# Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Install envsubst
RUN apk add --no-cache gettext

# Generate runtime env-config.js then start Nginx
CMD ["nginx", "-g", "daemon off;"]

EXPOSE 80
