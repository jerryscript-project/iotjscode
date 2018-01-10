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

import { ENGINE_MODE } from './client-debugger';
import Util from './util';

export default class Session {

  /**
   * Constructor.
   *
   * @param {object} env The core environment object.
   * @param {object} surface The main Surface instance.
   */
  constructor(env, surface) {
    this._environment = env;
    this._surface = surface;
    this._editor = env.editor;

    this._id = {
      next: 0,
      active: 0,
    };

    this._data = [];
    this._command = {
      list: [],
      counter: -1,
    };

    this._breakpoint = {
      informationToChart: null,
      IDs: [],
      last: null,
    };

    this._upload = {
      list: [],
      backupList: [],
      allowed: false,
      started: false,
    };

    this._marker = {
      execute: {
        obj: null,
        line: null,
      },
      exception: {
        obj: null,
        line: null,
      },
    };

    this._watch = {
      work: {
        inProgress: false,
        currentExpr: '',
        update: false,
        counter: 0,
      },
      list: {},
    };

    this._contextReset = false;
  }

  /**
   * Types of the line highlight in the editor session.
   */
  get HIGHLIGHT_TYPE() {
    return {
      EXECUTE: 'execute',
      EXCEPTION: 'exception',
    };
  }

  /**
   * Returns the current nextID value.
   *
   * @return {integer}
   */
  getNextID() {
    return this._id.next;
  }

  /**
   * Returns the current activeID value.
   *
   * @return {integer}
   */
  getActiveID() {
    return this._id.active;
  }

  /**
   * Stores a new breakpoint row and index information.
   *
   * @param {integer} row Breakpoint's row.
   * @param {integer} index breakpoint number (constantly growing).
   */
  addBreakpointID(row, index) {
    this._breakpoint.IDs[row] = index;
  }

  /**
   * Returns a specific breakpoint index.
   *
   * @param  {integer} row A row number from the source.
   * @return {integer} Single stored breakpoint index.
   */
  getBreakpointID(row) {
    return this._breakpoint.IDs[row];
  }

  /**
   * Returns the last catched breakpoint's ID.
   *
   * @return {integer} A single breakpoint identifier.
   */
  getLastBreakpoint() {
    return this._breakpoint.last;
  }

  /**
   * Sets the lastBreakpoint to the given value.
   *
   * @param {integer} last A complete breakpoint from the debuggerObj.
   */
  setLastBreakpoint(last) {
    this._breakpoint.last = last;
  }

  /**
   * Returns the chart specific breakpoint informations.
   *
   * @return {string} Formatted string.
   */
  getBreakpointInfoToChart() {
    return this._breakpoint.informationToChart;
  }

  /**
   * Store the chart specific breakpoint informations.
   *
   * @param {string} info Breakpoint informations.
   */
  setBreakpointInfoToChart(info) {
    this._breakpoint.informationToChart = info;
  }

  /**
   * Returns the command line input counter value.
   *
   * @return {integer}
   */
  getCommandCounter() {
    return this._command.counter;
  }

  /**
   * Sets the command line input counter value.
   *
   * @param {integer} count New value of the counter.
   */
  setCommandCounter(count) {
    this._command.counter = count;
  }

  /**
   * Returns the command line input list.
   *
   * @return {array} String array.
   */
  getCommandList() {
    return this._command.list;
  }

  /**
   * Push a new command into the command list.
   *
   * @param {string} comm The last used command.
   */
  addCommandToList(comm) {
    this._command.list.push(comm);
  }

  /**
   * Returns the actual state of the contextReset.
   *
   * @return {boolean} True if the context reset request is active, false otherwise.
   */
  isContextReset() {
    return this._contextReset;
  }

  /**
   * Sets the value of the contextReset.
   *
   * @param {boolean} value The new true or false value.
   */
  setContextReset(value) {
    this._contextReset = value;
  }

  /**
   * Returns the state of the upload and run availability.
   *
   * @return {true} True, if the uplaod and run is activated, false otherwise.
   */
  isUploadAndRunAllowed() {
    return this._upload.allowed;
  }

  /**
   * Changes the state of the upload and run.
   *
   * @param {boolean} value The new true or false value.
   */
  allowUploadAndRun(value) {
    this._upload.allowed = value;
  }

  /**
   * Returns the state of the upload.started.
   *
   * @return {true} True, if the uplaod is started by the user, false otherwise.
   */
  isUploadStarted() {
    return this._upload.started;
  }

