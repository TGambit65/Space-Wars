/**
 * Shared fetch utility with AbortController timeout.
 * Used by all provider base classes (LLM, STT, TTS).
 *
 * @param {string} url
 * @param {Object} fetchOpts - standard fetch options
 * @param {number} timeoutMs - timeout in milliseconds
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = async (url, fetchOpts, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...fetchOpts, signal: controller.signal });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = fetchWithTimeout;
