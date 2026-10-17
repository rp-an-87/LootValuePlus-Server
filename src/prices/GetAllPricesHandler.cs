using System.Text.Json;
using System.Text.Json.Serialization;
using SPTarkov.Common.Models.Logging;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Helpers.Items;
using SPTarkov.Server.Core.Models.Spt.Tables;

namespace LootValuePlus;

[Injectable]
public class GetAllPricesHandler
{
    private readonly PriceObtainerService _priceObtainerService;
    private readonly ISptLogger<GetAllPricesHandler> _logger;
    private readonly TemplateTable _templateTable;
    private readonly ItemHelper _itemHelper;

    public GetAllPricesHandler(
        PriceObtainerService priceObtainerService,
        ISptLogger<GetAllPricesHandler> logger,
        TemplateTable templateTable,
        ItemHelper itemHelper)
    {
        _priceObtainerService = priceObtainerService;
        _templateTable = templateTable;
        _logger = logger;
        _itemHelper = itemHelper;
    }

    public async Task<string> Handle()
    {

        var responseOffers = new List<ParsedOffer>();
        var items = _templateTable.Items.Values.Where(i => i.Properties?.CanSellOnRagfair == true && i.Type != "Node");

        foreach (var item in items)
        {
            var price = _priceObtainerService.GetAverageFleaPriceForItem(item.Id);
            responseOffers.Add(new ParsedOffer(item.Id.ToString(), (long)Math.Floor(price)));
        }
        
        var response = new Response(responseOffers);
        var serialized = JsonSerializer.Serialize(response);
        return serialized;
    }

    private record ParsedOffer(
        [property: JsonPropertyName("templateId")] string TemplateId,
        [property: JsonPropertyName("price")] long Price
    );

    private record Response([property: JsonPropertyName("prices")] List<ParsedOffer> Offers);
}
