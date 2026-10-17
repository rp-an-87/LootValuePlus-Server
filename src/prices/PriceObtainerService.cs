using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Controllers;
using SPTarkov.Server.Core.Models.Eft.Ragfair;
using SPTarkov.Server.Core.Models.Spt.Config;

namespace LootValuePlus;

[Injectable]
public class PriceObtainerService
{

    private readonly RagfairController _ragfairController;
    private readonly RagfairConfig _ragfairConfig;

    public PriceObtainerService(
        RagfairController ragfairController,
        RagfairConfig ragfairConfig
    )
    {
        _ragfairController = ragfairController;
        _ragfairConfig = ragfairConfig;
    }

    /// <summary>
    /// Returns the exact average price SPT itself compares a player's offer against when rolling for a sale
    /// (see RagfairController.AddPlayerOffer), so listing at this price gives the max sell chance.
    /// </summary>
    public double GetAverageFleaPriceForItem(string templateId)
    {
        var averages = _ragfairController.GetItemMinAvgMaxFleaPriceValues(new GetMarketPriceRequestData { TemplateId = templateId });
        var multiplier = Utils.GetPriceMultiplierForItem(_ragfairConfig, templateId);
        return (averages.Avg ?? 0) * multiplier;
    }

}
