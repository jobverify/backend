import { createBrowserFetchSession } from './browserFetch.js'

export const DEFAULT_BROWSER_NETWORK_FALLBACK_PATTERN =
  /HTTP (?:403|429)\b|cloudflare|just a moment|forbidden|blocked|fetch failed|timed? out|timeout|connect timeout|network(?: error)?|socket hang up|econnreset|enotfound|ssl|tls/i

export const defaultShouldUseBrowserNetworkFallback = (error) =>
  DEFAULT_BROWSER_NETWORK_FALLBACK_PATTERN.test(String(error?.message ?? error ?? ''))

export const inferKekaLandingUrl = (url) => {
  const match = String(url ?? '').match(/^(https:\/\/[^/]+\/careers\/)(?:api\/|jobdetails\/|applyjob\/)/i)
  return match?.[1] ?? null
}

export const createBrowserNetworkFallback = ({
  fetchText,
  fetchJson,
  fetchBrowserText,
  fetchBrowserJson,
  userAgent = null,
  browserSessionOptions = {},
  shouldUseBrowserFallback = defaultShouldUseBrowserNetworkFallback,
  resolveBrowserLandingUrl = inferKekaLandingUrl,
} = {}) => {
  let browserSession = null

  const getBrowserSession = async () => {
    if (!browserSession) {
      browserSession = await createBrowserFetchSession({
        userAgent,
        ...browserSessionOptions,
      })
    }

    return browserSession
  }

  const fetchTextViaBrowser = async (url, options = {}) => {
    if (typeof fetchBrowserText === 'function') {
      return fetchBrowserText(url, options)
    }

    const session = await getBrowserSession()
    const page = await session.fetchPage(url, options)
    return page.html
  }

  const fetchJsonViaBrowser = async (url, options = {}) => {
    if (typeof fetchBrowserJson === 'function') {
      return fetchBrowserJson(url, options)
    }

    const session = await getBrowserSession()
    const browserLandingUrl = options.browserLandingUrl || resolveBrowserLandingUrl(url, options)

    if (browserLandingUrl) {
      await session.fetchPage(browserLandingUrl, options)
    }

    return session.fetchJson(url, options)
  }

  const loadWithFallback = async (primaryLoader, browserLoader) => {
    try {
      return await primaryLoader()
    } catch (error) {
      if (!shouldUseBrowserFallback(error)) {
        throw error
      }

      return browserLoader()
    }
  }

  return {
    close: async () => {
      if (browserSession) {
        await browserSession.close()
      }
    },
    fetchTextInBrowser: async (url, options = {}) => fetchTextViaBrowser(url, options),
    fetchJsonInBrowser: async (url, options = {}) => fetchJsonViaBrowser(url, options),
    fetchText: async (url, options = {}) => loadWithFallback(
      () => fetchText(url, options),
      () => fetchTextViaBrowser(url, options),
    ),
    fetchJson: async (url, options = {}) => loadWithFallback(
      () => fetchJson(url, options),
      () => fetchJsonViaBrowser(url, options),
    ),
  }
}
