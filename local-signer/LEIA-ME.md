# Assinador local do Sistema de Ofícios

Permite iniciar e concluir a assinatura na tela do sistema, com confirmação em uma janela do Windows. Não usa a biblioteca nem a licença Lacuna. O serviço do site continua responsável por validar o certificado, a assinatura, a cadeia de confiança e a revogação.

## Requisitos

- Windows 10/11 com .NET Framework 4.8 e Chrome ou Edge.
- A1: importar o `.pfx`/`.p12` pelo assistente do Windows para **Usuário Atual → Pessoal**, incluindo sua chave privada. A senha é informada no Windows, não no site.
- A3 físico: instalar o driver oficial do fabricante e conectar o token/cartão. O certificado precisa aparecer no repositório **Pessoal do Usuário Atual** do Windows (`certmgr.msc`), com acesso à chave privada por CSP/CNG. Dispositivos que oferecem somente PKCS#11, certificados em nuvem e certificados não RSA não estão contemplados nesta versão.
- Certificados RSA aptos a assinatura SHA-256/PKCS#1 v1.5. O servidor aplica as regras de confiança configuradas no sistema.

## Instalação simplificada (1 clique)

1. Extraia o pacote completo (arquivo ZIP) para uma pasta permanente no seu computador (por exemplo, `Documentos\AssinadorOficios`).
2. Dê um duplo clique no arquivo **`instalar.bat`** (ele registra automaticamente o componente local no Chrome e Edge sem precisar digitar comandos).
3. No Chrome abra `chrome://extensions` (ou no Edge abra `edge://extensions`):
   - Ative a chave **Modo do desenvolvedor** (no canto superior direito).
   - Clique no botão **Carregar sem compactação** (ou "Carregar extensão descompactada").
   - Selecione a pasta **`extension`** que está dentro da pasta onde você extraiu o assinador.
4. Pronto! O ID da extensão agora é fixo (`nfhjmjmoniplgdemofngjapmnlkfpcge`) e pré-autorizado. Recarregue o sistema de ofícios.

> **Dica:** Não apague nem mova a pasta após a instalação. Se precisar desinstalar futuramente, basta dar um duplo clique em `desinstalar.bat`.

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
