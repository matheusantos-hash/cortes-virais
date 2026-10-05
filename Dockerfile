# Worker de cortes virais — imagem para o Railway
FROM node:22-bookworm-slim

# ffmpeg (cortes) + python3 (necessário para o yt-dlp) + curl/certificados + fontes para legendas (libass) + aria2 (downloads paralelos)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-opencv curl ca-certificates \
    fontconfig fonts-liberation fonts-dejavu-core aria2 \
 && rm -rf /var/lib/apt/lists/*

# yt-dlp
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Copia package.json do worker e instala dependências
COPY worker/package*.json ./
RUN npm install --no-audit --no-fund

# Copia o restante do código do worker
COPY worker/ .

ENV NODE_ENV=production

# Inicia o servidor do worker
CMD ["npm", "run", "server"]
