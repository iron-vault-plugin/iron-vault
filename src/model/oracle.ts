import { Roll } from "./rolls";

export interface RollContext {
  lookup(id: string): RollableOracle | undefined;
}

export interface RollableOracle {
  get id(): string;
  // TODO: introduce an idea that a roll can generate its own variants (e.g., flip, adjacent, etc)
  // that would allow us a way to eliminate the weird randomizer thing
  roll(context: RollContext): Roll;
  evaluate(context: RollContext, value: number): Roll;
}
