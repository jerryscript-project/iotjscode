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
 * A single line html element in the console or output panel.
 */
const LINE = $("<span class='data'></span>");

/**
 * The popup window wrapper element and window types enumeration.
 */
const POPUP = {
  WRAPPER: $("#popup-wrapper"),
  TYPE: {
    SUCCESS: 0,
    INFO: 1,
    WARNING: 2,
    DANGER: 3
  }
}

/**
 * Contructor.
 *
 * @param {object} element Dom element where the messages should go.
 */
function Logger(element) {
  if (!(this instanceof Logger)) {
    throw new TypeError("Logger constructor cannot be called as a function.");
  }

  this._panel = element;
}

/**
 * Appends the given message into the panel as a simple info.
 * Also creates a popup if the pop argument is defined as true.
 *
 * @param {string} message The message which will appear in the logger panel.
 * @param {boolean} pop Enable the popup window (disabled by default).
 */
Logger.prototype.info = function(message, pop) {
  pop = pop || false;

  this._panel.append(LINE.clone().addClass("log-info").text(message));
  Util.scrollDown(this._panel);

  if (pop) {
    POPUP.WRAPPER.append(createPopup(POPUP.TYPE.INFO, "Info", message));
  }
};

/**
 * Appends the given message into the popup area as a warning.
 *
 * @param {string} message The message which will appear in the popup alert.
 * @param {boolean} pop Enable the popup window (disabled by default).
 */
Logger.prototype.warning = function(message, pop) {
  pop = pop || false;

  this._panel.append(LINE.clone().addClass("log-warning").text(message));
  Util.scrollDown(this._panel);

  if (pop) {
    POPUP.WRAPPER.append(createPopup(POPUP.TYPE.WARNING, "Warning", message));
  }
};

/**
 * Appends the given message into the popup area as an error.
 *
 * @param {string} message The message which will appear in the popup alert.
 * @param {boolean} pop Enable the popup window (disabled by default).
 */
Logger.prototype.error = function(message, pop) {
  pop = pop || false;

  this._panel.append(LINE.clone().addClass("log-error").text(message));
  Util.scrollDown(this._panel);

  if (pop) {
    POPUP.WRAPPER.append(createPopup(POPUP.TYPE.DANGER, "Error", message));
  }
};

/**
 * Appends the given data into the panel
 * as a debug information in JSON format,
 * or puts a new dom element into it if the dom parametere is true.
 *
 * @param {string} message The message which will appear in the logger panel.
 * @param {mixed} data A complex JSON formatted information object.
 * @param {boolean} dom A complex HTML formatted text (e.g. a button).
 */
Logger.prototype.debug = function(message, data, dom) {
  dom = dom || false;

  if (dom) {
    this._panel.append(LINE.clone().addClass("log-debug-dom").text(message));
    this._panel.append($(data));
  } else {
    message = "DEBUG LOG: " + message + JSON.stringify(data);
    this._panel.append(LINE.clone().addClass("log-debug").text(message));
  }
  Util.scrollDown(this._panel);
};

/**
 * Creates a bootsrtap based alert div with the given aprameters.
 *
 * @param {number} type The type of the alert div.
 * @param {string} strong The strong text in the alert div.
 * @param {string} message The message to the user.
 * @return {object} HTML div element.
 */
function createPopup(type, strong, message) {
  var icon = "";
  var clss = "";
  var lrt = null;

  switch (type) {
    case POPUP.TYPE.INFO:
      icon = "info-circle";
      clss = "alert-info";
      break;
    case POPUP.TYPE.WARNING:
      icon = "exclamation-triangle";
      clss = "alert-warning";
      break;
    case POPUP.TYPE.DANGER:
      icon = "ban"
      clss = "alert-danger";
      break;
    default:
      icon = "check-circle";
      clss = "alert-success";
      break;
  }

  lrt = $(
    '<div class="alert ' + clss + ' alert-dismissable fade in">' +
      '<i class="fa fa-' + icon + '" aria-hidden="true"></i>' +
      '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
      '<strong>' + strong + '!</strong> ' + message +
    '</div>'
  );

  // Wait 30 sec then close the alert window.
  setTimeout(function() {
    lrt.alert("close");
  }, 30000);

  return lrt;
}

export default Logger;
