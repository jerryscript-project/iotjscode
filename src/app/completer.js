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

export default class Completer {

  constructor() {}

  /**
   * Returns a monaco based completion provider.
   */
  getCompletionProvider() {
    return {
      provideCompletionItems: (model) => {
        return this.getCompletionProposals(iotjs, this.lookingForModules(model.getValue()));
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
    return modules.map(m => list[m]).reduce((a, b) => a.concat(b), []);
  }

  /**
   * Checks the whole source code to find every require call,
   * extracts the module names from them, then returns with them.
   *
   * @param {string} source The actual opened source code.
   * @return {array} List of the required module names.
   */
  lookingForModules(source) {
    const expr = /require\([''].+['']\);/g;
    let array = null;

    // Add core modules to the return list. These modules can be used without require in IoT.js.
    let modules = ['process', 'events', 'timers'];

    while ((array = expr.exec(source)) !== null) {
      if (array[0]) {
        // Slice down the require part.
        let name = array[0].slice(9);

        // Slice down the end of the statement.
        name = name.slice(0, name.length - 3);

        // Split up the module name and get the last element (which should be the module's name).
        name = name.split('/');
        name = name[name.length - 1];

        if (!modules.includes(name)) {
          modules.push(name.toLowerCase());
        }
      }
    }

    return modules;
  }
}
