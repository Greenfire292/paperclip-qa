FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /work/qa

COPY qa/package.json ./package.json
RUN npm install

COPY qa/ ./
COPY docker/qa-capture/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV CI=1
ENV BASE_URL=http://crownforge-app:4173
ENV ARTIFACT_DIR=/artifacts

ENTRYPOINT ["/entrypoint.sh"]
