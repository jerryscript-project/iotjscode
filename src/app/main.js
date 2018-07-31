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

import 'bootswatch/yeti/bootstrap.min.css';
import 'jquery-ui-dist/jquery-ui.min.css';
import 'font-awesome/css/font-awesome.min.css';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import 'c3/c3.min.css';
import './style/bright/app.scss';
import './style/dark/app.scss';

import Logger from './logger';
import Session, { SOURCE_SYNC_ACTION } from './session';
import { MARKER_TYPE } from './modules/session/marker';
import Surface, { SURFACE_CSICON, SURFACE_RUN_UPDATE_TYPE, SURFACE_COLOR } from './surface';
import DebuggerClient, { PROTOCOL, ENGINE_MODE, DEBUGGER_RETURN_TYPES } from './modules/client/debugger';
import MemoryChart from './memory-chart';
import Settings from './settings';
import Transpiler from './transpiler';
import Completer from './completer';
import Util from './util';

import PerfectScrollbar from 'perfect-scrollbar';
import FileSaver from 'file-saver';
import 'jqueryui';
import 'thead';
import 'bootstrap';

export default function App() {
  console.log('IoT.JS Code');

  /**
   * Delay the document ready, wait for monaco init.
   */
  $.holdReady(true);

  /**
   * Object for the DebuggerClient.
   */
  let debuggerObj = null;

  /**
   * Core environment variables.
   */
  const env = {
    editor: null,
  };

  /**
   * Containers for perfect scrollbars.
   */
  const scrollbars = {
    panels: [],
    sidenav: null,
  };

  /**
   * Keycodes
   */
  const keys = {
    backspace: 8,
    tab: 9,
    enter: 13,
    esc: 27,
    end: 35,
    leftArrow: 37,
    upArrow: 38,
    rightArrow: 39,
    downArrow: 40,
    delete: 46,
    zero: 48,
    nine: 57,
    a: 65,
    c: 67,
    x: 88,
    numZero: 96,
    numNine: 105,
    decPoint: 110,
  };


  /**
   * Monaco related: the monaco loader function.
   */
  const onGotAmdLoader = () => window.require(['vs/editor/editor.main'], () => initMonaco());


  /**
   * Monaco related: initalization function.
   */
  const initMonaco = () => {
    env.editor = window.monaco.editor.create($('#monaco').get(0), {
      language: 'javascript',
      glyphMargin: true,
    });

    // Release the document ready delay.
    $.holdReady(false);
  };


  /**
   * Monaco related: load the monaco own loader if we do not have one.
   */
  if (!window.require) {
    let loaderScript = document.createElement('script');
    loaderScript.type = 'text/javascript';
    loaderScript.src = 'vs/loader.js';
    loaderScript.addEventListener('load', onGotAmdLoader);
    document.body.appendChild(loaderScript);
  } else {
    onGotAmdLoader();
  }


  /**
   * Document ready.
   */
  $(() => {
    /**
     * Module objects.
     */
    const logger = new Logger($('#console-panel'));
    const output = new Logger($('#output-panel'));
    const surface = new Surface();
    const session = new Session(env, surface);
    const chart = new MemoryChart(session, surface);
    const settings = new Settings(env.editor, surface);
    const transpiler = new Transpiler();
    const completer = new Completer();

    /**
     * Inits the debugger client and inits the related event listeners.
     *
     * @param {string} address The websocket connection address.
     */
    const initDebuggerClient = address => {
      debuggerObj = new DebuggerClient(address);

      /**
       * Listener for onopen event.
       */
      debuggerObj.connection.on('open', () => {
        logger.info(`ws://${address}/jerry-debugger`);
        logger.info('Connection created.');

        if (surface.getPanelProperty('chart.active')) {
          surface.toggleButton(true, 'chart-record-button');
        }

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
        }

        if (surface.getPanelProperty('watch.active')) {
          surface.updateWatchPanelButtons(debuggerObj);
        }

        surface.disableActionButtons(false);
        surface.toggleButton(false, 'connect-to-button');
      });

      /**
       * Listener for onabort event.
       */
      debuggerObj.connection.on('abort', message => logger.error(`Connection aborted: ${message}`, true));

      /**
       * Listener for onclose and onerror event.
       */
      debuggerObj.connection.on('close', () => {
        logger.info('Connection closed.');

        if (surface.getPanelProperty('chart.active')) {
          chart.disableChartButtons();
          if (chart.containsData()) {
            surface.toggleButton(true, 'chart-reset-button');
          }
        }

        if (surface.getPanelProperty('watch.active')) {
          surface.updateWatchPanelButtons(debuggerObj);
          session.neutralizeWatchExpressions();
        }

        if (settings.getValue('debugger.transpileToES5') && !transpiler.isEmpty()) {
          transpiler.clearTranspiledSources();
        }

        if (session.isUploadStarted) {
          session.uploadStarted = false;
        }

        // Reset the editor.
        session.reset();
        surface.reset();
        surface.disableActionButtons(true);
        surface.toggleButton(true, 'connect-to-button');
        surface.continueStopButtonState(SURFACE_CSICON.CONTINUE);

        if (session.isContextReset) {
          session.contextReset = false;

          // Try to reconnect once.
          setTimeout(() => $('#connect-to-button').trigger('click'), 1000);
        }
      });

      /**
       * Listener for mem stat receive event.
       */
      debuggerObj.connection.on('memStatReceive', (event, data) => {
        // Continue if we have any data.
        if (data[0] !== 0) {
          if (chart.isRecordStarted()) {
            chart.startRecord(false);
            chart.chartActive = true;

            surface.toggleButton(false, 'chart-reset-button');
            surface.toggleButton(true, 'chart-stop-button');
            surface.toggleButton(false, 'chart-record-button');
            $('#chart-record-button').css('background-color', '#16e016');
          }

          if (session.chartInfo && chart.isChartActive()) {
            const breakpointInfo = session.chartInfo.split(':')[1].split(' ')[0];
            let breakpointLineToChart = `ln: ${breakpointInfo}`;

            if (debuggerObj.engineMode === ENGINE_MODE.BREAKPOINT) {
              breakpointLineToChart = `#${breakpointInfo}: ${new Date().toISOString().slice(14, 21)}`;
            }

            chart.addNewDataPoints(data, breakpointLineToChart);
          }
        } else {
          // Notify the user about that, propbably the jerry was built without the memory statistic swicth.
          logger.error(
            'There are no memory statistics available. ' +
            'If you want to use the memory usage panel check the engine build command first.',
            true
          );
        }
      });

      /**
       * Listener for breakpoint hit event.
       */
      debuggerObj.connection.on('breakpointOrExceptionHit', (event, data, breakpoint, sourceName, source) => {
        session.lastBreakpoint = breakpoint;
        surface.continueStopButtonState(SURFACE_CSICON.CONTINUE);
        surface.disableActionButtons(false);

        // Source load and reload from Jerry.
        if (sourceName !== '') {
          if (!session.fileNameCheck(sourceName, true)) {
            session.storeJerrySource(sourceName, source);
            session.jerrySourceAction = SOURCE_SYNC_ACTION.LOAD;

            if (session.isAutoSourceSync) {
              session.syncSourceFromJerry();
              session.autoSourceSync = false;
            } else {
              logger.warning(`The file "${sourceName}" is missing.`, true);
              surface.toggleButton(true, 'jerry-sync-source-button');
            }
          } else {
            // Disable the auto source sync option in case of valid source.
            session.autoSourceSync = false;

            // Do not check the code match if the transpile is enabled.
            if (!settings.getValue('debugger.transpileToES5') && transpiler.isEmpty()) {
              if (!session.fileContentCheck(sourceName, source)) {
                session.jerrySourceAction = SOURCE_SYNC_ACTION.RELOAD;
                logger.warning(`The "${sourceName}" source does not match with the source on the device!`, true);
                surface.toggleButton(true, 'jerry-sync-source-button');
              }
            }
          }
        } else {
          sourceName = session.handleUnknownFile(
            Array.isArray(breakpoint.func.source) ? breakpoint.func.source.join('\n') : breakpoint.func.source
          );
        }

        // Switch to the the right session.
        const fid = session.getFileIdByName(sourceName);
        if (fid !== undefined && fid !== session.activeID) {
          // Change the model in the editor.
          session.switchFile(fid);
        }

        // Get the right line, which is depends on that if we use transpiled code or not.
        let hlLine = breakpoint.line;

        if (settings.getValue('debugger.transpileToES5') && !transpiler.isEmpty()) {
          hlLine = transpiler.getOriginalPositionFor(sourceName.split('/').pop(), breakpoint.line, 0).line - 1;
        }

        // After we switched to the correct file/session show the exception hint (if exists).
        if (data[0] === PROTOCOL.SERVER.JERRY_DEBUGGER_EXCEPTION_HIT) {
          session.highlightLine(MARKER_TYPE.EXCEPTION, hlLine);
          logger.error('Exception throw detected!');

          if (debuggerObj.connection.exceptionData) {
            logger.error('Exception hint: ' + debuggerObj.cesu8ToString(debuggerObj.connection.exceptionData), true);
            debuggerObj.connection.exceptionData = null;
          }
        } else {
          // Highlight the execute line in the correct session.
          if (fid !== undefined && fid === session.activeID) {
            session.highlightLine(MARKER_TYPE.EXECUTE, hlLine);
            session.markBreakpointLines(debuggerObj, settings, transpiler);
          }
        }

        // Show the backtrace on the panel.
        if (surface.getPanelProperty('backtrace.active')) {
          if (debuggerObj.sendGetBacktrace(settings.getValue('debugger.backtraceDepth')) ===
              DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE) {
            logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.');
          }
        }

        // Updates the watched expression list if the watch panel is active.
        if (surface.getPanelProperty('watch.active')) {
          session.updateWatchExpressions(debuggerObj);
        }

        // Add breakpoint information to chart.
        if (surface.getPanelProperty('chart.active')) {
          for (const i in debuggerObj.breakpoints.activeBreakpoints) {
            if (debuggerObj.breakpoints.activeBreakpoints[i].line ===
                debuggerObj.breakpointToString(breakpointTranspile(breakpoint)).split(':')[1].split(' ')[0]) {
              surface.stopCommand();
              return;
            }
          }

          debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_MEMSTATS]);
          session.chartInfo = debuggerObj.breakpointToString(breakpointTranspile(breakpoint));
        }

        logger.info(
          `Stopped ${breakpoint.at ? 'at ' : 'around '}` +
          (breakpoint.offset.index >= 0 ? ` breakpoint:${breakpoint.offset.index} ` : '') +
          debuggerObj.breakpointToString((breakpoint))
        );
      });

      debuggerObj.connection.on('backtrace', (event, backtrace) => {
        Util.clearElement($('#backtrace-table-body'));

        surface.updateBacktracePanel(backtrace, settings, transpiler);
      });

      /**
       * Listener for eval result event.
       */
      debuggerObj.connection.on('eval', (event, type, result) => {
        if (type === PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_OK) {
          if (surface.getPanelProperty('watch.active') && session.isWatchInProgress) {
            session.stopWatchProgress();
            session.addWatchExpressionValue(
              debuggerObj,
              session.watchCurrentExpr,
              debuggerObj.cesu8ToString(result)
            );
          } else {
            logger.info(debuggerObj.cesu8ToString(result));
          }
        }

        if (type === PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_ERROR) {
          if (surface.getPanelProperty('watch.active') && session.isWatchInProgress) {
            session.stopWatchProgress();
            session.addWatchExpressionValue(
              debuggerObj,
              session.watchCurrentExpr,
              ''
            );
          } else {
            logger.info(`Uncaught exception: ${debuggerObj.cesu8ToString(result)}`);
          }
        }
      });

      /**
       * Listener for output result event.
       */
      debuggerObj.connection.on('output', (event, subtype, result) => {
        switch (subtype) {
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_OK:
            output.info(debuggerObj.cesu8ToString(result));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_DEBUG:
            output.debug(debuggerObj.cesu8ToString(result));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_WARNING:
            output.warning(debuggerObj.cesu8ToString(result));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_ERROR:
            output.error(debuggerObj.cesu8ToString(result));
            break;
          case PROTOCOL.SERVER.JERRY_DEBUGGER_OUTPUT_TRACE:
            output.info(`TRACE: ${debuggerObj.cesu8ToString(result)}`);
            break;
        }
      });

      /**
       * Listener for wait for source event.
       * This will be called when the client gets the waiting message.
       */
      debuggerObj.connection.on('waitForSource', () => {
        surface.disableActionButtons(true);
        session.allowUploadAndRun = true;

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
        }

        sendSourceToTheEngine();
      });

      /**
       * Listener for the engine mode changes.
       */
      debuggerObj.on('engineModeChange', mode => {
        if (mode === ENGINE_MODE.CLIENT_SOURCE ||
          mode === ENGINE_MODE.DISCONNECTED) {
          surface.toggleSettingItem(true, 'transpileToES5');
        } else {
          surface.toggleSettingItem(false, 'transpileToES5');
        }
      });

      /**
       * Listener for the breakpoint set event.
       * This will be called when the user dispatch new breakpoint set in the editor.
       */
      debuggerObj.on('setBreakpoint', messages => {
        messages.forEach(message => logger.info(message));
        surface.toggleButton(true, 'delete-all-button');
        surface.updateBreakpointsPanel(debuggerObj.breakpoints.activeBreakpoints, settings, transpiler);
      });

      /**
       * Listener for the breakpoint insert event.
       * This will be called when the engine inserted the breakpoint into the right position.
       */
      debuggerObj.on('insertBreakpoint', (index, breakpoint) => {
        logger.info(`Breakpoint ${index} at ${debuggerObj.breakpointToString(breakpointTranspile(breakpoint))}`);
      });

      /**
       * Listener for the delete breakpoint event.
       * This will be called when the enginde deleted a breakpoint.
       */
      debuggerObj.on('deleteBreakpoint', message => {
        logger.info(message);

        surface.updateBreakpointsPanel(debuggerObj.breakpoints.activeBreakpoints, settings, transpiler);
      });

      /**
       * Listener for the delete pending breakpoint event.
       * This will be called when the client deleted a pending breakpoint.
       */
      debuggerObj.on('deletePendingBreakpoint', message => logger.info(message));
    };

    /**
     * Handler for the source sending.
     * This will send the selected files one by one to the engine when that is possible.
     */
    const sendSourceToTheEngine = () => {
      if (!session.uploadList.length || !session.isUploadStarted) {
        logger.info('The engine is waiting for a source.', true);
      } else {
        surface.disableActionButtons(false);


        const fileID = session.uploadList[0];
        let fileName = '';
        let fileSource = '';

        if (fileID !== 0) {
          fileName = session.getFileNameById(fileID);
          fileSource = session.getFileModelById(fileID).getValue();

          if (settings.getValue('debugger.transpileToES5') &&
              !transpiler.isEmpty() &&
              transpiler.transformToES5(fileName, fileSource)) {
            fileSource = transpiler.getTransformedSource(fileName);
          }
        }

        const result = debuggerObj.sendClientSource(fileID, fileName, fileSource);

        switch (result) {
          case DEBUGGER_RETURN_TYPES.SOURCE_SENDING.ALLOWED_IN_SOURCE_SENDING_MODE: {
            logger.error('This command is allowed only if the engine is waiting for a source.', true);
          } break;
          case DEBUGGER_RETURN_TYPES.SOURCE_SENDING.CONTEXT_RESET_SENDED: {
            session.shiftUploadList();
            session.contextReset = true;
            surface.changeUploadColor(SURFACE_COLOR.GREEN, fileID);
            session.allowUploadAndRun = false;
          } break;
          case DEBUGGER_RETURN_TYPES.SOURCE_SENDING.SOURCE_SENDED: {
            session.shiftUploadList();
            session.allowUploadAndRun = false;
            surface.changeUploadColor(SURFACE_COLOR.GREEN, fileID);
          } break;
          case DEBUGGER_RETURN_TYPES.SOURCE_SENDING.MULTIPLE_SOURCE_SENDED: {
            session.shiftUploadList();
            session.allowUploadAndRun = false;
            surface.changeUploadColor(SURFACE_COLOR.GREEN, fileID);
          } break;
        }
      }
    };

    /**
     * Handler for the breakpoint transpiler to get the right position of a breakpoint if the transpile is enabled.
     * @param {object} data The breakpoint which will be transpiled.
     */
    const breakpointTranspile = data => {
      let breakpoint = data;

      if (settings.getValue('debugger.transpileToES5') && !transpiler.isEmpty()) {
        breakpoint.line = this._transpiler.getOriginalPositionFor(
          this._session.getFileNameById(session.activeID),
          data.line,
          0
        ).line;

        if (breakpoint.func.is_func) {
          const position = this._transpiler.getOriginalPositionFor(
            this._session.getFileNameById(this._session.activeID),
            breakpoint.func.line,
            breakpoint.func.column
          );

          breakpoint.func.line = position.line;
          breakpoint.func.column = position.column;
        }
      }

      return breakpoint;
    };

    /**
     * Editor related events.
     */
    (() => {
      // Set the default welcome file.
      session.setWelcomeFile();

      // Register a completion item provider.
      window.monaco.languages.registerCompletionItemProvider(
        'javascript',
        completer.getCompletionProvider()
      );

      /**
       * Model change event.
       */
      env.editor.onDidChangeModel(() => {
        if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
          session.markBreakpointLines(debuggerObj, settings, transpiler);
        }
      });

      /**
       * Mosue click event.
       */
      env.editor.onMouseDown(e => {
        if (e.target.type === window.monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
            session.toggleBreakpoint(e.target.position.lineNumber, debuggerObj, settings, transpiler);
          }
        }
      });
    })();

    /**
     * User settings load related events.
     */
    (() => {
      settings.initListeners();
      settings.load();

      if (surface.getPanelProperty('chart.active')) {
        surface.initChartPanel(chart);
      }

      // After settings load resize the editor.
      env.editor.layout(surface.getEditorContainerDimensions());
    })();


    /**
     * Sidenav events.
     */
    (() => {
      /**
       * Toggle button click.
       */
      $('#sidenav-toggle-button').on('click', () => {
        surface.toggleSidenav();

        if (surface.getPanelProperty('chart.active')) {
          surface.initChartPanel(chart);
        }

        // Adapt the editor dimensions.
        env.editor.layout(surface.getEditorContainerDimensions());
      });

      /**
       * Outside click of the sidenav extra.
       */
      $('#sidenav-extra-modal').on('click', () => surface.toggleSidenavExtra(surface.lastOpenedSidenavExtra));

      /**
       * Extra panel toggles
       */
      $('.extra-sidenav-toggle').on('click', e => surface.toggleSidenavExtra($(e.currentTarget).data('eid')));

      /**
       * Panel swithcers.
       */
      $('.sidenav-panel-toggle').on('click', e => {
        surface.togglePanel($(e.currentTarget).data('pid'));

        settings.modify(
          `panels.${$(e.currentTarget).data('pid')}`,
          surface.getPanelProperty(`${$(e.currentTarget).data('pid')}.active`)
        );

        if (surface.getPanelProperty('chart.active')) {
          if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
            surface.toggleButton(true, 'chart-record-button');
          }

          surface.initChartPanel(chart);

          surface.toggleButton(true, 'export-chart-button');
        } else {
          surface.toggleButton(false, 'export-chart-button');
        }

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
        }

        if (surface.getPanelProperty('watch.active')) {
          surface.updateWatchPanelButtons(debuggerObj);
        }

        // Adapt the editor dimensions.
        env.editor.layout(surface.getEditorContainerDimensions());
      });
    })();


    /**
     * File menu events.
     */
    (() => {
      /**
       * File open button.
       */
      $('#open-file-button, #start-open-file-link').on('click', () => {
        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
          // Great success! All the File APIs are supported. Open the file browser.
          $('#hidden-file-input').trigger('click');
        } else {
          logger.error('The File APIs are not fully supported in this browser.', true);
        }
      });

      /**
       * Manage the file input change.
       */
      $('#hidden-file-input').change(evt => {
        // FileList object
        const files = evt.target.files;

        for (const f of files) {
          if (session.fileNameCheck(f.name)) {
            logger.error(f.name + ' is already loaded.', true);
            continue;
          }

          (file => {
            const reader = new FileReader();

            reader.onload = evt => {
              session.createNewFile(file.name, evt.target.result, true);

              if (surface.getPanelProperty('run.active')) {
                surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
              }

              if ($('#save-file-button').hasClass('disabled')) {
                surface.toggleButton(true, 'save-file-button');
              }
            },

            reader.onerror = evt => {
              if (evt.target.name.error === 'NotReadableError') {
                logger.error(file.name + ' file could not be read.', true);
              }
            },

            reader.readAsText(file, 'utf-8');
          })(f);
        }

        // Reset the file input field.
        $(evt.target).val('');

        // Close the extra sidenav windows after the open finished.
        if (surface.isSidenavExtraOpened) {
          surface.toggleSidenavExtra('file-sidenav');
        }
      });

      /**
       * New file name field toggle event.
       */
      $('#new-file-button, #start-new-file-link').on('click', e => {
        // If the user clicked the placeholder button then open the sidenav first.
        if (e.target.id === 'start-new-file-link') {
          surface.toggleSidenavExtra('file-sidenav');
        }

        surface.toggleSidenavNewFile();
        $('#new-file-name').focus();
      });

      /**
       * New file name on-the-fly validation.
       */
      $('#new-file-name').keyup(e => {
        const info = $('#hidden-new-file-info');
        const filename = $('#new-file-name').val().trim();
        const regex = /^([a-zA-Z0-9_-]{1,}.*)$/;
        let valid = true;

        info.empty();
        if (!regex.test(filename)) {
          info.append('<p>The filename must be at least 1 (one) character long.</p>');
          valid = false;
        }

        if (session.isFileNameTaken(filename)) {
          info.append('<p>This filename is already taken.</p>');
          valid = false;
        }

        if (valid) {
          surface.toggleButton(true, 'ok-file-name');
          // If the key was the enter, trigger the ok button.
          if (e.keyCode === keys.enter) {
            $('#ok-file-name').click();
          }
        } else {
          surface.toggleButton(false, 'ok-file-name');
        }
      });

      /**
       * New file name cancel button events.
       */
      $('#cancel-file-name').on('click', () => {
        $('#new-file-name').val('');
        $('#hidden-new-file-info').empty();
        surface.toggleButton(false, 'ok-file-name');
        surface.toggleSidenavNewFile();
      });

      /**
       * New file name ok button events.
       */
      $('#ok-file-name').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        session.createNewFile($('#new-file-name').val().trim(), '', false);

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
        }

        $('#new-file-name').val('');
        surface.toggleButton(false, 'ok-file-name');
        surface.toggleSidenavNewFile();
        surface.toggleSidenavExtra('file-sidenav');
      });

      /**
       * Save button event.
       */
      $('#save-file-button').on('click', () => {
        if ($('#save-file-button').hasClass('disabled')) {
          return true;
        }

        const blob = new Blob([session.getFileModelById(session.activeID).getValue()]);
        FileSaver.saveAs(blob, session.getFileNameById(session.activeID));
        $('#tab-' + session.activeID.removeClass('unsaved'));
        session.changeFileSavedProperty(session.activeID, true);
        surface.toggleSidenavExtra('file-sidenav');
      });
    })();


    /**
     * Settings menu events.
     */
    (() => {
      /**
       * Global.
       *
       * Call the settings init function with the reset = true parameter.
       */
      $('#local-storage-reset-button').on('click', () => settings.init(true));
    })();


    /**
     * Download menu events.
     */
    (() => {
      /**
       * Export chart button.
       */
      $('#export-chart-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.exportChartData();
      });
    })();


    /**
     * Action buttons events.
     */
    (() => {
      /**
       * Address port check.
       */
      $('#host-port').keydown(e => {
        // Allow: backspace, delete, tab, escape, enter.
        if ($.inArray(e.keyCode, [keys.delete, keys.backspace, keys.tab, keys.esc, keys.enter, keys.decPoint]) !== -1 ||
            // Allow: Ctrl/cmd+A.
            (e.keyCode === keys.a && (e.ctrlKey === true || e.metaKey === true)) ||
            // Allow: Ctrl/cmd+C.
            (e.keyCode === keys.c && (e.ctrlKey === true || e.metaKey === true)) ||
            // Allow: Ctrl/cmd+X.
            (e.keyCode === keys.x && (e.ctrlKey === true || e.metaKey === true)) ||
            // Allow: home, end, left, right.
            (e.keyCode >= keys.end && e.keyCode <= keys.rightArrow)) {
          // let it happen, don't do anything.
          return;
        }

        // Ensure that it is a number and stop the keypress.
        if ((e.shiftKey || (e.keyCode < keys.zero || e.keyCode > keys.nine)) &&
            (e.keyCode < keys.numZero || e.keyCode > keys.numNine)) {
          e.preventDefault();
        }
      });

      $('#connect-to-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
          logger.info('Debugger is connected.');
          return true;
        }

        const ip = $('#host-ip').val() || 'localhost';
        const port = $('#host-port').val() || 5001;

        if (port < 0 || port > 65535) {
          logger.error('Address port must between 0 and 65535.', true);
          return true;
        }

        const address = `${ip}:${port}`;
        logger.info(`Connect to: ${address}`);
        initDebuggerClient(address);

        return true;
      });

      $('#delete-all-button').on('click', () => {
        if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
          debuggerObj.breakpoints.activeBreakpoints.forEach(activeBreakpoint => {
            session.toggleBreakpoint(activeBreakpoint._line, debuggerObj, settings, transpiler);
          });
          surface.toggleButton(false, 'delete-all-button');
        }
      });

      $('#continue-stop-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.engineMode === ENGINE_MODE.BREAKPOINT) {
          surface.continueCommand();

          if (debuggerObj.sendResumeExec(PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTINUE) ===
              DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE) {
            logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.');
          }
        } else {
          surface.stopCommand();

          if (surface.getPanelProperty('chart.active')) {
            chart.deleteTimeoutLoop();
          }

          debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_STOP]);
          surface.toggleButton(false, 'continue-stop-button');
        }
      });

      $('#step-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.engineMode !== ENGINE_MODE.BREAKPOINT) {
          logger.error('This action is only available in breakpoint mode.', true);
          return true;
        }

        debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_STEP]);
        surface.toggleButton(false, 'step-button');
      });

      $('#finish-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.engineMode !== ENGINE_MODE.BREAKPOINT) {
          logger.error('This action is only available in breakpoint mode.', true);
          return true;
        }

        debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_FINISH]);
        surface.toggleButton(false, 'finish-button');
      });

      $('#next-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.engineMode !== ENGINE_MODE.BREAKPOINT) {
          logger.error('This action is only available in breakpoint mode.', true);
          return true;
        }

        debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_NEXT]);
        surface.toggleButton(false, 'next-button');
      });

      $('#disconnect-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        debuggerObj.connection.close();
      });
    })();


    /**
     * Watch panel events.
     */
    (() => {
      /**
       * Add button in the panel head.
       */
      $('#watch-add-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#watch-add-wrapper').show();
        $('#watch-add-input').focus();
      });

      /**
       * Refresh button in the panel head.
       */
      $('#watch-refresh-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj && debuggerObj.engineMode === ENGINE_MODE.BREAKPOINT) {
          session.updateWatchExpressions(debuggerObj);
        }
      });

      /**
       * Clear button in the panel head.
       */
      $('#watch-clear-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#watch-list').html('');
        session.removeAllWatchExpression();
        surface.updateWatchPanelButtons(debuggerObj);
      });

      /**
       * Listed item delete icons.
       */
      $('#watch-list').on('click', '.watch-li-remove i', e => {
        session.removeWatchExpression($(e.target).parent().data('rid'));
        $(e.target).parent().parent().remove();
        surface.updateWatchPanelButtons(debuggerObj);
      });

      /**
       * Input field behaviour.
       */
      $('#watch-add-input').focusout(e => {
        $(e.target).val('');
        $('#watch-add-wrapper').hide();
      });

      $('#watch-add-input').on('keypress', e => {
        if (e.keyCode === keys.enter) {
          if ($(e.target).val() !== '') {
            session.addWatchExpression(debuggerObj, $(e.target).val());
          }

          $(e.target).val('');
          $('#watch-add-wrapper').hide();
        }
      });
    })();


    /**
     * Backtrace and breakpoints panel events.
     */
    (() => {
      /**
       * Init the backtrace and breakpoints panels fixed head view.
       */
      $('.scroll-table').floatThead({
        autoReflow: true,
        position: 'fixed',
        zIndex: 800,
        scrollContainer: $table => $table.closest('.wrapper'),
      });
    })();


    /**
     * MemoryChart panel events.
     */
    (() => {
      $('#chart-record-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.startChartWithButton();
        if (debuggerObj) {
          debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_MEMSTATS]);
        }
      });

      $('#chart-stop-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.stopChartWithButton();
      });

      $('#chart-reset-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.resetChart();
        chart.resizeChart(surface.getPanelProperty('chart.height'), surface.getPanelProperty('chart.width'));
      });
    })();

    /**
     * Output log panel events.
     */
    (() => {
      /**
       *Clear button click event.
       */
      $('#output-clear-button').on('click', () => Util.clearElement($('#output-panel')));
    })();


    /**
     * Source sending panel events.
     */
    (() => {
      /**
       * Selectable and sortable ul lists for file select.
       */
      $('.selectable').selectable({
        filter: 'li',
        cancel: '.handle',
      });

      $('#run-chooser-dest').sortable({
        handle: '.handle',
        axis: 'y',
        update: (event, ui) => {
          const sid = parseInt($(ui.item[0]).data('sid'));
          if (session.getFileDataById(sid).scheduled) {
            session.moveFileInUploadList(session.uploadList.indexOf(sid), $(ui.item[0]).index());
          }
        },
      });

      /**
       * If the run panel is active after loading settings and sortable initialization
       * we have to fill up the files list.
       */
      if (surface.getPanelProperty('run.active')) {
        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      }

      /**
       * Right arrow button in the source selecting panel.
       */
      $('#run-right-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#run-chooser-src .ui-selected').each((i, e) => {
          $(e).detach().appendTo('#run-chooser-dest').removeClass('ui-selected').addClass('sortable')
            .children('div').removeClass('hidden');

            const sid = parseInt($(e).data('sid'));

          if (!session.getFileDataById(sid).scheduled) {
            session.addFileToUploadList(sid, $(e).index());
          }
        });

        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
      });

      /**
       * Left arrow button in the source selecting panel.
       */
      $('#run-left-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#run-chooser-dest .ui-selected').each((i, e) => {
          $(e).detach().appendTo('#run-chooser-src').removeClass('sortable').removeClass('ui-selected')
            .children('div').addClass('hidden');

            const sid = parseInt($(e).data('sid'));

          if (session.getFileDataById(sid).scheduled) {
            session.removeFileFromUploadList(sid);
          }
        });

        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
      });

      /**
       * Run button in the run panel head.
       */
      $('#run-ok-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        // Prevent the 'empty' upload.
        if ($('#run-chooser-dest').is(':empty')) {
          return;
        }

        session.uploadStarted = true;

        // Add the context reset signal to the upload list.
        if (!session.isFileInUploadList(0)) {
          session.addFileToUploadList(0, session.uploadList.length);
          surface.appendChooserLi($('#run-chooser-dest'), '', 'hidden', 'run-context-reset-sid', 0, 'Context Reset');
        }

        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.JQUI, debuggerObj, session);
        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);

        sendSourceToTheEngine();
      });

      /**
       * Clear button in the run panel head.
       */
      $('#run-clear-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        session.getAllData().forEach(s => {
          if (s.scheduled) {
            session.removeFileFromUploadList(s.id);
          }
        });

        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      });

      /**
       * Context reset button in the run panel head.
       */
      $('#run-context-reset-button').on('click', e => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        // Reset the upload list.
        session.resetUploadList();
        surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.CR, debuggerObj, session);

        // Remove the unuploaded file placeholders.
        $('#run-chooser-dest li .btn').each((i, el) => {
          if (!$(el).hasClass('btn-success')) {
            $(el).remove();
          }
        });

        // Disable the reset button.
        $(e.target).addClass('disabled');
      });
    })();


    /**
     * Console panel events.
     */
    (() => {
      /**
       * Sync source from jerry button.
       */
      $('#jerry-sync-source-button').on('click', () => {
        if (surface.buttonIsDisabled('#jerry-sync-source-button')) {
          return;
        }
        session.syncSourceFromJerry();
        surface.toggleButton(false, 'jerry-sync-source-button');
      });

      /**
       * Clear button click event.
       */
      $('#console-clear-button').on('click', () => {
        Util.clearElement($('#console-panel'));
      });

      /**
       * Command line input field.
       */
      $('#command-line-input').keydown(e => {
        if (e.keyCode === keys.upArrow) {
          if (session.commandCounter - 1 > -1) {
            session.commandCounter = session.commandCounter - 1;
            $('#command-line-input').val(session.commandList[session.commandCounter]);
          }
        } else if (e.keyCode === keys.downArrow) {
          if (session.commandCounter + 1 < session.commandList.length) {
            session.commandCounter = session.commandCounter + 1;
            $('#command-line-input').val(session.commandList[session.commandCounter]);
          } else {
            session.commandCounter = session.commandList.length;
            $('#command-line-input').val('');
          }
        }
      });

      /**
       * Command line input keypress event.
       */
      $('#command-line-input').keypress(event => {
        if (event.keyCode !== keys.enter) {
          return true;
        }

        const commandInput = $('#command-line-input');
        const command = commandInput.val().trim();

        session.addCommandToList(command);
        session.commandCounter = session.commandList.length;
        const args = /^([a-zA-Z]+)(?:\s+([^\s].*)|)$/.exec(command);

        if (!args) {
          logger.error('Invalid command.');
          commandInput.val('');
          return true;
        }

        if (!args[2]) {
          args[2] = '';
        }

        if (args[1] == 'help') {
          logger.info('Debugger commands:\n' +
            '  connect <IP address:PORT> - connect to server (default is localhost:5001)\n' +
            '  pendingbreak|pb <file_name:line>|<function_name> - add pending breakpoint\n' +
            '  pendingdel <id> - delete pending breakpoint\n' +
            '  list - list breakpoints\n' +
            '  stop|st - stop execution\n' +
            '  continue|c - continue execution\n' +
            '  step|s - step-in execution\n' +
            '  finish|f - step-out execution\n' +
            '  next|n - execution until the next breakpoint\n' +
            '  eval|e - evaluate expression\n' +
            '  throw - evaluate expression and throw it as exception\n' +
            '  abort - evaluate expression and abort the JS engine\n' +
            '  restart - restart the JS engine\n' +
            '  exception <0|1> - turn on/off the exception handler\n' +
            '  dump - dump all breakpoint data');
          commandInput.val('');
          return true;
        }

        if (args[1] == 'connect') {
          if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
            logger.info('Debugger is connected');
            return true;
          }

          let ipAddr = args[2];
          let PORT = '5001';
          if (ipAddr === '') {
            ipAddr = 'localhost';
          }

          if (ipAddr.match(/.*:\d/)) {
            const fields = ipAddr.split(':');
            ipAddr = fields[0];
            PORT = fields[1];
          }

          if (PORT < 0 || PORT > 65535) {
            logger.error('Adress port must be between 0 and 65535.');
            return true;
          }

          const address = ipAddr + ':' + PORT;
          logger.info('Connect to: ' + address);
          initDebuggerClient(address);

          commandInput.val('');

          return true;
        }

        if (!debuggerObj || debuggerObj.engineMode === ENGINE_MODE.DISCONNECTED) {
          logger.error('Debugger is NOT connected.');
          commandInput.val('');
          return true;
        }

        let result = null;
        switch (args[1]) {
          case 'pb':
          case 'pendingbreak':
            debuggerObj.setBreakpoint(args[2], true);
            break;
          case 'pendingdel':
            debuggerObj.deletePendingBreakpoint(args[2]);
            break;
          case 'st':
          case 'stop':
            $('#continue-stop-button').click();
            break;
          case 'c':
          case 'continue':
            $('#continue-stop-button').click();
            break;
          case 's':
          case 'step':
            $('#step-button').click();
            break;
          case 'f':
          case 'finish':
            $('#finish-button').click();
            break;
          case 'n':
          case 'next':
            $('#next-button').click();
            break;
          case 'e':
          case 'eval':
            result = debuggerObj.sendEval(PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_EVAL, args[2]);
            break;
          case 'throw':
            result = debuggerObj.sendEval(PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_THROW, args[2]);
            break;
          case 'abort':
            result = debuggerObj.sendEval(PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_ABORT, args[2]);
            break;
          case 'restart':
            result = debuggerObj.sendEval(PROTOCOL.SERVER.JERRY_DEBUGGER_EVAL_ABORT, '"r353t"');
            break;
          case 'exception':
            result = debuggerObj.sendExceptionConfig(parseInt(args[2]));
            break;
          case 'list':
            debuggerObj.listBreakpoints().forEach(log => logger.info(log));
            break;
          case 'dump':
            debuggerObj.dump().forEach(log => logger.info(log));
            break;
          default:
            logger.error('Unknown command: ' + args[1]);
            break;
        }

        commandInput.val('');
        if (result === null)
          return true;

        switch (result) {
          case DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_REQUIRED:
            logger.error('Argument required.');
            break;
          case DEBUGGER_RETURN_TYPES.COMMON.ALLOWED_IN_BREAKPOINT_MODE:
            logger.error('This command is allowed only if JavaScript execution is stopped at a breakpoint.');
            break;
          case DEBUGGER_RETURN_TYPES.COMMON.ARGUMENT_INVALID:
            logger.error('Invalid argument. Usage: exception <0|1>');
            break;
          case DEBUGGER_RETURN_TYPES.EXCEPTION_CONFIG.ENABLED:
            logger.info('Stop at exception enabled.');
            break;
          case DEBUGGER_RETURN_TYPES.EXCEPTION_CONFIG.DISABLED:
            logger.info('Stop at exception disabled.');
            break;
          default:
            logger.log('Unknown error.');
            break;
        }

        return true;
      });
    })();

    /**
     * Perfect scrollbar events.
     */
    (() => {
      /**
       * Info panels scrollbars.
       */
      $('.perfect-scrollable').each((i, e) => {
        scrollbars.panels.push(new PerfectScrollbar($(e).get(0)));
      });

      /**
       * Sidenav extra scrollbars.
       */
      scrollbars.sidenav = new PerfectScrollbar($('.sidenav-extra').get(0));
    })();


    /**
     * Resizer functions and events.
     */
    (() => {
      /**
       * Editor and info panels horizontal column resizer.
       */
      $('#info-panels').resizable({
        handles: 'e',
        resize: (event, ui) => {
          $('#editor-wrapper').css('width', surface.editorHorizontalPercentage() + '%');

          // Resize chart.
          if (surface.getPanelProperty('chart.active')) {
            surface.chartPanelWidth($('#chart-wrapper').width());

            let tmph = surface.getPanelProperty('chart.height');

            if ($('#chart-wrapper').height() !== 0) {
              tmph = $('#chart-wrapper').height();
            }

            chart.resizeChart(tmph, surface.getPanelProperty('chart.width'));
          }

          // Resize editor.
          $(ui.originalElement).width($(ui.originalElement).width() / $('#workspace-wrapper').width() * 100 + '%');

          env.editor.layout(surface.getEditorContainerDimensions());
        },
      });

      /**
       * Info panels vertical resizer.
       */
      $('.vertical-resizable').not(':last').resizable({
        handles: 's',
        minHeight: surface.getPanelProperty('height'),
        start: (event, ui) => {
          ui.originalElement.other = $(ui.originalElement).next();

          while (!ui.originalElement.other.is(':visible')) {
            ui.originalElement.other = $(ui.originalElement.other).next();
          }

          ui.originalElement.startHeight = ui.originalElement.other.height();
        },
        resize: (event, ui) => {
          const minHeight = ui.element.resizable('option', 'minHeight');
          let diffH = ui.size.height - ui.originalSize.height;

          if (diffH > ui.originalElement.startHeight - minHeight) {
            diffH = ui.originalElement.startHeight;
            ui.size.height = ui.originalSize.height + diffH - minHeight;
          }

          const tmpHeight = Math.max(surface.getPanelProperty('height'), ui.originalElement.startHeight - diffH);

          ui.originalElement.other.height(
            (tmpHeight < surface.getPanelProperty('height')) ? surface.getPanelProperty('height') : tmpHeight
          );

          if ((ui.originalElement[0].id == 'chart-wrapper' || ui.originalElement.other[0].id == 'chart-wrapper') &&
              ui.originalElement.other.height() != minHeight) {
            chart.resizeChart($('#chart-wrapper').height(), surface.getPanelProperty('chart.width'));
          }
        },
      });

      /**
       * Window resize event.
       */
      $(window).resize(e => {
        if (e.target === window) {

          surface.resetPanelsPercentage();

          if (surface.getPanelProperty('chart.active')) {
            setTimeout(() => {
              surface.chartPanelHeight = $('#chart-wrapper').height();
              surface.chartPanelWidth = $('#chart-wrapper').width();
              chart.resizeChart(surface.getPanelProperty('chart.height'), surface.getPanelProperty('chart.width'));
            }, 100);
          }

          // Resize the info panels and the editor.
          $('#editor-wrapper').css('width', surface.editorHorizontalPercentage() + '%');

          env.editor.layout(surface.getEditorContainerDimensions());
        }

        $('#info-panels').resizable('option', 'minWidth', Math.floor($('#editor-wrapper').parent().width() / 3));
        $('#info-panels').resizable('option', 'maxWidth', Math.floor(($('#editor-wrapper').parent().width() / 3) * 2));

        // Update the scrollbars of the panels.
        for (const sb of scrollbars.panels) {
          sb.update();
        }
      });
    })();
  });
}
