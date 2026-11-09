import { isGroupedLocationLabel, normalizeStoredLocations } from '../../src/utils/jobLocations.js'

const decodeHtmlEntities = (value) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value.replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ')
  .trim()

export const extractWorkdayDetailLocations = (html) => {
  const locationBlocks = [...String(html || '').matchAll(
    /<dl[^>]*>\s*<dt[^>]*>\s*locations\s*<\/dt>([\s\S]*?)<\/dl>/gi,
  )]

  for (const [, block] of locationBlocks) {
    const locations = [...block.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/gi)]
      .map(([, value]) => stripTags(value))
      .filter(Boolean)

    if (locations.some((value) => !isGroupedLocationLabel(value))) {
      return locations.filter((value) => !isGroupedLocationLabel(value))
    }
  }

  return []
}

export { normalizeStoredLocations }
