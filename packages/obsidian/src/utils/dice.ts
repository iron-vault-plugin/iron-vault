import { numberRange } from "./numbers";

export function randomInt(min: number, max: number): number {
  const randomBuffer = new Uint32Array(1);

  crypto.getRandomValues(randomBuffer);

  const randomNumber = randomBuffer[0] / (4294967295 + 1);
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(randomNumber * (max - min + 1) + min);
}

const DICE_REGEX = /^(\d+)d(\d+)$/;

export enum DieKind {
  Action = "action",
  Challenge1 = "challenge1",
  Challenge2 = "challenge2",
  Oracle = "oracle",
  Cursed = "cursed",
}

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
    public readonly kind?: DieKind,
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
    for (let i = 0; i < this.count; i++) {
      total += randomInt(1, this.sides);
    }
    return total;
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
}

export interface ExprNode {
  evaluate(valueFor: (dice: Dice) => number): number;
  walk(visitor: Visitor): void;
  toString(): string;
  get precedence(): number;
  copy(): ExprNode;
  withKind(kind?: DieKind): ExprNode;
}

export interface Visitor {
  visitNumberNode?(node: NumberNode): void;
  visitDiceExprNode?(node: DiceExprNode): void;
  visitBinaryOpNode?(node: BinaryOpNode): void;
  visitUnaryOpNode?(node: UnaryOpNode): void;
}

export class NumberNode implements ExprNode {
  constructor(public value: number) {}

  evaluate(_valueFor: (dice: Dice) => number): number {
    return this.value;
  }

  walk(visitor: Visitor): void {
    visitor.visitNumberNode?.(this);
  }

  toString(): string {
    return this.value.toString();
  }
  get precedence(): number {
    return 10;
  }

  copy(): NumberNode {
    return new NumberNode(this.value);
  }

  withKind(_kind?: DieKind): ExprNode {
    return this;
  }
}

export class DiceExprNode implements ExprNode {
  constructor(public readonly dice: Dice) {}

  static fromDiceString(
    diceSpec: string,
    kind: DieKind | undefined,
  ): DiceExprNode {
    return new DiceExprNode(Dice.fromDiceString(diceSpec, kind));
  }

  evaluate(valueFor: (dice: Dice) => number): number {
    return valueFor(this.dice);
  }

  walk(visitor: Visitor): void {
    visitor.visitDiceExprNode?.(this);
  }

  toString(): string {
    return this.dice.toString();
  }

  get precedence(): number {
    return 10;
  }

  copy(): DiceExprNode {
    return new DiceExprNode(this.dice.copy());
  }

  withKind(kind: DieKind): DiceExprNode {
    return new DiceExprNode(this.dice.withKind(kind));
  }
}

export class BinaryOpNode implements ExprNode {
  constructor(
    public left: ExprNode,
    public operator: string,
    public right: ExprNode,
  ) {}

  evaluate(valueFor: (dice: Dice) => number): number {
    const leftVal = this.left.evaluate(valueFor);
    const rightVal = this.right.evaluate(valueFor);

    switch (this.operator) {
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
        throw new Error(`Unknown operator: ${this.operator}`);
    }
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

  walk(visitor: Visitor): void {
    this.left.walk(visitor);
    this.right.walk(visitor);
    visitor.visitBinaryOpNode?.(this);
  }

  toString(): string {
    return `${wrapIfNeeded(this.left, this.precedence)} ${this.operator} ${wrapIfNeeded(this.right, this.precedence)}`;
  }

  copy(): ExprNode {
    return new BinaryOpNode(this.left.copy(), this.operator, this.right.copy());
  }

  withKind(kind?: DieKind): ExprNode {
    const left = this.left.withKind(kind);
    const right = this.right.withKind(kind);
    if (left != this.left || right != this.right) {
      return new BinaryOpNode(left, this.operator, right);
    } else {
      return this;
    }
  }
}

function wrapIfNeeded(node: ExprNode, precedence: number): string {
  return parenStringIf(node.precedence < precedence, node.toString());
}

export function parenStringIf(expr: boolean, str: string): string {
  return expr ? `(${str})` : str;
}

export class UnaryOpNode implements ExprNode {
  constructor(
    public operator: string,
    public operand: ExprNode,
  ) {}

  evaluate(valueFor: (dice: Dice) => number): number {
    const val = this.operand.evaluate(valueFor);
    switch (this.operator) {
      case "-":
        return -val;
      default:
        throw new Error(`Unknown unary operator: ${this.operator}`);
    }
  }

  walk(visitor: Visitor): void {
    this.operand.walk(visitor);
    visitor.visitUnaryOpNode?.(this);
  }

  toString(): string {
    return `${this.operator}${this.operand.precedence < this.precedence ? `(${this.operand})` : this.operand}`;
  }

  get precedence(): number {
    return 5;
  }

