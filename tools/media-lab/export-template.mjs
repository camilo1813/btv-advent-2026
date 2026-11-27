import { writeFileSync } from 'node:fs'
import { fields } from '../../docs/lab/js/schema.js'

writeFileSync(new URL('../../reports/media-lab/LAB_DEVICE_RESULTS_TEMPLATE.csv',import.meta.url),
  fields.join(',')+'\r\n')
