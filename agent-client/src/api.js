const axios = require('axios');
const { sleep } = require('./util');

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = options.statusCode || null;
    this.code = options.code || null;
    this.responseBody = options.responseBody || null;
    this.cause = options.cause || null;
    this.isNetworkError = Boolean(options.isNetworkError);
    this.retryable = Boolean(options.retryable);
  }
}

class SpaceWarsApi {
  constructor({ baseUrl, agentKey, logger = null, minRequestIntervalMs = 2500, timeoutMs = 15000 } = {}) {
    if (!baseUrl) {
      throw new Error('Missing base URL for API client');
    }
    if (!agentKey) {
      throw new Error('Missing agent API key');
    }

    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.agentKey = agentKey;
    this.logger = logger;
    this.minRequestIntervalMs = Math.max(0, Number(minRequestIntervalMs) || 0);
    this.lastRequestAt = 0;

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: timeoutMs,
      validateStatus: () => true,
    });
  }

  async waitForTurn() {
    if (this.minRequestIntervalMs <= 0) return;

    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < this.minRequestIntervalMs) {
      await sleep(this.minRequestIntervalMs - elapsed);
    }
  }

  async request(method, url, { data, params, headers } = {}) {
    await this.waitForTurn();
    this.lastRequestAt = Date.now();

    const requestConfig = {
      method,
      url,
      data,
      params,
      headers: {
        Authorization: `Bearer ${this.agentKey}`,
        Accept: 'application/json',
        ...(headers || {}),
      },
    };

    this.logger && this.logger.debug('HTTP request', {
      method: method.toUpperCase(),
      url,
      hasBody: Boolean(data),
    });

    let response;
    try {
      response = await this.http.request(requestConfig);
    } catch (error) {
      throw new ApiError(error.message || 'Network error', {
        code: error.code || null,
        cause: error,
        isNetworkError: true,
        retryable: true,
      });
    }

    const body = response.data;

    if (response.status >= 200 && response.status < 300 && (!body || body.success !== false)) {
      return body;
    }

    const message = (body && body.message) || `HTTP ${response.status}`;
    const retryable = response.status >= 500 || response.status === 429;

    throw new ApiError(message, {
      statusCode: response.status,
      code: body && body.code ? body.code : null,
      responseBody: body,
      retryable,
    });
  }

  getAgentSelf() {
    return this.request('get', '/agents/me');
  }

  getShip() {
    return this.request('get', '/agent-api/ship');
  }

  getCargo() {
    return this.request('get', '/agent-api/ship/cargo');
  }

  getAdjacentSectors() {
    return this.request('get', '/agent-api/adjacent-sectors');
  }

  getCurrentSector() {
    return this.request('get', '/agent-api/sector');
  }

  navigate(targetSectorId) {
    return this.request('post', '/agent-api/navigate', {
      data: { target_sector_id: targetSectorId },
    });
  }

  getCurrentPorts() {
    return this.request('get', '/agent-api/port');
  }

  getMarketSummary() {
    return this.request('get', '/agent-api/trade/market');
  }

  buy({ shipId, portId, commodityId, quantity, idempotencyKey }) {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return this.request('post', '/agent-api/trade/buy', {
      data: {
        ship_id: shipId,
        port_id: portId,
        commodity_id: commodityId,
        quantity,
      },
      headers,
    });
  }

  sell({ shipId, portId, commodityId, quantity, idempotencyKey }) {
    const headers = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    return this.request('post', '/agent-api/trade/sell', {
      data: {
        ship_id: shipId,
        port_id: portId,
        commodity_id: commodityId,
        quantity,
      },
      headers,
    });
  }

  refuel({ portId, amount }) {
    return this.request('post', '/agent-api/trade/refuel', {
      data: {
        port_id: portId,
        ...(amount !== undefined && amount !== null ? { amount } : {}),
      },
    });
  }

  getMap() {
    return this.request('get', '/agent-api/map');
  }

  activateShip(shipId) {
    return this.request('post', '/agent-api/activate-ship', {
      data: { ship_id: shipId },
    });
  }
}

module.exports = {
  ApiError,
  SpaceWarsApi,
};
