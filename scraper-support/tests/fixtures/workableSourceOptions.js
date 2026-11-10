export const emptyNativeOptions = (source, company, accountUid, careersUrl, html) => ({
  now: () => '2026-10-26T09:00:00.000Z',
  fetchPage: async url => {
    if (url !== careersUrl) throw new Error(`Unexpected employer URL: ${url}`)
    return { status: 200, url, html }
  },
  fetchJson: async (url, init = {}) => {
    if (url === `https://apply.workable.com/api/v1/accounts/${source}`) return {
      id: 123, uid: accountUid, name: company, subdomain: source, url: new URL(careersUrl).origin + '/',
    }
    if (url === `https://apply.workable.com/api/v3/accounts/${source}/jobs`) {
      if (init.method !== 'POST') throw new Error('Native listings require an unfiltered POST query')
      return { total: 0, results: [] }
    }
    throw new Error(`Unexpected native URL: ${url}`)
  },
})
