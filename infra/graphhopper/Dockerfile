FROM eclipse-temurin:25-jre-noble
ARG GRAPHHOPPER_VERSION=11.1
ADD https://github.com/graphhopper/graphhopper/releases/download/${GRAPHHOPPER_VERSION}/graphhopper-web-${GRAPHHOPPER_VERSION}.jar /app/graphhopper.jar
COPY config.yml foot_safe.json /config/
EXPOSE 8989
# The first start imports /data/france-latest.osm.pbf (about 20 min, 8 GB heap), later starts load the graph.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/graphhopper.jar server /config/config.yml"]
