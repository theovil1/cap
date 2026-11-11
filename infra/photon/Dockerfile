FROM eclipse-temurin:25-jre-noble
ARG PHOTON_VERSION=1.3.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl zstd \
    && rm -rf /var/lib/apt/lists/*
ADD https://github.com/komoot/photon/releases/download/${PHOTON_VERSION}/photon-${PHOTON_VERSION}.jar /app/photon.jar
COPY import.sh /app/import.sh
EXPOSE 2322
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/photon.jar serve -data-dir /data -listen-ip 0.0.0.0 -listen-port 2322"]
