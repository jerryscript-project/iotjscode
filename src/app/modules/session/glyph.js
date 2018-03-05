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
 * Types of the glyphs.
 * These types stands for the css classes, too.
 */
export const GLYPH_TYPE = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
};


export default class Glyph {

  /**
   * Constructor.
   *
   * @param {object} editor The monaco editor instance.
   */
  constructor(editor) {
    this._editor = editor;
    this._decorations = [];
    this._list = [];
  }

  /**
   * Returns the actual decorations list.
   */
  get decorations() {
    return this._decorations;
  }

  /**
   * Returns the actual breakpoint glpyh list.
   */
  get list() {
    return this._list;
  }

  /**
   * Adds a new breakpoint glyph to the list.
   *
   * @param {GLYPH_TYPE} type The new type of the glyph object.
   * @param {number} file ID of the selected file.
   * @param {number} line Line number whitin the selected file.
   */
  add(type, file, line) {
    this._list = [
      ...this._list,
      {
        type: type,
        file: file,
        line: line,
        object: createGlyphObject(type, line),
      },
    ];
  }

  /**
   * Checks that the selected file and line combination is holds an active breakpoint glyph or not.
   *
   * @param {number} file ID of the selected file.
   * @param {number} line Line number whitin the selected file.
   * @returns {boolean} True if there is an active breakpoint glyph, false otherwise.
   */
  isLineActive(file, line) {
    return this._list.find(o => (o.file === file && o.line === line)).type === GLYPH_TYPE.ACTIVE;
  }

  /**
   * Returns a list of breakpoint glyphs from a selected file.
   *
   * @param {number} file ID of the selected file.
   * @return {array} Array of breakpoint glyph objects.
   */
  listByFile(file) {
    return this._list.filter(o => o.file === file);
  }

  /**
   * Returns the Monaco based glyph objects based on the selected file.
   *
   * @param {number} file ID of the selected file.
   * @returns {array} Array of breakpoint glyph objects.
   */
  objectByFile(file) {
    return this._list.filter(o => o.file === file).map(o => o.object);
  }

  /**
   * Removes a glyph from the list based on a file and line combination.
   *
   * @param {number} file ID of the selected file.
   * @param {number} line Line number whitin the selected file.
   */
  remove(file, line) {
    this._list = this._list.filter(o => o.file !== file && o.line !== line);
  }

  /**
   * Removes every breakpoint glyphs where the file property match.
   *
   * @param {number} file ID of the selected file.
   */
  removeByFile(file) {
    this._list = this._list.filter(o => o.file !== file);
  }

  /**
   * Removes every breakpoint glyphs.
   */
  removeAll() {
    this._list = [];
    this.render(this._decorations, this._list);
  }

  /**
   * Changes a selected glyph object's type.
   *
   * @param {number} file ID of the selected file.
   * @param {number} line Line number whitin the selected file.
   * @param {GLYPH_TYPE} type The type of the new glyph.
   */
  change(file, line, type) {
    this._list = this._list.map(o => {
      if (o.file === file && o.line === line) {
        return {
          type: type,
          file: o.file,
          line: o.line,
          object: createGlyphObject(type, line),
        };
      } else {
        return o;
      }
    });
  }

  /**
   * Resets the selected glyph types to the initial inactive type.
   *
   * @param {GLYPH_TYPE} type The type what will be changed.
   */
  resetByType(type) {
    this._list = this._list.map(o => {
      if (o.type === type) {
        o.type = GLYPH_TYPE.INACTIVE;
      }
    });
  }

  /**
   * Checks that the selected file is processed or not.
   *
   * @param {number} file ID of the selected file.
   */
  isFileInitialized(file) {
    return this._list.findIndex(o => o.file === file) !== -1;
  }

  /**
   * Renders the proper glyphs into the given file model.
   *
   * @param {number} file ID of the selected file.
   */
  renderByFile(file) {
    this.render(this._decorations, this._list.filter(o => o.file === file).map(o => o.object));
  }

  /**
   * Renders the given glyph list to the Monaco model.
   *
   * @param {array} decorations Array of decoration IDs.
   * @param {array} list Array of glyph objects.
   */
  render(decorations, list) {
    this._decorations = this._editor.deltaDecorations(decorations, list);
  }
}

/**
 * Returns with a new breakpoint glyph decoration object.
 *
 * @param {GLYPH_TYPE} type The new type of the glyph object.
 * @param {number} line Source code line where the new glyph will be rendered.
 * @returns {object} Monaco compatible glyph object.
 */
const createGlyphObject = (type, line) => {
  return {
    range: new window.monaco.Range(line, 1, line, 1),
    options: {
      glyphMarginClassName: `${type}-breakpoint-line`,
    },
  };
};
