import { chatReadService } from './chat-read'
import { chatWriteService } from './chat-write'
import { chatPresenceService } from './chat-presence'

export const chatService = {
  ...chatReadService,
  ...chatWriteService,
  ...chatPresenceService,
}
