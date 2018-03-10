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
import PendingBreakpoint from './pendingBreakpoint';

export default class Breakpoints {

  /**
   * Constructor.
   */
  constructor() {
    this._activeBreakpoints = [];
    this._pendingBreakpoints = [];
    this._lastHit = null;
    this._nextIndex = 1;
  }

  get activeBreakpoints() {
    return this._activeBreakpoints;
  }

  get pendingBreakpoints() {
    return this._pendingBreakpoints;
  }

  get lastHit() {
    return this._lastHit;
  }

  set lastHit(hit) {
    this._lastHit = hit;
  }

  get nextIndex() {
    return this._nextIndex;
  }

  /**
   * Increases the next breakpoint index by one.
   */
  increaseNextIndex() {
    this._nextIndex++;
  }

  /**
   * Adds a new active breakpoint into the breakpoint list.
   *
   * @param {number} line Breakpoint's line position.
   * @param {number} offset Offset inside the file.
   * @param {object} func Information about the function context.
   * @param {number} index Identifier of the breakpoint.
   */
  addActiveBreakpoint(line, offset, func, index) {
    this._activeBreakpoints = [
      ...this._activeBreakpoints,
      new ActiveBreakpoint(line, offset, func, index),
    ];
  }

  /**
   * Adds a new pending breakpoint to the breakpoint list.
   *
   * @param {number} line Breakpoint's line position.
   * @param {string} sourceName Name of the source file.
   * @param {string} func Name of the pending function name.
   */
  addPendingBreakpoint(line, sourceName, func) {
    this._pendingBreakpoints = [
      ...this._pendingBreakpoints,
      new PendingBreakpoint(line, sourceName, func),
    ];
  }

  /**
   * Delete an active breakpoint from the list based on the given index.
   *
   * @param {number} index The selected breakpoint's identifier.
   */
  deleteActiveBreakpointByIndex(index) {
    this._activeBreakpoints = this._activeBreakpoints.filter(b => b.index !== index);
  }

  /**
   * Delete a pending breakpoint from the list based on the given index.
   *
   * @param {number} index The selected breakpoint's identifier.
   */
  deletePendingBreakpointByIndex(index) {
    this._pendingBreakpoints = this._pendingBreakpoints.filter(b => b.index !== index);
  }

  /**
   * Delete each active breakpoint.
   */
  deleteActiveBreapoints() {
    this._activeBreakpoints = [];
  }

  /**
   * Delete each pending breakpoint.
   */
  deletePendingBreakpoints() {
    this._pendingBreakpoints = [];
  }

  /**
   * Returns a single active breakpoint object from the list based on the given index.
   *
   * @param {number} index The selected breakpoint's identifier.
   */
  getActiveBreakpointByIndex(index) {
    return this._activeBreakpoints.find(b => b.index === index);
  }

  /**
   * Returns a single active breakpoint object from the list based on the given line information.
   *
   * @param {number} line The selected line.
   */
  getActiveBreakpointIndexByLine(line) {
    const breakpoint = this._activeBreakpoints.find(b => b.line === line);
    return breakpoint ? breakpoint.index : undefined;
  }
}
