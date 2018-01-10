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

import c3 from 'c3';
import FileSaver from 'file-saver';

let chart;
let maxDatapointNumber;
let minimumXIndex;
let tooltipRelativeYPosition;
let tooltipRelativeXPosition;
let xAxisData;
let checkTime;
let bytes;

export default class MemoryChart {

  /**
   * Constructor.
   *
   * @param {object} session The main Session module object.
   * @param {object} surface The main Surface module object.
   */
  constructor(session, surface) {
    this._session = session;
    this._surface = surface;

    this._startRecord = false;
    this._activeChart = false;

    bytes = {
      byte_code: [],
      string: [],
      property: [],
      object: [],
      allocated: [],
    };
  }

  /**
   * Returns the record state.
   *
   * @return {boolean} True if the record is started, false otherwise.
   */
  isRecordStarted() {
    return this._startRecord;
  }

  /**
   * Sets the record status.
   *
   * @param {boolean} value True if the record should start, false otherwise.
   */
  startRecord(value) {
    this._startRecord = value;
  }

  /**
   * Returns the chart active status.
   *
   * @return {boolean} True if the chart is active, false otherwise.
   */
  isChartActive() {
    return this._activeChart;
  }

  /**
   * Sets the chart active status.
   *
   * @param {boolean} value True if the chart should be active, false otherwise.
   */
  setChartActive(value) {
    this._activeChart = value;
  }

  /**
   * Checks for available data.
   *
   * @return {boolean} True if there is any data, false otherwise.
   */
  containsData() {
    return (chart.data('allocated_bytes')[0].values[maxDatapointNumber - 1].value == null) ? false : true;
  }

  /**
   * Init or redraw the chart.
   * The C3 based charts do not have a redraw function,
   * if we need a complete new chart we have to reinit the dom element with the new dataset.
   *
   * @param {string} redraw Reinit should be called or not.
   */
  initChart(redraw = undefined) {
    if (redraw === undefined) {
      initVariables();

      chart = c3.generate({
        data: {
          x: 'x',
          bindto: '#chart',
          columns: [
            xAxisData,
            bytes.byte_code,
            bytes.string,
            bytes.property,
            bytes.object,
            bytes.allocated,
          ],
          types: {
            byte_code_bytes: 'area',
            string_bytes: 'area',
            property_bytes: 'area',
            object_bytes: 'area',
            allocated_bytes: 'area',
          },
          order: null,
          groups: [
            ['byte_code_bytes', 'string_bytes', 'property_bytes', 'object_bytes', 'allocated_bytes'],
          ],
        },
        axis: {
          x: {
            type: 'category',
            tick: {
              rotate: -75,
              multiline: false,
              culling: {
                max: 10,
              },
              fit: true,
            },
            height: 55,
          },
          y: {
            tick: {
              format: function(d) {
                return Math.round(d) + ' B';
              },
              count: 6,
              fit: true,
            },
          },
        },
        point: {
          r: 2,
          focus: {
            expand: {
              enabled: false,
            },
          },
        },
        tooltip: {
          position: function() {
            return {
              top: tooltipRelativeYPosition,
              left: tooltipRelativeXPosition,
            };
          },
        },
        transition: {
          duration: 0,
        },
      });

      $('#chart').bind('mousewheel DOMMouseScroll', (e) => {
        mouseWheelHandler(e);
      });

      $('#chart').mousemove((e) => {
        tooltipRelativeYPosition = e.clientY - $('#chart').offset().top + 10;
        tooltipRelativeXPosition = e.clientX - $('#chart').offset().left + 10;
      });
    } else {
      updateScrolledChart();
    }
  }

  /**
   * Resets the chart to the default empty state.
   */
  resetChart() {
    xAxisData = undefined;
    bytes.byte_code = undefined;
    bytes.string = undefined;
    bytes.property = undefined;
    bytes.object = undefined;
    bytes.allocated = undefined;

    this._surface.toggleButton(false, 'chart-reset-button');
    this._surface.toggleButton(false, 'chart-stop-button');
    this._surface.toggleButton(true, 'chart-record-button');
    $('#chart-record-button').css('background-color', '');

    this.initChart();
  }

  /**
   * Resizes the chart dimensions.
   *
   * @param {integer} height New height dimension in pixel.
   * @param {integer} width New width dimension in pixel.
   */
  resizeChart(height, width) {
    chart.resize({
      height: (height - 45),
      width: (width - 10),
    });
  }

  /**
   * Disables every chart action buttons in the panel.
   */
  disableChartButtons() {
    this._activeChart = false;
    let list = $('.chart-btn');

    for (let i = 0; i < list.length; i++) {
      this._surface.toggleButton(false, $(list[i]).attr('id'));
    }
    $('#chart-record-button').css('background-color', '');
  }

  /**
   * Starts the chart work and sets the actions buttons to work state.
   */
  startChartWithButton() {
    this._startRecord = true;
    this._activeChart = true;

    this._surface.toggleButton(false, 'chart-reset-button');
    this._surface.toggleButton(true, 'chart-stop-button');
    this._surface.toggleButton(false, 'chart-record-button');
  }

  /**
   * Stops the chart work and sets the action buttons to pause state.
   */
  stopChartWithButton() {
    this._activeChart = false;

    this._surface.toggleButton(true, 'chart-reset-button');
    this._surface.toggleButton(false, 'chart-stop-button');
    this._surface.toggleButton(true, 'chart-record-button');
    $('#chart-record-button').css('background-color', '#e22b1b');
  }

