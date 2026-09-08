FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

RUN mkdir -p /app/uploads

EXPOSE 3000

CMD ["node", "dist/index.js"]
