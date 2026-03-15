#!/bin/bash
set -e

echo "🚀 CRM Helpdesk - Avvio sistema..."
echo ""

# Check dependencies
if ! command -v docker &> /dev/null; then
  echo "❌ Docker non trovato. Installa Docker Desktop da https://www.docker.com"
  exit 1
fi

if ! command -v node &> /dev/null; then
  echo "❌ Node.js non trovato. Installa Node.js 20+ da https://nodejs.org"
  exit 1
fi

# Start databases
echo "📦 Avvio PostgreSQL e Redis..."
docker compose up -d postgres redis

echo "⏳ Attendo che i database siano pronti..."
sleep 5

# Check postgres
until docker compose exec -T postgres pg_isready -U crm_user -d crm_db 2>/dev/null; do
  echo "  PostgreSQL non ancora pronto, attendo..."
  sleep 2
done
echo "  ✅ PostgreSQL pronto"

# Check redis
until docker compose exec -T redis redis-cli -a crm_redis_secret ping 2>/dev/null | grep -q PONG; do
  echo "  Redis non ancora pronto, attendo..."
  sleep 2
done
echo "  ✅ Redis pronto"
echo ""

# Backend setup
echo "🔧 Installazione dipendenze backend..."
cd backend
npm install --silent

echo "🗄️  Generazione Prisma client..."
npx prisma generate --silent

echo "🗄️  Migrazione database..."
npx prisma migrate deploy

echo "🌱 Seeding dati demo..."
npx ts-node prisma/seed.ts

echo ""
echo "🔧 Installazione dipendenze frontend..."
cd ../frontend
npm install --silent

cd ..

echo ""
echo "════════════════════════════════════════"
echo "✅ Setup completato! Avvio applicazione..."
echo "════════════════════════════════════════"
echo ""

# Start backend and frontend in parallel
echo "🚀 Avvio backend (porta 3001)..."
cd backend && npm run start:dev &
BACKEND_PID=$!

sleep 3

echo "🚀 Avvio frontend (porta 3000)..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "════════════════════════════════════════════════"
echo "🎉 CRM Helpdesk in esecuzione!"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001/api"
echo "  Swagger:   http://localhost:3001/api/docs"
echo ""
echo "  Credenziali admin: admin@demo.com / Password123!"
echo "  Credenziali agente: marco.bianchi@demo.com / Password123!"
echo ""
echo "  Premi Ctrl+C per fermare"
echo "════════════════════════════════════════════════"
echo ""

# Wait for processes
wait $BACKEND_PID $FRONTEND_PID
