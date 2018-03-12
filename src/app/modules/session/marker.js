/*
 * Copyright 2018 Samsung Electronics Co., Ltd. and other contributors
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

/**
 * Types of the markers.
 * These types stands for the css classes, too.
 */
export const MARKER_TYPE = {
  EXECUTE: 'execute',
  EXCEPTION: 'exception',
};

export default class Marker {

  /**
   * Constructor.
   *
   * @param {object} editor The monaco editor instance.
   */
  constructor(editor) {
    this._editor = editor;
    this._decoration = [];
    this._item = null;
  }

  get decoration() {
    return this._decoration;
  }

  get item() {
    return this._item;
  }

  /**
   *
   * @param {MARK_TYPE} type The type of the new marker.
   * @param {number} line Line number whitin the model.
   */
  set(type, line) {
    this._item = {
      type: type,
      line: line,
      object: createMarkerObject(type, line),
    };

    this.render();
  }

  /**
   * Renders the marker to the current model.
   */
  render() {
    const list = this._item ? [this._item.object] : [];
    this._decoration = this._editor.deltaDecorations(this._decoration, list);
  }

  /**
   * Resets the marker and remove from the model.
   */
  remove() {
    this._item = null;
    this.render();
  }
}

/**
 * Returns with a line marker decoration objects.
 *
 * @param {MARK_TYPE} type The type of the new marker.
 * @param {number} line Line number whitin the model.
 */
const createMarkerObject = (type, line) => {
  return {
    range: new window.monaco.Range(line, 1, line, 1),
    options: {
      isWholeLine: true,
      className: `${type}-marker`,
      marginClassName: `${type}-gutter-marker`,
    },
  };
};
