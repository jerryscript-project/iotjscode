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

import Logger from './logger';
import c3 from 'c3';
import d3 from 'd3';

/**
 * private constant variables.
 */
var DATA_UPDATE_INTERVAL = 500;

/**
 * Global variables.
 */
var chart,
  startRecord,
  activeChart,
  scrollB,
  scrollF,
  updateDataPoints,
  maxDatapointNumber,
  minimumXIndex,
  timeoutLoop,
  tooltipRelativeYPosition,
  tooltipRelativeXPosition,
  xAxisData,
  checkTime,
  byte_code_bytes,
  string_bytes,
  property_bytes,
  object_bytes,
  allocated_bytes,
  estimatedTime;

/**
 * Contructor.
 *
 * @param {object} session The main Session module object.
 * @param {object} surface The main Surface module object.
 */
function MemoryChart(session, surface) {
  if (!(this instanceof MemoryChart)) {
    throw new TypeError("MemoryChart constructor cannot be called as a function.");
  }

  this._session = session;
  this._surface = surface;
  this._logger = new Logger($("#console-panel"));

  startRecord = false;
  activeChart = false;
}

/**
 * Returns the data update frequency.
 *
 * @return {integer}
 */
MemoryChart.prototype.getDataUpdateInterval = function() {
  return DATA_UPDATE_INTERVAL;
}

/**
 * Returns the record state.
 *
 * @return {boolean} True if the record is started, false otherwise.
 */
MemoryChart.prototype.isRecordStarted = function() {
  return startRecord;
}

/**
 * Sets the record status.
 *
 * @param {boolean} value True if the record should start, flase otherwise.
 */
MemoryChart.prototype.startRecord = function(value) {
  startRecord = value;
}

/**
 * Returns the chart active status.
 *
 * @return {boolean} True if the chart is active, false otherwise.
 */
MemoryChart.prototype.isChartActive = function() {
  return activeChart;
}

/**
 * Sets the chart active status.
 *
 * @param {boolean} value True if the chart should be active, false otherwise.
 */
MemoryChart.prototype.setChartActive = function(value) {
  activeChart = value;
}

/**
 * Checks for available data.
 *
 * @return {boolean} True if there is at least one data, false otherwise.
 */
MemoryChart.prototype.containsData = function() {
  return (chart.data("allocated_bytes")[0].values[maxDatapointNumber - 1].value == null) ? false : true;
}

/**
 * Creates an interval for the perodic data collection.
 * This interval will help the chart to collect every information
 * by sending a step-in command to the engine between other debugger actions.
 *
 * @param {function} func The function which will be called perodically.
 */
MemoryChart.prototype.createTimeoutLoop = function(func) {
  timeoutLoop = setTimeout(func, DATA_UPDATE_INTERVAL);
}

/**
 * Removes the data collector interval.
 */
MemoryChart.prototype.deleteTimeoutLoop = function() {
  if (timeoutLoop !== undefined) {
    clearTimeout(timeoutLoop);
  }
}

/**
 * Inits or redraw the chart.
 * The C3 based charts do not have a redraw function,
 * if we need a complete new chart we have to reinit the dom element with the new dataset.
 *
 * @param {string} redraw Reinit should be called or not.
 */
