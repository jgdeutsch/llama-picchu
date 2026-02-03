# Llama Picchu MUD - Docker Container
FROM node:20-slim

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

# Initialize database
RUN npm run db:init && npm run db:seed

# Expose telnet port
EXPOSE 4000

# Run telnet server
CMD ["npx", "tsx", "server/telnet.ts"]
