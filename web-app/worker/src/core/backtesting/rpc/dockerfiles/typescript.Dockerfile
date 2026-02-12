# docker build -t formulus:typescript -f ./src/core/backtesting/rpc/dockerfiles/typescript.Dockerfile .
FROM node:24-slim
WORKDIR /app
RUN npm install -g tsx
RUN npm install -D @types/node
