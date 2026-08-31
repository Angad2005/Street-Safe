# ==========================================
# STAGE 1: Build & Compile TypeScript
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /usr/src/app

# Install build tools required to compile native C++ addons (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package management and TypeScript config files
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the backend source code
COPY . .

# Compile TypeScript into JavaScript (dist/ folder)
RUN npm run build

# Prune development dependencies
RUN npm prune --omit=dev


# ==========================================
# STAGE 2: Secure & Lightweight Production Runtime
# ==========================================
FROM node:22-bookworm-slim

WORKDIR /usr/src/app

# Set to production mode
ENV NODE_ENV=production

# Copy package.json AND tsconfig.json (required by tsconfig-paths/register)
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/tsconfig.json ./tsconfig.json

# Copy production node_modules, compiled output, and priv assets
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/priv ./priv

# Create data directory for database
RUN mkdir -p ./data

# Ensure runtime user has ownership for SQLite writes and runtime operations
RUN chown -R node:node /usr/src/app

# Run the container as a non-privileged user for security
USER node

# Expose the Express port
EXPOSE 8080

# FIX 2: Tell tsconfig-paths to resolve aliases inside the dist folder instead of src
ENV TS_NODE_BASEURL=./dist

# Run the app with path mapping registered
CMD ["node", "-r", "tsconfig-paths/register", "dist/src/index.js"]
