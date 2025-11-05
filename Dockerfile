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

# Set dummy environment variables for build (required by Next.js)
# Real values will be provided at runtime by Render
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ARG NEXTAUTH_SECRET=dummy-build-secret-min-32-chars-long-12345
ARG OPENAI_API_KEY=sk-dummy-build-key
ARG GOOGLE_CLIENT_ID=dummy
ARG GOOGLE_CLIENT_SECRET=dummy
ARG ENCRYPTION_KEY=dummy-encryption-key-min-32-chars

# Build Next.js application with dummy env vars
ENV DATABASE_URL=$DATABASE_URL \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
    OPENAI_API_KEY=$OPENAI_API_KEY \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
    GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
    ENCRYPTION_KEY=$ENCRYPTION_KEY \
    NODE_ENV=production

RUN npm run build

# Expose port (Render assigns this dynamically)
EXPOSE 3000

# Start the application (real env vars from Render will override build-time dummies)
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
