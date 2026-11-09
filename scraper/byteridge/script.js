import { runNativeByteridge } from './nativeRun.js'

export const CAREER_PAGE_URL = 'https://byteridge.com/careers/'

const TALENT_POOL_PATTERN = /submit\s+your\s+cv|upload\s+your\s+profile/i
export const extractOpenings = (html) => {
  const content = String(html || '')
  if (TALENT_POOL_PATTERN.test(content)) return []
  return []
}

export const createByteridgeScraper = (defaults = {}) => ({ run: (options = {}) => runNativeByteridge({...defaults,...options}) })

export const run = async (options = {}) => createByteridgeScraper().run(options)
