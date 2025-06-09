import { numberRange, randomInt } from "@ironvault/utils/numbers";
import { Result } from "true-myth";
import { ok } from "true-myth/result";

const DICE_REGEX = /^(\d+)d(\d+)$/;

export type DieKind = string;

export class Dice {
  static fromDiceString(spec: string, kind?: DieKind): Dice {
    const parsed = spec.match(DICE_REGEX);
    if (parsed == null) {
      throw new Error(`invalid dice spec ${spec}`);
    }
    return new Dice(
      Number.parseInt(parsed[1]),
      Number.parseInt(parsed[2]),
      kind,
    );
  }

  constructor(
    public readonly count: number,
    public readonly sides: number,
    public readonly kind?: DieKind | undefined,
  ) {
    if (count <= 0) {
      throw new Error(`invalid dice count ${count}`);
    }
    if (sides <= 0) {
      throw new Error(`invalid dice sides ${sides}`);
    }
  }

  roll(): number {
    let total = 0;
    for (const roll of this.rolls()) {
      total += roll;
    }
    return total;
  }

  *rolls(): Generator<number> {
    for (let i = 0; i < this.count; i++) {
      yield randomInt(1, this.sides);
    }
  }

  minRoll(): number {
    return this.count;
  }

  maxRoll(): number {
    return this.count * this.sides;
  }

  flip(roll: number): number {
    return this.maxRoll() - roll + 1;
  }

  toString(): string {
    return `${this.count}d${this.sides}`;
  }

  copy(): Dice {
    return new Dice(this.count, this.sides, this.kind);
  }

  withKind(kind?: DieKind): Dice {
    return new Dice(this.count, this.sides, kind);
  }

  equals(other: Dice): boolean {
    return (
      this.count === other.count &&
      this.sides === other.sides &&
      this.kind === other.kind
    );
  }

  get standard(): boolean {
    return isStandardDice(this);
  }
}

export interface ExprNode<L extends object = object> {
  evaluate(valueFor: (dice: Dice) => number): number;
  walk(visitor: Visitor<L>): void;
  toString(): string;
  get precedence(): number;
  copy(): ExprNode<L>;
  withKind(kind?: DieKind): ExprNode<L>;
  updateLabels<K extends object>(
    updater: (current: L, node: this) => K,
  ): ExprNode<K>;
  readonly label: L;
}

export interface Visitor<L extends object> {
  visitNumberNode?(node: NumberNode<L>): void;
  visitDiceExprNode?(node: DiceExprNode<L>): void;
  visitBinaryOpNode?(node: BinaryOpNode<L>): void;
  visitUnaryOpNode?(node: UnaryOpNode<L>): void;
}

export class NumberNode<L extends object> implements ExprNode<L> {
  constructor(
    public value: number,
    public readonly label: L,
  ) {}

  evaluate(_valueFor: (dice: Dice) => number): number {
    return this.value;
  }

  walk(visitor: Visitor<L>): void {
    visitor.visitNumberNode?.(this);
  }

  toString(): string {
    return this.value.toString();
  }
  get precedence(): number {
    return 10;
  }

  copy(): NumberNode<L> {
    return new NumberNode(this.value, this.label);
  }

  withKind(_kind?: DieKind): ExprNode<L> {
    return this;
  }

  updateLabels<K extends object>(
    updater: (current: L, node: this) => K,
  ): NumberNode<K>;
  updateLabels<K extends object>(
    updater: (current: L, node: this) => K | L,
  ): NumberNode<K | L> {
    const newLabel = updater(this.label, this);
    if (newLabel === this.label) {
      // If it returns the same label, we can assume it is the same type!
      return this as unknown as NumberNode<K>;
    }
    return new NumberNode(this.value, newLabel);
  }
}

export class DiceExprNode<L extends object> implements ExprNode<L> {
  constructor(
    public readonly dice: Dice,
    public readonly label: L,
  ) {}

