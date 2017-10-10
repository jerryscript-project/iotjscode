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

import Multimap from './client-multimap';
import Connection from './client-connection';
import Util from './util';
import Logger from './logger';

/**
 * Packages sent by the server to the client.
 */
const SERVER_PACKAGE = {
  JERRY_DEBUGGER_CONFIGURATION : 1,
  JERRY_DEBUGGER_PARSE_ERROR : 2,
  JERRY_DEBUGGER_BYTE_CODE_CP : 3,
  JERRY_DEBUGGER_PARSE_FUNCTION : 4,
  JERRY_DEBUGGER_BREAKPOINT_LIST : 5,
  JERRY_DEBUGGER_BREAKPOINT_OFFSET_LIST : 6,
  JERRY_DEBUGGER_SOURCE_CODE : 7,
  JERRY_DEBUGGER_SOURCE_CODE_END : 8,
  JERRY_DEBUGGER_SOURCE_CODE_NAME : 9,
  JERRY_DEBUGGER_SOURCE_CODE_NAME_END : 10,
  JERRY_DEBUGGER_FUNCTION_NAME : 11,
  JERRY_DEBUGGER_FUNCTION_NAME_END : 12,
  JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP : 13,
  JERRY_DEBUGGER_MEMSTATS_RECEIVE : 14,
  JERRY_DEBUGGER_BREAKPOINT_HIT : 15,
  JERRY_DEBUGGER_EXCEPTION_HIT : 16,
  JERRY_DEBUGGER_EXCEPTION_STR : 17,
  JERRY_DEBUGGER_EXCEPTION_STR_END : 18,
  JERRY_DEBUGGER_BACKTRACE : 19,
  JERRY_DEBUGGER_BACKTRACE_END : 20,
  JERRY_DEBUGGER_EVAL_RESULT : 21,
  JERRY_DEBUGGER_EVAL_RESULT_END : 22,
  JERRY_DEBUGGER_WAIT_FOR_SOURCE : 23,
  JERRY_DEBUGGER_OUTPUT_RESULT : 24,
  JERRY_DEBUGGER_OUTPUT_RESULT_END : 25,

  JERRY_DEBUGGER_EVAL_OK : 1,
  JERRY_DEBUGGER_EVAL_ERROR : 2,

  JERRY_DEBUGGER_OUTPUT_OK : 1,
  JERRY_DEBUGGER_OUTPUT_WARNING : 2,
  JERRY_DEBUGGER_OUTPUT_ERROR : 3
};

/**
 * Packages sent by the client to the server.
 */
const CLIENT_PACKAGE = {
  JERRY_DEBUGGER_FREE_BYTE_CODE_CP : 1,
  JERRY_DEBUGGER_UPDATE_BREAKPOINT : 2,
  JERRY_DEBUGGER_EXCEPTION_CONFIG : 3,
  JERRY_DEBUGGER_MEMSTATS : 4,
  JERRY_DEBUGGER_STOP : 5,
  JERRY_DEBUGGER_CLIENT_SOURCE : 6,
  JERRY_DEBUGGER_CLIENT_SOURCE_PART : 7,
  JERRY_DEBUGGER_NO_MORE_SOURCES : 8,
  JERRY_DEBUGGER_CONTEXT_RESET : 9,
  JERRY_DEBUGGER_CONTINUE : 10,
  JERRY_DEBUGGER_STEP : 11,
  JERRY_DEBUGGER_NEXT : 12,
  JERRY_DEBUGGER_GET_BACKTRACE : 13,
  JERRY_DEBUGGER_EVAL : 14,
  JERRY_DEBUGGER_EVAL_PART : 15
};

/**
 * States of the JerryScript engine.
 * The available actions in the client are depends on these modes.
 */
const ENGINE_MODE = {
  DISCONNECTED : 0,
  RUN : 1,
  BREAKPOINT : 2,
  CLIENT_SOURCE : 3
};

