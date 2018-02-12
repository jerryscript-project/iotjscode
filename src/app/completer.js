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

import iotjs from './constants/iotjs-functions';

/**
 * These modules can be used without require in IoT.js.
 */
const defaultModules = [{
  link: 'process',
  mod: 'process',
}, {
  link: 'emitter',
  mod: 'events',
}, {
  link: 'timers',
  mod: 'timers',
}];

export default class Completer {

  constructor() {}

  /**
   * Returns a monaco based completion provider.
   */
  getCompletionProvider() {
    return {
      // Extend the intelliSense trigger character list.
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        // Get editor content before the pointer.
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Looking for required modules in the source code.
        const modules = this.lookingForModules(textUntilPosition);

        // Get the current line based on the pointer.
        const textInPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Get the possible variable name before the pointer.
        const might = textInPosition.split(/\s/g).pop().replace(/\./g, '');
        // Get the module information based on the possible variable name.
        const match = modules.concat(defaultModules).find(m => m.link === might);

        // Returns the completion list based on match.
        if (match) {
          return this.getCompletionProposals(iotjs, [match]);
        } else {
          return this.getCompletionProposals(iotjs, defaultModules.concat(modules));
        }
      },
    };
  }

  /**
   * Returns a slice from the functions list.
   *
   * @param {array} list JSON formatted list about the available functions.
   * @param {array} modules List about the module metadata.
   * @return {object} Function list as JSON object.
   */
  getCompletionProposals(list, modules) {
    return modules.map(m => list[m.mod]).reduce((a, b) => a.concat(b), []);
  }

  /**
   * Checks the whole source code to find every require call,
   * extracts the module names from them, then returns with them.
   *
   * @param {string} source The actual opened source code.
   * @return {array} List of the required module names and variable names.
   */
  lookingForModules(source) {
    // Require line regex.
    const rm = /^(var|let|const)?\s*([a-zA-Z0-9$_]+)\s*=[\s|\n]*require\s*\(\s*['"]([a-zA-Z0-9$_]+)['"]\s*\);?$/;

    // Return the collected required module names and variable names.
    return source.split('\n').filter(line => rm.test(line)).map(m => {
      const match = rm.exec(m);

      return {
        link: match[2],
        mod: match[3],
      };
    });
  }
}
