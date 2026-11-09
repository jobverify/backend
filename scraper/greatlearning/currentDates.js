import {need} from './currentErrors.js'
export function possibleCalendars(value){
 need(typeof value==='string','missing native calendar');const m=value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);need(m,'unreviewed native calendar spelling')
 const a=Number(m[1]),b=Number(m[2]),year=Number(m[3]),result=new Set();need(year>=2000&&year<=2100,'native calendar year outside reviewed range')
 for(const[month,day]of[[a,b],[b,a]]){const d=new Date(Date.UTC(year,month-1,day));if(d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day)result.add(d.toISOString().slice(0,10))}
 need(result.size>0,'invalid native calendar');return[...result].sort()
}
export function publication(model,at){
 const datePosted=possibleCalendars(model.datePosted),validThrough=possibleCalendars(model.validThrough),today=at.slice(0,10)
 return{rawDatePosted:model.datePosted,rawValidThrough:model.validThrough,possiblePublicationCalendars:datePosted,possibleDeadlineCalendars:validThrough,activityProved:datePosted.every(d=>d<=today)&&validThrough.every(d=>d>today),normalizedPublication:null,normalizedClosing:null,timezone:null,firstEverPublication:null,method:'all-valid-native-slash-calendar-interpretations-are-past-publication-and-future-deadline'}
}
