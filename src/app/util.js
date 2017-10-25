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

export default class Util {

  constructor() {}

  /**
   * Basic assertion function.
   * Throws an error if the assertion failed.
   *
   * @param {mixed} expr The expression.
   */
  static assert(expr) {
    if (!expr) {
      throw new Error('Assertion failed.');
    }
  }

  /**
   * Clears the given html element content.
   *
   * @param {object} element A valid DOM object.
   */
  static clearElement(element) {
    element.empty();
  }

  /**
   * Scrolls down to the bottom of the given element.
   *
   * @param {object} element A valid DOM object.
   */
  static scrollDown(element) {
    element.scrollTop(element.prop('scrollHeight'));
  }
}
