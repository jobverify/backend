import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KRG_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KRG_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.currentOpeningsUrl
export const EXTERNAL_BOARD_URL = PROVIDER_METADATA.externalBoardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 10

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

export const isRecoverableCertificateError = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /CERT_HAS_EXPIRED/i.test(combined)
    || /certificate has expired/i.test(combined)
    || /SEC_E_CERT_EXPIRED/i.test(combined)
    || /ERR_TLS_CERT_ALTNAME_INVALID/i.test(combined)
    || /Hostname\/IP does not match certificate'?s altnames/i.test(combined)
}

export const fetchTextAllowingExpiredCertificate = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  const targetUrl = new URL(url)
  const transport = targetUrl.protocol === 'http:' ? http : https

  const request = transport.request(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    rejectUnauthorized: true,
  }, (response) => {
    const status = response.statusCode ?? 0
    const location = response.headers.location

    if (
      location
      && REDIRECT_STATUSES.has(status)
      && redirectCount < MAX_REDIRECTS
    ) {
      response.resume()
      resolve(fetchTextAllowingExpiredCertificate(new URL(location, targetUrl).toString(), redirectCount + 1))
      return
    }

    let html = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      html += chunk
    })
    response.on('end', () => {
      if (status < 200 || status >= 400) {
        reject(new Error(`HTTP ${status} for ${url}`))
        return
      }

      resolve(html)
    })
  })

  request.setTimeout(15000, () => {
    request.destroy(new Error(`Timed out fetching ${url}`))
  })
  request.on('error', reject)
  request.end()
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const fetchVerifiedText = async (
  url,
  fetchText,
  fetchTextAllowingExpiredCertificateImpl,
) => {
  try {
    return await fetchText(url)
  } catch (error) {
    if (!isRecoverableCertificateError(error)) {
      throw error
    }

    return fetchTextAllowingExpiredCertificateImpl(url)
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return extractTitle(page) === 'KRG Technologies'
    && page.includes('Jobs.aspx')
}

export const hasCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('Find Your Career. You Deserve it.')
    && text.includes('Current Openings')
    && page.includes(EXTERNAL_BOARD_URL)
}

export const createKrgTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchTextAllowingExpiredCertificate: fetchTextAllowingExpiredCertificateImpl = fetchTextAllowingExpiredCertificate,
  } = {}) {
    const careersHtml = await fetchVerifiedText(
      CAREERS_URL,
      fetchText,
      fetchTextAllowingExpiredCertificateImpl,
    )
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('KRG Technologies official careers page no longer matches the verified first-party surface')
    }

    const openingsHtml = await fetchVerifiedText(
      CURRENT_OPENINGS_URL,
      fetchText,
      fetchTextAllowingExpiredCertificateImpl,
    )
    if (!hasCurrentOpeningsSignal(openingsHtml)) {
      throw new Error('KRG Technologies current openings page no longer matches the verified public handoff surface')
    }

    return []
  },
})

export const run = async (options = {}) => createKrgTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
