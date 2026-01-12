/**
 * Auth Service Tests
 */
const authService = require('../../src/services/authService');
const { User, Ship, Sector, Commodity, ShipCargo } = require('../../src/models');
const { createTestSector, createTestUser, cleanDatabase, generateTestToken } = require('../helpers');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../src/config');

describe('Auth Service', () => {
  let testSector;

  beforeAll(async () => {
    await cleanDatabase();
    // Create a starting sector for registration
    testSector = await createTestSector({ type: 'Core', name: 'Starting Sector' });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('registerUser', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.registerUser('newuser', 'newuser@test.com', 'password123');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('ship');
      expect(result).toHaveProperty('token');
      expect(result.user.username).toBe('newuser');
      expect(result.user.email).toBe('newuser@test.com');
      expect(result.ship.owner_user_id).toBe(result.user.user_id);
    });

    it('should create a default ship for new user', async () => {
      const result = await authService.registerUser('shipuser', 'shipuser@test.com', 'password123');

      expect(result.ship).toBeDefined();
      expect(result.ship.ship_type).toBe('Scout');
      expect(result.ship.name).toContain('shipuser');
    });

    it('should fail with duplicate username', async () => {
      await authService.registerUser('duplicateuser', 'dup1@test.com', 'password123');

      await expect(authService.registerUser('duplicateuser', 'dup2@test.com', 'password123'))
        .rejects.toThrow('username already exists');
    });

    it('should fail with duplicate email', async () => {
      await authService.registerUser('emailuser1', 'duplicate@test.com', 'password123');

      await expect(authService.registerUser('emailuser2', 'duplicate@test.com', 'password123'))
        .rejects.toThrow('email already exists');
    });

    it('should hash the password', async () => {
      await authService.registerUser('hashuser', 'hashuser@test.com', 'mypassword');

      const user = await User.findOne({ where: { username: 'hashuser' } });
      expect(user.hashed_password).not.toBe('mypassword');
      expect(await bcrypt.compare('mypassword', user.hashed_password)).toBe(true);
    });

    it('should give starting credits to new user', async () => {
      const result = await authService.registerUser('creditsuser', 'credits@test.com', 'password123');

      expect(result.user.credits).toBeGreaterThan(0);
    });
  });

  describe('loginUser', () => {
    beforeAll(async () => {
      await authService.registerUser('loginuser', 'login@test.com', 'loginpassword');
    });

    it('should login with valid credentials', async () => {
      const result = await authService.loginUser('loginuser', 'loginpassword');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.username).toBe('loginuser');
    });

    it('should return valid JWT token', async () => {
      const result = await authService.loginUser('loginuser', 'loginpassword');

      const decoded = jwt.verify(result.token, config.jwt.secret);
      expect(decoded).toHaveProperty('user_id');
      expect(decoded.username).toBe('loginuser');
    });

    it('should fail with wrong password', async () => {
      await expect(authService.loginUser('loginuser', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should fail with non-existent user', async () => {
      await expect(authService.loginUser('nonexistent', 'password'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should update last_login timestamp', async () => {
      const before = await User.findOne({ where: { username: 'loginuser' } });
      const beforeLogin = before.last_login;

      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
      await authService.loginUser('loginuser', 'loginpassword');

      const after = await User.findOne({ where: { username: 'loginuser' } });
      expect(new Date(after.last_login).getTime()).toBeGreaterThanOrEqual(new Date(beforeLogin).getTime());
    });
  });

  describe('getUserProfile', () => {
    let testUser;

    beforeAll(async () => {
      testUser = await createTestUser({ username: 'profileuser' });
    });

    it('should get user profile by id', async () => {
      const profile = await authService.getUserProfile(testUser.user_id);

      expect(profile).toBeDefined();
      expect(profile.username).toBe('profileuser');
    });

    it('should throw error for non-existent user', async () => {
      await expect(authService.getUserProfile('00000000-0000-0000-0000-000000000000'))
        .rejects.toThrow('User not found');
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      const testUser = await createTestUser({ username: 'tokengenuser' });
      const token = authService.generateToken(testUser);

      const decoded = jwt.verify(token, config.jwt.secret);
      expect(decoded).toHaveProperty('user_id');
      expect(decoded.username).toBe('tokengenuser');
    });
  });
});

