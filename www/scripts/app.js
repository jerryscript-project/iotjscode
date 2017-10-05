/* Copyright 2015-present Samsung Electronics Co., Ltd. and other contributors
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

requirejs.config({
  baseUrl: "scripts/lib",
  shim : {
    bootstrap: {
      deps: [
        "jquery"
      ]
    },
    thead: {
      deps: [
        "jquery"
      ]
    },
    acelanguage: {
      deps: [
        "ace/ace"
      ]
    }
  },
  paths: {
    app: "../app",
    ace: "ace",
    acelanguage: "ace/ext-language_tools",
    bootstrap: "bootstrap.min",
    thead: "jquery.floatThead.min",
    c3: "c3.min",
    d3: "d3.v3.min",
    filesaver: "filesaver/FileSaver.min",
    jquery: "jquery",
    jqueryui: "jquery-ui.min",
  }
});

// Load the main app module to start the app.
requirejs(["app/main"]);
