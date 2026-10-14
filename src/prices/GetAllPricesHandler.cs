using System.Text.Json;
using System.Text.Json.Serialization;
using SPTarkov.Common.Models.Logging;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.Helpers.Items;
using SPTarkov.Server.Core.Models.Eft.Ragfair;
using SPTarkov.Server.Core.Models.Enums;
using SPTarkov.Server.Core.Models.Spt.Tables;
using SPTarkov.Server.Core.Services.Ragfair;

namespace LootValuePlus;

[Injectable]
public class GetAllPricesHandler
{
    private readonly RagfairOfferService _ragfairOfferService;
    private readonly PriceObtainerService _priceObtainerService;
    private readonly ISptLogger<GetAllPricesHandler> _logger;
    private readonly TemplateTable _templateTable;
    private readonly ItemHelper _itemHelper;

    public GetAllPricesHandler(
        RagfairOfferService ragfairOfferService,
        PriceObtainerService priceObtainerService,
        ISptLogger<GetAllPricesHandler> logger,
        TemplateTable templateTable,
        ItemHelper itemHelper)
    {
        _ragfairOfferService = ragfairOfferService;
        _priceObtainerService = priceObtainerService;
        _templateTable = templateTable;
        _logger = logger;
        _itemHelper = itemHelper;
    }

    public async Task<string> Handle()
    {

        var responseOffers = new List<ParsedOffer>();
        var offersByTemplate = GetAllUserOffersByTemplateId();
        var items = _templateTable.Items.Values.Where(i => i.Properties?.CanSellOnRagfair == true && i.Type != "Node");

        foreach (var item in items)
        {
            var offersForItem = offersByTemplate.GetValueOrDefault(item.Id, []);
            var price = _priceObtainerService.GetNormalizedFleaPriceForItem(offersForItem, item.Id) ?? 0;
            responseOffers.Add(new ParsedOffer(item.Id.ToString(), (long)Math.Floor(price)));
        }
        
        var response = new Response(responseOffers);
        var serialized = JsonSerializer.Serialize(response);
        return serialized;
    }

    private Dictionary<string, List<RagfairOffer>> GetAllUserOffersByTemplateId()
    {
        var offers = _ragfairOfferService
            .GetOffers()
            .Where(o => o.User?.MemberType != MemberCategory.Trader)
            .Where(o => o.Items?.Count > 0)
            .Where(o => o.Items?.FirstOrDefault()?.Template != null);

        var groupedByTemplate = new Dictionary<string, List<RagfairOffer>>();
        foreach (var offer in offers)
        {
            var templateId = offer.Items?.FirstOrDefault()?.Template.ToString() ?? "";
            if (!groupedByTemplate.ContainsKey(templateId))
            {
                groupedByTemplate[templateId] = [];
            }

            groupedByTemplate[templateId].Add(offer);
        }

        return groupedByTemplate;
    }
    
    
    private record ParsedOffer(
        [property: JsonPropertyName("templateId")] string TemplateId,
        [property: JsonPropertyName("price")] long Price
    );

    private record Response([property: JsonPropertyName("prices")] List<ParsedOffer> Offers);
}
