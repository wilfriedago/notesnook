/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2022 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import { CURRENT_DATABASE_VERSION } from "../../common";
import { logger } from "../../logger";

class Collector {
  /**
   *
   * @param {import("../index").default} db
   */
  constructor(db) {
    this._db = db;
    this.logger = logger.scope("SyncCollector");
  }

  async collect(lastSyncedTimestamp, isForceSync) {
    await this._db.notes.init();

    this._lastSyncedTimestamp = lastSyncedTimestamp;
    this.key = await this._db.user.getEncryptionKey();

    const items = [
      ...this._collect("note", this._db.notes.raw, isForceSync),
      ...this._collect("shortcut", this._db.shortcuts.raw, isForceSync),
      ...this._collect("notebook", this._db.notebooks.raw, isForceSync),
      ...this._collect("content", await this._db.content.all(), isForceSync),
      ...this._collect(
        "attachment",
        this._db.attachments.syncable,
        isForceSync
      ),
      ...this._collect("settings", [this._db.settings.raw], isForceSync)
    ];

    return { items, vaultKey: await this._db.vault._getKey() };
  }

  _serialize(item) {
    if (!item) return null;
    return this._db.storage.encrypt(this.key, JSON.stringify(item));
  }

  encrypt(array) {
    if (!array.length) return [];
    return Promise.all(array.map(this._map, this));
  }

  /**
   *
   * @param {Array} array
   * @returns {Array}
   */
  _collect(collectionId, array, isForceSync) {
    if (!array.length) return [];

    const result = array.reduce((prev, item) => {
      if (!item) return prev;

      const isSyncable = !item.synced || isForceSync;
      const isUnsynced =
        item.dateModified > this._lastSyncedTimestamp || isForceSync;

      if (item.localOnly) {
        prev.push({
          id: item.id,
          collectionId,
          deleted: true,
          dateModified: Date.now()
        });
      } else if (isUnsynced && isSyncable) {
        prev.push({ ...item, collectionId });
      }

      return prev;
    }, []);
    this.logger.info(
      `Collected items: ${collectionId} (${result.length}/${array.length})`
    );
    return result;
  }

  // _map(item) {
  //   return {
  //     id: item.id,
  //     v: CURRENT_DATABASE_VERSION,
  //     iv: item.iv,
  //     cipher: item.cipher,
  //     length: item.length,
  //     alg: item.alg,
  //     dateModified: item.dateModified,
  //   };
  // }

  async _map(item) {
    // in case of resolved content
    delete item.resolved;
    // synced is a local only property
    delete item.synced;

    return {
      id: item.id,
      v: CURRENT_DATABASE_VERSION,
      ...(await this._serialize(item))
    };
  }
}
export default Collector;
