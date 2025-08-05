import { buildCommand } from "@stricli/core";

import {
  type Content,
  ContentIndexer,
  ContentManagerImpl,
  ensureRulesPackageBuilderInitialized,
  MetarootContentManager,
  PackageBuilder,
  setLogger,
} from "@ironvault/datasworn-compiler";
import { extractFrontmatter } from "@ironvault/parsing-markdown";
import { LocalContext } from "context";
import logger from "../logger";

type Flags = {
  outfile?: string;
  emit: boolean;
  debug: boolean;
};

export const command = buildCommand({
  async func(this: LocalContext, flags: Flags, directory: string) {
    const { readdir, readFile, writeFile } = this.fs.promises;
    const { path } = this;

    setLogger(
      logger.ns("compiler").seal({
        activeLevel: flags.debug ? "debug" : "error",
      }),
    );

    directory = path.resolve(directory);
    logger.info(`Building project in directory: ${directory}`);

    if (directory == "." && !flags.outfile) {
      logger.error(
        "When building the current directory, you must specify an output file with --outfile",
      );
      return;
    }

    // We use the basename of the directory as the root ID for the package.
    const root = path.basename(directory);

    // TODO: make sure that outfile isn't a child of directory

    ensureRulesPackageBuilderInitialized();
    const contentManager = new MetarootContentManager(
      new ContentManagerImpl<Content>(),
    );
    contentManager.addRoot(root);
    const contentIndexer = new ContentIndexer(contentManager);
    for (const file of await readdir(directory, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!file.isFile()) continue; // Skip directories
      const filePath = path.join(file.parentPath, file.name);
      const relativePath = path.join(root, path.relative(directory, filePath));
      logger.info(`Loading file: ${relativePath}`);
      const content = await readFile(filePath, {
        encoding: "utf-8",
      });
      const hash = await ContentIndexer.computeHash(content);
      const frontmatter = extractFrontmatter(content).unwrapOrElse((err) => {
        throw err;
      });
      await contentIndexer.indexFile(
        relativePath,
        0,
        hash,
        content,
        frontmatter,
      );
    }
    const { files, result } = PackageBuilder.fromContent(
      root,
      contentManager.valuesUnderPath(root),
    );

    for (const file of files) {
      if (file[1].isErr) {
        logger.error(`${file[0]}: Error processing file:`, file[1].error);
      } else {
        logger.info(`${file[0]}: Loaded file successfully.`);
      }
    }

    if (result) {
      logger.success(`Package ${result._id} built successfully.`);
      if (flags.emit) {
        const outfile = flags.outfile ?? `${result._id}.json`;
        await writeFile(outfile, JSON.stringify(result, null, 2), {
          encoding: "utf-8",
        });
        logger.success(`Output written to ${outfile}`);
      }
    }
  },
  parameters: {
    flags: {
      outfile: {
        kind: "parsed",
        parse: String,
        brief: "Output file",
        optional: true,
      },
      emit: {
        kind: "boolean",
        brief: "Emit the compiled output; if not, just validate",
        default: true,
      },
      debug: {
        kind: "boolean",
        brief: "Enable debug logging",
        default: false,
      },
    },
    positional: {
      kind: "tuple",
      parameters: [
        {
          brief: "Directory to compile",
          parse: String,
          placeholder: "directory",
          default: ".",
        },
      ],
    },
  },
  docs: {
    brief: "Build the datasworn project at the given directory",
  },
});
