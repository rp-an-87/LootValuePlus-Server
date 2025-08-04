/* eslint-disable @typescript-eslint/naming-convention */
import { ItemHelper } from "@spt/helpers/ItemHelper";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { TradeHelper } from "@spt/helpers/TradeHelper";
import { IRagfairOffer } from "@spt/models/eft/ragfair/IRagfairOffer";
import { IProcessSellTradeRequestData } from "@spt/models/eft/trade/IProcessSellTradeRequestData";
import { SaveServer } from "@spt/servers/SaveServer";
import { RagfairOfferService } from "@spt/services/RagfairOfferService";
import { DependencyContainer } from "tsyringe";

import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import { IExit } from "@spt/models/eft/common/ILocationBase";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { MemberCategory } from "@spt/models/enums/MemberCategory";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { IRagfairConfig } from "@spt/models/spt/config/IRagfairConfig";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { RagfairPriceService } from "@spt/services/RagfairPriceService";
import { ItemType } from "@spt/models/eft/common/tables/ITemplateItem";

class Mod implements IPreSptLoadMod, IPostDBLoadMod {
  private itemHelper: ItemHelper;
  private offerService: RagfairOfferService;
  private tradeHelper: TradeHelper;
  private profileHelper: ProfileHelper;
  private saveServer: SaveServer;
  private priceService: RagfairPriceService;
  private ragfairConfig: IRagfairConfig;

  private logger: ILogger;
  private modConfig = require("../config/config.json")

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


    if (this.modConfig.flea?.disableBarters === true) {
      this.ragfairConfig.dynamic.barter.chancePercent = 0;
      this.logger.info("[LootValuePlus]: Removed player barter offers from flea market");
    }

