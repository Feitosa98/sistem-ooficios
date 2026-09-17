# Avaliação técnica — Sistema de Ofícios

Data: 16/09/2026. Escopo: código local, compilação, análise estática e testes isolados com dados fictícios.

> Registro da avaliação inicial. Para o estado após as correções, consulte [Correções e análise de melhorias](./MELHORIAS-E-VALIDACAO.md). As referências de linha abaixo correspondem à versão avaliada originalmente.

## Parecer

O sistema reúne os fluxos de cadastro, modelos, geração de PDF, assinatura e envio de ofícios. A compilação funciona e o gerador produz PDFs curtos e longos. Entretanto, há falhas de integridade na assinatura e no armazenamento do documento, além de um bloqueio no upload. Recomendo corrigir os itens de prioridade alta antes de confiar no sistema para o fluxo completo de documentos oficiais.

Esta avaliação não é uma validação jurídica de assinaturas. Não foram usados certificados particulares, enviados e-mails reais ou alterados dados de produção. A política de acesso da hospedagem não foi consultada; portanto, a ausência de autorização no código não prova, por si só, que o site publicado esteja aberto ao público. A interface não foi inspecionada visualmente no navegador.

## Achados prioritários

### 1. Alta — assinatura direta aceita certificado e assinatura inválidos

Referências: `lib/pades-signature.ts:145`, `lib/pades-signature.ts:557` e `app/api/oficios/[id]/sign-direct/complete/route.ts:74`.

A leitura de um certificado inválido retorna dados fictícios de ICP-Brasil em vez de rejeitar a entrada. Na conclusão, os bytes recebidos são inseridos no contêiner de assinatura sem verificação criptográfica contra a chave pública e os atributos assinados. A rota registra o resultado como “Assinado”.

**Reprodução:** executei as funções reais com um PDF gerado localmente, um certificado composto por 128 bytes zero e uma assinatura de apenas um byte. A conclusão retornou um PDF de 34.203 bytes sem erro. Isso não produz uma assinatura válida; demonstra que o sistema declara sucesso sem comprová-la.

**Correção:** rejeitar certificados malformados, verificar a assinatura criptográfica e aplicar a política de confiança/validade do certificado antes de registrar sucesso. Não fabricar identidade ou validade quando a leitura falhar.

### 2. Alta — upload de PDF rejeita arquivos válidos

Referência: `app/api/oficios/[id]/signed-document/route.ts:58`.

`file.arrayBuffer()` retorna um `ArrayBuffer`, mas a validação usa `bytes.length`. Essa propriedade é indefinida; a fatia resultante fica vazia e nunca contém `%PDF-`.

**Reprodução:** um PDF válido gerado por `pdf-lib` recebeu HTTP 400 com “O arquivo enviado não é um PDF válido”, antes de qualquer acesso ao banco.

**Correção:** usar `byteLength`. Além disso, verificar efetivamente a assinatura e a correspondência com o ofício; a checagem do cabeçalho, mesmo corrigida, só identifica o formato do arquivo.

### 3. Alta — sessão de assinatura depende da memória de uma única instância

Referências: `lib/pades-signature.ts:317`, `:464` e `:563`.

O início grava o PDF preparado em um `Map` global; a conclusão procura esse mesmo estado. Uma nova instância ou reinicialização não possui a sessão. O token também é removido antes da montagem e persistência definitiva, impedindo uma recuperação simples se uma etapa posterior falhar.

**Reprodução:** preparei uma sessão em uma instância do módulo e tentei concluí-la em outra. O resultado foi “Sessão de assinatura expirada ou não encontrada”, mesmo dentro do prazo.

