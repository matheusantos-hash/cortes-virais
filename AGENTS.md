# Regras e Diretrizes do Projeto (Cortes Virais)

## Git & Versionamento
- **Sempre realizar commit e push após realizar alterações no projeto**:
  - Ao finalizar qualquer implementação de funcionalidade, correção de bug ou refatoração solicitada pelo usuário, valide o build/testes, faça o stage dos arquivos modificados, realize um commit descritivo (padrão Conventional Commits, ex: `feat:`, `fix:`) e faça o `git push` para o repositório remoto na branch ativa.

## Interface & Ícones (UI)
- **Nunca utilizar o ícone `Sparkles` da biblioteca `lucide-react`**:
  - É expressamente proibido importar ou utilizar o componente `Sparkles` (ou qualquer variante `SparklesIcon`) da biblioteca `lucide-react` em qualquer parte do projeto. Caso seja necessário representar recursos de IA, clonagem ou destaque visual, utilize ícones contextuais alternativos (como `Wand2`, `Cpu`, `Zap`, `Film`, etc.) ou apenas texto sem ícone decorativo.