  static fromDiceString<L extends object>(
    diceSpec: string,
    kind: DieKind | undefined,
    label: L,
  ): DiceExprNode<L> {
    return new DiceExprNode(Dice.fromDiceString(diceSpec, kind), label);
  }

  evaluate(valueFor: (dice: Dice) => number): number {
    return valueFor(this.dice);
  }

  walk(visitor: Visitor<L>): void {
    visitor.visitDiceExprNode?.(this);
  }

  toString(): string {
    return this.dice.toString();
  }

  get precedence(): number {
    return 10;
  }

  copy(): DiceExprNode<L> {
    return new DiceExprNode(this.dice.copy(), this.label);
  }

  withKind(kind: DieKind): DiceExprNode<L> {
    return new DiceExprNode(this.dice.withKind(kind), this.label);
  }

  updateLabels<K extends object>(
    updater: (current: L, node: this) => K,
  ): DiceExprNode<K>;
  updateLabels<K extends object>(
    updater: (current: L, node: this) => K | L,
  ): DiceExprNode<K | L> {
    const newLabel = updater(this.label, this);
    if (newLabel === this.label) {
      // If it returns the same label, we can assume it is the same type!
      return this as unknown as DiceExprNode<K>;
    }
    return new DiceExprNode(this.dice, newLabel);
  }
}

export class BinaryOpNode<L extends object> implements ExprNode<L> {
  constructor(
    public left: ExprNode<L>,
    public operator: string,
    public right: ExprNode<L>,
    public readonly label: L,
  ) {}

