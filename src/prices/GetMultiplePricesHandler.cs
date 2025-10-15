
using System.Text.Json;
using System.Text.Json.Serialization;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Services;
using static LootValuePlus.LootValuePlusStaticRouter;

namespace LootValuePlus;

[Injectable]
public class GetMultiplePricesHandler
{

    private readonly PriceObtainerService _priceObtainerService;
    private readonly RagfairOfferService _ragfairOfferService;

    public GetMultiplePricesHandler(
        PriceObtainerService priceObtainerService,
        RagfairOfferService ragfairOfferService)
    {
        this._priceObtainerService = priceObtainerService;
        this._ragfairOfferService = ragfairOfferService;
    }


    public async Task<string> Handle(IRequestData requestData)
    {
        var templateIdsToLookup = (requestData as GetMultiplePricesRequestData)?.TemplateIds ?? [];

        var parsedPrices = new List<ParsedPrice>();
        foreach (var templateId in templateIdsToLookup)
        {
            var offers = _ragfairOfferService.GetOffersOfType(templateId) ?? [];
            var price = _priceObtainerService.GetNormalizedFleaPriceForItem(offers, templateId) ?? 0;
            var parsedPrice = new ParsedPrice(templateId, Math.Floor(price));
            parsedPrices.Add(parsedPrice);
        }

        var response = new Response(parsedPrices);
        var serialized = JsonSerializer.Serialize(response);
        return serialized;
    }


    private record ParsedPrice(
        [property: JsonPropertyName("templateId")] string TemplateId,
        [property: JsonPropertyName("price")] double Price
    );

    private record Response([property: JsonPropertyName("prices")] List<ParsedPrice> Offers);
}
