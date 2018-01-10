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

import Multimap from './client-multimap';
import Connection from './client-connection';
import Transpiler from './transpiler';
import Util from './util';
import Logger from './logger';

/**
 * Packages sent between the server and the client.
 */
export const PROTOCOL = {
  SERVER: {
    JERRY_DEBUGGER_CONFIGURATION: 1,
    JERRY_DEBUGGER_PARSE_ERROR: 2,
    JERRY_DEBUGGER_BYTE_CODE_CP: 3,
    JERRY_DEBUGGER_PARSE_FUNCTION: 4,
    JERRY_DEBUGGER_BREAKPOINT_LIST: 5,
    JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST: 6,
    JERRY_DEBUGGER_SOURCE_CODE: 7,
    JERRY_DEBUGGER_SOURCE_CODE_END: 8,
    JERRY_DEBUGGER_SOURCE_CODE_NAME: 9,
    JERRY_DEBUGGER_SOURCE_CODE_NAME_END: 10,
    JERRY_DEBUGGER_FUNCTION_NAME: 11,
    JERRY_DEBUGGER_FUNCTION_NAME_END: 12,
    JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP: 13,
    JERRY_DEBUGGER_MEMSTATS_RECEIVE: 14,
    JERRY_DEBUGGER_BREAKPOINT_HIT: 15,
    JERRY_DEBUGGER_EXCEPTION_HIT: 16,
    JERRY_DEBUGGER_EXCEPTION_STR: 17,
    JERRY_DEBUGGER_EXCEPTION_STR_END: 18,
    JERRY_DEBUGGER_BACKTRACE: 19,
    JERRY_DEBUGGER_BACKTRACE_END: 20,
    JERRY_DEBUGGER_EVAL_RESULT: 21,
    JERRY_DEBUGGER_EVAL_RESULT_END: 22,
    JERRY_DEBUGGER_WAIT_FOR_SOURCE: 23,
    JERRY_DEBUGGER_OUTPUT_RESULT: 24,
    JERRY_DEBUGGER_OUTPUT_RESULT_END: 25,

    JERRY_DEBUGGER_EVAL_OK: 1,
    JERRY_DEBUGGER_EVAL_ERROR: 2,

    JERRY_DEBUGGER_OUTPUT_OK: 1,
    JERRY_DEBUGGER_OUTPUT_WARNING: 2,
    JERRY_DEBUGGER_OUTPUT_ERROR: 3,
  },
  CLIENT: {
    JERRY_DEBUGGER_FREE_BYTE_CODE_CP: 1,
    JERRY_DEBUGGER_UPDATE_BREAKPOINT: 2,
    JERRY_DEBUGGER_EXCEPTION_CONFIG: 3,
    JERRY_DEBUGGER_MEMSTATS: 4,
    JERRY_DEBUGGER_STOP: 5,
    JERRY_DEBUGGER_CLIENT_SOURCE: 6,
    JERRY_DEBUGGER_CLIENT_SOURCE_PART: 7,
    JERRY_DEBUGGER_NO_MORE_SOURCES: 8,
    JERRY_DEBUGGER_CONTEXT_RESET: 9,
    JERRY_DEBUGGER_CONTINUE: 10,
    JERRY_DEBUGGER_STEP: 11,
    JERRY_DEBUGGER_NEXT: 12,
    JERRY_DEBUGGER_GET_BACKTRACE: 13,
    JERRY_DEBUGGER_EVAL: 14,
    JERRY_DEBUGGER_EVAL_PAR: 15,
  },
};

/**
 * States of the JerryScript engine.
 * The available actions in the client depend on these modes.
 */
export const ENGINE_MODE = {
  DISCONNECTED: 0,
  RUN: 1,
  BREAKPOINT: 2,
  CLIENT_SOURCE: 3,
};

export default class DebuggerClient {

