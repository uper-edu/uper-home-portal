import { AsyncLocalStorage } from "node:async_hooks";
// Management writes and their receipts share one transaction, including legacy services.
export const operationContext = new AsyncLocalStorage<any>();
