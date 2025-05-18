import { createDataswornMarkdownLink } from "datastore/parsers/datasworn/id";
import * as kdl from "kdljs";
import { Document, Node } from "kdljs";
import { CurseBehavior } from "model/oracle";
import { RollWrapper } from "model/rolls";
import {
  ActionMoveDescription,
  MoveDescription,
  moveIsAction,
  moveIsProgress,
} from "moves/desc";
import { oracleNameWithParents } from "oracles/render";
import { RollContainer } from "oracles/state";
import { ProgressTrackWriterContext } from "tracks/writer";
import { node } from "utils/kdl";

export function createProgressNode(
  // NB(@zkat): passed in as separate argument because we usually strip
  // markdown before passing it down.
  trackName: string,
  trackContext: ProgressTrackWriterContext,
  steps: number,
): kdl.Node {
  return node("progress", {
    properties: {
      name: `[[${trackContext.location}|${trackName}]]`,
      from: trackContext.track.progress,
      rank: trackContext.track.rank,
      steps,
    },
  });
}

export function createTrackCreationNode(
  trackName: string,
  trackPath: string,
): kdl.Node {
  return node("track", {
    properties: {
      name: `[[${trackPath}|${trackName}]]`,
      status: "added",
    },
  });
}

export function createTrackCompletionNode(
  trackName: string,
  trackPath: string,
): kdl.Node {
  return node("track", {
    properties: {
      name: `[[${trackPath}|${trackName}]]`,
      status: "removed",
    },
  });
}

export function createOracleNode(
  roll: RollWrapper,
  prompt?: string,
  name?: string,
  cursedResult?: RollWrapper,
): kdl.Node {
  const props: { name: string; roll: number; result: string; cursed?: number } =
    {
      name: createDataswornMarkdownLink(
        name ?? oracleNameWithParents(roll.oracle),
        roll.oracle.id,
      ),
      // TODO: this is preposterous
      roll: roll.roll.roll,
      result: roll.ownResult,
    };
  if (roll.cursedRoll != null) {
    props.cursed = roll.cursedRoll;
  }
  const baseResult = node("oracle", {
    properties: props,
    children: [
      ...(prompt ? [node("-", { values: [prompt] })] : []),
      ...Object.values(roll.subrolls)
        .flatMap((subroll) => subroll.rolls)
        .map((subroll) => createOracleNode(subroll)),
    ],
  });
  if (cursedResult) {
    baseResult.children.push(createOracleNode(cursedResult));
    baseResult.properties.replaced =
      cursedResult.oracle.curseBehavior === CurseBehavior.ReplaceResult;
  }
  return baseResult;
}

export function generateActionRoll(move: ActionMoveDescription): Node {
  const adds = (move.adds ?? []).reduce((acc, { amount }) => acc + amount, 0);
  return node("roll", {
    values: [move.stat],
    properties: {
      action: move.action,
      stat: move.statVal,
      adds,
      vs1: move.challenge1,
      vs2: move.challenge2,
    },
  });
}

export function generateMechanicsNode(move: MoveDescription): Document {
  const children: Node[] = [];
  if (moveIsAction(move)) {
    // Add "add" nodes for each non-zero add
    children.push(
      ...(move.adds ?? [])
        .filter(({ amount }) => amount != 0)
        .map(({ amount, desc }) =>
          node("add", { values: [amount, ...(desc ? [desc] : [])] }),
        ),
    );

    // Main roll node
    children.push(generateActionRoll(move));

    // Momentum burn
    if (move.burn) {
      children.push(
        node("burn", {
          properties: { from: move.burn.orig, to: move.burn.reset },
        }),
      );
    }
  } else if (moveIsProgress(move)) {
    children.push(
      node("progress-roll", {
        properties: {
          // TODO: use a ticks prop instead... or at least use a helper to get this
          name: move.progressTrack,
          score: Math.floor(move.progressTicks / 4),
          vs1: move.challenge1,
          vs2: move.challenge2,
        },
      }),
    );
  } else {
    // Nothing to do for a no-roll move
  }

  const doc: Document = [
    node("move", {
      values: [generateMoveLink(move)],
      children,
    }),
  ];
  return doc;
}

function generateMoveLink(move: MoveDescription): string {
  return move.id ? createDataswornMarkdownLink(move.name, move.id) : move.name;
}

export function createOracleGroup(
  name: string,
  oracles: {
    name?: string;
    rolls: RollContainer[];
  }[],
): kdl.Node {
  return node("oracle-group", {
    properties: {
      name,
    },
    children: oracles.flatMap(({ name, rolls }) =>
      rolls.map((rollContainer) =>
        createOracleNode(
          rollContainer.mainResult.currentRoll(),
          undefined,
          name,
          rollContainer.isCursable() && rollContainer.useCursedResult
            ? rollContainer.cursedResult.currentRoll()
            : undefined,
        ),
      ),
    ),
  });
}

export function createDetailsNode(details: string): kdl.Node {
  return node("-", {
    values: [details],
  });
}

export function createInitiativeNode(
  label: "initiative" | "position",
  oldIntiative: string | undefined,
  newInitiative: string | undefined,
) {
  const properties: { to?: string; from?: string } = {};

  if (oldIntiative !== undefined) {
    properties.from = oldIntiative;
  }

  if (newInitiative !== undefined) {
    properties.to = newInitiative;
  }

  return node(label, {
    properties,
  });
}
