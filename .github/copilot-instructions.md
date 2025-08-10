# Iron Vault - AI Assistant Guidelines

This repository contains Iron Vault, an Obsidian plugin for playing Ironsworn/Starforged tabletop RPGs using [Datasworn](https://github.com/rsek/datasworn) format data.

## Architecture Overview

Iron Vault is a monorepo with the following key components:

- **Main Plugin (`packages/obsidian`)**: The core Obsidian plugin that provides the UI and functionality.
- **Datasworn Compiler (`packages/datasworn-compiler`)**: Processes Datasworn format data from various sources.
- **Dice (`packages/dice`)**: Handles dice rolling mechanics and visual representation.
- **Parsing (`packages/parsing`, `packages/parsing-markdown`)**: Utilities for parsing various content formats.
- **Utils (`packages/utils`)**: Shared utility functions used across packages.

## Key Concepts

1. **Datastore**: Central data management system that loads and indexes game data from built-in sources and homebrew content. See `packages/obsidian/src/datastore.ts`. Datastore indexes Datasworn-formatted game data from various sources with priority levels.

2. **Data Context**: A critical abstraction in `datastore/data-context.ts` that provides access to filtered/prioritized game data. The `IDataContext` interface defines how components access data including moves, assets, oracles, and truths. `BaseDataContext` implements this interface for the main plugin.

3. **Action Context**: Defined in `characters/action-context.ts`, this provides a lens for viewing game data in the context of a specific character and campaign. It's essential for commands that need to be aware of both character state and game rules. There are two types:
   - `CharacterActionContext`: Provides access to data through a specific character's perspective
   - `NoCharacterActionConext`: Used when no active character is selected

4. **Entities**: Game concepts like Characters, Assets, Clocks, Progress Tracks, etc. Each has its own directory in `packages/obsidian/src/`.
   - **Characters**: Player characters with stats, conditions, assets, and more
   - **Assets**: Special abilities, companions, or items that characters can acquire
   - **Clocks**: Visual indicators of progress toward events (often threats)
   - **Progress Tracks**: Measure advancement toward goals like quests
   - **Oracles**: Random tables used for generating content during play

5. **Blocks**: Custom markdown rendering components used to display interactive game elements in Obsidian. Blocks follow a consistent pattern of registration and rendering.

6. **Commands**: Obsidian commands exposed to users, registered in `packages/obsidian/src/commands.ts`.

7. **Campaigns**: Organizational structure allowing multiple campaigns within a vault, with campaign-specific content and settings. Each campaign can have its own:
   - Active characters
   - Game rules/settings
   - Progress tracks
   - Custom oracles and moves

8. **Result Pattern**: The codebase uses `true-myth/result` for error handling throughout the application. It's migrating from a custom `Either` type to the `Result` type from true-myth.

## Development Workflow

1. **Setup**: Use `pnpm` as the package manager. Run `pnpm i` to install dependencies.

2. **Development**:
   - `pnpm dev` - Watches code changes, compiles, and deploys to the test vault
   - `pnpm build` - Builds production version
   - `pnpm test` - Runs tests with Vitest

3. **Test Environment**: Use the included `test-vault` for development and testing.

4. **Hot Reload**: Use the included hot-reload plugin (git submodule) during development.

## Code Patterns

### Plugin Component Structure

Components generally follow this pattern:

- Registration in `packages/obsidian/src/index.ts`
- Event-based communication with Emittery
- Common inheritance from `Component` (from Obsidian)

### Datasworn Integration

When working with game content:

1. Access `plugin.datastore.dataContext` to retrieve indexed game data
2. Datasworn entities have standard structures (moves, assets, oracles, etc.)
3. Use `@datasworn/core` types for typings

### Data Access Pattern

Iron Vault uses a layered approach to data access:

1. **Base Layer** - `plugin.datastore.dataContext` provides access to all indexed game data
2. **Campaign Context** - Filters data by the active campaign's ruleset and settings
3. **Action Context** - Provides character-aware access to game data:

   ```typescript
   // Example: Getting an action context
   const actionContext = await determineCharacterActionContext(plugin, view);

   // Accessing data through context
   const availableMoves = actionContext.moves;
   const characterStats = actionContext.rollables;

   // Updating character data
   await actionContext.update(app, (character, context) => {
     // Modify character and return updated version
     return modifiedCharacter;
   });
   ```

### Oracle Usage

Oracles (random tables) are accessed through the oracle roller system:

```typescript
// Example of oracle rolling
const oracleRoller = actionContext.oracleRoller;
const result = await oracleRoller.roll("oracle_id");
```

### Error Handling

Use the Result pattern from true-myth:

```typescript
import * as R from "true-myth/result";
import type { Result } from "true-myth/result";

// Creating results
const okResult = R.ok(value);
const errResult = R.err(error);

// Pattern matching
if (R.isOk(result)) {
  // Handle success case
} else {
  // Handle error case
}
```

### Testing

- Unit tests are written with Vitest
- Test files typically live alongside the code they test

## Key Files

- `packages/obsidian/src/index.ts` - Main plugin entry point
- `packages/obsidian/src/datastore.ts` - Core data management
- `packages/obsidian/src/commands.ts` - User-facing commands
- `packages/obsidian/src/settings/index.ts` - Plugin settings

## Conventions

1. TypeScript is used throughout with strict type checking
2. Events use Emittery for communication between components
3. File paths are organized by entity/concept
4. Components register with the main plugin in their respective blocks
5. We often use lit-html to render dynamic content. These are called out with `html`
   string literals.

## Integration Points

- **Obsidian API**: Core integration with Obsidian's plugin API
- **Datasworn Format**: Data model compatibility with the Datasworn schema
- **Third-party Libraries**: Key dependencies include true-myth, zod, and lit-html

## Entity Model

The plugin uses a consistent pattern for managing game entities:

1. **Indexers**: Scan the vault for entity files and create indexed representations

   ```typescript
   // Example: Character indexer
   this.indexManager.registerHandler(
     (this.characterIndexer = new CharacterIndexer(this.campaignManager)),
   );
   ```

2. **Trackers**: Maintain the state of indexed entities and emit change events

   ```typescript
   // Accessing entities
   const character = plugin.characters.get(characterPath);
   const clock = plugin.clocks.get(clockPath);
   ```

3. **Blocks**: Render entities in markdown with interactive elements

   ```typescript
   // How blocks are registered
   registerCharacterBlock(plugin);
   ```

4. **Commands**: Provide user-facing actions for creating and manipulating entities
   ```typescript
   // Command registration pattern
   this.addCommand({
     id: "create-character",
     name: "Create new character",
     callback: () => createCharacter(this),
   });
   ```

When adding new features, ensure they follow existing patterns and integrate properly with the plugin's event system and data structures.
