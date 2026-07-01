FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir pyVmomi==8.0.3.0.1 --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY collectors/ ./collectors/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