  /**
   * Constructor.
   *
   * @param {string} address Connection address (ip and port).
   * @param {object} session Session module object.
   * @param {object} surface Surface module object.
   * @param {object} settings Settings module object.
   * @param {object} chart MemoryChart module object.
   */
  constructor(address, session, surface, settings, chart) {
    this._logger = new Logger($('#console-panel'));
    this._transpiler = new Transpiler();
    this._session = session;
    this._surface = surface;
    this._settings = settings;

    this._maxMessageSize = 0;
    this._cpointerSize = 0;
    this._littleEndian = true;
    this._functions = {};
    this._sources = {};
    this._lineList = new Multimap();
    this._lastBreakpointHit = null;
    this._activeBreakpoints = {};
    this._nextBreakpointIndex = 1;
    this._pendingBreakpoints = [];
    this._backtraceFrame = 0;

    this._alive = false;
    this._mode = {
      current: ENGINE_MODE.DISCONNECTED,
      last: null,
    };

    this._connection = new Connection(this, address, this._surface, this._session, this._settings, chart);
  }

  getMaxMessageSize() {
    return this._maxMessageSize;
  }

  setMaxMessageSize(size) {
    this._maxMessageSize = size;
  }

  getCPointerSize() {
    return this._cpointerSize;
  }

  setCPointerSize(size) {
    this._cpointerSize = size;
  }

  isLittleEndian() {
    return this._littleEndian;
  }

  setLittleEndian(value) {
    this._littleEndian = value;
  }

  getActiveBreakpoints() {
    return this._activeBreakpoints;
  }

  getNextBreakpointIndex() {
    return this._nextBreakpointIndex;
  }

  getLastBreakpointHit() {
    return this._lastBreakpointHit;
  }

  setLastBreakpointHit(point) {
    this._lastBreakpointHit = point;
  }

  getPendingbreakpoints() {
    return this._pendingBreakpoints;
  }

  getBacktraceFrame() {
    return this._backtraceFrame;
  }

  setBacktraceFrame(frame) {
    this._backtraceFrame = frame;
  }

  setFunctions(key, value) {
    this._functions[key] = value;
  }

  getSources() {
    return this._sources;
  }

  setSources(name, source) {
    this._sources[name] = source;
  }

  lineListInsert(key, value) {
    this._lineList.insert(key, value);
  }

  getEngineMode() {
    return this._mode.current;
  }

  setEngineMode(mode) {
    this._mode.last = this._mode.current;
    this._mode.current = mode;

    if (mode === ENGINE_MODE.CLIENT_SOURCE ||
        mode === ENGINE_MODE.DISCONNECTED) {
      this._surface.toggleSettingItem(true, 'transpileToES5');
    } else {
      this._surface.toggleSettingItem(false, 'transpileToES5');
    }
  }

  /**
   * Aborts the sockeet connection through the connection object.
   *
   * @param {string} message The abort message.
   */
  abortConnection(message) {
    this._connection.abort(message);
  }

  /**
   * Concat two uInt8 arrays.
   * The first byte (opcode) of nextArray is ignored.
   *
   * @param {array} baseArray First array.
   * @param {array} nextArray Second array.
   * @return {array} The new concatenated array.
   */
  concatUint8Arrays(baseArray, nextArray) {
    if (nextArray.byteLength <= 1) {
      /* Nothing to append. */
      return baseArray;
    }

    if (!baseArray) {
      /* Cut the first byte (opcode). */
      return nextArray.slice(1);
    }

    let baseLength = baseArray.byteLength;
    let nextLength = nextArray.byteLength - 1;
    let result = new Uint8Array(baseLength + nextLength);

    result.set(nextArray, baseLength - 1);

    /* This set operation overwrites the opcode. */
    result.set(baseArray);

    return result;
  }

  /**
   * Converts a cesu8 string to a regular string.
   *
   * @param {array} array cesu8 array.
   * @return {string} Regular string.
   */
  cesu8ToString(array) {
    if (!array) {
      return '';
    }

    let length = array.byteLength;
    let i = 0;
    let result = '';

    while (i < length) {
      let chr = array[i];

      ++i;

      if (chr >= 0x7f) {
        if (chr & 0x20) {
          /* Three bytes long character. */
          chr = ((chr & 0xf) << 12) | ((array[i] & 0x3f) << 6) | (array[i + 1] & 0x3f);
          i += 2;
        } else {
          /* Two bytes long character. */
          chr = ((chr & 0x1f) << 6) | (array[i] & 0x3f);
          ++i;
        }
      }

      result += String.fromCharCode(chr);
    }

    return result;
  }