  /**
   * Changes the state of the upload.started.
   *
   * @param {boolean} value The new true or false value.
   */
  setUploadStarted(value) {
    this._upload.started = value;
  }

  /**
   * Removes everything from the upload list except the context reset signal.
   */
  resetUploadList() {
    this._upload.list = [0];
  }

  /**
   * Add a session id to the upload list with a specified position.
   *
   * @param {integer} id The id of the session.
   * @param {integer} index Position of the session in the list.
   */
  addFileToUploadList(id, index) {
    if (id !== 0) {
      this.getFileDataById(id).scheduled = true;
    }

    this._upload.list.splice(index, 0, id);

    // Store the changes in the backup list.
    this.createUploadBackupList();
  }

  /**
   * Move a session position in the upload list.
   *
   * @param {integer} from Old position of the session.
   * @param {integer} to New position of the session.
   */
  moveFileInUploadList(from, to) {
    this._upload.list.splice(to, 0, this._upload.list.splice(from, 1)[0]);

    // Store the changes in the backup list.
    this.createUploadBackupList();
  }

  /**
   * Removes a session from the upload list.
   *
   * @param {integer} id Identifier of the selected session.
   */
  removeFileFromUploadList(id) {
    if (this.getFileDataById(id)) {
      this.getFileDataById(id).scheduled = false;
    }
    this._upload.list.splice(this._upload.list.indexOf(id), 1);

    // Store the changes in the backup list.
    this.createUploadBackupList();
  }

  /**
   * Checks whether the given session id is in the upload list or not.
   *
   * @param {integer} id The identifier of the session.
   * @return {boolean} Returns true if the session is in the list, false otherwise.
   */
  isFileInUploadList(id) {
    return (this._upload.list.indexOf(id) != -1) ? true : false;
  }

  /**
   * Copies the upload list into the backup list.
   */
  createUploadBackupList() {
    this._upload.backupList = this._upload.list.slice();
  }

  /**
   * Returns the upload backup list.
   *
   * @return {array} Array of file id list.
   */
  getUploadBackupList() {
    return this._upload.backupList;
  }

  /**
   * Returns the array of the selected session ids from the upload list.
   *
   * @return {array} The id list.
   */
  getUploadList() {
    return this._upload.list;
  }

  /**
   * Removes the first element of the upload list.
   */
  shiftUploadList() {
    this._upload.list.shift();
  }

  /**
   * Returns the watch section progress value.
   *
   * @return {boolean} True if a watch expression eval is in progress, false otherwise.
   */
  isWatchInProgress() {
    return this._watch.work.inProgress;
  }

  /**
   * Change the watch section progress flag to false.
   */
  stopWatchProgress() {
    this._watch.work.inProgress = false;
  }

  /**
   * Returns that expression which is under evaluation at the moment.
   *
   * @return {string} Watch Expression.
   */
  getWatchCurrentExpr() {
    return this._watch.work.currentExpr;
  }

  /**
   * Creates a new property in the watch list for the new watch expression.
   * If the debugger client is connected, it will try to evaluate the expression,
   * otherwise it will update the watch list.
   *
   * @param {object} debuggerObj DebuggerClient module instance.
   * @param {string} expr Expression which will be added into the list.
   */
  addWatchExpression(debuggerObj, expr) {
    this._watch.list[expr] = '&ltnot available&gt';

    if (debuggerObj && debuggerObj.getEngineMode() === ENGINE_MODE.BREAKPOINT) {
      this._watch.work.inProgress = true;
      this._watch.work.currentExpr = expr;
      debuggerObj.sendEval(expr);
    } else {
      this._surface.updateWatchPanelList(this._watch.list);
      this._surface.updateWatchPanelButtons(debuggerObj);
    }
  }

  /**
   * Add a value to a specific expression.
   * This function will be called after the debugger engine evaluated the expression.
   * This cooperates with the updateWatchExpressions function,
   * if the watch work counter is not equal to the number of the list elements.
   *
   * @param {object} debuggerObj DebuggerClient module instance.
   * @param {string} expr Expression which was evaluated.
   * @param {string} value The new value of the expression.
   */
  addWatchExpressionValue(debuggerObj, expr, value) {
    if (this._watch.list[expr]) {
      if (value !== '') {
        this._watch.list[expr] = value;
      }

      if (this._watch.work.update && this._watch.work.counter < Object.keys(this._watch.list).length) {
        this.updateWatchExpressions(debuggerObj);
      } else {
        this._watch.work.update = false;
        this._watch.work.counter = 0;
      }

      if (!this._watch.work.update) {
        this._surface.updateWatchPanelList(this._watch.list);
        this._surface.updateWatchPanelButtons(debuggerObj);
      }
    }
  }

