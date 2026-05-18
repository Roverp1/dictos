# Use official Bun image
FROM oven/bun:latest

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy application code
COPY . .

# Expose port (adjust to your app's port)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "dev:server"]
