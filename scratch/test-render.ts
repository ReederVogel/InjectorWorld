import fs from 'fs'
import { getPayload } from 'payload'
import config from '../payload.config'
import CatchAllPage from '../app/(frontend)/[...path]/page'

function log(msg: string) {
  fs.appendFileSync('c:\\Users\\risha\\injectors.world\\scratch\\render-log.txt', msg + '\n')
}

async function main() {
  if (fs.existsSync('c:\\Users\\risha\\injectors.world\\scratch\\render-log.txt')) {
    fs.unlinkSync('c:\\Users\\risha\\injectors.world\\scratch\\render-log.txt')
  }
  
  log('Starting test-render script...')
  
  try {
    log('Getting payload instance...')
    const payload = await getPayload({ config })
    log('Payload instance obtained successfully.')
    
    const params = Promise.resolve({ path: ['masseter-botox', 'iowa'] })
    log('Calling CatchAllPage...')
    const component = await CatchAllPage({ params })
    log('CatchAllPage rendered successfully!')
  } catch (err: any) {
    log('Render FAILED with error:')
    log(err?.message ?? String(err))
    if (err?.stack) {
      log(err.stack)
    }
  }
  log('Script execution finished.')
  process.exit(0)
}

main().catch((err) => {
  log('Main crashed: ' + (err?.message ?? String(err)))
  if (err?.stack) {
    log(err.stack)
  }
  process.exit(1)
})
