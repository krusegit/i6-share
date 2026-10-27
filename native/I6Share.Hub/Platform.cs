using System.Runtime.Versioning;

// Native packages target Unix systems, where private data permissions are mandatory.
[assembly: SupportedOSPlatform("linux")]
[assembly: SupportedOSPlatform("macos")]