  static applyOperator(
    operator: string,
    leftVal: number,
    rightVal: number,
  ): number {
    switch (operator) {
      case "+":
        return leftVal + rightVal;
      case "-":
        return leftVal - rightVal;
      case "*":
        return leftVal * rightVal;
      case "/":
        return Math.floor(leftVal / rightVal);
      case "%":
        // We want modulo, not remainder
        return ((leftVal % rightVal) + rightVal) % rightVal;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  evaluate(valueFor: (dice: Dice) => number): number {
    const leftVal = this.left.evaluate(valueFor);
    const rightVal = this.right.evaluate(valueFor);

    return BinaryOpNode.applyOperator(this.operator, leftVal, rightVal);
  }

  get precedence(): number {
    switch (this.operator) {
      case "+":
      case "-":
        return 1;
      case "%":
        return 2;
      case "*":
      case "/":
        return 3;
      default:
        throw new Error(`Unknown operator: ${this.operator}`);
    }
  }

  walk(visitor: Visitor<L>): void {
    this.left.walk(visitor);
    this.right.walk(visitor);
    visitor.visitBinaryOpNode?.(this);
  }

  toString(): string {
    return `${wrapIfNeeded(this.left, this.precedence)} ${this.operator} ${wrapIfNeeded(this.right, this.precedence)}`;
  }

  copy(): BinaryOpNode<L> {
    return new BinaryOpNode(
      this.left.copy(),
      this.operator,
      this.right.copy(),
      this.label,
    );
  }

  withKind(kind?: DieKind): BinaryOpNode<L> {
    const left = this.left.withKind(kind);
    const right = this.right.withKind(kind);
    if (left != this.left || right != this.right) {
      return new BinaryOpNode(left, this.operator, right, this.label);
    } else {
      return this;
    }
  }

  updateLabels<K extends object>(
    updater: (current: L, node: this) => K,
  ): BinaryOpNode<K>;
  updateLabels<K extends object>(
    updater: (current: L, node: this) => K | L,
  ): BinaryOpNode<K | L> {
    const newLabel = updater(this.label, this);
    if (newLabel === this.label) {
      // If it returns the same label, we can assume it is the same type!
      return this as unknown as BinaryOpNode<K>;
    }
    return new BinaryOpNode(this.left, this.operator, this.right, newLabel);
  }
}

function wrapIfNeeded<L extends object>(
  node: ExprNode<L>,
  precedence: number,
): string {
  return parenStringIf(node.precedence < precedence, node.toString());
}

export function parenStringIf(expr: boolean, str: string): string {
  return expr ? `(${str})` : str;
}

export class UnaryOpNode<L extends object> implements ExprNode<L> {
  constructor(
    public operator: string,
    public operand: ExprNode<L>,
    public readonly label: L,
  ) {}

  static applyOperator(operator: string, value: number): number {
    switch (operator) {
      case "-":
        return -value;
      default:
        throw new Error(`Unknown unary operator: ${operator}`);
    }
  }

  evaluate(valueFor: (dice: Dice) => number): number {
    const val = this.operand.evaluate(valueFor);
    return UnaryOpNode.applyOperator(this.operator, val);
  }

  walk(visitor: Visitor<L>): void {
    this.operand.walk(visitor);
    visitor.visitUnaryOpNode?.(this);
  }

  toString(): string {
    return `${this.operator}${this.operand.precedence < this.precedence ? `(${this.operand})` : this.operand}`;
  }

  get precedence(): number {
    return 5;
  }

  copy(): UnaryOpNode<L> {
    return new UnaryOpNode(this.operator, this.operand.copy(), this.label);
  }

  withKind(kind?: DieKind): UnaryOpNode<L> {
    const operand = this.operand.withKind(kind);
    if (operand != this.operand) {
      return new UnaryOpNode(this.operator, operand, this.label);
    } else {
      return this;
    }
  }

  updateLabels<K extends object>(
    updater: (current: L, node: this) => K,
  ): UnaryOpNode<K>;
  updateLabels<K extends object>(
    updater: (current: L, node: this) => K | L,
  ): UnaryOpNode<K | L> {
    const newLabel = updater(this.label, this);
    if (newLabel === this.label) {
      // If it returns the same label, we can assume it is the same type!
      return this as unknown as UnaryOpNode<K>;
    }
    return new UnaryOpNode(this.operator, this.operand, newLabel);
  }
}

export class DiceExpressionParser {
  private input: string;
  private current = 0;
  private dieKind?: DieKind;

  constructor(input: string, dieKind?: DieKind) {
    this.input = input.replace(/\s+/g, "");
    this.dieKind = dieKind;
  }

  public parse(): ExprNode {
    const result = this.expression();
    if (!this.isAtEnd()) {
      throw this.error(`Unexpected character at end: '${this.peek()}'`);
    }
    return result;
  }

  private expression(): ExprNode {
    return this.additive();
  }

  private additive(): ExprNode {
    let expr = this.multiplicative();

    while (this.match("+") || this.match("-")) {
      const operator = this.previous();
      const right = this.multiplicative();
      expr = new BinaryOpNode(expr, operator, right, {});
    }

    return expr;
  }

  private multiplicative(): ExprNode {
    let expr = this.unary();

    while (this.match("*") || this.match("/") || this.match("%")) {
      const operator = this.previous();
      const right = this.unary();
      expr = new BinaryOpNode(expr, operator, right, {});
    }

    return expr;
  }

  private unary(): ExprNode {
    if (this.match("-")) {
      const right = this.unary();
      return new UnaryOpNode("-", right, {});
    }

    return this.primary();
  }

  private primary(): ExprNode {
    if (this.match("(")) {
      const expr = this.expression();
      if (!this.match(")")) {
        throw this.error("Expected ')'");
      }
      return expr;
    }

    if (this.isDigit(this.peek())) {
      const start = this.current;

      while (this.isDigit(this.peek())) this.advance();

      if (this.peek() === "d") {
        const tempPos = this.current;
        this.advance();

        if (this.isDigit(this.peek())) {
          while (this.isDigit(this.peek())) this.advance();

          const diceExpr = this.input.substring(start, this.current);
          try {
            return DiceExprNode.fromDiceString(diceExpr, this.dieKind, {});
          } catch (_e) {
            this.current = start;
          }
        } else {
          this.current = tempPos;
        }
      }

      this.current = start;
      while (this.isDigit(this.peek())) this.advance();

      const value = parseInt(this.input.substring(start, this.current));
      return new NumberNode(value, {});
    }

    throw this.error(`Unexpected character: '${this.peek()}'`);
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.input[this.current] !== expected) return false;

    this.current++;
    return true;
  }

  private advance(): string {
    if (!this.isAtEnd()) this.current++;
    return this.input[this.current - 1];
  }

  private peek(): string {
    if (this.isAtEnd()) return "\0";
    return this.input[this.current];
  }

  private previous(): string {
    return this.input[this.current - 1];
  }

  private isAtEnd(): boolean {
    return this.current >= this.input.length;
  }

  private isDigit(c: string): boolean {
    return c >= "0" && c <= "9";
  }

  private error(message: string): Error {
    return new Error(message);
  }
}

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export type StringNumber<T extends string, V = T> = T extends Digit
  ? V
  : T extends `${Digit}${infer R}`
    ? StringNumber<R, V>
    : `0`;

export type DiceNotation<T extends string> =
  T extends `${infer N}${"d" | "D"}${infer N1}`
    ? N extends StringNumber<N>
      ? N1 extends StringNumber<N1>
        ? T
        : `0`
      : `0`
    : `0`;
export function parseDiceExpression<const T extends string>(
  expr: DiceNotation<T>,
  kind?: DieKind,
): DiceExprNode<object>;
export function parseDiceExpression(expr: string, kind?: DieKind): ExprNode;
export function parseDiceExpression(expr: string, kind?: DieKind): ExprNode {
  const parser = new DiceExpressionParser(expr, kind);
  return parser.parse();
}

export function tryParseDiceExpression(
  expr: string,
  kind?: DieKind,
): Result<DiceExprNode<object>, Error> {
  try {
    return ok(parseDiceExpression(expr, kind) as DiceExprNode<object>);
  } catch (e) {
    return Result.err(
      new Error(`Failed to parse dice expression: ${e}`, { cause: e }),
    );
  }
}

export function gatherDice(expr: ExprNode<never>): Dice[] {
  const dice: Dice[] = [];

  expr.walk({
    visitDiceExprNode: (node: DiceExprNode<never>) => {
      dice.push(node.dice);
    },
  });

  return dice;
}

export function countComplexity<L extends object>(expr: ExprNode<L>): number {
  let complexity = 0;

  expr.walk({
    visitNumberNode: () => {},
    visitDiceExprNode: () => {
      complexity++;
    },
    visitBinaryOpNode: (_node: BinaryOpNode<L>) => {},
    visitUnaryOpNode: (_node: UnaryOpNode<L>) => {},
  });

  return complexity;
}

interface ExprFolder<T, L extends object = object> {
  visitNumberNode(node: NumberNode<L>): T;
  visitDiceExprNode(node: DiceExprNode<L>): T;
  visitBinaryOpNode(node: BinaryOpNode<L>, left: T, right: T): T;
  visitUnaryOpNode(node: UnaryOpNode<L>, operand: T): T;
}

export function foldExpr<T, L extends object = object>(
  expr: ExprNode<L>,
  folder: ExprFolder<T, L>,
): T {
  const resultStack: T[] = [];

  expr.walk({
    visitNumberNode: (node: NumberNode<L>) => {
      resultStack.push(folder.visitNumberNode(node));
    },
    visitDiceExprNode: (node: DiceExprNode<L>) => {
      resultStack.push(folder.visitDiceExprNode(node));
    },
    visitBinaryOpNode: (node: BinaryOpNode<L>) => {
      const right = resultStack.pop();
      const left = resultStack.pop();
      resultStack.push(folder.visitBinaryOpNode(node, left!, right!));
    },
    visitUnaryOpNode: (node: UnaryOpNode<L>) => {
      const operand = resultStack.pop();
      resultStack.push(folder.visitUnaryOpNode(node, operand!));
    },
  });

  if (resultStack.length !== 1) {
    throw new Error(
      `Expected a single result, but got ${resultStack.length} results.`,
    );
  }

  return resultStack[0];
}

export function rollsFromMap<L extends object>(
  rolls: Map<DiceExprNode<L>, number[]>,
): (expr: DiceExprNode<L>) => number[] | undefined {
  return rolls.get.bind(rolls);
}

export function rollsFromIterator(
  rolls: Iterable<{ rolls: number[] }>,
): <L extends object>(expr: DiceExprNode<L>) => number[] | undefined {
  const iter = Iterator.from(rolls);
  return () => {
    const next = iter.next();
    return next.done ? undefined : next.value.rolls;
  };
}

// evaluateExpr evaluates an expression by supplying rolls for each dice expression and
// attaching the value at each node as a label.
export function evaluateExpr<L extends object>(
  expr: ExprNode<L>,
  rollsFor: (expr: DiceExprNode<L>, index: number) => number[] | undefined,
): ExprNode<L & { value: number; rolls?: number[] }> {
  let index = 0;
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode<L>) => {
      return node.updateLabels((current) => ({
        ...current,
        value: node.value,
      }));
    },
    visitDiceExprNode: (node: DiceExprNode<L>) => {
      const rolls = rollsFor(node, index++);
      if (!rolls) {
        throw new Error(
          `No rolls found for expression ${node.toString()} in the provided map.`,
        );
      }
      if (rolls.length !== node.dice.count) {
        throw new Error(
          `Expected ${node.dice.count} rolls for expression ${node.toString()}, but got ${rolls.length}.`,
        );
      }
      const invalidRolls = rolls.filter(
        (roll) => roll < 1 || roll > node.dice.sides,
      );
      if (invalidRolls.length > 0) {
        throw new Error(
          `Invalid rolls found for expression ${node.toString()}: ${invalidRolls.join(", ")}`,
        );
      }
      const total = rolls.reduce((sum, roll) => sum + roll, 0);
      return node.updateLabels((current) => ({
        ...current,
        value: total,
        rolls,
      }));
    },
    visitBinaryOpNode: (
      node: BinaryOpNode<L>,
      left: ExprNode<L & { value: number; rolls?: number[] }>,
      right: ExprNode<L & { value: number; rolls?: number[] }>,
    ) => {
      const result = BinaryOpNode.applyOperator(
        node.operator,
        left.label.value,
        right.label.value,
      );
      return new BinaryOpNode(left, node.operator, right, {
        ...node.label,
        value: result,
      });
    },
    visitUnaryOpNode: (
      node: UnaryOpNode<L>,
      operand: ExprNode<L & { value: number }>,
    ) => {
      const result = UnaryOpNode.applyOperator(
        node.operator,
        operand.label.value,
      );
      return new UnaryOpNode(node.operator, operand, {
        ...node.label,
        value: result,
      });
    },
  });
}

