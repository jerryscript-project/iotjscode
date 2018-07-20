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

import Connection from './connection';
import Breakpoints from './breakpoints';
import assert from 'assert';
import { EventEmitter } from 'events';

/**
 * Expected Debugger Protocol version.
 */
export const JERRY_DEBUGGER_VERSION = 2;

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
    JERRY_DEBUGGER_WAITING_AFTER_PARSE: 13,
    JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP: 14,
    JERRY_DEBUGGER_MEMSTATS_RECEIVE: 15,
    JERRY_DEBUGGER_BREAKPOINT_HIT: 16,
    JERRY_DEBUGGER_EXCEPTION_HIT: 17,
    JERRY_DEBUGGER_EXCEPTION_STR: 18,
    JERRY_DEBUGGER_EXCEPTION_STR_END: 19,
    JERRY_DEBUGGER_BACKTRACE: 20,
    JERRY_DEBUGGER_BACKTRACE_END: 21,
    JERRY_DEBUGGER_EVAL_RESULT: 22,
    JERRY_DEBUGGER_EVAL_RESULT_END: 23,
    JERRY_DEBUGGER_WAIT_FOR_SOURCE: 24,
    JERRY_DEBUGGER_OUTPUT_RESULT: 25,
    JERRY_DEBUGGER_OUTPUT_RESULT_END: 26,

    // Subtypes of eval.
    JERRY_DEBUGGER_EVAL_OK: 1,
    JERRY_DEBUGGER_EVAL_ERROR: 2,

    // Subtypes of output.
    JERRY_DEBUGGER_OUTPUT_OK: 1,
    JERRY_DEBUGGER_OUTPUT_ERROR: 2,
    JERRY_DEBUGGER_OUTPUT_WARNING: 3,
    JERRY_DEBUGGER_OUTPUT_DEBUG: 4,
    JERRY_DEBUGGER_OUTPUT_TRACE: 5,
  },
  CLIENT: {
    JERRY_DEBUGGER_FREE_BYTE_CODE_CP: 1,
    JERRY_DEBUGGER_UPDATE_BREAKPOINT: 2,
    JERRY_DEBUGGER_EXCEPTION_CONFIG: 3,
    JERRY_DEBUGGER_PARSER_CONFIG: 4,
    JERRY_DEBUGGER_MEMSTATS: 5,
    JERRY_DEBUGGER_STOP: 6,
    JERRY_DEBUGGER_PARSER_RESUME: 7,
    JERRY_DEBUGGER_CLIENT_SOURCE: 8,
    JERRY_DEBUGGER_CLIENT_SOURCE_PART: 9,
    JERRY_DEBUGGER_NO_MORE_SOURCES: 10,
    JERRY_DEBUGGER_CONTEXT_RESET: 11,
    JERRY_DEBUGGER_CONTINUE: 12,
    JERRY_DEBUGGER_STEP: 13,
    JERRY_DEBUGGER_NEXT: 14,
    JERRY_DEBUGGER_FINISH: 15,
    JERRY_DEBUGGER_GET_BACKTRACE: 16,
    JERRY_DEBUGGER_EVAL: 17,
    JERRY_DEBUGGER_EVAL_PART: 18,
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

/**
 * Type of the possible functions return.
 */
export const DEBUGGER_RETURN_TYPES = {
  COMMON: {
    SUCCESS: 0,
    FAIL: 1,
    ALLOWED_IN_BREAKPOINT_MODE: 2,
    ARGUMENT_REQUIRED: 3,
    ARGUMENT_INVALID: 4,
  },
  SOURCE_SENDING: {
    ALLOWED_IN_SOURCE_SENDING_MODE: 100,
    CONTEXT_RESET_SENDED: 101,
    SOURCE_SENDED: 102,
    MULTIPLE_SOURCE_SENDED: 103,
  },
  EXCEPTION_CONFIG: {
    ENABLED: 200,
    DISABLED: 201,
  },
};

export default class DebuggerClient {

  /**
   * Constructor.
   *
   * @param {string} address Connection address (ip and port).
   */
  constructor(address) {
    this._eventEmitter = new EventEmitter();

    this._verison = 0;

    this._maxMessageSize = 0;
    this._cpointerSize = 0;
    this._littleEndian = true;
    this._functions = {};
    this._sources = {};
    this._lineList = new Map();
    this._breakpoints = new Breakpoints();
    this._backtraceFrame = 0;

    this._alive = false;
    this._mode = {
      current: ENGINE_MODE.DISCONNECTED,
      last: null,
    };

    this._connection = new Connection(this, address);
  }

  get connection() {
    return this._connection;
  }

  get breakpoints() {
    return this._breakpoints;
  }

  get lineList() {
    return this._lineList;
  }

  get version() {
    return this._verison;
  }

  set version(version) {
    this._verison = version;
  }

  get maxMessageSize() {
    return this._maxMessageSize;
  }

  set maxMessageSize(max) {
    this._maxMessageSize = max;
  }

  get cPointerSize() {
    return this._cpointerSize;
  }

  set cPointerSize(size) {
    this._cpointerSize = size;
  }

  get littleEndian() {
    return this._littleEndian;
  }

  set littleEndian(value) {
    this._littleEndian = value;
  }

  get backtraceFrame() {
    return this._backtraceFrame;
  }

  set backtraceFrame(frame) {
    this._backtraceFrame = frame;
  }

  get functions() {
    return this._functions;
  }

  set functions(pair) {
    this._functions[pair.key] = pair.value;
  }

  get sources() {
    return this._sources;
  }

  set sources(pair) {
    this._sources[pair.key] = pair.value;
  }

  get engineMode() {
    return this._mode.current;
  }

  set engineMode(mode) {
    this._mode.last = this._mode.current;
    this._mode.current = mode;

    this._eventEmitter.emit('engineModeChange', [mode]);
  }

  /**
   * Debugger client related event handler.
   *
   * @param {string} event The selected event name.
   * @value "engineModeChange" - Emitted on engineMode property change.
   * @value "setBreakpoint" - Emitted on setBreakpoint function call.
   * @value "insertBreakpoint" - Emitted on insertBreakpoint function call.
   * @value "deleteBreakpoint" - Emitted on deleteBreakpoint function call.
   * @value "deletePendingBreakpoint" - Emitted on deletePendingBreakpoint function call.
   * @param {function} callback The event listener function.
   */
  on(event, callback) {
    this._eventEmitter.on(event, args => callback(...args));
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

    const baseLength = baseArray.byteLength;
    const nextLength = nextArray.byteLength - 1;
    const result = new Uint8Array(baseLength + nextLength);

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

    const length = array.byteLength;
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
   * @return {array} The decode message data.
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
      if (format.hasOwnProperty(i)) {
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

        assert.ok(format[i] === 'I' || (format[i] === 'C' && this._cpointerSize === 4));

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
    const length = this.getFormatSize(format);
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
    const line = /^(.+):([1-9][0-9]*)$/.exec(str);
    let found = false;

    if (line) {
      const functionList = this._lineList.get(line[2]);

      for (const func of functionList) {
        const sourceName = func.sourceName;

        if (sourceName === line[1] ||
            sourceName.endsWith('/' + line[1]) ||
            sourceName.endsWith('\\' + line[1])) {
          this.insertBreakpoint(func.lines[line[2]]);
          found = true;
        }
      }
    } else {
      for (const key in this._functions) {
        if (this._functions.hasOwnProperty(key)) {
          const func = this._functions[key];

          if (func.name === str) {
            this.insertBreakpoint(func.lines[func.firstBreakpointLine]);
            found = true;
          }
        }
      }
    }

    let messages = [];

    if (!found) {
      messages.push('Breakpoint not found');
      if (pending) {
        if (!this._breakpoints.pendingBreakpoints.length) {
          this.sendParserConfig(1);
        }

        if (line) {
          this._breakpoints.pendingBreakpoints.push({
            line: line[1],
            function: '',
            sourceName: line[0],
          });
          messages.push(`Pending breakpoint index: ${line[0]} added`);
        } else {
          this._breakpoints.pendingBreakpoints.push({
            line: null,
            function: str,
            sourceName: null,
          });
          messages.push(`Pending breakpoint function name: ${str} added`);
        }
      }
    }

    this._eventEmitter.emit('setBreakpoint', [messages]);

    return !found && !pending ? false : true;
  }

  /**
   * Sends the exeption catch configuration byte to the engine.
   *
   * @param {boolean} enable True if the exeption catch is enabled, false otherwise.
   * @returns {object} Returns with a success and with a message parameter.
   */
  sendExceptionConfig(enable) {
    if (enable === '') {
      return DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_REQUIRED;
    }

    if (enable === 1 || enable === 0) {
      this.encodeMessage('BB', [PROTOCOL.CLIENT.JERRY_DEBUGGER_EXCEPTION_CONFIG, enable]);
      return enable === 1 ? (
        DEBUGGER_RETURN_TYPES.EXCEPTION_CONFIG.ENABLED
      ) : (
        DEBUGGER_RETURN_TYPES.EXCEPTION_CONFIG.DISABLED
      );
    }

    return DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_INVALID;
  }

  /**
   * Sends the parser configuration flag to the engine.
   *
   * @param {boolean} enable True if the parser waiting is enabled, false otherwise.
   * @returns {object} Returns with a success and with a message parameter.
   */
  sendParserConfig(enable) {
    if (enable === undefined) {
      return DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_REQUIRED;
    }

    this.encodeMessage('BB', [PROTOCOL.CLIENT.JERRY_DEBUGGER_PARSER_CONFIG, enable]);

    return DEBUGGER_RETURN_TYPES.COMMON.SUCCESS;
  }

  /**
   * Inserts a breakpoint and updates the breakpoints status in the engine.
   *
   * @param {object} breakpoint Single breakpoint which will be inserted.
   */
  insertBreakpoint(breakpoint) {
    const index = this._breakpoints.nextIndex;

    if (breakpoint.index < 0) {
      this._breakpoints.addActiveBreakpoint(
        breakpoint.line,
        breakpoint.offset,
        breakpoint.func,
        index
      );
      this._breakpoints.increaseNextIndex();

      const values = [
        PROTOCOL.CLIENT.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
        1,
        breakpoint.func.byte_code_cp,
        breakpoint.offset,
      ];

      this.encodeMessage('BBCI', values);
    }

    this._eventEmitter.emit('insertBreakpoint', [index, breakpoint]);
  }

  /**
   * Removes a breakpoint from the active breakpoints list and updates the engine.
   *
   * @param {integer} index Index of the breakpoint.
   */
  deleteBreakpoint(index) {
    const breakpoint = this._breakpoints.getActiveBreakpointByIndex(index);
    let message = '';

    if (index === 'all') {
      let found = false;
      const actives = this._breakpoints.activeBreakpoints;

      for (const i in actives) {
        if (actives.hasOwnProperty(i)) {
          this.deleteBreakpoint(actives[i].index);
          found = true;
        }
      }

      if (!found) {
        message = 'No active breakpoints.';
      }
    } else if (breakpoint) {
      assert.ok(breakpoint && breakpoint.index === index);

      this._breakpoints.deleteActiveBreakpointByIndex(index);

      const values = [
        PROTOCOL.CLIENT.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
        0,
        breakpoint.func.byte_code_cp,
        breakpoint.offset,
      ];

      this.encodeMessage('BBCI', values);

      message = `Breakpoint ${index} deleted.`;
    } else {
      message = `No breakpoint found with index ${index}`;
    }

    this._eventEmitter.emit('deleteBreakpoint', [message]);
  }

  /**
   * Removes a single pending breakpoint from the pending list.
   *
   * @param {integer} index The index of the pending breakpoint.
   */
  deletePendingBreakpoint(index) {
    let message = '';

    if (index >= this._breakpoints.pendingBreakpoints.length) {
      message = 'Pending breakpoint not found';
    } else {
      this._breakpoints.deletePendingBreakpointByIndex(index);
      message = `Pending breakpoint ${index} deleted.`;
    }

    this._eventEmitter.emit('deletePendingBreakpoint', [message]);
  }

  /**
   * Returns with the List of the active breakpoint in console friendly way.
   *
   * @return {array} List of the breakpoints in readable format.
   */
  listBreakpoints() {
    let list = ['List of active breakpoints:'];
    let found = false;

    for (const i in this._breakpoints.activeBreakpoints) {
      if (this._breakpoints.activeBreakpoints.hasOwnProperty(i)) {
        list.push(`  breakpoint ${i} at ${this.breakpointToString(this._breakpoints.activeBreakpoints[i])}`);
        found = true;
      }
    }

    if (!found) {
      list.push('  no active breakpoints');
    }

    list.push('List of pending breakpoints:');
    if (this._breakpoints.pendingBreakpoints.length !== 0) {
      for (const i in this._breakpoints.pendingBreakpoints) {
        if (this._breakpoints.pendingBreakpoints.hasOwnProperty(i)) {
          list.push(`  pending breakpoint ${i} at ${this.pendingBreakpointToString(this._breakpoints.pendingBreakpoints[i])}`);
        }
      }
    } else {
      list.push('  no pending breakpoints');
    }

    return list;
  }

  /**
   * Sends the execution resume byte message to the engine.
   *
   * @param {PROTOCOL} command The execution resume package command.
   */
  sendResumeExec(command) {
    if (this._mode.current === ENGINE_MODE.BREAKPOINT) {
      this.encodeMessage('B', [command]);
      this._lastBreakpointHit = null;

      return DEBUGGER_RETURN_TYPES.COMMON.SUCCESS;
    }

    return DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE;
  }

  /**
   * Gets the backtrace depth options from the settings page and send that to the debugger.
   * This signal can be sended to the engine only in breakpoint mode.
   *
   * @return {DEBUGGER_RETURN_TYPES} COMMON.SUCCESS in case of successful signal send and
   *                                 COMMON.ALLOWED_IN_BREAKPOINT_MODE in case of invalid engine mode.
   */
  sendGetBacktrace(userDepth) {
    if (this._mode.current === ENGINE_MODE.BREAKPOINT) {
      let max_depth = 0;

      if (userDepth !== 0) {
        if (/[1-9][0-9]*/.test(userDepth)) {
          max_depth = parseInt(userDepth);
        }
      }

      this.encodeMessage('BI', [PROTOCOL.CLIENT.JERRY_DEBUGGER_GET_BACKTRACE, max_depth]);

      return DEBUGGER_RETURN_TYPES.COMMON.SUCCESS;
    }

    return DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE;
  }

  /**
   * Sends an eval message to the engine which should be evaluated.
   * If the eval message can not fit into one message this function will slice it
   * and send it in pieces to the engine.
   * This request can be sended to the engine only in breakpoint mode.
   *
   * @param {string} str The eval code string.
   * @return {DEBUGGER_RETURN_TYPE} COMMON.ARGUMENT_REQUIRED in case of missing argument,
   *                                COMMON.ALLOWED_IN_BREAKPOINT_MODE in case of invalid engine mode and
   *                                COMMON.SUCCESS in case of successful send.
   */
  sendEval(str) {
    if (this._mode.current === ENGINE_MODE.BREAKPOINT) {
      if (str === '') {
        return DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_REQUIRED;
      } else {
        let array = this.stringToCesu8(str);
        const byteLength = array.byteLength;

        if (byteLength <= this._maxMessageSize) {
          this._connection.send(array);
        } else {
          this._connection.send(array.slice(0, this._maxMessageSize));

          let offset = this._maxMessageSize - 1;

          while (offset < byteLength) {
            array[offset] = PROTOCOL.CLIENT.JERRY_DEBUGGER_EVAL_PART;
            this._connection.send(array.slice(offset, offset + this._maxMessageSize));
            offset += this._maxMessageSize - 1;
          }
        }

        return DEBUGGER_RETURN_TYPES.COMMON.SUCCESS;
      }
    }

    return DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE;
  }

  /**
   * Sends one source file to the engine which should be executed.
   * If the source code message can not fit into one message this function will slice it
   * and send it in pieces to the engine.
   * This request can be sended to the engine only in source waiting mode.
   *
   * @param {integer} fileID The identifier of the file. This is needed to manage the context reset.
   * @param {string} fileName Name of the source file.
   * @param {string} fileSource The source of the file.
   * @return {DEBUGGER_RETURN_TYPES} SOURCE_SENDING.ALLOWED_IN_SOURCE_SENDING_MODE in case of invalid engine mode,
   *                                 SOURCE_SENDING.CONTEXT_RESET_SENDED in case of processed context reset,
   *                                 SOURCE_SENDING.SOURCE_SENDED in case of finished file sending and
   *                                 SOURCE_SENDING.MULTIPLE_SOURCE_SENDED in case of finsihed multiple sending.
   */
  sendClientSource(fileID, fileName, fileSource) {
    if (this._mode.current !== ENGINE_MODE.CLIENT_SOURCE) {
      return DEBUGGER_RETURN_TYPES.SOURCE_SENDING.ALLOWED_IN_SOURCE_SENDING_MODE;
    }

    this.engineMode = ENGINE_MODE.RUN;

    if (fileID === 0) {
      this.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTEXT_RESET]);
      return DEBUGGER_RETURN_TYPES.SOURCE_SENDING.CONTEXT_RESET_SENDED;
    }

    let array = this.stringToCesu8(`${fileName}\0${fileSource}`);
    const byteLength = array.byteLength;

    array[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_CLIENT_SOURCE;

    if (byteLength <= this._maxMessageSize) {
      this._connection.send(array);
      return DEBUGGER_RETURN_TYPES.SOURCE_SENDING.SOURCE_SENDED;
    }

    this._connection.send(array.slice(0, this._maxMessageSize));

    let offset = this._maxMessageSize - 1;

    while (offset < byteLength) {
      array[offset] = PROTOCOL.CLIENT.JERRY_DEBUGGER_CLIENT_SOURCE_PART;
      this._connection.send(array.slice(offset, offset + this._maxMessageSize));
      offset += this._maxMessageSize - 1;
    }

    return DEBUGGER_RETURN_TYPES.ALLOWED_IN_SOURCE_SENDING_MODE;
  }

  /**
   * This function will parse every breakpoint no matter if it's active or not.
   *
   * @return {array} Array of string which contains every breakpoint data.
   */
  dump() {
    let result = [];

    for (const i in this._functions) {
      if (this._functions.hasOwnProperty(i)) {
        const func = this._functions[i];
        let sourceName = func.sourceName;

        if (!sourceName) {
          sourceName = '<unknown>';
        }

        result.push(
          `Function 0x${Number(i).toString(16)} '${func.name}' at ${sourceName}:${func.line}, ${func.column}`
        );

        for (const j in func.lines) {
          if (func.lines.hasOwnProperty(j)) {
            let active = '';

            if (func.lines[j].active >= 0) {
              active = ` (active: ${func.lines[j].active})`;
            }

            result.push(`  Breakpoint line: ${j} at memory offset: ${func.lines[j].offset} ${active}`);
          }
        }
      }
    }

    return result;
  }

  /**
   * Returns the available breakpoint lines in the source code.
   *
   * @return {array} Array of the breakpoint line and name pair objects.
   */
  getBreakpointLines() {
    let result = [];
    for (const i in this._functions) {
      if (this._functions.hasOwnProperty(i)) {
        const func = this._functions[i];
        for (const j in func.lines) {
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
   * @return {string} Readable informations about the breakpoint.
   */
  breakpointToString(breakpoint) {
    let result = breakpoint.func.sourceName;

    if (!result) {
      result = '[unknown]';
    }

    result += `:${breakpoint.line}`;

    if (breakpoint.func.is_func) {
      const f = breakpoint.func;
      const position = {
        line: f.line,
        column: f.column,
      };

      result += ` (in ${(f.name ? f.name : 'function')}() at line:${position.line}, col:${position.column})`;
    }

    return result;
  }

  /**
   * Converts a pending breakpoint dataset into a readable format.
   *
   * @param {object} breakpoint The pending breakpoint dataset.
   * @return {string} The readable breakpoint informations.
   */
  pendingBreakpointToString(breakpoint) {
    return breakpoint.function ? `"${breakpoint.function}"` : `"${breakpoint.sourceName}:${breakpoint.line}"`;
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
    assert.ok(string != '');

    let byteLength = string.length;
    for (let chr of string) {
      const charcode = chr.charCodeAt(0);
      if (charcode >= 0x7ff) {
        byteLength ++;
      }

      if (charcode >= 0x7f) {
        byteLength++;
      }
    }

    const result = new Uint8Array(byteLength + 1 + 4);

    result[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_EVAL;

    this.setUint32(result, 1, byteLength);

    let offset = 5;

    for (let chr of string) {
      const charcode = chr.charCodeAt(0);

      if (charcode >= 0x7ff) {
        result[offset] = 0xe0 | (charcode >> 12);
        result[offset + 1] = 0x80 | ((charcode >> 6) & 0x3f);
        result[offset + 2] = 0x80 | (charcode & 0x3f);
        offset += 3;
      } else if (charcode >= 0x7f) {
        result[offset] = 0xc0 | (charcode >> 6);
        result[offset + 1] = 0x80 | (charcode & 0x3f);
      } else {
        result[offset] = charcode;
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

    for (const i in format) {
      if (format.hasOwnProperty(i)) {
        if (format[i] === 'B') {
          length++;
          continue;
        }

        if (format[i] === 'C') {
          length += this._cpointerSize;
          continue;
        }

        assert.ok(format[i] == 'I');

        length += 4;
      }
    }

    return length;
  }

  /**
   * Sends a release function byte message to the engine.
   *
   * @param {uitn8} message The byte message.
   */
  releaseFunction(message) {
    const byte_code_cp = this.decodeMessage('C', message, 1)[0];
    const func = this._functions[byte_code_cp];

    for (const i in func.lines) {
      if (func.lines.hasOwnProperty(i)) {
        this._lineList.set(i, this._lineList.get(i).filter(f => !Object.is(f, func)));

        const breakpoint = func.lines[i];

        assert.ok(i == breakpoint.line);

        if (breakpoint.index >= 0) {
          this._breakpoints.deleteActiveBreakpointByIndex(breakpoint.index);
        }
      }
    }

    delete this._functions[byte_code_cp];

    message[0] = PROTOCOL.CLIENT.JERRY_DEBUGGER_FREE_BYTE_CODE_CP;
    this._connection.send(message);
  }

}
