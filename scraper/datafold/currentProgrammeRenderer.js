import {createHash} from 'node:crypto'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'

export const VERSION='07ddf247e844137b3955a192112a7970230c6ccf'
export const ASSET_BASE=`https://cdn.ashbyprd.com/frontend_non_user/${VERSION}/`
export const MANIFEST=ASSET_BASE+'.vite/manifest.json'
export const ENTRY=ASSET_BASE+'assets/index-CgFxg5GM.js'
export const MANIFEST_SHA='3027c1b2774ce9bb5efd93c6a67b9ef04a37e9eafafa86f570de347b3b56cf18'
export const ENTRY_SHA='68315c039b15ae6e77fb1a91e06305229c7bd371e649488757a02e43b1050b3f'
export const INTEGRITY='sha384-LxCBx+nic2FebpJApvvRLxL84cl3JB97L7dUCOugE1nNQbtJkf5ZPrKHkBdNS9kH'
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const failure=message=>Object.assign(Error('Datafold current programme: '+message),{softFailure:true,failureKind:'coverage_gap'})
export const need=(value,message)=>{if(!value)throw failure(message)}
export const originalJSON=text=>{try{return parseEightfoldJson(text)}catch(error){throw failure('Original JSON qualification: '+error.message)}}

// Original, independently reviewed source ranges in this exact entry. The
// complete entry pin also covers the three full queries and their fragments,
// boot bindings, four URL filters, team forest, notices and application branch.
const functions=[
 ['MT',1397046,1397089,'c6c3dfbe2e4252072232e34eb90ef2b50bf6d6e5044bd7238c56d8d5d3b2a564'],
 ['ey',1103221,1103914,'d20ced3294b70332dca6944c67f42c7aba7cf23f53cfc0c4744b16da7e35e323'],
 ['Ile',1104197,1104280,'8a0ec0873bbd3380d4a4c16440c5e7adb203f8750f69066de6565d3f23feaaac'],
 ['zle',1106222,1106612,'da9928d81db68d01a411c70b222678257fb74c63f88d52f00eca48df960ec01e'],
 ['Yyt',4181278,4182521,'ee7d11b26cc74dd92a4c4c7e5e83ff15301690898528e49379cc4061afecd737'],
 ['Xyt',4182521,4184371,'c502becd0e03a10b661ee7f58f75cbf9aaab086019dc99b141db9be6feae2015'],
 ['Qyt',4188492,4189144,'8ecacc9f918275862f66c915450473602afa20bf67fbfb33e149230c26fcd991'],
 ['tbt',4190391,4191255,'6d47a7bc3972ad2cdf58606109089340198bd796d53b6e0076f187b68eccd7bd'],
 ['Tbt',4207665,4210176,'a6b9767f29024b0ac4c63f77f663bd7cebec7b6de01687e99a543264537c907b'],
 ['Dbt',4212355,4214656,'9223b2dfe685c666eae134f4c09e391a8188258c3d6ba44251195615b3fedd54'],
 ['Abt',4216501,4216602,'6b62737214acb5bcc8fcaed4d190f4c761e364207b2eb8bd5d8d67e8fc48d432'],
 ['jbt',4216602,4217002,'22702f0bb93ee2dac199a79cbd8401864205913a1bfa201fd99fefb364f4d78c'],
 ['Mbt',4217002,4217756,'a8f5489dc43441181349dedf335f1ae6fe05d63fc57328b8eaa95e16a352f163'],
 ['Hbt',4232792,4233380,'ba4369c71ed4a276b500e32bbf63452f5f0d587af816e0456c0c8b21978ddcaf'],
 ['Ubt',4233380,4233872,'4a6f75109d4cb457ac09952ac416b302f76e8b4e94d2a51c643d79e33834e1f4'],
 ['rA',2027262,2027414,'680dc1020f09e2cf9284351c5884b1409195f739d01fc1de4ed777312867f7e4'],
]
const queries=[
 {name:'XOe',sourceSHA256:'bc0f236963aa492b035441b6a6cd3406d92093cfe7f4ed787f5fb201bbb1b9e2',operation:'ApiJobBoardWithTeams'},
 {name:'Mk',sourceSHA256:'93bd74d75e4e932cc6192e54b430e55125f1841fe36e83db4bf1be469327cde6',operation:'ApiJobPosting'},
 {name:'Uk',sourceSHA256:'89de61095a5528c8744f24945ca2476aee8d91e98d34d8f9d27aa5db66433a29',operation:'ApiOrganizationFromHostedJobsPageName'},
]

export function verifyRenderer(manifestPacket,entryPacket){
 const manifest=originalJSON(manifestPacket.text),entry=manifest['index.html']
 need(manifestPacket.hash===MANIFEST_SHA,'New or unreviewed manifest/dependency graph')
 need(entry?.isEntry===true&&entry.file==='assets/index-CgFxg5GM.js'&&!entry.imports?.length,'Unreviewed static recruitment dependency')
 const integrity='sha384-'+createHash('sha384').update(entryPacket.text).digest('base64')
 need(entryPacket.hash===ENTRY_SHA&&entry.integrity===INTEGRITY&&integrity===INTEGRITY,'Current renderer bytes/SRI changed')
 for(const[name,start,end,hash]of functions)need(sha(entryPacket.text.slice(start,end))===hash,'Reviewed renderer consumer changed: '+name)
 return {version:VERSION,manifestURL:MANIFEST,entryURL:ENTRY,manifestSHA256:MANIFEST_SHA,entrySHA256:ENTRY_SHA,integrity,
  criticalFunctions:functions.map(([name,start,end,sourceSHA256])=>({name,start,end,sourceSHA256})),
  completeQueryDefinitions:structuredClone(queries),completeQueriesPinnedByWholeEntry:true,
  allBoardBootRowsConsumed:true,matchingOwnBootDescriptionConsumed:true,allCompensationTiersConsumed:true,
  applicationFallbackFieldsExplicitlyNull:['applicationForm','surveyForms','automatedProcessingLegalNotice'],
  stylesheetBytesAcquired:false,untrustedJavaScriptExecuted:false}
}
