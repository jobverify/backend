import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {TURBOHIRE_CURRENT_PUBLIC_CLIENT} from '../../scraper-support/utils/turboHirePublicClient.js'
import {matchesCurrentNaviBoard,currentNaviBoardProfile} from './currentBoard20261117.js'

// Navi independently declares the same exact November 6 stage2 program
// already reviewed for Britannia. Employer binding remains Navi-specific;
// no other TurboHire tenant or deployment inherits this profile.
const origin='https://navi.turbohire.co'
const currentProfileBytes=readFileSync(new URL('./currentProfile20261114.json',import.meta.url))
const currentProfile=JSON.parse(currentProfileBytes)
const sha=value=>createHash('sha256').update(value).digest('hex')
const clients=Object.freeze([
 TURBOHIRE_CURRENT_PUBLIC_CLIENT,
 Object.freeze({path:'/main.673138983aeed664d914.chunk.js',
  sha256:'06a8fbd4790a319d84c07d999bc75fabf77134dee57f96f00504aa4990fbd319',
  apiBaseURL:'https://thapi-stage2.azurewebsites.net'}),
])
export const isReviewedNaviClientURL=url=>url===currentProfile.mainURL||clients.some(client=>url===origin+client.path)
export const verifyNaviPublicClient=async({boardHTML,fetchScript,fetchCurrentAsset})=>{
 const requireClient=(ok,message)=>{if(!ok)throw Object.assign(Error('navi current TurboHire client: '+message),{abortRetries:true,incompleteScope:true})}
 const doc=readNativeDocument(boardHTML),main=doc.nodes(node=>node.tag==='script'&&node.attrs.src
  &&new URL(node.attrs.src,origin).origin===origin&&/\/main\.[a-f0-9]+\.chunk\.js$/.test(new URL(node.attrs.src,origin).pathname))
 requireClient(main.length===1&&!Object.hasOwn(main[0].attrs,'nomodule')&&!Object.hasOwn(main[0].attrs,'integrity')
  &&(!main[0].attrs.type||/^(?:module|(?:text|application)\/(?:x-)?(?:java|ecma)script)$/i.test(main[0].attrs.type)),
 'declared public main client is missing, ambiguous or inert')
 const url=new URL(main[0].attrs.src,origin)
 if(url.href===currentProfile.mainURL){
  const currentBrand=matchesCurrentNaviBoard(boardHTML)
  requireClient(sha(boardHTML)===currentProfile.boardBodySHA256||currentBrand,'current complete public shell/declarations changed')
  requireClient(typeof fetchCurrentAsset==='function','original current asset entity reader is required')
  const entities=[];let currentMain
  for(const asset of currentProfile.assets){
   const result=await fetchCurrentAsset(asset.url)
   requireClient(result.url===asset.url&&result.bytes===asset.bytes
    &&result.entitySHA256===asset.entitySHA256&&result.decodedBodySHA256===asset.decodedBodySHA256
    &&sha(result.body)===asset.decodedBodySHA256,'current immutable original entity/text pair changed')
   entities.push({url:asset.url,kind:asset.kind,bytes:result.bytes,entitySHA256:result.entitySHA256,decodedBodySHA256:result.decodedBodySHA256})
   if(asset.url===url.href)currentMain=result.body
  }
  requireClient(currentMain?.includes('this.API_SERVER_BASE_URL="'+currentProfile.apiBaseURL+'"')
   &&currentMain.includes('/api/careerpagev2/filteredjobs?orgId=${e}&pageType=${t}')
   &&currentMain.includes('/api/publicjobs/${e}?fieldVisibility=${t}')
   &&currentMain.includes('CAREER_PAGE:"CareerPage"'),'current reviewed public GUID service/API binding changed')
  return{url:url.href,sha256:sha(currentMain),apiBaseURL:currentProfile.apiBaseURL,
   detailProtocol:currentProfile.detailProtocol,fieldVisibility:currentProfile.fieldVisibility,
   profileSHA256:sha(currentProfileBytes),boardBodySHA256:sha(boardHTML),
   nativeEmployerLabel:currentBrand?currentNaviBoardProfile.nativeEmployerLabel:'NAVI TECHNOLOGIES LIMITED',
   programReviewSHA256:currentProfile.programReviewSHA256,assetEntities:entities}
 }
 const client=clients.find(value=>url.href===origin+value.path)
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
