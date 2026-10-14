namespace LootValuePlus;

using SPTarkov.Server.Core.Models.Spt.Mod;
using Range = SemanticVersioning.Range;
using Version = SemanticVersioning.Version;

public record ModMetadata : IModMetadata
{
    public string ModGuid { get; init; } = "com.rpan87.lootvalueplus";
    public string Name { get; init; } = "LootValuePlusServer";
    public string Author { get; init; } = "rp-an-87";
    public List<string>? Contributors { get; init; }
    public Version Version { get; init; } = new("4.1.6");
    public Range SptVersion { get; init; } = new("~4.1.6");

    
    public string? License { get; init; } = "MIT";

    public bool HasPrepatcher { get; init; } = false;

    /// <summary>
    /// A list of mod GUIDs that are incompatible with this mod.
    /// Leave null when the mod has no known incompatibilities.
    /// </summary>
    public List<string>? Incompatibilities { get; init; }

    /// <summary>
    /// A collection of mod GUIDs and the Semantic Versioning ranges of their required versions.
    /// Use this to declare mods that must be installed for this mod to function correctly.
    /// Leave null when the mod has no dependencies.
    /// </summary>
    public Dictionary<string, SemanticVersioning.Range>? ModDependencies { get; init; }
    
    /// <summary>
    /// An optional URL where users can find more information about the mod,
    /// such as its documentation, source code, or download page.
    /// Leave null when no URL is available.
    /// </summary>
    public string? Url { get; init; } = "https://github.com/rp-an-87/LootValuePlus-Server";
}