/** toStringWithValues renders an evaluated (w/ evaluateExpr) tree with inline roll results. */
export function toStringWithValues(
  expr: ExprNode<{ value: number; rolls?: number[] }>,
  includeResult: boolean = true,
): string {
  const rendered = foldExpr(expr, {
    visitDiceExprNode(node) {
      return `${node.dice.toString()}{${(node.label.rolls ?? ["?"]).join("+")}=${node.label.value}}`;
    },
    visitNumberNode(node) {
      return node.toString();
    },
    visitUnaryOpNode(node, operand) {
      return `${node.operator}${parenStringIf(node.operand.precedence < node.precedence, operand)}`;
    },
    visitBinaryOpNode(node, left, right) {
      return `${parenStringIf(node.left.precedence < node.precedence, left)} ${node.operator} ${parenStringIf(node.right.precedence < node.precedence, right)}`;
    },
  });
  return includeResult ? `${rendered} = ${expr.label.value}` : rendered;
}

export function calcRange<L extends object>(
  expr: ExprNode<L>,
): [number, number] {
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode<L>) => [node.value, node.value],
    visitDiceExprNode: (node: DiceExprNode<L>) => [
      node.dice.minRoll(),
      node.dice.maxRoll(),
    ],
    visitBinaryOpNode: (
      _node: BinaryOpNode<L>,
      [leftMin, leftMax]: [number, number],
      [rightMin, rightMax]: [number, number],
    ) => {
      switch (_node.operator) {
        case "+":
          return [leftMin + rightMin, leftMax + rightMax];
        case "-":
          return [leftMin - rightMax, leftMax - rightMin];
        case "*": {
          // brute force handling of negative ranges
          const vals = [
            leftMin * rightMin,
            leftMin * rightMax,
            leftMax * rightMin,
            leftMax * rightMax,
          ];
          vals.sort((a, b) => a - b);
          return [vals[0], vals[vals.length - 1]];
        }
        case "/": {
          if (rightMin <= 0 && rightMax >= 0) {
            throw new Error("Unsupported case of division by zero");
          }
          const vals = [
            Math.floor(leftMin / rightMin),
            Math.floor(leftMin / rightMax),
            Math.floor(leftMax / rightMin),
            Math.floor(leftMax / rightMax),
          ];
          vals.sort((a, b) => a - b);
          return [vals[0], vals[vals.length - 1]];
        }
        case "%": {
          // TODO: not the most efficient, but whatever
          const results: number[] = [];
          for (const rightVal of numberRange(rightMin, rightMax)) {
            for (const leftVal of numberRange(leftMin, leftMax)) {
              results.push(((leftVal % rightVal) + rightVal) % rightVal);
            }
          }
          results.sort((a, b) => a - b);
          const min = results[0];
          const max = results[results.length - 1];
          return [min, max];
        }
        default:
          throw new Error(`Unknown operator: ${_node.operator}`);
      }
    },
    visitUnaryOpNode: (_node: UnaryOpNode<L>, [min, max]: [number, number]) => [
      -max,
      -min,
    ],
  });
}

