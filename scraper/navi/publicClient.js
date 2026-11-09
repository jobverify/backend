import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {TURBOHIRE_CURRENT_PUBLIC_CLIENT} from '../../scraper-support/utils/turboHirePublicClient.js'

// Navi independently declares the same exact November 6 stage2 program
// already reviewed for Britannia. Employer binding remains Navi-specific;
// no other TurboHire tenant or deployment inherits this profile.
const origin='https://navi.turbohire.co'
const clients=Object.freeze([
 TURBOHIRE_CURRENT_PUBLIC_CLIENT,
 Object.freeze({path:'/main.673138983aeed664d914.chunk.js',
  sha256:'06a8fbd4790a319d84c07d999bc75fabf77134dee57f96f00504aa4990fbd319',
  apiBaseURL:'https://thapi-stage2.azurewebsites.net'}),
])
export const isReviewedNaviClientURL=url=>clients.some(client=>url===origin+client.path)
export const verifyNaviPublicClient=async({boardHTML,fetchScript})=>{
 const requireClient=(ok,message)=>{if(!ok)throw Object.assign(Error('navi current TurboHire client: '+message),{abortRetries:true,incompleteScope:true})}
 const doc=readNativeDocument(boardHTML),main=doc.nodes(node=>node.tag==='script'&&node.attrs.src
  &&new URL(node.attrs.src,origin).origin===origin&&/\/main\.[a-f0-9]+\.chunk\.js$/.test(new URL(node.attrs.src,origin).pathname))
 requireClient(main.length===1&&!Object.hasOwn(main[0].attrs,'nomodule')&&!Object.hasOwn(main[0].attrs,'integrity')
  &&(!main[0].attrs.type||/^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(main[0].attrs.type)),
 'declared public main client is missing, ambiguous or inert')
 const url=new URL(main[0].attrs.src,origin),client=clients.find(value=>url.href===origin+value.path)
 requireClient(client,'unreviewed current public client URL')
 const body=await fetchScript(url.href),digest=createHash('sha256').update(body).digest('hex')
 requireClient(digest===client.sha256,'current public client bytes changed')
 const service=/class\s+([A-Za-z_$][\w$]*)\{constructor\(\)\{this\.API_SERVER_BASE_URL="(https:[^"]+)"/.exec(body)
 requireClient(service?.[2]===client.apiBaseURL
  &&body.includes('getPublicJobRefsForOrgFiltered(e,t,a)')
  &&body.includes('/api/careerpagev2/filteredjobs?orgId=${e}&pageType=${t}')
  &&body.includes('/api/publicjobs?jobId=${e}&fieldVisibility=${t}'),'reviewed native public service/API binding changed')
 return{url:url.href,sha256:digest,apiBaseURL:service[2]}
}