  /**
   * Updates every expression in the watch list.
   * This function will grab only one expression from the list
   * (based on the watch work counter) and send that to the engine.
   *
   * @param {object} debuggerObj DebuggerClient module instance.
   */
  updateWatchExpressions(debuggerObj) {
    if (debuggerObj &&
        debuggerObj.getEngineMode() === ENGINE_MODE.BREAKPOINT &&
        !$.isEmptyObject(this._watch.list)) {
      this._watch.work.update = true;

      let expr = Object.keys(this._watch.list)[this._watch.work.counter];

      this._watch.work.inProgress = true;
      this._watch.work.currentExpr = expr;

      debuggerObj.sendEval(expr);

      this._watch.work.counter++;
    }
  }

  /**
   * Removes a specific expression from the watch list.
   *
   * @param {string} expr Expression which will be removed.
   */
  removeWatchExpression(expr) {
    delete this._watch.list[expr];
  }

  /**
   * Removes every expression from the watch list by making the list empty.
   */
  removeAllWatchExpression() {
    this._watch.list = {};
  }

  /**
   * Sets back the <not available> text in each watch expression.
   */
  neutralizeWatchExpressions() {
    if (Object.keys(this._watch.list).length) {
      for (let expr in this._watch.list) {
        if (this._watch.list.hasOwnProperty(expr)) {
          this._watch.list[expr] = '&ltnot available&gt';
        }
      }

      this._surface.updateWatchPanelList(this._watch.list);
    }
  }

  /**
   * Creates a new session based on the given parameters.
   *
   * @param {string} name The filename.
   * @param {string} cont The file content (the source code).
   * @param {boolean} saved The file saved status.
   */
  createNewFile(name, cont, saved = true) {
    // Create a new document for the editor from the trimmed content.
    let doc = new this._environment.Document(cont);
    // Create a new javascript mode session from the document.
    let eSession = new this._environment.EditSession(doc, 'ace/mode/javascript');

    // Store the e-session.
    this._data.push({
      id: ++this._id.next,
      saved: saved,
      scheduled: false,
      name: name,
      editSession: eSession,
    });

    this._surface.showEditor();

    this.updateTabs(this._id.next, name);
    this.switchFile(this._id.next);

    // Enable the save button.
    this._surface.toggleButton(true, 'save-file-button');
  }

  /**
   * Sets a simple starting file into the editor.
   * This file can not be closed or modified.
   */
  setWelcomeFile() {
    let welcome = '/**\n' +
                  ' * IoT.js Code\n' +
                  ' * Browser based IDE including debugger for IoT.js.\n' +
                  ' */\n';

    this.createNewFile('welcome.js', welcome, true);
  }