const STANDARD_DICE = [100, 20, 12, 10, 8, 6, 4];
export function isStandardDice(dice: Dice): boolean {
  return STANDARD_DICE.includes(dice.sides);
}

const KNOWN_DICE: [number, ExprNode][] = [
  [
    1000,
    parseDiceExpression("(100 * (1d10 % 10) + 1d100 % 100 - 1) % 1000 + 1"),
  ],
  [100, parseDiceExpression("1d100")],
  [10, parseDiceExpression("1d10")],
  [6, parseDiceExpression("1d6")],
  [20, parseDiceExpression("1d20")],
  [12, parseDiceExpression("1d12")],
  [8, parseDiceExpression("1d8")],
  [4, parseDiceExpression("1d4")],
  [5, parseDiceExpression("(1d10 - 1) / 2 + 1")],
  [3, parseDiceExpression("(1d6 - 1) / 2 + 1")],
  [2, parseDiceExpression("(1d6 - 1) / 3 + 1")],
];

/** Given a dice with a non-standard number of sides, generate an equivalent dice expression
 * that rolls only standard dice. For example, for a 36-sided dice, this will return
 * "6 * (1d6 - 1) + 1d6".
 * @param sides The number of sides on the dice
 * @returns A dice expression that rolls only standard dice
 */
