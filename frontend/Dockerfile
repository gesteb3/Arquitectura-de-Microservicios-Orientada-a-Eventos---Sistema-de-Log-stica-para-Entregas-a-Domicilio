FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

  frontend:
    build:
      context: ./frontend
    container_name: logistics-frontend
    restart: unless-stopped
    depends_on:
      - order-service
    environment:
      VITE_API_URL: http://localhost:3000
    ports:
      - "8080:5173"