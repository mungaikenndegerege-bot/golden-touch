# ── Stage 1: Build the fat JAR ──────────────────────────────────────────────
FROM eclipse-temurin:11-jdk AS builder

WORKDIR /build

# Copy source and dependencies
COPY src/  ./src/
COPY lib/  ./lib/
COPY web/  ./web/

# Compile Java sources
RUN mkdir -p out && \
    javac -cp "lib/*" -d out \
      src/golden/touch/ShopData.java \
      src/golden/touch/ShopApiServer.java

# Copy web assets into classpath root so Javalin serves them from /web
RUN cp -r web out/web

# Extract all dependency JARs flat into out/
WORKDIR /build/out
RUN for jar in /build/lib/*.jar; do jar xf "$jar"; done && \
    find . -name "module-info.class" -delete

# Write manifest and create fat JAR
RUN echo "Main-Class: golden.touch.ShopApiServer" > MANIFEST.MF && \
    jar cfm /build/GoldenTouch.jar MANIFEST.MF -C /build/out .

# ── Stage 2: Minimal runtime image ──────────────────────────────────────────
FROM eclipse-temurin:11-jre

WORKDIR /app

COPY --from=builder /build/GoldenTouch.jar ./GoldenTouch.jar

# DATA_DIR — mount a Railway persistent volume here so data survives redeploys
ENV DATA_DIR=/app/data
ENV PORT=8080

RUN mkdir -p /app/data

EXPOSE 8080

CMD ["java", "-jar", "GoldenTouch.jar"]