export function convertToStandardDice(sides: number): ExprNode {
  if (sides <= 0 || !Number.isInteger(sides)) {
    throw new Error(`Invalid number of sides: ${sides}`);
  }

  function factor(sides: number, placeValue: number): ExprNode | undefined {
    const candidates = [];

    for (const [standardSide, diceExpr] of KNOWN_DICE) {
      if (sides % standardSide === 0) {
        const node =
          placeValue > 1
            ? new BinaryOpNode(
                new NumberNode(placeValue, {}),
                "*",
                new BinaryOpNode(
                  diceExpr.copy(),
                  "-",
                  new NumberNode(1, {}),
                  {},
                ),
                {},
              )
            : diceExpr.copy();
        const remainder = sides / standardSide;
        // If we have no remainder, we're done
        if (remainder == 1) {
          candidates.push(node);
        } else {
          // Otherwise, let's try to factor the remainder
          const subFactor = factor(remainder, placeValue * standardSide);
          if (subFactor) {
            candidates.push(new BinaryOpNode(node, "+", subFactor, {}));
          }
        }

        // If we can't factor the remainder, continue trying other dice at this level
      }
    }
    const results = candidates
      .map((candidate) => ({
        complexity: countComplexity(candidate),
        candidate,
      }))
      // Sort from least complex to most complex
      .sort((a, b) => a.complexity - b.complexity);
    return results.length > 0 ? results[0].candidate : undefined;
  }

  return (
    factor(sides, 1) ?? DiceExprNode.fromDiceString(`1d${sides}`, undefined, {})
  );
}

