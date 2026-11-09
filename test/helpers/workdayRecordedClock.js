// Snapshot replay only. Production readers keep their real I/O clocks.
export async function withRecordedWorkdayClock(value,operation){
 const OriginalDate=globalThis.Date,readNow=OriginalDate.now.bind(OriginalDate),started=readNow(),epoch=OriginalDate.parse(value)
 if(!Number.isFinite(epoch))throw Error('Invalid native snapshot replay time')
 class RecordedDate extends OriginalDate{
  constructor(...args){super(...(args.length?args:[epoch+readNow()-started]))}
  static now(){return epoch+readNow()-started}
 }
 globalThis.Date=RecordedDate
 try{return await operation()}finally{globalThis.Date=OriginalDate}
}
