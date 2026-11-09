import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCRAPER_SUPPORT_DIR = currentDir
export const BACKEND_DIR = path.resolve(SCRAPER_SUPPORT_DIR, '..')
export const SCRAPER_DIR = path.join(BACKEND_DIR, 'scraper')
export const SCRAPER_CONFIG_PATH = path.join(SCRAPER_SUPPORT_DIR, 'scraper.config.json')
export const LEGACY_PROVIDER_BASE_DIR = path.join(SCRAPER_DIR, 'providers')
export const SUPPORT_PROVIDER_DIR = path.join(SCRAPER_SUPPORT_DIR, 'providers')
