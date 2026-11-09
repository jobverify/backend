import {structure,need,publicRead,failure} from './publicRead.js'
export const CURRENT_CAREERS_URL='https://bizongo.com/careers',CURRENT_HANDOFF_URL='https://careers.bizongo.com/'
export function inspectCurrentCorporate(html){
 const s=structure(html),canonicals=s.visible(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 need(canonicals.length===1&&[CURRENT_CAREERS_URL,'https://www.bizongo.com/careers'].includes(canonicals[0].attrs.href),'Bizongo','official careers identity changed')
 const links=s.visible(n=>n.tag==='a'&&n.attrs.href===CURRENT_HANDOFF_URL).map(n=>({text:s.text(n),href:n.attrs.href})).filter(n=>/apply|job|role|open/i.test(n.text))
 need(links.length>0,'Bizongo','active official hiring handoff is missing')
 return{employer:'Bizongo',links,sourceScopeComplete:false}
}
export const runCurrentBizongo=options=>publicRead({source:'bizongo',company:'Bizongo'},options,async({read,stamp,audit,signal})=>{
 const verifiedAt=stamp(),html=await read(CURRENT_CAREERS_URL),corporate=inspectCurrentCorporate(html)
 let handoff
 try{handoff=await read(CURRENT_HANDOFF_URL)}catch(error){
  signal.throwIfAborted()
  await audit({verifiedAt,sourceScopeComplete:false,observations:[{kind:'declared-public-hiring-handoff',...corporate,country:null,jobId:null,requisitionId:null}],nativeFailure:{code:error?.cause?.code??error?.code??null,message:error?.message??null,status:error?.status??null,inventoryUnavailable:true},companyGlobalTotal:null,companyIndiaTotal:null})
  throw error
 }
 await audit({verifiedAt,sourceScopeComplete:false,observations:[{kind:'declared-public-hiring-handoff',...corporate,country:null}],nativeHandoff:{html:handoff,unreviewedInventory:true},companyGlobalTotal:null,companyIndiaTotal:null})
 throw failure('Bizongo','the declared public host is available; its inventory contract requires review','PUBLIC_VACANCY_COLLECTOR_REQUIRED')
})
