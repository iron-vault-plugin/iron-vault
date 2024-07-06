import { TFile } from "obsidian";
import { Either } from "utils/either";
import { zodResultToEither } from "utils/zodutils";
import { z } from "zod";

export type Campaign = {
  name: string;
};

export const campaignFileSchema = z.object({
  name: z.string().nullish(),
});

export type CampaignInput = z.input<typeof campaignFileSchema>;
export type CampaignOutput = z.output<typeof campaignFileSchema>;

export class CampaignFile implements Campaign {
  private constructor(
    public readonly file: TFile,
    public readonly props: CampaignOutput,
  ) {}

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
    const result = zodResultToEither(campaignFileSchema.safeParse(data));
    return result.map((raw) => new CampaignFile(file, raw));
  }
}
