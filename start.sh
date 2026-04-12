#!/bin/sh
echo "[startup] Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy 2>&1 || echo "[startup] WARNING: Migration failed — check logs"
echo "[startup] Starting server..."
exec node server.js
