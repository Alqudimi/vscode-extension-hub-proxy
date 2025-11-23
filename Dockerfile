FROM node:20-slim
WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN npm install --production

COPY . .

ENV PORT=8080
CMD ["node", "server.js"]
