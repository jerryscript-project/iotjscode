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

const global = {
  chart: null,
  maxDatapointNumber: null,
  minimumXIndex: null,
  tooltipRelativeYPosition: null,
  tooltipRelativeXPosition: null,
  xAxisData: null,
  checkTime: null,
  bytes: null,
};

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

    global.bytes = {
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
  set chartActive(value) {
    this._activeChart = value;
  }

  /**
   * Checks for available data.
   *
   * @return {boolean} True if there is any data, false otherwise.
   */
  containsData() {
    return (global.chart !== null &&
            global.chart.data('allocated_bytes')[0].values[global.maxDatapointNumber - 1].value !== null);
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

      global.chart = c3.generate({
        data: {
          x: 'x',
          bindto: '#chart',
          columns: [
            global.xAxisData,
            global.bytes.byte_code,
            global.bytes.string,
            global.bytes.property,
            global.bytes.object,
            global.bytes.allocated,
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
              format: d => {
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
          position: () => {
            return {
              top: global.tooltipRelativeYPosition,
              left: global.tooltipRelativeXPosition,
            };
          },
        },
        transition: {
          duration: 0,
        },
      });

      $('#chart').bind('mousewheel DOMMouseScroll', e => mouseWheelHandler(e));

      $('#chart').mousemove(e => {
        global.tooltipRelativeYPosition = e.clientY - $('#chart').offset().top + 10;
        global.tooltipRelativeXPosition = e.clientX - $('#chart').offset().left + 10;
      });
    } else {
      updateScrolledChart();
    }
  }

  /**
   * Resets the chart to the default empty state.
   */
  resetChart() {
    global.xAxisData = undefined;
    global.bytes.byte_code = undefined;
    global.bytes.string = undefined;
    global.bytes.property = undefined;
    global.bytes.object = undefined;
    global.bytes.allocated = undefined;

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
    global.chart.resize({
      height: (height - 45),
      width: (width - 10),
    });
  }

  /**
   * Disables every chart action buttons in the panel.
   */
  disableChartButtons() {
    this._activeChart = false;
    const list = $('.chart-btn');
    Object.keys(list).forEach(key => this._surface.toggleButton(false, $(key).attr('id')));
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
    if (global.xAxisData.length == 1) {
      alert('There is nothing to be exported from the memory usage!');
      return;
    }

    const data = [
      [global.xAxisData[0]].concat(global.xAxisData.slice(global.maxDatapointNumber + 1)),
      [global.bytes.byte_code[0]].concat(global.bytes.byte_code.slice(global.maxDatapointNumber + 1)),
      [global.bytes.string[0]].concat(global.bytes.string.slice(global.maxDatapointNumber + 1)),
      [global.bytes.property[0]].concat(global.bytes.property.slice(global.maxDatapointNumber + 1)),
      [global.bytes.object[0]].concat(global.bytes.object.slice(global.maxDatapointNumber + 1)),
      [global.bytes.allocated[0]].concat(global.bytes.allocated.slice(global.maxDatapointNumber + 1)),
    ];

    data[0][0] = 'Checked at:';
    let csv = '';

    data.forEach(row => {
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
    global.checkTime.push(breakpointInformation);

    if (breakpointInformation.includes('ln')) {
      const counter = global.xAxisData
        .slice(global.maxDatapointNumber)
        .filter(data => data.includes(breakpointInformation))
        .length;

      if (counter == 1) {
        global.xAxisData.push(breakpointInformation);
      } else {
        global.xAxisData.push('#' + counter + ' ' + breakpointInformation);
      }
    } else {
      const timeToChart = new EstimatedTime();
      let i = global.xAxisData.length - 1;
      global.xAxisData.push(timeToChart.toString());

      while (i > global.maxDatapointNumber) {
        if (!global.xAxisData[i].includes('ln')) {
          timeToChart.increment();
          global.xAxisData[i] = timeToChart.toString();
        }
        i--;
      }
    }

    global.bytes.byte_code.push(data[1]);
    global.bytes.string.push(data[2]);
    global.bytes.property.push(data[4]);
    global.bytes.object.push(data[3]);
    global.bytes.allocated.push(data[0]);

    if (global.xAxisData.length <= global.maxDatapointNumber + 1) {
      global.chart.load({
        columns: [
          global.xAxisData,
          global.bytes.byte_code,
          global.bytes.string,
          global.bytes.property,
          global.bytes.object,
          global.bytes.allocated,
        ],
      });
    } else {
      global.minimumXIndex++;
      updateScrolledChart();
    }
  }
}

/**
 * Mosue scroll button handler for the X axis movement.
 *
 * @param {event} e Mouse scroll event.
 */
const mouseWheelHandler = e => {
  e.originalEvent.wheelDelta > 0 ? scrollForward() : scrollBack();
};

/**
 * Backwards scroll range handler. Decrease the minimum X axis range.
 */
const scrollBack = () => {
  if (global.xAxisData.length >= global.maxDatapointNumber + 1 &&
      global.minimumXIndex > global.maxDatapointNumber + 1) {
    global.minimumXIndex--;
    updateScrolledChart();
  }
};

/**
 * Forwards scroll range handler. Increase the minimum X axis range.
 */
const scrollForward = () => {
  if (global.xAxisData.length > global.maxDatapointNumber + global.minimumXIndex) {
    global.minimumXIndex++;
    updateScrolledChart();
  }
};

/**
 * Updates the chart by redrawing the dataset based on the new minimum X axis range.
 */
const updateScrolledChart = () => {
  global.chart.load({
    columns: [
      [global.xAxisData[0]].concat(
        global.xAxisData.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
      [global.bytes.byte_code[0]].concat(
        global.bytes.byte_code.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
      [global.bytes.string[0]].concat(
        global.bytes.string.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
      [global.bytes.property[0]].concat(
        global.bytes.property.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
      [global.bytes.object[0]].concat(
        global.bytes.object.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
      [global.bytes.allocated[0]].concat(
        global.bytes.allocated.slice(global.minimumXIndex, global.maxDatapointNumber + global.minimumXIndex)
      ),
    ],
  });
};

/**
 * Inits the chart related variables to their default start values.
 */
const initVariables = () => {
  global.minimumXIndex = 1;
  global.maxDatapointNumber = 40;
  global.xAxisData = ['x'];
  global.checkTime = ['x'];
  global.bytes.byte_code = ['byte_code_bytes'];
  global.bytes.string = ['string_bytes'];
  global.bytes.property = ['property_bytes'];
  global.bytes.object = ['object_bytes'];
  global.bytes.allocated = ['allocated_bytes'];
  let empty_space = ' ';

  for (let i = 0; i < global.maxDatapointNumber; i++) {
    global.xAxisData.push(empty_space);
    global.checkTime.push(null);
    global.bytes.byte_code.push(null);
    global.bytes.string.push(null);
    global.bytes.property.push(null);
    global.bytes.object.push(null);
    global.bytes.allocated.push(null);
    empty_space = empty_space.concat(' ');
  }
};

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
