# Instagram Comment Bot

Система автоматизации комментариев в Instagram с поиском по ключевым словам, анализом контента с помощью AI и эмуляцией человеческого поведения.

## Возможности

- 🔍 **Поиск по запросам** - Поиск reels в Instagram по ключевым словам
- 🤖 **Анализ ИИ** - Автоматический анализ релевантности контента для поиска работы
- 💬 **Генерация комментариев** - Создание персонализированных комментариев для рекламы сервиса автоответов
- 👤 **Эмуляция поведения** - Реалистичные задержки и действия для избежания блокировок
- ✅ **Модерация** - Ручное подтверждение перед публикацией комментариев
- 📊 **Мониторинг** - Реальное время отслеживания процесса скрапинга

## Технический стек

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **База данных**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT-4o
- **Скрапинг**: Puppeteer + Chrome debugging
- **Контейнеризация**: Docker + Docker Compose

## Установка и запуск

### Способ 1: Разработка на Replit (рекомендуется)

1. Установите зависимости (автоматически)
2. Добавьте `OPENAI_API_KEY` в секреты Replit
3. Запустите Chrome с отладкой:
   ```bash
   google-chrome --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage
   ```
4. Нажмите "Run" или выполните `npm run dev`

### Способ 2: Docker Compose (продакшн)

1. Клонируйте репозиторий:
   ```bash
   git clone <repository-url>
   cd instagram-comment-bot
   ```

2. Создайте файл `.env`:
   ```bash
   cp .env.example .env
   # Отредактируйте .env файл, добавьте OPENAI_API_KEY
   ```

3. Запустите приложение:
   ```bash
   # Продакшн (с приложением)
   docker-compose up -d
   
   # Только инфраструктура для разработки
   docker-compose -f docker-compose.dev.yml up -d
   ```

### Способ 3: Локальная разработка

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Настройте базу данных PostgreSQL:
   ```bash
   # Создайте базу данных и обновите DATABASE_URL в .env
   npm run db:push
   ```

3. Запустите Chrome с отладкой:
   ```bash
   google-chrome --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage
   ```

4. Запустите приложение:
   ```bash
   npm run dev
   ```

## Docker команды

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down

# Только инфраструктура (для разработки)
docker-compose -f docker-compose.dev.yml up -d
```

## Настройка

### Обязательные переменные окружения

- `OPENAI_API_KEY` - Ключ API OpenAI для анализа и генерации комментариев
- `DATABASE_URL` - Строка подключения к PostgreSQL

### Опциональные переменные

- `CHROME_DEBUG_PORT` - Порт для подключения к Chrome (по умолчанию: 9222)
- `CHROME_DEBUG_HOST` - Хост Chrome для Docker (по умолчанию: localhost)
- `NODE_ENV` - Режим работы (development/production)

### Настройка Chrome

Для работы скрапинга необходимо запустить Chrome с отладкой:

```bash
# Linux/macOS
google-chrome --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage

# Windows
chrome.exe --remote-debugging-port=9222 --no-sandbox --disable-dev-shm-usage
```

## Использование

1. **Подключение к Chrome**: Убедитесь, что Chrome запущен с отладкой
2. **Настройка промптов**: Отредактируйте системные промпты для анализа и генерации
3. **Запуск сессии**: Введите поисковый запрос и количество видео
4. **Модерация**: Просматривайте найденные видео и подтверждайте комментарии
5. **Публикация**: После подтверждения комментарии автоматически публикуются

## Архитектура проекта

```
├── client/           # React frontend
├── server/           # Express backend
│   ├── services/     # Сервисы (Puppeteer, OpenAI)
│   └── routes.ts     # API маршруты
├── shared/           # Общие типы и схемы
├── docker-compose.yml        # Продакшн
├── docker-compose.dev.yml    # Разработка
└── Dockerfile        # Образ приложения
```

## API Endpoints

- `GET /api/health` - Проверка состояния приложения
- `GET /api/videos` - Получение списка видео
- `POST /api/sessions/start` - Запуск сессии скрапинга
- `POST /api/chrome/connect` - Подключение к Chrome
- `POST /api/videos/:id/approve` - Подтверждение комментария

## Безопасность

- Эмуляция человеческого поведения для избежания блокировок
- Контейнеризация для изоляции процессов
- Проверка подключения к Chrome перед скрапингом
- Ручная модерация всех комментариев

## Мониторинг

Приложение включает:
- WebSocket для обновлений в реальном времени
- Healthcheck endpoints для Docker
- Логирование всех операций
- Отслеживание статистики сессий

## Поддержка

Для вопросов и поддержки создайте issue в репозитории проекта.