const conversionCache = new Map<number, ExprNode<object>>();
export function convertToStandardDiceCached(
  sides: number,
  kind?: DieKind,
): ExprNode<object> {
  if (conversionCache.has(sides)) {
    return conversionCache.get(sides)!.withKind(kind);
  }
  const result = convertToStandardDice(sides);
  conversionCache.set(sides, result);
  return result.withKind(kind);
}

export function expandNonStandardDice<L extends object>(
  expr: ExprNode<L>,
  labeler: (
    originalLabels: L,
    isNewRoot: boolean,
    originalExpr: ExprNode<L>,
    index?: number,
  ) => L = (l) => l,
): ExprNode<L> {
  function expand(diceExpr: DiceExprNode<L>): ExprNode<L> {
    const dice = diceExpr.dice;
    if (isStandardDice(dice)) {
      return diceExpr;
    }
    const count = dice.count;
    let index = 0;
    let node: ExprNode<L> = convertToStandardDiceCached(
      dice.sides,
      dice.kind,
    ).updateLabels(() => labeler(diceExpr.label, count == 1, diceExpr, index));
    while (++index < count) {
      node = new BinaryOpNode<L>(
        node,
        "+",
        convertToStandardDiceCached(dice.sides, dice.kind).updateLabels(() =>
          labeler(diceExpr.label, false, diceExpr, index),
        ),
        labeler(diceExpr.label, count + 1 == index, diceExpr),
      );
    }
    return node;
  }
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode<L>) => node,
    visitDiceExprNode: (node: DiceExprNode<L>) => expand(node),
    visitBinaryOpNode: (
      node: BinaryOpNode<L>,
      left: ExprNode<L>,
      right: ExprNode<L>,
    ) => new BinaryOpNode(left, node.operator, right, node.label),
    visitUnaryOpNode: (node: UnaryOpNode<L>, operand: ExprNode<L>) =>
      new UnaryOpNode(node.operator, operand, node.label),
  });
}

export const ExprId: unique symbol = Symbol("ExprId");

/** Apply a numbered label to each dice expression. */
export function numberDiceExpressions<
  const K extends string | symbol,
  L extends object,
>(key: K, expr: ExprNode<L>): ExprNode<L & { [k in K]?: number }> {
  let counter = 0;
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode<L>) => node,
    visitDiceExprNode: (node: DiceExprNode<L>) => {
      const label = ++counter;
      const labeledNode = node.updateLabels((current) => ({
        ...current,
        [key]: label,
      }));
      return labeledNode;
    },
    visitBinaryOpNode: (
      node: BinaryOpNode<L>,
      left: ExprNode<L>,
      right: ExprNode<L>,
    ) => new BinaryOpNode(left, node.operator, right, node.label),
    visitUnaryOpNode: (node: UnaryOpNode<L>, operand: ExprNode<L>) =>
      new UnaryOpNode(node.operator, operand, node.label),
  });
}

export function isDiceExprNode<L extends object>(
  expr: ExprNode<L>,
): expr is DiceExprNode<L> {
  return expr instanceof DiceExprNode;
}
