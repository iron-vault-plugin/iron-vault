import { DBSchema, IDBPDatabase, openDB } from "idb";

export interface Entry<K, V> {
  // Datasworn entry ID
  id: string;

  // Path of source file
  path: string;

  // Opaque revision identifier (currently hash of file)
  filerev: string;

  kind: K;

  value: V;
}

export type WithoutPath<E> =
  E extends Entry<unknown, unknown> ? Omit<E, "path" | "filerev"> : never;

export type EntryTypes<Kinds extends Record<string, unknown>> = {
  [Key in keyof Kinds]: Entry<Key, Kinds[Key]>;
};

interface IronVaultDb<Kind extends Record<string, unknown>> extends DBSchema {
  "datasworn-entry": {
    // Key is a tuple of [id, path]
    key: [string, string];
    value: EntryTypes<Kind>[keyof Kind];
    indexes: {
      "by-path": [string, string];
    };
  };
}

export async function createDataIndexDb<
  Kinds extends Record<string, unknown>,
>(): Promise<DataIndexDb<Kinds>> {
  const db = await openDB<IronVaultDb<Kinds>>("iron-vault", 1, {
    upgrade(db, oldVersion, _newVersion, _transaction, _event) {
      if (oldVersion < 1) {
        const obj = db.createObjectStore("datasworn-entry", {
          keyPath: ["id", "path"],
          autoIncrement: false,
        });
        obj.createIndex("by-path", ["path", "id"], { unique: true });
      }
    },
    blocked(currentVersion, blockedVersion, event) {
      console.warn(
        `Database upgrade blocked from version ${currentVersion} to ${blockedVersion}.`,
        event,
      );
    },
    blocking(currentVersion, blockedVersion, event) {
      console.warn(
        `Database upgrade blocking from version ${currentVersion} to ${blockedVersion}.`,
        event,
      );
    },
    terminated() {
      console.warn("Database connection terminated unexpectedly.");
    },
  });
  return new DataIndexDb(db);
}

type DataswornBroadcastMessage = {
  type: "file-indexed";
  path: string;
};

export interface ReadonlyDataIndexDb<Kinds extends Record<string, unknown>> {
  iteratePriorityEntries(): AsyncGenerator<EntryTypes<Kinds>[keyof Kinds]>;
}

export class DataIndexDb<Kinds extends Record<string, unknown>>
  implements ReadonlyDataIndexDb<Kinds>
{
  channel: BroadcastChannel;

  constructor(readonly db: IDBPDatabase<IronVaultDb<Kinds>>) {
    this.channel = new BroadcastChannel("datasworn-db");
  }

  set onupdate(callback: (message: DataswornBroadcastMessage) => void) {
    this.channel.onmessage = (event) => {
      const message: DataswornBroadcastMessage = event.data;
      if (message.type !== "file-indexed") {
        console.warn(
          "Received unexpected message type from datasworn-db channel",
          message,
        );
        return;
      }
      callback(message);
    };
  }

  async *iteratePriorityEntries(): AsyncGenerator<
    EntryTypes<Kinds>[keyof Kinds]
  > {
    const tx = this.db.transaction("datasworn-entry", "readonly");
    const store = tx.objectStore("datasworn-entry");

    // We traverse backwards since the lower priority paths should sort before the higher
    // priority paths (@datasworn is lexicographically before and lower priority than any file path)
    for await (const cursor of store.iterate(undefined, "prev")) {
      yield cursor.value;
      // Skip to the next entry
      cursor.continue([cursor.key[0], ""]);
    }
  }

  async index(
    path: string,
    filerev: string,
    entries: Iterable<WithoutPath<EntryTypes<Kinds>[keyof Kinds]>>,
  ): Promise<void> {
    const tx = this.db.transaction("datasworn-entry", "readwrite");
    const store = tx.objectStore("datasworn-entry");

    // Delete all old entries for the path
    for await (const cursor of store
      .index("by-path")
      .iterate(IDBKeyRange.bound([path, ""], [path, "\uffff"]))) {
      await cursor.delete();
    }

    // Add new entries
    for (const entry of entries) {
      await store.put({
        ...entry,
        path,
        filerev,
      });
    }

    await tx.done;

    this.postMessage({
      type: "file-indexed",
      path,
    });
  }

  protected postMessage(message: DataswornBroadcastMessage) {
    this.channel.postMessage(message);
  }
}
