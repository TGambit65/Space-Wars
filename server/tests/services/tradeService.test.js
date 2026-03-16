/**
 * Trade Service Tests
 */
const tradeService = require('../../src/services/tradeService');
const { User, Ship, Sector, Port, Commodity, PortCommodity, ShipCargo, Transaction, TransferLedger } = require('../../src/models');
const { createTestUser, createTestSector, createTestShip, createTestPort, createTestCommodity, addCommodityToPort, addCargoToShip, cleanDatabase } = require('../helpers');

describe('Trade Service', () => {
  let testUser, testSector, testShip, testPort, testCommodity;

  beforeAll(async () => {
    await cleanDatabase();
    
    // Set up test environment
    testSector = await createTestSector({ name: 'Trade Sector' });
    testUser = await createTestUser({ credits: 50000 });
    testShip = await createTestShip(testUser.user_id, testSector.sector_id, { cargo_capacity: 100 });
    testPort = await createTestPort(testSector.sector_id, { name: 'Trade Port', tax_rate: 0.05 });
    testCommodity = await createTestCommodity({ name: 'Trade Goods', base_price: 100, volume_per_unit: 1 });
    await addCommodityToPort(testPort.port_id, testCommodity.commodity_id, {
      quantity: 500, max_quantity: 1000, can_buy: true, can_sell: true
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getShipCargo', () => {
    it('should return ship cargo details', async () => {
      const cargo = await tradeService.getShipCargo(testShip.ship_id, testUser.user_id);
      
      expect(cargo).toHaveProperty('ship_id');
      expect(cargo).toHaveProperty('cargo_capacity');
      expect(cargo).toHaveProperty('items');
    });

    it('should calculate used and free capacity', async () => {
      const cargo = await tradeService.getShipCargo(testShip.ship_id, testUser.user_id);
      
      expect(cargo).toHaveProperty('used_capacity');
      expect(cargo).toHaveProperty('free_capacity');
      expect(cargo.used_capacity + cargo.free_capacity).toBe(cargo.cargo_capacity);
    });

    it('should throw error for non-existent ship', async () => {
      await expect(tradeService.getShipCargo(99999, testUser.user_id))
        .rejects.toThrow('Ship not found');
    });
  });

  describe('buyCommodity', () => {
    let buyUser, buyShip;

    beforeEach(async () => {
      buyUser = await createTestUser({ credits: 50000 });
      buyShip = await createTestShip(buyUser.user_id, testSector.sector_id, { cargo_capacity: 100 });
    });

    it('should successfully buy commodities', async () => {
      const result = await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      expect(result.success).toBe(true);
      expect(result.quantity).toBe(10);
    });

    it('should deduct credits from user', async () => {
      const initialCredits = buyUser.credits;
      const result = await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 5
      );
      
      const updatedUser = await User.findByPk(buyUser.user_id);
      expect(updatedUser.credits).toBeLessThan(initialCredits);
    });

    it('should add cargo to ship', async () => {
      await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      const cargo = await ShipCargo.findOne({
        where: { ship_id: buyShip.ship_id, commodity_id: testCommodity.commodity_id }
      });
      expect(cargo.quantity).toBe(10);
    });

    it('should reduce port stock', async () => {
      const before = await PortCommodity.findOne({
        where: { port_id: testPort.port_id, commodity_id: testCommodity.commodity_id }
      });
      const initialQty = before.quantity;
      
      await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      const after = await PortCommodity.findOne({
        where: { port_id: testPort.port_id, commodity_id: testCommodity.commodity_id }
      });
      expect(after.quantity).toBe(initialQty - 10);
    });

    it('should create transaction record', async () => {
      await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 5
      );
      
      const transaction = await Transaction.findOne({
        where: { user_id: buyUser.user_id, transaction_type: 'BUY' },
        order: [['created_at', 'DESC']]
      });
      expect(transaction).toBeDefined();
      expect(transaction.quantity).toBe(5);
    });

    it('should fail with insufficient credits', async () => {
      await buyUser.update({ credits: 1 });
      
      await expect(tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 100
      )).rejects.toThrow('Insufficient credits');
    });

    it('should fail with insufficient cargo space', async () => {
      await buyShip.update({ cargo_capacity: 5 });
      
      await expect(tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 100
      )).rejects.toThrow('Insufficient cargo space');
    });

    it('should fail when ship is not in port sector', async () => {
      const otherSector = await createTestSector({ name: 'Other Sector' });
      await buyShip.update({ current_sector_id: otherSector.sector_id });
      
      await expect(tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      )).rejects.toThrow('same sector');
    });

    it('should replay an idempotent buy without double charging or duplicating cargo', async () => {
      const idempotencyKey = 'trade-buy-replay-1';

      const first = await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 5, { idempotencyKey }
      );
      const second = await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 5, { idempotencyKey }
      );

      expect(second).toEqual(first);

      const cargo = await ShipCargo.findOne({
        where: { ship_id: buyShip.ship_id, commodity_id: testCommodity.commodity_id }
      });
      expect(cargo.quantity).toBe(5);

      const ledgers = await TransferLedger.findAll({
        where: { idempotency_key: idempotencyKey }
      });
      expect(ledgers).toHaveLength(1);
    });

    it('should flag suspiciously large purchases in the transfer ledger', async () => {
      await buyUser.update({ credits: 100000 });
      await buyShip.update({ cargo_capacity: 500 });

      await tradeService.buyCommodity(
        buyUser.user_id, buyShip.ship_id, testPort.port_id, testCommodity.commodity_id, 260, { idempotencyKey: 'trade-buy-risk-1' }
      );

      const ledger = await TransferLedger.findOne({
        where: { idempotency_key: 'trade-buy-risk-1' }
      });
      expect(ledger).not.toBeNull();
      expect(ledger.risk_flags).toContain('large_credit_transfer');
      expect(ledger.risk_flags).toContain('large_commodity_transfer');
    });
  });

  describe('sellCommodity', () => {
    let sellUser, sellShip;

    beforeEach(async () => {
      sellUser = await createTestUser({ credits: 1000 });
      sellShip = await createTestShip(sellUser.user_id, testSector.sector_id);
      await addCargoToShip(sellShip.ship_id, testCommodity.commodity_id, 50);
    });

    it('should successfully sell commodities', async () => {
      const result = await tradeService.sellCommodity(
        sellUser.user_id, sellShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      expect(result.success).toBe(true);
      expect(result.quantity).toBe(10);
    });

    it('should add credits to user (minus tax)', async () => {
      const initialCredits = sellUser.credits;
      await tradeService.sellCommodity(
        sellUser.user_id, sellShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      const updatedUser = await User.findByPk(sellUser.user_id);
      expect(updatedUser.credits).toBeGreaterThan(initialCredits);
    });

    it('should remove cargo from ship', async () => {
      await tradeService.sellCommodity(
        sellUser.user_id, sellShip.ship_id, testPort.port_id, testCommodity.commodity_id, 10
      );
      
      const cargo = await ShipCargo.findOne({
        where: { ship_id: sellShip.ship_id, commodity_id: testCommodity.commodity_id }
      });
      expect(cargo.quantity).toBe(40);
    });

    it('should fail with insufficient cargo', async () => {
      await expect(tradeService.sellCommodity(
        sellUser.user_id, sellShip.ship_id, testPort.port_id, testCommodity.commodity_id, 100
      )).rejects.toThrow('Insufficient cargo');
    });
  });
});
