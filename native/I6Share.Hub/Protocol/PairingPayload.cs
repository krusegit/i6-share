using System.Buffers.Binary;
using System.Globalization;
using System.Net;
using System.Text;
using I6Share.Contracts;

namespace I6Share.Hub.Protocol;

internal sealed record PairingCode(string HubId, byte[] Token, int Port, IReadOnlyList<string> Addrs, string Name);

internal static class PairingPayload
{
    public static string Link(string payload)
    {
        return $"{WireConstants.AppUrl}#pair={payload}";
    }

    public static string Encode(PairingCode payload)
    {
        if (payload.HubId.Length != 16 || !payload.HubId.All(Uri.IsHexDigit))
        {
            throw new ProtocolException("invalid hub id");
        }

        if (payload.Token.Length != 16)
        {
            throw new ProtocolException("invalid pairing token");
        }

        if (payload.Port is < 1 or > ushort.MaxValue)
        {
            throw new ProtocolException("invalid port");
        }

        var addresses = payload.Addrs.Select(ParseAddress).OfType<byte[]>().Take(8).ToArray();
        var name = Encoding.UTF8.GetBytes(payload.Name[..Math.Min(40, payload.Name.Length)]);
        var bytes = new byte[28 + addresses.Sum(address => address.Length + 1) + name.Length];
        bytes[0] = WireConstants.ProtocolVersion;
        Convert.FromHexString(payload.HubId).CopyTo(bytes, 1);
        payload.Token.CopyTo(bytes, 9);
        BinaryPrimitives.WriteUInt16BigEndian(bytes.AsSpan(25), (ushort)payload.Port);
        bytes[27] = (byte)addresses.Length;
        var offset = addresses.Aggregate(28, (position, address) =>
        {
            bytes[position] = address.Length == 4 ? (byte)4 : (byte)6;
            address.CopyTo(bytes, position + 1);
            return position + address.Length + 1;
        });
        name.CopyTo(bytes, offset);
        return WireCrypto.Base64Url(bytes);
    }

    public static PairingCode Decode(string encoded)
    {
        var bytes = WireCrypto.FromBase64Url(encoded.Trim());
        if (bytes.Length == 0 || bytes[0] != WireConstants.ProtocolVersion)
        {
            throw new ProtocolException("unsupported pairing code");
        }

        if (bytes.Length < 28)
        {
            throw new ProtocolException("truncated pairing code");
        }

        var offset = 28;
        var addresses = new List<string>(bytes[27]);
        for (var index = 0; index < bytes[27]; index++)
        {
            if (offset >= bytes.Length)
            {
                throw new ProtocolException("truncated pairing code");
            }

            var family = bytes[offset++];
            if (family is not (4 or 6))
            {
                throw new ProtocolException("unsupported address family");
            }

            var length = family == 4 ? 4 : 16;
            if (offset + length > bytes.Length)
            {
                throw new ProtocolException("truncated pairing code");
            }

            addresses.Add(new IPAddress(bytes.AsSpan(offset, length)).ToString());
            offset += length;
        }
        return new PairingCode(Convert.ToHexStringLower(bytes.AsSpan(1, 8)), bytes.AsSpan(9, 16).ToArray(),
            BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(25)), addresses.AsReadOnly(), Encoding.UTF8.GetString(bytes.AsSpan(offset)));
    }

    /// <summary>Parse the same strict IPv4/IPv6 spellings accepted by the phone codec.</summary>
    public static byte[]? ParseAddress(string address)
    {
        var value = address.StartsWith('[') ? address[1..] : address;
        value = value.EndsWith(']') ? value[..^1] : value;
        var zone = value.IndexOf('%');
        if (zone >= 0)
        {
            value = value[..zone];
        }

        if (value.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase) && value.Contains('.'))
        {
            value = value[7..];
        }

        if (value.Contains('.'))
        {
            var octets = value.Split('.');
            return octets.Length == 4 && octets.All(part => part.Length > 0 && part.All(char.IsAsciiDigit) && byte.TryParse(part, NumberStyles.None, CultureInfo.InvariantCulture, out _))
                ? [.. octets.Select(part => byte.Parse(part, NumberStyles.None, CultureInfo.InvariantCulture))]
                : null;
        }
        if (!value.Contains(':'))
        {
            return null;
        }

        var halves = value.Split("::", StringSplitOptions.None);
        if (halves.Length > 2)
        {
            return null;
        }

        var head = Groups(halves[0]);
        var tail = halves.Length == 2 ? Groups(halves[1]) : [];
        var missing = 8 - head.Length - tail.Length;
        if (halves.Length == 2 && missing < 1)
        {
            return null;
        }

        var groups = head.Concat(Enumerable.Repeat("0", halves.Length == 2 ? missing : 0)).Concat(tail).ToArray();
        return groups.Length != 8 || groups.Any(group => group.Length is < 1 or > 4 || !group.All(Uri.IsHexDigit))
            ? null
            : [.. groups.SelectMany(group =>
        {
            var number = ushort.Parse(group, NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            return new[] { (byte)(number >> 8), (byte)number };
        })];
    }

    private static string[] Groups(string value)
    {
        return value.Length == 0 ? [] : value.Split(':');
    }
}
