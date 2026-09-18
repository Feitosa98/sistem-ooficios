using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;

internal static class Tests
{
    private static int assertions;
    private static void Check(bool value) { assertions++; if (!value) throw new Exception("Assertion failed: " + assertions); }
    private static Dictionary<string, object> Request(string command)
    {
        return new Dictionary<string, object> { { "origin", "https://oficios.registromanacapuru.com.br" }, { "command", command } };
    }
    private static void Reject(Dictionary<string, object> request)
    {
        try { Program.ValidateRequest(request); } catch (InvalidOperationException) { assertions++; return; }
        throw new Exception("Invalid request accepted");
    }
    public static int Main()
    {
        Program.ValidateRequest(Request("ping"));
        var request = Request("sign");
        request["thumbprint"] = new string('a', 40);
        request["hash"] = Convert.ToBase64String(new byte[32]);
        request["documentLabel"] = "Ofício nº 1/2026";
        Program.ValidateRequest(request);
        request["origin"] = "https://oficios.registromanacapuru.com.br.evil.test"; Reject(request);
        request["origin"] = "https://oficios.registromanacapuru.com.br";
        request["hash"] = Convert.ToBase64String(new byte[31]); Reject(request);
        request["hash"] = Convert.ToBase64String(new byte[32]);
        request["documentLabel"] = "Ofício\nOculto"; Reject(request);
        request["documentLabel"] = "Ofício";
        request["privateKey"] = "not permitted"; Reject(request);
        Reject(Request("export"));
        Reject(null);
        using (var rsa = new RSACng(2048))
        using (var sha = SHA256.Create())
        {
            byte[] digest = sha.ComputeHash(new byte[] { 1, 2, 3, 4 });
            byte[] signature = Program.SignDigest(rsa, digest);
            Check(rsa.VerifyHash(digest, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
            Check(!rsa.VerifyData(digest, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
            signature[0] ^= 1;
            Check(!rsa.VerifyHash(digest, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        }
        // CSP-backed tokens and CNG-backed tokens use the same digest contract.
        using (var rsa = new RSACryptoServiceProvider(2048, new CspParameters(24) { Flags = CspProviderFlags.CreateEphemeralKey }))
        {
            byte[] digest = new byte[32];
            byte[] signature = Program.SignDigest(rsa, digest);
            Check(rsa.VerifyHash(digest, signature, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1));
        }
        using (var stream = new MemoryStream(new byte[] { 1, 2, 3 }))
        {
            Check(Program.ReadExactly(stream, 2)[1] == 2);
            try { Program.ReadExactly(stream, 2); throw new Exception("Truncation not detected"); }
            catch (EndOfStreamException) { assertions++; }
        }
        Console.WriteLine("Native signer: " + assertions + " assertions passed (ephemeral key only).");
        return 0;
    }
}
