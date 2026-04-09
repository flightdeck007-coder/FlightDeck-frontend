import Cookies from 'js-cookie';

const TOKEN_KEY = 'token';

/** Cookie options for middleware (same-site; path must match on remove). */
const cookieOptions: Cookies.CookieAttributes = {
  path: '/',
  sameSite: 'lax',
  expires: 7,
};

/** Persists the JWT so Next.js middleware can read `token` on navigations. */
export function setAuthTokenCookie(token: string) {
  Cookies.set(TOKEN_KEY, token, cookieOptions);
}

export function removeAuthTokenCookie() {
  Cookies.remove(TOKEN_KEY, { path: '/' });
}
