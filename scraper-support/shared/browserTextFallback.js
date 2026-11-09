import { createBrowserFetchSession } from './browserFetch.js'

export const DEFAULT_BROWSER_TEXT_FALLBACK_PATTERN =
  /HTTP (?:403|429)\b|cloudflare|just a moment|forbidden|blocked/i

export const defaultShouldUseBrowserTextFallback = (error) =>
  DEFAULT_BROWSER_TEXT_FALLBACK_PATTERN.test(String(error?.message ?? error ?? ''))

export const createBrowserTextFallback = ({
  fetchText,
  fetchBrowserText,
  userAgent = null,
  shouldUseBrowserFallback = defaultShouldUseBrowserTextFallback,
} = {}) => {
  let browserSession = null

  const getBrowserText = async (url, options = {}) => {
    if (typeof fetchBrowserText === 'function') {
      return fetchBrowserText(url, options)
    }

    if (!browserSession) {
      browserSession = await createBrowserFetchSession({ userAgent })
    }

    return browserSession.fetchText(url, options)
  }

  return {
    close: async () => {
      if (browserSession) {
        await browserSession.close()
      }
    },
    fetchText: async (url, options = {}) => {
      try {
        return await fetchText(url, options)
      } catch (error) {
        if (!shouldUseBrowserFallback(error)) {
          throw error
        }

        return getBrowserText(url, options)
      }
    },
  }
}
