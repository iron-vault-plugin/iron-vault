import { z } from "zod";
import { Either } from "../utils/either";
import { zodResultToEither } from "../utils/zodutils";

export const clockValidator = z
  .object({
    /** Number of filled segments. */
    progress: z.number().positive(),

    /** Number of total segments */
    segments: z.number().positive(),

    /** Is this clock active or inactive? */
    active: z.boolean(),
  })
  .refine(({ progress, segments }) => progress <= segments, {
    message: "progress must be less than or equal to total segments",
  });

export type ClockInput = Readonly<z.input<typeof clockValidator>>;
export type ClockLike = Readonly<z.output<typeof clockValidator>>;

export class Clock implements ClockLike {
  private constructor(
    public readonly progress: number,
    public readonly segments: number,
    public readonly active: boolean,
  ) {}

  public static create(
    data: ClockInput,
  ): Either<z.ZodError<ClockInput>, Clock> {
    return zodResultToEither(clockValidator.safeParse(data)).map(
      ({ progress, segments, active }) => new this(progress, segments, active),
    );
  }

  public tick(steps: number = 1): this {
    if (!this.active) return this;

    // TODO: should this give an error or something if we attempt to tick beyond the limit?
    const newProgress = Math.min(this.segments, this.progress + steps);
    if (newProgress === this.progress) return this;
    return new Clock(newProgress, this.segments, this.active) as this;
  }

  public deactivate(): this {
    if (!this.active) return this;
    return new Clock(this.progress, this.segments, false) as this;
  }

  get isFilled(): boolean {
    return this.progress === this.segments;
  }

  public equals(other: Clock): boolean {
    return (
      this === other ||
      (this.progress === other.progress &&
        this.segments === other.segments &&
        this.active === other.active)
    );
  }

  public ticksRemaining(): number {
    return this.segments - this.progress;
  }
}
