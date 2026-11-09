import { hasWorkdayOutageSignal, WorkdayUpstreamOutageError } from './engine.js'

export const assertWorkdayPageAvailable = (page = {}, { source = 'workday', url = '' } = {}) => {
  const pageUrl = page.url || page.finalUrl || url
  if (hasWorkdayOutageSignal({ ...page, url: pageUrl })) {
    throw new WorkdayUpstreamOutageError(
      `[${source}] Workday is currently unavailable upstream at ${pageUrl}`,
    )
  }
  if (Number(page.status) !== 200) {
    throw new Error(`[${source}] Workday page returned HTTP_${page.status} at ${pageUrl}`)
  }
  return page
}

