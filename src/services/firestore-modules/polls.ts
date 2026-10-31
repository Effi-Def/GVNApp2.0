import { pollReadService } from './polls-read'
import { pollWriteService } from './polls-write'

export const pollService = {
  ...pollReadService,
  ...pollWriteService,
}
