# Immagine di order-service: compilazione e runtime separati, così l'immagine finale contiene solo il JRE e il jar.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
# Le dipendenze si scaricano in un livello a parte: si riusa finché il pom non cambia
RUN sh ./mvnw -B -q dependency:go-offline
COPY src src
RUN sh ./mvnw -B -q -DskipTests package && mv target/order-service-*.jar /app.jar

FROM eclipse-temurin:25-jre
RUN useradd --system --uid 10001 --no-create-home app
USER app
COPY --from=build /app.jar /app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app.jar"]
