# Usar imagen base de Python
FROM python:3.11-slim

# Establecer directorio de trabajo
WORKDIR /app

# Copiar requirements primero para aprovechar cache de Docker
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 8080

# Variable de entorno para producción
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Comando para ejecutar la aplicación con Gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 300 main:app
