import{readNativeDocument}from'./nativeHtml.js'
export const CORPORATE='https://www.capitalone.com/'
export const CAREERS='https://www.capitalonecareers.com/'
export const INDIA='https://www.capitalonecareers.com/india'
export const BOARD='https://capitalone.wd12.myworkdayjobs.com/Capital_One'
const prove=(ok,message)=>{if(!ok)throw Error('Capital One public binding: '+message)}
export const activeLinks=(html,base)=>readNativeDocument(html).nodes(n=>n.tag==='a'&&n.attrs.href).flatMap(n=>{
  try{const u=new URL(n.attrs.href,base);return u.protocol==='https:'&&!u.username&&!u.password?[u.href]:[]}catch{return[]}
})
export async function verifyCapitalOneHandoff({fetchText}){
  const corporate=await fetchText(CORPORATE);prove(activeLinks(corporate,CORPORATE).includes(CAREERS),'current corporate careers link missing')
  const careers=await fetchText(CAREERS);prove(activeLinks(careers,CAREERS).includes(INDIA),'current India careers link missing')
  const india=await fetchText(INDIA),roles=[...new Set(activeLinks(india,INDIA))].filter(value=>{
    const u=new URL(value);return u.origin==='https://www.capitalonecareers.com'&&!u.search&&!u.hash&&/^\/job\/bengaluru\/[^/]+\/\d+\/\d+$/.test(u.pathname)
  });prove(roles.length>0,'no active current Bengaluru role to verify the native application handoff')
  const roleUrl=roles[0],html=await fetchText(roleUrl),apply=activeLinks(html,roleUrl).filter(value=>{
    const u=new URL(value);return u.origin==='https://capitalone.wd12.myworkdayjobs.com'&&!u.search&&!u.hash&&/^\/Capital_One\/job\/Bangalore-In\/[^/]+_R\d+(?:-\d+)?\/apply$/.test(u.pathname)
  });prove(new Set(apply).size===1,'exact current public Capital_One application unavailable or ambiguous')
  return{verifiedAt:new Date().toISOString(),corporateUrl:CORPORATE,careersUrl:CAREERS,indiaUrl:INDIA,publicRoleUrl:roleUrl,applyUrl:apply[0],nativeRequisitionId:apply[0].match(/_(R\d+)(?:-\d+)?\/apply$/)[1],nativeEmployer:null,companyCoverageComplete:false}
}
