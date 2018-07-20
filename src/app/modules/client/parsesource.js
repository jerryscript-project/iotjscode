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

import { PROTOCOL } from './debugger';

export default class ParseSource {

  /**
   * Constructor.
   *
   * @param {object} debuggerObject DebuggerClient module object.
   */
  constructor(debuggerObject) {
    this._debuggerObj = debuggerObject;

    this._alive = true;

    this._source = '';
    this._sourceData = null;
    this._sourceName = '';
    this._sourceNameData = null;
    this._functionName = null;
    this._stack = [{
      is_func: false,
      line: 1,
      column: 1,
      name: '',
      source: '',
      lines: [],
      offsets: [],
    }];
    this._newFunctions = {};
  }

  /**
   * Returns the alive status of the module.
   *
   * @return {boolean} True if the module is alive, false otherwise.
   */
  get alive() {
    return this._alive;
  }

  /**
   * Process the incoming message's source releated parts.
   *
   * @param {uint8} message The incoming message from the engine.
   */
  receive(message) {
    switch (message[0]) {
      case PROTOCOL.SERVER.JERRY_DEBUGGER_PARSE_ERROR: {
        /* Parse error occured in JerryScript. */
        this._alive = false;
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE:
      case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_END: {
        this._sourceData = this._debuggerObj.concatUint8Arrays(this._sourceData, message);

        if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_END) {
          this._source = this._debuggerObj.cesu8ToString(this._sourceData);

          this._debuggerObj.sources = {
            key: this._sourceName,
            value: this._source,
          };
        }
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_NAME:
      case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_NAME_END: {
        this._sourceNameData = this._debuggerObj.concatUint8Arrays(this._sourceNameData, message);

        if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_NAME_END) {
          this._sourceName = this._debuggerObj.cesu8ToString(this._sourceNameData);
        }
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_FUNCTION_NAME:
      case PROTOCOL.SERVER.JERRY_DEBUGGER_FUNCTION_NAME_END: {
        this._functionName = this._debuggerObj.concatUint8Arrays(this._functionName, message);
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_PARSE_FUNCTION: {
        const position = this._debuggerObj.decodeMessage('II', message, 1);

        this._stack.push({
          is_func: true,
          line: position[0],
          column: position[1],
          name: this._debuggerObj.cesu8ToString(this._functionName),
          source: this._source,
          sourceName: this._sourceName,
          lines: [],
          offsets: [],
        });
        this._functionName = null;
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_LIST:
      case PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST: {
        let array;

        if (message.byteLength < 1 + 4) {
          this._debuggerObj.connection.abort('message too short.');
        }

        if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_LIST) {
          array = this._stack[this._stack.length - 1].lines;
        } else {
          array = this._stack[this._stack.length - 1].offsets;
        }

        for (let i = 1; i < message.byteLength; i += 4) {
          array.push(this._debuggerObj.decodeMessage('I', message, i)[0]);
        }
        return;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_BYTE_CODE_CP: {
        const func = this._stack.pop();
        func.byte_code_cp = this._debuggerObj.decodeMessage('C', message, 1)[0];

        const lines = {};
        const offsets = {};

        func.firstBreakpointLine = func.lines[0];
        func.firstBreakpointOffset = func.offsets[0];

        for (let i = 0; i < func.lines.length; i++) {
          const breakpoint = { line: func.lines[i], offset: func.offsets[i], func: func, index: -1 };

          lines[breakpoint.line] = breakpoint;
          offsets[breakpoint.offset] = breakpoint;
        }

        func.lines = lines;
        func.offsets = offsets;

        this._newFunctions[func.byte_code_cp] = func;

        if (this._stack.length > 0) {
          return;
        }

        func.source = this._source.split(/\r\n|[\r\n]/);
        func.sourceName = this._sourceName;
        break;
      }

      case PROTOCOL.SERVER.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP: {
        const byte_code_cp = this._debuggerObj.decodeMessage('C', message, 1)[0];

        if (byte_code_cp in this._newFunctions) {
          delete this._newFunctions[byte_code_cp];
        } else {
          this._debuggerObj.releaseFunction(message);
        }
        return;
      }

      default: {
        this._debuggerObj.connection.abort('unexpected message.');
        break;
      }
    }

    for (const i in this._newFunctions) {
      if (this._newFunctions.hasOwnProperty(i)) {
        const func = this._newFunctions[i];

        this._debuggerObj.functions = {
          key: i,
          value: func,
        };

        for (const j in func.lines) {
          if (func.lines.hasOwnProperty(j)) {
            const value = this._debuggerObj.lineList.get(j);
            this._debuggerObj.lineList.set(j, value ? [...value, func] : [func]);
          }
        }
      }
    }

    const pending = this._debuggerObj.breakpoints.pendingBreakpoints;
    const functions = this._debuggerObj.functions;
    let sourceLines = 0;

    if (pending.length) {
      pending.forEach((point, index) => {
        Object.keys(functions).forEach(f => {
          if (functions[f].sourceName === point.sourceName) {
            sourceLines = functions[f].source.length;
          }
        });

        if (point.line) {
          if (point.line <= sourceLines) {
            if (this._debuggerObj.setBreakpoint(`${point.sourceName}:${point.line}`, true)) {
              this._debuggerObj.deletePendingBreakpoint(index);
            }
          }
        } else if (point.function) {
          if (this._debuggerObj.setBreakpoint(point.function, true)) {
            this._debuggerObj.deletePendingBreakpoint(index);
          }
        }
      });
    } else {
      this._debuggerObj.sendParserConfig(0);
    }

    this._alive = false;
  }
}
