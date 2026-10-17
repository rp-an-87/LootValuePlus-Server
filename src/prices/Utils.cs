using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Spt.Config;

namespace LootValuePlus;

public class Utils
{
    public static double GetPriceMultiplierForItem(RagfairConfig config, MongoId id)
    {
        return config.Dynamic.ItemPriceMultiplier.GetValueOrDefault(id, 1.0);
    }
}
