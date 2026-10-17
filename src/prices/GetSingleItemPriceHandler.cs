using SPTarkov.Common.Models.Logging;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Models.Utils;
using static LootValuePlus.LootValuePlusStaticRouter;

namespace LootValuePlus;

[Injectable]
public class GetSingleItemPriceHandler
{

    private readonly PriceObtainerService _priceObtainerService;
    private readonly ISptLogger<GetSingleItemPriceHandler> _logger;

    public GetSingleItemPriceHandler(
        PriceObtainerService priceObtainerService,
        ISptLogger<GetSingleItemPriceHandler> logger)
    {
        this._priceObtainerService = priceObtainerService;
        this._logger = logger;
    }

    internal async Task<string> Handle(IRequestData requestData)
    {
        var templateIdToLookup = (requestData as GetSinglePriceRequestData)?.TemplateId ?? "";
        var price = _priceObtainerService.GetAverageFleaPriceForItem(templateIdToLookup);
        return Math.Floor(price).ToString();
    }

}