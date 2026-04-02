using System.Security.Cryptography;
using System.Text;

namespace ReinfApi.Services;

/// <summary>Criptografia AES-256 para senhas de certificados .pfx.</summary>
public class CryptoService
{
    private readonly byte[] _key;

    public CryptoService(IConfiguration cfg)
    {
        var raw = cfg["Crypto:PfxKey"]
            ?? throw new InvalidOperationException("Crypto:PfxKey não configurado em appsettings.");
        // Deriva 32 bytes da chave configurada (SHA-256)
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
    }

    public string Encrypt(string plainText)
    {
        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();

        using var enc = aes.CreateEncryptor();
        var plain = Encoding.UTF8.GetBytes(plainText);
        var cipher = enc.TransformFinalBlock(plain, 0, plain.Length);

        // Formato: IV (16 bytes) + cipher concatenados, em Base64
        var result = new byte[aes.IV.Length + cipher.Length];
        aes.IV.CopyTo(result, 0);
        cipher.CopyTo(result, aes.IV.Length);
        return Convert.ToBase64String(result);
    }

    public string Decrypt(string cipherBase64)
    {
        var data = Convert.FromBase64String(cipherBase64);
        using var aes = Aes.Create();
        aes.Key = _key;

        var iv = data[..16];
        var cipher = data[16..];
        aes.IV = iv;

        using var dec = aes.CreateDecryptor();
        var plain = dec.TransformFinalBlock(cipher, 0, cipher.Length);
        return Encoding.UTF8.GetString(plain);
    }
}
