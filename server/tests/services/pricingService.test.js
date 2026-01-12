/**
 * Pricing Service Tests
 */
const pricingService = require('../../src/services/pricingService');

describe('Pricing Service', () => {
  describe('calculateBuyPrice', () => {
    const basePrice = 100;
    const maxQuantity = 1000;
    const volatility = 0.3;

    it('should return higher price when stock is low', async () => {
      const lowStockPrice = pricingService.calculateBuyPrice(basePrice, 100, maxQuantity, volatility);
      const highStockPrice = pricingService.calculateBuyPrice(basePrice, 900, maxQuantity, volatility);
      
      expect(lowStockPrice).toBeGreaterThan(highStockPrice);
    });

    it('should return base price with spread adjustment when stock is at 50%', async () => {
      const config = require('../../src/config');
      const price = pricingService.calculateBuyPrice(basePrice, 500, maxQuantity, 0);

      // Buy price is adjusted down by half the spread (port buys lower than base)
      const expectedPrice = Math.round(basePrice * (1 - config.economy.priceSpread / 2));
      expect(price).toBe(expectedPrice);
    });

    it('should apply port modifier', async () => {
      const normalPrice = pricingService.calculateBuyPrice(basePrice, 500, maxQuantity, volatility, 1.0);
      const modifiedPrice = pricingService.calculateBuyPrice(basePrice, 500, maxQuantity, volatility, 1.2);
      
      expect(modifiedPrice).toBeGreaterThan(normalPrice);
    });

    it('should clamp prices to min/max multipliers', async () => {
      const config = require('../../src/config');
      const minExpected = basePrice * config.economy.minPriceMultiplier;
      const maxExpected = basePrice * config.economy.maxPriceMultiplier;
      
      // Even with extreme values, should stay in bounds
      const extremeHighPrice = pricingService.calculateBuyPrice(basePrice, 0, maxQuantity, 1.0, 10);
      const extremeLowPrice = pricingService.calculateBuyPrice(basePrice, maxQuantity, maxQuantity, 1.0, 0.1);
      
      expect(extremeHighPrice).toBeLessThanOrEqual(maxExpected);
      expect(extremeLowPrice).toBeGreaterThanOrEqual(minExpected);
    });

    it('should return rounded integer', async () => {
      const price = pricingService.calculateBuyPrice(basePrice, 333, maxQuantity, volatility);
      
      expect(Number.isInteger(price)).toBe(true);
    });
  });

  describe('calculateSellPrice', () => {
    const basePrice = 100;
    const maxQuantity = 1000;
    const volatility = 0.3;

    it('should return higher price when stock is low (scarcity)', async () => {
      const lowStockPrice = pricingService.calculateSellPrice(basePrice, 100, maxQuantity, volatility);
      const highStockPrice = pricingService.calculateSellPrice(basePrice, 900, maxQuantity, volatility);
      
      expect(lowStockPrice).toBeGreaterThan(highStockPrice);
    });

    it('should be higher than buy price (spread)', async () => {
      const buyPrice = pricingService.calculateBuyPrice(basePrice, 500, maxQuantity, volatility);
      const sellPrice = pricingService.calculateSellPrice(basePrice, 500, maxQuantity, volatility);
      
      expect(sellPrice).toBeGreaterThan(buyPrice);
    });
  });

  describe('calculateTotalWithTax', () => {
    it('should calculate correct subtotal', async () => {
      const result = pricingService.calculateTotalWithTax(100, 10, 0.05);
      
      expect(result.subtotal).toBe(1000);
    });

    it('should calculate correct tax amount', async () => {
      const result = pricingService.calculateTotalWithTax(100, 10, 0.05);
      
      expect(result.tax).toBe(50); // 5% of 1000
    });

    it('should calculate correct total (subtotal + tax)', async () => {
      const result = pricingService.calculateTotalWithTax(100, 10, 0.05);
      
      expect(result.total).toBe(1050);
    });

    it('should handle zero tax rate', async () => {
      const result = pricingService.calculateTotalWithTax(100, 10, 0);
      
      expect(result.tax).toBe(0);
      expect(result.total).toBe(1000);
    });

    it('should round tax to nearest integer', async () => {
      const result = pricingService.calculateTotalWithTax(33, 3, 0.07);
      
      expect(Number.isInteger(result.tax)).toBe(true);
    });
  });

  describe('calculateSaleRevenue', () => {
    it('should calculate correct subtotal', async () => {
      const result = pricingService.calculateSaleRevenue(100, 10, 0.05);
      
      expect(result.subtotal).toBe(1000);
    });

    it('should deduct tax from total (seller pays tax)', async () => {
      const result = pricingService.calculateSaleRevenue(100, 10, 0.05);
      
      expect(result.total).toBe(950); // 1000 - 50 tax
    });

    it('should handle zero tax rate', async () => {
      const result = pricingService.calculateSaleRevenue(100, 10, 0);
      
      expect(result.total).toBe(1000);
    });
  });

  describe('getPriceInfo', () => {
    it('should return price info object', async () => {
      const portCommodity = {
        quantity: 500,
        max_quantity: 1000,
        can_buy: true,
        can_sell: true,
        buy_price_modifier: 1.0,
        sell_price_modifier: 1.0,
        commodity: {
          commodity_id: 1,
          name: 'Test',
          category: 'Resources',
          base_price: 100,
          volatility: 0.2,
          volume_per_unit: 1
        }
      };
      const port = { tax_rate: 0.05 };
      
      const info = pricingService.getPriceInfo(portCommodity, port);
      
      expect(info).toHaveProperty('buy_price');
      expect(info).toHaveProperty('sell_price');
      expect(info).toHaveProperty('tax_rate');
      expect(info.tax_rate).toBe(0.05);
    });

    it('should return null buy_price when port does not buy', async () => {
      const portCommodity = {
        quantity: 500, max_quantity: 1000, can_buy: true, can_sell: false,
        buy_price_modifier: 1.0, sell_price_modifier: 1.0,
        commodity: { commodity_id: 1, name: 'Test', category: 'Resources', base_price: 100, volatility: 0.2, volume_per_unit: 1 }
      };
      
      const info = pricingService.getPriceInfo(portCommodity, { tax_rate: 0.05 });
      
      expect(info.buy_price).toBeNull();
    });
  });
});

