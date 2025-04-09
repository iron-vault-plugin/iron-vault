import { ensureRulesPackageBuilderInitialized } from "datastore/parsers/collection";
import { rootLogger } from "logger";
import {
  Content,
  ContentIndexer,
  ContentManager,
  MetarootContentManager,
  PackageBuilder,
} from "./builder";
import { debouncerByKey } from "./debouncerByKey";
import { IndexCommand, IndexResult } from "./messages";

const logger = rootLogger.getLogger("datastore.loader.worker");
logger.setDefaultLevel("debug");

declare function postMessage(
  message: IndexResult,
  options?: WindowPostMessageOptions,
): void;

ensureRulesPackageBuilderInitialized();

const contentManager = new MetarootContentManager(new ContentManager());
const contentIndexer = new ContentIndexer(contentManager);
const debouncePackageBuild = debouncerByKey(100, { logger: logger.debug });
contentManager.onUpdateRoot((root: string, content: Content[] | null) => {
  // Notify the main thread about the updated root
  if (content === null) {
    // This is a deletion notification.
    // TODO: We need to handle this.
    console.debug("[data-loader.worker] Root deleted:", root);
    return;
  }
  if (content.length === 0) return;
  debouncePackageBuild(root)(() => {
    logger.debug(
      "[data-loader.worker] Building package for root: %s, content count: %d",
      root,
      content.length,
    );
    const { files, result } = PackageBuilder.fromContent(
      root,
      content,
      // We use packageId "campaign" for campaign roots. For packages in meta root,
      // they use the folder name.
      contentManager.isInMetaRoot(root) ? undefined : "campaign",
    );
    postMessage({
      type: "updated:package",
      root,
      files,
      package: result,
    });
  });
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
    case "debug":
      {
        console.log("[data-loader.worker] Current state of content manager:");
        for (const c of contentManager.valuesUnderPath("/")) {
          console.log(
            "[data-loader.worker] - %s (mtime: %d, hash: %s): %o",
            c.path,
            c.mtime,
            c.hash
              ? [...c.hash.values()].map((n) => n.toString(16)).join("")
              : "no hash",
            c.value,
          );
        }
      }
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
