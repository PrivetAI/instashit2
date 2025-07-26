-- Инициализация базы данных для Instagram Scraper
CREATE DATABASE IF NOT EXISTS instagram_scraper;

-- Создание пользователя для приложения (если нужно)
-- CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'app_password';
-- GRANT ALL PRIVILEGES ON instagram_scraper.* TO 'app_user'@'%';

-- Подключение к базе данных
\c instagram_scraper;

-- Создание расширений, если нужно
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- База данных будет создана автоматически через Drizzle migrations при запуске приложения