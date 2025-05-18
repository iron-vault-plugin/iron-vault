import { DataswornSource } from "@datasworn/core";
import * as mdast from "mdast";
import { Heading, ListContent, ListItem, RootContent } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { frontmatterFromMarkdown } from "mdast-util-frontmatter";
import { gfmFromMarkdown, gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";
import { frontmatter } from "micromark-extension-frontmatter";
import { gfm } from "micromark-extension-gfm";
import Result, { err, ok } from "true-myth/result";

import {
  apply,
  check,
  cut,
  lazy,
  liftAsList,
  makeError,
  match,
  matchOpt,
  optional,
  Parser,
  ParserError,
  permutationOptional,
  pipe,
  preceded,
  RecoverableParserError,
  regex,
  repeat,
  runParser,
  seq,
  str,
} from "@ironvault/parsing";
import {
  children,
  mdastType,
  onlyText,
  skipFrontmatter,
} from "@ironvault/parsing-markdown";

import { sanitizeNameForId } from "../../utils";

/**
 * Parses a markdown asset into a Datasworn asset object.
 *
 * Format is:
 * ---
 * optional-front-matter: ...
 * category: xyz
 * ---
 *
 * # Asset name
 *
 * (optional) Requirement
 *
 * (optional heading) ## Abilities
 *
 * * [x] Ability 1
 * * [ ] Ability 2
 * * [ ] Ability 3
 *
 * ## Controls
 *
 * * _health_ (type: condition meter, min: 0, max: 5, default: 3)
 *
 * ## Options
 *
 * * _name_ (type: text)
 *
 */
export function markdownAssetToDatasworn(
  content: string,
): Result<Omit<DataswornSource.Asset, "_source">, ParserError> {
  const tree = fromMarkdown(content, {
    extensions: [gfm(), frontmatter(["yaml"])],
    mdastExtensions: [gfmFromMarkdown(), frontmatterFromMarkdown(["yaml"])],
  });

  const parser = children(
    seq(
      skipFrontmatter,
      parseNameHeading,
      parseRequirement,
      preceded(optional(matchHeading("Abilities")), parseAbilities),
      permutationOptional(
        preceded(matchHeading("Controls"), parseControls),
        preceded(matchHeading("Options"), parseOptions),
      ),
    ),
  );

  const result = runParser(parser, tree);

  return result.andThen(
    ([
      _frontmatter,
      nameField,
      requirement,
      abilities,
      [controls, options],
    ]) => {
      if (nameField === undefined) {
        return err(new ParserError("Asset must have a name"));
      }

      const [name, category] = nameField;

      const asset: Omit<DataswornSource.Asset, "_source"> = {
        type: "asset",
        name,
        abilities,
        category: category ?? "unknown",
      };

      if (requirement) {
        asset.requirement = requirement;
      }

      if (controls) {
        asset.controls = Object.fromEntries(
          controls.map((control) => [
            sanitizeNameForId(control.label),
            control,
          ]),
        );
      }

      if (options) {
        asset.options = Object.fromEntries(
          options.map((option) => [sanitizeNameForId(option.label), option]),
        );
      }

      return ok(asset);
    },
  );
}

const NAME_RE = /^([^)(]+)(?:\s*\(([^)]+)\))?$/;

const parseNameHeading = matchOpt(
  (node: RootContent): node is Heading =>
    node.type == "heading" && node.depth == 1,
  (node: Heading) => {
    if (node.children.length === 0 || node.children[0].type !== "text") {
      return err(new RecoverableParserError("Name must be a text node"));
    }
    const name = node.children[0].value.trim().match(NAME_RE);
    if (!name) {
      return err(
        new RecoverableParserError("name must match format 'Name (type)'"),
      );
    }
    const [, nameText, type] = name;
    return ok([nameText.trim(), type?.trim()]);
  },
);

const matchHeading = (text: string) =>
  pipe(
    mdastType("heading", (node) => node.depth === 2),
    check(onlyText, (value) => value === text, `expected heading "${text}"`),
  );

const parseRequirement = optional(pipe(mdastType("paragraph"), cut(onlyText)));

const parseAbility = match(
  (node: ListContent): node is ListItem => node.type === "listItem",
  (node: ListItem): Result<DataswornSource.AssetAbility, ParserError> => {
    const text = toMarkdown(
      { type: "root", children: node.children },
      { extensions: [gfmToMarkdown()] },
    ).trim();
    return ok({
      text,
      enabled: node.checked ?? false,
    });
  },
);

const parseAbilities = pipe(
  mdastType("list"),
  children(repeat(1, 3, parseAbility)),
);

// TODO: the real nice way to do this would be to create a character-level parser
// that can parse the options string, but for now we just assume the string is
// formatted correctly (b/c it was matched with a regex!) and split it up.
const parseOptionsString: Parser<Map<string, string>, string> = (node) => {
  if (node === undefined) {
    return makeError(node, "expected options string, found end-of-sequence");
  }
  const options: Map<string, string> = new Map();
  const parts = node.value.split(",").map((part) => part.trim());
  for (const part of parts) {
    if (part.trim() === "") continue; // Skip empty parts

    const [key, value] = part.split(":").map((s) => s.trim());
    if (!key || !value) {
      return makeError(
        node,
        `invalid option format: "${part}", expected "key: value"`,
      );
    }
    options.set(key, value);
  }
  return ok({
    value: options,
    start: node,
    next: node.next,
  });
};

