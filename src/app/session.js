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

import { ENGINE_MODE } from './modules/client/debugger';
import { SURFACE_RUN_UPDATE_TYPE } from './surface';
import Glyph, { GLYPH_TYPE } from './modules/session/glyph';
import Marker, { MARKER_TYPE } from './modules/session/marker';
import Util from './util';

/**
 * The content of the welcome.js file on the begining.
 */
const welcomeContent = '/**\n' +
                       ' * IoT.js Code\n' +
                       ' * Browser based IDE including debugger for IoT.js.\n' +
                       ' */\n';

/**
 * Action types for sync the source code between the client and the engine.
 */
export const SOURCE_SYNC_ACTION = {
  NOP: 0,
  LOAD: 1,
  RELOAD: 2,
};

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

    this._id = {
      next: 0,
      last: 0,
      active: 0,
      uNext: 0,
    };

    this._models = [];

    this._command = {
      list: [],
      counter: -1,
    };

    this._lastBreakpoint = null;
    this._chartInfo = null;

    this._upload = {
      list: [],
      backupList: [],
      allowed: false,
      started: false,
    };

    this._marker = new Marker(this._environment.editor);
    this._glyph = new Glyph(this._environment.editor);

    this._watch = {
      work: {
        inProgress: false,
        currentExpr: '',
        update: false,
        counter: 0,
      },
      list: {},
    };

    this._jerrySource = {
      name: '',
      source: '',
      reset: true,
      action: SOURCE_SYNC_ACTION.NOP,
    };

    this._contextReset = false;
  }

  get lastBreakpoint() {
    return this._lastBreakpoint;
  }

  set lastBreakpoint(last) {
    this._lastBreakpoint = last;
  }

  get chartInfo() {
    return this._chartInfo;
  }

  set chartInfo(info) {
    this._chartInfo = info;
  }

  /**
   * Returns the current nextID value.
   *
   * @return {integer}
   */
  get nextID() {
    return this._id.next;
  }

  /**
   * Returns the current activeID value.
   *
   * @return {integer}
   */
  get activeID() {
    return this._id.active;
  }

  /**
   * Returns the command line input counter value.
   *
   * @return {integer}
   */
  get commandCounter() {
    return this._command.counter;
  }

  /**
   * Sets the command line input counter value.
   *
   * @param {integer} count New value of the counter.
   */
  set commandCounter(count) {
    this._command.counter = count;
  }

  /**
   * Returns the command line input list.
   *
   * @return {array} String array.
   */
  get commandList() {
    return this._command.list;
  }

  /**
   * Returns the actual state of the contextReset.
   *
   * @return {boolean} True if the context reset request is active, false otherwise.
   */
  get isContextReset() {
    return this._contextReset;
  }

  /**
   * Sets the value of the contextReset.
   *
   * @param {boolean} value The new true or false value.
   */
  set contextReset(value) {
    this._contextReset = value;
  }

  /**
   * Returns the state of the upload and run availability.
   *
   * @return {true} True, if the uplaod and run is activated, false otherwise.
   */
  get isUploadAndRunAllowed() {
    return this._upload.allowed;
  }

  /**
   * Changes the state of the upload and run.
   *
   * @param {boolean} value The new true or false value.
   */
  set allowUploadAndRun(value) {
    this._upload.allowed = value;
  }

  /**
   * Returns the state of the upload.started.
   *
   * @return {true} True, if the uplaod is started by the user, false otherwise.
   */
  get isUploadStarted() {
    return this._upload.started;
  }

  /**
   * Changes the state of the upload.started.
   *
   * @param {boolean} value The new true or false value.
   */
  set uploadStarted(value) {
    this._upload.started = value;
  }

  /**
   * Returns the upload backup list.
   *
   * @return {array} Array of file id list.
   */
  get uploadBackupList() {
    return this._upload.backupList;
  }

  /**
   * Returns the array of the file ids from the upload list.
   *
   * @return {array} The id list.
   */
  get uploadList() {
    return this._upload.list;
  }

  /**
   * Returns the watch section progress value.
   *
   * @return {boolean} True if a watch expression eval is in progress, false otherwise.
   */
  get isWatchInProgress() {
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
  get watchCurrentExpr() {
    return this._watch.work.currentExpr;
  }

  /**
   * Sets the given action type in the jerry source object.
   *
   * @param {integer} type Type of the new action.
   */
  set jerrySourceAction(type) {
    this._jerrySource.action = type;
  }

  /**
   * Checks that the auto source sync is enabled or not.
   *
   * @returns {boolean} True if the auto sync is enabled, false otherwise.
   */
  get isAutoSourceSync() {
    return this._jerrySource.reset;
  }

  /**
   * Changes the value of the auto source sync.
   *
   * @param {boolean} value New value of the auto sync option.
   */
  set autoSourceSync(value) {
    this._jerrySource.reset = value;
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
   * Removes the first element of the upload list.
   */
  shiftUploadList() {
    this._upload.list.shift();
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

    if (debuggerObj && debuggerObj.engineMode === ENGINE_MODE.BREAKPOINT) {
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
        debuggerObj.engineMode === ENGINE_MODE.BREAKPOINT &&
        !$.isEmptyObject(this._watch.list)) {
      this._watch.work.update = true;

      const expr = Object.keys(this._watch.list)[this._watch.work.counter];

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
      for (const expr in this._watch.list) {
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
   * @param {string} value The file content (the source code).
   */
  createNewFile(name, value) {
    const model = window.monaco.editor.createModel(value, 'text/javascript');

    this._models.push({
      id: ++this._id.next,
      scheduled: false,
      name: name,
      model: model,
      state: null,
    });

    this._surface.showEditor();

    // Remove the welcome file if that is untouched.
    if (this._id.next !== 1 && this.isWelcomeFileUntouched()) {
      this.closeTab(1);
    }

    this.updateTabs(this._id.next, name);
    this.switchFile(this._id.next);
  }

  /**
   * Creates or restores 'unknown' file which is comes from an eval.
   *
   * @param {string} content Text value of the unknown source.
   * @returns {string} The temporary name of the unknown source code.
   */
  handleUnknownFile(content) {
    const id = this.getFileIdByContent(content);
    let name;
    if (!id) {
      name = `unknown-${++this._id.uNext}`;
      this.createNewFile(name, content);
    } else {
      name = this.getFileNameById(id);
      if (!this.fileContentCheck(name, content)) {
        this.resetFileContent(name, content);
      }
    }

    return name;
  }


  /**
   * Checks that the welcome file is exists and untouched.
   *
   * @returns {boolean} True, if the welcome file exists and untouched, false otherwise.
   */
  isWelcomeFileUntouched() {
    const w = this.getFileDataById(1);
    return (w && !w.scheduled && w.model.getValue() === welcomeContent) ? true : false;
  }

  /**
   * Sets a simple starting file into the editor.
   * This file can not be closed or modified.
   */
  setWelcomeFile() {
    this.createNewFile('welcome.js', welcomeContent);
  }

  /**
   * Switches the editor session.
   *
   * @param {integer} id The id of the desired file.
   */
  switchFile(id) {
    const last = this._id.active;
    // Remove the highlight from the current file.
    this.unhighlightLine();

    // Select the right tab on the tabs panel.
    this.selectTab(id);
    // Marked the selected file as an active.
    this._id.active = id;

    if (last !== 0) {
      this._models.find(x => x.id === id).state = this._environment.editor.saveViewState();
    }

    this._environment.editor.setModel(this.getFileModelById(id));
    if (last !== 0) {
      this._environment.editor.restoreViewState(this.getFileStateById(id));
    }
    this._environment.editor.focus();

    // Refresh the available breakpoint lines in the editor based on the new file/e-session.
    if (this._lastBreakpoint !== null &&
      this._lastBreakpoint.func.sourceName.endsWith(this.getFileNameById(id))) {
      this.highlightLine(MARKER_TYPE.EXECUTE, this._lastBreakpoint.line);
    }
  }

  /**
   * Returns a file name based on the given ID.
   *
   * @param {integer} id The searched file ID.
   * @return {mixed} Returns the file name as string if exists, undefined otherwise.
   */
  getFileNameById(id) {
    const f = this._models.find(x => x.id === id);
    return f ? f.name : undefined;
  }

  /**
   * Returns a file id based on the given name.
   *
   * @param {string} name The searched file name.
   * @return {mixed} Returns the file id if exists, undefined otherwise.
   */
  getFileIdByName(name) {
    const f = this._models.find(x => name.endsWith(x.name));
    return f ? f.id : undefined;
  }

  /**
   * Returns a file id based on the given content.
   *
   * @param {string} content The searched file content.
   * @returns {mixed} Returns the file id if exists, undefined otherwise.
   */
  getFileIdByContent(content) {
    const f = this._models.find(x => content === x.model.getValue());
    return f ? f.id : undefined;
  }

  /**
   * Checks if the given file name is already taken.
   *
   * @param {string} name The new name of a file.
   * @return {boolean} True if the name is taken, false otherwise.
   */
  isFileNameTaken(name) {
    return this._models.find(x => name.localeCompare(x.name) === 0) ? true : false;
  }

  /**
   * Returns a file model based on the given id.
   *
   * @param {integer} id The searched file ID.
   * @return {mixed} Returns the file editSession if exists, undefined otherwise.
   */
  getFileModelById(id) {
    const f = this._models.find(x => x.id === id);
    return f ? f.model : undefined;
  }

  /**
   * Returns a file state based on the given id.
   *
   * @param {integer} id The searched file ID.
   */
  getFileStateById(id) {
    const f = this._models.find(x => x.id === id);
    return f ? f.state : undefined;
  }

  /**
   * Removes a file from the inner array,
   * based on a given attribute identifier and a value pair.
   *
   * @param {string} attr The name of the attribute.
   * @param {mixed} value The value of the attribute.
   */
  deleteFileByAttr(attr, value) {
    this._models = this._models.filter(x => x[attr] !== value);

    if (this._models.length === 0) {
      this._id.active = 0;
      this._surface.toggleButton(false, 'save-file-button');
    }
  }

  /**
   * Changes the saved file property in the selected file session.
   *
   * @param {integer} id Identifier of the selected file.
   * @param {boolean} saved The new value of the saved property.
   */
  changeFileSavedProperty(id, saved) {
    this._data.find(x => x.id === id).saved = saved;
  }

  /**
   * Returns the left or the right neighbour of a file.
   * This is possible, because we store the files "in a straight line".
   *
   * @param {integer} id The base file id.
   * @return {mixed} Return the neighbour id if it exists, undefined otherwise.
   */
  getFileNeighbourById(id) {
    for (let i = 0; i < this._models.length; i++) {
      if (this._models[i].id === id) {
        if (this._models[i - 1] !== undefined) {
          return this._models[i - 1].id;
        }
        if (this._models[i + 1] !== undefined) {
          return this._models[i + 1].id;
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
    return this._models.find(x => x.id === id);
  }

  /**
   * Returns every stored file data with every stored information.
   *
   * @return {object} Returns the data array.
   */
  getAllData() {
    return this._models;
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
    return (content === this.getFileModelById(this.getFileIdByName(filename)).getValue()) ? true : false;
  }

  /**
   * Resets the selected file source code content from the debugger engine.
   *
   * @param {string} filename Name of the stored content.
   * @param {string} content The source from the debugger engine.
   */
  resetFileContent(filename, content) {
    const file = this.getFileDataById(this.getFileIdByName(filename));

    // Set the new content.
    file.model.setValue(content);

    // Sets the breakpoints.
    this._glyph.renderByFile(this._id.active);

    // Sets the marker.
    this.highlightLine(MARKER_TYPE.EXECUTE, this._lastBreakpoint.line);
  }

  /**
   * Marks every valid, available breakpoint line in the currently opened file.
   *
   * @param {object} debuggerObj Jerry client object.
   * @param {object} settings Settings module object.
   * @param {object} transpiler Transpiler module object.
   */
  markBreakpointLines(debuggerObj, settings, transpiler) {
    if (debuggerObj && debuggerObj.engineMode !== ENGINE_MODE.DISCONNECTED) {
      if (!this._glyph.isFileInitialized(this._id.active)) {
        const lines = this.getLinesFromRawData(debuggerObj.getBreakpointLines(), settings, transpiler);

        if (lines.length !== 0) {
          lines.sort((a, b) => a - b);

          // Clear the list.
          this._glyph.removeByFile(this._id.active);

          for (let i = this._environment.editor.getModel().getLineCount(); i > 0; i--) {
            if (lines.includes(i)) {
              this._glyph.add(GLYPH_TYPE.INACTIVE, this._id.active, i);
            }
          }
        }
      }

      // Decorate the revealed line.
      this._glyph.renderByFile(this._id.active);
    }
  }

  /**
   * Enables or disables a breakpoint based on the line information.
   *
   * @param {integer} line The selected line where the user wants to enable or disable the breakpoint.
   * @param {object} debuggerObj The Jerry client object.
   * @param {object} settings The settings module object.
   * @param {object} transpiler The transpiler module object.
   */
  toggleBreakpoint(line, debuggerObj, settings, transpiler) {
    const lines = this.getLinesFromRawData(debuggerObj.getBreakpointLines(), settings, transpiler);

    if (lines.includes(line)) {
      // The selected breakpoint is alerady activated, so inactivate it.
      if (this._glyph.isLineActive(this._id.active, line)) {
        this._glyph.change(this._id.active, line, GLYPH_TYPE.INACTIVE);
        debuggerObj.deleteBreakpoint(debuggerObj.breakpoints.getActiveBreakpointIndexByLine(line));
      } else {
        // Activate the selected breakpoint.
        this._glyph.change(this._id.active, line, GLYPH_TYPE.ACTIVE);
        debuggerObj.setBreakpoint(`${this.getFileNameById(this._id.active)}:${line}`);
      }

      // Render the final version of the glyph list.
      this._glyph.renderByFile(this._id.active);
    }
  }

  /**
   * Returns every valid, available line in the currently active file.
   *
   * @param {object} raw Line information from the debuggerObj.
   * @return {array} Array of the file lines.
   */
  getLinesFromRawData(raw, settings, transpiler) {
    let lines = [],
        sessionName = this.getFileNameById(this._id.active);

    for (const i in raw) {
      if (raw[i].sourceName.endsWith(sessionName)) {
        lines.push(raw[i].line);
      }
    }

    if (settings.getValue('debugger.transpileToES5') && !transpiler.isEmpty()) {
      const newLines = [];
      for (const i of lines) {
        const originLine = transpiler.getOriginalPositionFor(this.getFileNameById(this._id.active), i, 0);
        if (originLine.line) {
          newLines.push(originLine.line);
        }
      }

      lines = newLines.slice();
    }

    return lines;
  }

  /**
   * Highlights a single line in the editor session.
   *
   * @param {integer} type Type of the highlight from the MARKER_TYPE.
   * @param {integer} line Selected line.
   */
  highlightLine(type, line) {
    // Reveal and set the right position in the editor.
    this._environment.editor.revealLineInCenter(line);

    // Set the new marker.
    this._marker.set(type, line);
  }

  /**
   * Removes the highlight (border) from the last highlighted line.
   */
  unhighlightLine() {
    // Remove the line marker.
    this._marker.remove();
  }

  /**
   * Appends the given tab into the session tabs panel.
   *
   * @param {integer} id New tab ID.
   * @param {string} name New tab name (aka. file name).
   */
  updateTabs(id, name) {
    const $tabs = $('#file-tabs');

    $tabs.append(
      `<div class="tablinks" id="tab-${id}" title="${name}"> ${name}` +
        '<i class="fa fa-times" aria-hidden="true"></i>' +
      '</div>'
    );

    // Update the editor height based on the new header height.
    this._environment.editor.layout(this._surface.getEditorContainerDimensions());

    $(`#tab-${id}`).on('click', () => this.switchFile(id));
    $(`#tab-${id} i`).on('click', () => this.closeTab(id));
  }

  /**
   * Sets the selected tab to active state in the tab panel.
   *
   * @param {integer} id Selected tab ID.
   */
  selectTab(id) {
    // Get all elements with class='tablinks' and remove the class 'active'
    const tablinks = $('.tablinks');

    for (const link of tablinks) {
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
        this._surface.hideEditor();
      }
    }

    // Delete the selected file.
    this.deleteFileByAttr('id', id);

    // Update the editor height based on the new header height.
    this._environment.editor.layout(this._surface.getEditorContainerDimensions());

    // Remove the session from the upload list if it was selected.
    if (this.isFileInUploadList(id)) {
      this.removeFileFromUploadList(id);
    }

    // Refresh the run panel list.
    if (this._surface.getPanelProperty('run.active')) {
      this._surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, undefined, this);
    }
  }

  /**
   * Stores the given source for backup.
   *
   * @param {string} name Name of the source file.
   * @param {string} source Source code in text.
   */
  storeJerrySource(name, source) {
    this._jerrySource.name = name.split('/').pop();
    this._jerrySource.source = source;
  }

  /**
   * Sync the stored source code (which is come from the engine).
   * Loads the source into a new file if that is new or
   * reloads the source in the current model if that is already loaded.
   */
  syncSourceFromJerry() {
    switch (this._jerrySource.action) {
      case SOURCE_SYNC_ACTION.LOAD:
        this.createNewFile(this._jerrySource.name, this._jerrySource.source, true);

        if (this._surface.getPanelProperty('run.active')) {
          this._surface.updateRunPanel(SURFACE_RUN_UPDATE_TYPE.ALL, undefined, this);
        }
        break;
      case SOURCE_SYNC_ACTION.RELOAD:
        this.resetFileContent(this._jerrySource.name, this._jerrySource.source);
        break;
      default:
        break;
    }
  }

  /**
   * Removes the stored data and sets back the variables to their default values.
   */
  reset() {
    Util.clearElement($('#backtrace-table-body'));
    $('#backtrace-scroll').scrollTop(0);
    this.unhighlightLine();
    this._glyph.removeAll();
    this._marker.remove();

    this._lastBreakpoint = null;
    this._chartInfo = null;

    this._upload.list = this._upload.backupList;
    this._upload.allowed = false;
    this._jerrySource.action = SOURCE_SYNC_ACTION.NOP;
    this._jerrySource.reset = true;

    if (this.isFileInUploadList(0)) {
      this.removeFileFromUploadList(0);
    }
  }
}