MemoryChart.prototype.initChart = function(redraw) {
  redraw = redraw || undefined;

  if (redraw === undefined) {
    initVariables();

    chart = c3.generate({
      data: {
        x: 'x',
        bindto: '#chart',
        columns: [
          xAxisData,
          byte_code_bytes,
          string_bytes,
          property_bytes,
          object_bytes,
          allocated_bytes
        ],
        types: {
          byte_code_bytes: 'area',
          string_bytes: 'area',
          property_bytes: 'area',
          object_bytes: 'area',
          allocated_bytes: 'area'
        },
        order: null,
        groups: [
          ['byte_code_bytes', 'string_bytes', 'property_bytes', 'object_bytes', 'allocated_bytes']
        ],
        onclick: function(d, element) {
          markSelectedLine(this._session, this._logger, d, element);
        }
      },
      axis: {
        x: {
          type: 'category',
          tick: {
            rotate: -75,
            multiline: false,
            culling: {
              max: 10
            },
            fit: true
          },
          height: 55
        },
        y: {
          tick: {
            format: function(d) {
              return Math.round(d) + " B";
            },
            count: 6,
            fit: true
          }
        }
      },
      point: {
        r: 2,
        focus: {
          expand: {
            enabled: false
          }
        }
      },
      tooltip: {
        position: function(data, width, height, thisElement) {
          /*var element = document.getElementById("chart");
          var tooltipWidth = element.querySelector('.c3-tooltip-container').clientWidth;
          var x = parseInt($(thisElement).attr("x")) + 3 * (tooltipWidth) / 8;*/
          /*Another alternative, if choose this return left value must be x*/
          return {
            top: tooltipRelativeYPosition,
            left: tooltipRelativeXPosition
          };
        }
      },
      transition: {
        duration: 0
      }
    });

    document.getElementById("chart").addEventListener("mousewheel", MouseWheelHandler);
    document.getElementById("chart").addEventListener("DOMMouseScroll", MouseWheelHandler);
    document.getElementById("chart").addEventListener("mousemove", function(e) {
      tooltipRelativeYPosition = e.clientY - document.getElementById("chart").getBoundingClientRect().top;
      tooltipRelativeXPosition = e.clientX - document.getElementById("chart").getBoundingClientRect().left;
    });
  } else {
    updateScrolledChart();
  }
}

/**
 * Resets the chart to the default empty state.
 */
MemoryChart.prototype.resetChart = function() {
  xAxisData = undefined;
  estimatedTime = undefined;
  byte_code_bytes = undefined;
  string_bytes = undefined;
  property_bytes = undefined;
  object_bytes = undefined;
  allocated_bytes = undefined;

  this._surface.toggleButton(false, "chart-reset-button");
  this._surface.toggleButton(false, "chart-stop-button");
  this._surface.toggleButton(true, "chart-record-button");
  $("#chart-record-button").css("background-color", "");

  this._session.unhighlightBreakpointLine();
  this.initChart();
}

/**
 * Sesizes the chart dimensions.
 *
 * @param {integer} height New height dimension in pixel.
 * @param {integer} width New width dimension in pixel.
 */
MemoryChart.prototype.resizeChart = function(height, width) {
  chart.resize({
    height: (height - 45),
    width: (width - 40)
  });
}

/**
 * Disables every chart action buttons in the panel.
 */
MemoryChart.prototype.disableChartButtons = function() {
  activeChart = false;
  var list = document.getElementsByClassName('chart-btn');

  for (var i = 0; i < list.length; i++) {
    this._surface.toggleButton(false, $(list[i]).attr("id"));
  }
  $("#chart-record-button").css("background-color", "");
}

/**
 * Starts the chart work and sets the actions buttons to work state.
 *
 * @param {object} debuggerObj The DebuggerClient object to send the memstats package.
 */
MemoryChart.prototype.startChartWithButton = function(debuggerObj) {
  startRecord = true;
  activeChart = true;

  this._surface.toggleButton(false, "chart-reset-button");
  this._surface.toggleButton(true, "chart-stop-button");
  this._surface.toggleButton(false, "chart-record-button");

  if (debuggerObj) {
    debuggerObj.encodeMessage("B", [debuggerObj.CLIENT_PACKAGE.JERRY_DEBUGGER_MEMSTATS]);
  }
}

/**
 * Stops the chart work and sets the action buttons to pasue state.
 */
MemoryChart.prototype.stopChartWithButton = function() {
  activeChart = false;

  this._surface.toggleButton(true, "chart-reset-button");
  this._surface.toggleButton(false, "chart-stop-button");
  this._surface.toggleButton(true, "chart-record-button")
  $("#chart-record-button").css("background-color", "#e22b1b");
}

