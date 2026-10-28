# Shadow Bot: a long-running Discord gateway worker. No HTTP port.
# Debian slim (glibc) so @napi-rs/canvas loads its prebuilt linux-x64-gnu binary.
FROM node:22-slim

WORKDIR /app

# Install deps first so code-only changes reuse the cached layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
