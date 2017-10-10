/* Copyright 2017 Samsung Electronics Co., Ltd. and other contributors
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

/**
 * Contructor.
 *
 * @param {object} debuggerObject DebuggerClient module object.
 */
function ParseSource(debuggerObject) {
  if (!(this instanceof ParseSource)) {
    throw new TypeError("ParseSource constructor cannot be called as a function.");
  }

  this._debuggerObj = debuggerObject;

  this._alive = true;

  this._source = "";
  this._sourceData = null;
  this._sourceName = "";
  this._sourceNameData = null;
  this._functionName = null;
  this._stack = [{
    is_func: false,
    line: 1,
    column: 1,
    name: "",
    source: "",
    lines: [],
    offsets: []
  }];
  this._newFunctions = {};
}

/**
 * Returns the alive status of the module.
 *
 * @return {boolean} True if the module is alive, false otherwise.
 */
ParseSource.prototype.isAlive = function() {
  return this._alive;
}

/**
 * Sets the alive status of the module.
 *
 * @param {boolean} value True if the module is alive, false otherwise.
 */
ParseSource.prototype.setAlive = function(value) {
  this._alive = value;
}

/**
 * Process the incoming message source releated parts.
 *
 * @param {uint8} message The incoming message from the engine.
 */
ParseSource.prototype.receive = function(message) {
  switch (message[0]) {
    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_PARSE_ERROR:
    {
      /* Parse error occured in JerryScript. */
      this._alive = false;
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE:
    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE_END:
    {
      this._sourceData = this._debuggerObj.concatUint8Arrays(this._sourceData, message);

      if (message[0] == this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE_END) {
        this._source = this._debuggerObj.cesu8ToString(this._sourceData);
      }
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE_NAME:
    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE_NAME_END:
    {
      this._sourceNameData = this._debuggerObj.concatUint8Arrays(this._sourceNameData, message);

      if (message[0] == this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_SOURCE_CODE_NAME_END) {
        this._sourceName = this._debuggerObj.cesu8ToString(this._sourceNameData);
      }
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_FUNCTION_NAME:
    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_FUNCTION_NAME_END:
    {
      this._functionName = this._debuggerObj.concatUint8Arrays(this._functionName, message);
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_PARSE_FUNCTION:
    {
      var position = this._debuggerObj.decodeMessage("II", message, 1);

      this._stack.push({
        is_func: true,
        line: position[0],
        column: position[1],
        name: this._debuggerObj.cesu8ToString(this._functionName),
        source: this._source,
        sourceName: this._sourceName,
        lines: [],
        offsets: []
      });
      this._functionName = null;
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_BREAKPOINT_LIST:
    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST:
    {
      var array;

      if (message.byteLength < 1 + 4) {
        this._debuggerObj.abortConnection("message too short.");
      }

      if (message[0] == this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_BREAKPOINT_LIST) {
        array = this._stack[this._stack.length - 1].lines;
      } else {
        array = this._stack[this._stack.length - 1].offsets;
      }

      for (var i = 1; i < message.byteLength; i += 4) {
        array.push(this._debuggerObj.decodeMessage("I", message, i)[0]);
      }
      return;
    }

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_BYTE_CODE_CP:
    {
      var func = this._stack.pop();
      func.byte_code_cp = this._debuggerObj.decodeMessage("C", message, 1)[0];

      var lines = {};
      var offsets = {};

      func.firstBreakpointLine = func.lines[0];
      func.firstBreakpointOffset = func.offsets[0];

      for (var i = 0; i < func.lines.length; i++) {
        var breakpoint = { line: func.lines[i], offset: func.offsets[i], func: func, activeIndex: -1 };

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

    case this._debuggerObj.SERVER_PACKAGE.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP:
    {
      var byte_code_cp = this._debuggerObj.decodeMessage("C", message, 1)[0];

      if (byte_code_cp in this._newFunctions) {
        delete this._newFunctions[byte_code_cp];
      } else {
        this._debuggerObj.releaseFunction(message);
      }
      return;
    }

    default:
    {
      this._debuggerObj.abortConnection("unexpected message.");
      return;
    }
  }

  for (var i in this._newFunctions) {
    var func = this._newFunctions[i];

    this._debuggerObj.setFunctions(i, func);

    for (var j in func.lines) {
      this._debuggerObj.lineListInsert(j, func);
    }
  }

  this._alive = false;
}

export default ParseSource;
