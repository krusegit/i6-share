using System.Net;
using System.Security.Cryptography;
using System.Text;

namespace I6Share.Hub.Hosting;

internal static class AdminSecurity
{
    public static string NewToken()
    {
        return Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
    }

    public static bool TokenEquals(string value, string expected)
    {
        return value.Length == expected.Length && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(value), Encoding.UTF8.GetBytes(expected));
    }

    public static bool IsLocal(HttpRequest request, IPAddress? remoteAddress)
    {
        if (remoteAddress is null || !IPAddress.IsLoopback(remoteAddress.IsIPv4MappedToIPv6 ? remoteAddress.MapToIPv4() : remoteAddress))
        {
            return false;
        }

        var host = request.Host.Host.Trim('[', ']');
        return host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || (IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address));
    }

    public static bool HasValidOrigin(HttpRequest request)
    {
        var origin = request.Headers.Origin;
        return origin.Count == 0 || (origin.Count == 1 && string.Equals(origin[0], $"{request.Scheme}://{request.Host}", StringComparison.OrdinalIgnoreCase));
    }

    public static bool IsAuthorized(HttpRequest request, string token)
    {
        var authorization = request.Headers.Authorization;
        var expected = $"Bearer {token}";
        return authorization.Count == 1 && authorization[0] is { } value && TokenEquals(value, expected);
    }
}
