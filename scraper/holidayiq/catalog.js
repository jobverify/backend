import {fileURLToPath} from 'node:url'
import candidate from './catalog-candidate.json' with {type:'json'}
export const VERIFIED_SURFACE_SUMMARY=candidate.verifiedSurfaceSummary
export const HOLIDAYIQ_CATALOG={...candidate,modulePath:fileURLToPath(new URL('./script.js',import.meta.url))}
export default HOLIDAYIQ_CATALOG
