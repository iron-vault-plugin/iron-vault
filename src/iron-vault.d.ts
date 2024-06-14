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
  export default class DiceBox {
    constructor(container: string, options: DiceBoxOptions);
    init(): Promise<void>;
  }

  export interface DiceBoxOptions {
    assetPath: string;
    origin: string;
  }
}
