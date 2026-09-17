# Correções e análise de melhorias — Sistema de Ofícios

Atualização: 16/09/2026. As alterações estão no projeto local. Não houve publicação nem alteração do banco de produção.

## Resultado

Os nove achados da avaliação inicial receberam correções no código. A compilação passou, o TypeScript passou sem erros e os 18 testes automatizados passaram. A assinatura também foi exercitada com o Worker compilado no runtime local da Cloudflare, com D1 e R2 isolados. Foram usados certificados e documentos fictícios; nenhum e-mail real foi enviado.

O teste no runtime identificou uma incompatibilidade do formato de chave pública na verificação RSA. A verificação foi adaptada para Web Crypto e o fluxo completo passou após a correção.

| Problema original | Comportamento após a correção |
| --- | --- |
| Assinatura arbitrária e certificado inválido | Verificação criptográfica, validade, cadeia de confiança e listas de revogação antes da aceitação. Identidade obtida do certificado. |
| Upload sempre recusado | Leitura correta dos bytes do PDF. Arquivos sem assinatura válida são recusados. |
| Sessões perdidas entre instâncias | Sessão vinculada ao usuário, ofício e versão no D1; PDF preparado no R2. |
| Substituição de documentos concluídos | Atualização condicional por versão, chave de arquivo única e bloqueio de alteração de documentos assinados, enviados ou arquivados. |
| Falta de autorização nas APIs | Autenticação e cadastro ativo exigidos em todas as rotas. Configurações e gestão de acessos restritas ao administrador. |
| Token privado exposto | Respostas de configuração retornam somente indicadores de presença. Campos secretos vazios preservam o valor existente. |
| SMTP sem validação TLS ou encerramento adequado | Validação do certificado do servidor, TLS/STARTTLS, prazo máximo de 30 segundos e tratamento de fechamento antecipado. |
| Busca limitada a 500 ofícios | Paginação, busca e totais calculados no servidor sobre o acervo completo. |
| Envio duplicado após falhas | Registro único por documento e destinatário; resultado incerto bloqueia nova tentativa automática. |

Também foram adicionados controle de versão na interface, tratamento de erro sem exposição de detalhes internos, tela de gestão dos usuários, proteção da página inicial e comandos de compilação/análise compatíveis com Windows. A gravação da assinatura, a conclusão da sessão e seu evento de auditoria ocorrem na mesma transação do D1. Uma repetição da conclusão devolve o documento já salvo.

## Acessos

A migração `drizzle/0006_integrity_and_access.sql` prepara:

- **Administrador ativo:** `iagofeitosa3@gmail.com`.
- **Operadores pendentes:** Késsila, Marcellus, Altair, Lucas e Gilvany, preservando seus nomes completos no cadastro.

Os cinco operadores ficam sem e-mail e sem acesso até o administrador informar o endereço de login e marcar “Acesso liberado” na tela de configurações. Ser signatário de um documento não equivale a ter uma conta liberada.

Essa migração foi aplicada apenas em bancos descartáveis dos testes. O cadastro inicial ainda precisa ser aplicado ao banco da publicação. O login depende dos cabeçalhos autenticados fornecidos pelo gateway Sites. O Worker não deve ser publicado diretamente em uma entrada que permita ao visitante definir esses cabeçalhos. Uma hospedagem diferente exige autenticação verificável apropriada a ela.

## Ativação na publicação

1. Fazer backup do banco e aplicar as migrações pendentes pelo processo de publicação que gerencia o D1, incluindo a migração 0006. Não reaplicar manualmente uma migração já registrada.
2. Publicar o código e conferir o login do administrador pelo gateway autenticado.
3. Configurar no servidor as autoridades e informações de revogação:
   - `SIGNATURE_TRUSTED_ROOTS_PEM`: raízes confiáveis, obtidas de fonte oficial e revisadas.
   - `SIGNATURE_INTERMEDIATES_PEM`: autoridades intermediárias necessárias à cadeia dos certificados usados.
   - `SIGNATURE_CRLS_PEM`: listas de revogação completas, assinadas e ainda válidas para cada emissor da cadeia, exceto a raiz de confiança.