  /**
   * Decodes the recieved message and returns an array of decoded numbers.
   * Format: B=byte I=int32 C=cpointer.
   *
   * @param {char} format Format type.
   * @param {uint8} message Recieved message.
   * @param {number} offset Offset inside the message.
   */
  decodeMessage(format, message, offset) {
    let result = [];
    let value;

    if (!offset) {
      offset = 0;
    }

    if (offset + this.getFormatSize(format) > message.byteLength) {
      this._connection.abort('received message is too short.');
    }

    for (let i in format) {
      if (format[i] === 'B') {
        result.push(message[offset]);
        offset++;
        continue;
      }

      if (format[i] === 'C' && this._cpointerSize === 2) {
        if (this._littleEndian) {
          value = message[offset] | (message[offset + 1] << 8);
        } else {
          value = (message[offset] << 8) | message[offset + 1];
        }

        result.push(value);
        offset += 2;
        continue;
      }

      Util.assert(format[i] === 'I' || (format[i] === 'C' && this._cpointerSize === 4));

      if (this._littleEndian) {
        value = (
          message[offset] |
          (message[offset + 1] << 8) |
          (message[offset + 2] << 16) |
          (message[offset + 3] << 24)
        );
      } else {
        value = (
          (message[offset] << 24) |
          (message[offset + 1] << 16) |
          (message[offset + 2] << 8) |
          (message[offset + 3] << 24)
        );
      }

      result.push(value);
      offset += 4;
    }

    return result;
  }

  /**
   * Encode an outgoing message and send it after the encoding is completed.
   * Format: B=byte I=int32 C=cpointer.
   *
   * @param {char} format Format type.
   * @param {array} values The encrypted values.
   */
  encodeMessage(format, values) {
    let length = this.getFormatSize(format);
    let message = new Uint8Array(length);
    let offset = 0;

    for (let i in format) {
      if (format.hasOwnProperty(i)) {
        let value = values[i];

        if (format[i] === 'B') {
          message[offset] = value;
          offset++;
          continue;
        }

        if (format[i] === 'C' && this._cpointerSize === 2) {
          if (this._littleEndian) {
            message[offset] = value & 0xff;
            message[offset + 1] = (value >> 8) & 0xff;
          } else {
            message[offset] = (value >> 8) & 0xff;
            message[offset + 1] = value & 0xff;
          }

          offset += 2;
          continue;
        }

        this.setUint32(message, offset, value);

        offset += 4;
      }
    }

    this._connection.send(message);
  }

  /**
   * Returns a single breakpoint object.
   *
   * @param {array} breakpointData Data about the breakpoint.
   * @return {object} A single breakpoint object or an empty object.
   */
  getBreakpoint(breakpointData) {
    let returnValue = {};
    let func = this._functions[breakpointData[0]];
    let offset = breakpointData[1];

    if (offset in func.offsets) {
      returnValue.breakpoint = func.offsets[offset];
      returnValue.at = true;
      return returnValue;
    }

    if (offset < func.firstBreakpointOffset) {
      returnValue.breakpoint = func.offsets[func.firstBreakpointOffset];
      returnValue.at = true;
      return returnValue;
    }

    let nearest_offset = -1;

    for (let current_offset in func.offsets) {
      if ((current_offset <= offset) && (current_offset > nearest_offset)) {
        nearest_offset = current_offset;
      }
    }

    returnValue.breakpoint = func.offsets[nearest_offset];
    returnValue.at = false;
    return returnValue;
  }

