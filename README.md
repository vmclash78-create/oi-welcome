# Plataforma de cursos

Projeto de uma plataforma para comercialização e consumo de cursos online, desenvolvido com React, TypeScript, TanStack Start e Vite.

## Funcionalidades demonstrativas atuais

- Catálogo de cursos com busca e filtros por categoria.
- Página de detalhes do curso e apresentação de preço.
- Área do aluno com biblioteca e progresso local de aulas.
- Área do produtor com painel inicial e checklist de publicação.
- Layout responsivo para celular e desktop.
- Avisos explícitos onde checkout e integrações ainda não estão conectados.

## Executar localmente

Requisitos: Node.js e npm.

```sh
npm install
npm run dev
```

Verificações disponíveis:

```sh
npm run lint
npm run test
npm run build
```

## Antes de colocar em produção

Esta versão é uma interface de demonstração. Ainda é necessário integrar autenticação e permissões, banco de dados, armazenamento protegido de vídeos e materiais, checkout com provedor de pagamento, confirmação de pagamento por webhook, regras de acesso aos cursos, gestão de reembolsos e testes de segurança. Os preços e cursos exibidos são dados fictícios e nenhum pagamento é processado.


## Banco de dados (Supabase / Lovable Cloud)

A migração inicial está em `supabase/migrations/20261018194500_create_course_marketplace_schema.sql`. Ela define perfis, cadastro de instrutores, cursos, módulos, aulas, pedidos, matrículas, progresso, avaliações, buckets de mídia e políticas RLS.

**Importante:** o arquivo de migração já está no GitHub, mas isso não significa que ele já foi executado no projeto Supabase conectado. Aplique/revise a migração no ambiente de banco do Lovable Cloud antes de esperar que o catálogo carregue cursos reais. Até o banco estar preparado, a página usa cursos demonstrativos como fallback.

O fluxo de pagamento ainda não está implementado. Pedidos pagos e matrículas devem ser criados exclusivamente por uma função de backend confiável após confirmação do provedor de pagamento; nunca confie em um status de pagamento enviado pelo navegador.

## Validação automática

O workflow `.github/workflows/ci.yml` executa instalação, lint, testes e build a cada push na `main` e em pull requests. Consulte a aba **Actions** do GitHub para ver o resultado.
