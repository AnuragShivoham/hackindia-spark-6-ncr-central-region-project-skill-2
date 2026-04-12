FROM node:22-alpine

# Install dependencies required to compile native Node.js modules like `node-pty`
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

# Copy package info and install production dependencies
COPY package*.json ./
RUN npm install --production

# Copy application source code
COPY src ./src

# Create necessary directories for volumes
RUN mkdir -p data workspace

EXPOSE 3001
ENV NODE_ENV=production

# Start the server
CMD ["node", "src/server.js"]
