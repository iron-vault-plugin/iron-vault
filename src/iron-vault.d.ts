declare module "*.png" {
  const value: string;
  export default value;
}

declare module "*.jpg" {
  const value: string;
  export default value;
}

declare module "*.wasm" {
  const value: string;
  export default value;
}

declare module "@3d-dice/dice-box" {
  export interface RollResultGroup {
    id: number;
    mods: number[];
    qty: number;
    rolls: RollResult[];
    sides: number;
    theme: string;
    themeColor: string;
    value: number;
  }

  export interface RollResult {
    groupId: number;
    value: number;
    rollId: number;
    sides: number;
    theme: string;
    themeColor: string;
  }

  export interface Roll {
    modifier?: number;
    qty: number;
    sides: number;
    theme?: string;
    themeColor?: string;
  }
  export default class DiceBox {
    constructor(container: string, options: DiceBoxOptions);
    init(): Promise<void>;
    roll(dice: string | string[] | Roll | Roll[]): Promise<RollResult[]>;
    clear(): void;
  }

  export interface DiceBoxOptions {
    assetPath: string;
    origin?: string;
    scale?: number;
    gravity?: number;
    mass?: number;
    friction?: number;
    restitution?: number;
    angularDamping?: number;
    linearDamping?: number;
    settleTimeout?: number;
    spinForce?: number;
    throwForce?: number;
    startingHeight?: number;
  }
}
