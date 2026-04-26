# Rhea Server Dockerfile
# Optimize for running rhea-cli-server in a containerized environment.

FROM node:20-slim

# Install SSH client (required for RPC)
RUN apt-get update && apt-get install -y openssh-client && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root and workspace package files
COPY package.json package-lock.json ./
COPY lib/package.json ./lib/
COPY cli/package.json ./cli/
COPY mcp/package.json ./mcp/

# Install dependencies
RUN npm install

# Copy source code and config
COPY . .

# Build all workspaces
RUN npm run build

# Ensure binaries are executable
RUN chmod +x cli/dist/*.js

# Expose daemon port
EXPOSE 8787

# Set environment variables (Placeholders - should be passed at runtime)
ENV OPENROUTER_API_KEY=""
ENV NVIDIA_NIM_API_KEY=""

# Default to running the daemon
ENTRYPOINT ["node", "cli/dist/rhea-cli-server.js", "daemon", "8787"]
