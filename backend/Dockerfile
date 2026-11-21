FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
ENV PORT=3000 DATA_FILE=/data/db.json
EXPOSE 3000
CMD ["node", "src/server.js"]