  /**
   * Switches the editor session.
   *
   * @param {integer} id The id of the desired file.
   */
  switchFile(id) {
    // Remove the highlight from the current file.
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXECUTE);
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXCEPTION);

    // Select the right tab on the tabs panel.
    this.selectTab(id);

    // Mark the selected file as active.
    this._id.active = id;
    // Change the current e-session through the editor's API.
    this._editor.setSession(this.getFileSessionById(id));

    // Refresh the available breakpoint lines in the editor based on the new file/e-session.
    if (this._breakpoint.last !== null &&
        this._breakpoint.last.func.sourceName.endsWith(this.getFileNameById(id))) {
      this.highlightLine(this.HIGHLIGHT_TYPE.EXECUTE, this._breakpoint.last.line - 1);
    }

    if (this._breakpoint.last === null) {
      this.removeBreakpointGutters();
    }
  }

  /**
   * Returns a file name based on the given ID.
   *
   * @param {integer} id The searched file ID.
   * @return {mixed} Returns the file name as string if exists, undefined otherwise.
   */
  getFileNameById(id) {
    let f = this._data.find(x => x.id === id);
    return f ? f.name : undefined;
  }

  /**
   * Returns a file id based on the given name.
   *
   * @param {string} name The searched file name.
   * @return {mixed} Returns the file id if exists, undefined otherwise.
   */
  getFileIdByName(name) {
    let f = this._data.find(x => name.endsWith(x.name));
    return f ? f.id : undefined;
  }

  /**
   * Checks if the given file name is already taken.
   *
   * @param {string} name The new name of a file.
   * @return {boolean} True if the name is taken, false otherwise.
   */
  isFileNameTaken(name) {
    return this._data.find(x => name.localeCompare(x.name) === 0) ? true : false;
  }

  /**
   * Returns a file edit session based on the given id.
   *
   * @param {integer} id The searched file ID.
   * @return {mixed} Returns the file editSession if exists, undefined otherwise.
   */
  getFileSessionById(id) {
    let f = this._data.find(x => x.id === id);
    return f ? f.editSession : undefined;
  }

  /**
   * Removes a file from the inner array,
   * based on a given attribute identifier and a value pair.
   *
   * @param {string} attr The name of the attribute.
   * @param {mixed} value The value of the attribute.
   */
  deleteFileByAttr(attr, value) {
    this._data = this._data.filter(x => x[attr] !== value);

    if (this._data.length === 1) {
      this._surface.toggleButton(false, 'save-file-button');
    }
  }

  /**
   * Returns the left or the right neighbour of a file.
   * This is possible, because we store the files "in a straight line".
   *
   * @param {integer} id The base file id.
   * @return {mixed} Return the neighbour id if it exists, undefined otherwise.
   */
  getFileNeighbourById(id) {
    for (let i = 0; i < this._data.length; i++) {
      if (this._data[i].id === id) {
        if (this._data[i - 1] !== undefined) {
          return this._data[i - 1].id;
        }
        if (this._data[i + 1] !== undefined) {
          return this._data[i + 1].id;
        }
      }
    }

    return undefined;
  }

  /**
   * Returns every stored information about one data.
   *
   * @param {integer} id The selected file id.
   * @return {mixed} Returns the data if exists, undefined otherwise.
   */
  getFileDataById(id) {
    return this._data.find(x => x.id === id);
  }

  /**
   * Returns every stored file data with every stored information.
   *
   * @return {object} Returns the data array.
   */
  getAllData() {
    return this._data;
  }

  /**
   * Searches the given name in the stored files.
   *
   * @param {string} name Searched file name.
   * @return {boolean} Returns true if the given name exists, false otherwise.
   */
  fileNameCheck(name) {
    return this.getFileIdByName(name) ? true : false;
  }

  /**
   * Checks whether the opened and the device sources match.
   *
   * @param {string} filename Name of the stored file.
   * @param {string} content Content of the current source.
   */
  fileContentCheck(filename, content) {
    return (content === this.getFileSessionById(this.getFileIdByName(filename)).getValue()) ? true : false;
  }

  /**
   * Resets the selected file source code content from the debugger engine.
   *
   * @param {string} filename Name of the stored content.
   * @param {string} content The source from the debugger engine.
   */
  resetFileContent(filename, content) {
    this.getFileSessionById(this.getFileIdByName(filename)).setValue(content);
  }

  /**
   * Marks every valid, available breakpoint line in the currently opened file.
   *
   * @param {object} debuggerObj Jerry client object.
   */
  markBreakpointGutters(debuggerObj, settings, transpiler) {
    if (debuggerObj && debuggerObj.getEngineMode() !== ENGINE_MODE.DISCONNECTED) {
      let lines = this.getLinesFromRawData(debuggerObj.getBreakpointLines());

      if (settings.getValue('debugger.transpileToES5') && !transpiler.isEmpty()) {
        let newLines = [];
        for (let i of lines) {
          let originLine = transpiler.getOriginalPositionFor(this.getFileNameById(this._id.active), i, 0);
          if (originLine.line) {
            newLines.push(originLine.line);
          }
        }

        lines = newLines.slice();
      }

      if (lines.length !== 0) {
        lines.sort((a, b) => {
          return a - b;
        });

        for (let i = this._editor.session.getLength(); i > 0; i--) {
          if (lines.includes(i) === false) {
            this._editor.session.removeGutterDecoration(i - 1, 'invalid-gutter-cell');
            this._editor.session.addGutterDecoration(i - 1, 'invalid-gutter-cell');
          }
        }
      }
    }
  }

  /**
   * Removes the invalid gutter cell css class from the editor session.
   */
  removeBreakpointGutters() {
    for (let i = this._editor.session.getLength(); i > 0; i--) {
      this._editor.session.removeGutterDecoration(i - 1, 'invalid-gutter-cell');
    }
  }

  /**
   * Returns every valid, available line in the currently active file.
   *
   * @param {object} raw Line information from the debuggerObj.
   * @return {array} Array of the file lines.
   */
  getLinesFromRawData(raw) {
    let lines = [],
        sessionName = this.getFileNameById(this._id.active);

    for (let i in raw) {
      if (raw[i].sourceName.endsWith(sessionName)) {
        lines.push(raw[i].line);
      }
    }

    return lines;
  }

  /**
   * Highlights a single line in the editor session.
   *
   * @param {integer} type Type of the highlight from the HIGHLIGHT_TYPE.
   * @param {integer} line Selected line.
   */
  highlightLine(type, line) {
    let Range = window.ace.require('ace/range').Range;

    let options = {
      lineName: `${type}-marker`,
      gutterName: `${type}-gutter-cell-marker`,
    };

    // Remove each kind of highlight.
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXECUTE);
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXCEPTION);

    this._marker[type].obj = this._editor.session.addMarker(new Range(line, 0, line, 1), options.lineName, 'fullLine');

    this._editor.session.addGutterDecoration(line, options.gutterName);
    this._editor.scrollToLine(line, true, true, function() {});
    this._marker[type].line = line;
  }

  /**
   * Removes the highlight (border) from the last highlighted line.
   *
   * @param {integer} type Type of the highlight from the HIGHLIGHT_TYPE.
   */
  unhighlightLine(type) {
    this._editor.getSession().removeMarker(this._marker[type].obj);
    this._editor.session.removeGutterDecoration(this._marker[type].line, `${type}-gutter-cell-marker`);
  }

  /**
   * Deletes the breakpoints from the session and from the editor.
   */
  deleteBreakpointsFromEditor() {
    this.setLastBreakpoint(null);

    for (let i in this._breakpoint.IDs) {
      if (this._breakpoint.IDs.hasOwnProperty(i)) {
        this._editor.session.clearBreakpoint(i);
      }
    }

    Util.clearElement($('#breakpoints-table-body'));
  }

  /**
   * Appends the given tab into the session tabs panel.
   *
   * @param {integer} id New tab ID.
   * @param {string} name New tab name (aka. file name).
   */
  updateTabs(id, name) {
    let $tabs = $('#file-tabs');

    $tabs.append(
      `<div class="tablinks" id="tab-${id}" title="${name}"> ${name}` +
        '<i class="fa fa-times" aria-hidden="true"></i>' +
      '</div>'
    );

    // Update the editor height based on the new header height.
    this._surface.updateEditorHeight();

    $(`#tab-${id}`).on('click', () => {
      this.switchFile(id);
    });

    $(`#tab-${id} i`).on('click', () => {
      this.closeTab(id);
    });
  }

  /**
   * Sets the selected tab to active state in the tab panel.
   *
   * @param {integer} id Selected tab ID.
   */
  selectTab(id) {
    // Get all elements with class='tablinks' and remove the class 'active'
    let tablinks = $('.tablinks');

    for (let link of tablinks) {
      link.className = link.className.replace(' active', '');
    }

    // Set the current tab active.
    $(`#tab-${id}`).addClass('active');
  }

  /**
   * Closes the selected tab and deletes the file from the data.
   *
   * @param {integer} id Selected tab ID.
   */
  closeTab(id) {
    // Remove the session tab from the session bar.
    $(`#tab-${id}`).remove();

    // If the selected session is the current file switches to an other existing file.
    if (id === this._id.active) {
      const nID = this.getFileNeighbourById(id);

      if (nID !== undefined) {
        this.switchFile(nID);
      } else {
        this._editor.session.setValue('');
        this._surface.hideEditor();
      }
    }

    // Delete the selected file.
    this.deleteFileByAttr('id', id);

    // Update the editor height based on the new header height.
    this._surface.updateEditorHeight();

    // Remove the session from the upload list if it was selected.
    if (this.isFileInUploadList(id)) {
      this.removeFileFromUploadList(id);
    }

    // Refresh the run panel list.
    if (this._surface.getPanelProperty('run.active')) {
      this._surface.updateRunPanel(this._surface.RUN_UPDATE_TYPE.ALL, null, this);
    }
  }

  /**
   * Removes the stored data and sets back the variables to their default values.
   */
  reset() {
    Util.clearElement($('#backtrace-table-body'));
    this.deleteBreakpointsFromEditor();
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXECUTE);
    this.unhighlightLine(this.HIGHLIGHT_TYPE.EXCEPTION);
    this.removeBreakpointGutters();

    this._breakpoint.informationToChart = null;
    this._breakpoint.IDs = [];
    this._breakpoint.last = null;

    this._upload.list = this._upload.backupList;
    this._upload.allowed = false;


    this._marker.execute = this._marker.exception = {
      obj: null,
      line: null,
      active: false,
    };

    if (this.isFileInUploadList(0)) {
      this.removeFileFromUploadList(0);
    }
  }
}