/**
 * Generates a JSON report about the collected informations and popup a download window.
 */
MemoryChart.prototype.exportChartData = function() {
  if (xAxisData.length == 1) {
    alert("There is nothing to be exported from the memory usage!");
    return;
  }

  var data = [
    [xAxisData[0]].concat(xAxisData.slice(maxDatapointNumber + 1)),
    [byte_code_bytes[0]].concat(byte_code_bytes.slice(maxDatapointNumber + 1)),
    [string_bytes[0]].concat(string_bytes.slice(maxDatapointNumber + 1)),
    [property_bytes[0]].concat(property_bytes.slice(maxDatapointNumber + 1)),
    [object_bytes[0]].concat(object_bytes.slice(maxDatapointNumber + 1)),
    [allocated_bytes[0]].concat(allocated_bytes.slice(maxDatapointNumber + 1))
  ];

  data[0][0] = "Checked at:";
  var csv = '';

  data.forEach(function(row) {
    csv += row.join(',');
    csv += "\n";
  });

  var hiddenElement = document.createElement('a');
  hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
  hiddenElement.target = '_blank';
  hiddenElement.download = 'memoryUsageChart.csv';
  hiddenElement.click();

  this._surface.toggleSidenavExtra("download-sidenav");
}

/**
 * Push a new memory consumption data part into the main dataset.
 *
 * @param {array} data The new bytes informations.
 * @param {array} breakpointInformation Informations about the current breakpoint (e.g.: line).
 */
MemoryChart.prototype.addNewDataPoints = function(data, breakpointInformation) {
  checkTime.push(breakpointInformation);

  var counter = 1;
  if (breakpointInformation.includes("ln")) {
    for (var i = maxDatapointNumber; i < xAxisData.length; i++) {
      if (xAxisData[i].includes(breakpointInformation)) {
        counter++;
      }
    }

    if (counter == 1) {
      xAxisData.push(breakpointInformation);
    } else {
      xAxisData.push("#" + counter + " " + breakpointInformation);
    }
  } else {
    var timeToChart = new EstimatedTime();
    var i = xAxisData.length - 1;
    xAxisData.push(timeToChart.toString());

    while (i > maxDatapointNumber) {
      if (!xAxisData[i].includes("ln")) {
        timeToChart.increment();
        xAxisData[i] = timeToChart.toString();
      }
      i--;
    }
  }

  byte_code_bytes.push(data[1]);
  string_bytes.push(data[2]);
  property_bytes.push(data[4]);
  object_bytes.push(data[3]);
  allocated_bytes.push(data[0]);

  if (xAxisData.length <= maxDatapointNumber + 1) {
    chart.load({
      columns: [
        xAxisData,
        byte_code_bytes,
        string_bytes,
        property_bytes,
        object_bytes,
        allocated_bytes
      ]
    });
  } else {
    minimumXIndex++;
    updateScrolledChart();
  }
}

/**
 * Updates and returns the minimum X axis range for the chart scroll.
 *
 * @return {integer} Minimum index number.
 */
function updateminimumXIndex() {
  minimumXIndex = xAxisData.length - (maxDatapointNumber + 1);
  return minimumXIndex;
}

/**
 * Mosue scroll button handler for the X axis movement.
 *
 * @param {event} e Mouse scroll event.
 */
function MouseWheelHandler(e) {
  e.wheelDelta > 0 ? scrollForward() : scrollBack();
}

/**
 * Backward scroll range handler. Decrease the minimum X axis range.
 */
function scrollBack() {
  if (xAxisData.length >= maxDatapointNumber + 1 && minimumXIndex > maxDatapointNumber + 1) {
    minimumXIndex--;
    updateScrolledChart();
  }
}

