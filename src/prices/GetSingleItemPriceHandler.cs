using SPTarkov.Common.Models.Logging;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Services.Ragfair;
using static LootValuePlus.LootValuePlusStaticRouter;

namespace LootValuePlus;

[Injectable]
public class GetSingleItemPriceHandler
{

    private readonly PriceObtainerService _priceObtainerService;
    private readonly RagfairOfferService _ragfairOfferService;
    private readonly ISptLogger<GetSingleItemPriceHandler> _logger;

    public GetSingleItemPriceHandler(
        PriceObtainerService priceObtainerService,
        RagfairOfferService ragfairOfferService,
        ISptLogger<GetSingleItemPriceHandler> logger)
    {
        this._priceObtainerService = priceObtainerService;
        this._ragfairOfferService = ragfairOfferService;
        this._logger = logger;
    }

    internal async Task<string> Handle(IRequestData requestData)
    {
        var templateIdToLookup = (requestData as GetSinglePriceRequestData)?.TemplateId ?? "";
        var offers = _ragfairOfferService.GetOffersOfType(templateIdToLookup) ?? [];
        var price = _priceObtainerService.GetNormalizedFleaPriceForItem(offers, templateIdToLookup) ?? 0;
        return Math.Floor(price).ToString();
    }

}