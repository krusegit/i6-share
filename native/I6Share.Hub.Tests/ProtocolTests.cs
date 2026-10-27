using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using I6Share.Contracts;
using I6Share.Hub.Protocol;

namespace I6Share.Hub.Tests;

public sealed class ProtocolTests
{
    private const string HubId = "0123456789abcdef";
    private static byte[] Sequence(int length)
    {
        return [.. Enumerable.Range(0, length).Select(number => (byte)number)];
    }

    private static PairingCode Payload => new(HubId, Sequence(16), WireConstants.Port, ["192.168.1.10", "fd00::1", "garbage"], "Linux PC");

    [Fact]
    public void FrameUsesBigEndianLengthAndPreservesBinaryViews()
    {
        var bytes = new byte[] { 8, 9 };
        Assert.Equal(new byte[] { 0, 0, 0, 7, 123, 34, 97, 34, 58, 49, 125, 9 }, WireCrypto.Frame(/*lang=json,strict*/ "{\"a\":1}"u8, bytes.AsSpan(1)));
        var frame = WireCrypto.Unframe(WireCrypto.Frame(/*lang=json,strict*/ "{\"a\":[\"x\",true,null]}"u8, [1, 2]));
        Assert.Equal("x", frame.Json.GetProperty("a")[0].GetString());
        Assert.Equal(new byte[] { 1, 2 }, frame.Binary);
        Assert.Empty(WireCrypto.Unframe(WireCrypto.Frame("{}"u8)).Binary);
        Assert.Equal(JsonValueKind.Object, WireCrypto.Unframe(WireCrypto.Frame("{}"u8)).Json.ValueKind);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("1")]
    [InlineData("\"a\"")]
    public void RejectsNonObjectFrameJson(string json)
    {
        Assert.Equal("frame JSON must be an object", Assert.Throws<ProtocolException>(() => WireCrypto.Unframe(WireCrypto.Frame(Encoding.UTF8.GetBytes(json)))).Message);
    }

    [Fact]
    public void RejectsTruncatedAndMalformedFrames()
    {
        Assert.Equal("bad frame", Assert.Throws<ProtocolException>(() => WireCrypto.Unframe([0, 0, 0])).Message);
        Assert.Equal("bad frame", Assert.Throws<ProtocolException>(() => WireCrypto.Unframe([0, 0, 0, 2, 123])).Message);
        Assert.Equal("bad frame", Assert.Throws<ProtocolException>(() => WireCrypto.Unframe([255, 255, 255, 255])).Message);
        var error = Assert.Throws<ProtocolException>(() => WireCrypto.Unframe([0, 0, 0, 1, 33]));
        Assert.Equal("invalid frame JSON", error.Message);
        _ = Assert.IsType<JsonException>(error.InnerException, exactMatch: false);
    }

    [Fact]
    public void Base64UrlIsCompatibleWithBrowserAndRejectsInvalidInput()
    {
        Assert.Equal("-_8", WireCrypto.Base64Url([251, 255]));
        Assert.Equal(new byte[] { 251, 255 }, WireCrypto.FromBase64Url("-_8"));
        Assert.Empty(WireCrypto.Base64Url([]));
        Assert.Empty(WireCrypto.FromBase64Url(""));
        Assert.Equal("invalid base64url", Assert.Throws<ProtocolException>(() => WireCrypto.FromBase64Url("!")).Message);
    }

    [Fact]
    public void MatchesLegacyBrowserPairingEnvelopeExactly()
    {
        const string vector = "AAECAwQFBgcICQoLgAgrG5Zx-VkuP2tUJaVX8tt_NGPOYwizA6igexufdhT_0W2VChcYBuBOYzY_W5jviudbagV97VvbqTGjkCC1QNcwkP_3_CX9JC9zc0UmWagfDd_-CMg";
        var key = WireCrypto.PairKey(Sequence(16), HubId);
        var dto = new PairRequest { DeviceId = "fedcba9876543210", Name = "Test Phone", Os = "Android" };
        var json = WireCrypto.Serialize(dto, WireJsonContext.Default.PairRequest);
        var aad = WireCrypto.RequestAad("pair", "pair");
        Assert.Equal("i6 req pair pair", aad);
        Assert.Equal(dto, WireCrypto.Open(key, aad, WireCrypto.FromBase64Url(vector)).Json.Deserialize(WireJsonContext.Default.PairRequest));
        var sealedEnvelope = WireCrypto.Seal(key, aad, json, iv: Sequence(12));
        Assert.Equal(vector, WireCrypto.Base64Url(sealedEnvelope.Body));
        Assert.Equal(Sequence(12), sealedEnvelope.Iv);
        Assert.Equal("i6 res pair AAECAwQFBgcICQoL", WireCrypto.ResponseAad("pair", sealedEnvelope.Iv));
    }

