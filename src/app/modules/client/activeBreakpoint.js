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

export default class ActiveBreakpoint {

  /**
   * Constructor.
   *
   * @param {number} line The breakpoint's line position inside a file.
   * @param {number} offset The breakpoint's offset inside a file.
   * @param {mixed} func Information about the context.
   * @param {number} index The identifier of the breakpoint.
   */
  constructor(line = 0, offset = 0, func = null, index = -1) {
    this._line = line;
    this._offset = offset;
    this._func = func;
    this._index = index;
  }

  get line() {
    return this._line;
  }

  set line(line) {
    this._line = line;
  }

  get offset() {
    return this._offset;
  }

  set offset(offset) {
    this._offset = offset;
  }

  get func() {
    return this._func;
  }

  set func(func) {
    this._func = func;
  }

  get index() {
    return this._index;
  }

  set index(index) {
    this.index = index;
  }
}
