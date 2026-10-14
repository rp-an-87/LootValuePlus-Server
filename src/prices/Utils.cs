using SPTarkov.Server.Core.Models.Common;
using SPTarkov.Server.Core.Models.Eft.Ragfair;
using SPTarkov.Server.Core.Models.Spt.Config;

namespace LootValuePlus;

public class Utils
{
    public static double NormalizeStandardPriceWithOffersAverage(
        double fleaItemPrice,
        double avgPriceOfItemInFleaMarket
    )
    {
        if (avgPriceOfItemInFleaMarket <= 0)
        {
            return fleaItemPrice;
        }

        double diffPercent =
            Math.Abs(fleaItemPrice - avgPriceOfItemInFleaMarket) / avgPriceOfItemInFleaMarket;

        if (diffPercent > 0.1)
        {
            var random = new Random();
            double randomMultiplier = random.NextDouble() * (1.1 - 0.9) + 0.9; // 0.9–1.1 range
            return avgPriceOfItemInFleaMarket * randomMultiplier;
        }

        return fleaItemPrice;
    }

    public static double GetPriceMultiplierForItem(RagfairConfig config, MongoId id)
    {
        return config.Dynamic.ItemPriceMultiplier.GetValueOrDefault(id, 1.0);
    }

    public static double GetAvgPriceOfOffers(IEnumerable<RagfairOffer> offers)
    {
        if (!offers.Any())
            return 0;

        var allPrices = offers.Select(o =>
        {
            if (o.SellInOnePiece == true)
            {
                return o.SummaryCost / o.Quantity;
            }
            else
            {
                return o.SummaryCost;
            }
        });

        var sum = allPrices.Sum();
        var mean = sum / allPrices.Count();
        return (double)mean;
    }
}