#!/bin/bash
# Script de despliegue para el servicio de scheduler en Cloud Run

set -e  # Salir en caso de error

echo "======================================"
echo " Despliegue de Scheduler Service"
echo "======================================"

# Variables
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-tu-proyecto-id}"
REGION="${REGION:-europe-west1}"
SERVICE_NAME="scheduler-service"
FIREBASE_DATABASE_URL="${FIREBASE_DATABASE_URL:-https://tu-proyecto.firebaseio.com}"

echo ""
echo "Configuración:"
echo "  - Proyecto: $PROJECT_ID"
echo "  - Región: $REGION"
echo "  - Servicio: $SERVICE_NAME"
echo "  - Firebase DB URL: $FIREBASE_DATABASE_URL"
echo ""

# Confirmar
read -p "¿Continuar con el despliegue? (s/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "Despliegue cancelado."
    exit 1
fi

echo ""
echo "[1/3] Configurando proyecto de gcloud..."
gcloud config set project $PROJECT_ID

echo ""
echo "[2/3] Construyendo y desplegando a Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars FIREBASE_DATABASE_URL=$FIREBASE_DATABASE_URL

echo ""
echo "[3/3] Obteniendo URL del servicio..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')

echo ""
echo "======================================"
echo " ✅ Despliegue completado exitosamente!"
echo "======================================"
echo ""
echo "URL del servicio: $SERVICE_URL"
echo ""
echo "Próximos pasos:"
echo "  1. Probar el health check:"
echo "     curl $SERVICE_URL/health"
echo ""
echo "  2. Configurar la URL en Firebase Functions (.env):"
echo "     SCHEDULER_SERVICE_URL=$SERVICE_URL"
echo ""
echo "  3. Redesplegar las Firebase Functions:"
echo "     cd ../functions && firebase deploy --only functions"
echo ""
