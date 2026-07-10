# docker build -t formulus:cpp -f ./src/core/backtesting/rpc/dockerfiles/cpp.Dockerfile .
FROM gcc:13
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*