4. Renovar essas listas antes do vencimento. Na ausência de informações válidas, a assinatura é recusada.
5. Conferir a licença Web PKI do domínio e validar um fluxo com o certificado e o leitor realmente usados pelo cartório. Configurar o provedor de e-mail e realizar um envio controlado autorizado.
6. Informar os cinco e-mails pendentes na tela de acessos.

O token Rest PKI permanece protegido e preservado, mas não implementa, por si só, uma integração com validação em nuvem ou carimbo do tempo. A presença de configuração no painel não garante que sua cadeia esteja completa ou suas listas atualizadas.

## Limites que permanecem

- A validação atual aceita certificados RSA de pelo menos 2048 bits e verifica a situação no momento da operação. Não implementa validação histórica de longo prazo, carimbo do tempo, consulta automática OCSP nem tratamento de listas de revogação delta/indiretas.
- No upload externo, além da assinatura criptográfica, o conteúdo e os recursos das páginas precisam corresponder ao PDF gerado pelo sistema. A comparação é conservadora: PDFs reescritos pelo assinador ou com carimbos visuais sobre as páginas podem ser recusados. Usar assinatura sem aparência visual e sem editar o original; homologar o fluxo ONR/Adobe real antes da publicação.
- Os documentos já assinados no banco anterior não foram revalidados retroativamente. O status antigo não constitui prova de que passaram pelas novas verificações.
- O envio automático evita repetir o mesmo documento para o mesmo destinatário. Um resultado incerto requer conferência do operador. Ainda não há uma tela para reconciliar tentativas ou autorizar reenvio deliberado.
- A auditoria adicionada registra assinaturas e mudanças de acesso; ainda não cobre todas as edições e transições.
- PDFs preparados expiram logicamente em dez minutos, mas a remoção física de sessões/arquivos temporários ainda precisa de uma rotina de retenção. Nunca aplicar limpeza ao prefixo de documentos assinados.
- Não houve teste manual do token A3, envio SMTP real nem inspeção visual completa em navegadores e celulares.

## Melhorias recomendadas, em ordem

| Prioridade | Melhoria | Benefício e critério de conclusão |
| --- | --- | --- |
| Antes da ativação | Homologar confiança, revogação e certificados reais | Confirmar uma assinatura válida e a recusa de certificado não confiável, revogado ou vencido no ambiente publicado. |
| Antes da ativação | Revisar os documentos assinados anteriormente | Separar o acervo legado validado dos registros que dependem de conferência. |
| Alta | Automatizar atualização das listas de revogação ou integrar serviço especializado | Evitar interrupções por listas vencidas, com monitoramento de atualização e falha explícita. |
| Alta | Histórico de envio e reconciliação pelo administrador | Exibir destinatário, horário, resultado e identificador do provedor; permitir reenvio explícito e auditado quando necessário. |
| Alta | Backup e teste de restauração de D1 e R2 | Restaurar um ofício com seu documento e metadados em ambiente isolado. |
| Média | Auditoria de criação, edição, envio e arquivamento | Registrar autor, data e mudança, com consulta administrativa. |
| Média | Separar a interface em módulos de acervo, editor, envio e configurações | Reduzir o tamanho de `components/oficios-app.tsx` e permitir alterações menores com testes focados. |
| Média | Melhorar busca textual e numeração | Tratar acentos e variações de número; avaliar índice de busca conforme o volume real. |
| Média | Testes de navegador e acessibilidade | Validar teclado, foco de diálogos, mensagens de erro e telas pequenas nos fluxos reais. |
| Média | Retenção de sessões e monitoramento operacional | Remover somente temporários vencidos e acompanhar falhas de assinatura, arquivos ausentes e envios incertos. |

## Verificação reproduzível

No Windows, usar `npm.cmd`; nos demais ambientes, `npm`.

- `npm run typecheck`: sem erros.
- `npm run lint`: sem erros ou avisos.
- `npm test`: recompila e executa a suíte; 18 testes aprovados.
- Os testes abrangem acesso, cadastro inicial, busca em 610 registros, conflitos de versão, segredos, envio repetido/incerto, SMTP, assinatura CMS/RSA real com certificados fictícios, revogação e listas vencidas, upload, persistência/idempotência da sessão, componentes e Worker compilado com D1/R2.

Os testes de banco usam instâncias temporárias. Não fornecem credenciais nem conexão com o banco de produção.
