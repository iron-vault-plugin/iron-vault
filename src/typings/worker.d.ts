declare module "datastore/loader/data-loader.worker" {
  import {
    type IndexCommand,
    type IndexResult,
  } from "datastore/loader/messages";
  export class DataLoaderWorker extends Worker {
    constructor();
    postMessage(message: IndexCommand, transfer: Transferable[]): void;
    postMessage(
      message: IndexCommand,
      options?: StructuredSerializeOptions,
    ): void;
    onmessage:
      | ((this: Worker, ev: MessageEvent<IndexResult>) => unknown)
      | null;
  }
  const WorkerFactory: () => DataLoaderWorker;
  export default WorkerFactory;
}
