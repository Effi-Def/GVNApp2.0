import { expenseReadService } from './expenses-read'
import { expenseWriteService } from './expenses-write'

export const expenseService = {
  ...expenseReadService,
  ...expenseWriteService,
}
