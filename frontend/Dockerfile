FROM node:20-alpine AS base
WORKDIR /usr/local/app

FROM base AS frontend-dev
COPY package*.json ./
# If package-lock isn't generated yet, npm install will generate it.
RUN npm install --include=dev
COPY . .
# Ionic react dev server via Vite
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

FROM base AS build-env
COPY package*.json ./
RUN npm install 
COPY . .
RUN npm run build

# FROM nginx:alpine AS production
# COPY --from=build-env /usr/local/app/dist /usr/share/nginx/html
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]
