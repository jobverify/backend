import {readAccordion,finish,nativeFetch} from './native.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREERS_URL = 'https://www.continualengine.com/careers/'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getAttribute = (html, name) => {
  const match = String(html ?? '').match(
    new RegExp(`\\b${escapeRegExp(name)}=["']([^"']+)["']`, 'i'),
  )
  return match?.[1] || null
}

const extractContent = (html, contentId) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<div\\b[^>]*\\bid=["']${escapeRegExp(contentId)}["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )

  return match?.[1] || null
}

const extractExperience = (description) => {
  const match = String(description ?? '').match(
    /(?:minimum of|minimum|at least)\s+(\d+(?:\+)?\s*(?:years?|months?))/i,
  )

  return match?.[1]?.toLowerCase() || null
}

export const extractCareerListings = readAccordion

const defaultFetchText = nativeFetch

export const createContinualEngineScraper = () => ({
  async run({ fetchText = defaultFetchText,now=()=>new Date().toISOString(),signal } = {}) {
    signal?.throwIfAborted()
    const html = await fetchText(CAREERS_URL,{signal})

    return finish(extractCareerListings(html).map((job) => ({
      ...job,
      source: 'continualengine',
      link: job.applyUrl,
      scrapedAt: now(),
    })),{now})
  },
})

export const run = async (options={}) => createContinualEngineScraper().run(options)
