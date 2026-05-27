FROM node:22-alpine3.23

WORKDIR /app

COPY package*.json .
RUN npm install --only=production

COPY . .
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

USER nodejs
EXPOSE 3001

CMD ["npm", "start"]