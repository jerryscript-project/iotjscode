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

import Logger from './logger';
import * as Babel from 'babel-standalone';
import { SourceMapConsumer } from 'source-map';

/**
 * Currently available transpiled sources.
 */
let transpiled = [];

export default class Transpiler {

  constructor() {
    this._logger = new Logger($('#console-panel'));
  }

  /**
   * Transpiles the provided ES6 source code into ES5 and stores that.
   *
   * @param {string} filename Name of the source file.
   * @param {string} source The source code which will be transpiled.
   */
  transformToES5(filename, source) {
    let name = filename.split('.')[0];

    try {
      transpiled[name] = Babel.transform(source, {
        filename: filename,
        presets: ['es2015-loose'],
        sourceMaps: true,
      });

      transpiled[name].smc = new SourceMapConsumer(transpiled[name].map);
    } catch (error) {
      this._logger.error($(error).get(0).message, true, true);
      return false;
    }

    return true;
  }

  /**
   * Returns the selected transpiled file's source code.
   *
   * @param {string} filename Name of the source file.
   */
  getTransformedSource(filename) {
    return transpiled[filename.split('.')[0]].code;
  }

  /**
   * Returns the selected transpiled file's source map.
   *
   * @param {string} filename Name of the source file.
   */
  getSingleSourceMap(filename) {
    return transpiled[filename.split('.')[0]].map;
  }

  /**
   * Returns the selected line and column pairs position from the original source code.
   *
   * @param {string} filename Name of the source file.
   * @param {number} line Selected line number from the generated source code.
   * @param {number} column Selected column number from the generated source code.
   */
  getOriginalPositionFor(filename, line, column) {
    let output = transpiled[filename.split('.')[0]].smc.originalPositionFor({ line, column });

    return {
      line: output.line,
      column: output.column,
    };
  }

  /**
   * Returns the selected line and column pairs position from the generated (transpiled) source code.
   *
   * @param {string} filename Name of the source file.
   * @param {number} line Selected line number from the original source code.
   * @param {number} column Selected column number from the original source code.
   */
  getGeneratedPositionFor(filename, line, column) {
    let output = transpiled[filename.split('.')[0]].smc.generatedPositionFor({
      source: filename,
      line: line,
      column: column,
    });

    return {
      line: output.line,
      column: output.column,
    };
  }

  /**
   * Checks if the transpiled array is empty.
   */
  isEmpty() {
    return (transpiled.length ? false : true);
  }

  /**
   * Removes the stored source maps.
   */
  clearTranspiledSources() {
    transpiled = [];
  }
}
