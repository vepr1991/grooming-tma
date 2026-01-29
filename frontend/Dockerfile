# frontend/Dockerfile

# Используем легкий Node.js
FROM node:18-alpine

# Рабочая папка внутри контейнера
WORKDIR /app

# Копируем файлы package.json
COPY package.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной код
COPY . .

# Открываем порт 3000
EXPOSE 3000

# Запускаем Vite (с флагом --host, чтобы был доступен снаружи)
CMD ["npm", "run", "dev", "--", "--host"]