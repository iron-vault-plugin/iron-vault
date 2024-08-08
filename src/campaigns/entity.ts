import { TFile } from "obsidian";
import { Either } from "utils/either";
import { zodResultToEither } from "utils/zodutils";
import { z } from "zod";
import {
  IPlaysetConfig,
  PlaysetConfig,
  PlaysetLinesSchema,
} from "./playsets/config";
import {
  getStandardPlaysetDefinition,
  STANDARD_PLAYSET_DEFNS,
} from "./playsets/standard";

/** Base campaign type. */
export type BaseCampaign = {
  name: string;
  playset: IPlaysetConfig;
};

export const PlaysetConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("globs"),
    lines: PlaysetLinesSchema,
  }),
  z.object({
    type: z.literal("registry"),
    key: z.string(),
  }),
]);

export const campaignConfigSchema = z.object({
  playset: PlaysetConfigSchema,
});

export const campaignFileSchema = z.object({
  name: z.string().nullish(),
  ironvault: campaignConfigSchema,
});

export type CampaignInput = z.input<typeof campaignFileSchema>;
export type CampaignOutput = z.output<typeof campaignFileSchema>;

/** A campaign that exists in an Obsidian markdown file. */
export class CampaignFile implements BaseCampaign {
  readonly playset: IPlaysetConfig;

  private constructor(
    public readonly file: TFile,
    public readonly props: CampaignOutput,
  ) {
    const playsetConfig = props.ironvault.playset;
    switch (playsetConfig.type) {
      case "globs":
        this.playset = PlaysetConfig.parse(playsetConfig.lines);
        break;
      case "registry": {
        const standardDefn = getStandardPlaysetDefinition(playsetConfig.key);
        if (standardDefn) {
          this.playset = PlaysetConfig.parse(standardDefn.lines);
        } else {
          throw new Error(`Invalid playset key ${playsetConfig.key}`);
        }
        break;
      }
      default:
        throw new Error(
          `Invalid playset type '${(playsetConfig as z.output<typeof PlaysetConfigSchema>).type}`,
        );
    }
  }

  get name(): string {
    return this.props.name ?? this.file.basename;
  }

  set name(val: string) {
    this.props.name = val;
  }

  static parse(
    file: TFile,
    data: CampaignInput,
  ): Either<z.ZodError, CampaignFile>;
  static parse(file: TFile, data: unknown): Either<z.ZodError, CampaignFile>;
  static parse(file: TFile, data: unknown): Either<z.ZodError, CampaignFile> {
    const result = zodResultToEither(
      campaignFileSchema
        .refine(
          (campaign) =>
            campaign.ironvault.playset?.type != "registry" ||
            campaign.ironvault.playset.key in STANDARD_PLAYSET_DEFNS,
          {
            path: ["ironvault", "playset", "key"],
            message: "Not a valid playset key",
          },
        )
        .safeParse(data),
    );
    return result.map((raw) => new CampaignFile(file, raw));
  }

  /** Generates the input front matter for this campaign. */
  static generate(data: CampaignInput): CampaignOutput {
    return campaignFileSchema.parse(data);
  }
}
