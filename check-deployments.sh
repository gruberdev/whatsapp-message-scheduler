#!/bin/bash

# WhatsApp Message Scheduler - Deployment Status Checker
echo "🚀 Checking WhatsApp Message Scheduler Deployments..."
echo "=================================================="

# Backend (Railway)
echo "📡 Backend (Railway):"
echo "URL: https://whatsapp-message-scheduler-production.up.railway.app/api"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://whatsapp-message-scheduler-production.up.railway.app/api")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend is UP (Status: $BACKEND_STATUS)"
else
    echo "❌ Backend is DOWN (Status: $BACKEND_STATUS)"
fi

# Test backend API endpoint
echo "🔍 Testing backend API..."
SESSIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://whatsapp-message-scheduler-production.up.railway.app/api/whatsapp/sessions")
if [ "$SESSIONS_STATUS" = "200" ]; then
    echo "✅ Sessions API is working (Status: $SESSIONS_STATUS)"
else
    echo "❌ Sessions API failed (Status: $SESSIONS_STATUS)"
fi

echo ""

# Frontend (Vercel)
echo "🌐 Frontend (Vercel):"
echo "URL: https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app"
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is UP (Status: $FRONTEND_STATUS)"
else
    echo "❌ Frontend is DOWN (Status: $FRONTEND_STATUS)"
fi

echo ""
echo "=================================================="
echo "🎉 Deployment check complete!"
echo ""
echo "📱 Access your app: https://whatsapp-message-scheduler-phc02ouo8-dibpuelmas-projects.vercel.app"
echo "📡 API Documentation: https://whatsapp-message-scheduler-production.up.railway.app/api" 