import { rootLogger } from "logger";
import {
  Content,
  ContentIndexer,
  ContentManager,
  MetarootContentManager,
  PackageBuilder,
} from "./builder";
import { IndexCommand, IndexResult } from "./messages";

const logger = rootLogger.getLogger("datastore.loader.worker");
logger.setDefaultLevel("debug");

declare function postMessage(
  message: IndexResult,
  options?: WindowPostMessageOptions,
): void;

const contentManager = new MetarootContentManager(new ContentManager());
const contentIndexer = new ContentIndexer(contentManager);
contentManager.onUpdateRoot((root: string, content: Content[] | null) => {
  // Notify the main thread about the updated root
  if (content === null) {
    // This is a deletion notification.
    // TODO: We need to handle this.
    console.debug("[data-loader.worker] Root deleted:", root);
    return;
  }
  if (content.length === 0) return;
  postMessage({
    type: "updated:package",
    root,
    content: PackageBuilder.fromContent(root, content).build(),
  } as IndexResult);
});

// This is a queue to handle commands in order, ensuring that
// they are processed sequentially, even if they are asynchronous.
let pendingAction: Promise<void> | null = null;

self.onmessage = (event: MessageEvent<IndexCommand>) => {
  const command = event.data;

  // Simulate processing the command
  console.log("Received command:", command);

  let action: Promise<() => void> | null = null;
  switch (command.type) {
    case "setMetaRoot":
      // Set the meta root for the content manager
      action = Promise.resolve(() => contentManager.setMetaRoot(command.root));
      break;
    case "addRoot":
      action = Promise.resolve(() => contentManager.addRoot(command.root));
      break;
    case "removeRoot":
      action = Promise.resolve(() => contentManager.removeRoot(command.root));
      break;
    case "index":
      action = ContentIndexer.computeHash(command.content).then((hash) => {
        return () =>
          contentIndexer.indexFile(
            command.path,
            command.mtime,
            hash,
            command.content,
            command.frontmatter,
          );
      });
      break;
    case "delete":
      action = Promise.resolve(() =>
        contentManager.deleteContent(command.path),
      );
      break;
    case "rename":
      action = Promise.resolve(() =>
        contentManager.renameContent(command.oldPath, command.newPath),
      );
      break;
    default: {
      const _: never = command;
      console.error("[data-loader.worker] Unknown command type: %s", _);
    }
  }

  if (action) {
    pendingAction = Promise.resolve(pendingAction ?? Promise.resolve([])).then(
      () =>
        Promise.resolve(action).then((act) => {
          logger.debug(
            "[data-loader.worker] Executing queued action for command: %s",
            command,
          );
          act();
        }),
    );
  }
};
