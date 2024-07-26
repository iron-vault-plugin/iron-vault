import { Determination, PlaysetConfig, PlaysetLine } from "./config";

describe("PlaysetLine", () => {
  describe("given oracle_rollable:starforged/test/oracle", () => {
    const line = new PlaysetLine("oracle_rollable:starforged/test/oracle");

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle"}
      ${"oracle_rollable.foo.x:starforged/test/oracle.1.b"}
    `("matches $path", ({ path }) => {
      expect(path.match(line)).not.toBeNull();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/test/other"}
      ${"oracle_rollable.x:starforged/test/other.x"}
      ${"oracle_rollable:starforged/test/oracleblah"}
      ${"move:starforged/test/oracle"}
    `("does not match $path", ({ path }) => {
      expect(path.match(line)).toBeNull();
    });
  });

  describe("given oracle_rollable:starforged/test/*", () => {
    const line = new PlaysetLine("oracle_rollable:starforged/test/*");

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle"}
      ${"oracle_rollable.foo.x:starforged/test/oracle.1.b"}
      ${"oracle_rollable:starforged/test/other"}
    `("matches $path", ({ path }) => {
      expect(path.match(line)).not.toBeNull();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle/extra"}
      ${"move:starforged/test/other"}
    `("does not match $path", ({ path }) => {
      expect(path.match(line)).toBeNull();
    });
  });

  describe("given oracle_rollable:starforged/*/name", () => {
    const line = new PlaysetLine("oracle_rollable:starforged/*/name");

    it.each`
      path
      ${"oracle_rollable:starforged/foo/name"}
      ${"oracle_rollable.foo.x:starforged/bar/name.1.b"}
    `("matches $path", ({ path }) => {
      expect(path.match(line)).not.toBeNull();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
      ${"move:starforged/bar/name"}
    `("does not match $path", ({ path }) => {
      expect(path.match(line)).toBeNull();
    });
  });

  describe("given oracle_rollable:starforged/**/name", () => {
    const line = new PlaysetLine("oracle_rollable:starforged/**/name");

    it.each`
      path
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
      ${"oracle_rollable.foo.x:starforged/foo/bar/name.1.b"}
    `("matches $path", ({ path }) => {
      expect(path.match(line)).not.toBeNull();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/foo/names"}
      ${"move:starforged/bar/name"}
    `("does not match $path", ({ path }) => {
      expect(path.match(line)).toBeNull();
    });
  });

  describe("given oracle_rollable:**/name", () => {
    const line = new PlaysetLine("oracle_rollable:**/name");

    it.each`
      path
      ${"oracle_rollable:name"}
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
    `("matches $path", ({ path }) => {
      expect(path.match(line)).not.toBeNull();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/names"}
    `("does not match $path", ({ path }) => {
      expect(path.match(line)).toBeNull();
    });
  });

  describe("ruleset handling", () => {
    it("matches rulesets literally", () => {
      expect(
        "starforged".match(new PlaysetLine("ruleset:starforged")),
      ).not.toBeNull();
      expect(
        "starforgeda".match(new PlaysetLine("ruleset:starforged")),
      ).toBeNull();
    });
  });

  it("identifies negation", () => {
    expect(new PlaysetLine("!move:*").determination).toBe(
      Determination.Exclude,
    );
    expect(new PlaysetLine("move:*").determination).toBe(Determination.Include);
  });
});

describe("PlaysetConfig", () => {
  const TEST_CONFIG = `
# Starforged
move:starforged/**

# But none of that foo
! move:starforged/foo/**

# But I do like anything with bar in the name
move:starforged/foo/**/bar/**
`;

  it("parses valid playset config", () => {
    expect(() => PlaysetConfig.parseFile(TEST_CONFIG)).not.toThrow();
  });

  describe("using valid config", () => {
    const config: PlaysetConfig = PlaysetConfig.parseFile(TEST_CONFIG);

    it.each`
      input                                      | determination
      ${"move:starforged/include/me"}            | ${Determination.Include}
      ${"move:starforged/foo/but/not/me"}        | ${Determination.Exclude}
      ${"move:starforged/foo/but/not/bar/me"}    | ${Determination.Include}
      ${"move:sundered-isles/include/me"}        | ${Determination.Exclude}
      ${"oracle_rollable:starforged/include/me"} | ${Determination.Exclude}
    `("returns $determination for $input", ({ input, determination }) => {
      expect(config.determine(input)).toBe(determination);
    });
  });
});
