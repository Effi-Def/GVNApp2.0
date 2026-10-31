import { farmReadService } from './farms-read'
import { farmWriteService } from './farms-write'

export const farmService = {
  ...farmReadService,
  ...farmWriteService,
}
