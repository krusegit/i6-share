using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace I6Share.Hub.Protocol;

internal sealed class ProtocolException(string message, Exception? innerException) : Exception(message, innerException)
{
    public ProtocolException() : this("Invalid wire protocol message.", null) { }
    public ProtocolException(string message) : this(message, null) { }
}

internal sealed record WireFrame(JsonElement Json, byte[] Binary);
internal sealed record OpenedEnvelope(JsonElement Json, byte[] Binary, byte[] Iv);
internal sealed record SealedEnvelope(byte[] Body, byte[] Iv);

/// <summary>Version-one byte codecs. JSON metadata is supplied explicitly for Native AOT.</summary>
internal static class WireCrypto
{
    private const int IvSize = 12;
    private const int TagSize = 16;

    public static byte[] PairKey(ReadOnlySpan<byte> token, string hubId)
    {
        return DeriveKey(token, "i6-share-pair", hubId);
    }

    public static byte[] DeviceKey(ReadOnlySpan<byte> secret, string deviceId)
    {
        return DeriveKey(secret, "i6-share-v1", deviceId);
    }

    private static byte[] DeriveKey(ReadOnlySpan<byte> secret, string salt, string info)
    {
        var key = new byte[32];
        HKDF.DeriveKey(HashAlgorithmName.SHA256, secret, key, Encoding.UTF8.GetBytes(salt), Encoding.UTF8.GetBytes(info));
        return key;
    }

    public static string RequestAad(string operation, string deviceId)
    {
        return $"i6 req {operation} {deviceId}";
    }

    public static string ResponseAad(string operation, ReadOnlySpan<byte> requestIv)
    {
        return $"i6 res {operation} {Base64Url(requestIv)}";
    }

    public static string Base64Url(ReadOnlySpan<byte> bytes)
    {
        return Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static byte[] FromBase64Url(string encoded)
    {
        try
        {
            var text = encoded.Replace('-', '+').Replace('_', '/');
            return Convert.FromBase64String(text + new string('=', (4 - (text.Length % 4)) % 4));
        }
        catch (FormatException error)
        {
            throw new ProtocolException("invalid base64url", error);
        }
    }

    public static byte[] Serialize<T>(T value, JsonTypeInfo<T> metadata)
    {
        return JsonSerializer.SerializeToUtf8Bytes(value, metadata);
    }

    public static byte[] Frame(ReadOnlySpan<byte> jsonUtf8, ReadOnlySpan<byte> binary = default)
    {
        var frame = new byte[checked(sizeof(uint) + jsonUtf8.Length + binary.Length)];
        BinaryPrimitives.WriteUInt32BigEndian(frame, (uint)jsonUtf8.Length);
        jsonUtf8.CopyTo(frame.AsSpan(sizeof(uint)));
        binary.CopyTo(frame.AsSpan(sizeof(uint) + jsonUtf8.Length));
        return frame;
    }

    public static WireFrame Unframe(ReadOnlySpan<byte> frame)
    {
        if (frame.Length < sizeof(uint))
        {
            throw new ProtocolException("bad frame");
        }

        var length = BinaryPrimitives.ReadUInt32BigEndian(frame);
        if (length > frame.Length - sizeof(uint))
        {
            throw new ProtocolException("bad frame");
        }

        try
        {
            using var json = JsonDocument.Parse(frame.Slice(sizeof(uint), (int)length).ToArray());
            return json.RootElement.ValueKind != JsonValueKind.Object
                ? throw new ProtocolException("frame JSON must be an object")
                : new WireFrame(json.RootElement.Clone(), frame[(sizeof(uint) + (int)length)..].ToArray());
        }
        catch (JsonException error)
        {
            throw new ProtocolException("invalid frame JSON", error);
        }
    }

    public static SealedEnvelope Seal(ReadOnlySpan<byte> key, string aad, ReadOnlySpan<byte> jsonUtf8, ReadOnlySpan<byte> binary = default, byte[]? iv = null)
    {
        var nonce = iv is null ? RandomNumberGenerator.GetBytes(IvSize) : (byte[])iv.Clone();
        if (nonce.Length != IvSize)
        {
            throw new ProtocolException("invalid IV length");
        }

        var plaintext = Frame(jsonUtf8, binary);
        var body = new byte[IvSize + plaintext.Length + TagSize];
        nonce.CopyTo(body, 0);
        using var cipher = new AesGcm(key, TagSize);
        cipher.Encrypt(nonce, plaintext, body.AsSpan(IvSize, plaintext.Length), body.AsSpan(IvSize + plaintext.Length, TagSize), Encoding.UTF8.GetBytes(aad));
        return new SealedEnvelope(body, nonce);
    }

    public static OpenedEnvelope Open(ReadOnlySpan<byte> key, string aad, ReadOnlySpan<byte> body)
    {
        if (body.Length < IvSize + TagSize)
        {
            throw new ProtocolException("short envelope");
        }

        var nonce = body[..IvSize].ToArray();
        var plaintext = new byte[body.Length - IvSize - TagSize];
        try
        {
            using var cipher = new AesGcm(key, TagSize);
            cipher.Decrypt(nonce, body.Slice(IvSize, plaintext.Length), body[^TagSize..], plaintext, Encoding.UTF8.GetBytes(aad));
        }
        catch (CryptographicException error)
        {
            throw new ProtocolException("bad authentication", error);
        }
        var frame = Unframe(plaintext);
        return new OpenedEnvelope(frame.Json, frame.Binary, nonce);
    }
}
