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

import Util from './util';

/**
 * Continue and Stop button state enumerations.
 */
const CSICON = {
  STOP: 0,
  CONTINUE: 1
};

/**
 * Colors code for the jquery and bootsrtap elements.
 */
const COLOR = {
  RED: 0,
  GREEN: 1,
  BLUE: 2,
  YELLOW: 3,
  WHITE: 4
};

/**
 * Types of the source sending panel update methods.
 */
const RUN_UPDATE_TYPE = {
  ALL: 0,
  LIST: 1,
  BUTTON: 2,
  CR: 3,
  JQUI: 4
};

/**
 * Contructor.
 */
function Surface() {
  if (!(this instanceof Surface)) {
    throw new TypeError("Surface constructor cannot be called as a function.");
  }

  this._sidenav = {
    opened: false,
    closedWidth: 40,
    openedWidth: 240
  };

  this._sidenavExtra = {
    opened: false,
    last: "",
    newFile: {
      opened: false,
    },
    run: {
      enabled: false
    },
  };

  this._panel = {
    numberOfInactive: 4,
    height: 100,
    backtrace: {
      active: true,
    },
    breakpoints: {
      active: true,
    },
    watch: {
      active: false,
    },
    chart: {
      active: false,
      width: 0,
      height: 0,
    },
    run: {
      active: false,
    },
    output: {
      active: false,
    },
    console: {
      active: true,
    },
  };

  this.CSICON = CSICON;
  this.COLOR = COLOR;
  this.RUN_UPDATE_TYPE = RUN_UPDATE_TYPE;
}

/**
 * Returns the actual state of the left side menu.
 *
 * @return {boolean} True if the left side menu is opened, false otherwise.
 */
Surface.prototype.isSidenavOpened = function() {
  return this._sidenav.opened;
};

/**
 * Closes or opens the left side menu.
 */
Surface.prototype.toggleSidenav = function() {
  if (this._sidenav.opened) {
    this._sidenav.opened = false;
    $("#left-sidenav").css("width", this._sidenav.closedWidth + "px");
    $("#main-wrapper").css("margin-left", this._sidenav.closedWidth + "px");
  } else {
    this._sidenav.opened = true;
    $("#left-sidenav").css("width", this._sidenav.openedWidth + "px");
    $("#main-wrapper").css("margin-left", this._sidenav.openedWidth + "px");
  }
};

/**
 * Returns of the opened state of the sidenav extra panel.
 *
 * @return {boolean} True if the extra sidenav opened, flase otherwise.
 */
Surface.prototype.isSidenavExtraOpened = function() {
  return this._sidenavExtra.opened;
}

/**
 * Enables or disables a specified menu based on the given type.
 *
 * @param {string} extra ID of the menu.
 */
Surface.prototype.toggleSidenavExtra = function(extra) {
  var splt = extra.split("-")[0];

  if (this._sidenavExtra.opened) {
    if (this._sidenavExtra.last == extra) {
      this._sidenavExtra.opened = false;
      $("#sidenav-extra-modal").hide();
      $(".sidenav-extra").hide();
      $("#" + extra).hide();

      $("#sidenav-toggle-" + splt).removeClass("active-sidenav-button");
    } else {
      $("#" + this._sidenavExtra.last).hide();
      $("#" + extra).show();

      $("#sidenav-toggle-" + this._sidenavExtra.last.split("-")[0]).removeClass("active-sidenav-button");
      $("#sidenav-toggle-" + splt).addClass("active-sidenav-button");
    }

    if (this._sidenavExtra.newFile.opened) {
      this._sidenavExtra.newFile.opened = false;
      $("#hidden-new-file").hide();
    }
  } else {
    this._sidenavExtra.opened = true;
    $("#sidenav-extra-modal").show();
    $(".sidenav-extra").show();
    $("#" + extra).show();

    $("#sidenav-toggle-" + splt).addClass("active-sidenav-button");
  }

  this._sidenavExtra.last = extra;
};

/**
 * Enables or disables the new file submenu in the file menu.
 */
Surface.prototype.toggleSidenavNewFile = function() {
  if (this._sidenavExtra.newFile.opened) {
    this._sidenavExtra.newFile.opened = false;

    $("#hidden-new-file").hide();
    $("#new-file-name").val("");
    $("#hidden-new-file-info").empty();
  } else {
    this._sidenavExtra.newFile.opened = true;
    $("#hidden-new-file").fadeIn("fast");
  }
};

