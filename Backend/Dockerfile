# ==========================================
# STAGE 1: Build & Compile TypeScript
# ==========================================
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Install build tools required to compile native C++ addons (like better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package management files
COPY package*.json tsconfig.json ./

# Install ALL dependencies (including devDependencies like typescript)
RUN npm ci

# Copy the rest of your backend source code
COPY . .

# Compile TypeScript into JavaScript (dist/ folder)
RUN npm run build

# Prune development dependencies (removes typescript, dev types, etc.)
RUN npm prune --production


# ==========================================
# STAGE 2: Secure & Lightweight Production Runtime
# ==========================================
FROM node:18-slim

WORKDIR /usr/src/app

# Set to production mode
ENV NODE_ENV=production

# Copy built artifacts and production dependencies from builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

# Copy required static asset directories
COPY --from=builder /usr/src/app/data ./data

# Ensure runtime user has ownership of the application directory (needed for SQLite writes)
RUN chown -R node:node /usr/src/app

# Run the container as a non-privileged user for security
USER node

# Expose the Express port (matches your configuration file port)
EXPOSE 5000

# Run the app exactly how your start script dictates, mapping runtime modules
CMD ["node", "-r", "tsconfig-paths/register", "dist/src/index.js"]