    [Fact]
    public void MatchesLegacyBrowserUploadEnvelopeExactly()
    {
        const string vector = "AAECAwQFBgcICQoLJDNzwMfI45S70Pi_iz1kAHET7xlxG6AjwhMXwI5SW9ZV6XRiV_Em3BG7hONJFzqx8LAvxQOkL7Ji4rquPqxwXX3057ylqX2nQLk";
        var key = WireCrypto.DeviceKey(Sequence(32), HubId);
        var dto = new PutRequest { Tid = "0123456789abcdef01234567", I = 0, Offset = 4 };
        var aad = WireCrypto.RequestAad("put", HubId);
        var opened = WireCrypto.Open(key, aad, WireCrypto.FromBase64Url(vector));
        Assert.Equal(dto, opened.Json.Deserialize(WireJsonContext.Default.PutRequest));
        Assert.Equal(new byte[] { 1, 2, 3 }, opened.Binary);
        Assert.Equal(Sequence(12), opened.Iv);
        var body = WireCrypto.Seal(key, aad, WireCrypto.Serialize(dto, WireJsonContext.Default.PutRequest), [1, 2, 3], Sequence(12)).Body;
        Assert.Equal(vector, WireCrypto.Base64Url(body));
    }

    [Fact]
    public void AuthenticatesKeyAadCiphertextAndResponseRequestBinding()
    {
        var secret = Enumerable.Repeat((byte)42, 32).ToArray();
        var key = WireCrypto.DeviceKey(secret, "device");
        var other = WireCrypto.PairKey(secret, "device");
        Assert.NotEqual(key, other);
        var envelope = WireCrypto.Seal(key, "aad", /*lang=json,strict*/ "{\"hello\":\"world\"}"u8, [2, 4, 8]);
        Assert.Equal(12, envelope.Iv.Length);
        Assert.Equal("world", WireCrypto.Open(key, "aad", envelope.Body).Json.GetProperty("hello").GetString());
        _ = Assert.Throws<ProtocolException>(() => WireCrypto.Open(other, "aad", envelope.Body));
        _ = Assert.Throws<ProtocolException>(() => WireCrypto.Open(key, "wrong", envelope.Body));
        envelope.Body[15] ^= 1;
        Assert.Equal("bad authentication", Assert.Throws<ProtocolException>(() => WireCrypto.Open(key, "aad", envelope.Body)).Message);
        Assert.Equal("short envelope", Assert.Throws<ProtocolException>(() => WireCrypto.Open(key, "aad", new byte[27])).Message);
        Assert.Equal("invalid IV length", Assert.Throws<ProtocolException>(() => WireCrypto.Seal(key, "aad", "{}"u8, iv: [1])).Message);
        Assert.Equal("invalid frame JSON", Assert.Throws<ProtocolException>(() => WireCrypto.Open(key, "aad", WireCrypto.Seal(key, "aad", "!"u8).Body)).Message);
        var requestIv = Sequence(12);
        var responseAad = WireCrypto.ResponseAad("sync", requestIv);
        var response = WireCrypto.Seal(key, responseAad, "{}"u8);
        requestIv[0] = 42;
        _ = Assert.Throws<ProtocolException>(() => WireCrypto.Open(key, WireCrypto.ResponseAad("sync", requestIv), response.Body));
    }

    [Fact]
    public void ClonesInjectedIvAndRejectsInternalKeyMisuse()
    {
        var iv = Sequence(12);
        var key = WireCrypto.PairKey([], HubId);
        var sealedEnvelope = WireCrypto.Seal(key, "aad", "{}"u8, iv: iv);
        iv[0] = 123;
        Assert.Equal(0, sealedEnvelope.Iv[0]);
        _ = Assert.Throws<CryptographicException>(() => WireCrypto.Seal([1], "aad", "{}"u8));
        _ = Assert.Throws<ProtocolException>(() => WireCrypto.Open([1], "aad", sealedEnvelope.Body));
    }

