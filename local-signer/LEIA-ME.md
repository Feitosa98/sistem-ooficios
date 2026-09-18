# Assinador local do Sistema de Ofícios

Permite iniciar e concluir a assinatura na tela do sistema, com confirmação em uma janela do Windows. Não usa a biblioteca nem a licença Lacuna. O serviço do site continua responsável por validar o certificado, a assinatura, a cadeia de confiança e a revogação.

## Requisitos

- Windows 10/11 com .NET Framework 4.8 e Chrome ou Edge.
- A1: importar o `.pfx`/`.p12` pelo assistente do Windows para **Usuário Atual → Pessoal**, incluindo sua chave privada. A senha é informada no Windows, não no site.
- A3 físico: instalar o driver oficial do fabricante e conectar o token/cartão. O certificado precisa aparecer no repositório **Pessoal do Usuário Atual** do Windows (`certmgr.msc`), com acesso à chave privada por CSP/CNG. Dispositivos que oferecem somente PKCS#11, certificados em nuvem e certificados não RSA não estão contemplados nesta versão.
- Certificados RSA aptos a assinatura SHA-256/PKCS#1 v1.5. O servidor aplica as regras de confiança configuradas no sistema.

## Instalação por computador e usuário

1. Extraia o pacote completo para uma pasta permanente, por exemplo `Documentos\AssinadorOficios`. Não carregue a extensão dentro do ZIP.
2. No Chrome, abra `chrome://extensions`; no Edge, `edge://extensions`.
3. Ative **Modo do desenvolvedor** e use **Carregar sem compactação** para selecionar a pasta `extension` do pacote. A versão inicial é distribuída manualmente; ainda não está publicada nas lojas dos navegadores. Se a organização bloquear extensões manuais, o administrador deve aprovar a distribuição.
4. Copie o **ID da extensão** mostrado pelo navegador (32 letras).
5. Abra o PowerShell na pasta do pacote e execute, substituindo o ID:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -ExtensionId "ID_COPIADO_DO_NAVEGADOR"
   ```

   O script registra o componente somente para seu usuário, no Chrome e Edge. Não precisa executar como administrador. Se os dois navegadores mostrarem IDs diferentes, passe ambos em uma sessão PowerShell:

   ```powershell
   .\install.ps1 -ExtensionId "ID_DO_CHROME", "ID_DO_EDGE"
   ```

6. Recarregue `https://oficios.registromanacapuru.com.br/`. Na assinatura, selecione **Assinador local — Windows, A1 e A3**.
7. Escolha o certificado e clique em **Assinar**. Confira o site, o documento e o titular na janela local. Confirme e informe o PIN no diálogo do driver, se solicitado. Aguarde o sistema confirmar que o PDF foi gravado.

Não mova a pasta da extensão depois de carregá-la. Se mudar o ID, execute novamente o instalador. O executável desta versão não possui assinatura Authenticode; verifique a origem do pacote e siga as políticas de instalação da organização.

## Limites e diagnóstico

- O novo código também precisa estar publicado no site. Instalar o componente não atualiza o servidor.
- O A3 deve ser homologado com o modelo e driver usados no cartório. Não há garantia de suporte universal a tokens.
- Se a lista estiver vazia, verifique a instalação do A1, o driver do A3, a validade do certificado e o repositório do usuário atual. Reconecte o token e tente atualizar a lista.
- Se o servidor rejeitar a cadeia ou a revogação, configure as raízes, intermediárias e listas de revogação apropriadas. O assinador local não desativa essas verificações.
- O componente aceita somente o domínio do sistema e `http://localhost:3001` para desenvolvimento. A instalação autoriza somente os IDs de extensão informados.
- A chave privada nunca é exportada pelo assinador. O site recebe o certificado público e a assinatura. O PIN é tratado pelo Windows/driver.
- Uma assinatura pendente pode manter a janela do Windows aberta. Feche/cancele essa solicitação antes de repetir; nenhuma assinatura é salva pelo site sem concluir a validação.
- Para remover, execute `uninstall.ps1` e remova a extensão pelo navegador. Isso não remove seus certificados.

## Compilar e testar

Na raiz do projeto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File local-signer/build.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File local-signer/test.ps1
node --test tests/local-signer.test.mjs
```

O pacote é gerado em `local-signer/dist`. Os testes usam chaves efêmeras e não acessam os certificados pessoais nem pedem o PIN. A homologação com A1/A3 reais deve usar um documento de teste autorizado.

## Referências de implementação

- [Native Messaging no Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging)
- [Native Messaging no Edge](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/native-messaging)
- [Acesso à chave RSA do certificado no .NET](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.x509certificates.rsacertificateextensions.getrsaprivatekey)
