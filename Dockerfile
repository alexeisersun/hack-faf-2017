FROM node:8.9.1

WORKDIR /app

COPY . .

RUN npm install
