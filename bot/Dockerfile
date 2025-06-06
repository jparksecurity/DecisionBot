FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create directory for audio files
RUN mkdir -p /tmp/meet

# Install FFmpeg for audio processing
RUN apk add --no-cache ffmpeg

# Expose health check port (optional)
EXPOSE 3000

# Run the bot
CMD ["npm", "start"]