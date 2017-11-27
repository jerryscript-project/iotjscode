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

import ParseSource from './client-parsesource';
import { PROTOCOL, ENGINE_MODE } from './client-debugger';
import Util from './util';
import Logger from './logger';

export default class Connection {

  /**
   * Contructor.
   *
   * @param {object} debuggerObject The DebuggerClient module object.
   * @param {object} address Connection host address and host port.
   * @param {object} surface The Surface module object.
   * @param {object} session The Session module object.
   * @param {object} chart The MemoryChart module object.
   */
  constructor(debuggerObject, address, surface, session, chart) {
    this._debuggerObj = debuggerObject;
    this._surface = surface;
    this._session = session;
    this._chart = chart;
    this._output = new Logger($('#output-panel'));
    this._logger = new Logger($('#console-panel'));

    this._parseObj = null;

    this._exceptionData = null;
    this._evalResult = null;
    this._outputResult = null;

    this._socket = new WebSocket(`ws://${address}/jerry-debugger`);
    this._socket.binaryType = 'arraybuffer';
    this._socket.abortConnection = this.abort;

    this._socket.onopen = onopen.bind(this);
    this._socket.onmessage = onmessage.bind(this);
    this._socket.onclose = this._socket.onerror = onclose_and_error.bind(this);

    this._logger.info(`ws://${address}/jerry-debugger`);
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
    Util.assert(this._socket);

    this.close();

    this._logger.error(`Abort connection: ${message}`, true);
    throw new Error(message);
  }

  /**
   * Sens a message through the socket.
   *
   * @param {uint8} message The message data.
   */
  send(message) {
    this._socket.send(message);

    if (message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTINUE ||
        message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_STEP ||
        message[0] === PROTOCOL.CLIENT.JERRY_DEBUGGER_NEXT) {
      this._debuggerObj.setEngineMode(ENGINE_MODE.RUN);
    }
  }
}

/**
 * The socket onopen event handler.
 * This function will be called when the socket estabilished the connection.
 */
function onopen() {
  this._logger.info('Connection created.');

  this._debuggerObj.setEngineMode(ENGINE_MODE.RUN);

  if (this._surface.getPanelProperty('chart.active')) {
    this._surface.toggleButton(true, 'chart-record-button');
  }

  if (this._surface.getPanelProperty('run.active')) {
    this._surface.updateRunPanel(this._surface.RUN_UPDATE_TYPE.ALL, this._debuggerObj, this._session);
  }

  if (this._surface.getPanelProperty('watch.active')) {
    this._surface.updateWatchPanelButtons(this._debuggerObj);
  }

  this._surface.disableActionButtons(false);
  this._surface.toggleButton(false, 'connect-to-button');
}

/**
 * The socket onclose_and_error event handler.
 * This function will be called when the socket run into an error.
 * this function will be called when the we want to close the socket.
 */
function onclose_and_error() {
  if (this._socket) {
    this._socket = null;
    this._logger.info('Connection closed.');
  }

  this._debuggerObj.setEngineMode(ENGINE_MODE.DISCONNECTED);

  if (this._surface.getPanelProperty('chart.active')) {
    this._chart.disableChartButtons();
    if (this._chart.containsData()) {
      this._surface.toggleButton(true, 'chart-reset-button');
    }
  }

  if (this._surface.getPanelProperty('watch.active')) {
    this._surface.updateWatchPanelButtons(this._debuggerObj);
    this._session.neutralizeWatchExpressions();
  }

  if (this._session.isUploadStarted()) {
    this._session.setUploadStarted(false);
  }

  // Reset the editor.
  this._session.reset();
  this._surface.reset();
  this._surface.disableActionButtons(true);
  this._surface.toggleButton(true, 'connect-to-button');
  this._surface.continueStopButtonState(this._surface.CSICON.CONTINUE);

  if (this._session.isContextReset()) {
    this._session.setContextReset(false);

    // Try to reconnect once.
    setTimeout(() => {
      $('#connect-to-button').trigger('click');
    }, 1000);
  }
}

/**
 * The socket onmessage event handler.
 * This function will be called when the socket got a message.
 *
 * @param {event} event The socket event. This contains the incoming data.
 */
