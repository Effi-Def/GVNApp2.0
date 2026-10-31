import { eventReadService } from './events-read'
import { eventWriteService } from './events-write'

export const eventService = {
  ...eventReadService,
  ...eventWriteService,
}
