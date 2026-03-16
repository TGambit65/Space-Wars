const TOKEN_KEY = 'token';
const SESSION_EVENT = 'sw3k:session-changed';

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const setToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { authenticated: true } }));
};

export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_EVENT, { detail: { authenticated: false } }));
};

export const redirectToGameLogin = () => {
  const loginPath = window.location.pathname.startsWith('/play') ? '/play/' : '/';
  window.location.assign(loginPath);
};

export const SESSION_EVENTS = {
  changed: SESSION_EVENT
};