  /**
   * Sets a breakpoint in the source.
   *
   * @param {string} str The breakpoint insert text which contains the file name and the line number
   *                     or the function name.
   * @param {boolean} pending True if this breakpoint can be a pending breakpoint, false if not.
   */
  setBreakpoint(str, pending) {
    let line = /^(.+):([1-9][0-9]*)$/.exec(str);
    let found = false;

    if (line) {
      let functionList = this._lineList.get(line[2]);

      for (let func of functionList) {
        let sourceName = func.sourceName;

        if (sourceName === line[1] ||
            sourceName.endsWith('/' + line[1]) ||
            sourceName.endsWith('\\' + line[1])) {
          this.insertBreakpoint(func.lines[line[2]], this);
          found = true;
        }
      }
    } else {
      for (let func of this._functions) {

        if (func.name === str) {
          this.insertBreakpoint(func.lines[func.firstBreakpointLine], this);
          found = true;
        }
      }
    }

    if (!found) {
      this._logger.info('Breakpoint not found');
      if (pending) {
        if (line) {
          this._pendingBreakpoints.push(Number(line[2]));
          this._logger.info(`Pending breakpoint index: ${line[0]} added`);
        } else {
          this._pendingBreakpoints.push(str);
          this._logger.info(`Pending breakpoint function name: ${str} added`);
        }
      }
    }

    this._surface.updateBreakpointsPanel(this._activeBreakpoints, this._settings, this._transpiler);
  }

  /**
   * Sends the exeption catch configuration byte to the engine.
   *
   * @param {boolean} enable True if the exeption catch is enabled, false otherwise.
   */
  sendExceptionConfig(enable) {
    if (enable === '') {
      this._logger.error('Argument required', true);
      return;
    }

    if (enable === 1) {
      this._logger.info('Stop at exception enabled');
    } else if (enable === 0) {
      this._logger.info('Stop at exception disabled');
    } else {
      this._logger.info('Invalid input. Usage 1: [Enable] or 0: [Disable].');
      return;
    }

    this.encodeMessage('BB', [PROTOCOL.CLIENT.JERRY_DEBUGGER_EXCEPTION_CONFIG, enable]);
  }

  /**
   * Inserts a breakpoint and updates the breakpoints status in the engine.
   *
   * @param {object} breakpoint Single breakpoint which will be inserted.
   */
  insertBreakpoint(breakpoint) {
    if (breakpoint.activeIndex < 0) {
      breakpoint.activeIndex = this._nextBreakpointIndex;
      this._activeBreakpoints[this._nextBreakpointIndex] = breakpoint;
      this._nextBreakpointIndex++;

      let values = [
        PROTOCOL.CLIENT.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
        1,
        breakpoint.func.byte_code_cp,
        breakpoint.offset,
      ];

      this.encodeMessage('BBCI', values);
    }

    this._logger.info(`Breakpoint ${breakpoint.activeIndex} at ${this.breakpointToString(breakpoint)}`);
  }

  /**
   * Removes a breakpoint from the active breakpoints list and updates the engine.
   *
   * @param {integer} index Index of the breakpoint.
   */
  deleteBreakpoint(index) {
    let breakpoint = this._activeBreakpoints[index];

    if (index === 'all') {
      let found = false;

      for (let i in this._activeBreakpoints) {
        if (this._activeBreakpoints.hasOwnProperty(i)) {
          delete this._activeBreakpoints[i];
          found = true;
        }
      }

      if (!found) {
        this._logger.info('No active breakpoints.');
      }
    } else if (!breakpoint) {
      this._logger.error(`No breakpoint found with index ${index}`, true);
      return;
    }

    Util.assert(breakpoint.activeIndex == index);

    delete this._activeBreakpoints[index];
    breakpoint.activeIndex = -1;

    let values = [
      PROTOCOL.CLIENT.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
      0,
      breakpoint.func.byte_code_cp,
      breakpoint.offset,
    ];

    this.encodeMessage('BBCI', values);

    this._logger.info(`Breakpoint ${index} deleted.`);
    this._surface.updateBreakpointsPanel(this._activeBreakpoints, this._settings, this._transpiler);
  }

