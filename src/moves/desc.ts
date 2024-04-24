import {
  Parser,
  choice,
  error,
  grammar,
  integer,
  many,
  map,
  optional,
  regexp,
  run,
  sequence,
  string,
  takeMid,
  takeRight,
  takeSides,
  whitespace,
  whole,
} from "@nrsk/sigma";
import { z } from "zod";
import { Either, Left, Right } from "../utils/either";

const BaseMoveDescriptionSchema = z.object({
  name: z.string(),
});

// type BaseMoveDescription = z.infer<typeof BaseMoveDescriptionSchema>;

const BurnSchema = z.object({
  orig: z.number().int(),
  reset: z.number().int(),
});

// exploring different move formats:
// moveId: action +val(stat) +val(bonus1) vs c1 and c2 (burn: orig>reset)

// yaml:
// moveId: move id
// action: 3 +2:wits +1:add1 +2:add2
// add1: reason1
// add2: reason2
// challenge: [1, 2]

// action:
// - roll: 3
// - meter: 2 wits
// - add: +1

const SIGNED_INTEGER_RE = /(\+|-)(0|[1-9][0-9]*)/g;

function signedInteger(): Parser<number> {
  return error(
    choice(
      map(takeRight(string("+"), whole()), (num) => num),
      map(takeRight(string("-"), whole()), (num) => -1 * num),
    ),
    "number prefixed with a + or a -",
  );
}

function modifierWithDesc(): Parser<{ amount: number; desc: string }> {
  return modifier(true) as Parser<{ amount: number; desc: string }>;
}

function modifier(
  requireDesc: boolean = false,
): Parser<{ amount: number; desc: string | null }> {
  const descParser = takeMid(
    string("{"),
    regexp(/[^\}\{]+/g, "string without curly braces"),
    string("}"),
  );
  return map(
    sequence(signedInteger(), requireDesc ? descParser : optional(descParser)),
    ([amount, desc]) => ({
      amount,
      desc,
    }),
  );
}

const moveGrammar = grammar({
  moveExp(): Parser<ActionMoveDescription> {
    return map(
      sequence(
        this.moveIdent,
        string(":"),
        takeMid(whitespace(), integer(), whitespace()),
        modifierWithDesc(),
        many(takeRight(whitespace(), modifier())),
        takeMid(whitespace(), string("vs"), whitespace()),
        takeSides(
          whole(),
          sequence(optional(whitespace()), string(","), optional(whitespace())),
          whole(),
        ),
      ),
      ([
        name,
        _colon,
        action,
        statMod,
        adds,
        _vs,
        [challenge1, challenge2],
      ]) => {
        return {
          name,
          action,
          stat: statMod.desc,
          statVal: statMod.amount,
          adds: adds.reduce((prev, { amount }) => prev + amount, 0),
          challenge1,
          challenge2,
        };
      },
    );
  },

  moveIdent(): Parser<string> {
    return regexp(/[a-z]\w*(\/\w+)*/gi, "move identifier");
  },
});

export function parseMove(line: string): Either<string, ActionMoveDescription> {
  const result = run(moveGrammar.moveExp).with(line);
  if (result.isOk) {
    return Right.create(result.value);
  } else {
    const [start, end] = result.span;
    return Left.create(
      `Expected: ${result.expected} at ${result.span}: ${line.slice(Math.max(0, start - 5), start)}[${line.slice(start, end + 1)}]${line.slice(end + 1)}`,
    );
  }
}

const ActionMoveDescriptionSchema = BaseMoveDescriptionSchema.extend({
  action: z.number().int(),
  stat: z.string(),
  statVal: z.number().int(),
  adds: z.number().int(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
  burn: z.optional(BurnSchema),
});

export type ActionMoveDescription = z.infer<typeof ActionMoveDescriptionSchema>;

const ProgressMoveDescriptionSchema = BaseMoveDescriptionSchema.extend({
  progressTrack: z.string(),
  progressTicks: z.number(),
  challenge1: z.number().int(),
  challenge2: z.number().int(),
});

export type ProgressMoveDescription = z.infer<
  typeof ProgressMoveDescriptionSchema
>;

export const MoveDescriptionSchema = z.union([
  ActionMoveDescriptionSchema,
  ProgressMoveDescriptionSchema,
]);

export type MoveDescription = z.infer<typeof MoveDescriptionSchema>;
export function moveIsAction(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ActionMoveDescription).action !== undefined;
}

export function moveIsProgress(
  move: MoveDescription,
): move is ActionMoveDescription {
  return (move as ProgressMoveDescription).progressTrack !== undefined;
}
