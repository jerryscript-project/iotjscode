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

import 'bootstrap/dist/css/bootstrap.min.css';
import 'jquery-ui-dist/jquery-ui.min.css';
import 'font-awesome/css/font-awesome.min.css';
import 'c3/c3.min.css';
import './app.scss';

import Logger from './logger';
import Session from './session';
import Surface from './surface';
import DebuggerClient from './client-protocol';
import MemoryChart from './memory-chart';
import Completer from './completer';

import 'filesaver';
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
  var debuggerObj = null;

  /**
   * Core enviroment variables.
   */
  var env = {
    editor: ace.edit("editor"),
    basePath: "ace",
    langTools: null,
    config: null,
    iotjsCompleter: null,
    EditSession: null,
    Document: null
  };

  /**
   * Costum keybindings.
   */
  var keybindings = {
    ace: null,
    vim: "ace/keyboard/vim",
    emacs: "ace/keyboard/emacs",
    custom: null, // Create own bindings here.
  };

  /**
   * Keycodes
   */
  var keys = {
    upArrow: 38,
    downArrow: 40
  };

  /**
   * Modul objects.
   */
  var logger = new Logger($("#console-panel"));
  var surface = new Surface();
  var session = new Session(env, surface);
  var chart = new MemoryChart(session, surface);
  var completer = new Completer();

  /**
   * Document ready.
   */
  $(document).ready(function() {
    // Init the ACE editor.
    env.langTools = ace.require("ace/ext/language_tools");
    env.config = ace.require("ace/config");
    env.config.set("packaged", true);
    env.config.set("basePath", env.basePath);
    env.config.set("workerPath", env.basePath);
    env.config.set("modePath", env.basePath);
    env.config.set("themePath", env.basePath);

    env.editor.resize();
    env.editor.setTheme("ace/theme/chrome");
    env.EditSession = ace.require("ace/edit_session").EditSession;
    env.Document = ace.require("ace/document").Document;
    env.editor.session.setMode("ace/mode/javascript");
    env.editor.setShowInvisibles(false);

    // Enable the autocomplete and snippets.
    env.editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true
    });

    // Add the IoT.js completer to the editor language tools.
    env.langTools.addCompleter({
      getCompletions: function(editor, session, pos, prefix, callback) {
        if (prefix.length === 0) {
          callback(null, []);
          return;
        }

        var wordList = completer.getCompleterWordList(completer.iotjsFunctions,
          prefix,
          completer.lookingForModules(env.editor.session.getValue()));

        callback(null, wordList.map(function(ea) {
          return {
            name: ea.word,
            value: ea.word,
            score: ea.score,
            meta: "IoT.js " + ea.meta
          }
        }));
      }
    });

    // Workaround for scrolling problem.
    env.editor.$blockScrolling = Infinity;

    // Init the blocked welcome session.
    session.setWelcomeFile();

    /**
     * Sidenav toggle button click.
     */
    $("#sidenav-toggle-button").on("click", function() {
      surface.toggleSidenav(chart);
    });

    /**
     * Sidenav extra toggles
     */
    $(".extra-sidenav-toggle").on("click", function(e) {
      surface.toggleSidenavExtra($(e.currentTarget).data("eid"));
    });

    /**
     * Panel switch event from the sidenav.
     */
    $(".sidenav-panel-toggle").on("click", function(e) {
      surface.togglePanel($(e.currentTarget).data("pid"), chart);

      if (surface.getPanelProperty("chart.active") &&
        debuggerObj &&
        debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        surface.toggleButton(true, "chart-record-button");
      }

      if (surface.getPanelProperty("run.active")) {
        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      }

      if (surface.getPanelProperty("watch.active")) {
        surface.updateWatchPanelButtons(debuggerObj);
      }
    });

    /**
     * Watch panel add button.
     */
    $("#watch-add-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      $("#watch-add-wrapper").show();
      $("#watch-add-input").focus();
    });

    /**
     * Watch panel refresh button.
     */
    $("#watch-refresh-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      if (debuggerObj && debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.BREAKPOINT) {
        session.updateWatchExpressions(debuggerObj);
      }
    });

    /**
     * Watch panel clear button.
     */
    $("#watch-clear-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      $("#watch-list").html("");
      session.removeAllWatchExpression();
      surface.updateWatchPanelButtons(debuggerObj);
    });

    /**
     * Watch panel list item delete icons.
     */
    $("#watch-list").on("click", ".watch-li-remove i", function() {
      session.removeWatchExpression($(this).parent().data("rid"));
      $(this).parent().parent().remove();
      surface.updateWatchPanelButtons(debuggerObj);
    });

    /**
     * Watch panel input field.
     */
    $("#watch-add-input").focusout(function() {
      $(this).val("");
      $("#watch-add-wrapper").hide();
    });

    $("#watch-add-input").on("keypress", function(e) {
      if (e.keyCode == 13) {
        if ($(this).val() != "") {
          session.addWatchExpression(debuggerObj, $(this).val());
        }

        $(this).val("");
        $("#watch-add-wrapper").hide();
      }
    });

    /**
     * Init backtrace and breakpoints panels fixed head view.
     */
    $(".scroll-table").floatThead({
      autoReflow: true,
      position: "fixed",
      scrollContainer: function($table) {
        return $table.closest(".wrapper");
      }
    });

    /**
     * Selectable ul lists for file select.
     */
    $(".selectable").selectable({
      filter: "li",
      cancel: ".handle"
    });

    $("#run-chooser-dest").sortable({
      handle: ".handle",
      axis: "y",
      update: function(event, ui) {
        var sid = parseInt($(ui.item[0]).data("sid"));
        if (session.getFileDataById(sid).scheduled) {
          session.moveFileInUploadList(session.getUploadList().indexOf(sid), $(ui.item[0]).index());
        }
      }
    });

    /**
     * Right arrow button in the source selecting panel.
     */
    $("#run-right-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      $("#run-chooser-src .ui-selected").each(function() {
        $(this).detach().appendTo("#run-chooser-dest").removeClass("ui-selected").addClass("sortable")
          .children().removeClass("hidden");

        var sid = parseInt($(this).data("sid"));

        if (!session.getFileDataById(sid).scheduled) {
          session.addFileToUploadList(sid, $(this).index());
        }
      });

      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
    });

    /**
     * Left arrow button in the source selecting panel.
     */
    $("#run-left-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      $("#run-chooser-dest .ui-selected").each(function() {
        $(this).detach().appendTo("#run-chooser-src").removeClass("sortable").removeClass("ui-selected")
          .children().addClass("hidden");

        var sid = parseInt($(this).data("sid"));

        if (session.getFileDataById(sid).scheduled) {
          session.removeFileFromUploadList(sid);
        }
      });

      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);
    });

    /**
     * Run button in the run panel.
     */
    $("#run-ok-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      // Prevent the "empty" upload.
      if ($("#run-chooser-dest").is(":empty")) {
        return;
      }

      session.setUploadStarted(true);

      // Add the context reset signal to the upload list.
      if (!session.isFileInUploadList(0)) {
        session.addFileToUploadList(0, session.getUploadList().length);
        surface.appendChooserLi($("#run-chooser-dest"), "", "hidden", "run-context-reset-sid", 0, "Context Reset");
      }

      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.JQUI, debuggerObj, session);
      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.BUTTON, debuggerObj, session);

      // Send the source(s) to the debugger.
      debuggerObj.sendClientSource();
    });

    /**
     * Clear button in the run panel.
     */
    $("#run-clear-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      session.getAllData().forEach(function(s) {
        // Skip the welcome session, which is always stored with id 0.
        if (s.id === 0) {
          return;
        }

        if (s.scheduled) {
          session.removeFileFromUploadList(s.id);
        }
      });

      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
    });

    /**
     * Context reset button in the run panel.
     */
    $("#run-context-reset-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      // Reset the upload list.
      session.resetUploadList();
      surface.updateRunPanel(surface.RUN_UPDATE_TYPE.CR, debuggerObj, session);

      // Remove the unuploaded file placeholders.
      $("#run-chooser-dest li .btn").each(function() {
        if (!$(this).hasClass("btn-success")) {
          $(this).remove();
        }
      });

      // Disable the reset button.
      $(this).addClass("disabled");
    });

    /*
     * File open button.
     */
    $("#open-file-button").on("click", function() {
      // Check for the various File API support.
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Great success! All the File APIs are supported.
        // Open the file browser.
        $("#hidden-file-input").trigger("click");
      } else {
        logger.error("The File APIs are not fully supported in this browser.", true);
      }
    });

    /*
     * Manage the file input change.
     */
    $("#hidden-file-input").change(function(evt) {
      // FileList object
      var files = evt.target.files;
      var valid = files.length,
        processed = 0;

      for (var i = 0; i < files.length; i++) {
        if (session.fileNameCheck(files[i].name)) {
          logger.error(files[i].name + " is already loaded.", true);
          valid--;
          continue;
        }

        (function(file) {
          var reader = new FileReader();

          reader.onload = function(evt) {
            session.createNewFile(file.name, evt.target.result, 1, true);

            if (surface.getPanelProperty("run.active")) {
              surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
            }
          }

          reader.onerror = function(evt) {
            if (evt.target.name.error === "NotReadableError") {
              logger.error(file.name + " file could not be read.", true);
            }
          }

          reader.readAsText(file, "utf-8");
        })(files[i]);
      }

      // Reset the file input field.
      $(this).val("");

      // Close the extra sidenav windows after the open finished.
      surface.toggleSidenavExtra("file-sidenav");
    });

    /**
     * New file name field toggle event.
     */
    $("#new-file-button").on("click", function() {
      surface.toggleSidenavNewFile();
      $("#new-file-name").focus();
    });

    /**
     * New file name on-the-fly validation.
     */
    $("#new-file-name").keyup(function(e) {
      var info = $("#hidden-new-file-info");
      var filename = $("#new-file-name").val().trim();
      var valid = true;
      var regex = /^([a-zA-Z0-9_\-]{1,}.*)$/;

      info.empty();
      if (!regex.test(filename)) {
        info.append("<p>The filename must be at least 1 (one) character long.</p>");
        valid = false;
      }

      if (session.isFileNameTaken(filename)) {
        info.append("<p>This filename is already taken.</p>");
        valid = false;
      }

      if (valid) {
        surface.toggleButton(true, "ok-file-name");
        // If the key was the enter, trigger the ok button.
        if (e.keyCode === 13) {
          $("#ok-file-name").click();
        }
      } else {
        surface.toggleButton(false, "ok-file-name");
      }
    });

    /**
     * New file name cancel button events.
     */
    $("#cancel-file-name").on("click", function() {
      $("#new-file-name").val("");
      $("#hidden-new-file-info").empty();
      surface.toggleButton(false, "ok-file-name");
      surface.toggleSidenavNewFile();
    });

    /**
     * New file name ok button events.
     */
    $("#ok-file-name").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      session.createNewFile($("#new-file-name").val().trim(), "", session.TABTYPE.WORK, false);

      if (surface.getPanelProperty("run.active")) {
        surface.updateRunPanel(surface.RUN_UPDATE_TYPE.ALL, debuggerObj, session);
      }

      $("#new-file-name").val("");
      surface.toggleButton(false, "ok-file-name");
      surface.toggleSidenavNewFile();
      surface.toggleSidenavExtra("file-sidenav");
    });

    /**
     * Save button event.
     */
    $("#save-file-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      var blob = new Blob([env.editor.session.getValue()]);
      saveAs(blob, session.getFileNameById(session.getActiveID()));
      $("#tab-" + session.getActiveID()).removeClass("unsaved");
      surface.toggleSidenavExtra("file-sidenav");
    });

    /**
     * Editor setting events.
     */
    $("#theme").on("change", function() {
      env.editor.setTheme(this.value);
    });

    $("#fontsize").on("change", function() {
      env.editor.setFontSize(this.value);
    });

    $("#folding").on("change", function() {
      env.editor.session.setFoldStyle(this.value);
    });

    $("#keybinding").on("change", function() {
      env.editor.setKeyboardHandler(keybindings[this.value]);
    });

    $("#soft_wrap").on("change", function() {
      env.editor.setOption("wrap", this.value);
    });

    $("#select_style").on("change", function() {
      env.editor.setOption("selectionStyle", this.checked ? "line" : "text");
    });

    $("#highlight_active").on("change", function() {
      env.editor.setHighlightActiveLine(this.checked);
    });

    $("#display_indent_guides").on("change", function() {
      env.editor.setDisplayIndentGuides(this.checked);
    });

    $("#show_hidden").on("change", function() {
      env.editor.setShowInvisibles(this.checked);
    });

    $("#show_hscroll").on("change", function() {
      env.editor.setOption("hScrollBarAlwaysVisible", this.checked);
    });

    $("#show_vscroll").on("change", function() {
      env.editor.setOption("vScrollBarAlwaysVisible", this.checked);
    });

    $("#animate_scroll").on("change", function() {
      env.editor.setAnimatedScroll(this.checked);
    });

    $("#show_gutter").on("change", function() {
      env.editor.renderer.setShowGutter(this.checked);
    });

    $("#show_print_margin").on("change", function() {
      env.editor.renderer.setShowPrintMargin(this.checked);
    });

    $("#soft_tab").on("change", function() {
      env.editor.session.setUseSoftTabs(this.checked);
    });

    $("#highlight_selected_word").on("change", function() {
      env.editor.setHighlightSelectedWord(this.checked);
    });

    $("#enable_behaviours").on("change", function() {
      env.editor.setBehavioursEnabled(this.checked);
    });

    $("#fade_fold_widgets").on("change", function() {
      env.editor.setFadeFoldWidgets(this.checked);
    });

    $("#scrollPastEnd").on("change", function() {
      env.editor.setOption("scrollPastEnd", this.checked);
    });

    /**
     * Address port check.
     */
    $("#host-port").keydown(function(e) {
      // Allow: backspace, delete, tab, escape, enter.
      if ($.inArray(e.keyCode, [46, 8, 9, 27, 13, 110]) !== -1 ||
        // Allow: Ctrl/cmd+A.
        (e.keyCode == 65 && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: Ctrl/cmd+C.
        (e.keyCode == 67 && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: Ctrl/cmd+X.
        (e.keyCode == 88 && (e.ctrlKey === true || e.metaKey === true)) ||
        // Allow: home, end, left, right.
        (e.keyCode >= 35 && e.keyCode <= 39)) {
        // let it happen, don't do anything.
        return;
      }

      // Ensure that it is a number and stop the keypress.
      if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
      }
    });

    /**
     * Debugger action events.
     */
    $("#connect-to-button").on("click", function(e) {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        logger.info("Debugger is connected.");
        return true;
      }

      if ($("#host-ip").val() == "") {
        logger.error("IP address expected.", true);
        return true;
      }

      if ($("#host-port").val() == "") {
        logger.error("Adress port expected.", true);
        return true;
      }

      if ($("#host-port").val() < 0 || $("#host-port").val() > 65535) {
        logger.error("Adress port must between 0 and 65535.", true);
        return true;
      }

      var address = $("#host-ip").val() + ":" + $("#host-port").val();
      logger.info("Connect to: " + address);
      debuggerObj = new DebuggerClient(address, session, surface, chart);

      return true;
    });

    /*
     * Update the breakpoint lines after editor or session changes.
     */
    env.editor.on("change", function(e) {
      $("#tab-" + session.getActiveID()).addClass("unsaved");
      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        session.markBreakpointGutters(debuggerObj);
      }
    });

    env.editor.on("changeSession", function(e) {
      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        session.markBreakpointGutters(debuggerObj);
      }
    });

    /*
     * Debugger action button events.
     */
    $("#delete-all-button").on("click", function() {
      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        var found = false;

        for (var i in debuggerObj.getActiveBreakpoints()) {
          debuggerObj.deleteBreakpoint(debuggerObj.getActiveBreakpoints()[i].activeIndex);
          found = true;
        }

        if (!found) {
          logger.info("No active breakpoints.")
        }
        session.deleteBreakpointsFromEditor();
      }
    });

    $("#continue-stop-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      if (debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.BREAKPOINT) {
        surface.continueCommand(debuggerObj);
      } else {
        surface.stopCommand();

        if (surface.getPanelProperty("chart.active")) {
          chart.deleteTimeoutLoop();
        }

        debuggerObj.encodeMessage("B", [debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_STOP]);
      }
    });

    $("#step-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      if (debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.BREAKPOINT) {
        logger.error("This action only available in breakpoint mode.", true);
        return true;
      }

      debuggerObj.encodeMessage("B", [debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_STEP]);
    });

    $("#next-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      if (debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.BREAKPOINT) {
        logger.error("This action only available in breakpoint mode.", true);
        return true;
      }

      debuggerObj.encodeMessage("B", [debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_NEXT]);
    });

    /**
     * Chart buttons.
     */
    $("#chart-record-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      chart.startChartWithButton(debuggerObj);
    });

    $("#chart-stop-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      chart.stopChartWithButton();
    });

    $("#chart-reset-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return true;
      }

      chart.resetChart();
      chart.resizeChart(surface.getPanelProperty("chart.height"), surface.getPanelProperty("chart.width"));
    });

    /**
     * Export chart menu button.
     */
    $("#export-chart-button").on("click", function() {
      if ($(this).hasClass("disabled")) {
        return;
      }

      chart.exportChartData();
    });

    /*
     * Editor mouse click, breakpoint add/delete.
     */
    env.editor.on("guttermousedown", function(e) {
      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        var target = e.domEvent.target;
        if (target.className.indexOf("ace_gutter-cell") == -1) {
          return;
        }

        if (!env.editor.isFocused()) {
          return;
        }

        if (e.clientX > 25 + target.getBoundingClientRect().left) {
          return;
        }

        var breakpoints = e.editor.session.getBreakpoints(row, 0);
        var row = e.getDocumentPosition().row;
        var lines = session.getLinesFromRawData(debuggerObj.getBreakpointLines());

        if (lines.includes(row + 1)) {
          if (typeof breakpoints[row] === typeof undefined) {
            env.editor.session.setBreakpoint(row);
            session.addBreakpointID(row, debuggerObj.getNextBreakpointIndex());
            debuggerObj.setBreakpoint(session.getFileNameById(session.getActiveID()) + ":" + parseInt(row + 1));
          } else {
            debuggerObj.deleteBreakpoint(session.getBreakpointID(row));
            env.editor.session.clearBreakpoint(row);
          }
          surface.updateBreakpointsPanel(debuggerObj.getActiveBreakpoints());
        }

        e.stop();
      }
    });
  });

  /*
   * Command line log.
   */
  $('#command-line-input').keydown(function(e) {
    if (e.keyCode == keys.upArrow) {
      if (session.getCommandCounter() - 1 > -1) {
        session.setCommandCounter(session.getCommandCounter() - 1);
        $("#command-line-input").val(session.getCommandList()[session.getCommandCounter()]);
      }
    } else if (e.keyCode == keys.downArrow) {
      if (session.getCommandCounter() + 1 < session.getCommandList().length) {
        session.setCommandCounter(session.getCommandCounter() + 1);
        $("#command-line-input").val(session.getCommandList()[session.getCommandCounter()]);
      } else {
        session.setCommandCounter(session.getCommandList().length);
        $("#command-line-input").val("");
      }
    }
  });

  /**
   * Comman line keypress event.
   */
  $("#command-line-input").keypress(function(e) {
    debuggerCommand(e);
  });

  /**
   * Editor and panels column resizer.
   */
  $(function() {
    $("#info-panels").resizable({
      handles: 'e',
      resize: function() {
        $("#editor-wrapper").width(surface.editorHorizontalPercentage() - 10 + "%");

        // Resize chart.
        if (surface.getPanelProperty("chart.active")) {
          surface.setChartPanelWidth($("#chart-wrapper").width());
          var tmph = surface.getPanelProperty("chart.height");
          if ($("#chart-wrapper").height() != 0) {
            tmph = $("#chart-wrapper").height();
          }
          chart.resizeChart(tmph, surface.getPanelProperty("chart.width"));
        }
      },
      stop: function() {
        $(this).width($(this).width() / $("#workspace-wrapper").width() * 100 + "%");
        env.editor.resize();
      }
    });
  });

  /**
   * Window resize event.
   */
  $(window).resize(function(e) {
    if (e.target == window) {
      surface.resetPanelsPercentage();

      if (surface.getPanelProperty("chart.active")) {
        setTimeout(function() {
          surface.setChartPanelHeight($("#chart-wrapper").height());
          surface.setChartPanelWidth($("#chart-wrapper").width());
          chart.resizeChart(surface.getPanelProperty("chart.height"), surface.getPanelProperty("chart.width"));
        }, 100);
      }

      // Resize the info panels and the editor.
      $("#editor-wrapper").width(surface.editorHorizontalPercentage() - 10 + "%");
      env.editor.resize();
    }

    $("#info-panels").resizable("option", "minWidth", Math.floor($("#editor-wrapper").parent().width() / 3));
    $("#info-panels").resizable("option", "maxWidth", Math.floor(($("#editor-wrapper").parent().width() / 3) * 2));
  });

  /**
   * Info panels vertical resizer.
   */
  $(function() {
    $(".vertical-resizable").not(":last").resizable({
      handles: 's',
      minHeight: surface.getPanelProperty("height"),
      start: function() {
        this.other = $(this).next();
        while (!this.other.is(":visible")) {
          this.other = $(this.other).next();
        }
        this.startHeight = this.other.height();
      },
      resize: function(e, ui) {
        var minHeight = ui.element.resizable("option", "minHeight");
        var diffH = ui.size.height - ui.originalSize.height;
        if (diffH > this.startHeight - minHeight) {
          diffH = this.startHeight;
          ui.size.height = ui.originalSize.height + diffH - minHeight;
        }

        var tmpHeight = Math.max(surface.getPanelProperty("height"), this.startHeight - diffH)
        this.other.height((tmpHeight < surface.getPanelProperty("height"))
                          ? surface.getPanelProperty("height")
                          : tmpHeight);

        if ((ui.originalElement[0].id == "chart-wrapper" || this.other[0].id == "chart-wrapper") &&
          this.other.height() != minHeight) {
          chart.resizeChart($("#chart-wrapper").height(), surface.getPanelProperty("chart.width"));
        }
      }
    });
  });

  /**
   * Command line functionality.
   *
   * @param {keyboardEvent} event
   */
  function debuggerCommand(event) {
    if (event.keyCode != 13) {
      return true;
    }

    var commandInput = $("#command-line-input");
    var command = commandInput.val().trim();

    session.addCommandToList(command);
    session.setCommandCounter(session.getCommandList().length);
    var args = /^([a-zA-Z]+)(?:\s+([^\s].*)|)$/.exec(command);

    if (!args) {
      logger.error("Invalid command.");
      commandInput.val("");
      return true;
    }

    if (!args[2]) {
      args[2] = "";
    }

    if (args[1] == "help") {
      logger.info("Debugger commands:\n" +
        "  connect <IP address:PORT> - connect to server (default is localhost:5001)\n" +
        "  pendingdel <id> - delete pending breakpoint\n" +
        "  list - list breakpoints\n" +
        "  stop|st - stop execution\n" +
        "  continue|c - continue execution\n" +
        "  step|s - step-in execution\n" +
        "  next|n - execution until the next breakpoint\n" +
        "  eval|e - evaluate expression\n" +
        "  exception <0|1> - turn on/off the exception handler\n" +
        "  dump - dump all breakpoint data");
      commandInput.val("");
      return true;
    }

    if (args[1] == "connect") {
      if (debuggerObj && debuggerObj.getEngineMode() != debuggerObj.ENGINE_MODE.DISCONNECTED) {
        logger.info("Debugger is connected");
        return true;
      }

      var ipAddr = args[2];
      var PORT = "5001";
      if (ipAddr == "") {
        ipAddr = "localhost";
      }

      if (ipAddr.match(/.*:\d/)) {
        var fields = ipAddr.split(":");
        ipAddr = fields[0];
        PORT = fields[1];
      }

      if (PORT < 0 || PORT > 65535) {
        logger.error("Adress port must between 0 and 65535.");
        return true;
      }

      var address = ipAddr + ":" + PORT;
      logger.info("Connect to: " + address);
      debuggerObj = new DebuggerClient(address, session, surface, chart);

      commandInput.val("");

      return true;
    }

    if (!debuggerObj || debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.DISCONNECTED) {
      logger.error("Debugger is NOT connected.");
      commandInput.val("");
      return true;
    }

    switch (args[1]) {
      case "pendingdel":
        debuggerObj.deletePendingBreakpoint(args[2]);
      case "st":
      case "stop":
        $("#continue-stop-button").click();
        break;
      case "c":
      case "continue":
        $("#continue-stop-button").click();
        break;
      case "s":
      case "step":
        $("#step-button").click();
        break;
      case "n":
      case "next":
        $("#next-button").click();
        break;
      case "e":
      case "eval":
        debuggerObj.sendEval(args[2]);
        break;
      case "exception":
        debuggerObj.sendExceptionConfig(args[2]);
        break;
      case "list":
        debuggerObj.listBreakpoints();
        break;
      case "dump":
        debuggerObj.dump();
        break;
      default:
        logger.error("Unknown command: " + args[1]);
        break;
    }

    commandInput.val("");
    return true;
  }
};