**Correção:** persistir a sessão em armazenamento compartilhado, com expiração e consumo atômico; guardar PDFs fora da memória global. A documentação de [boas práticas do Cloudflare Workers](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/#do-not-store-request-scoped-state-in-global-scope) também orienta a evitar estado de requisições em variáveis globais.

### 4. Alta — conclusão pode sobrescrever documento arquivado e alterar o signatário

Referência: `app/api/oficios/[id]/sign-direct/complete/route.ts:43`.

A conclusão verifica apenas a existência do ofício. Não revalida seu estado nem a versão do conteúdo preparada no início. Grava sempre na mesma chave de arquivo, volta o estado para “Assinado” e aceita `signerName` diretamente do navegador.

**Reprodução:** com banco e armazenamento simulados, a rota aceitou um registro “Arquivado”, sobrescreveu sua chave de PDF, mudou o estado para “Assinado” e gravou um nome arbitrário enviado pelo cliente. A função criptográfica foi simulada neste teste para isolar o comportamento da rota.

**Impacto:** uma sessão pendente pode concluir após outra operação ter enviado/arquivado ou editado o ofício. O cadastro pode divergir do PDF e o arquivo anterior pode ser perdido.

**Correção:** vincular a sessão ao identificador, versão/hash do conteúdo e identidade verificada; revalidar tudo na conclusão; usar atualização condicional e armazenamento versionado. Derivar o signatário do certificado validado no servidor.

### 5. Alta — APIs não aplicam autorização de usuário ou administrador

Referências: `app/api/oficios/route.ts:20`, `app/api/configuracoes/email/route.ts:27` e `app/api/configuracoes/pki/route.ts:22`.

As rotas de negócio não verificam identidade nem permissões. O helper de identidade é utilizado em `/api/usuario-atual`, mas consultar essa rota no navegador não protege as demais. O código também não diferencia operadores de administradores nas configurações.

**Evidência:** as chamadas isoladas de configuração e conclusão executaram sem cabeçalhos de autenticação. Não foi testada a barreira externa da hospedagem.

**Correção:** confirmar a política efetiva da hospedagem e impor autorização no servidor para cada operação, especialmente configuração de credenciais, assinatura e envio. Registrar o usuário responsável pelas mudanças.

### 6. Alta — token privado do REST PKI é devolvido ao navegador

Referências: `app/api/configuracoes/pki/route.ts:5` e `lib/pades-signature.ts:655`.

O GET devolve integralmente a configuração, incluindo `restPkiToken`; o POST também devolve a configuração recebida. Isso é diferente da licença de Web PKI utilizada no cliente: um token privado do serviço REST deve permanecer no servidor.

**Reprodução:** um token fictício configurado no mock foi devolvido integralmente pelo GET. Não foi lida nem exposta nenhuma credencial real.

**Correção:** devolver apenas um indicador de configuração do token, restringir a edição a administradores e manter o segredo no servidor. Avaliar rotação caso um token real tenha sido disponibilizado a usuários sem autorização.

### 7. Alta — SMTP desativa validação do certificado TLS

Referências: `lib/email.ts:222` e `lib/email.ts:286`.

Tanto a conexão TLS direta quanto o STARTTLS usam `rejectUnauthorized: false`. No comportamento documentado do Node.js, isso permite continuar com um certificado não confiável, expondo credenciais e conteúdo em caso de interceptação. [Documentação de TLS](https://nodejs.org/api/tls.html#tlsconnectoptions-callback).

**Correção:** validar certificado e hostname, exigir transporte seguro e definir timeout e tratamento de encerramento para conexões SMTP. A implementação atual não define prazo de conexão/resposta e ignora o evento de fechamento sem concluir a operação.

Este achado resulta da leitura do código; não foi feita conexão a servidor SMTP real nem simulação de interceptação no runtime da hospedagem.

### 8. Média — histórico e busca ficam limitados a 500 ofícios

Referências: `app/api/oficios/route.ts:31` e `app/page.tsx:956`.

A API retorna somente 500 registros, sem paginação. A busca e os indicadores são calculados no navegador sobre esse subconjunto. Acima desse volume, documentos antigos deixam de aparecer na busca e os totais deixam de representar o acervo completo.

**Correção:** adicionar paginação e filtros no servidor, com contagens agregadas independentes da página carregada.

### 9. Média — envio não possui proteção contra duplicação

Referência: `app/api/oficios/[id]/enviar-email/route.ts:77`.

O e-mail é enviado antes da atualização no banco. Se o envio funcionar e a atualização falhar, a API retorna erro apesar de já ter enviado a mensagem. Uma repetição pode enviar novamente. Requisições simultâneas também não possuem chave de idempotência ou registro exclusivo de tentativa.

**Correção:** registrar tentativas de envio, usar idempotência quando suportada pelo provedor e distinguir “falha confirmada” de “resultado desconhecido”. Preservar histórico de destinatário, horário, documento e identificador do provedor.

## Verificações executadas

- Compilação: concluída com sucesso pelo CLI local do Vinext. O invólucro do projeto exige utilitários Linux, então foi chamado diretamente no Windows.
- TypeScript: 25 erros. Incluem tipos ausentes do runtime Cloudflare, uso incorreto de `ArrayBuffer.length`, incompatibilidade de corpo de resposta e análise de inicialização da variável de página no gerador PDF. Nem todo erro estático representa uma falha em execução.
- ESLint em `app`, `lib`, `db`, `worker` e no diálogo Web PKI: 15 erros e 4 avisos.
- Testes de PDF em memória: geração e reabertura de documento curto com 1 página e longo com 13 páginas. Não houve inspeção visual das páginas.
- Reproduções isoladas: assinatura inválida aceita; sessão ausente em segunda instância; upload válido rejeitado; conclusão sobre ofício arquivado; nome de signatário arbitrário; retorno de token fictício pelo endpoint PKI.
- Testes existentes após a compilação: 5 executados, 3 aprovados e 2 reprovados. O teste de HTML não consegue importar `cloudflare:workers` pelo carregador padrão do Node; o teste de CSS não encontra a regra esperada `scrollbar-width: none`. A primeira falha é uma incompatibilidade do ambiente de teste e não demonstra que a página falhe no runtime Cloudflare.

Os testes de reprodução usaram o código TypeScript transpilado, com dependências de banco/armazenamento simuladas quando necessário. Demonstram os comportamentos descritos, mas não substituem testes de ponta a ponta na hospedagem.

## Pontos positivos e manutenção

- Há índice único no banco para número, ano e sufixo, protegendo contra duplicidade desses campos.
- A edição completa bloqueia ofícios com documento assinado associado; a mesma regra precisa ser preservada em todos os caminhos de alteração.
- Downloads de documentos assinados usam `private, no-store` e `nosniff`.
- O upload de modelos remove o arquivo recém-criado se a inserção no banco falhar.
- A página principal concentra 3.441 linhas, e o diálogo de assinatura, 1.343. Separar cadastro, consulta, configurações e assinatura facilitará manutenção e testes.
- Os testes existentes são centrados no template visual; faltam cenários automatizados de autenticação, transições de estado, assinatura, concorrência e envio.
- O README ainda descreve o projeto-base. Faltam instruções específicas de operação, migração, recuperação e configuração do sistema de ofícios.

## Ordem sugerida de correção

1. Validação criptográfica, proteção de acesso e tratamento de segredos.
2. Upload, persistência da sessão e conclusão consistente/versionada da assinatura.
3. Segurança e confiabilidade do envio de e-mail.
4. Paginação, testes dos fluxos principais, correção das verificações estáticas e documentação.

Nenhum código funcional foi alterado nesta avaliação. A compilação gerou artefatos locais em `dist`; este relatório é o único documento de avaliação adicionado.