function parseControlDescriptor(
  ...allowedControls: DataswornSource.AssetControlField["field_type"][]
): Parser<DataswornSource.AssetControlField, string> {
  return pipe(
    regex(
      /^(?<name>[^()]+)\s*\((?<type>[\w\s]+)(?<options>(?:\s*,\s*[\w]+\s*:\s*[^,()]+)*)\)$/,
    ),
    apply(
      liftAsList(
        preceded(
          str(),
          seq(str(), str(...allowedControls), parseOptionsString),
        ),
      ),
      ([name, type, options]): DataswornSource.AssetControlField => {
        const label = name.trim().toLowerCase();
        switch (type) {
          case "condition_meter": {
            const min = Number.parseInt(options.get("min") ?? "0");
            if (isNaN(min) || min < 0) {
              throw new Error("Invalid min value in options");
            }
            const max = Number.parseFloat(options.get("max") ?? "");
            if (isNaN(max) || max < 0) {
              throw new Error("Max is missing or invalid");
            }
            const value = Number.parseInt(options.get("value") ?? "0");
            if (isNaN(value)) {
              throw new Error("Invalid value in options");
            }
            if (max < min) {
              throw new Error("Max value cannot be less than min value");
            }
            if (value < min || value > max) {
              throw new Error(
                `Value must be between ${min} and ${max}, found ${value}`,
              );
            }
            return {
              label,
              field_type: type,
              min,
              max,
              value,
            };
          }
          case "checkbox": {
            const control: DataswornSource.AssetCheckboxField = {
              label,
              field_type: type,
            };
            const isImpact = options.get("is_impact");
            if (isImpact?.toLowerCase() === "true") {
              control.is_impact = true;
            } else if (isImpact?.toLowerCase() === "false") {
              control.is_impact = false;
            } else if (isImpact !== undefined) {
              throw new Error(
                `Invalid is_impact value: ${isImpact}, expected true or false`,
              );
            }

            const disablesAsset = options.get("disables_asset");
            if (disablesAsset?.toLowerCase() === "true") {
              control.disables_asset = true;
            } else if (disablesAsset?.toLowerCase() === "false") {
              control.disables_asset = false;
            } else if (disablesAsset !== undefined) {
              throw new Error(
                `Invalid disables_asset value: ${disablesAsset}, expected true or false`,
              );
            }

            return control;
          }
          case "card_flip": {
            const control: DataswornSource.AssetCardFlipField = {
              label,
              field_type: type,
            };
            const isImpact = options.get("is_impact");
            if (isImpact?.toLowerCase() === "true") {
              control.is_impact = true;
            } else if (isImpact?.toLowerCase() === "false") {
              control.is_impact = false;
            } else if (isImpact !== undefined) {
              throw new Error(
                `Invalid is_impact value: ${isImpact}, expected true or false`,
              );
            }

            const disablesAsset = options.get("disables_asset");
            if (disablesAsset?.toLowerCase() === "true") {
              control.disables_asset = true;
            } else if (disablesAsset?.toLowerCase() === "false") {
              control.disables_asset = false;
            } else if (disablesAsset !== undefined) {
              throw new Error(
                `Invalid disables_asset value: ${disablesAsset}, expected true or false`,
              );
            }

            return control;
          }
          case "select_enhancement": {
            const control: DataswornSource.SelectEnhancementField = {
              label,
              field_type: type,
            };
            return control;
          }
        }
      },
    ),
  );
}

const parseControl: Parser<
  DataswornSource.AssetControlField,
  mdast.RootContent
> = pipe(
  mdastType("listItem"),
  apply(
    children(
      seq(
        pipe(
          mdastType("paragraph"),
          onlyText,
          parseControlDescriptor(
            "card_flip",
            "condition_meter",
            "checkbox",
            "select_enhancement",
          ),
        ),
        optional(
          pipe(
            mdastType("list"),
            cut(children(repeat(1, 5, cut(lazy(() => parseControl))))),
          ),
        ),
      ),
    ),
    ([control, subcontrols]) => {
      if (subcontrols) {
        if (control.field_type !== "condition_meter") {
          throw new Error("Subcontrols are only allowed for condition meters");
        }
        if (
          !subcontrols.every(
            (sc): sc is DataswornSource.AssetConditionMeterControlField =>
              sc.field_type === "checkbox" || sc.field_type === "card_flip",
          )
        ) {
          throw new Error(
            "Subcontrols must all be of type checkbox for condition meters",
          );
        }
        control.controls = Object.fromEntries(
          subcontrols.map((subcontrol) => [
            sanitizeNameForId(subcontrol.label),
            subcontrol,
          ]),
        );
      }
      return control;
    },
  ),
);

const parseControls = pipe(
  mdastType("list"),
  children(repeat(1, 5, cut(parseControl))),
);

const parseOptionDescriptor: Parser<DataswornSource.AssetOptionField, string> =
  pipe(
    regex(
      /^(?<name>[^()]+)\s*\((?<type>[\w\s]+)(?<options>(?:\s*,\s*[\w]+\s*:\s*[^,()]+)*)\)$/,
    ),
    apply(
      liftAsList(preceded(str(), seq(str(), str("text"), parseOptionsString))),
      ([name, type, _options]): DataswornSource.AssetOptionField => {
        const label = name.trim().toLowerCase();
        switch (type) {
          case "text": {
            return {
              label,
              field_type: type,
            };
          }
        }
      },
    ),
  );

const parseOption: Parser<DataswornSource.AssetOptionField, mdast.RootContent> =
  pipe(
    mdastType("listItem"),
    children(pipe(mdastType("paragraph"), onlyText)),
    parseOptionDescriptor,
  );

const parseOptions = pipe(
  mdastType("list"),
  children(repeat(1, 5, cut(parseOption))),
);
