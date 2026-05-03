#!/bin/bash
set -e

if [ -f package.json ]; then
  npm install --no-audit --no-fund
fi

if [ -f server/package.json ]; then
  (cd server && npm install --no-audit --no-fund)
fi

if [ -f client/package.json ]; then
  (cd client && npm install --no-audit --no-fund)
fi
