// Explicit synthetic pagination boundary built from retained real role models.
// None of these added responses are original HTTP or current proof.
import {fixture,replay,editHTML,editJSON} from './fixtureReplay.js'
import {PUBLIC_LEVER_PROFILES} from './nativeCareers.js'
export const syntheticPaginatedVgs=(repeat=false)=>{
 const p=PUBLIC_LEVER_PROFILES.verygoodsecurityindia,rows=fixture.oracle.verygoodsecurityindia.records
 const sample=rows.find(row=>row.id==='4f565c0a-7a1c-4f43-ba97-0559658661dc')
 const reference=rows.find(row=>row.originalNative.categories.location==='San Francisco Bay Area'&&row.originalNative.country==='US')
 const sourceHTML=Buffer.from(fixture.entities.find(row=>row.receipt.url===sample.originalNative.hostedUrl).bodyBase64,'base64').toString('utf8')
 const first=Array.from({length:100},(_,index)=>{
  const id='00000000-0000-4000-8000-'+String(index).padStart(12,'0')
  return JSON.parse(JSON.stringify(sample.originalNative).replaceAll(sample.id,id))
 })
 const all=[...first,reference.originalNative],extra=new Map()
 const page=(url,text)=>({url,status:200,headers:{'content-type':'application/json'},bodyBase64:Buffer.from(text).toString('base64'),html:text,text,syntheticBoundaryEntity:true})
 const next='https://api.lever.co/v0/postings/verygoodsecurity?mode=json&skip=100&limit=100'
 extra.set(next,page(next,JSON.stringify(repeat?first:[reference.originalNative])))
 for(const row of first){
  const api='https://api.lever.co/v0/postings/verygoodsecurity/'+row.id
  extra.set(api,page(api,JSON.stringify(row)))
  extra.set(row.hostedUrl,page(row.hostedUrl,sourceHTML.replaceAll(sample.id,row.id)))
 }
 const grouped=[]
 for(const row of all){let group=grouped.find(g=>g.title===row.categories.team);if(!group){group={title:row.categories.team,postings:[]};grouped.push(group)}group.postings.push(row)}
 const r=replay((url,original)=>{
  if(url===p.publicAPIURL)return editJSON(original,values=>values.splice(0,values.length,...first))
  if(url===p.publicGroupedAPIURL)return editJSON(original,values=>values.splice(0,values.length,...grouped))
  if(url===p.boardURL)return editHTML(original,html=>{
   for(const row of rows)html=html.replaceAll(row.originalNative.hostedUrl,'#historical-fixture-link')
   return html.replace('</body>',all.map(row=>'<a href="'+row.hostedUrl+'">'+row.text+'</a>').join('')+'</body>')
  })
  return original
 },extra)
 return {...r,first,reference,next}
}
