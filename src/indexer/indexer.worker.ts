import { DataIndexDb, createDataIndexDb } from "datastore/db";
import { DataswornTypes } from "datastore/loader/datasworn-indexer";
import { IndexCommand } from "datastore/loader/messages";
import { rootLogger } from "logger";
import { Graph, registerData, registerPlaysetHasher } from "./graph";

const logger = rootLogger.getLogger("indexer.worker");
logger.setDefaultLevel("debug");

// type IndexResult = {};

// declare function postMessage(
//   message: IndexResult,
//   options?: WindowPostMessageOptions,
// ): void;

async function computeHash(data: string): Promise<Uint8Array> {
  const textEncoder = new TextEncoder();
  const encodedData = textEncoder.encode(data);

  // Use the SubtleCrypto API to compute the SHA-256 hash
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encodedData));
}

(async () => {
  logger.debug("[indexer.worker] Initializing database");
  main(await createDataIndexDb<DataswornTypes>());
  logger.debug("[indexer.worker] Database initialized");
})().catch((error) => {
  logger.error(
    "[indexer.worker] Error initializing database: %s",
    error,
    error.stack,
  );
});

function main(db: DataIndexDb<DataswornTypes>) {
  const graph = new Graph();
  registerPlaysetHasher(graph, registerData(graph, db));

  let pendingAction: Promise<void> | null = null;
  self.onmessage = (event: MessageEvent<IndexCommand>) => {
    const command = event.data;

    logger.log("Received command", command);

    let action: Promise<() => void> | null = null;
    switch (command.type) {
      case "index":
        action = computeHash(command.content).then(
          (hash) => () =>
            graph.addOrUpdateFile({
              content: command.content,
              filerev: hash.toString(),
              path: command.path,
            }),
        );
        break;
      case "delete":
        action = Promise.resolve(() => graph.removeFile(command.path));
        break;
      case "rename":
        action = Promise.resolve(() =>
          graph.renameFile(command.oldPath, command.newPath),
        );
        break;
      case "debug":
        {
          console.log("[data-loader.worker] Current state of content manager:");
          for (const [k, v] of graph.allNodes()) {
            console.log("[data-loader.worker] - %s: %o", k, v);
          }
        }
        break;
      case "addRoot":
      case "removeRoot":
      case "setMetaRoot":
        // just ignoring these commands
        break;
      default: {
        const _: never = command;
        console.error("[data-loader.worker] Unknown command type: %s", _);
      }
    }
    if (action) {
      pendingAction = Promise.resolve(
        pendingAction ?? Promise.resolve(void 0),
      ).then(() =>
        Promise.resolve(action).then((act) => {
          logger.debug(
            "[indexer.worker] Executing queued action for command: type=%s path=%s",
            command.type,
            "path" in command ? command.path : "",
          );
          act();
        }),
      );
    }
  };
}