/**
 * Foreward scroll range handler. Increase the minimum X axis range.
 */
function scrollForward() {
  if (xAxisData.length > maxDatapointNumber + minimumXIndex) {
    minimumXIndex++;
    updateScrolledChart();
  }
}

/**
 * Updates the chart by redraw the dataset based on the new minimum X axis range.
 */
function updateScrolledChart() {
  chart.load({
    columns: [
      [xAxisData[0]].concat(xAxisData.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [byte_code_bytes[0]].concat(byte_code_bytes.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [string_bytes[0]].concat(string_bytes.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [property_bytes[0]].concat(property_bytes.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [object_bytes[0]].concat(object_bytes.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [allocated_bytes[0]].concat(allocated_bytes.slice(minimumXIndex, maxDatapointNumber + minimumXIndex))
    ]
  });
}

/**
 * Inits the chart releated variables to the default start values.
 */
function initVariables() {
  minimumXIndex = 1;
  maxDatapointNumber = 40;
  xAxisData = ['x', ];
  checkTime = ['x', ];
  byte_code_bytes = ['byte_code_bytes', ];
  string_bytes = ['string_bytes', ];
  property_bytes = ['property_bytes', ];
  object_bytes = ['object_bytes', ];
  allocated_bytes = ['allocated_bytes', ];
  var empty_space = " ";

  for (var i = 0; i < maxDatapointNumber; i++) {
    xAxisData.push(empty_space);
    checkTime.push(null);
    byte_code_bytes.push(null);
    string_bytes.push(null);
    property_bytes.push(null);
    object_bytes.push(null);
    allocated_bytes.push(null);
    empty_space = empty_space.concat(" ");
  }
}

/**
 * Markes the selected line in the graph and puts a string log into the console.
 * The selected line is the last breakpoint line in the source.
 *
 * @param {object} session The main Session module object.
 * @param {object} logger The main Logger module object.
 */
function markSelectedLine(session, logger) {
  var lineNumber;

  if (checkTime[d.x + minimumXIndex].startsWith("ln")) {
    lineNumber = checkTime[d.x + minimumXIndex].split("ln: ")[1];
  } else {
    lineNumber = checkTime[d.x + minimumXIndex].split("#")[1].split(":")[0];
  }

  this._logger.info("----- Line: " + lineNumber + "-----");
  this._logger.info("Allocated bytes: " + allocated_bytes[d.x + minimumXIndex] + " B");
  this._logger.info("Byte code bytes: " + byte_code_bytes[d.x + minimumXIndex] + " B");
  this._logger.info("String bytes: " + string_bytes[d.x + minimumXIndex] + " B");
  this._logger.info("Object bytes: " + object_bytes[d.x + minimumXIndex] + " B");
  this._logger.info("Property bytes: " + property_bytes[d.x + minimumXIndex] + " B");

  this._session.highlightBreakPointLine(lineNumber);
}

/**
 * Calculates the time label for the dataset entries.
 */
function EstimatedTime() {
  this.hour = 0;
  this.minute = 0;
  this.second = 0;
  this.millisecond = 0;

  this.increment = function() {
    this.millisecond += DATA_UPDATE_INTERVAL / 100;
    if (this.millisecond >= 10) {
      this.second += 1;
      this.millisecond -= 10;
    }
    if (this.second == 60) {
      this.minute += 1;
      this.second = 0;
    }
    if (this.minute == 60) {
      this.hour += 1;
      this.minute = 0;
    }
    if (this.hour == 24) {
      this.reset();
    }
  };

  this.toString = function() {
    var sign = "-";
    if (this.hour == 0 && this.minute == 0 && this.second == 0 && this.millisecond == 0) sign = "";
    return sign + this.minute + ":" + this.second + "." + this.millisecond;
  };

  this.reset = function() {
    this.hour = 0;
    this.minute = 0;
    this.second = 0;
    this.minute = 0;
  };
}

export default MemoryChart;
