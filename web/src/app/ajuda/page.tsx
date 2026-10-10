import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Settings,
  Zap,
  Smartphone,
  Subtitles,
  Film,
  Copy,
  Volume2,
  FileCode,
  Download,
  TrendingUp,
  Clock,
  HelpCircle,
  CheckCircle,
  Scissors,
  Camera,
  Crop,
  SlidersHorizontal,
  Palette,
  Lightbulb,
  Info,
  Layers,
  Square,
  Monitor,
  Wand2,
  Type,
  Play,
  RotateCcw,
  Check,
} from "@/components/Icons";

export const metadata: Metadata = {
  title: "Central de Ajuda · Cortes AI",
  description: "Aprenda a usar todas as funções do Cortes AI, o estúdio de clonagem e o editor completo.",
};

const SECTIONS = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "primeiros-passos", label: "Primeiros passos" },
  { id: "guia-editor", label: "Como usar o Editor" },
  { id: "trechos", label: "Escolha dos trechos (IA)" },
  { id: "formato", label: "Formatos e enquadramento" },
  { id: "legendas", label: "Legendas e cores" },
  { id: "brolls", label: "B-Rolls e elementos visuais" },
  { id: "estilo", label: "Studio de Clonagem" },
  { id: "som", label: "Sound design" },
  { id: "exportacao-nle", label: "Exportação Premiere / Resolve" },
  { id: "resultados", label: "Resultados e gestão" },
  { id: "dicas", label: "Dicas para viralizar" },
  { id: "limites", label: "Limites e requisitos" },
  { id: "faq", label: "Perguntas frequentes" },
];

