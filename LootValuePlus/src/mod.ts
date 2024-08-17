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

    container.afterResolution(
      "RagfairTaxService",
      (_, ragfairTaxService: RagfairTaxService) => {

        // https://dev.sp-tarkov.com/SPT/Server/src/tag/3.9.4/project/src/services/RagfairTaxService.ts#L104
        // CHANGE THIS FOR ALL VERSION RELEASES
        const calculateItemWorth = (item: Item, itemTemplate: ITemplateItem, itemCount: number, pmcData: IPmcData, isRootItem?: boolean) => {
          let worth = this.priceService.getFleaPriceForItem(item._tpl);

          // In client, all item slots are traversed and any items contained within have their values added
          if (isRootItem) {
            // Since we get a flat list of all child items, we only want to recurse from parent item
            const itemChildren = this.itemHelper.findAndReturnChildrenAsItems(pmcData.Inventory.items, item._id);
            if (itemChildren.length > 1) {
              for (const child of itemChildren) {
                if (child._id === item._id) {
                  continue;
                }

                // PATCH TO FIX ERRORS
                const stackCount = child.upd?.StackObjectsCount || 1;
                worth += calculateItemWorth(
                  child,
                  this.itemHelper.getItem(child._tpl)[1],
                  stackCount,
                  pmcData,
                  false,
                );
              }
            }
          }

          if ("Dogtag" in item.upd!) {
            worth *= item.upd!.Dogtag!.Level;
          }

          if ("Key" in item.upd! && (itemTemplate._props.MaximumNumberOfUsage ?? 0) > 0) {
            worth =
              (worth / itemTemplate._props.MaximumNumberOfUsage!) *
              (itemTemplate._props.MaximumNumberOfUsage! - item.upd!.Key!.NumberOfUsages);
          }

          if ("Resource" in item.upd! && itemTemplate._props.MaxResource! > 0) {
            worth = worth * 0.1 + ((worth * 0.9) / itemTemplate._props.MaxResource!) * item.upd.Resource!.Value;
          }

          if ("SideEffect" in item.upd! && itemTemplate._props.MaxResource! > 0) {
            worth = worth * 0.1 + ((worth * 0.9) / itemTemplate._props.MaxResource!) * item.upd.SideEffect!.Value;
          }

          if ("MedKit" in item.upd! && itemTemplate._props.MaxHpResource! > 0) {
            worth = (worth / itemTemplate._props.MaxHpResource!) * item.upd.MedKit!.HpResource;
          }

          if ("FoodDrink" in item.upd! && itemTemplate._props.MaxResource! > 0) {
            worth = (worth / itemTemplate._props.MaxResource!) * item.upd.FoodDrink!.HpPercent;
          }

          if ("Repairable" in item.upd! && <number>itemTemplate._props.armorClass > 0) {
            const num2 = 0.01 * 0.0 ** item.upd.Repairable!.MaxDurability;
            worth =
              worth * (item.upd.Repairable!.MaxDurability / itemTemplate._props.Durability! - num2) -
              Math.floor(
                itemTemplate._props.RepairCost! *
                (item.upd.Repairable!.MaxDurability - item.upd.Repairable!.Durability),
              );
          }

          return worth * itemCount;
        }

        ragfairTaxService["calculateItemWorth"] = calculateItemWorth;

      },
      { frequency: "Always" }
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