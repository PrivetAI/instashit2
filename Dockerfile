# Простой Dockerfile для разработки
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Экспонируем порт для dev сервера
EXPOSE 3000

# Запускаем в dev режиме
CMD ["npm", "dev"]