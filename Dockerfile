# Use Node.js 18 with Playwright dependencies pre-installed
FROM mcr.microsoft.com/playwright:v1.56.1-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Install Playwright browsers (already has system deps from base image)
RUN npx playwright install chromium

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js application
RUN npm run build

# Expose port (Render assigns this dynamically)
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