/**
 * Enables or disables an information panel on the page left side.
 *
 * @param {string} target Name of the panel.
 * @param {object} chart Chart object if the target is the chart.
 */
Surface.prototype.togglePanel = function(target, chart) {
  chart = chart || null;

  if (this._panel[target].active) {
    if (target === "chart" && chart != null) {
      this.toggleButton(false, "export-chart-button");
    }

    this._panel[target].active = false;

    $("#sidenav-toggle-" + target).removeClass("active-sidenav-button");

    $("#" + target + "-wrapper").hide();
    $("#" + target + "-wrapper").addClass("hidden-panel");
    this._panel.numberOfInactive++;
  } else {
    if (target === "chart" && chart != null) {
      chart.initChart();
      this.toggleButton(true, "export-chart-button");
    }

    this._panel[target].active = true;

    $("#sidenav-toggle-" + target).addClass("active-sidenav-button");

    $("#" + target + "-wrapper").show();
    $("#" + target + "-wrapper").removeClass("hidden-panel");
    this._panel.numberOfInactive--;
  }

  if (this.getPanelProperty("backtrace.active")) {
    $("#backtrace-table").floatThead("reflow");
  }

  if (this.getPanelProperty("breakpoints.active")) {
    $("#breakpoints-table").floatThead("reflow");
  }

  // If every information panels are hidden then expand the editor.
  // -1 from the length because of the resizable div element.
  if (this._panel.numberOfInactive == this.getPanelsNumber()) {
    $("#editor-wrapper").css("width", "100%");
    $("#editor-wrapper").css("padding-left", 0);
    $("#info-panels").hide();

    // If there is at least one information panel then reset the last known layout.
  } else if (this._panel.numberOfInactive > 0 && !$("#info-panels").is(":visible")) {
    $("#editor-wrapper").css("padding-left", 10);
    $("#editor-wrapper").css("width", this.editorHorizontalPercentage() + "%");
    $("#info-panels").show();
  }

  this.resetPanelsPercentage();

  $(".vertical-resizable").not(".hidden-panel").each(function(index) {
    if (index == 0) {
      $(this).children(".col-md-12").css("padding-top", 0);
    } else {
      $(this).children(".col-md-12").css("padding-top", 10);
    }

    if (index == ($(".vertical-resizable").not(".hidden-panel").length - 1)) {
      $(this).children(".ui-resizable-s").hide();
    } else {
      $(this).children(".ui-resizable-s").show();
    }
  });

  if (!$("#chart-wrapper").hasClass("hidden-panel")) {
    this._panel.chart.height = $("#chart-wrapper").height();
    this._panel.chart.width = $("#chart-wrapper").width();
    chart.resizeChart(this._panel.chart.height, this._panel.chart.width);
  }
};

/**
 * Enables or disables a button element.
 *
 * @param {boolean} enabled New state of the button.
 * @param {string} element The id of the selected button.
 */
Surface.prototype.toggleButton = function(enabled, element) {
  if (enabled) {
    $("#" + element).removeClass("disabled");
  } else {
    $("#" + element).addClass("disabled");
  }
};

/**
 * Returns a porperty from the panel object based on the path argument.
 *
 * @param {string} path Dot spearated path to the property value.
 * @return {mixed} Property value if that is exists, null otherwise.
 */
Surface.prototype.getPanelProperty = function(path) {
  var p;

  if (path) {
    p = path.split(".");
  } else {
    return null;
  }

  if (p.length == 2 && this._panel[p[0]][p[1]] !== undefined) {
    return this._panel[p[0]][p[1]];
  }

  if (p.length == 1 && this._panel[p[0]] !== undefined) {
    return this._panel[p[0]];
  }

  return null;
}

/**
 * Appends a new li element to the source file chooser source or destonation placeholder.
 *
 * @param {object} element The jquery element of the placeholder.
 * @param {string} liClass Extra css classes for the li.
 * @param {string} divClass Extra css classes for the inner div.
 * @param {string} id Dom element id.
 * @param {integer} sid Session if of a file.
 * @param {string} text String to display as a name on the list item.
 */
