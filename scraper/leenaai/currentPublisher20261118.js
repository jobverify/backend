import {createHash} from 'node:crypto'

export const CURRENT_BUNDLE='https://leena.ai/_next/static/chunks/pages/careers-15090a0f10f8bc12.js'
export const CURRENT_BUNDLE_SHA='c41f4d7591956790cb2731b7f0b54d8ca1eb893667ca66afd0cfe6e48f339596'
const sha=value=>createHash('sha256').update(value).digest('hex')
const requireProfile=(ok,reason)=>{if(!ok)throw Object.assign(Error('Leena AI native current publisher '+reason),{
  failureKind:'parser_or_contract_error',abortRetries:true})}

// Full reviewed publisher deployments retain the same career factory, public
// feed hook and error-only Workable fallback. The November 25 observation has
// a new app/build/style deployment and no optional beacon. Every fixed byte
// remains pinned; opaque delivery values confer no authority or job dates.
// The November 27 deployment changes the app/build, navigation and stylesheet
// while declaring the same separately whole-hash/AST-verified career factory.
// Both genuinely observed beacon variants have the same exact document frame.
export function currentPublisherSHA(html){
  const frames=new Map([
    [193311,'afb0bf607995ca7473339f16cc335ef7f6c39106f7079486b6fce73602b1efe0'],
    [192950,'afb0bf607995ca7473339f16cc335ef7f6c39106f7079486b6fce73602b1efe0'],
    [191259,'4923cd40cdd3725d94edae24337c4db17f634271818886f0de80d095752191b7'],
    [191347,'d3f3c065e7b1df4b3134a29c96894b0b57cdf9937acabcde325f0e65769d4c80'],
    [191708,'d3f3c065e7b1df4b3134a29c96894b0b57cdf9937acabcde325f0e65769d4c80'],
  ])
  requireProfile(typeof html==='string'&&frames.has(Buffer.byteLength(html)),'profile changed')
  const beacons=[...html.matchAll(/<script type="module" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/[^]*?<\/script>/g)]
  requireProfile(beacons.length<=1,'telemetry declaration changed')
  let frame=html
  if(beacons.length){
    const beacon=beacons[0][0]
    requireProfile(Buffer.byteLength(beacon)===360&&sha(beacon)==='2de28415c6181ca4d754c39f8bd3751c6abdcc147ccb35f367a0675015d522d8'
      &&html.slice(beacons[0].index+beacon.length,beacons[0].index+beacon.length+1)==='\n','telemetry profile changed')
    frame=html.replace(beacon+'\n','')
  }
  const fields=[...frame.matchAll(/window\.__CF\$cv\$params=\{r:'([a-f0-9]{16})',t:'([A-Za-z0-9+/]{14}==)'\}/g)]
  requireProfile(fields.length===1,'delivery parameter profile changed')
  const [whole,ray,time]=fields[0],reference='main.js?ray='+ray
  requireProfile(frame.split(reference).length===2&&Buffer.from(time,'base64').toString('base64')===time,'delivery parameter correlation changed')
  frame=frame.replace(whole,whole.replace(ray,'0'.repeat(16)).replace(time,'0'.repeat(16)))
    .replace(reference,'main.js?ray='+'0'.repeat(16))
  const fingerprint=sha(frame)
  requireProfile(fingerprint===frames.get(Buffer.byteLength(html)),'whole document profile changed')
  return fingerprint
}