/**
 * Contructor.
 *
 * @param {string} address Connection address (ip and port).
 * @param {object} session Session module object.
 * @param {object} surface Surface module object.
 * @param {object} chart MemoryChart module object.
 */
function DebuggerClient(address, session, surface, chart) {
  if (!(this instanceof DebuggerClient)) {
    throw new TypeError("DebuggerClient constructor cannot be called as a function.");
  }

  this._logger = new Logger($("#console-panel"));
  this._session = session;
  this._surface = surface;

  this._maxMessageSize = 0;
  this._cpointerSize = 0;
  this._littleEndian = true;
  this._functions = {};
  this._lineList = new Multimap();
  this._lastBreakpointHit = null;
  this._activeBreakpoints = {};
  this._nextBreakpointIndex = 1;
  this._pendingBreakpoints = [];
  this._backtraceFrame = 0;

  this._alive = false;
  this._mode = {
    current: ENGINE_MODE.DISCONNECTED,
    last: null
  };

  this.SERVER_PACKAGE = SERVER_PACKAGE;
  this.CLIENT_PACKAGE = CLIENT_PACKAGE;
  this.ENGINE_MODE = ENGINE_MODE;

  this._connection = new Connection(this, address, this._surface, this._session, chart);
}

/**
 * Getters and setters.
 */

DebuggerClient.prototype.getMaxMessageSize = function() {
  return this._maxMessageSize;
}

DebuggerClient.prototype.setMaxMessageSize = function(value) {
  this._maxMessageSize = value;
}

DebuggerClient.prototype.getCPointerSize = function() {
  return this._cpointerSize;
}

DebuggerClient.prototype.setCPointerSize = function(value) {
  this._cpointerSize = value;
}

DebuggerClient.prototype.isLittleEndian = function() {
  return this._littleEndian;
}

DebuggerClient.prototype.setLittleEndian = function(value) {
  this._littleEndian = value;
}

DebuggerClient.prototype.getActiveBreakpoints = function() {
  return this._activeBreakpoints;
}

DebuggerClient.prototype.getNextBreakpointIndex = function() {
  return this._nextBreakpointIndex;
}

DebuggerClient.prototype.getLastBreakpointHit = function() {
  return this._lastBreakpointHit;
}

DebuggerClient.prototype.setLastBreakpointHit = function(value) {
  this._lastBreakpointHit = value;
}

DebuggerClient.prototype.getPendingbreakpoints = function() {
  return this._pendingBreakpoints;
}

DebuggerClient.prototype.getBacktraceFrame = function() {
  return this._backtraceFrame;
}

DebuggerClient.prototype.setBacktraceFrame = function(value) {
  this._backtraceFrame = value;
}

DebuggerClient.prototype.setFunctions = function(key, value) {
  this._functions[key] = value;
}

DebuggerClient.prototype.lineListInsert = function(key, value) {
  this._lineList.insert(key, value);
}

DebuggerClient.prototype.getEngineMode = function() {
  return this._mode.current;
}

DebuggerClient.prototype.setEngineMode = function(mode) {
  this._mode.last = this._mode.current;
  this._mode.current = mode;
}

/**
 * Aborts the sockeet connection through the connection object.
 *
 * @param {string} message The abort message.
 */