Surface.prototype.appendChooserLi = function(element, liClass, divClass, id, sid, text) {
  element.append($("<li>").attr("class", "bg-white cupload " + liClass)
    .attr("data-sid", sid)
    .attr("id", id)
    .text(text)
    .append($("<div>").attr("class", "handle " + divClass)
      .append($("<i>").attr("class", "fa fa-circle"))));
}

/**
 * Changes the color of the selected element from the upload list.
 *
 * @param {integer} color The color code.
 * @param {integer} sid Session ID's of the selected item.
 */
Surface.prototype.changeUploadColor = function(color, sid) {
  var e = $("li.cupload[data-sid=" + sid + "]");

  switch (color) {
    case COLOR.RED:
      e.toggleClass("bg-danger");
      break;
    case COLOR.YELLOW:
      e.toggleClass("bg-warning");
      break;
    case COLOR.GREEN:
      e.toggleClass("bg-success");
      break;
    case COLOR.WHITE:
    default:
      e.toggleClass("bg-white");
      break;
  }
}

/**
 * Updates the Source sending panel content based on the requested update mode.
 * - Clears and refills the source and destonation selectable lists.
 * - Updates the buttons in the panel.
 * - Changes colors in the upload list items after context reset request.
 * - Enables or disables the lists based on the current state of the Upload.
 *
 * @param {integer} type Type of the update mode.
 * @param {object} debuggerObj The main DebuggerClient module instance.
 * @param {object} session The main Session module instance.
 */
Surface.prototype.updateRunPanel = function(type, debuggerObj, session) {
  if (type == this.RUN_UPDATE_TYPE.ALL || type == this.RUN_UPDATE_TYPE.LIST) {
    // Empty the lists.
    $("#run-chooser-src").html("");
    $("#run-chooser-dest").html("");

    session.getAllData().forEach(function(s) {
      // Skip the welcome session, which is always stored with id 0.
      if (s.id === 0) {
        return;
      }

      if (!s.scheduled) {
        // Create a new list item.
        this.appendChooserLi($("#run-chooser-src"), "", "hidden", "run-" + s.name, s.id, s.name);
      }
    }, this);

    // Generate the ordered list and fill the destonation field based on the file state.
    var list = session.getUploadBackupList();

    if (list.length) {
      for (var i in list) {
        var ss = session.getFileDataById(list[i]);

        if (list[i] == 0) {
          this.appendChooserLi($("#run-chooser-dest"), "", "hidden", "run-context-reset-sid", 0, "Context Reset");
        } else {
          this.appendChooserLi($("#run-chooser-dest"), "sortable", "", "run-" + ss.name, ss.id, ss.name);
        }

        if (!session.isFileInUploadList(list[i]) && session.getUploadBackupList().indexOf(list[i]) != -1) {
          this.changeUploadColor(this.COLOR.GREEN, list[i]);
        }
      }
    }
  }

  if (type == this.RUN_UPDATE_TYPE.CR) {
    $("#run-chooser-dest li").each($.proxy(function(i, e) {
      if (!$(e).hasClass("bg-success") && $(e).data("sid") != 0) {
        this.changeUploadColor(this.COLOR.RED, $(e).data("sid"));
      }
    }, this));
  }

  if (type == this.RUN_UPDATE_TYPE.ALL || type == this.RUN_UPDATE_TYPE.BUTTON) {
    if (session.isUploadStarted()) {
      // Disable the clear and the run button.
      this.toggleButton(false, "run-ok-button");
      this.toggleButton(false, "run-clear-button");
      this.toggleButton(false, "run-right-button");
      this.toggleButton(false, "run-left-button");

      // Enable the context reset button.
      this.toggleButton(true, "run-context-reset-button");
    } else {
      if (!$("#run-chooser-src").is(":empty")) {
        this.toggleButton(true, "run-right-button");
      } else {
        this.toggleButton(false, "run-right-button");
      }

      if (!$("#run-chooser-dest").is(":empty")) {
        this.toggleButton(true, "run-left-button");
        this.toggleButton(true, "run-clear-button");
      } else {
        this.toggleButton(false, "run-left-button");
        this.toggleButton(false, "run-clear-button");
      }

      // Enable the run button if there is a connection and a source in the list.
      if (debuggerObj
        && debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.CLIENT_SOURCE
        && session.isUploadAndRunAllowed()
        && !session.isUploadStarted()
        && !$("#run-chooser-dest").is(":empty")) {
        this.toggleButton(true, "run-ok-button");
      } else {
        this.toggleButton(false, "run-ok-button");
      }
    }
  }

  if (type == this.RUN_UPDATE_TYPE.ALL || type == this.RUN_UPDATE_TYPE.JQUI) {
    if (session.isUploadStarted()) {
      // Disable the sortable and selectable ul element.
      $("#run-chooser-dest").sortable("disable");
      $("#run-chooser-dest").selectable("disable");
      $("#run-chooser-src").selectable("disable");

      $("#run-chooser-src").css("opacity", 0.7);
      $("#run-chooser-dest").css("opacity", 0.7);
    } else {
      // Disable the sortable and selectable ul element.
      $("#run-chooser-dest").sortable("enable");
      $("#run-chooser-dest").selectable("enable");
      $("#run-chooser-src").selectable("enable");

      $("#run-chooser-src").css("opacity", 1);
      $("#run-chooser-dest").css("opacity", 1);
    }
  }
}