    // Hook up a new static route
    staticRouterModService.registerStaticRouter(
      "LootValuePlusRoutes",
      [
        {
          url: "/LootValue/GetItemLowestFleaPrice",
          //info is the payload from client in json
          //output is the response back to client
          action: async (url, info, sessionID, output) => {
            try {
              const lowerPrice = this.getItemLowestFleaPrice(info.templateId);
              return JSON.stringify(lowerPrice);
            } catch (error) {
              return null;
            }
          }
        },
        {
          url: "/LootValue/GetMultipleItemsSellingFleaPrice",
          //info is the payload from client in json
          //output is the response back to client
          action: async (url, info, sessionID, output) => {
            // this.logger.info(JSON.stringify(info));
            try {
              const fleaMarketPrices = this.getMultipleItemsSellingFleaPrice([...info.templateIds]);
              return JSON.stringify({ prices: [...fleaMarketPrices] });
            } catch (error) {
              return null;
            }
          }
        },
        {
          url: "/LootValue/GetAllItemSellingFleaPrice",
          //info is the payload from client in json
          //output is the response back to client
          action: async (url, info, sessionID, output) => {
            // this.logger.info(JSON.stringify(info));
            try {
              // this.logger.warning("[LootValuePlus]: starting getting all items selling flea price");
              const fleaMarketPrices = this.getAllItemsSellingFleaPrice();
              // console.log(fleaMarketPrices);
              // this.logger.warning("[LootValuePlus]: finishing getting all items selling flea price");
              return JSON.stringify({ prices: [...fleaMarketPrices] });
            } catch (error) {
              return null;
            }
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

  public postDBLoad(container: DependencyContainer): void {

    const locations = container.resolve<DatabaseServer>("DatabaseServer").getTables().locations;
    const shouldModifyChances = this.modConfig.extracts?.chances?.enabled === true;
    const shouldModifyCoops = this.modConfig.extracts?.coop?.enabled === true;

    if (shouldModifyChances || shouldModifyCoops) {
      this.logger.info("");
      this.logger.info("[LootValuePlus]: ======= Beginning modification of extractions...");
    }


    if (shouldModifyChances) {
      this.logger.info("");
      this.logger.info("[LootValuePlus]: Modifying variable extraction chances");

      const increaseChanceOfExit = (location: string, exit: IExit) => {
        const chance = this.modConfig.extracts.chances.locations[location];
        const currentChance = exit.Chance;

        if (chance !== currentChance) {
          this.logger.info(`[LootValuePlus]: Changed '${location}' exit '${exit.Name}' to chance: '${chance}' (from: ${currentChance})`);
          exit.Chance = chance;
        }
      }

      Object
        .keys(locations)
        .filter(location => this.modConfig?.extracts?.chances?.locations[location] != undefined)
        .filter(location => locations[location].base?.exits != undefined)
        .map(location => {
          return {
            location: location,
            exits: locations[location].base.exits.filter(exit => exit.Chance != undefined && exit.Chance != 0)
          }
        })
        .forEach(locationExit =>
          locationExit.exits.forEach(exit => increaseChanceOfExit(locationExit.location, exit))
        );
    }

    if (shouldModifyCoops) {
      this.logger.info("");
      this.logger.info("[LootValuePlus]: Modifying CooP extracts");

      const coopExits = (exit: IExit) => exit.PassageRequirement === "ScavCooperation";
      const makeExitPaidEuro = (location: string, exit: IExit) => {
        exit.PassageRequirement = "TransferItem";
        exit.RequirementTip = "EXFIL_Item";
        exit.Id = "569668774bdc2da2298b4568";
        exit.Count = this.modConfig?.extracts?.coop?.amount ?? 1000;
        this.logger.info(`[LootValuePlus]: Changed map '${location}' coop exit '${exit.Name}' to be paid by ${exit.Count} euros`);
      };

      Object.keys(locations)
        .filter(location => locations[location].base?.exits != undefined)
        .forEach(location => {
          locations[location].base.exits
            .filter(coopExits)
            .forEach(exit => makeExitPaidEuro(location, exit))
        });
    }

    if (shouldModifyChances || shouldModifyCoops) {
      this.logger.info("");
      this.logger.info("[LootValuePlus]: ======= End modification of extractions...");
      this.logger.info("");
    }

  }


  private getAllItemsSellingFleaPrice(): { templateId: string, price: number }[] {

    const parsedOffers: { templateId: string, price: number }[] = [];
    const offersByTemplate = this.getAllUserOffersByTemplateId();
    const items = this.itemHelper.getItems().filter(i => i._props.CanSellOnRagfair && i._type != ItemType.NODE);

    for (const { _id } of items) {

      let fleaItemPrice = this.priceService.getFleaPriceForItem(_id);
      const offersForItem = [...(offersByTemplate.get(_id) || [])]
      const singleItemOffers = [...offersForItem.filter(o => o.items.length == 1)];
      const avgPriceOfItemInFleaMarket = this.getAvgPriceOfOffers(singleItemOffers);

      if (avgPriceOfItemInFleaMarket > 0) {
        fleaItemPrice = this.normalizeStandardPriceWithOffersAverage(fleaItemPrice, avgPriceOfItemInFleaMarket);
      }

      fleaItemPrice = this.applyMultiplierForItemPrice(_id, fleaItemPrice);
      parsedOffers.push({
        templateId: _id,
        price: Math.floor(fleaItemPrice)
      });

    }

    return parsedOffers;
  }

  private normalizeStandardPriceWithOffersAverage(fleaItemPrice: number, avgPriceOfItemInFleaMarket: number): number {
    // This offers a layer of security, there is some weird interaction if you use LiveFleaPrices where it will update the price of an item but the flea market will retain weird prices
    // Maybe the offers are generated before the price of the object is updated with the live flea? Who knows
    // In case there is such a desync, the offer will be automatically lowered to the avg price, randomly changing to anywhere between -10% and +10% of the avg
    if (fleaItemPrice > avgPriceOfItemInFleaMarket * 1.1) {
      const randomMultiplier = Math.floor(Math.random() * (1.1 - 0.9 + 1) + 0.9);
      return avgPriceOfItemInFleaMarket * randomMultiplier;
    }

    return fleaItemPrice;
  }


  private getAvgPriceOfOffers(singleItemOffers: IRagfairOffer[]) {
    const offerPrices = [...singleItemOffers.map(o => o.summaryCost)];
    const min = Math.min(...offerPrices);
    const max = Math.max(...offerPrices);
    const avg = (max + min) / 2;
    return avg;
  }

  private getAllUserOffersByTemplateId(): Map<string, IRagfairOffer[]> {
    const offers = this.offerService.getOffers()
      .filter(o => o.user.memberType != MemberCategory.TRADER) // keep only non trader offers.
      .filter(o => o.items.length) // keep those with items just in case.
      .filter(o => o.items[0]?._tpl.length); // keep those whose first item have a template id just in case.

    const groupedByTemplateId = new Map();
    for (const offer of offers) {
      const templateId = offer.items[0]?._tpl;

      if (!groupedByTemplateId.has(templateId)) {
        groupedByTemplateId.set(templateId, []);
      }

      groupedByTemplateId.get(templateId).push(offer);
    }
    return groupedByTemplateId;
  }

  private getMultipleItemsSellingFleaPrice(templateIds: string[]): { templateId: string, price: number }[] {
    return templateIds
      .map(templateId => {
        const avgPrice = this.getFleaSingleItemPriceForTemplate(templateId);
        let actualPrice = 0;
        if (avgPrice > 0) {
          actualPrice = Math.floor(avgPrice);
        }
        return {
          templateId,
          price: actualPrice
        };
      });
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
    this.logger.debug(`Fetching offers for templateId: [${templateId}]`);

    const offers: IRagfairOffer[] = this.offerService.getOffersOfType(templateId);
    if (!offers || !offers.length) {
      return null;
    }

    const offersByPlayers = [...offers.filter(a => a.user.memberType != 4)];
    if (!offersByPlayers || !offersByPlayers.length) {
      return null;
    }

    let fleaPriceForItem = this.priceService.getFleaPriceForItem(templateId);
    this.logger.debug(`Flea price for templateId [${templateId}]: ${fleaPriceForItem}`);


    // const dynamicPriceForItem = this.priceService.getDynamicPriceForItem(templateId);
    // const staticPriceForItem = this.priceService.getStaticPriceForItem(templateId);
    // this.logger.debug(`Dynamic flea price for templateId [${templateId}]: ${dynamicPriceForItem}`);
    // this.logger.debug(`Static flea price for templateId [${templateId}]: ${staticPriceForItem}`);


    const avgPriceOfItemInFleaMarket = this.getAvgPriceOfOffers(offersByPlayers);
    this.logger.debug(`Current prices from players for [${templateId}]: Avg: ${avgPriceOfItemInFleaMarket}`);
    fleaPriceForItem = this.normalizeStandardPriceWithOffersAverage(fleaPriceForItem, avgPriceOfItemInFleaMarket);
    fleaPriceForItem = this.applyMultiplierForItemPrice(templateId, fleaPriceForItem);
    return fleaPriceForItem;
  }

  private applyMultiplierForItemPrice(templateId: string, price: number): number {
    const itemPriceModifer = this.ragfairConfig.dynamic.itemPriceMultiplier[templateId] ?? 1;
    return price * itemPriceModifer;
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