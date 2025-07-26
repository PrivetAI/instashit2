# Dockerfile для разработки
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Экспонируем порт для сервера
EXPOSE 5000

# Запускаем в dev режиме
CMD ["npm", "run", "dev"]