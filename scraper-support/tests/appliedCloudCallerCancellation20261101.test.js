import * as source from '../../scraper/appliedcloudcomputing/script.js'
import { registerCallerCancellationControls } from './helpers/smartRecruitersCallerCancellation20261101.js'

registerCallerCancellationControls({
  name: "Applied Cloud", module: source,
  fixture: new URL("../../scraper/appliedcloudcomputing/native-captures/ownership-20261101.json.gz", import.meta.url),
  decode: native => Object.fromEntries(native.packets.map(packet => [packet.label + 'Body', packet.bodyUTF8])),
})
