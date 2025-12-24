# Stage 1: Build the React app
FROM node:20.11.0 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --force

COPY . .
RUN npm run build

# Stage 2: Serve the React app with Nginx
FROM nginx:1.17.1-alpine

# ✅ Correct path for React build output
COPY --from=build /app/build /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
ENTRYPOINT ["nginx", "-g", "daemon off;"]

