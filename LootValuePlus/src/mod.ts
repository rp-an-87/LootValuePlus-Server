/* eslint-disable @typescript-eslint/naming-convention */
import { DependencyContainer } from "tsyringe";
import { RagfairOfferService } from "@spt/services/RagfairOfferService";
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { IRagfairOffer } from "@spt/models/eft/ragfair/IRagfairOffer";
import { Item } from "@spt/models/eft/common/tables/IItem";
import { TradeHelper } from "@spt/helpers/TradeHelper";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { RagfairTaxService } from "@spt/services/RagfairTaxService";
import { IProcessSellTradeRequestData } from "@spt/models/eft/trade/IProcessSellTradeRequestData";
import { SaveServer } from "@spt/servers/SaveServer";

import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import { RagfairPriceService } from "@spt/services/RagfairPriceService";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { IRagfairConfig } from "@spt/models/spt/config/IRagfairConfig";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { ITemplateItem } from "@spt/models/eft/common/tables/ITemplateItem";
import { IPmcData } from "@spt/models/eft/common/IPmcData";

class Mod implements IPreSptLoadMod {
  private itemHelper: ItemHelper;
  private offerService: RagfairOfferService;
  private tradeHelper: TradeHelper;
  private profileHelper: ProfileHelper;
  private saveServer: SaveServer;
  private priceService: RagfairPriceService;
  private ragfairConfig: IRagfairConfig;

  private logger: ILogger;

  public preSptLoad(container: DependencyContainer): void {
    const logger = container.resolve<ILogger>("WinstonLogger");
    this.logger = logger;

    const staticRouterModService = container.resolve<StaticRouterModService>("StaticRouterModService");

    //HELPERS
    this.itemHelper = container.resolve<ItemHelper>("ItemHelper");
    this.offerService = container.resolve<RagfairOfferService>("RagfairOfferService");
    this.tradeHelper = container.resolve<TradeHelper>("TradeHelper");
    this.profileHelper = container.resolve<ProfileHelper>("ProfileHelper");
    this.saveServer = container.resolve<SaveServer>("SaveServer");
    this.priceService = container.resolve<RagfairPriceService>("RagfairPriceService");
    const config = container.resolve<ConfigServer>("ConfigServer");
    this.ragfairConfig = config.getConfig(ConfigTypes.RAGFAIR);

    // Hook up a new static route
    staticRouterModService.registerStaticRouter(
      "LootValuePlusRoutes",
      [
        {
          url: "/LootValue/GetItemLowestFleaPrice",
          //info is the payload from client in json
          //output is the response back to client
          action: async (url, info, sessionID, output) => {
            const lowerPrice = this.getItemLowestFleaPrice(info.templateId);
            return JSON.stringify(lowerPrice);
          }
        },
        {
          url: "/LootValue/SellItemToTrader",
          //info is the payload from client in json
          //output is the response back to client
          action: async (url, info, sessionID, output) => {
            const response = this.sellItemToTrader(sessionID, info.ItemId, info.TraderId, info.Price);
            return JSON.stringify(response);
          }
        }
      ],
      "custom-static-LootValuePlusRoutes"
    );

  }



  private getItemLowestFleaPrice(templateId: string): number {
    const singleItemPrice = this.getFleaSingleItemPriceForTemplate(templateId);

    if (singleItemPrice > 0) {
      return Math.floor(singleItemPrice);
    }

    return null;
  }

  private getFleaSingleItemPriceForTemplate(templateId: string): number {
    // https://dev.sp-tarkov.com/SPT/Server/src/branch/master/project/src/controllers/RagfairController.ts#L409
    // const name = this.itemHelper.getItemName(templateId);
    const offers: IRagfairOffer[] = this.offerService.getOffersOfType(templateId);
    if (!offers || !offers.length) {
      return null;
    }

    const offersByPlayers = [...offers.filter(a => a.user.memberType != 4)];
    if (!offersByPlayers || !offersByPlayers.length) {
      return null;
    }

    let fleaPriceForItem = this.priceService.getFleaPriceForItem(templateId);

    const itemPriceModifer = this.ragfairConfig.dynamic.itemPriceMultiplier[templateId];
    if (itemPriceModifer) {
      fleaPriceForItem *= itemPriceModifer;
    }

    return fleaPriceForItem;
  }

  private sellItemToTrader(sessionId: string, itemId: string, traderId: string, price: number): boolean {
    const pmcData = this.profileHelper.getPmcProfile(sessionId)
    if (!pmcData) {
      this.logger.error(`[Sell item to trader] 'pmcData' was null [sessionId: ${sessionId}, itemId: ${itemId}, traderId: ${traderId}, price: ${price}]`);
      return false;
    }

    const item = pmcData.Inventory.items.find(x => x._id === itemId)
    if (!item) {
      this.logger.error(`[Sell item to trader] 'item' was not found in player inventory by 'itemId' [sessionId: ${sessionId}, itemId: ${itemId}, traderId: ${traderId}, price: ${price}]`);
      return false;
    }

    let sellAmount = 1;
    if (item.upd && item.upd.StackObjectsCount) {
      sellAmount = item.upd.StackObjectsCount;
    }

    const sellRequest: IProcessSellTradeRequestData = {
      Action: "sell_to_trader",
      type: "sell_to_trader",
      tid: traderId,
      price: price,
      items: [{
        id: itemId,
        count: sellAmount,
        scheme_id: 0
      }]
    };

    this.tradeHelper.sellItem(pmcData, pmcData, sellRequest, sessionId, null);
    this.saveServer.saveProfile(sessionId);
    return true;
  }



}

module.exports = { mod: new Mod() }