DebuggerClient.prototype.abortConnection = function(message) {
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
DebuggerClient.prototype.concatUint8Arrays = function(baseArray, nextArray) {
  if (nextArray.byteLength <= 1) {
    /* Nothing to append. */
    return baseArray;
  }

  if (!baseArray) {
    /* Cut the first byte (opcode). */
    return nextArray.slice(1);
  }

  var baseLength = baseArray.byteLength;
  var nextLength = nextArray.byteLength - 1;

  var result = new Uint8Array(baseLength + nextLength);
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
DebuggerClient.prototype.cesu8ToString = function(array) {
  if (!array) {
    return "";
  }

  var length = array.byteLength;

  var i = 0;
  var result = "";

  while (i < length) {
    var chr = array[i];

    ++i;

    if (chr >= 0x7f)   {
      if (chr & 0x20) {
        /* Three byte long character. */
        chr = ((chr & 0xf) << 12) | ((array[i] & 0x3f) << 6) | (array[i + 1] & 0x3f);
        i += 2;
      } else {
        /* Two byte long character. */
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
DebuggerClient.prototype.decodeMessage = function(format, message, offset) {
  var result = []
  var value;

  if (!offset) {
    offset = 0;
  }

  if (offset + this.getFormatSize(format) > message.byteLength) {
    this._connection.abort("received message too short.");
  }

  for (var i = 0; i < format.length; i++) {
    if (format[i] == "B") {
      result.push(message[offset])
      offset++;
      continue;
    }

    if (format[i] == "C" && this._cpointerSize == 2) {
      if (this._littleEndian) {
        value = message[offset] | (message[offset + 1] << 8);
      } else {
        value = (message[offset] << 8) | message[offset + 1];
      }

      result.push(value);
      offset += 2;
      continue;
    }

    Util.assert(format[i] == "I" || (format[i] == "C" && this._cpointerSize == 4));

    if (this._littleEndian) {
      value = (message[offset] | (message[offset + 1] << 8)
                | (message[offset + 2] << 16) | (message[offset + 3] << 24));
    } else {
      value = ((message[offset] << 24) | (message[offset + 1] << 16)
                | (message[offset + 2] << 8) | message[offset + 3] << 24);
    }

    result.push(value);
    offset += 4;
  }

  return result;
}

/**
 * Encode an outgoing message and sends after the encoding is completed.
 * Format: B=byte I=int32 C=cpointer.
 *
 * @param {char} format Format type.
 * @param {array} values The encrypted values.
 */
DebuggerClient.prototype.encodeMessage = function(format, values) {
  var length = this.getFormatSize(format);

  var message = new Uint8Array(length);

  var offset = 0;

  for (var i = 0; i < format.length; i++) {
    var value = values[i];

    if (format[i] == "B") {
      message[offset] = value;
      offset++;
      continue;
    }

    if (format[i] == "C" && this._cpointerSize == 2) {
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

  this._connection.send(message);
}

/**
 * Returns a single breakpoint object.
 *
 * @param {array} breakpointData Data about the breakpoint.
 * @return {object} A single breakpoint object or an empty object.
 */
DebuggerClient.prototype.getBreakpoint = function(breakpointData) {
  var returnValue = {};
  var func = this._functions[breakpointData[0]];
  var offset = breakpointData[1];

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

  for (var current_offset in func.offsets) {
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
DebuggerClient.prototype.setBreakpoint = function(str, pending) {
  let line = /^(.+):([1-9][0-9]*)$/.exec(str);
  var found = false;

  if (line) {
    var functionList = this._lineList.get(line[2]);

    for (var i = 0; i < functionList.length; ++i) {
      var func = functionList[i];
      var sourceName = func.sourceName;

      if (sourceName == line[1]
          || sourceName.endsWith("/" + line[1])
          || sourceName.endsWith("\\" + line[1])) {
        this.insertBreakpoint(func.lines[line[2]], this);
        found = true;
      }
    }
  } else {
    for (var i in this._functions) {
      var func = this._functions[i];

      if (func.name == str) {
        this.insertBreakpoint(func.lines[func.firstBreakpointLine], this);
        found = true;
      }
    }
  }
  if (!found) {
    this._logger.info("Breakpoint not found");
    if (pending) {
      if (line) {
        this._pendingBreakpoints.push(Number(line[2]));
        this._logger.info("Pending breakpoint index: " + line[0] + " added");
      } else {
        this._pendingBreakpoints.push(str);
        this._logger.info("Pending breakpoint function name: " + str + " added");
      }
    }
  }
}

/**
 * Sends the exeption catch configuration byte to the engine.
 *
 * @param {boolean} enable True if the exeption catch is enabled, false otherwise.
 */
DebuggerClient.prototype.sendExceptionConfig = function(enable) {
  if (enable == "") {
    this._logger.error("Argument required", true);
    return;
  }

  if (enable == 1) {
    this._logger.info("Stop at exception enabled");
  } else if (enable == 0) {
    this._logger.info("Stop at exception disabled");
  } else {
    this._logger.info("Invalid input. Usage 1: [Enable] or 0: [Disable].");
    return;
  }

  encodeMessage("BB", [ CLIENT_PACKAGE.JERRY_DEBUGGER_EXCEPTION_CONFIG, enable ]);
}

/**
 * Inserts a breakpoint and updates the breakpoints status in the engine.
 *
 * @param {object} breakpoint Single breakpoint which will be inserted.
 */
DebuggerClient.prototype.insertBreakpoint = function(breakpoint) {
  if (breakpoint.activeIndex < 0)
  {
    breakpoint.activeIndex = this._nextBreakpointIndex;
    this._activeBreakpoints[this._nextBreakpointIndex] = breakpoint;
    this._nextBreakpointIndex++;

    var values = [ CLIENT_PACKAGE.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
                    1,
                    breakpoint.func.byte_code_cp,
                    breakpoint.offset ];

    this.encodeMessage("BBCI", values);
  }

  this._logger.info("Breakpoint " + breakpoint.activeIndex + " at " + this.breakpointToString(breakpoint));
  this._surface.updateBreakpointsPanel();
}

/**
 * Removes a breakpoint from the active breakpoints list and updates the engine.
 *
 * @param {integer} index Index's of the breakpoint.
 */
DebuggerClient.prototype.deleteBreakpoint = function(index) {
  let breakpoint = this._activeBreakpoints[index];

  if (index == "all") {
    var found = false;

    for (var i in this._activeBreakpoints) {
      delete this._activeBreakpoints[i];
      found = true;
    }

    if (!found) {
      this._logger.info("No active breakpoints.")
    }
  } else if (!breakpoint) {
    this._logger.error("No breakpoint found with index " + index, true);
    return;
  }

  Util.assert(breakpoint.activeIndex == index);

  delete this._activeBreakpoints[index];
  breakpoint.activeIndex = -1;

  var values = [ CLIENT_PACKAGE.JERRY_DEBUGGER_UPDATE_BREAKPOINT,
                  0,
                  breakpoint.func.byte_code_cp,
                  breakpoint.offset ];

  this.encodeMessage("BBCI", values);

  this._logger.info("Breakpoint " + index + " is deleted.");
}

/**
 * Removes a single pending breakpoint from the pending list.
 *
 * @param {integer} index The index's of the pending breakpoint.
 */
DebuggerClient.prototype.deletePendingBreakpoint = function(index) {
  if (index >= this._pendingBreakpoints.length) {
    this._logger.info("Pending breakpoint not found");
  } else {
    this._pendingBreakpoints.splice(index, 1);
    this._logger.info("Pending breakpoint " + index + " is deleted.");
  }
}

/**
 * Lists the active breakpoint into the logger panel.
 */
DebuggerClient.prototype.listBreakpoints = function() {
  this._logger.info("List of active breakpoints:");
  var found = false;

  for (var i in this._activeBreakpoints) {
    this._logger.info("  breakpoint " + i + " at " + this.breakpointToString(this._activeBreakpoints[i]));
    found = true;
  }

  if (!found) {
    this._logger.info("  no active breakpoints");
  }

  if (this._pendingBreakpoints.length != 0) {
    this._logger.info("List of pending breakpoints:");
    for (var i in this._pendingBreakpoints) {
      this._logger.info("  pending breakpoint " + i + " at " + this._pendingBreakpoints[i]);
    }
  } else {
    this._logger.info("No pending breakpoints");
  }
}

/**
 * Sends the execution resume byte message to the engine.
 *
 * @param {CLIENT_PACKAGE} command The execution resume package command.s
 */
DebuggerClient.prototype.sendResumeExec = function(command) {
  if (this._mode.current != ENGINE_MODE.BREAKPOINT) {
    this._logger.error("This command is allowed only if JavaScript execution is stopped at a breakpoint.");
    return;
  }

  this.encodeMessage("B", [ command ]);

  this._lastBreakpointHit = null;
}

/**
 * Sends the backtrace call byte message to the engine.
 *
 * @param {integer} depth Depth of the backtrace frames.
 */
DebuggerClient.prototype.sendGetBacktrace = function(depth) {
  if (this._mode.current != ENGINE_MODE.BREAKPOINT) {
    this._logger.error("This command is allowed only if JavaScript execution is stopped at a breakpoint.", true);
    return;
  }

  this.encodeMessage("BI", [ CLIENT_PACKAGE.JERRY_DEBUGGER_GET_BACKTRACE, max_depth ]);

  this._logger.info("Backtrace:");
}

/**
 * Sends an eval message to the engine which should be evaluated.
 * If the eval message can not fit into one message this function will slice that
 * and sends that into pieces to the engine.
 *
 * @param {string} str The eval code string.
 */
DebuggerClient.prototype.sendEval = function(str) {
  if (this._mode.current != ENGINE_MODE.BREAKPOINT) {
    this._logger.error("This command is allowed only if JavaScript execution is stopped at a breakpoint.", true);
    return;
  }

  if (str == "") {
    this._logger.error("Argument required", true);
    return;
  }

  var array = this.stringToCesu8(str);
  var byteLength = array.byteLength;

  if (byteLength <= this._maxMessageSize) {
    this._connection.send(array);
    return;
  }

  this._connection.send(array.slice(0, this._maxMessageSize));

  var offset = this._maxMessageSize - 1;

  while (offset < byteLength) {
    array[offset] = CLIENT_PACKAGE.JERRY_DEBUGGER_EVAL_PART;
    this._connection.send(array.slice(offset, offset + this._maxMessageSize));
    offset += this._maxMessageSize - 1;
  }
}

/**
 * Sends one or more source file to the engine which should be executed.
 * If the source code message can not fit into one message this function will slice that
 * and sends that into pieces to the engine.
 */
DebuggerClient.prototype.sendClientSource = function() {
  if (this._mode.current != ENGINE_MODE.CLIENT_SOURCE) {
    this._logger.error("This command is allowed only if the engine is waiting for a source.", true);
    return;
  }

  if (!this._session.getUploadList().length || !this._session.isUploadStarted()) {
    this._logger.info("The engine is waiting for a source.", true);
    return;
  }

  this.setEngineMode(ENGINE_MODE.RUN);

  var sid = this._session.getUploadList()[0];
  if (sid == 0) {
    this.encodeMessage ("B", [CLIENT_PACKAGE.JERRY_DEBUGGER_CONTEXT_RESET]);
    this._session.shiftUploadList();
    this._session.setContextReset(true);
    this._surface.changeUploadColor(this._surface.COLOR.GREEN, sid);
    this._session.allowUploadAndRun(false);
    return;
  }

  // Turn on the action buttons and turn off run button.
  this._surface.disableActionButtons(false);

  var array = this.stringToCesu8(this._session.getFileNameById(sid) + "\0" + this._session.getFileSessionById(sid));
  var byteLength = array.byteLength;

  array[0] = CLIENT_PACKAGE.JERRY_DEBUGGER_CLIENT_SOURCE;

  if (byteLength <= this._maxMessageSize) {
    this._connection.send(array);
    this._session.shiftUploadList();
    this._session.allowUploadAndRun(false);
    return;
  }

  this._connection.send(array.slice(0, this._maxMessageSize));

  var offset = this._maxMessageSize - 1;

  while (offset < byteLength) {
    array[offset] = CLIENT_PACKAGE.JERRY_DEBUGGER_CLIENT_SOURCE_PART;
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
DebuggerClient.prototype.printSource = function() {
  if (this._lastBreakpointHit) {
    this._logger.info(this._lastBreakpointHit.func.source);
  }
}

/**
 * Prints every information about the breakpoints into the logger panel.
 * Thiw function will print every breakpoint no matter that is an actove or not.
 */
DebuggerClient.prototype.dump = function() {
  for (var i in this._functions) {
    var func = this._functions[i];
    var sourceName = func.sourceName;

    if (!sourceName) {
      sourceName = "<unknown>";
    }

    this._logger.info("Function 0x"
                + Number(i).toString(16)
                + " '"
                + func.name
                + "' at "
                + sourceName
                + ":"
                + func.line
                + ","
                + func.column);

    for (var j in func.lines) {
      var active = "";

      if (func.lines[j].active >= 0) {
        active = " (active: " + func.lines[j].active + ")";
      }

      this._logger.info("  Breakpoint line: " + j + " at memory offset: " + func.lines[j].offset + active);
    }
  }
}

/**
 * Returns the available breakpoint lines in the source code.
 *
 * @return {array} Array of the breakpoint line and name pair objects.
 */
DebuggerClient.prototype.getBreakpointLines = function() {
  var result = [];
  for (var i in this._functions) {
    var func = this._functions[i];
    for (var j in func.lines) {
      result.push( {
        line: parseInt(j),
        sourceName: func.sourceName
      });
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
DebuggerClient.prototype.breakpointToString = function(breakpoint) {
  var name = breakpoint.func.name;

  var result = breakpoint.func.sourceName;

  if (!result) {
    result = "[unknown]";
  }

  result += ":" + breakpoint.line;

  if (breakpoint.func.is_func) {
    result += " (in "
              + (breakpoint.func.name ? breakpoint.func.name : "function")
              + "() at line:"
              + breakpoint.func.line
              + ", col:"
              + breakpoint.func.column
              + ")";
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
DebuggerClient.prototype.setUint32 = function(array, offset, value) {
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
DebuggerClient.prototype.stringToCesu8 = function(string) {
  Util.assert(string != "");

  var length = string.length;
  var byteLength = length;

  for (var i = 0; i < length; i++) {
    var chr = string.charCodeAt(i);

    if (chr >= 0x7ff) {
      byteLength ++;
    }

    if (chr >= 0x7f) {
      byteLength++;
    }
  }

  var result = new Uint8Array(byteLength + 1 + 4);

  result[0] = CLIENT_PACKAGE.JERRY_DEBUGGER_EVAL;

  this.setUint32(result, 1, byteLength);

  var offset = 5;

  for (var i = 0; i < length; i++) {
    var chr = string.charCodeAt(i);

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
DebuggerClient.prototype.getFormatSize = function(format) {
  var length = 0;

  for (var i = 0; i < format.length; i++) {
    if (format[i] == "B") {
      length++;
      continue;
    }

    if (format[i] == "C") {
      length += this._cpointerSize;
      continue;
    }

    Util.assert(format[i] == "I")

    length += 4;
  }

  return length;
}

/**
 * Sends a release function byte message to the engine.
 *
 * @param {uitn8} message The byte message.
 */
DebuggerClient.prototype.releaseFunction = function(message) {
  var byte_code_cp = this.decodeMessage("C", message, 1)[0];
  var func = this._functions[byte_code_cp];

  for (var i in func.lines) {
    this._lineList.delete(i, func);

    var breakpoint = func.lines[i];

    Util.assert(i == breakpoint.line);

    if (breakpoint.activeIndex >= 0) {
      delete this._activeBreakpoints[breakpoint.activeIndex];
    }
  }

  delete this._functions[byte_code_cp];

  message[0] = CLIENT_PACKAGE.JERRY_DEBUGGER_FREE_BYTE_CODE_CP;
  this._connection.send(message);
}

export default DebuggerClient;