  copy(): ExprNode {
    return new UnaryOpNode(this.operator, this.operand.copy());
  }

  withKind(kind?: DieKind): ExprNode {
    const operand = this.operand.withKind(kind);
    if (operand != this.operand) {
      return new UnaryOpNode(this.operator, operand);
    } else {
      return this;
    }
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
      expr = new BinaryOpNode(expr, operator, right);
    }

    return expr;
  }

  private multiplicative(): ExprNode {
    let expr = this.unary();

    while (this.match("*") || this.match("/") || this.match("%")) {
      const operator = this.previous();
      const right = this.unary();
      expr = new BinaryOpNode(expr, operator, right);
    }

    return expr;
  }

  private unary(): ExprNode {
    if (this.match("-")) {
      const right = this.unary();
      return new UnaryOpNode("-", right);
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
            return DiceExprNode.fromDiceString(diceExpr, this.dieKind);
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
      return new NumberNode(value);
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

export function parseDiceExpression(expr: string, kind?: DieKind): ExprNode {
  const parser = new DiceExpressionParser(expr, kind);
  return parser.parse();
}

export function gatherDice(expr: ExprNode): Dice[] {
  const dice: Dice[] = [];

  expr.walk({
    visitDiceExprNode: (node: DiceExprNode) => {
      dice.push(node.dice);
    },
  });

  return dice;
}

export function countComplexity(expr: ExprNode): number {
  let complexity = 0;

  expr.walk({
    visitNumberNode: () => {},
    visitDiceExprNode: () => {
      complexity++;
    },
    visitBinaryOpNode: (_node: BinaryOpNode) => {},
    visitUnaryOpNode: (_node: UnaryOpNode) => {},
  });

  return complexity;
}

interface ExprFolder<T> {
  visitNumberNode(node: NumberNode): T;
  visitDiceExprNode(node: DiceExprNode): T;
  visitBinaryOpNode(node: BinaryOpNode, left: T, right: T): T;
  visitUnaryOpNode(node: UnaryOpNode, operand: T): T;
}

export function foldExpr<T>(expr: ExprNode, folder: ExprFolder<T>): T {
  const resultStack: T[] = [];

  expr.walk({
    visitNumberNode: (node: NumberNode) => {
      resultStack.push(folder.visitNumberNode(node));
    },
    visitDiceExprNode: (node: DiceExprNode) => {
      resultStack.push(folder.visitDiceExprNode(node));
    },
    visitBinaryOpNode: (node: BinaryOpNode) => {
      const right = resultStack.pop();
      const left = resultStack.pop();
      resultStack.push(folder.visitBinaryOpNode(node, left!, right!));
    },
    visitUnaryOpNode: (node: UnaryOpNode) => {
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

export function calcRange(expr: ExprNode): [number, number] {
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode) => [node.value, node.value],
    visitDiceExprNode: (node: DiceExprNode) => [
      node.dice.minRoll(),
      node.dice.maxRoll(),
    ],
    visitBinaryOpNode: (
      _node: BinaryOpNode,
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
    visitUnaryOpNode: (_node: UnaryOpNode, [min, max]: [number, number]) => [
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
                new NumberNode(placeValue),
                "*",
                new BinaryOpNode(diceExpr.copy(), "-", new NumberNode(1)),
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
            candidates.push(new BinaryOpNode(node, "+", subFactor));
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
    factor(sides, 1) ?? DiceExprNode.fromDiceString(`1d${sides}`, undefined)
  );
}

const conversionCache = new Map<number, ExprNode>();
export function convertToStandardDiceCached(
  sides: number,
  kind?: DieKind,
): ExprNode {
  if (conversionCache.has(sides)) {
    return conversionCache.get(sides)!.withKind(kind);
  }
  const result = convertToStandardDice(sides);
  conversionCache.set(sides, result);
  return result.withKind(kind);
}

export function expandNonStandardDice(expr: ExprNode): ExprNode {
  function expand(diceExpr: DiceExprNode): ExprNode {
    const dice = diceExpr.dice;
    if (isStandardDice(dice)) {
      return diceExpr;
    }
    let count = dice.count;
    let node = convertToStandardDiceCached(dice.sides, dice.kind);
    while (--count > 0) {
      node = new BinaryOpNode(
        node,
        "+",
        convertToStandardDiceCached(dice.sides, dice.kind),
      );
    }
    return node;
  }
  return foldExpr(expr, {
    visitNumberNode: (node: NumberNode) => node,
    visitDiceExprNode: (node: DiceExprNode) => expand(node),
    visitBinaryOpNode: (node: BinaryOpNode, left: ExprNode, right: ExprNode) =>
      new BinaryOpNode(left, node.operator, right),
    visitUnaryOpNode: (node: UnaryOpNode, operand: ExprNode) =>
      new UnaryOpNode(node.operator, operand),
  });
}
