FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN mkdir -p /app/storage/documentos /app/logs
EXPOSE 3001
CMD ["node", "src/server.js"]
