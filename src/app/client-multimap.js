/*
 * Copyright 2017 Samsung Electronics Co., Ltd. and other contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Util from './util';

export default class Multimap {

  constructor() {
    this._map = {};
  }

  /**
   * Returns an item from the map.
   *
   * @param {mixed} key Key of the searched item.
   * @return {mixed} The item array if that is exists, empty array otherwise.
   */
  get(key) {
    let item = this._map[key];
    return item ? item : [];
  }

  /**
   * Puts a key-value pair into the map.
   *
   * @param {number} key The key of the new item.
   * @param {mixed} value The new value which will be stored as an array.
   */
  insert(key, value) {
    let item = this._map[key];

    if (item) {
      item.push(value);
      return;
    }

    this._map[key] = [value];
  }

  /**
   * Removes an item at the key position.
   *
   * @param {number} key The top array key.
   * @param {mixed} key The value which will be removed.
   */
  delete(key, value) {
    let array = this._map[key];

    Util.assert(array);

    let newLength = array.length - 1;
    let i = array.indexOf(value);

    Util.assert(i !== -1);

    array.splice(i, 1);

    array.length = newLength;
  }
}
