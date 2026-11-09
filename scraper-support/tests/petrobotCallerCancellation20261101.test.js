import * as source from '../../scraper/petrobot/script.js'
import { registerCallerCancellationControls } from './helpers/smartRecruitersCallerCancellation20261101.js'

registerCallerCancellationControls({
  name: "PetroBot", module: source,
  fixture: new URL("../../scraper/petrobot/native-captures/2026-11-01-declared-api.json.gz", import.meta.url),
  decode: native => ({ officialBody: native.officialBody, listingBody: native.listingBody, detailBody: native.detailBody }),
})