  /**
   * Removes a single pending breakpoint from the pending list.
   *
   * @param {integer} index The index of the pending breakpoint.
   */
  deletePendingBreakpoint(index) {
    if (index >= this._pendingBreakpoints.length) {
      this._logger.info('Pending breakpoint not found');
    } else {
      this._pendingBreakpoints.splice(index, 1);
      this._logger.info(`Pending breakpoint ${index} deleted.`);
    }
  }

  /**
   * Lists the active breakpoint into the logger panel.
   */
  listBreakpoints() {
    this._logger.info('List of active breakpoints:');
    let found = false;

    for (let i in this._activeBreakpoints) {
      if (this._activeBreakpoints.hasOwnProperty(i)) {
        this._logger.info(`  breakpoint ${i} at ${this.breakpointToString(this._activeBreakpoints[i])}`);
        found = true;
      }
    }

    if (!found) {
      this._logger.info('  no active breakpoints');
    }

    if (this._pendingBreakpoints.length !== 0) {
      this._logger.info('List of pending breakpoints:');
      for (let i in this._pendingBreakpoints) {
        if (this._pendingBreakpoints.hasOwnProperty(i)) {
          this._logger.info(`  pending breakpoint ${i} at ${this._pendingBreakpoints[i]}`);
        }
      }
    } else {
      this._logger.info('No pending breakpoints');
    }
  }

  /**
   * Sends the execution resume byte message to the engine.
   *
   * @param {PROTOCOL} command The execution resume package command.
   */
  sendResumeExec(command) {
    if (this._mode.current !== ENGINE_MODE.BREAKPOINT) {
      this._logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.');
      return;
    }

    this.encodeMessage('B', [command]);

    this._lastBreakpointHit = null;
  }

  /**
   * Gets the backtrace depth options from the settings page and send that to the debugger.
   */
  getBacktrace() {
    if (this._mode.current !== ENGINE_MODE.BREAKPOINT) {
      this._logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.', true);
      return;
    }

    let max_depth = 0;
    let user_depth = $('#backtrace-depth').val();

    if (user_depth !== 0) {
      if (/[1-9][0-9]*/.test(user_depth)) {
        max_depth = parseInt(user_depth);
      }
    }

    if (this._mode.current === ENGINE_MODE.BREAKPOINT) {
      this.encodeMessage('BI', [PROTOCOL.CLIENT.JERRY_DEBUGGER_GET_BACKTRACE, max_depth]);
    }
  }

  /**
   * Sends an eval message to the engine which should be evaluated.
   * If the eval message can not fit into one message this function will slice it
   * and send it in pieces to the engine.
   *
   * @param {string} str The eval code string.
   */
  sendEval(str) {
    if (this._mode.current !== ENGINE_MODE.BREAKPOINT) {
      this._logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.', true);
      return;
    }

    if (str === '') {
      this._logger.error('Argument required', true);
      return;
    }

    let array = this.stringToCesu8(str);
    let byteLength = array.byteLength;

    if (byteLength <= this._maxMessageSize) {
      this._connection.send(array);
      return;
    }

    this._connection.send(array.slice(0, this._maxMessageSize));

    let offset = this._maxMessageSize - 1;

    while (offset < byteLength) {
      array[offset] = PROTOCOL.CLIENT.JERRY_DEBUGGER_EVAL_PART;
      this._connection.send(array.slice(offset, offset + this._maxMessageSize));
      offset += this._maxMessageSize - 1;
    }
  }

