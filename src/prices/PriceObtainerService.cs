using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Models.Eft.Ragfair;
using SPTarkov.Server.Core.Models.Enums;
using SPTarkov.Server.Core.Models.Spt.Config;
using SPTarkov.Server.Core.Services.Ragfair;

namespace LootValuePlus;

[Injectable]
public class PriceObtainerService
{

    private readonly RagfairPriceService _ragfairPriceService;
    private readonly RagfairConfig _ragfairConfig;

    public PriceObtainerService(
        RagfairPriceService ragfairPriceService,
        RagfairConfig ragfairConfig
    )
    {
        _ragfairPriceService = ragfairPriceService;
        _ragfairConfig = ragfairConfig;
    }

    public double? GetNormalizedFleaPriceForItem(IEnumerable<RagfairOffer> offers, string templateId)
    {
        var offersByPlayers = offers.Where(o => o.User?.MemberType != MemberCategory.Trader);
        var fleaPriceForItem = _ragfairPriceService.GetFleaPriceForItem(templateId);
        var avgPriceOfItemInFleaMarket = Utils.GetAvgPriceOfOffers(offersByPlayers);
        fleaPriceForItem = Utils.NormalizeStandardPriceWithOffersAverage(fleaPriceForItem, avgPriceOfItemInFleaMarket);
        var multiplier = Utils.GetPriceMultiplierForItem(_ragfairConfig, templateId);
        fleaPriceForItem *= multiplier;
        return fleaPriceForItem;
    }

}