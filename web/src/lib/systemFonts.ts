export interface SystemFont {
  id: string;
  name: string;
  fontFamily: string;
  fileName: string;
  category: "Impacto Viral" | "Condensada" | "Moderna" | "Clean / Tech" | "Podcast";
  description: string;
  sampleText: string;
}

export const SYSTEM_FONTS: SystemFont[] = [
  {
    id: "montserrat",
    name: "Montserrat Black",
    fontFamily: "Montserrat",
    fileName: "Montserrat-Black.ttf",
    category: "Impacto Viral",
    description: "Espessura máxima, alta retenção e padrão em cortes de negócios e finanças.",
    sampleText: "PARE DE PERDER TEMPO! 100K VIEWS 🔥",
  },
  {
    id: "anton",
    name: "Anton (MrBeast Style)",
    fontFamily: "Anton",
    fileName: "Anton-Regular.ttf",
    category: "Impacto Viral",
    description: "Letras condensadas e imponentes, perfeitas para palavras de choque.",
    sampleText: "ELE DESCOBRIU O SEGREDO SECRETO 🚀",
  },
  {
    id: "bebas_neue",
    name: "Bebas Neue",
    fontFamily: "Bebas Neue",
    fileName: "BebasNeue-Regular.ttf",
    category: "Condensada",
    description: "Alta, esbelta e marcante em letras maiúsculas. Muito legível em telas pequenas.",
    sampleText: "NUNCA MAIS COMETA ESSE ERRO GRAVE ⚠️",
  },
  {
    id: "poppins",
    name: "Poppins Bold",
    fontFamily: "Poppins",
    fileName: "Poppins-Bold.ttf",
    category: "Moderna",
    description: "Curvas geométricas limpas com leitura super fluida em vlogs e storytelling.",
    sampleText: "O HÁBITO QUE MUDOU MINHA VIDA REALMENTE ✨",
  },
  {
    id: "oswald",
    name: "Oswald Bold",
    fontFamily: "Oswald",
    fileName: "Oswald-Bold.ttf",
    category: "Podcast",
    description: "Excelente para diálogos longos, entrevistas e debates com ar profissional.",
    sampleText: "A VERDADE QUE NINGUÉM TE CONTA SOBRE ISSO 🎙️",
  },
  {
    id: "russo_one",
    name: "Russo One",
    fontFamily: "Russo One",
    fileName: "RussoOne-Regular.ttf",
    category: "Impacto Viral",
    description: "Estilo bloco pesado com ar dinâmico, excelente para curiosidades e humor.",
    sampleText: "OLHA O QUE ACONTECEU COM ESSE CARA 😱",
  },
  {
    id: "inter",
    name: "Inter Black (Apple Clean)",
    fontFamily: "Inter",
    fileName: "Inter-Black.ttf",
    category: "Clean / Tech",
    description: "Tipografia minimalista premium inspirada no design da Apple e tech.",
    sampleText: "SIMPLICIDADE QUE GERA MILHÕES DE DÓLARES 💎",
  },
  {
    id: "rubik",
    name: "Rubik Black",
    fontFamily: "Rubik",
    fileName: "Rubik-Black.ttf",
    category: "Moderna",
    description: "Cantos levemente arredondados com força visual e alta legibilidade.",
    sampleText: "ESTRATÉGIA COMPLETA PASSO A PASSO 📈",
  },
];
