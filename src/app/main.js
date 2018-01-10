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
import './app.scss';

import Logger from './logger';
import Session from './session';
import Surface from './surface';
import DebuggerClient, { PROTOCOL, ENGINE_MODE } from './client-debugger';
import MemoryChart from './memory-chart';
import Completer, { IOTJS_FUNCTIONS } from './completer';
import Settings from './settings';
import Transpiler from './transpiler';

import PerfectScrollbar from 'perfect-scrollbar';
import FileSaver from 'file-saver';
import 'jqueryui';
import 'thead';
import 'bootstrap';
import 'ace/ace';
import 'ace/ext-language_tools';

export default function App() {
  console.log('IoT.JS Code');

  /**
   * Object for the DebuggerClient.
   */
  let debuggerObj = null;

  /**
   * Core environment variables.
   */
  let env = {
    editor: window.ace.edit('editor'),
    basePath: 'ace',
    langTools: null,
    config: null,
    iotjsCompleter: null,
    EditSession: null,
    Document: null,
  };

  /**
   * Containers for perfect scrollbars.
   */
  let scrollbars = {
    panels: [],
  };

  /**
   * Keycodes
   */
  let keys = {
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
   * Module objects.
   */
  let logger = new Logger($('#console-panel'));
  let surface = new Surface();
  let session = new Session(env, surface);
  let chart = new MemoryChart(session, surface);
  let completer = new Completer();
  let settings = new Settings(env.editor, surface);
  let transpiler = new Transpiler();


  /**
   * Document ready.
   */
  $(() => {
    // Init the ACE editor.
    env.langTools = window.ace.require('ace/ext/language_tools');
    env.config = window.ace.require('ace/config');
    env.config.set('packaged', true);
    env.config.set('basePath', env.basePath);
    env.config.set('workerPath', env.basePath);
    env.config.set('modePath', env.basePath);
    env.config.set('themePath', env.basePath);

    env.editor.resize();
    env.editor.setTheme('ace/theme/tomorrow');
    env.EditSession = window.ace.require('ace/edit_session').EditSession;
    env.Document = window.ace.require('ace/document').Document;
    env.editor.session.setMode('ace/mode/javascript');
    env.editor.setShowInvisibles(false);

    // Enable the autocomplete and snippets.
    env.editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
    });

    // Add the IoT.js completer to the editor language tools.
    env.langTools.addCompleter({
      getCompletions: (editor, session, pos, prefix, callback) => {
        if (prefix.length === 0) {
          callback(null, []);
          return;
        }

        let wordList = completer.getCompleterWordList(
          IOTJS_FUNCTIONS,
          prefix,
          completer.lookingForModules(env.editor.session.getValue())
        );

        callback(null, wordList.map((ea) => {
          return {
            name: ea.word,
            value: ea.word,
            score: ea.score,
            meta: 'IoT.js ' + ea.meta,
          };
        }));
      },
    });

    // Workaround for scrolling problem.
    env.editor.$blockScrolling = Infinity;

    // Init the welcome session.
    session.setWelcomeFile();


    /**
     * User settings load related events.
     */
    (() => {
      settings.initListeners();
      settings.load();

      if (surface.getPanelProperty('chart.active')) {
        surface.initChartPanel(chart);
      }
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
      });

      /**
       * Outside click of the sidenav extra.
       */
      $('#sidenav-extra-modal').on('click', () => {
        surface.toggleSidenavExtra(surface.getLastOpenedSidenavExtra());
      });

      /**
       * Extra panel toggles
       */
      $('.extra-sidenav-toggle').on('click', (e) => {
        surface.toggleSidenavExtra($(e.currentTarget).data('eid'));
      });

      /**
       * Panel swithcers.
       */
      $('.sidenav-panel-toggle').on('click', (e) => {
        surface.togglePanel($(e.currentTarget).data('pid'));

        settings.modify(
          `panels.${$(e.currentTarget).data('pid')}`,
          surface.getPanelProperty(`${$(e.currentTarget).data('pid')}.active`)
        );

        if (surface.getPanelProperty('chart.active')) {
          if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
            surface.toggleButton(true, 'chart-record-button');
          }

          surface.initChartPanel(chart);

          surface.toggleButton(true, 'export-chart-button');
        } else {
          surface.toggleButton(false, 'export-chart-button');
        }

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
        }

        if (surface.getPanelProperty('watch.active')) {
          surface.updateWatchPanelButtons(debuggerObj);
        }
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
      $('#hidden-file-input').change((evt) => {
        // FileList object
        let files = evt.target.files;

        for (let f of files) {
          if (session.fileNameCheck(f.name)) {
            logger.error(f.name + ' is already loaded.', true);
            continue;
          }

          ((file) => {
            let reader = new FileReader();

            reader.onload = (evt) => {
              session.createNewFile(file.name, evt.target.result, true);

              if (surface.getPanelProperty('run.active')) {
                surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
              }
            },

            reader.onerror = (evt) => {
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
        if (surface.isSidenavExtraOpened()) {
          surface.toggleSidenavExtra('file-sidenav');
        }
      });

      /**
       * New file name field toggle event.
       */
      $('#new-file-button, #start-new-file-link').on('click', (e) => {
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
      $('#new-file-name').keyup((e) => {
        let info = $('#hidden-new-file-info');
        let filename = $('#new-file-name').val().trim();
        let valid = true;
        let regex = /^([a-zA-Z0-9_-]{1,}.*)$/;

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
      $('#ok-file-name').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        session.createNewFile($('#new-file-name').val().trim(), '', false);

        if (surface.getPanelProperty('run.active')) {
          surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
        }

        $('#new-file-name').val('');
        surface.toggleButton(false, 'ok-file-name');
        surface.toggleSidenavNewFile();
        surface.toggleSidenavExtra('file-sidenav');
      });

      /**
       * Save button event.
       */
      $('#save-file-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        let blob = new Blob([env.editor.session.getValue()]);
        FileSaver.saveAs(blob, session.getFileNameById(session.getActiveID()));
        $('#tab-' + session.getActiveID()).removeClass('unsaved');
        surface.toggleSidenavExtra('file-sidenav');
      });
    })();


    /**
     * Settings menu events.
     */
    (() => {
      /**
       * Global.
       */
      $('#local-storage-reset-button').on('click', () => {
        // Call the settings init function with the reset = true parameter.
        settings.init(true);
      });
    })();


    /**
     * Download menu events.
     */
    (() => {
      /**
       * Export chart button.
       */
      $('#export-chart-button').on('click', (e) => {
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
      $('#host-port').keydown((e) => {
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

      $('#connect-to-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
          logger.info('Debugger is connected.');
          return true;
        }

        if ($('#host-ip').val() === '') {
          logger.error('IP address expected.', true);
          return true;
        }

        if ($('#host-port').val() === '') {
          logger.error('Adress port expected.', true);
          return true;
        }

        if ($('#host-port').val() < 0 || $('#host-port').val() > 65535) {
          logger.error('Adress port must between 0 and 65535.', true);
          return true;
        }

        let address = `${$('#host-ip').val()}:${$('#host-port').val()}`;
        logger.info(`Connect to: ${address}`);
        debuggerObj = new DebuggerClient(address, session, surface, settings, chart);

        return true;
      });

      $('#delete-all-button').on('click', () => {
        if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
          let found = false;
          let actives = debuggerObj.getActiveBreakpoints();

          for (let i in actives) {
            if (actives.hasOwnProperty(i)) {
              debuggerObj.deleteBreakpoint(actives[i].activeIndex);
              found = true;
            }
          }

          if (!found) {
            logger.info('No active breakpoints.');
          }
          session.deleteBreakpointsFromEditor();
        }
      });

      $('#continue-stop-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.getEngineMode() === ENGINE_MODE.BREAKPOINT) {
          surface.continueCommand();
          debuggerObj.sendResumeExec(PROTOCOL.CLIENT.JERRY_DEBUGGER_CONTINUE);
        } else {
          surface.stopCommand();

          if (surface.getPanelProperty('chart.active')) {
            chart.deleteTimeoutLoop();
          }

          debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_STOP]);
        }
      });

      $('#step-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.getEngineMode() !== ENGINE_MODE.BREAKPOINT) {
          logger.error('This action is only available in breakpoint mode.', true);
          return true;
        }

        debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_STEP]);
      });

      $('#next-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj.getEngineMode() !== ENGINE_MODE.BREAKPOINT) {
          logger.error('This action is only available in breakpoint mode.', true);
          return true;
        }

        debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_NEXT]);
      });
    })();


    /**
     * Watch panel events.
     */
    (() => {
      /**
       * Add button in the panel head.
       */
      $('#watch-add-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#watch-add-wrapper').show();
        $('#watch-add-input').focus();
      });

      /**
       * Refresh button in the panel head.
       */
      $('#watch-refresh-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        if (debuggerObj && debuggerObj.getEngineMode() === ENGINE_MODE.BREAKPOINT) {
          session.updateWatchExpressions(debuggerObj);
        }
      });

      /**
       * Clear button in the panel head.
       */
      $('#watch-clear-button').on('click', (e) => {
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
      $('#watch-list').on('click', '.watch-li-remove i', (e) => {
        session.removeWatchExpression($(e.target).parent().data('rid'));
        $(e.target).parent().parent().remove();
        surface.updateWatchPanelButtons(debuggerObj);
      });

      /**
       * Input field behaviour.
       */
      $('#watch-add-input').focusout((e) => {
        $(e.target).val('');
        $('#watch-add-wrapper').hide();
      });

      $('#watch-add-input').on('keypress', (e) => {
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
        scrollContainer: ($table) => {
          return $table.closest('.wrapper');
        },
      });
    })();


    /**
     * MemoryChart panel events.
     */
    (() => {
      $('#chart-record-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.startChartWithButton();
        if (debuggerObj) {
          debuggerObj.encodeMessage('B', [PROTOCOL.CLIENT.JERRY_DEBUGGER_MEMSTATS]);
        }
      });

      $('#chart-stop-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.stopChartWithButton();
      });

      $('#chart-reset-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        chart.resetChart();
        chart.resizeChart(surface.getPanelProperty('chart.height'), surface.getPanelProperty('chart.width'));
      });
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
          let sid = parseInt($(ui.item[0]).data('sid'));
          if (session.getFileDataById(sid).scheduled) {
            session.moveFileInUploadList(session.getUploadList().indexOf(sid), $(ui.item[0]).index());
          }
        },
      });

      /**
       * If the run panel is active after loading settings and sortable initialization
       * we have to fill up the files list.
       */
      if (surface.getPanelProperty('run.active')) {
        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      }

      /**
       * Right arrow button in the source selecting panel.
       */
      $('#run-right-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#run-chooser-src .ui-selected').each((i, e) => {
          $(e).detach().appendTo('#run-chooser-dest').removeClass('ui-selected').addClass('sortable')
            .children('div').removeClass('hidden');

          let sid = parseInt($(e).data('sid'));

          if (!session.getFileDataById(sid).scheduled) {
            session.addFileToUploadList(sid, $(e).index());
          }
        });

        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
      });

      /**
       * Left arrow button in the source selecting panel.
       */
      $('#run-left-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        $('#run-chooser-dest .ui-selected').each((i, e) => {
          $(e).detach().appendTo('#run-chooser-src').removeClass('sortable').removeClass('ui-selected')
            .children('div').addClass('hidden');

          let sid = parseInt($(e).data('sid'));

          if (session.getFileDataById(sid).scheduled) {
            session.removeFileFromUploadList(sid);
          }
        });

        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
      });

      /**
       * Run button in the run panel head.
       */
      $('#run-ok-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        // Prevent the 'empty' upload.
        if ($('#run-chooser-dest').is(':empty')) {
          return;
        }

        session.setUploadStarted(true);

        // Add the context reset signal to the upload list.
        if (!session.isFileInUploadList(0)) {
          session.addFileToUploadList(0, session.getUploadList().length);
          surface.appendChooserLi($('#run-chooser-dest'), '', 'hidden', 'run-context-reset-sid', 0, 'Context Reset');
        }

        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.JQUI, debuggerObj, session);
        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);

        // Send the source(s) to the debugger.
        debuggerObj.sendClientSource();
      });

      /**
       * Clear button in the run panel head.
       */
      $('#run-clear-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        session.getAllData().forEach((s) => {
          if (s.scheduled) {
            session.removeFileFromUploadList(s.id);
          }
        });

        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      });

      /**
       * Context reset button in the run panel head.
       */
      $('#run-context-reset-button').on('click', (e) => {
        if (surface.buttonIsDisabled(e.target)) {
          return true;
        }

        // Reset the upload list.
        session.resetUploadList();
        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.CR, debuggerObj, session);

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
       * Command line input field.
       */
      $('#command-line-input').keydown((e) => {
        if (e.keyCode === keys.upArrow) {
          if (session.getCommandCounter() - 1 > -1) {
            session.setCommandCounter(session.getCommandCounter() - 1);
            $('#command-line-input').val(session.getCommandList()[session.getCommandCounter()]);
          }
        } else if (e.keyCode === keys.downArrow) {
          if (session.getCommandCounter() + 1 < session.getCommandList().length) {
            session.setCommandCounter(session.getCommandCounter() + 1);
            $('#command-line-input').val(session.getCommandList()[session.getCommandCounter()]);
          } else {
            session.setCommandCounter(session.getCommandList().length);
            $('#command-line-input').val('');
          }
        }
      });

      /**
       * Command line input keypress event.
       */
      $('#command-line-input').keypress((event) => {
        if (event.keyCode !== keys.enter) {
          return true;
        }

        let commandInput = $('#command-line-input');
        let command = commandInput.val().trim();

        session.addCommandToList(command);
        session.setCommandCounter(session.getCommandList().length);
        let args = /^([a-zA-Z]+)(?:\s+([^\s].*)|)$/.exec(command);

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
            '  pendingdel <id> - delete pending breakpoint\n' +
            '  list - list breakpoints\n' +
            '  stop|st - stop execution\n' +
            '  continue|c - continue execution\n' +
            '  step|s - step-in execution\n' +
            '  next|n - execution until the next breakpoint\n' +
            '  eval|e - evaluate expression\n' +
            '  exception <0|1> - turn on/off the exception handler\n' +
            '  dump - dump all breakpoint data');
          commandInput.val('');
          return true;
        }

        if (args[1] == 'connect') {
          if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
            logger.info('Debugger is connected');
            return true;
          }

          let ipAddr = args[2];
          let PORT = '5001';
          if (ipAddr === '') {
            ipAddr = 'localhost';
          }

          if (ipAddr.match(/.*:\d/)) {
            let fields = ipAddr.split(':');
            ipAddr = fields[0];
            PORT = fields[1];
          }

          if (PORT < 0 || PORT > 65535) {
            logger.error('Adress port must be between 0 and 65535.');
            return true;
          }

          let address = ipAddr + ':' + PORT;
          logger.info('Connect to: ' + address);
          debuggerObj = new DebuggerClient(address, session, surface, settings, chart);

          commandInput.val('');

          return true;
        }

        if (!debuggerObj || debuggerObj.getEngineMode() === ENGINE_MODE.DISCONNECTED) {
          logger.error('Debugger is NOT connected.');
          commandInput.val('');
          return true;
        }

        switch (args[1]) {
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
          case 'n':
          case 'next':
            $('#next-button').click();
            break;
          case 'e':
          case 'eval':
            debuggerObj.sendEval(args[2]);
            break;
          case 'exception':
            debuggerObj.sendExceptionConfig(args[2]);
            break;
          case 'list':
            debuggerObj.listBreakpoints();
            break;
          case 'dump':
            debuggerObj.dump();
            break;
          default:
            logger.error('Unknown command: ' + args[1]);
            break;
        }

        commandInput.val('');
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
    })();


    /**
     * Editor extra events.
     */
    (() => {
      /**
       * Update the breakpoint lines after editor or session changes.
       */
      env.editor.on('change', () => {
        $('#tab-' + session.getActiveID()).addClass('unsaved');
        if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
          session.markBreakpointGutters(debuggerObj, settings, transpiler);
        }
      });

      env.editor.on('changeSession', () => {
        if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
          session.markBreakpointGutters(debuggerObj, settings, transpiler);
        }
      });

      /**
       * Editor mouse click, breakpoint add/delete.
       */
      env.editor.on('guttermousedown', (e) => {
        if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
          let target = e.domEvent.target;
          if (target.className.indexOf('ace_gutter-cell') === -1) {
            return;
          }

          if (!env.editor.isFocused()) {
            return;
          }

          if (e.clientX > 25 + target.getBoundingClientRect().left) {
            return;
          }

          let breakpoints = e.editor.session.getBreakpoints(row, 0);
          let row = e.getDocumentPosition().row;
          let lines = session.getLinesFromRawData(debuggerObj.getBreakpointLines());

          if (lines.includes(row + 1)) {
            if (typeof breakpoints[row] === typeof undefined) {
              env.editor.session.setBreakpoint(row);
              session.addBreakpointID(row, debuggerObj.getNextBreakpointIndex());
              debuggerObj.setBreakpoint(session.getFileNameById(session.getActiveID()) + ':' + parseInt(row + 1));
            } else {
              debuggerObj.deleteBreakpoint(session.getBreakpointID(row));
              env.editor.session.clearBreakpoint(row);
            }
          }

          e.stop();
        }
      });
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
        resize: () => {
          $('#editor-wrapper').css('width', surface.editorHorizontalPercentage() + '%');

          // Resize chart.
          if (surface.getPanelProperty('chart.active')) {
            surface.setChartPanelWidth($('#chart-wrapper').width());

            let tmph = surface.getPanelProperty('chart.height');

            if ($('#chart-wrapper').height() !== 0) {
              tmph = $('#chart-wrapper').height();
            }

            chart.resizeChart(tmph, surface.getPanelProperty('chart.width'));
          }
        },
        stop: (event, ui) => {
          $(ui.originalElement).width($(ui.originalElement).width() / $('#workspace-wrapper').width() * 100 + '%');
          env.editor.resize();
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
          let minHeight = ui.element.resizable('option', 'minHeight');
          let diffH = ui.size.height - ui.originalSize.height;

          if (diffH > ui.originalElement.startHeight - minHeight) {
            diffH = ui.originalElement.startHeight;
            ui.size.height = ui.originalSize.height + diffH - minHeight;
          }

          let tmpHeight = Math.max(surface.getPanelProperty('height'), ui.originalElement.startHeight - diffH);

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
      $(window).resize((e) => {
        if (e.target === window) {

          surface.resetPanelsPercentage();

          if (surface.getPanelProperty('chart.active')) {
            setTimeout(() => {
              surface.setChartPanelHeight($('#chart-wrapper').height());
              surface.setChartPanelWidth($('#chart-wrapper').width());
              chart.resizeChart(surface.getPanelProperty('chart.height'), surface.getPanelProperty('chart.width'));
            }, 100);
          }

          // Resize the info panels and the editor.
          $('#editor-wrapper').css('width', surface.editorHorizontalPercentage() + '%');
          env.editor.resize();
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
