import fs from 'node:fs'
const base=new URL('../test-data/recruitmentGoal20261104/',import.meta.url)
export const worklineFixture=JSON.parse(fs.readFileSync(new URL('workline-native-role.json',base)))
export const worklinePDF=fs.readFileSync(new URL('workline-native-description.pdf',base))
export const withNativeDescription=record=>({...record,PRFCode:record.PRFCode||Number(record.Req_No),JobSpecificationFile:worklineFixture.record.JobSpecificationFile})
export function worklineDetailPage(record,url){
 let html=worklineFixture.page.html
 for(const key of ['Position_Name','Req_No','LOCATIONNAME','TrackToken','PRFCode'])html=html.replaceAll(String(worklineFixture.record[key]),String(record[key]))
 return {url,status:200,html}
}