function onmessage(event) {
  let message = new Uint8Array(event.data);

  if (message.byteLength < 1) {
    this._socket.abortConnection('message too short.');
  }

  if (this._debuggerObj.getCPointerSize() === 0) {
    if (message[0] !== PROTOCOL.SERVER.JERRY_DEBUGGER_CONFIGURATION ||
        message.byteLength !== 4) {
      this._socket.abortConnection('the first message must be configuration.');
    }

    this._debuggerObj.setMaxMessageSize(message[1]);
    this._debuggerObj.setCPointerSize(message[2]);
    this._debuggerObj.setLittleEndian((message[3] != 0));

    if (this._debuggerObj.getCPointerSize() !== 2 && this._debuggerObj.getCPointerSize() !== 4) {
      this._socket.abortConnection('compressed pointer must be 2 or 4 byte long.');
    }

    return;
  }

  if (this._parseObj) {
    this._parseObj.receive(message);
    if (!this._parseObj.isAlive()) {
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
      if (!this._parseObj.isAlive()) {
        this._parseObj = null;
      }
      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_RELEASE_BYTE_CODE_CP: {
      this._debuggerObj.releaseFunction(message);
      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_MEMSTATS_RECEIVE: {
      let messagedata = this._debuggerObj.decodeMessage('IIIII', message, 1);

      if (this._chart.isRecordStarted()) {
        this._chart.startRecord(false);
        this._chart.setChartActive(true);

        this._surface.toggleButton(false, 'chart-reset-button');
        this._surface.toggleButton(true, 'chart-stop-button');
        this._surface.toggleButton(false, 'chart-record-button');
        $('#chart-record-button').css('background-color', '#16e016');
      }

      if (this._session.getBreakpointInfoToChart() && this._chart.isChartActive()) {
        let breakpointLineToChart = 'ln: ' + this._session.getBreakpointInfoToChart().split(':')[1].split(' ')[0];

        if (this._debuggerObj.getEngineMode() === ENGINE_MODE.BREAKPOINT) {
          this._chart.addNewDataPoints(
            messagedata,
            '#' +
            this._session.getBreakpointInfoToChart().split(':')[1].split(' ')[0] + ': ' +
            new Date().toISOString().slice(14, 21)
          );
        } else {
          this._chart.addNewDataPoints(messagedata, breakpointLineToChart);
        }
      }

      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_BREAKPOINT_HIT:
    case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_HIT: {
      this._debuggerObj.setEngineMode(ENGINE_MODE.BREAKPOINT);

      let breakpointData = this._debuggerObj.decodeMessage('CI', message, 1);
      let breakpointRef = this._debuggerObj.getBreakpoint(breakpointData);
      let breakpoint = breakpointRef.breakpoint;
      let breakpointInfo = '';
      let sourceName = breakpoint.func.sourceName;
      let source = this._debuggerObj.getSources()[sourceName];

      this._debuggerObj.setLastBreakpointHit(breakpoint);

      if (breakpoint.offset.activeIndex >= 0) {
        breakpointInfo = ` breakpoint:${breakpoint.offset.activeIndex} `;
      }

      this._logger.info(
        `Stopped ${(breakpoint.at ? 'at ' : 'around ')}` +
        breakpointInfo +
        this._debuggerObj.breakpointToString(breakpoint)
      );

      this._session.setLastBreakpoint(breakpoint);
      this._surface.continueStopButtonState(this._surface.CSICON.CONTINUE);
      this._surface.disableActionButtons(false);

      // Source load and reload from Jerry.
      if (sourceName !== '') {
        if (!this._session.fileNameCheck(sourceName, true)) {
          let groupID = `gid-name-${sourceName.replace(/\//g, '-').replace(/\./g, '-')}-${sourceName.length}`;

          this._logger.debug(
            `The ${sourceName} file is missing: `,
            `<div class="btn btn-xs btn-default load-from-jerry ${groupID}">Load from Jerry</div>`,
            true
          );

          $('.load-from-jerry').on('click', (e) => {
            this._session.createNewFile(sourceName.split('/').pop(), source, 1, true);

            if (this._surface.getPanelProperty('run.active')) {
              this._surface.updateRunPanel(this._surface.RUN_UPDATE_TYPE.ALL, this._debuggerObj, this._session);
            }

            $(`.${groupID}`).addClass('disabled');
            $(`.${groupID}`).unbind('click');
            e.stopImmediatePropagation();
          });
        } else {
          if (!this._session.fileContentCheck(sourceName, source)) {
            let groupID = `gid-source-${sourceName.replace(/\//g, '-').replace(/\./g, '-')}-${source.length}`;

            this._logger.debug(
              `The opened ${sourceName} source is not match with the source on the device! `,
              `<div class="btn btn-xs btn-default reload-from-jerry ${groupID}">Reload from Jerry</div>`,
              true
            );

            $('.reload-from-jerry').on('click', (e) => {
              this._session.resetFileContent(sourceName.split('/').pop(), source);

              $(`.${groupID}`).addClass('disabled');
              $(`.${groupID}`).unbind('click');
              e.stopImmediatePropagation();
            });
          }
        }
      }

      // Switch to the the right session.
      let sID = this._session.getFileIdByName(breakpoint.func.sourceName);
      if (sID !== undefined && sID !== this._session.getActiveID()) {
        // Change the session.
        this._session.switchFile(sID);
      }

      // After we switched to the decent file/sesison show the exception hint (if exists).
      if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_HIT) {
        this._session.highlightLine(this._session.HIGHLIGHT_TYPE.EXCEPTION, breakpoint.line - 1);
        this._logger.error('Exception throw detected!');

        if (this._exceptionData) {
          this._logger.error('Exception hint: ' + this._debuggerObj.cesu8ToString(this._exceptionData), true);
          this._exceptionData = null;
        }
      } else {
        // Hightlight the execute line in the correct session.
        if (sID !== undefined && sID === this._session.getActiveID()) {
          this._session.highlightLine(this._session.HIGHLIGHT_TYPE.EXECUTE, breakpoint.line - 1);
          this._session.markBreakpointGutters(this._debuggerObj);
        }
      }

      // Show the backtrace on the panel.
      if (this._surface.getPanelProperty('backtrace.active')) {
        this._debuggerObj.getBacktrace(this._debuggerObj);
      }

      // Updates the watched expression list if the watch panel activated.
      if (this._surface.getPanelProperty('watch.active')) {
        this._session.updateWatchExpressions(this._debuggerObj);
      }

      // Add breakpoint information to chart
      if (this._surface.getPanelProperty('chart.active')) {
        for (let i in this._debuggerObj.getActiveBreakpoints()) {
          if (this._debuggerObj.getActiveBreakpoints()[i].line ===
              this._debuggerObj.breakpointToString(breakpoint).split(':')[1].split(' ')[0]) {
            this._surface.stopCommand();
            return;
          }
        }

        this._debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_MEMSTATS]);
        this._session.setBreakpointInfoToChart(this._debuggerObj.breakpointToString(breakpoint));
      }

      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_STR:
    case PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_STR_END: {
      this._exceptionData = this._debuggerObj.concatUint8Arrays(this._exceptionData, message);
      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE:
    case PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE_END: {
      Util.clearElement($('#backtrace-table-body'));

      for (let i = 1; i < message.byteLength; i += this._debuggerObj.getCPointerSize() + 4) {
        let breakpointData = this._debuggerObj.decodeMessage('CI', message, i);

        this._surface.updateBacktracePanel(
          this._debuggerObj.getBacktraceFrame(),
          this._debuggerObj.getBreakpoint(breakpointData).breakpoint
        );

        this._debuggerObj.setBacktraceFrame(this._debuggerObj.getBacktraceFrame() + 1);
      }

      if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_BACKTRACE_END) {
        this._debuggerObj.setBacktraceFrame(0);
      }

      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_RESULT:
    case PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_RESULT_END: {
      this._evalResult = this._debuggerObj.concatUint8Arrays(this._evalResult, message);

      let subType = this._evalResult[this._evalResult.length - 1];

      this._evalResult = this._evalResult.slice(0, -1);

      if (subType === PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_OK) {
        if (this._surface.getPanelProperty('watch.active') && this._session.isWatchInProgress()) {
          this._session.stopWatchProgress();
          this._session.addWatchExpressionValue(
            this._debuggerObj,
            this._session.getWatchCurrentExpr(),
            this._debuggerObj.cesu8ToString(this._evalResult)
          );
        } else {
          this._logger.info(this._debuggerObj.cesu8ToString(this._evalResult));
        }

        this._evalResult = null;

        return;
      }

      if (subType === PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_ERROR) {
        if (this._surface.getPanelProperty('watch.active') && this._session.isWatchInProgress()) {
          this._session.stopWatchProgress();
          this._session.addWatchExpressionValue(
            this._debuggerObj,
            this._session.getWatchCurrentExpr(),
            ''
          );
        } else {
          this._logger.info('Uncaught exception: ' + this._debuggerObj.cesu8ToString(this._evalResult));
        }

        this._evalResult = null;

        return;
      }

      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT:
    case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT_END: {
      this._outputResult = this._debuggerObj.concatUint8Arrays(this._outputResult, message);

      if (message[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_RESULT_END) {
        let subType = this._outputResult[this._outputResult.length - 1];

        this._outputResult = this._outputResult.slice(0, -1);

        switch (subType) {
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_OK:
            this._output.info(this._debuggerObj.cesu8ToString(this._outputResult));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_WARNING:
            this._output.warning(this._debuggerObj.cesu8ToString(this._outputResult));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_ERROR:
            this._output.error(this._debuggerObj.cesu8ToString(this._outputResult));
            break;
        }

        this._outputResult = null;
      }

      return;
    }

    case PROTOCOL.SERVER.JERRY_DEBUGGER_WAIT_FOR_SOURCE: {
      this._debuggerObj.setEngineMode(ENGINE_MODE.CLIENT_SOURCE);

      this._surface.disableActionButtons(true);
      this._session.allowUploadAndRun(true);

      if (this._surface.getPanelProperty('run.active')) {
        this._surface.updateRunPanel(this._surface.RUN_UPDATE_TYPE.BUTTON, this._debuggerObj, this._session);
      }

      this._debuggerObj.sendClientSource();
      return;
    }

    default: {
      this._socket.abortConnection('unexpected message.');
      return;
    }
  }
}