/**
 * Updates the watch panel list with the provided list.
 * - First off all make the watch panel empty.
 * - Then walks trhough the list and creates a new list item for every element.
 *
 * @param {array} list The list of the watch expressions.
 */
Surface.prototype.updateWatchPanelList = function(list) {
  if (list) {
    $("#watch-list").html("");

    for (var expr in list) {
      this.appendWatchLi(expr, list[expr]);
    }
  }
}

/**
 * Appends a new list item to the watch panel unordered list.
 * The new item contains the expression, the expression's value and a remove button at the end of the line.
 *
 * @param {string} expr The watched expression.
 * @param {string} value value of the watched expression.
 */
Surface.prototype.appendWatchLi = function(expr, value) {
  $("#watch-list").append(
    $('<li>' +
      '<span>' + expr + ' : </span>' +
      '<span>' + value + '</span>' +
      '<div class="watch-li-remove" data-rid="' + expr + '" title="Remove Expression">' +
      '<i class="fa fa-minus"></i>' +
      '</div>' +
      '</li>')
  );
}

/**
 * Updates the watch panel button based on the current state of the panel and the Debugger Client.
 *
 * @param {object} debuggerObj The Debugger Client module instance.
 */
Surface.prototype.updateWatchPanelButtons = function(debuggerObj) {
  if (debuggerObj
    && debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.BREAKPOINT
    && !$("#watch-list").is(":empty")) {
    this.toggleButton(true, "watch-refresh-button");
  } else {
    this.toggleButton(false, "watch-refresh-button");
  }

  if ($("#watch-list").is(":empty")) {
    this.toggleButton(false, "watch-clear-button");
  } else {
    this.toggleButton(true, "watch-clear-button");
  }
}

/**
 * Sets the chart panel width property.
 *
 * @param {number} value New width value.
 */
Surface.prototype.setChartPanelWidth = function(value) {
  this._panel.chart.width = value;
}

/**
 * Sets the chart panel height property.
 *
 * @param {number} value New width value.
 */
Surface.prototype.setChartPanelHeight = function(value) {
  this._panel.chart.height = value;
}

/**
 * Returns the view percentage of the editor wrapper.
 */
Surface.prototype.editorHorizontalPercentage = function() {
  return (($("#workspace-wrapper").width() - $("#info-panels").width()) / $("#workspace-wrapper").width()) * 100;
};

/**
 * Continue execution dependency.
 *
 * @param {object} debuggerObj The Jerry client object.
 */
Surface.prototype.continueCommand = function(debuggerObj) {
  this.continueStopButtonState(CSICON.STOP);
  $("#step-button").addClass("disabled");
  $("#next-button").addClass("disabled");

  debuggerObj.sendResumeExec(debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_CONTINUE);
};

/**
 * Stop execution releated buttons changes.
 */
Surface.prototype.stopCommand = function() {
  this.continueStopButtonState(CSICON.CONTINUE);
  $("#step-button").removeClass("disabled");
  $("#next-button").removeClass("disabled");
};

/**
 * Disables or enables the available action buttons based on the given parameter.
 *
 * @param {boolean} disable New status of the action buttons.
 */
Surface.prototype.disableActionButtons = function(disable) {
  if (disable) {
    // Disable the debugger action buttons.
    $(".debugger-action-button").each(function() {
      $(this).addClass("disabled");
    });
  } else {
    // Enable the debugger action buttons.
    $(".debugger-action-button").each(function() {
      $(this).removeClass("disabled");
    });
  }
};

