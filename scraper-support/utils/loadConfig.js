/**
 * @file Loads centralized scraper.config.json with local folder overrides.
 * @module scraper/utils/loadConfig
 */

import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { SCRAPER_CONFIG_PATH } from '../supportPaths.js'

const utilsDir = path.dirname(fileURLToPath(import.meta.url))
const centralConfigPath = SCRAPER_CONFIG_PATH
const centralConfig = JSON.parse(readFileSync(centralConfigPath, 'utf-8'))

// Merges the local config.json over the central scraper.config.json if present.
export const loadConfig = (scraperDir) => {
  try {
    const local = JSON.parse(
      readFileSync(path.join(scraperDir, 'config.json'), 'utf-8'),
    )
    return { ...centralConfig, ...local }
  } catch {
    return { ...centralConfig }
  }
}