export default function AjudaPage() {
  return (
    <div className="help-shell">
      <header className="help-hero">
        <span className="help-kicker">Central de Ajuda &amp; Documentação</span>
        <h1>Como tirar o máximo do Cortes AI</h1>
        <p>
          Guia completo e atualizado de todas as ferramentas da plataforma: pipeline de inteligência artificial com
          Claude 3.7 Sonnet, editor interativo com timeline de múltiplas trilhas, studio de clonagem de referências virais,
          legendas com novo seletor cromático, B-Rolls dinâmicos e exportação profissional para Premiere e DaVinci Resolve.
        </p>
        <Link
          href="/"
          className="btn-cta help-hero-cta"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
        >
          <ArrowLeft size={16} /> Voltar e criar cortes
        </Link>
      </header>

      <div className="help-layout">
        <nav className="help-toc" aria-label="Sumário">
          <strong>Nesta página</strong>
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="help-content">
          {/* COMO FUNCIONA */}
          <section id="como-funciona" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Settings size={20} style={{ color: "var(--primary)" }} /> Como funciona
            </h2>
            <p>Cada vídeo processado pela plataforma passa por um fluxo automático e otimizado de 5 etapas:</p>
            <ol className="help-steps">
              <li>
                <strong>Download / Upload Seguro</strong> — o vídeo é importado diretamente via link (YouTube, Vimeo,
                TikTok, etc.) ou enviado do seu dispositivo com suporte a uploads resumáveis para arquivos grandes.
              </li>
              <li>
                <strong>Transcrição com Timestamps Exatos</strong> — o áudio é processado pelo modelo Deepgram Nova-2,
                gerando transcrição palavra por palavra com marcações de tempo milimétricas.
              </li>
              <li>
                <strong>Análise com IA de Ponta (Claude 3.7 / 3.5 Sonnet)</strong> — o modelo de linguagem avalia a
                transcrição integral para identificar ganchos de alta retenção, pontua o potencial viral (0 a 100) e
                escreve uma justificativa estratégica para cada trecho.
              </li>
              <li>
                <strong>Edição &amp; Composição Dinâmica</strong> — legendas animadas em efeito karaokê, reenquadramento
                inteligente (Auto-Face ou Podcast IA), B-Rolls ilustrativos, cortes de ritmo e sound design são montados
                de acordo com as decisões da IA ou referências escolhidas.
              </li>
              <li>
                <strong>Renderização e Exportação</strong> — os clipes ficam disponíveis imediatamente para assistir,
                editar no editor web integrado, baixar em MP4 comprimido ou exportar em arquivos XML/EDL para softwares NLE.
              </li>
            </ol>
            <p className="muted">
              Você pode acompanhar todo o progresso em tempo real através do terminal de logs na interface inicial.
            </p>
          </section>

          {/* PRIMEIROS PASSOS */}
          <section id="primeiros-passos" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Zap size={20} style={{ color: "var(--primary)" }} /> Primeiros passos
            </h2>
            <ol className="help-steps">
              <li>
                Na aba <strong>Criar Cortes</strong>, selecione <em>Link de Vídeo</em> (cole a URL pública) ou{" "}
                <em>Enviar Arquivo</em> (.mp4, .mov ou .mkv).
              </li>
              <li>
                Defina o <strong>Formato Principal</strong>: Vertical 9:16 (TikTok, Reels, Shorts) ou Horizontal 16:9
                (YouTube clássico).
              </li>
              <li>
                Escolha a <strong>quantidade de cortes</strong> (de 1 a 20) e configure os limites de{" "}
                <strong>duração mínima e máxima</strong> em segundos (ex: 30s a 60s).
              </li>
              <li>
                Selecione o <strong>idioma falado</strong> no vídeo (Português, Inglês ou Espanhol) para garantir precisão
                máxima de transcrição.
              </li>
              <li>
                Ative os módulos opcionais: <em>Legendas Animadas</em>, <em>B-Rolls de Apoio</em>,{" "}
                <em>Studio de Clonagem de Estilo</em> e <em>Sound Design</em>.
              </li>
              <li>
                Clique no botão <strong>Gerar Cortes com IA</strong> para iniciar o processamento.
              </li>
            </ol>
            <div className="help-callout help-callout-tip">
              <strong>Modo Rascunho:</strong> Ao marcar esta opção, a IA realiza apenas a transcrição e a seleção
              estratégica dos melhores trechos, sem renderizar os arquivos MP4 finais. É ideal para validar os pontos de
              corte rapidamente e com menor consumo de recursos antes da renderização definitiva.
            </div>
          </section>

          {/* GUIA DO EDITOR */}
          <section id="guia-editor" className="card help-section" style={{ border: "1px solid var(--primary-light)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, color: "var(--primary)" }}>
                <Scissors size={22} style={{ color: "var(--primary)" }} /> Como usar o Editor de Cortes (Guia Completo)
              </h2>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.2rem 0.6rem", borderRadius: "999px", background: "var(--primary-light)", color: "var(--primary)" }}>
                Recurso Principal
              </span>
            </div>
            <p>
              O <strong>Editor de Cortes</strong> é um ambiente de pós-produção completo diretamente no navegador. Ele
              permite refinar o tempo exato dos cortes, gerenciar sobreposições visuais (B-Rolls), criar capas chamativas,
              ajustar enquadramentos e customizar legendas em tempo real com prévia instantânea em Canvas.
            </p>

            <h3>1. Como abrir o Editor</h3>
            <p>
              Na página do seu projeto ou na galeria de resultados, localize o card do corte que deseja editar e clique no
              botão <strong>Editar &amp; Capa</strong> (ou no ícone de tesoura). O editor abrirá em uma janela modal
              otimizada com layout responsivo.
            </p>

            <h3>2. Anatomia do Editor</h3>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>Player Central em Tempo Real</strong>
                <span>
                  Exibe o clipe com proporção dinâmica (9:16, 1:1 ou 16:9), renderizando instantaneamente cortes, legendas,
                  B-Rolls de Canvas e posicionamento de câmera. Suporta modo tela cheia e controle por teclado (Barra de Espaço para Play/Pause).
                </span>
              </div>
              <div className="help-mini">
                <strong>Timeline Interativa de 3 Trilhas</strong>
                <span>
                  Composta por régua de timecode, alças de corte inicial/final (trim handles) e trilha dedicada de B-Rolls para arrastar,
                  estender ou encurtar a duração de cada elemento visual.
                </span>
              </div>
            </div>

            <h3>3. As 6 Abas de Edição Explicadas</h3>
            <p>O painel de controles é organizado em 6 abas dedicadas:</p>

            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>Aba</th>
                    <th>Para que serve</th>
                    <th>Como usar</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Scissors size={15} style={{ color: "var(--primary)" }} /> Corte (Trim)
                      </strong>
                    </td>
                    <td>Ajustar com precisão cirúrgica os pontos de início e término do corte.</td>
                    <td>
                      Pause o vídeo no ponto onde a fala começa e clique em <em>Definir Início</em> (ou arraste a alça esquerda na timeline).
                      Avance até a frase final e clique em <em>Definir Fim</em>. A duração total é atualizada em tempo real.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Film size={15} style={{ color: "var(--primary)" }} /> B-Rolls
                      </strong>
                    </td>
                    <td>Gerenciar vídeos de apoio e elementos gráficos sobrepostos à imagem.</td>
                    <td>
                      Consulte as <strong>Sugestões da IA</strong> no topo. Clique no botão de informação <em>(i)</em> para ver a justificativa
                      e a prévia animada do elemento. Clique em <em>+ Adicionar</em> para inseri-lo na timeline. Você também pode adicionar
                      vídeos do Pixabay, Higgsfield AI ou templates de Canvas.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Camera size={15} style={{ color: "var(--primary)" }} /> Capa (Thumbnail)
                      </strong>
                    </td>
                    <td>Criar e exportar miniaturas (covers) profissionais para Reels, Shorts e TikTok.</td>
                    <td>
                      Pause o vídeo no melhor frame da expressão facial e clique em <em>Capturar Quadro Atual</em> (ou envie uma foto).
                      Personalize o título viral, selecione a fonte, configure o selo de destaque (badge) e clique em <em>Baixar Capa (JPG)</em>.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Crop size={15} style={{ color: "var(--primary)" }} /> Formatos
                      </strong>
                    </td>
                    <td>Mudar a proporção do clipe sem perder os elementos configurados.</td>
                    <td>
                      Alterne com um clique entre <strong>Vertical 9:16</strong> (Shorts/Reels/TikTok), <strong>Quadrado 1:1</strong> (feed do Instagram/LinkedIn)
                      e <strong>Horizontal 16:9</strong> (YouTube clássico). O editor adapta a exibição imediatamente.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <SlidersHorizontal size={15} style={{ color: "var(--primary)" }} /> Ângulo (Crop)
                      </strong>
                    </td>
                    <td>Controlar o enquadramento do orador na tela vertical.</td>
                    <td>
                      Selecione <strong>Auto-Face</strong> para rastreamento automático de rosto, <strong>Podcast IA</strong> para divisão host/convidado,
                      ou use <strong>Preencher</strong> com o controle deslizante horizontal (0% a 100%) para centralizar oradores que estejam fixos à esquerda ou à direita.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <strong style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <Subtitles size={15} style={{ color: "var(--primary)" }} /> Legenda
                      </strong>
                    </td>
                    <td>Personalizar tipografia, cores do karaokê, posição e emojis.</td>
                    <td>
                      Escolha um dos 4 estilos ou personalize a fonte (Poppins Bold, Montserrat, Bebas Neue, etc.).
                      Use o novo <strong>Modern Color Picker</strong> (swatches e disco cromático) para escolher a cor principal e a cor da palavra falada.
                      Ajuste a posição vertical (inferior, centro-inferior ou centro) e ative a injeção automática de emojis.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3>4. Salvando e Sincronizando Alterações</h3>
            <p>
              Ao terminar os ajustes, clique no botão <strong>Salvar Alterações</strong> no rodapé do editor. Suas alterações
              de corte, formato, legendas e trilhas visuais são persistidas no banco de dados e sincronizadas com o clipe
              do seu projeto instantaneamente.
            </p>
            <div className="help-callout help-callout-tip">
              <strong>Atalho para Clonar Estilo:</strong> Quer aplicar a identidade visual de um canal famoso no corte em
              edição? Clique em <em>Clonar Estilo</em> dentro do editor para abrir o Studio de Clonagem de Referências sem
              precisar sair da página.
            </div>
          </section>

          {/* TRECHOS */}
          <section id="trechos" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Zap size={20} style={{ color: "var(--primary)" }} /> Escolha dos trechos com IA de Ponta
            </h2>
            <p>
              O motor de IA atua como um editor humano veterano em retenção e algoritmos de recomendação. A transcrição
              completa é analisada por modelos de última geração (Claude 3.7 Sonnet e 3.5 Sonnet) com foco em:
            </p>
            <ul>
              <li>
                <strong>Gancho Magnético nos Primeiros 3 Segundos</strong>: Afirmações impactantes, contradições lógicas,
                curiosidades irresistíveis ou promessas de transformação que impedem o usuário de rolar o feed.
              </li>
              <li>
                <strong>Compreensão Autônoma</strong>: O trecho precisa fazer sentido por si só, sem depender de introduções
                ou falas prévias.
              </li>
              <li>
                <strong>Estrutura Narrativa Fechada</strong>: Apresenta começo, desenvolvimento e punchline ou conclusão
                surpreendente.
              </li>
              <li>
                <strong>Eliminação de Ruídos</strong>: Aberturas de canal, pedidos de curtida, momentos de silêncio e
                despedidas formais são filtrados automaticamente.
              </li>
            </ul>
            <div className="help-grid">
              <div className="help-mini">
                <strong>Título Chamativo</strong>
                <span>Projetado com técnicas de copywriting para títulos e miniaturas.</span>
              </div>
              <div className="help-mini">
                <strong>Gancho Identificado</strong>
                <span>Frase exata dos primeiros segundos que ancora a atenção do espectador.</span>
              </div>
              <div className="help-mini">
                <strong>Nota Viral (0–100)</strong>
                <span>Pontuação algorítmica calculada pela IA; cortes com maiores notas ganham prioridade.</span>
              </div>
              <div className="help-mini">
                <strong>Justificativa Editorial</strong>
                <span>Explicação detalhada de por que aquele corte tem alto potencial de engajamento.</span>
              </div>
            </div>
          </section>

          {/* FORMATO */}
          <section id="formato" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Smartphone size={20} style={{ color: "var(--primary)" }} /> Formatos e enquadramento inteligente
            </h2>
            <p>
              Vídeos gravados na horizontal (16:9) necessitam de reenquadramento dinâmico para plataformas verticais (9:16).
              O Cortes AI disponibiliza 5 modos de adaptação:
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Modo</th>
                    <th>Funcionamento</th>
                    <th>Recomendado para</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Auto-Face (IA)</strong></td>
                    <td>Rastreia a face do orador principal e centraliza a câmera vertical no rosto.</td>
                    <td>Vídeos com 1 apresentador em foco.</td>
                  </tr>
                  <tr>
                    <td><strong>Podcast IA</strong></td>
                    <td>Detecta dois rostos simultâneos e cria um layout empilhado (host em cima, convidado embaixo).</td>
                    <td>Entrevistas em estúdio, mesas redondas e bate-papos com 2 oradores.</td>
                  </tr>
                  <tr>
                    <td><strong>Preencher (Manual)</strong></td>
                    <td>Corte fixo ajustável por controle deslizante de posição horizontal (esquerda, centro, direita).</td>
                    <td>Apresentadores que permanecem fixos em um lado do cenário.</td>
                  </tr>
                  <tr>
                    <td><strong>Fundo Blur</strong></td>
                    <td>Exibe o vídeo original no centro com bordas superior e inferior preenchidas por efeito de desfoque.</td>
                    <td>Compartilhamento de telas, tutoriais de software e slides.</td>
                  </tr>
                  <tr>
                    <td><strong>Split 50/50</strong></td>
                    <td>Divide a tela ao meio em duas metades verticais estáticas.</td>
                    <td>Gravações com divisão de tela pré-configurada.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* LEGENDAS */}
          <section id="legendas" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Subtitles size={20} style={{ color: "var(--primary)" }} /> Legendas animadas e seletor moderno de cores
            </h2>
            <p>
              Mais de 70% das pessoas assistem vídeos curtos sem som nas redes sociais. As legendas animadas sincronizadas
              palavra por palavra garantem leitura dinâmica e alta taxa de retenção.
            </p>
            <div className="help-grid">
              <div className="help-mini">
                <strong>Hormozi Bold</strong>
                <span>Caixa alta, fonte pesada, palavra falada em amarelo neon com contorno preto espesso. Padrão de maior retenção.</span>
              </div>
              <div className="help-mini">
                <strong>Beast Pop</strong>
                <span>Estilo enérgico inspirado em MrBeast, blocos ultra-curtos de até 2 palavras e cores vibrantes.</span>
              </div>
              <div className="help-mini">
                <strong>Apple Minimal</strong>
                <span>Design sóbrio e moderno, caixa mista e destaque em azul ciano. Perfeito para tecnologia, finanças e B2B.</span>
              </div>
              <div className="help-mini">
                <strong>Minimal Podcast</strong>
                <span>Discreta e posicionada no terço inferior, ideal para conversas longas e debates profundos.</span>
              </div>
            </div>

            <h3>Novo Seletor Cromático (Modern Color Picker)</h3>
            <p>
              Tanto no Editor de Cortes quanto no Studio de Clonagem, a personalização de cores agora conta com seletores
              circulares modernos:
            </p>
            <ul>
              <li><strong>Swatches Rápidos</strong>: paleta de cores consagradas no mercado com 1 clique.</li>
              <li><strong>Pizza Cromática / Color Wheel</strong>: disco de cores circular completo para escolher qualquer tom e matiz desejado.</li>
              <li><strong>Controle de Destaque Karaokê</strong>: defina de forma independente a cor primária das frases e a cor da palavra ativa.</li>
              <li><strong>Catálogo Tipográfico</strong>: fontes nativas de alto impacto (Poppins Bold, Montserrat, Anton, Bebas Neue, Inter).</li>
            </ul>

            <h3>Emojis Contextuais Automáticos</h3>
            <p>
              Com a opção de emojis ligada, palavras-chave da fala ganham ícones contextuais sincronizados automaticamente
              (ex: <code>dinheiro</code> 💰, <code>fogo</code> 🔥, <code>crescimento</code> 📈, <code>atenção</code> ⚠️).
            </p>
          </section>

          {/* BROLLS */}
          <section id="brolls" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Film size={20} style={{ color: "var(--primary)" }} /> B-Rolls, Ilustrações e Overlays Visuais
            </h2>
            <p>
              B-Rolls evitam a fadiga visual e aumentam o tempo de tela do espectador. O Cortes AI oferece um sistema
              multicamada de elementos de apoio:
            </p>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>Canvas Overlays Interativos</strong>
                <span>
                  Elementos gráficos nativos renderizados diretamente sobre a timeline: Cartões de Citação (Quote Cards),
                  Estatísticas Animadas (Stat Callout), Gráficos de Crescimento, Rankings Top 3, VS Battle e Caixas de Código.
                </span>
              </div>
              <div className="help-mini">
                <strong>Gatilhos Inteligentes da IA</strong>
                <span>
                  O Claude analisa a fala e aponta momentos exatos onde números, contrastes ou conceitos abstratos pedem
                  um elemento visual. Na aba B-Rolls do editor, o botão <em>(i)</em> exibe uma prévia animada e a explicação da IA.
                </span>
              </div>
              <div className="help-mini">
                <strong>Banco de Vídeos Pixabay</strong>
                <span>
                  Inserção automática de vídeos reais de alta definição baseados no contexto da frase, com uso comercial livre
                  e sem custo extra de processamento.
                </span>
              </div>
              <div className="help-mini">
                <strong>Higgsfield AI (Cenas Cinematográficas)</strong>
                <span>
                  Gera takes cinematográficos inéditos de 2 a 4 segundos a partir de prompts visuais elaborados pela IA no momento
                  de maior impacto da narrativa.
                </span>
              </div>
            </div>
          </section>

          {/* ESTILO */}
          <section id="estilo" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Copy size={20} style={{ color: "var(--primary)" }} /> Studio de Clonagem de Estilo (Clone Studio)
            </h2>
            <p>
              O <strong>Studio de Clonagem</strong> permite replicar a identidade visual e o ritmo de edição de qualquer
              criador de conteúdo de sucesso.
            </p>
            <h3>Funcionalidades do Clone Studio:</h3>
            <ul>
              <li>
                <strong>Presets Virais Prontos</strong>: Perfis pré-configurados dos maiores criadores do mundo, incluindo{" "}
                <em>Alex Hormozi</em> (alta retenção e cortes rápidos), <em>MrBeast</em> (ritmo acelerado e cores pop),{" "}
                <em>Iman Gadzhi</em> (estética cinematográfica premium), <em>Ali Abdaal</em> (minimalista educacional),{" "}
                <em>Dan Koe</em> e <em>Joe Rogan</em>.
              </li>
              <li>
                <strong>Clonagem via Link ou Arquivo</strong>: Cole o link de um TikTok, Reel ou Short de referência (ou envie um arquivo MP4).
                A IA analisa o vídeo e extrai:
                <ul style={{ marginTop: "0.4rem" }}>
                  <li>Cadência de cortes e frequência de zooms dinâmicos (punch-in);</li>
                  <li>Paleta de cores e tipografia dominante via Claude Vision;</li>
                  <li>Estilo e enquadramento de legendas;</li>
                  <li>Vibe do conteúdo (Ganchos Rápidos, Storytelling, Podcast, Educacional).</li>
                </ul>
              </li>
              <li>
                <strong>Biblioteca de Estilos Salvos</strong>: Salve suas receitas de estilo personalizadas com nome e instruções
                de design para reutilizar em qualquer novo vídeo com um único clique.
              </li>
            </ul>
          </section>

          {/* SOM */}
          <section id="som" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Volume2 size={20} style={{ color: "var(--primary)" }} /> Sound design automático
            </h2>
            <p>
              A experiência auditiva é crucial para manter a atenção. Quando o Sound Design está ativo, efeitos sonoros (SFX)
              cuidadosamente nivelados são adicionados aos momentos de transição:
            </p>
            <ul>
              <li><strong>Ding / Bell</strong>: Inserido logo nos primeiros segundos para reforçar o gancho inicial.</li>
              <li><strong>Whoosh de Transição</strong>: Sincronizado com a entrada e saída de cada B-Roll ou elemento gráfico.</li>
              <li><strong>Whoosh Dinâmico</strong>: Acompanha os zooms de câmera (punch-in) no ritmo da fala.</li>
            </ul>
            <p className="muted">
              Todos os efeitos contam com volume equalizado para nunca abafar a clareza da voz do orador.
            </p>
          </section>

          {/* EXPORTAÇÃO NLE PROFISSIONAL */}
          <section id="exportacao-nle" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileCode size={20} style={{ color: "var(--primary)" }} /> Exportação Profissional para Premiere Pro e DaVinci Resolve
            </h2>
            <p>
              Para editores de vídeo profissionais e agências, o Cortes AI exporta a estrutura completa da timeline em
              formatos nativos da indústria audiovisual:
            </p>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>Exportação XML (FCP7 xmeml)</strong>
                <span>
                  Compatível com <strong>Adobe Premiere Pro</strong> e <strong>DaVinci Resolve</strong>. Reconstrói a timeline
                  com trilhas independentes: V1 (orador original), V2 (B-Rolls), A1 (áudio principal da fala), A2 (trilha de SFX),
                  além de marcadores de gancho e parâmetros de escala e posição.
                </span>
              </div>
              <div className="help-mini">
                <strong>Listas EDL (CMX 3600)</strong>
                <span>
                  Padrão clássico da indústria cinematográfica para conform e relink instantâneo com as mídias originais gravadas em 4K, 6K ou RAW.
                </span>
              </div>
              <div className="help-mini">
                <strong>Legendas em Arquivo SRT</strong>
                <span>
                  Baixe os arquivos <code>.srt</code> sincronizados de cada corte para importar como trilhas nativas de texto no seu editor NLE favorito.
                </span>
              </div>
              <div className="help-mini">
                <strong>Fluxo de Relink com Mídia Master</strong>
                <span>
                  Como os arquivos XML e EDL preservam o timecode original da gravação, basta usar a ferramenta <em>Link Media / Conform</em> no Premiere ou DaVinci
                  para substituir proxies pela gravação bruta com resolução total.
                </span>
              </div>
            </div>
            <div className="help-callout help-callout-tip">
              <strong>Como abrir no Adobe Premiere Pro:</strong> Vá em <em>Arquivo &gt; Importar</em> e selecione o arquivo <code>.xml</code>.
              O Premiere criará uma pasta com todas as sequências prontas para finalização.
            </div>
            <div className="help-callout help-callout-tip">
              <strong>Como abrir no DaVinci Resolve:</strong> Acesse <em>Arquivo &gt; Importar &gt; Linha de Tempo (Timeline)</em> e selecione o <code>.xml</code> ou <code>.edl</code>.
            </div>
          </section>

          {/* RESULTADOS */}
          <section id="resultados" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Download size={20} style={{ color: "var(--primary)" }} /> Resultados, gestão e downloads
            </h2>
            <ul>
              <li>
                <strong>Player e Avaliação Visual</strong>: Cada corte gerado apresenta player integrado, título chamativo, gancho,
                nota viral e justificativa da IA.
              </li>
              <li>
                <strong>Download em MP4</strong>: Gere um link de alta velocidade para baixar o corte pronto para publicação.
              </li>
              <li>
                <strong>Editor Integrado</strong>: Clique em <em>Editar &amp; Capa</em> a qualquer momento para abrir o editor e refinar os detalhes.
              </li>
              <li>
                <strong>Exportação NLE</strong>: Botões rápidos para baixar XML, EDL e legendas SRT individuais ou de todo o projeto.
              </li>
              <li>
                <strong>Gerenciamento Seguro</strong>: Cancele processos em andamento ou exclua projetos antigos liberando espaço no painel.
              </li>
            </ul>
          </section>

          {/* DICAS */}
          <section id="dicas" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <TrendingUp size={20} style={{ color: "var(--primary)" }} /> Dicas estratégicas para cortes que viralizam
            </h2>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>Priorize Conteúdos Ricos em Diálogo</strong>
                <span>Podcasts, aulas práticas, palestras e entrevistas produzem os melhores ganchos virais. Vídeos musicais sem fala não são adequados.</span>
              </div>
              <div className="help-mini">
                <strong>Qualidade de Áudio</strong>
                <span>Áudio nítido com pouco eco e sem ruído de fundo garante precisão máxima na transcrição e sincronização impecável das legendas.</span>
              </div>
              <div className="help-mini">
                <strong>Faixa de Duração Saudável</strong>
                <span>Deixe uma margem flexível entre duração mínima e máxima (ex: 35s a 65s) para permitir que a IA encontre o fechamento ideal da ideia.</span>
              </div>
              <div className="help-mini">
                <strong>Aproveite as Sugestões do Editor</strong>
                <span>Na aba B-Rolls do editor, analise as sugestões da IA e insira cartões e gráficos nos momentos de maior densidade de informação.</span>
              </div>
              <div className="help-mini">
                <strong>Crie Capas Atraentes no Editor</strong>
                <span>Use a aba Capa para escolher uma expressão forte e um título provocativo antes de postar no feed ou nos Reels.</span>
              </div>
              <div className="help-mini">
                <strong>Teste no Modo Rascunho</strong>
                <span>Valide os ganchos e as notas dos trechos rapidamente antes de despachar a renderização de muitos cortes.</span>
              </div>
            </div>
          </section>

          {/* LIMITES */}
          <section id="limites" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={20} style={{ color: "var(--primary)" }} /> Limites e especificações técnicas
            </h2>
            <ul>
              <li>Duração máxima recomendada do vídeo fonte: <strong>120 minutos</strong> por processamento.</li>
              <li>Quantidade de cortes por lote: <strong>1 a 20 cortes</strong>.</li>
              <li>Duração permitida por corte: mínimo de <strong>5 segundos</strong> até a duração máxima configurada.</li>
              <li>Idiomas de transcrição suportados: <strong>Português, Inglês e Espanhol</strong>.</li>
              <li>Formatos de exportação de vídeo: <strong>MP4 (H.264 / AAC)</strong> otimizado para plataformas sociais.</li>
              <li>Formatos de exportação NLE: <strong>XML (FCP7)</strong>, <strong>EDL (CMX 3600)</strong> e <strong>SRT</strong>.</li>
            </ul>
          </section>

          {/* FAQ */}
          <section id="faq" className="card help-section">
            <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <HelpCircle size={20} style={{ color: "var(--primary)" }} /> Perguntas frequentes
            </h2>
            <details className="help-faq">
              <summary>Como altero o tempo de início ou fim de um corte?</summary>
              <p>
                No card do corte, clique em <strong>Editar &amp; Capa</strong>. Na aba <strong>Corte (Trim)</strong>, navegue pelo vídeo
                e marque os pontos de início e término desejados, ou arraste as alças na timeline interativa. Depois, clique em <em>Salvar Alterações</em>.
              </p>
            </details>
            <details className="help-faq">
              <summary>Como mudo a fonte e as cores das legendas no corte?</summary>
              <p>
                Abra o editor clicando em <strong>Editar &amp; Capa</strong> e selecione a aba <strong>Legenda</strong>. Lá você encontra
                a lista de fontes disponíveis e o <strong>Modern Color Picker</strong> para escolher a cor padrão do texto e a cor
                do destaque de karaokê (com paleta rápida e disco cromático completo).
              </p>
            </details>
            <details className="help-faq">
              <summary>Por que recebi menos cortes do que solicitei?</summary>
              <p>
                A IA analisa a transcrição e descarta candidatos que não atingem nota de retenção satisfatória, que se sobrepõem a trechos
                já selecionados ou que não encaixam na faixa de duração estipulada. Experimente alargar a janela entre duração mínima e máxima.
              </p>
            </details>
            <details className="help-faq">
              <summary>Como funcionam as sugestões de B-Rolls da IA no Editor?</summary>
              <p>
                Ao abrir a aba B-Rolls no editor, o algoritmo escaneia a transcrição do corte procurando gatilhos (dados estatísticos,
                listas, termos técnicos e momentos de ênfase). Clicando no ícone <em>(i)</em> ao lado de cada sugestão, você pode assistir
                a uma prévia do elemento gráfico animado e entender por que ele foi sugerido antes de adicioná-lo à timeline.
              </p>
            </details>
            <details className="help-faq">
              <summary>Como exportar para Adobe Premiere ou DaVinci Resolve?</summary>
              <p>
                Na barra de opções do corte ou do projeto, selecione a opção de exportar XML. Baixe o arquivo gerado e, no Premiere,
                utilize o comando <em>Arquivo &gt; Importar</em>. No DaVinci Resolve, utilize <em>Arquivo &gt; Importar &gt; Linha de Tempo</em>.
              </p>
            </details>
            <details className="help-faq">
              <summary>O que fazer se o download de um link falhar?</summary>
              <p>
                Alguns serviços de vídeo restringem downloads automáticos para conteúdos com limite de idade, conteúdo privado ou
                necessidade de autenticação. Baixe o vídeo em seu computador e faça o envio direto pela aba <em>Enviar Arquivo</em>.
              </p>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