/**
 * Sets to the proper state the Continue/Stop action button.
 *
 * @param {integer} state New state of the continue/stop button (CSICON item).
 */
Surface.prototype.continueStopButtonState = function(state) {
  switch (state) {
    case CSICON.STOP:
      {
        $("#continue-stop-button i").removeClass("fa-play");
        $("#continue-stop-button i").addClass("fa-stop");
      }
      break;
    case CSICON.CONTINUE:
      {
        $("#continue-stop-button i").removeClass("fa-stop");
        $("#continue-stop-button i").addClass("fa-play");
      }
      break;
  }
};

/**
 * Generate a function backtrace log for the backtrace and breakpoint panel
 * based on the available line information.
 *
 * @param {object} info A complete breakpoint from the debuggerObj.
 * @return {string}
 */
Surface.prototype.generateFunctionLog = function(info) {
  var suffix = "() at line: " + info.func.line + ", col: " + info.func.column;
  if (!info.func.name && !info.func.is_func) {
    return "-";
  } else if (!info.func.name && info.func.is_func) {
    return "function" + suffix;
  } else {
    return info.func.name + suffix;
  }
};

/**
 * Updates the backtrace panel with a new entry.
 *
 * @param {integer} frame Frame number information.
 * @param {object} info Breakpoint information from the debuggerObj.
 */
Surface.prototype.updateBacktracePanel = function(frame, info) {
  var sourceName = info.func.sourceName || info;
  var line = info.line || "-";

  var $table = $("#backtrace-table-body");

  $table.append(
    "<tr>" +
    "<td>" + frame + "</td>" +
    "<td>" + sourceName + "</td>" +
    "<td>" + line + "</td>" +
    "<td>" + this.generateFunctionLog(info) + "</td>" +
    "</tr>"
  );

  Util.scrollDown($table);
};

/**
 * Updates the breakpoint panel based on the active breakpoints.
 *
 * @param {array} activeBreakpoints Currently active (inserted) breakpoints list.
 */
Surface.prototype.updateBreakpointsPanel = function(activeBreakpoints) {
  var $table = $("#breakpoints-table-body");
  Util.clearElement($table);

  for (var i in activeBreakpoints) {
    var sourceName = activeBreakpoints[i].func.sourceName || "-";
    var line = activeBreakpoints[i].line || "-";
    var id = activeBreakpoints[i].activeIndex || "-";

    $table.append(
      "<tr>" +
      "<td>" + sourceName + "</td>" +
      "<td>" + line + "</td>" +
      "<td>" + id + "</td>" +
      "<td>" + this.generateFunctionLog(activeBreakpoints[i]) + "</td>" +
      "</tr>"
    );
  }

  Util.scrollDown($table);
};

/**
 * Sets the info panels height based on the visible panel number.
 */
Surface.prototype.resetPanelsPercentage = function() {
  $(".vertical-resizable").css("height", (100 / this.getPanelsDivisor()) + "%");
};

/**
 * Returns with the total number of the info panels.
 *
 * @return {integer}
 */
Surface.prototype.getPanelsNumber = function() {
  return $("#info-panels").children().length - 1;
};

/**
 * Returns with the number of the visible info panels.
 *
 * @return {integer}
 */
Surface.prototype.getPanelsDivisor = function() {
  return this.getPanelsNumber() - this._panel.numberOfInactive;
};

/**
 * Gets the backtrace depth options from the settings page and send that to the debugger.
 *
 * @param {object} debuggerObj The Jerry client object.
 */
Surface.prototype.getBacktrace = function(debuggerObj) {
  var max_depth = 0;
  var user_depth = $("#backtrace-depth").val();

  if (user_depth != 0) {
    if (/[1-9][0-9]*/.exec(user_depth)) {
      max_depth = parseInt(user_depth);
    } else {
      return true;
    }
  }

  if (debuggerObj.getEngineMode() == debuggerObj.ENGINE_MODE.BREAKPOINT) {
    debuggerObj.encodeMessage("BI", [debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_GET_BACKTRACE, max_depth]);
  } else {
    logger.error("Backtrace is allowed only if JavaScript execution is stopped at a breakpoint.");
  }
};

/**
 * Sets back every action to the default state.
 */
Surface.prototype.reset = function() {
  this.toggleButton(false, "run-context-reset-button");
}

export default Surface;
