// Synthetic future-state fixtures. These mutations are never live source evidence.
import {visibleDocument} from './nativeVisibility.js'
export const editSchema=(body,edit)=>body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/i,(_,start,json,end)=>{
 const schema=JSON.parse(json);edit(schema);return start+JSON.stringify(schema)+end
})
export const corrected=pages=>{
 for(const p of Object.values(pages))if(/jobuid-single-5150/.test(p.body)){
  const d=visibleDocument(p.body),article=d.nodes(n=>n.attrs.itemprop==='articleBody')[0]
  p.body=editSchema(p.body,s=>{s.description=d.text(article);s.jobLocation.address.addressCountry='Netherlands'})
 }
}
export const withIndia=(pages,id='5162')=>{
 const detail=Object.values(pages).find(p=>p.body.includes('jobuid-single-'+id))
 if(!detail)throw Error('Synthetic role missing')
 for(const p of Object.values(pages)){
  p.body=p.body.replace(new RegExp('(<[^>]+id="jobuid(?:-single)?-'+id+'"[\\s\\S]*?)(?=id="jobuid(?:-single)?-\\d+"|$)','g'),chunk=>chunk.replace(/Switzerland/g,'India').replace(/Zurich|Zürich/g,'Pune'))
 }
 detail.body=editSchema(detail.body,s=>{s.jobLocation.address.addressCountry='India';s.jobLocation.address.addressLocality='Pune';s.description=s.description.replace(/Switzerland/g,'India').replace(/Zurich|Zürich/g,'Pune')})
}
