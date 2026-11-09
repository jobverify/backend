import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { performance } from 'node:perf_hooks'

export async function writeTrialPrediction(file, record, {
  stopFile, retryDelays = [100, 250, 500, 1000, 2000],
  diskWaitMs = 0, diskPollMs = 1000, minimumFreeBytes = 0,
  now = () => performance.now(), wait = delay, onDiskWait = () => {},
} = {}) {
  if (!Number.isFinite(diskWaitMs) || diskWaitMs < 0 || diskWaitMs > 300000
    || !Number.isFinite(diskPollMs) || diskPollMs <= 0
    || !Number.isSafeInteger(minimumFreeBytes) || minimumFreeBytes < 0) throw new Error('Invalid bounded disk wait settings')
  const serialized = JSON.stringify(record, null, 2)
  const requiredBytes = Math.max(Buffer.byteLength(serialized) + 4096, minimumFreeBytes)
  let diskDeadline
  const checkStop = () => {
    if (stopFile && fs.existsSync(stopFile)) throw new Error('Trial stopped at the resource limit during prediction write')
  }
  for (let attempt = 0; ; attempt++) {
    // Preserve a prediction already returned by an in-flight worker. A stop
    // prevents retries and further inference, rather than discarding its result.
    if (attempt > 0) checkStop()
    try {
      fs.writeFileSync(`${file}.tmp`, serialized)
      fs.renameSync(`${file}.tmp`, file)
      return attempt
    } catch (error) {
      checkStop()
      if (!['ENOSPC', 'EBUSY', 'EIO'].includes(error.code) || attempt >= retryDelays.length) throw error
      if (error.code === 'ENOSPC') {
        const freeBytes = () => {
          const space = fs.statfsSync(path.dirname(file))
          return space.bavail * space.bsize
        }
        if (freeBytes() < requiredBytes) {
          if (!diskWaitMs) throw error
          const began = now()
          diskDeadline ??= began + diskWaitMs
          try {
            do {
              checkStop()
              const remaining = diskDeadline - now()
              if (remaining <= 0) throw error
              await wait(Math.min(diskPollMs, remaining))
              checkStop()
            } while (freeBytes() < requiredBytes)
          } finally { onDiskWait(now() - began) }
        }
      }
      await wait(retryDelays[attempt])
    }
  }
}
