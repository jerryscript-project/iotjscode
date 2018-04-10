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

import Util from './util';

/**
 * The popup window wrapper element and window types enumeration.
 */
const POPUP = {
  WRAPPER: $('#popup-wrapper'),
  TYPE: {
    SUCCESS: 0,
    INFO: 1,
    WARNING: 2,
    DANGER: 3,
  },
};

export default class Logger {

  /**
   * Constructor.
   *
   * @param {object} element Dom element where the messages should go.
   */
  constructor(element) {
    this._panel = element;
  }

  /**
   * Appends the given message into the panel as a simple info.
   * Also creates a popup if the pop argument is defined as true.
   *
   * @param {string} message The message which will appear in the logger panel.
   * @param {boolean} pop Enable the popup window (disabled by default).
   * @param {boolean} pre Enable the pre html tag before the content.
   */
  info(message, pop = false, pre = false) {
    this._panel.append(createLine('log-info', message, pre));
    Util.scrollDown(this._panel);

    if (pop) {
      POPUP.WRAPPER.append(createPopup(POPUP.TYPE.INFO, 'Info', message));
    }
  }

  /**
   * Appends the given message into the popup area as a warning.
   *
   * @param {string} message The message which will appear in the popup alert.
   * @param {boolean} pop Enable the popup window (disabled by default).
   * @param {boolean} pre Enable the pre html tag before the content.
   */
  warning(message, pop = false, pre = false) {
    this._panel.append(createLine('log-warning', message, pre));
    Util.scrollDown(this._panel);

    if (pop) {
      POPUP.WRAPPER.append(createPopup(POPUP.TYPE.WARNING, 'Warning', message));
    }
  }

  /**
   * Appends the given message into the popup area as an error.
   *
   * @param {string} message The message which will appear in the popup alert.
   * @param {boolean} pop Enable the popup window (disabled by default).
   * @param {boolean} pre Enable the pre html tag before the content.
   */
  error(message, pop = false, pre = false) {
    this._panel.append(createLine('log-error', message, pre));
    Util.scrollDown(this._panel);

    if (pop) {
      POPUP.WRAPPER.append(createPopup(POPUP.TYPE.DANGER, 'Error', message, pre));
    }
  }

  /**
   * Appends the given data into the panel
   * as a debug information in JSON format,
   * or puts a new dom element into it if the dom parameter is true.
   *
   * @param {string} message The message which will appear in the logger panel.
   * @param {mixed} data A complex JSON formatted information object.
   * @param {boolean} pop Enable the popup window (disabled by default).
   * @param {boolean} pre Enable the pre html tag before the content (disabled by default).
   */
  debug(message, data = undefined, pop = false, pre = false) {
    message = `DEBUG LOG: ${message}`;
    if (data) message = `${message} ${JSON.stringify(data)}`;

    this._panel.append(createLine('log-debug', message, pre));
    Util.scrollDown(this._panel);

    if (pop) {
      POPUP.WRAPPER.append(createPopup(POPUP.TYPE.DANGER, 'Error', message, pre));
    }
  }
}

/**
 * Creates a bootstrap based alert div with the given parameters.
 *
 * @param {number} type The type of the alert div.
 * @param {string} strong The strong text in the alert div.
 * @param {string} message The message to the user.
 * @param {boolean} pre Enable the pre html tag before the content.
 * @return {object} HTML div element.
 */
const createPopup = (type, strong, message, pre = false) => {
  let icon = '',
      clss = '',
      lrt = null;

  switch (type) {
    case POPUP.TYPE.INFO:
      icon = 'info-circle';
      clss = 'alert-info';
      break;
    case POPUP.TYPE.WARNING:
      icon = 'exclamation-triangle';
      clss = 'alert-warning';
      break;
    case POPUP.TYPE.DANGER:
      icon = 'ban';
      clss = 'alert-danger';
      break;
    default:
      icon = 'check-circle';
      clss = 'alert-success';
      break;
  }

  lrt = $(
    `<div class="alert ${clss} alert-dismissable fade in">` +
      `<i class="fa fa-${icon}" aria-hidden="true"></i>` +
      '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
      `<strong>${strong}!</strong><br/>` +
      ((pre) ? `<strong><pre>${message}</pre></strong>` : `<strong>${message}</strong>`) +
    '</div>'
  );

  // Wait 30 sec then close the alert window.
  setTimeout(() => lrt.alert('close'), 10000);

  return lrt;
};

/**
 * Creates a new log line from the given message and a timestamp.
 *
 * @param {string} classes Stylesheet classes fo the new message text.
 * @param {string} message The message what will be in the log.
 * @param {boolean} pre Enable the pre html tag before the content.
 */
const createLine = (classes, message, pre = false) => {
  return $(
    '<p class="data">' +
      `<font class="data-timestamp">${getTimestamp()}</font>` +
      `${pre ? '<pre>' : `<font class="data-message ${classes}">${message}${pre ? '</pre>' : '</font>'}`}` +
    '</p>'
  );
};

/**
 * Returns the current hour, minute and second in terminal like format.
 */
const getTimestamp = () => {
  const date = new Date();
  return `[${fixTime(date.getHours())}:${fixTime(date.getMinutes())}:${fixTime(date.getSeconds())}] `;
};

/**
 * Appends a zero before a time number if that is less than ten to keep the unified format.
 */
const fixTime = time => time < 10 ? `0${time}` : time;
