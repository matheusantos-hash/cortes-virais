# Worker de cortes virais — imagem para o Railway
FROM mirror.gcr.io/library/node:22-bookworm-slim

# ffmpeg (cortes) + python3 (o yt-dlp precisa) + curl/certificados + fontes para legendas (libass)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    ffmpeg python3 curl ca-certificates \
    fontconfig fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# yt-dlp (versão mais recente na hora do build; reconstrua a imagem de vez em quando para atualizar)
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

ENV NODE_ENV=production

# Sem porta: o worker não recebe requisições, só busca jobs no Supabase.
CMD ["npm", "run", "server"]
