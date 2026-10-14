using System.Text.Json.Serialization;
using SPTarkov.DI.Annotations;
using SPTarkov.Server.Core.DI;
using SPTarkov.Server.Core.Models.Utils;
using SPTarkov.Server.Core.Utils;

namespace LootValuePlus;

[Injectable]
public class LootValuePlusStaticRouter : StaticRouter
{
    private static GetAllPricesHandler _getAllPricesHandler;
    private static GetMultiplePricesHandler _getMultiplePricesHandler;
    private static GetSingleItemPriceHandler _getSingleItemPriceHandler;

    public LootValuePlusStaticRouter(
        JsonUtil jsonUtil,
        GetAllPricesHandler getAllPricesHandler,
        GetMultiplePricesHandler getMultiplePricesHandler,
        GetSingleItemPriceHandler getSingleItemPriceHandler
    )
        : base(jsonUtil, GetCustomRoutes())
    {
        _getAllPricesHandler = getAllPricesHandler;
        _getMultiplePricesHandler = getMultiplePricesHandler;
        _getSingleItemPriceHandler = getSingleItemPriceHandler;
    }

    private static List<RouteAction> GetCustomRoutes()
    {
        return
        [
            new RouteAction(
                "/LootValue/GetAllItemSellingFleaPrice",
                async (url, request, sessionId, _, _) => await _getAllPricesHandler.Handle()
            ),
            new RouteAction(
                "/LootValue/GetMultipleItemsSellingFleaPrice",
                async (url, request, sessionId, _, _) => await _getMultiplePricesHandler.Handle(request),

                typeof(GetMultiplePricesRequestData)
            ),
            new RouteAction(
                "/LootValue/GetItemLowestFleaPrice",
                async (url, request, sessionId, _, _) => await _getSingleItemPriceHandler.Handle(request),
                typeof(GetSinglePriceRequestData)
            ),
        ];
    }

    public record GetMultiplePricesRequestData : IRequestData
    {
        [property: JsonPropertyName("templateIds")] public required List<string> TemplateIds { get; set; }
    }
    
    public record GetSinglePriceRequestData : IRequestData {
        [JsonPropertyName("templateId")] public required string TemplateId { get; set; }
    }
}