  /**
   * Generates a JSON report about the collected informations and pops up a download window.
   */
  exportChartData() {
    if (xAxisData.length == 1) {
      alert('There is nothing to be exported from the memory usage!');
      return;
    }

    let data = [
      [xAxisData[0]].concat(xAxisData.slice(maxDatapointNumber + 1)),
      [bytes.byte_code[0]].concat(bytes.byte_code.slice(maxDatapointNumber + 1)),
      [bytes.string[0]].concat(bytes.string.slice(maxDatapointNumber + 1)),
      [bytes.property[0]].concat(bytes.property.slice(maxDatapointNumber + 1)),
      [bytes.object[0]].concat(bytes.object.slice(maxDatapointNumber + 1)),
      [bytes.allocated[0]].concat(bytes.allocated.slice(maxDatapointNumber + 1)),
    ];

    data[0][0] = 'Checked at:';
    let csv = '';

    data.forEach(function(row) {
      csv += row.join(',');
      csv += '\n';
    });

    FileSaver.saveAs(new Blob([csv], {type: 'text/csv;charset=utf-8'}), 'memoryUsage.csv');

    this._surface.toggleSidenavExtra('download-sidenav');
  }

  /**
   * Push new memory consumption data part into the main dataset.
   *
   * @param {array} data The new bytes informations.
   * @param {array} breakpointInformation Informations about the current breakpoint (e.g.: line).
   */
  addNewDataPoints(data, breakpointInformation) {
    checkTime.push(breakpointInformation);

    let counter = 1;
    if (breakpointInformation.includes('ln')) {
      for (let i = maxDatapointNumber; i < xAxisData.length; i++) {
        if (xAxisData[i].includes(breakpointInformation)) {
          counter++;
        }
      }

      if (counter == 1) {
        xAxisData.push(breakpointInformation);
      } else {
        xAxisData.push('#' + counter + ' ' + breakpointInformation);
      }
    } else {
      let timeToChart = new EstimatedTime();
      let i = xAxisData.length - 1;
      xAxisData.push(timeToChart.toString());

      while (i > maxDatapointNumber) {
        if (!xAxisData[i].includes('ln')) {
          timeToChart.increment();
          xAxisData[i] = timeToChart.toString();
        }
        i--;
      }
    }

    bytes.byte_code.push(data[1]);
    bytes.string.push(data[2]);
    bytes.property.push(data[4]);
    bytes.object.push(data[3]);
    bytes.allocated.push(data[0]);

    if (xAxisData.length <= maxDatapointNumber + 1) {
      chart.load({
        columns: [
          xAxisData,
          bytes.byte_code,
          bytes.string,
          bytes.property,
          bytes.object,
          bytes.allocated,
        ],
      });
    } else {
      minimumXIndex++;
      updateScrolledChart();
    }
  }
}

/**
 * Mosue scroll button handler for the X axis movement.
 *
 * @param {event} e Mouse scroll event.
 */
function mouseWheelHandler(e) {
  e.originalEvent.wheelDelta > 0 ? scrollForward() : scrollBack();
}

/**
 * Backwards scroll range handler. Decrease the minimum X axis range.
 */
function scrollBack() {
  if (xAxisData.length >= maxDatapointNumber + 1 && minimumXIndex > maxDatapointNumber + 1) {
    minimumXIndex--;
    updateScrolledChart();
  }
}

/**
 * Forwards scroll range handler. Increase the minimum X axis range.
 */
function scrollForward() {
  if (xAxisData.length > maxDatapointNumber + minimumXIndex) {
    minimumXIndex++;
    updateScrolledChart();
  }
}

/**
 * Updates the chart by redrawing the dataset based on the new minimum X axis range.
 */
function updateScrolledChart() {
  chart.load({
    columns: [
      [xAxisData[0]].concat(xAxisData.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [bytes.byte_code[0]].concat(bytes.byte_code.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [bytes.string[0]].concat(bytes.string.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [bytes.property[0]].concat(bytes.property.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [bytes.object[0]].concat(bytes.object.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
      [bytes.allocated[0]].concat(bytes.allocated.slice(minimumXIndex, maxDatapointNumber + minimumXIndex)),
    ],
  });
}

/**
 * Inits the chart related variables to their default start values.
 */
function initVariables() {
  minimumXIndex = 1;
  maxDatapointNumber = 40;
  xAxisData = ['x'];
  checkTime = ['x'];
  bytes.byte_code = ['byte_code_bytes'];
  bytes.string = ['string_bytes'];
  bytes.property = ['property_bytes'];
  bytes.object = ['object_bytes'];
  bytes.allocated = ['allocated_bytes'];
  let empty_space = ' ';

  for (let i = 0; i < maxDatapointNumber; i++) {
    xAxisData.push(empty_space);
    checkTime.push(null);
    bytes.byte_code.push(null);
    bytes.string.push(null);
    bytes.property.push(null);
    bytes.object.push(null);
    bytes.allocated.push(null);
    empty_space = empty_space.concat(' ');
  }
}

/**
 * Calculates the time label for the dataset entries.
 */
class EstimatedTime {

  constructor() {
    this._hour = 0;
    this._minute = 0;
    this._second = 0;
    this._millisecond = 0;
  }

  increment() {
    this._millisecond += 5;
    if (this._millisecond >= 10) {
      this._second += 1;
      this._millisecond -= 10;
    }
    if (this._second === 60) {
      this._minute += 1;
      this._second = 0;
    }
    if (this._minute === 60) {
      this._hour += 1;
      this._minute = 0;
    }
    if (this._hour === 24) {
      this.reset();
    }
  }

  toString() {
    let sign = '-';
    if (this._hour === 0 && this._minute === 0 && this._second === 0 && this._millisecond === 0) sign = '';
    return `${sign}${this._minute}:${this._second}.${this._millisecond}`;
  }

  reset() {
    this._hour = 0;
    this._minute = 0;
    this._second = 0;
    this._minute = 0;
  }
}
