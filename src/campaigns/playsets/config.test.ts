import { Datasworn } from "@datasworn/core";
import {
  Determination,
  IPlaysetConfig,
  PlaysetConfig,
  PlaysetGlobLine,
  PlaysetIncludeLine,
  PlaysetTagsFilter,
} from "./config";
import { STANDARD_PLAYSET_DEFNS } from "./standard";

describe("PlaysetLine", () => {
  describe("given oracle_rollable:starforged/test/oracle", () => {
    const line = PlaysetGlobLine.fromString(
      "oracle_rollable:starforged/test/oracle",
    );

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle"}
      ${"oracle_rollable.foo.x:starforged/test/oracle.1.b"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).toBeTruthy();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/test/other"}
      ${"oracle_rollable.x:starforged/test/other.x"}
      ${"oracle_rollable:starforged/test/oracleblah"}
      ${"move:starforged/test/oracle"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("given oracle_rollable:starforged/test/*", () => {
    const line = PlaysetGlobLine.fromString(
      "oracle_rollable:starforged/test/*",
    );

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle"}
      ${"oracle_rollable.foo.x:starforged/test/oracle.1.b"}
      ${"oracle_rollable:starforged/test/other"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).not.toBeFalsy();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/test/oracle/extra"}
      ${"move:starforged/test/other"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("given oracle_rollable:starforged/*/name", () => {
    const line = PlaysetGlobLine.fromString(
      "oracle_rollable:starforged/*/name",
    );

    it.each`
      path
      ${"oracle_rollable:starforged/foo/name"}
      ${"oracle_rollable.foo.x:starforged/bar/name.1.b"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).not.toBeFalsy();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
      ${"move:starforged/bar/name"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("given oracle_rollable:starforged/**/name", () => {
    const line = PlaysetGlobLine.fromString(
      "oracle_rollable:starforged/**/name",
    );

    it.each`
      path
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
      ${"oracle_rollable.foo.x:starforged/foo/bar/name.1.b"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).not.toBeFalsy();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/foo/names"}
      ${"move:starforged/bar/name"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("given oracle_rollable:starforged/**", () => {
    const line = PlaysetGlobLine.fromString("oracle_rollable:starforged/**");

    it.each`
      path
      ${"oracle_rollable:starforged"}
      ${"oracle_rollable:starforged/foo/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
      ${"oracle_rollable.foo.x:starforged.1.b"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).not.toBeFalsy();
    });

    it.each`
      path
      ${"oracle_rollable:starforgeda"}
      ${"oracle_rollable:starforgeda/foo"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("given oracle_rollable:**/name", () => {
    const line = PlaysetGlobLine.fromString("oracle_rollable:**/name");

    it.each`
      path
      ${"oracle_rollable:name"}
      ${"oracle_rollable:starforged/name"}
      ${"oracle_rollable:starforged/foo/bar/name"}
    `("matches $path", ({ path }) => {
      expect(line.match(path, {})).not.toBeFalsy();
    });

    it.each`
      path
      ${"oracle_rollable:starforged/names"}
    `("does not match $path", ({ path }) => {
      expect(line.match(path, {})).toBeFalsy();
    });
  });

  describe("rules_package handling", () => {
    it.each`
      pattern
      ${"rules_package:starforged"}
      ${"*:starforged"}
      ${"*:starforged/**"}
    `("matches starforged rules_package in $pattern", ({ pattern }) => {
      expect(
        PlaysetGlobLine.fromString(pattern).match("starforged", {}),
      ).toBeTruthy();
      expect(
        PlaysetGlobLine.fromString(pattern).match("starforgeda", {}),
      ).toBeFalsy();
    });
  });

  it("identifies negation", () => {
    expect(PlaysetGlobLine.fromString("!move:*").determination).toBe(
      Determination.Exclude,
    );
    expect(PlaysetGlobLine.fromString("move:*").determination).toBe(
      Determination.Include,
    );
  });

  function item(
    _id: string,
    tags: Datasworn.Tags,
  ): { _id: string; tags: Datasworn.Tags } {
    return { _id, tags };
  }

  describe.each([
    {
      line: "*:starforged/** [sundered_isles.recommended=true]",
      matches: [
        item("asset:starforged/path/armored", {
          sundered_isles: {
            recommended: true,
          },
          core: {
            technological: true,
          },
        }),
      ],
      non_matches: [
        // It shouldn't match a non-matching path
        item("asset:foo/path/armored", {
          sundered_isles: {
            recommended: true,
          },
          core: {
            technological: true,
          },
        }),
        // It shouldn't match if the tag has a different value
        item("asset:starforged/path/armored", {
          sundered_isles: {
            recommended: false,
          },
          core: {
            technological: true,
          },
        }),
        // It shouldn't match without the tag
        item("asset:starforged/path/armored", {
          core: {
            technological: true,
          },
        }),
      ],
    },
    {
      line: "*:starforged/** [sundered_isles.recommended=true&core.technological=true]",
      matches: [
        {
          _id: "asset:starforged/path/armored",
          tags: {
            sundered_isles: {
              recommended: true,
            },
            core: {
              technological: true,
            },
          },
        },
      ],
      non_matches: [
        // It shouldn't match unless both tags match
        {
          _id: "asset:starforged/path/armored",
          tags: {
            sundered_isles: {
              recommended: true,
            },
            core: {
              technological: false,
            },
          },
        },
        {
          _id: "asset:starforged/path/armored",
          tags: {
            sundered_isles: {
              recommended: false,
            },
            core: {
              technological: true,
            },
          },
        },
      ],
    },
  ])("given $line", ({ line, matches, non_matches }) => {
    it.each(matches)("matches %s", (obj) => {
      expect(PlaysetGlobLine.fromString(line).determine(obj._id, obj)).toBe(
        Determination.Include,
      );
    });

    it.each(non_matches)("does not match %s", (obj) => {
      expect(PlaysetGlobLine.fromString(line).determine(obj._id, obj)).toBe(
        null,
      );
    });
  });
});

describe("PlaysetIncludeLine", () => {
  it("parses an include line", () => {
    expect(
      PlaysetIncludeLine.tryFromString("@include(classic)"),
    ).not.toBeNull();
  });

  it("nests a config equivalent to the included config", () => {
    const line = PlaysetIncludeLine.tryFromString("@include(classic)");
    expect(
      line?.included.equals(
        PlaysetConfig.parse(STANDARD_PLAYSET_DEFNS.classic.lines),
      ),
    ).toBeTruthy();
  });

  it("simply passes to included config", () => {
    const mockSubConfig: IPlaysetConfig = {
      determine: jest
        .fn()
        .mockReturnValueOnce(Determination.Include)
        .mockReturnValueOnce(Determination.Exclude),
      equals: jest.fn(),
    };
    const config = new PlaysetIncludeLine("mock", mockSubConfig);

    expect(config.determine("foo", {})).toBe(Determination.Include);
    expect(config.determine("foo", {})).toBe(Determination.Exclude);
    expect(mockSubConfig.determine).toHaveBeenCalledTimes(2);
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
      ${"move:sundered-isles/include/me"}        | ${null}
      ${"oracle_rollable:starforged/include/me"} | ${null}
    `("returns $determination for $input", ({ input, determination }) => {
      expect(config.determine(input, {})).toBe(determination);
    });
  });

  describe("include statement", () => {
    it("parses a config with an include statement", () => {
      const starforged = PlaysetConfig.parseFile("@include(starforged)");
      expect(starforged.determine("asset:starforged/path/empath", {})).toBe(
        Determination.Include,
      );

      const classic = PlaysetConfig.parseFile("@include(classic)");
      expect(classic.determine("asset:starforged/path/empath", {})).toBe(null);
      expect(classic.determine("asset:classic/path/vestige", {})).toBe(
        Determination.Include,
      );
    });
  });
});

function validate(
  pattern: string,
  matches: { tags?: Datasworn.Tags }[],
  nonMatches: { tags?: Datasworn.Tags }[],
) {
  describe(`given pattern ${pattern}`, () => {
    let filter!: PlaysetTagsFilter;
    beforeAll(() => {
      filter = PlaysetTagsFilter.fromString(pattern);
    });
    it.each(matches)("matches %o", (obj) => {
      expect(filter.match("", obj)).toBeTruthy();
    });
    it.each(nonMatches)("does not match %o", (obj) => {
      expect(filter.match("", obj)).toBeFalsy();
    });
  });
}

describe("PlaysetTagFilter", () => {
  validate(
    'pkg.tagA="val"',
    [{ tags: { pkg: { tagA: "val" } } }],
    [
      {},
      { tags: { pkg: { tagB: "val" } } },
      { tags: { pkg: { tagA: 3 } } },
      { tags: { pkg: { tagA: "vab" } } },
    ],
  );

  validate(
    'pkg.tagA="val"&pkg.tagB=true',
    [
      {
        tags: {
          pkg: { tagA: "val", tagB: true, tagC: "foo" },
          otherPkg: { tagD: "bar" },
        },
      },
    ],
    [
      {},
      {
        tags: {
          pkg: { tagA: "val", tagB: false, tagC: "foo" },
          otherPkg: { tagD: "bar" },
        },
      },
      { tags: { pkg: { tagA: "val" } } },
      { tags: { pkg: { tagB: false } } },
      { tags: { pkg: { tagC: "val" } } },
      { tags: { pkg: { tagA: "val2", tagB: true } } },
    ],
  );
});
