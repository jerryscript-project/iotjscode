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

import ParseSource from './parsesource';
import { JERRY_DEBUGGER_VERSION, PROTOCOL, ENGINE_MODE } from './debugger';
import assert from 'assert';
import { EventEmitter } from 'events';

export default class Connection {

  /**
   * Constructor.
   *
   * @param {object} debuggerObject The DebuggerClient module object.
   * @param {object} address Connection host address and host port.
   */
  constructor(debuggerObject, address) {
    this._backtrace = [];
    this._eventEmitter = new EventEmitter();

    this._debuggerObj = debuggerObject;

    this._parseObj = null;

    this._exceptionData = null;
    this._evalResult = null;
    this._outputResult = null;

    this._socket = new WebSocket(`ws://${address}/jerry-debugger`);
    this._socket.binaryType = 'arraybuffer';

    /**
     * The websocket onopen event handler.
     * This function will be called when the socket established the connection.
     *
     * @param {event} event The socket event.
     */
    this._socket.onopen = event => {
      this._eventEmitter.emit('open', [event]);
      this._debuggerObj.engineMode = ENGINE_MODE.RUN;
    };

    /**
     * The websocket onclose_and_error event handler.
     * This function will be called when the socket runs into an error.
     * This function will be called when we want to close the socket.
     *
     * @param {event} event The socket event.
     */
    this._socket.onclose = this._socket.onerror = event => {
      this._eventEmitter.emit('close', [event]);

      if (this._socket) {
        this._socket = null;
      }

      this._debuggerObj.engineMode = ENGINE_MODE.DISCONNECTED;
    };

    /**
     * The websocket onmessage event handler.
     * This function will be called when the socket got a message.
     *
     * @param {event} event The socket event. This contains the incoming data.
     */
    this._socket.onmessage = event => {
      const message = new Uint8Array(event.data);
      this._eventEmitter.emit('message', [event, message]);

      if (message.byteLength < 1) {
        this.abort('message too short.');
      }

      if (this._debuggerObj.cPointerSize === 0) {
        if (message[0] !== PROTOCOL.SERVER.JERRY_DEBUGGER_CONFIGURATION ||
            message.byteLength !== 5) {
          this.abort('the first message must be configuration.');
        }

        this._debuggerObj.maxMessageSize = message[1];
        this._debuggerObj.cPointerSize = message[2];
        this._debuggerObj.littleEndian = (message[3] != 0);
        this._debuggerObj.version = message[4];

        if (this._debuggerObj.cPointerSize !== 2 && this._debuggerObj.cPointerSize !== 4) {
          this.abort('compressed pointer must be 2 or 4 bytes long.');
        }

        if (this._debuggerObj.version !== JERRY_DEBUGGER_VERSION) {
          this.abort('Incorrect debugger version from target.');
        }

        return;
      }

      if (this._parseObj) {
        this._parseObj.receive(message);
        if (!this._parseObj.alive) {
          this._parseObj = null;
        }
        return;
      }

      switch (message[0]) {
        case PROTOCOL.SERVER.JERRY_DEBUGGER_PARSE_ERROR:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_BYTE_CODE_CP:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_PARSE_FUNCTION:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_LIST:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_END:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_NAME:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_SOURCE_CODE_NAME_END:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_FUNCTION_NAME:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_FUNCTION_NAME_END: {
          this._parseObj = new ParseSource(this._debuggerObj);
          this._parseObj.receive(message);
          if (!this._parseObj.alive) {
            this._parseObj = null;
          }
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_WAITING_AFTER_PARSE: {
          this._debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_PARSER_RESUME]);
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP: {
          this._debuggerObj.releaseFunction(message);
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_MEMSTATS_RECEIVE: {
          const messagedata = this._debuggerObj.decodeMessage('IIIII', message, 1);
          this._eventEmitter.emit('memStatReceive', [event, messagedata]);
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_HIT:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_HIT: {
          this._debuggerObj.engineMode = ENGINE_MODE.BREAKPOINT;

          const breakpointData = this._debuggerObj.decodeMessage('CI', message, 1);
          const breakpointRef = this._debuggerObj.getBreakpoint(breakpointData);
          const breakpoint = breakpointRef.breakpoint;
          const sourceName = breakpoint.func.sourceName;
          const source = this._debuggerObj.sources[sourceName];

          this._debuggerObj.breakpoints.lastHit = breakpoint;

          this._eventEmitter.emit('breakpointOrExceptionHit', [event, message, breakpoint, sourceName, source]);

          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_STR:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_STR_END: {
          this._exceptionData = this._debuggerObj.concatUint8Arrays(this._exceptionData, message);
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE_END: {

          for (let i = 1; i < message.byteLength; i += this._debuggerObj.cPointerSize + 4) {
            const breakpointData = this._debuggerObj.decodeMessage('CI', message, i);
            this._backtrace.push({
              frame: this._debuggerObj.backtraceFrame,
              data: this._debuggerObj.getBreakpoint(breakpointData).breakpoint,
            });
            this._debuggerObj.backtraceFrame = this._debuggerObj.backtraceFrame + 1;
          }

          if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE_END) {
            this._debuggerObj.backtraceFrame = 0;
            this._eventEmitter.emit('backtrace', [event, this._backtrace]);
            this._backtrace = [];
          }
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_RESULT:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_RESULT_END: {
          this._evalResult = this._debuggerObj.concatUint8Arrays(this._evalResult, message);
          const subType = this._evalResult[this._evalResult.length - 1];
          this._evalResult = this._evalResult.slice(0, -1);

          this._eventEmitter.emit('eval', [event, subType, this._evalResult]);

          this._evalResult = null;
          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT:
        case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT_END: {
          this._outputResult = this._debuggerObj.concatUint8Arrays(this._outputResult, message);

          if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT_END) {
            const subType = this._outputResult[this._outputResult.length - 1];

            this._outputResult = this._outputResult.slice(0, -1);

            this._eventEmitter.emit('output', [event, subType, this._outputResult]);

            this._outputResult = null;
          }

          return;
        }

        case PROTOCOL.SERVER.JERRY_DEBUGGER_WAIT_FOR_SOURCE: {
          this._debuggerObj.engineMode = ENGINE_MODE.CLIENT_SOURCE;
          this._eventEmitter.emit('waitForSource', [event]);
          return;
        }

        default: {
          this.abort('unexpected message.');
          this._eventEmitter.emit('unexpectedMessage', [event]);
          return;
        }
      }
    };
  }

  get exceptionData() {
    return this._exceptionData;
  }

  set exceptionData(data) {
    this._exceptionData = data;
  }

  /**
   * Connection related event handler.
   *
   * @param {string} event The selected event name.
   * @value "open" - Emitted on connection.
   * @value "close" - Emitted on close.
   * @value "abort" - Emitted on abort.
   * @value "message" - Emitted on message receive.
   * @value "memStatReceive" - Emitted on memory statistic receive.
   * @value "breakpointOrExceptionHit" - Emitted on breakpoint or expection hit.
   * @value "backtrace" - Emitted on backtrace receive.
   * @value "eval" - Emitted on eval result receive.
   * @value "output" - Emitted on output result receive.
   * @value "waitForSource" - Emitted on wait for source signal receive.
   * @value "unexpectedMessage" - Emitted in case of unexpected message.
   * @param {function} callback The event listener function.
   */
  on(event, callback) {
    this._eventEmitter.on(event, args => callback(...args));
  }

  /**
   * Closes the socket connection.
   */
  close() {
    this._socket.close();
    this._socket = null;
    this._parseObj = null;
  }

  /**
   * Aborts the connection and close the socket.
   *
   * @param {string} message The abort message.
   */
  abort(message) {
    assert.ok(this._socket);

    this.close();

    this._eventEmitter.emit('abort', [message]);

    throw new Error(message);
  }

  /**
   * Sends a message through the socket.
   *
   * @param {uint8} message The message data.
   */
  send(message) {
    this._socket.send(message);

    if (message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTINUE ||
        message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_STEP ||
        message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_NEXT) {
      this._debuggerObj.engineMode = ENGINE_MODE.RUN;
    }
  }
}
