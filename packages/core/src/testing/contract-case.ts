export interface ContractCase<Harness> {
  readonly name: string;
  run(harness: Harness): Promise<void>;
}
