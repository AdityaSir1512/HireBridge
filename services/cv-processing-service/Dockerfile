FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p uploads/cv

EXPOSE 3006

CMD ["node", "server.js"]
