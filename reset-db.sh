#!/bin/bash
# Reset database and re-seed
set -e
echo "🔄 Reset database..."
cd backend
npx prisma migrate reset --force
npx ts-node prisma/seed.ts
echo "✅ Database resettato e riseedato"
