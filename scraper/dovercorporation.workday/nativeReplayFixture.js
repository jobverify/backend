// Offline replay only. Production never imports this module.
import {capturedSource,currentNativeTransport} from '../../test/helpers/replayCurrentNativeQuality.js'
import {readFileSync} from 'node:fs'
const redirect=JSON.parse(readFileSync(new URL('./fixtures/official-careers-redirect.json',import.meta.url)))
// Archived native roles, replayed under the independently captured current
// first-party careers redirect. This is not an untouched historical replay.
export const nativePackets=(packets=capturedSource('dovercorporation').requests)=>structuredClone(packets).map(p=>p.requestedURL==='https://www.dovercorporation.com/about-us/careers/'?structuredClone(redirect):p)
export const replayTransport=(packets,mutate)=>currentNativeTransport('dovercorporation',mutate,packets)
