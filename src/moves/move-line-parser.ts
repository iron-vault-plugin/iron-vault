import {
  FailingParser,
  Parser,
  choice,
  eof,
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
  takeLeft,
  takeMid,
  takeRight,
  takeSides,
  when,
  whitespace,
  whole,
} from "@nrsk/sigma";
import { Either, Left, Right } from "utils/either";
import {
  ActionMoveDescription,
  BurnDescriptor,
  MoveDescription,
  ProgressMoveDescription,
  moveIsAction,
  moveIsProgress,
} from "./desc";

// exploring different move formats:

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

function descriptor(): Parser<string> {
  return takeMid(
    string("{"),
    regexp(/[^}{]+/g, "string without curly braces"),
    string("}"),
  );
}

function modifier(
  requireDesc: boolean = false,
): Parser<{ amount: number; desc: string | undefined }> {
  const descParser = descriptor();
  return map(
    sequence(signedInteger(), requireDesc ? descParser : optional(descParser)),
    ([amount, desc]) => ({
      amount,
      desc: desc === null ? undefined : desc,
    }),
  );
}
function alwaysFail(expected: string): FailingParser {
  return {
    parse(input, pos) {
      return { expected, isOk: false, pos, span: [pos, pos] };
    },
  };
}
const moveGrammar = grammar({
  // moveId: action 4 +1{wits} +2{reason} vs c1 and c2 (burn: orig>reset)
  // moveId: progress 5{trackid} vs c1 and c2
  moveExp(): Parser<MoveDescription> {
    return map(
      sequence(
        takeLeft(this.moveIdent, sequence(string(":"), whitespace())),
        when(
          takeLeft(
            error(
              choice(string("action"), string("progress")),
              "action or progress",
            ),
            whitespace(),
          ),
          (ctx) => {
            switch (ctx.value) {
              case "action":
                return this.actionMoveExp;
              case "progress":
                return this.progressMoveExp;
              default:
                return alwaysFail("'action' or 'progress'");
            }
          },
        ),
        eof(),
      ),
      ([name, move]) => {
        return {
          ...move,
          name,
        };
      },
    );
  },

  actionMoveExp(): Parser<Omit<ActionMoveDescription, "name">> {
    return map(
      sequence(
        takeLeft(integer(), whitespace()),
        modifierWithDesc(),
        many(takeRight(whitespace(), modifier())),
        takeMid(whitespace(), string("vs"), whitespace()),
        takeSides(
          whole(),
          sequence(optional(whitespace()), string(","), optional(whitespace())),
          whole(),
        ),
        optional(takeRight(whitespace(), this.burnDescriptor)),
      ),
      ([action, statMod, adds, _vs, [challenge1, challenge2], burn]) => {
        return {
          action,
          stat: statMod.desc,
          statVal: statMod.amount,
          adds,
          challenge1,
          challenge2,
          burn: burn ?? undefined,
        };
      },
    );
  },

  // moveId: progress 5(trackid) vs c1, c2
  progressMoveExp(): Parser<Omit<ProgressMoveDescription, "name">> {
    return map(
      sequence(
        error(
          map(
            sequence(whole(), descriptor()),
            ([progressTicks, progressTrack]) => ({
              progressTicks,
              progressTrack,
            }),
          ),
          "progressTicks{progressTrackId}",
        ),
        takeMid(whitespace(), string("vs"), whitespace()),
        takeSides(
          whole(),
          sequence(optional(whitespace()), string(","), optional(whitespace())),
          whole(),
        ),
      ),
      ([progressInfo, _vs, [challenge1, challenge2]]) => {
        return {
          ...progressInfo,
          challenge1,
          challenge2,
        };
      },
    );
  },

  // (burn: orig>reset)
  burnDescriptor(): Parser<BurnDescriptor> {
    return map(
      sequence(
        string("(burn:"),
        optional(whitespace()),
        whole(),
        optional(whitespace()),
        string(">"),
        optional(whitespace()),
        whole(),
        string(")"),
      ),
      ([_burn, _ws1, orig, _ws2, _angle, _ws3, reset]) => ({ orig, reset }),
    );
  },

  moveIdent(): Parser<string> {
    return regexp(/[a-z]\w*(\/\w+)*/gi, "move identifier");
  },
});

export function parseMoveLine(line: string): Either<string, MoveDescription> {
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

export function generateMoveLine(move: MoveDescription): string {
  /** Remove curly braces from descriptors. */
  function formatDescriptor(desc?: string): string {
    if (!desc) return "";
    const cleaned = desc.replaceAll(/[{}]/g, "");
    if (cleaned != desc) {
      // TODO: maybe i should validate earlier in creating a MoveDesc object that things conform (like no curly braces in progres track)
      console.warn("Stripped curly braces from descriptor: %s", desc);
    }
    return `{${cleaned}}`;
  }
  function formatAdd(add: { amount: number; desc?: string }): string {
    return `${add.amount > 0 ? "+" : ""}${add.amount}${formatDescriptor(add.desc)}`;
  }
  if (moveIsProgress(move)) {
    return `${move.name}: progress ${move.progressTicks}${formatDescriptor(move.progressTrack)} vs ${move.challenge1},${move.challenge2}`;
  } else if (moveIsAction(move)) {
    const burn = move.burn
      ? ` (burn: ${move.burn.orig}>${move.burn.reset})`
      : "";
    return `${move.name}: action ${move.action} ${formatAdd({ amount: move.statVal, desc: move.stat })} ${move.adds.map(formatAdd).join(" ")} vs ${move.challenge1},${move.challenge2}${burn}`;
  } else {
    throw new Error("Unknown move type", { cause: { move } });
  }
}