  /**
   * Sends one or more source file(s) to the engine which should be executed.
   * If the source code message can not fit into one message this function will slice it
   * and send it in pieces to the engine.
   */
  sendClientSource() {
    if (this._mode.current !== ENGINE_MODE.CLIENT_SOURCE) {
      this._logger.error('This command is allowed only if the engine is waiting for a source.', true);
      return;
    }

    if (!this._session.getUploadList().length || !this._session.isUploadStarted()) {
      this._logger.info('The engine is waiting for a source.', true);
      return;
    }

    this.setEngineMode(ENGINE_MODE.RUN);

    let sid = this._session.getUploadList()[0];

    if (sid === 0) {
      this.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTEXT_RESET]);
      this._session.shiftUploadList();
      this._session.setContextReset(true);
      this._surface.changeUploadColor(this._surface.COLOR.GREEN, sid);
      this._session.allowUploadAndRun(false);
      return;
    }

    // Turn on the action buttons and turn off run button.
    this._surface.disableActionButtons(false);

    let source = this._session.getFileSessionById(sid);

    if (this._settings.getValue('debugger.transpileToES5') && !this._transpiler.isEmpty()) {
      if (this._transpiler.transformToES5(this._session.getFileNameById(sid), this._session.getFileSessionById(sid))) {
        source = this._transpiler.getTransformedSource(this._session.getFileNameById(sid));
      } else {
        this.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTEXT_RESET]);
        this._session.resetUploadList();
        this._session.shiftUploadList();
        this._session.setContextReset(true);
        this._session.allowUploadAndRun(false);
        return;
      }
    }

    let array = this.stringToCesu8(`${this._session.getFileNameById(sid)}\0${source}`);
    let byteLength = array.byteLength;

    array[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_CLIENT_SOURCE;

    if (byteLength <= this._maxMessageSize) {
      this._connection.send(array);
      this._session.shiftUploadList();
      this._session.allowUploadAndRun(false);
      this._surface.changeUploadColor(this._surface.COLOR.GREEN, sid);
      return;
    }

    this._connection.send(array.slice(0, this._maxMessageSize));

    let offset = this._maxMessageSize - 1;

    while (offset < byteLength) {
      array[offset] = PROTOCOL.CLIENT.JERRY_DEBUGGER_CLIENT_SOURCE_PART;
      this._connection.send(array.slice(offset, offset + this._maxMessageSize));
      offset += this._maxMessageSize - 1;
    }

    this._session.shiftUploadList();
    this._session.allowUploadAndRun(false);
    this._surface.changeUploadColor(this._surface.COLOR.GREEN, sid);
  }

  /**
   * Prints the currently available source code into the logger panel.
   */
  printSource() {
    if (this._lastBreakpointHit) {
      this._logger.info(this._lastBreakpointHit.func.source);
    }
  }

  /**
   * Prints every information about the breakpoints into the logger panel.
   * This function will print every breakpoint no matter if it's active or not.
   */
  dump() {
    for (let i in this._functions) {
      if (this._functions.hasOwnProperty(i)) {
        let func = this._functions[i];
        let sourceName = func.sourceName;

        if (!sourceName) {
          sourceName = '<unknown>';
        }

        this._logger.info(
          `Function 0x${Number(i).toString(16)} '${func.name}' at ${sourceName}:${func.line}, ${func.column}`
        );

        for (let j in func.lines) {
          if (func.lines.hasOwnProperty(j)) {
            let active = '';

            if (func.lines[j].active >= 0) {
              active = ` (active: ${func.lines[j].active})`;
            }

            this._logger.info(`  Breakpoint line: ${j} at memory offset: ${func.lines[j].offset} ${active}`);
          }
        }
      }
    }
  }

  /**
   * Returns the available breakpoint lines in the source code.
   *
   * @return {array} Array of the breakpoint line and name pair objects.
   */
  getBreakpointLines() {
    let result = [];
    for (let i in this._functions) {
      if (this._functions.hasOwnProperty(i)) {
        let func = this._functions[i];
        for (let j in func.lines) {
          if (func.lines.hasOwnProperty(j)) {
            result.push( {
              line: parseInt(j),
              sourceName: func.sourceName,
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Converts a breakpoint dataset into a readable format.
   *
   * @param {object} breakpoint Breakpoint dataset.
   * @return {string} Readable informations.
   */
  breakpointToString(breakpoint) {
    let result = breakpoint.func.sourceName;

    if (!result) {
      result = '[unknown]';
    }

    let line = breakpoint.line;

    if (this._settings.getValue('debugger.transpileToES5') && !this._transpiler.isEmpty()) {
      line = this._transpiler.getOriginalPositionFor(
        this._session.getFileNameById(this._session.getActiveID()),
        line,
        0
      ).line;
    }

    result += `:${line}`;

    if (breakpoint.func.is_func) {
      let f = breakpoint.func;
      let position = {
        line: f.line,
        column: f.column,
      };

      if (this._settings.getValue('debugger.transpileToES5') && !this._transpiler.isEmpty()) {
        position = this._transpiler.getOriginalPositionFor(
          this._session.getFileNameById(this._session.getActiveID()),
          position.line,
          position.column
        );
      }

      result += ` (in ${(f.name ? f.name : 'function')}() at line:${position.line}, col:${position.column})`;
    }

    return result;
  }

  /**
   * Sets an array to uInt32.
   *
   * @param {array} array Working array.
   * @param {number} offset Offset whitin the array.
   * @param {number} value The value.
   */
  setUint32(array, offset, value) {
    if (this._littleEndian) {
      array[offset] = value & 0xff;
      array[offset + 1] = (value >> 8) & 0xff;
      array[offset + 2] = (value >> 16) & 0xff;
      array[offset + 3] = (value >> 24) & 0xff;
    } else {
      array[offset] = (value >> 24) & 0xff;
      array[offset + 1] = (value >> 16) & 0xff;
      array[offset + 2] = (value >> 8) & 0xff;
      array[offset + 3] = value & 0xff;
    }
  }

  /**
   * Converts a regular string to cesu8.
   *
   * @param {string} string Regular string.
   * @return {array} Cesu8 array.
   */
  stringToCesu8(string) {
    Util.assert(string != '');

    let length = string.length;
    let byteLength = length;

    for (let i = 0; i < length; i++) {
      let chr = string.charCodeAt(i);

      if (chr >= 0x7ff) {
        byteLength ++;
      }

      if (chr >= 0x7f) {
        byteLength++;
      }
    }

    let result = new Uint8Array(byteLength + 1 + 4);

    result[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_EVAL;

    this.setUint32(result, 1, byteLength);

    let offset = 5;

    for (let i = 0; i < length; i++) {
      let chr = string.charCodeAt(i);

      if (chr >= 0x7ff) {
        result[offset] = 0xe0 | (chr >> 12);
        result[offset + 1] = 0x80 | ((chr >> 6) & 0x3f);
        result[offset + 2] = 0x80 | (chr & 0x3f);
        offset += 3;
      } else if (chr >= 0x7f) {
        result[offset] = 0xc0 | (chr >> 6);
        result[offset + 1] = 0x80 | (chr & 0x3f);
      } else {
        result[offset] = chr;
        offset++;
      }
    }

    return result;
  }

  /**
   * Returns the encode and decode format size.
   *
   * @param {string} format The encrypted format type.
   * @return {integer} Length of the format.
   */
  getFormatSize(format) {
    let length = 0;

    for (let i in format) {
      if (format[i] === 'B') {
        length++;
        continue;
      }

      if (format[i] === 'C') {
        length += this._cpointerSize;
        continue;
      }

      Util.assert(format[i] == 'I');

      length += 4;
    }

    return length;
  }

  /**
   * Sends a release function byte message to the engine.
   *
   * @param {uitn8} message The byte message.
   */
  releaseFunction(message) {
    let byte_code_cp = this.decodeMessage('C', message, 1)[0];
    let func = this._functions[byte_code_cp];

    for (let i in func.lines) {
      if (func.lines.hasOwnProperty(i)) {
        this._lineList.delete(i, func);

        let breakpoint = func.lines[i];

        Util.assert(i == breakpoint.line);

        if (breakpoint.activeIndex >= 0) {
          delete this._activeBreakpoints[breakpoint.activeIndex];
        }
      }
    }

    delete this._functions[byte_code_cp];

    message[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_FREE_BYTE_CODE_CP;
    this._connection.send(message);
  }

}
