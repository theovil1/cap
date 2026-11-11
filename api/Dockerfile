# Build stage: dependencies are compiled in their own layer for faster rebuilds.
FROM rust:1.99.1-trixie AS build
WORKDIR /src
ENV SQLX_OFFLINE=true
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && echo "" > src/lib.rs \
    && cargo build --release --locked \
    && rm -rf src
COPY . .
RUN touch src/main.rs src/lib.rs && cargo build --release --locked

# Runtime stage: small image, non-root user.
FROM debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 cap
COPY --from=build /src/target/release/cap-api /usr/local/bin/cap-api
USER cap
EXPOSE 8080
ENTRYPOINT ["cap-api"]
