using I6Share.Contracts;
using I6Share.Hub.Protocol;

namespace I6Share.Hub.Tests;

public sealed partial class CoreExtraTests
{
    private static readonly string[] ConcurrentDeviceIds = ["1234567890abcdef", "abcdefabcdefabcd"];

    [Fact]
    public async Task RejectsUnknownRoutesMalformedDeviceIdsOversizedBodiesAndInvalidAuthentication()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var empty = new Dictionary<string, string>();
        Assert.Equal(200, (await s.Hub.HandleAsync("GET", "/", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(200, (await s.Hub.HandleAsync("GET", "/index.html", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(200, (await s.Hub.HandleAsync("POST", "/i6/hello", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(200, (await s.Hub.HandleAsync("GET", "/i6/hello", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(404, (await s.Hub.HandleAsync("GET", "/i6/sync", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(404, (await s.Hub.HandleAsync("POST", "/i6/unknown", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(404, (await s.Hub.HandleAsync("POST", "/other", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(400, (await s.Hub.HandleAsync("POST", "/i6/sync", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(400, (await s.Hub.HandleAsync("POST", "/i6/sync", new Dictionary<string, string> { ["d"] = "ABCDEFGHIJKLMNOP" }, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/sync", new Dictionary<string, string> { ["d"] = "ffffffffffffffff" }, ReadOnlyMemory<byte>.Empty, "")).Status);
        Assert.Equal(413, (await s.Hub.HandleAsync("POST", "/i6/sync", empty, new byte[WireConstants.MaxBody + 1], "")).Status);
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/pair", empty, ReadOnlyMemory<byte>.Empty, "")).Status);
        var paired = await s.PairAsync();
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/sync", new Dictionary<string, string> { ["d"] = paired.DeviceId }, new byte[] { 0, 1, 2 }, "")).Status);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"bad\",\"files\":[]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":null}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[null]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{}]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{\"size\":-1}]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{\"size\":1.5}]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{\"size\":9007199254740992}]}")]
    [InlineData(/*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"files\":[{\"size\":0,\"name\":9}]}")]
    public async Task RejectsMalformedOffersBeforeCreatingFiles(string json)
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var response = await s.SendAsync(await s.PairAsync(), "offer", json);
        Assert.Equal(400, response.Status);
        Assert.Equal("bad-request", response.Json.GetProperty("error").GetString());
        Assert.Empty((await s.Hub.GetStatusAsync()).Transfers);
    }

    [Theory]
    [InlineData("put", "{}")]
    [InlineData("put", /*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"i\":-1,\"offset\":0}")]
    [InlineData("put", /*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"i\":0,\"offset\":-1}")]
    [InlineData("put", /*lang=json,strict*/ "{\"tid\":\"abcdefabcdefabcdefabcdef\",\"i\":0,\"offset\":0.1}")]
    [InlineData("end", "{}")]
    [InlineData("cancel", /*lang=json,strict*/ "{\"tid\":\"bad\"}")]
    [InlineData("pulled", /*lang=json,strict*/ "{\"tid\":\"bad\"}")]
    [InlineData("pull", /*lang=json,strict*/ "{\"tid\":\"bad\",\"i\":0,\"offset\":0,\"length\":1}")]
    public async Task RejectsMalformedTransferCommands(string operation, string json)
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        Assert.Equal(400, (await s.SendAsync(await s.PairAsync(), operation, json)).Status);
    }

    [Fact]
    public async Task OneTimePairingCanRetryOnlyForItsDeviceAndCannotBeReusedAfterRevocation()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var code = await s.Hub.NewPairCodeAsync();
        var first = await s.PairAsync(code: code);
        var retry = await s.PairAsync(code: code);
        Assert.Equal(first.Key, retry.Key);
        var payload = PairingPayload.Decode(code.Payload);
        var pairKey = WireCrypto.PairKey(payload.Token, payload.HubId);
        var other = WireCrypto.Seal(pairKey, WireCrypto.RequestAad("pair", "pair"), /*lang=json,strict*/ "{\"deviceId\":\"abcdefabcdefabcd\"}"u8);
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/pair", new Dictionary<string, string> { ["h"] = payload.HubId }, other.Body, "")).Status);
        Assert.True(await s.Hub.RevokeAsync(first.DeviceId));
        var original = WireCrypto.Seal(pairKey, WireCrypto.RequestAad("pair", "pair"), /*lang=json,strict*/ "{\"deviceId\":\"1234567890abcdef\"}"u8);
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/pair", new Dictionary<string, string> { ["h"] = payload.HubId }, original.Body, "")).Status);
        Assert.Equal(401, (await s.SendAsync(first, "sync")).Status);
        Assert.False(await s.Hub.RevokeAsync(first.DeviceId));
    }

    [Fact]
    public async Task PairCodesExpireAndOnlyTheFiveNewestRemainValid()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var old = await s.Hub.NewPairCodeAsync();
        var payload = PairingPayload.Decode(old.Payload);
        var key = WireCrypto.PairKey(payload.Token, payload.HubId);
        var envelope = WireCrypto.Seal(key, WireCrypto.RequestAad("pair", "pair"), /*lang=json,strict*/ "{\"deviceId\":\"1234567890abcdef\"}"u8);
        for (var index = 0; index < 5; index++)
        {
            _ = await s.Hub.NewPairCodeAsync();
        }

        var query = new Dictionary<string, string> { ["h"] = payload.HubId };
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/pair", query, envelope.Body, "")).Status);
        var current = PairingPayload.Decode((await s.Hub.NewPairCodeAsync()).Payload);
        var expired = WireCrypto.Seal(WireCrypto.PairKey(current.Token, current.HubId), WireCrypto.RequestAad("pair", "pair"), /*lang=json,strict*/ "{\"deviceId\":\"1234567890abcdef\"}"u8);
        s.Time = s.Time.AddMilliseconds(WireConstants.PairTokenTtlMs);
        Assert.Equal(401, (await s.Hub.HandleAsync("POST", "/i6/pair", query, expired.Body, "")).Status);
    }

    [Fact]
    public async Task ConcurrentPairingOfDifferentDevicesConsumesTheTokenOnlyOnce()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var payload = PairingPayload.Decode((await s.Hub.NewPairCodeAsync()).Payload);
        var key = WireCrypto.PairKey(payload.Token, payload.HubId);
        var requests = ConcurrentDeviceIds.Select(id =>
        {
            var envelope = WireCrypto.Seal(key, WireCrypto.RequestAad("pair", "pair"), WireCrypto.Serialize(new PairRequest { DeviceId = id }, WireJsonContext.Default.PairRequest));
            return s.Hub.HandleAsync("POST", "/i6/pair", new Dictionary<string, string> { ["h"] = payload.HubId }, envelope.Body, "");
        });
        var replies = await Task.WhenAll(requests);
        _ = Assert.Single(replies, reply => reply.Status == 200);
        _ = Assert.Single(replies, reply => reply.Status == 401);
        _ = Assert.Single((await s.Hub.GetStatusAsync()).Devices);
    }

    [Fact]
    public async Task ResponsesAreCryptographicallyBoundToTheExactRequestNonce()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var session = await s.PairAsync();
        var request = WireCrypto.Seal(session.Key, WireCrypto.RequestAad("sync", session.DeviceId), "{}"u8);
        var response = await s.Hub.HandleAsync("POST", "/i6/sync", new Dictionary<string, string> { ["d"] = session.DeviceId }, request.Body, "");
        Assert.Equal(200, response.Status);
        Assert.NotEmpty(WireCrypto.Open(session.Key, WireCrypto.ResponseAad("sync", request.Iv), response.Body).Json.GetRawText());
        _ = Assert.Throws<ProtocolException>(() => WireCrypto.Open(session.Key, WireCrypto.ResponseAad("sync", new byte[12]), response.Body));
    }

    [Fact]
    public async Task RejectsOversizedPairingAndAuthenticatedInvalidDeviceIdentity()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var payload = PairingPayload.Decode((await s.Hub.NewPairCodeAsync()).Payload);
        var query = new Dictionary<string, string> { ["h"] = payload.HubId };
        Assert.Equal(413, (await s.Hub.HandleAsync("POST", "/i6/pair", query, new byte[65537], "")).Status);
        var key = WireCrypto.PairKey(payload.Token, payload.HubId);
        var invalid = WireCrypto.Seal(key, WireCrypto.RequestAad("pair", "pair"), /*lang=json,strict*/ "{\"deviceId\":\"invalid\"}"u8);
        Assert.Equal(400, (await s.Hub.HandleAsync("POST", "/i6/pair", query, invalid.Body, "")).Status);
    }

    [Fact]
    public async Task UpdatesOnlyTheAuthenticatedDeviceAndSupportsEncryptedUnpairing()
    {
        var s = await Scenario.CreateAsync();
        await using var sLifetime = s.ConfigureAwait(true);
        var first = await s.PairAsync();
        var second = await s.PairAsync("abcdefabcdefabcd");
        Assert.Equal(200, (await s.SendAsync(first, "sync", /*lang=json,strict*/ "{\"name\":\"Renamed\",\"os\":\"Linux\"}")).Status);
        var state = await s.Hub.GetStatusAsync();
        Assert.Equal("Renamed", Assert.Single(state.Devices, device => device.DeviceId == first.DeviceId).Name);
        Assert.Equal("Test Phone", Assert.Single(state.Devices, device => device.DeviceId == second.DeviceId).Name);
        Assert.True((await s.SendAsync(first, "unpair")).Json.GetProperty("ok").GetBoolean());
        Assert.Equal(second.DeviceId, Assert.Single((await s.Hub.GetStatusAsync()).Devices).DeviceId);
        Assert.Equal(401, (await s.SendAsync(first, "sync")).Status);
    }

}
