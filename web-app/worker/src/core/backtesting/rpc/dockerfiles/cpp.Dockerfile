# docker build -t formulus:cpp -f ./src/core/backtesting/rpc/dockerfiles/cpp.Dockerfile .
FROM gcc:13
WORKDIR /app
