import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Central de Ajuda · Cortes Virais",
  description: "Aprenda a usar todas as funções do Cortes Virais AI.",
};

const SECTIONS = [
  { id: "como-funciona", label: "Como funciona" },
  { id: "primeiros-passos", label: "Primeiros passos" },
  { id: "trechos", label: "Escolha dos trechos" },
  { id: "formato", label: "Formato e enquadramento" },
  { id: "legendas", label: "Legendas animadas" },
  { id: "brolls", label: "B-Rolls e ilustrações" },
  { id: "estilo", label: "Copiar estilo" },
  { id: "som", label: "Sound design" },
  { id: "exportacao-nle", label: "Exportação Premiere / Resolve" },
  { id: "resultados", label: "Resultados e edição" },
  { id: "dicas", label: "Dicas para viralizar" },
  { id: "limites", label: "Limites" },
  { id: "faq", label: "Perguntas frequentes" },
];

export default function AjudaPage() {
  return (
    <div className="help-shell">
      <header className="help-hero">
        <span className="help-kicker">Central de Ajuda</span>
        <h1>Como tirar o máximo do Cortes Virais AI</h1>
        <p>
          Guia completo de todas as funções: da escolha automática dos melhores trechos às legendas animadas,
          B-Rolls gerados por IA e sound design.
        </p>
        <Link href="/" className="btn-cta help-hero-cta">
          ← Voltar e criar cortes
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
            <h2>⚙️ Como funciona</h2>
            <p>Cada vídeo enviado passa por um pipeline automático de 5 etapas:</p>
            <ol className="help-steps">
              <li>
                <strong>Download / Upload</strong> — o vídeo é baixado do link (YouTube, Vimeo e outros sites) ou
                recebido do seu computador.
              </li>
              <li>
                <strong>Transcrição</strong> — o áudio é transcrito palavra por palavra com marcação de tempo exata
                (Deepgram).
              </li>
              <li>
                <strong>Análise com IA</strong> — o Claude lê a transcrição inteira e escolhe os trechos com maior
                potencial viral, dando uma nota e uma justificativa para cada um.
              </li>
              <li>
                <strong>Edição</strong> — legendas animadas, B-Rolls, enquadramento vertical, zooms e efeitos sonoros
                são aplicados.
              </li>
              <li>
                <strong>Renderização</strong> — os clipes finais em MP4 ficam disponíveis para assistir e baixar.
              </li>
            </ol>
            <p className="muted">
              Você acompanha cada etapa em tempo real pelo terminal de logs na tela inicial.
            </p>
          </section>

          {/* PRIMEIROS PASSOS */}
          <section id="primeiros-passos" className="card help-section">
            <h2>🚀 Primeiros passos</h2>
            <ol className="help-steps">
              <li>
                Em <strong>Criar Cortes com IA</strong>, escolha <em>Link de Vídeo</em> (cole a URL) ou{" "}
                <em>Enviar Arquivo</em> (.mp4, .mov, .mkv).
              </li>
              <li>
                Escolha o <strong>formato de saída</strong>: Vertical 9:16 (TikTok, Reels, Shorts) ou Horizontal 16:9.
              </li>
              <li>
                Defina a <strong>quantidade de cortes</strong> (1 a 20) e a <strong>duração mínima e máxima</strong>{" "}
                de cada corte, em segundos.
              </li>
              <li>
                Selecione o <strong>idioma falado</strong> no vídeo (Português, Inglês ou Espanhol). Isso é essencial
                para a transcrição ficar correta.
              </li>
              <li>Ative os recursos extras desejados (legendas, B-Rolls, estilo, sons).</li>
              <li>
                Clique em <strong>Gerar Cortes com IA</strong> e acompanhe o progresso.
              </li>
            </ol>
            <div className="help-callout help-callout-tip">
              <strong>Dica:</strong> marque <em>Modo Rascunho</em> para a IA apenas escolher os trechos, sem
              renderizar os arquivos. É bem mais rápido e ótimo para testar configurações de duração.
            </div>
          </section>

          {/* TRECHOS */}
          <section id="trechos" className="card help-section">
            <h2>🎯 Como a IA escolhe os trechos importantes</h2>
            <p>
              A transcrição é dividida em blocos de frases e enviada ao Claude, que atua como um editor especialista em
              conteúdo viral. Um bom trecho, para a IA, precisa ter:
            </p>
            <ul>
              <li>
                <strong>Gancho forte</strong> nos primeiros segundos: uma afirmação surpreendente, pergunta, opinião
                polêmica, promessa ou início de uma história curiosa.
              </li>
              <li>
                <strong>Autonomia</strong>: quem nunca viu o vídeo original entende o trecho sem contexto.
              </li>
              <li>
                <strong>Começo, meio e fim</strong>: termina numa conclusão, punchline ou revelação — nunca no meio de
                uma ideia.
              </li>
              <li>
                <strong>Emoção ou valor</strong>: humor, surpresa, indignação, inspiração ou uma dica prática.
              </li>
            </ul>
            <p>
              A IA evita automaticamente apresentações, propagandas, despedidas e trechos que dependem de algo dito
              antes. Cada corte recebe:
            </p>
            <div className="help-grid">
              <div className="help-mini">
                <strong>Título</strong>
                <span>Curto e chamativo, pronto para usar na postagem.</span>
              </div>
              <div className="help-mini">
                <strong>Gancho</strong>
                <span>A frase de abertura que prende a atenção.</span>
              </div>
              <div className="help-mini">
                <strong>Nota viral (0–100)</strong>
                <span>Os cortes com nota mais alta são priorizados.</span>
              </div>
              <div className="help-mini">
                <strong>Justificativa</strong>
                <span>Por que aquele trecho tende a funcionar.</span>
              </div>
            </div>
            <div className="help-callout">
              A IA pede cerca de 50% mais candidatos do que você solicitou e descarta os que não respeitam a duração
              escolhida ou se sobrepõem a outro corte. Por isso, às vezes você recebe <strong>menos cortes</strong> do
              que pediu — especialmente em vídeos curtos ou com faixas de duração muito estreitas.
            </div>
          </section>

          {/* FORMATO */}
          <section id="formato" className="card help-section">
            <h2>📱 Formato e enquadramento vertical</h2>
            <p>No formato Vertical (9:16), você escolhe como o vídeo original será enquadrado:</p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Modo</th>
                    <th>O que faz</th>
                    <th>Melhor para</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Auto-Face (IA)</strong></td>
                    <td>Detecta o rosto principal e centraliza a câmera nele.</td>
                    <td>Uma pessoa falando para a câmera.</td>
                  </tr>
                  <tr>
                    <td><strong>Podcast IA</strong></td>
                    <td>Detecta dois rostos e empilha: host em cima, convidado embaixo.</td>
                    <td>Podcasts e entrevistas com 2 pessoas.</td>
                  </tr>
                  <tr>
                    <td><strong>Preencher</strong></td>
                    <td>Corte fixo; você ajusta a posição (esquerda, centro, direita) no controle deslizante.</td>
                    <td>Quando a pessoa fica sempre no mesmo lugar.</td>
                  </tr>
                  <tr>
                    <td><strong>Fundo Blur</strong></td>
                    <td>Mostra o vídeo inteiro no centro com uma versão desfocada ao fundo.</td>
                    <td>Telas, slides e gravações onde nada pode ser cortado.</td>
                  </tr>
                  <tr>
                    <td><strong>Split 50/50</strong></td>
                    <td>Metade esquerda em cima, metade direita embaixo (divisão fixa).</td>
                    <td>Gravações lado a lado já enquadradas.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted">
              A detecção de rosto analisa um quadro do meio de cada corte. Se não houver rosto nítido, o sistema usa um
              enquadramento centralizado.
            </p>
          </section>

          {/* LEGENDAS */}
          <section id="legendas" className="card help-section">
            <h2>💬 Legendas animadas palavra por palavra</h2>
            <p>
              As legendas são sincronizadas com a fala: a palavra que está sendo dita no momento fica destacada em cor e
              levemente ampliada (efeito karaokê). O texto aparece em blocos curtos de 2 a 4 palavras para leitura
              instantânea.
            </p>
            <div className="help-grid">
              <div className="help-mini">
                <strong>🔥 Hormozi Bold</strong>
                <span>Caixa alta, fonte pesada, palavra ativa em amarelo e contorno preto espesso. O mais usado em cortes.</span>
              </div>
              <div className="help-mini">
                <strong>⚡ Beast Pop</strong>
                <span>Fonte Impact, 2 palavras por vez e cores neon que mudam a cada bloco. Ritmo frenético.</span>
              </div>
              <div className="help-mini">
                <strong>🍏 Apple Minimal</strong>
                <span>Tipografia limpa, sem caixa alta, destaque em azul. Ideal para tecnologia e conteúdo corporativo.</span>
              </div>
              <div className="help-mini">
                <strong>🎙️ Minimal Podcast</strong>
                <span>Discreta e mais baixa na tela, até 4 palavras por vez. Para podcasts e falas longas.</span>
              </div>
            </div>
            <h3>Emojis automáticos</h3>
            <p>
              Com a opção <em>Injetar Emojis Automáticos</em> ligada, palavras-chave da fala ganham um emoji ao lado.
              Exemplos: <code>dinheiro</code> 💰, <code>lucro</code> 📈, <code>viral</code> 🚀, <code>segredo</code> 🔑,{" "}
              <code>ideia</code> 💡, <code>cuidado</code> ⚠️, <code>erro</code> ❌, <code>foco</code> 🎯,{" "}
              <code>mente</code> 🧠, <code>incrível</code> 🤯.
            </p>
            <div className="help-callout help-callout-warn">
              <strong>Importante:</strong> as legendas são aplicadas apenas no formato <strong>Vertical (9:16)</strong>.
              A qualidade da legenda depende da transcrição: áudio limpo e o idioma correto selecionado fazem toda a
              diferença.
            </div>
          </section>

          {/* BROLLS */}
          <section id="brolls" className="card help-section">
            <h2>🎬 B-Rolls: vídeos de apoio e ilustrações por IA</h2>
            <p>
              B-Rolls são vídeos curtos (2 a 4 segundos) que cobrem a imagem do orador para ilustrar o que está sendo
              dito, mantendo o áudio original. Ao gerar os cortes, o Claude indica <strong>em qual segundo</strong> o
              B-Roll deve entrar, <strong>por quanto tempo</strong> e <strong>o que ele deve mostrar</strong>, com base
              no assunto da fala.
            </p>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>🔥 Higgsfield AI (gerado por IA)</strong>
                <span>
                  Cria uma cena cinematográfica inédita a partir de uma descrição visual. Gera <strong>1 B-Roll por
                  corte</strong>, no momento de maior impacto — normalmente nos primeiros segundos, para reforçar o
                  gancho. Consome créditos e leva mais tempo.
                </span>
              </div>
              <div className="help-mini">
                <strong>Pixabay (banco de vídeos gratuito)</strong>
                <span>
                  Busca vídeos reais por palavra-chave, com uso comercial liberado. Insere de <strong>1 a 3 B-Rolls por corte</strong>,
                  nos momentos em que a fala cita algo visual. Mais rápido e sem custo de geração.
                </span>
              </div>
            </div>
            <h3>Exemplo prático</h3>
            <p>
              Se a pessoa diz <em>“esse notebook é fino, com tela de 14 polegadas e corpo de alumínio”</em>, a IA pode
              marcar aquele momento e pedir uma cena como{" "}
              <code>cinematic close-up of a sleek thin aluminum laptop on a modern desk</code>. O vídeo gerado (ou
              encontrado) aparece sobre o corte exatamente durante essa fala, com um efeito sonoro de transição.
            </p>
            <div className="help-callout">
              A ilustração representa a <strong>ideia geral</strong> da fala — não é uma reprodução exata do produto ou
              objeto citado. Se o Higgsfield estiver indisponível ou sem créditos, o sistema tenta automaticamente um
              vídeo do Pixabay no lugar.
            </div>
          </section>

          {/* ESTILO */}
          <section id="estilo" className="card help-section">
            <h2>✨ Copiar estilo de edição</h2>
            <p>
              Envie ou cole o link de um vídeo modelo (TikTok, Reels ou Shorts) cuja edição você quer imitar. O sistema:
            </p>
            <ul>
              <li>
                <strong>Mede o ritmo de cortes</strong> do vídeo modelo e aplica zooms dinâmicos (punch-in) no mesmo
                intervalo.
              </li>
              <li>
                <strong>Analisa quadros com o Claude Vision</strong> para extrair a estética: iluminação, paleta de cores
                e atmosfera.
              </li>
              <li>
                <strong>Gera B-Rolls combinando com esse visual</strong> e aplica uma correção de cor (mais contraste e
                saturação).
              </li>
              <li>
                <strong>Orienta a IA</strong> a escolher trechos com o ritmo e a intensidade do modelo.
              </li>
            </ul>
            <p>
              Você também pode escolher uma <strong>Vibe do Corte</strong> (Ganchos Rápidos, Podcast, Storytelling,
              Educacional ou Humor) e escrever <strong>instruções adicionais</strong>, como{" "}
              <em>“focar em falas de superação”</em>.
            </p>
            <div className="help-callout help-callout-tip">
              Ao ativar <em>Copiar Estilo</em>, os B-Rolls com Higgsfield AI são ligados automaticamente. Você pode
              trocar para Pixabay ou desligá-los se preferir.
            </div>
          </section>

          {/* SOM */}
          <section id="som" className="card help-section">
            <h2>🔊 Sound design automático</h2>
            <p>Com a opção de Sound Design ligada, efeitos sonoros discretos são mixados ao áudio original:</p>
            <ul>
              <li><strong>Ding</strong> logo no início do corte, para prender a atenção no gancho.</li>
              <li><strong>Whoosh</strong> na entrada de cada B-Roll.</li>
              <li><strong>Whoosh sutil</strong> nas trocas de zoom, quando o ritmo dinâmico está ativo.</li>
            </ul>
            <p className="muted">O volume dos efeitos é baixo para não competir com a voz.</p>
          </section>

          {/* EXPORTAÇÃO NLE PROFISSIONAL */}
          <section id="exportacao-nle" className="card help-section">
            <h2>🎬 Exportação para Premiere Pro e DaVinci Resolve</h2>
            <p>
              Para editores de vídeo profissionais, os cortes não precisam parar no arquivo MP4 renderizado.
              Você pode exportar a estrutura completa do projeto para o seu editor de vídeo favorito:
            </p>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>🎬 Exportar XML (FCP7 xmeml)</strong>
                <span>
                  Reconstrói as timelines no <strong>Adobe Premiere Pro</strong> e no <strong>DaVinci Resolve</strong>.
                  Preserva as trilhas de vídeo (V1 com o orador e V2 com os B-Rolls), áudio (A1 da fala e A2 dos SFX),
                  marcadores de gancho e pontuação viral da IA, além dos parâmetros de enquadramento (Motion).
                </span>
              </div>
              <div className="help-mini">
                <strong>📄 EDL (CMX 3600)</strong>
                <span>
                  Padrão universal da indústria cinematográfica e broadcast. Gera a lista de eventos com timecode SMPTE
                  milimétrico para conform e substituição instantânea (relink) dos proxies pela mídia original em 4K/RAW.
                </span>
              </div>
              <div className="help-mini">
                <strong>💬 Legendas SRT Sincronizadas</strong>
                <span>
                  Baixe as legendas como arquivos <code>.srt</code> editáveis (por corte individual ou do projeto todo).
                  Ao importar no Premiere ou Resolve, elas entram como trilhas nativas de texto/legendas.
                </span>
              </div>
              <div className="help-mini">
                <strong>⚡ Relink com Mídia Original (RAW/4K)</strong>
                <span>
                  Como o XML referencia o nome original do arquivo e o timecode exato da gravação, basta clicar com o botão
                  direito na mídia no Premiere/Resolve e selecionar <em>Link Media / Relink</em> apontando para o seu arquivo master.
                </span>
              </div>
            </div>
            <div className="help-callout help-callout-tip">
              <strong>Como abrir no Adobe Premiere Pro:</strong> Arquivo &gt; Importar &gt; selecione o arquivo <code>.xml</code> baixado.
              O Premiere criará uma pasta no Projeto contendo todas as sequências dos cortes prontas para edição fina.
            </div>
            <div className="help-callout help-callout-tip">
              <strong>Como abrir no DaVinci Resolve:</strong> Arquivo &gt; Importar &gt; Linha de Tempo (Timeline) &gt; selecione o <code>.xml</code> ou <code>.edl</code>.
              O Resolve importará os cortes mantendo sincronia de áudio e ponto de entrada/saída precisos.
            </div>
          </section>

          {/* RESULTADOS */}
          <section id="resultados" className="card help-section">
            <h2>📥 Resultados, edição e download</h2>
            <ul>
              <li>Os cortes aparecem na galeria com player, título, gancho, nota viral e justificativa da IA.</li>
              <li>
                <strong>Baixar Clipe MP4</strong> gera um link temporário de download do arquivo final.
              </li>
              <li>
                Na página do projeto, <strong>Editar &amp; Capa</strong> permite ajustar início e término do corte e
                criar uma capa (thumbnail) com o título viral, pronta para baixar em JPG.
              </li>
              <li>
                <strong>Cancelar Processo</strong> interrompe um vídeo em andamento; <strong>Excluir</strong> remove o
                projeto e todos os clipes gerados.
              </li>
            </ul>
          </section>

          {/* DICAS */}
          <section id="dicas" className="card help-section">
            <h2>💡 Dicas para cortes que viralizam</h2>
            <div className="help-grid help-grid-2">
              <div className="help-mini">
                <strong>Use vídeos com muita fala</strong>
                <span>Podcasts, entrevistas, palestras e aulas rendem os melhores cortes. Vídeos só com música ou sem fala não funcionam.</span>
              </div>
              <div className="help-mini">
                <strong>Áudio limpo</strong>
                <span>Menos ruído e música de fundo = transcrição mais precisa = legendas e trechos melhores.</span>
              </div>
              <div className="help-mini">
                <strong>Duração ideal</strong>
                <span>Para TikTok/Reels/Shorts, 30 a 60 s costuma performar melhor. Faixas muito estreitas (ex: 30–35 s) reduzem as opções da IA.</span>
              </div>
              <div className="help-mini">
                <strong>Teste no rascunho</strong>
                <span>Use o Modo Rascunho para validar os trechos escolhidos antes de gastar tempo renderizando.</span>
              </div>
              <div className="help-mini">
                <strong>Combine os recursos</strong>
                <span>Legenda Hormozi + emojis + sound design + Auto-Face é a combinação mais usada em cortes virais.</span>
              </div>
              <div className="help-mini">
                <strong>Revise antes de postar</strong>
                <span>A IA acerta muito, mas sempre assista ao corte e ajuste início/fim no editor se necessário.</span>
              </div>
            </div>
          </section>

          {/* LIMITES */}
          <section id="limites" className="card help-section">
            <h2>📏 Limites e requisitos</h2>
            <ul>
              <li>Duração máxima do vídeo original: <strong>120 minutos</strong> (padrão do servidor).</li>
              <li>Quantidade de cortes por pedido: <strong>1 a 20</strong>.</li>
              <li>Duração de cada corte: mínimo de <strong>5 segundos</strong>; a mínima deve ser menor que a máxima.</li>
              <li>Cada clipe final é comprimido para caber em cerca de <strong>45 MB</strong>.</li>
              <li>Idiomas suportados na transcrição: <strong>Português, Inglês e Espanhol</strong>.</li>
              <li>
                Alguns vídeos de redes sociais podem bloquear o download (vídeos privados, com login obrigatório ou
                restrição de idade). Nesses casos, baixe o vídeo e use <em>Enviar Arquivo</em>.
              </li>
            </ul>
          </section>

          {/* FAQ */}
          <section id="faq" className="card help-section">
            <h2>❓ Perguntas frequentes</h2>
            <details className="help-faq">
              <summary>Quanto tempo demora para gerar os cortes?</summary>
              <p>
                Depende da duração do vídeo e dos recursos ativados. A transcrição e a análise são rápidas; o que mais
                demora é a renderização e, principalmente, a geração de B-Rolls com Higgsfield AI. Acompanhe pelo
                terminal de logs.
              </p>
            </details>
            <details className="help-faq">
              <summary>Por que recebi menos cortes do que pedi?</summary>
              <p>
                A IA descarta trechos que não respeitam a duração escolhida ou que se sobrepõem. Tente ampliar a faixa
                entre duração mínima e máxima, ou use um vídeo mais longo.
              </p>
            </details>
            <details className="help-faq">
              <summary>Erro “Nenhum trecho passou na validação”. O que fazer?</summary>
              <p>
                O vídeo provavelmente é curto demais para a duração pedida, ou tem pouca fala. Diminua a duração mínima,
                aumente a máxima ou peça menos cortes.
              </p>
            </details>
            <details className="help-faq">
              <summary>As legendas não apareceram no meu corte.</summary>
              <p>
                Legendas só são aplicadas no formato Vertical (9:16). Verifique também se o idioma selecionado é o mesmo
                falado no vídeo.
              </p>
            </details>
            <details className="help-faq">
              <summary>O download pelo link falhou.</summary>
              <p>
                Alguns sites bloqueiam downloads automáticos. Confira se o vídeo é público. Se o erro continuar, baixe o
                vídeo manualmente e envie pela aba <em>Enviar Arquivo</em>.
              </p>
            </details>
            <details className="help-faq">
              <summary>O B-Roll não apareceu no vídeo.</summary>
              <p>
                Pode acontecer se nenhum vídeo compatível for encontrado ou se o serviço de geração estiver indisponível.
                Nesses casos o corte é entregue normalmente, apenas sem o vídeo de apoio.
              </p>
            </details>
            <details className="help-faq">
              <summary>O rosto ficou fora do enquadramento.</summary>
              <p>
                A detecção usa um quadro do meio do corte. Se a pessoa se movimenta muito, use o modo{" "}
                <em>Preencher</em> ajustando a posição manualmente, ou <em>Fundo Blur</em> para mostrar o vídeo inteiro.
              </p>
            </details>
            <details className="help-faq">
              <summary>Posso cancelar um vídeo em processamento?</summary>
              <p>Sim. Use o botão Cancelar Processo no card do vídeo ativo. O processamento é interrompido na hora.</p>
            </details>
          </section>
        </div>
      </div>
    </div>
  );
}
