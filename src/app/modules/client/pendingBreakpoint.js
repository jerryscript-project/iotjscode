/*
 * Copyright 2018 Samsung Electronics Co., Ltd. and other contributors
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

import ActiveBreakpoint from './activeBreakpoint';

export default class PendingBreakpoint extends ActiveBreakpoint {

  /**
   * Constructor.
   *
   * @param {number} line The breakpoint's line position inside a file.
   * @param {string} sourceName The source name of the file which contains the breakpoint.
   * @param {string} func The function name as a pending breakpoint.
   */
  constructor(line = 0, sourceName = null, func = null) {
    super();

    super._line = line;
    super._func = func;
    super._index = -1;

    this._sourceName = sourceName;
  }

  get sourceName() {
    return this._sourceName;
  }

  set sourceName(name) {
    this._sourceName = name;
  }
}
