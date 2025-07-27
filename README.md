# Instagram Comment Bot

Система автоматизации комментариев в Instagram с поиском по ключевым словам, анализом контента с помощью AI и эмуляцией человеческого поведения через Android эмулятор.

## Возможности

- 🔍 **Поиск по запросам** - Поиск reels в Instagram по ключевым словам
- 🤖 **Анализ ИИ** - Автоматический анализ релевантности контента для поиска работы
- 💬 **Генерация комментариев** - Создание персонализированных комментариев для рекламы сервиса автоответов
- 👤 **Эмуляция поведения** - Реалистичные задержки и действия через Android эмулятор
- ✅ **Модерация** - Ручное подтверждение перед публикацией комментариев
- 📊 **Мониторинг** - Реальное время отслеживания процесса скрапинга
- 📱 **Android автоматизация** - Использование настоящего Instagram приложения через эмулятор

## Технический стек

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **База данных**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT-4o
- **Автоматизация**: WebdriverIO + Appium + Android Emulator
- **Контейнеризация**: Docker + Docker Compose

## Установка и запуск

### Предварительные требования

- Docker и Docker Compose
- KVM поддержка на хост-системе (для Android эмулятора)
- Instagram APK файл

### Способ 1: Docker Compose (рекомендуется)

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

3. Скачайте Instagram APK:
   ```bash
   # Скачайте Instagram APK с APKMirror или APKPure
   # Сохраните как ./apks/instagram.apk
   mkdir -p apks
   # Загрузите APK в папку apks/
   ```

4. Запустите приложение:
   ```bash
   # Запуск всех сервисов
   docker-compose up -d
   
   # Проверка статуса
   docker-compose ps
   ```

5. Откройте веб-интерфейсы:
   - Приложение: http://localhost:5000
   - Android эмулятор (noVNC): http://localhost:6080

### Способ 2: Локальная разработка

1. Установите зависимости:
   ```bash
   npm install
   ```

2. Настройте базу данных PostgreSQL:
   ```bash
   # Создайте базу данных и обновите DATABASE_URL в .env
   npm run db:push
   ```

3. Запустите Android эмулятор с Appium:
   ```bash
   # Используйте Android Studio эмулятор или Docker
   docker run -d -p 4723:4723 -p 6080:6080 budtmo/docker-android-x86-11.0
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

# Перезапуск Android эмулятора
docker-compose restart android

# Подключение к Android через ADB
docker exec -it android_emulator adb shell
```

## Настройка

### Обязательные переменные окружения

- `OPENAI_API_KEY` - Ключ API OpenAI для анализа и генерации комментариев
- `DATABASE_URL` - Строка подключения к PostgreSQL

### Опциональные переменные

- `ANDROID_HOST` - Хост Android эмулятора (по умолчанию: localhost)
- `ANDROID_PORT` - Порт Appium сервера (по умолчанию: 4723)
- `NODE_ENV` - Режим работы (development/production)

### Установка Instagram в эмулятор

1. **Через веб-интерфейс** (http://localhost:6080):
   - Откройте браузер в эмуляторе
   - Скачайте Instagram APK
   - Установите через менеджер файлов

2. **Через API приложения**:
   - Положите APK в папку `./apks/`
   - Используйте кнопку "Install Instagram" в интерфейсе

3. **Через ADB**:
   ```bash
   docker cp ./apks/instagram.apk android_emulator:/tmp/
   docker exec android_emulator adb install /tmp/instagram.apk
   ```

### Авторизация в Instagram

1. Откройте Android эмулятор через noVNC (http://localhost:6080)
2. Запустите Instagram приложение
3. Войдите в свой аккаунт вручную
4. После входа можете использовать автоматизацию

## Использование

1. **Подключение к Android**: Нажмите "Connect to Android" в интерфейсе
2. **Проверка Instagram**: Убедитесь, что Instagram установлен и вы авторизованы
3. **Настройка промптов**: Отредактируйте системные промпты для анализа и генерации
4. **Запуск сессии**: Введите поисковый запрос и количество видео
5. **Модерация**: Просматривайте найденные видео и подтверждайте комментарии
6. **Публикация**: После подтверждения комментарии автоматически публикуются

## Архитектура проекта

```
├── client/                   # React frontend
├── server/                   # Express backend
│   ├── services/            # Сервисы
│   │   ├── appium.ts       # Android автоматизация
│   │   ├── openai.ts       # AI анализ
│   │   └── behavior.ts     # Эмуляция поведения
│   └── routes.ts           # API маршруты
├── shared/                  # Общие типы и схемы
├── apks/                    # APK файлы для установки
├── docker-compose.yml       # Docker конфигурация
└── Dockerfile              # Образ приложения
```

## API Endpoints

- `GET /api/health` - Проверка состояния приложения
- `GET /api/android/status` - Статус подключения к Android
- `POST /api/android/connect` - Подключение к Android эмулятору
- `POST /api/android/disconnect` - Отключение от Android
- `POST /api/android/install-instagram` - Установка Instagram APK
- `POST /api/android/launch-instagram` - Запуск Instagram
- `GET /api/videos` - Получение списка видео
- `POST /api/sessions/start` - Запуск сессии скрапинга
- `POST /api/videos/:id/approve` - Подтверждение комментария

## Безопасность

- Эмуляция человеческого поведения для избежания блокировок
- Использование настоящего Android приложения вместо веб-версии
- Контейнеризация для изоляции процессов
- Ручная модерация всех комментариев
- Реалистичные задержки между действиями

## Мониторинг

- WebSocket для обновлений в реальном времени
- noVNC для визуального контроля Android эмулятора
- Healthcheck endpoints для Docker
- Логирование всех операций
- Отслеживание статистики сессий

## Troubleshooting

### Android эмулятор не запускается
- Убедитесь, что KVM включен: `kvm-ok`
- Проверьте права: `ls -la /dev/kvm`
- Добавьте пользователя в группу kvm: `sudo usermod -aG kvm $USER`

### Instagram не устанавливается
- Проверьте совместимость APK с архитектурой эмулятора (x86)
- Используйте APK для Android 11 или ниже
- Убедитесь, что достаточно места в эмуляторе

### Appium не подключается
- Проверьте, что порт 4723 не занят
- Убедитесь, что APPIUM=true в environment эмулятора
- Проверьте логи: `docker logs android_emulator`

## Поддержка

Для вопросов и поддержки создайте issue в репозитории проекта.