# Stage 1: deps & build (if needed)
FROM node:18-alpine AS build

# Install build-time utilities (git, python if building native modules)
RUN apk add --no-cache --virtual .build-deps git python3 make g++ \
 && npm config set loglevel warn

WORKDIR /usr/src/app

# Copy package metadata first for Docker layer caching
COPY package.json package-lock.json* ./

# Install dependencies (production only in final stage). We want dev deps if you have builds
RUN npm ci

# Copy app source
COPY . .

# If you had a build step (e.g. transpile), run it here.
# RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: runtime image
FROM node:18-alpine AS runtime

# Add tini (init) to handle signals and orphaned processes
RUN apk add --no-cache tini

WORKDIR /usr/src/app

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only the necessary artifacts from build stage
# (node_modules + app source)
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app ./

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Use tini as PID 1 and run as non-root
USER appuser

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]