    [Fact]
    public void EncodesExactLegacyPairingVectorAndRoundTripsFields()
    {
        const string vector = "AQEjRWeJq83vAAECAwQFBgcICQoLDA0OD7oAAgTAqAEKBv0AAAAAAAAAAAAAAAAAAAFMaW51eCBQQw";
        Assert.Equal(vector, PairingPayload.Encode(Payload));
        var decoded = PairingPayload.Decode($" {vector} ");
        Assert.Equal(HubId, decoded.HubId);
        Assert.Equal(Payload.Token, decoded.Token);
        Assert.Equal(WireConstants.Port, decoded.Port);
        Assert.Equal(["192.168.1.10", "fd00::1"], decoded.Addrs);
        Assert.Equal(Payload.Name, decoded.Name);
        Assert.Equal(WireConstants.AppUrl + "#pair=" + vector, PairingPayload.Link(vector));
        var empty = PairingPayload.Decode(PairingPayload.Encode(Payload with
        {
            Addrs = [],
            Name = ""
        }));
        Assert.Empty(empty.Addrs);
        Assert.Empty(empty.Name);
        var capped = PairingPayload.Decode(PairingPayload.Encode(Payload with
        {
            Addrs = [.. Enumerable.Repeat("10.0.0.1", 12)],
            Name = new string('x', 50)
        }));
        Assert.Equal(8, capped.Addrs.Count);
        Assert.Equal(new string('x', 40), capped.Name);
        Assert.Equal("臺灣 😀", PairingPayload.Decode(PairingPayload.Encode(Payload with
        {
            Name = "臺灣 😀"
        })).Name);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(65536)]
    [InlineData(-1)]
    public void RejectsInvalidPairingPorts(int port)
    {
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Encode(Payload with { Port = port }));
    }

    [Fact]
    public void RejectsBadPairingIdentityTokenVersionAndTruncation()
    {
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Encode(Payload with { HubId = "bad" }));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Encode(Payload with { HubId = "0123456789abcdeg" }));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Encode(Payload with { Token = new byte[15] }));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(""));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(WireCrypto.Base64Url([2])));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(WireCrypto.Base64Url([1])));
        var bytes = WireCrypto.FromBase64Url(PairingPayload.Encode(Payload));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(WireCrypto.Base64Url(bytes.AsSpan(0, 28))));
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(WireCrypto.Base64Url(bytes.AsSpan(0, 30))));
        bytes[28] = 5;
        _ = Assert.Throws<ProtocolException>(() => PairingPayload.Decode(WireCrypto.Base64Url(bytes)));
        BinaryPrimitives.WriteUInt16BigEndian(bytes.AsSpan(25), 65535);
        bytes[28] = 4;
        Assert.Equal(65535, PairingPayload.Decode(WireCrypto.Base64Url(bytes)).Port);
    }

    [Theory]
    [InlineData("192.168.0.1", "c0a80001")]
    [InlineData("[::1]", "00000000000000000000000000000001")]
    [InlineData("::ffff:192.168.1.2", "c0a80102")]
    [InlineData("1:2:3:4:5:6:7:8", "00010002000300040005000600070008")]
    [InlineData("fe80::%eth0", "fe800000000000000000000000000000")]
    [InlineData("::", "00000000000000000000000000000000")]
    [InlineData("1::", "00010000000000000000000000000000")]
    [InlineData("::abcd", "0000000000000000000000000000abcd")]
    [InlineData("::ffff:1234", "000000000000000000000000ffff1234")]
    public void ParsesStrictAddresses(string address, string hex)
    {
        Assert.Equal(Convert.FromHexString(hex), PairingPayload.ParseAddress(address));
    }

    [Theory]
    [InlineData("invalid")]
    [InlineData("256.1.1.1")]
    [InlineData("1.1.1")]
    [InlineData("1..1.1")]
    [InlineData("a.1.1.1")]
    [InlineData("1::2::3")]
    [InlineData("1:2:3:4:5:6:7:8::")]
    [InlineData("1:2")]
    [InlineData("zz::1")]
    [InlineData("12345::1")]
    [InlineData("1:2:3:4:5:6:7:8:9")]
    [InlineData(":1:2:3:4:5:6:7")]
    [InlineData("1:2:3:4:5:6:7:")]
    public void RejectsMalformedAddresses(string address)
    {
        Assert.Null(PairingPayload.ParseAddress(address));
    }
    [Fact]
    public void ProtocolErrorsRetainTheirMessageAndCause()
    {
        var cause = new IOException("invalid frame");
        Assert.Equal("Invalid wire protocol message.", new ProtocolException().Message);
        var error = new ProtocolException("invalid body", cause);
        Assert.Equal("invalid body", error.Message);
        Assert.Same(cause, error.InnerException);
    }

}
