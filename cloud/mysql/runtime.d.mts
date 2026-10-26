export type QueryResult = { rows: any[]; rowCount: number };
export type Client = {
  transactionIsolation?: 'READ COMMITTED';
  query(sql: string, values?: any[]): Promise<QueryResult>;
  mergeLeadProfile(values: any[]): Promise<QueryResult>;
  recoverInterruptedMessages(values?: any[]): Promise<QueryResult>;
  dailyStageCounts(values: any[]): Promise<QueryResult>;
  exportLeads(values?: any[]): Promise<QueryResult>;
  leadAttention(values: any[]): Promise<QueryResult>;
};
export const nativePool: any;
export const pool: Client & { end(): Promise<void> };
export function connection(): Promise<{
  client: Client;
  discard(): void;
  release(): Promise<void>;
}>;
export function tx<T>(operation: (client: Client) => Promise<T>, options?: {isolation?: 'READ COMMITTED'}): Promise<T>;
export function id(): string;
export function event(
  client: Client,
  type: string,
  leadId: string | null,
  payload: object,
): Promise<void>;
export function initialize(): Promise<void>;
