# Immagine di notification-service: compilazione e runtime separati, così l'immagine finale contiene solo il JRE e il jar.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sh ./mvnw -B -q dependency:go-offline
COPY src src
RUN sh ./mvnw -B -q -DskipTests package && mv target/notification-service-*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 --no-create-home app
USER app
COPY --from=build /app.jar /app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app.jar"]
