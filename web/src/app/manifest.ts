import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cortes AI - Vídeos Curtos & Virais",
    short_name: "Cortes AI",
    description: "Transforme vídeos longos em cortes virais prontos para redes sociais com inteligência artificial.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0d14",
    theme_color: "#6366f1",
    orientation: "portrait-primary",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["video", "productivity", "multimedia", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Novo Corte",
        short_name: "Novo",
        description: "Criar um novo corte a partir de vídeo ou link",
        url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
      {
        name: "Meus Projetos",
        short_name: "Projetos",
        description: "Acessar projetos e cortes processados",
        url: "/projetos",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
          },
        ],
      },
    ],
  };
}
