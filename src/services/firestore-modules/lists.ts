import { listReadService } from './lists-read'
import { listWriteService } from './lists-write'

export const listService = {
  ...listReadService,
  ...listWriteService,
}
