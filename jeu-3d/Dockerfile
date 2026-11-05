FROM node:22-slim
WORKDIR /app
# Overture Maps (bâtiments et lieux en plus d'OpenStreetMap) : facultatif, le jeu marche sans
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && pip3 install --break-system-packages --no-cache-dir overturemaps && rm -rf /var/lib/apt/lists/* || echo 'Overture non installé (ignoré)'
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=3000 DATA_DIR=/data
VOLUME /data
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server/server.js"]
