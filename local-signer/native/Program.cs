using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal static class Program
{
    private const int MaxMessage = 16384;
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = MaxMessage, RecursionLimit = 8 };

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            // Chrome/Edge supplies the extension origin as the first argument.
            // Installation pins the permitted extension IDs; never trust an origin from stdin for this check.
            if (args.Length < 1 || !Regex.IsMatch(args[0], @"\Achrome-extension://[a-p]{32}/\z")) return 1;
            string allowedPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "allowed-origins.txt");
            if (!File.Exists(allowedPath) || Array.IndexOf(File.ReadAllLines(allowedPath), args[0]) < 0) return 1;
            using (Stream input = Console.OpenStandardInput())
            using (Stream output = Console.OpenStandardOutput())
            {
                try
                {
                    byte[] size = ReadExactly(input, 4);
                    uint length = BitConverter.ToUInt32(size, 0);
                    if (length == 0 || length > MaxMessage) throw new InvalidOperationException("Requisição inválida.");
                    string text = new UTF8Encoding(false, true).GetString(ReadExactly(input, (int)length));
                    var request = Json.Deserialize<Dictionary<string, object>>(text);
                    ValidateRequest(request);
                    object value = Handle(request);
                    Reply(output, new { ok = true, result = value });
                }
                catch (InvalidOperationException error) { Reply(output, new { ok = false, error = error.Message }); }
                catch (CryptographicException) { Reply(output, new { ok = false, error = "Não foi possível usar o certificado. Verifique o driver, a conexão do token e a confirmação do PIN no Windows." }); }
                catch (Exception) { Reply(output, new { ok = false, error = "Não foi possível processar a solicitação no assinador local." }); }
            }
            return 0;
        }
        catch { return 1; }
    }

    internal static void ValidateRequest(Dictionary<string, object> request)
    {
        if (request == null) throw new InvalidOperationException("Requisição inválida.");
        string origin = Text(request, "origin");
        if (origin != "https://oficios.registromanacapuru.com.br" && origin != "http://localhost:3001")
            throw new InvalidOperationException("Site não autorizado.");
        string command = Text(request, "command");
        if (command != "ping" && command != "list" && command != "read" && command != "sign")
            throw new InvalidOperationException("Operação não permitida.");
        var fields = new HashSet<string> { "origin", "command" };
        if (command == "read" || command == "sign")
        {
            fields.Add("thumbprint");
            if (!Regex.IsMatch(Text(request, "thumbprint"), @"\A[A-Fa-f0-9]{40}\z")) throw new InvalidOperationException("Certificado inválido.");
        }
        if (command == "sign")
        {
            fields.Add("hash"); fields.Add("documentLabel");
            string hash = Text(request, "hash");
            if (!Regex.IsMatch(hash, @"\A[A-Za-z0-9+/]{43}=\z") || Convert.FromBase64String(hash).Length != 32)
                throw new InvalidOperationException("Resumo SHA-256 inválido.");
            string label = Text(request, "documentLabel");
            if (label.Length == 0 || label.Length > 200 || Regex.IsMatch(label, @"[\p{C}]"))
                throw new InvalidOperationException("Identificação do documento inválida.");
        }
        foreach (string field in request.Keys)
            if (!fields.Contains(field)) throw new InvalidOperationException("Campo não permitido.");
    }

    private static string Text(Dictionary<string, object> request, string key)
    {
        object value;
        return request.TryGetValue(key, out value) && value is string ? (string)value : "";
    }

    private static bool Usable(X509Certificate2 certificate)
    {
        if (!certificate.HasPrivateKey || certificate.PublicKey.Oid.Value != "1.2.840.113549.1.1.1" ||
            certificate.NotBefore.ToUniversalTime() > DateTime.UtcNow || certificate.NotAfter.ToUniversalTime() <= DateTime.UtcNow) return false;
        foreach (X509Extension extension in certificate.Extensions)
        {
            var constraints = extension as X509BasicConstraintsExtension;
            if (constraints != null && constraints.CertificateAuthority) return false;
            var usage = extension as X509KeyUsageExtension;
            if (usage != null && (usage.KeyUsages & (X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.NonRepudiation)) == 0) return false;
        }
        return true;
    }

    private static object Handle(Dictionary<string, object> request)
    {
        string command = Text(request, "command");
        if (command == "ping") return new { version = 1 };
        using (var store = new X509Store(StoreName.My, StoreLocation.CurrentUser))
        {
            store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
            var certificates = store.Certificates;
            try
            {
                if (command == "list")
                {
                    var result = new List<object>();
                    foreach (X509Certificate2 certificate in certificates)
                    {
                        if (Usable(certificate)) result.Add(new {
                            thumbprint = certificate.Thumbprint,
                            subjectName = certificate.GetNameInfo(X509NameType.SimpleName, false),
                            issuerName = certificate.GetNameInfo(X509NameType.SimpleName, true),
                            validityStart = certificate.NotBefore.ToUniversalTime().ToString("o"),
                            validityEnd = certificate.NotAfter.ToUniversalTime().ToString("o")
                        });
                    }
                    return result;
                }
                foreach (X509Certificate2 certificate in certificates)
                {
                    if (!String.Equals(certificate.Thumbprint, Text(request, "thumbprint"), StringComparison.OrdinalIgnoreCase) || !Usable(certificate)) continue;
                    if (command == "read") return Convert.ToBase64String(certificate.RawData);
                    using (var mutex = new Mutex(false, @"Local\SistemaOficiosSigning"))
                    {
                        bool locked;
                        try { locked = mutex.WaitOne(0); } catch (AbandonedMutexException) { locked = true; }
                        if (!locked) throw new InvalidOperationException("Já existe uma assinatura aguardando confirmação no Windows.");
                        try
                        {
                            // Always obtain local user consent, including for A1 keys which may not ask for a PIN.
                            string message = "Solicitação de " + Text(request, "origin") + "\n\n" +
                                "Documento informado pelo sistema: " + Text(request, "documentLabel") + "\n\n" +
                                "Titular: " + certificate.GetNameInfo(X509NameType.SimpleName, false) + "\n" +
                                "Certificado: " + certificate.Thumbprint + "\n\n" +
                                "Confirme somente se você iniciou esta assinatura no sistema.\nDeseja assinar?";
                            if (MessageBox.Show(message, "Sistema de Ofícios — confirmar assinatura", MessageBoxButtons.YesNo,
                                MessageBoxIcon.Question, MessageBoxDefaultButton.Button2, MessageBoxOptions.DefaultDesktopOnly) != DialogResult.Yes)
                                throw new InvalidOperationException("Assinatura cancelada pelo usuário.");
                            using (RSA key = certificate.GetRSAPrivateKey())
                            {
                                if (key == null) throw new InvalidOperationException("Chave RSA indisponível. Verifique o driver do certificado.");
                                return Convert.ToBase64String(SignDigest(key, Convert.FromBase64String(Text(request, "hash"))));
                            }
                        }
                        finally { mutex.ReleaseMutex(); }
                    }
                }
                throw new InvalidOperationException("Certificado indisponível ou vencido. Atualize a lista e verifique o token.");
            }
            finally { foreach (X509Certificate2 certificate in certificates) certificate.Dispose(); }
        }
    }

    internal static byte[] SignDigest(RSA key, byte[] digest)
    {
        if (digest.Length != 32) throw new InvalidOperationException("Resumo SHA-256 inválido.");
        return key.SignHash(digest, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
    }

    internal static byte[] ReadExactly(Stream input, int count)
    {
        byte[] bytes = new byte[count];
        int offset = 0;
        while (offset < count)
        {
            int read = input.Read(bytes, offset, count - offset);
            if (read == 0) throw new EndOfStreamException();
            offset += read;
        }
        return bytes;
    }

    private static void Reply(Stream output, object value)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(value));
        output.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
        output.Write(bytes, 0, bytes.Length);
        output.Flush();
    }
}
