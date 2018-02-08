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

const path = require('path');
const fs = require('fs');

/**
 * Constant options.
 */
const config = {
  output: {
    name: 'iotjs-functions.json',
    path: 'src/app/constants',
  },
  docname: {
    pre: 'IoT.js-API-',
    post: '.md',
  },
  regex: {
    proto: /^###\s[a-zA-Z0-9]*.[a-zA-Z0-9]*\(.*\).*$/g,
    event: /^###\sEvent:\s.*$/g,
    new: /^###\snew\s.*$/g,
    args: /\(.*\).*/g,
    exDef: /^\*\*Example\*\*$/g,
    exLess: /^Example:$/g,
  },
};

/**
 * This is a simple file parser which is trying to find every public function in the IoT.js documentation.
 */
class DocsParser {

  /**
   * Constructor.
   */
  constructor() {
    this.filename = __filename.split('/').pop();
    this.verbose = false;
    this.iotjs = '';
    this.output = {};
  }

  /**
   * Starts the parsing and then writes the output into the proper file if the given arguments are valid.
   *
   * @param {array} argv Command line argumentum list.
   */
  start(argv) {
    if (argv.includes('-v') || argv.includes('--verbose')) {
      this.verbose = true;
    }

    const path = argv.find((a, i) => i > 1 && (!a.includes('-') && !a.includes('--')));

    if (argv.includes('-h') || argv.includes('--help')) {
      console.info([
        `\nUsage: ${this.filename} [OPTION]... IOTJS...\n`,
        'Collect information about the IoT.js API functions (prototype, arguments, documentation)',
        'and save them into a json file in Monaco friendly format.\n',
        'Options list:',
        '  -v,  --verbose\tPrint a message for each parsed module.',
        '  -h,  --help\t\tDisplay this help and exit.\n',
        'Arguments list:',
        '  IOTJS\t\t\tPath to the IoT.js root directory.',
      ].join('\n'));

      return;
    } else if (!path) {
      console.error([
        `${this.filename}: Missing operand.`,
        `Try 'node ${this.filename} --help' for more information.`,
      ].join('\n'));

      return;
    } else if (!fs.existsSync(path)) {
      console.error('The given IoT.js path is not exists.');

      return;
    } else {
      this.iotjs = path;

      this.parse();
    }
  }

  /**
   * Reads every file in the IoT.js docs folder and collects every function prototype and description about them.
   */
  parse() {
    const basePath = path.join(this.iotjs, 'docs/api');

    fs.readdir(basePath, (err, files) => {
      this.verboseLog(`Read '${basePath}' directory.`);

      if (err) {
        console.error(err.message);
        return false;
      }

      const promises = files.filter(file => !file.includes('reference')).map(file => {
        const name = file.slice(
          config.docname.pre.length,
          -config.docname.post.length
        ).toLowerCase().replace('file-system', 'fs');

        this.addModuleToOutput(name);

        return new Promise((resolve, reject) => {
          const filePath = path.join(basePath, file);

          fs.readFile(filePath, 'utf8', (error, data) => {
            this.verboseLog(`- Read '${filePath}' --> ${name} module`);

            if (error) {
              reject(error.message);
            } else {
              resolve({ name, data });
            }
          });
        });
      });

      Promise.all(promises).then((data) => {
        this.verboseLog('\nParse each read file content to get their available functions list.');

        data.forEach((file) => {
          this.verboseLog(`- Parse ${file.name} module:`);

          let doc = false;
          let label = '';
          let detail = '';
          let insertText = '';
          let documentation = [];

          file.data.split('\n').forEach(line => {
            // Prototype line match.
            if (!config.regex.new.test(line) && config.regex.proto.test(line)) {
              // Found a new prototype before an example, save the last known prototype if necessary.
              if (doc) {
                this.addFunctionToModule(file.name, {
                  label: label,
                  kind: 2,
                  detail: detail,
                  documentation: documentation.join('\n'),
                  insertText: insertText,
                });
              }

              const functionName = line.substring(4).replace(config.regex.args, '').split('.').pop();
              const functionDetail = line.substring(4);

              label = functionName;
              detail = functionDetail;
              insertText = functionName;
              documentation = [];
              doc = true;

              this.verboseLog(`  = ${functionDetail}`);

              return;
            }

            // Documentation line match.
            if (!config.regex.event.test(line) &&
                !config.regex.exDef.test(line) &&
                !config.regex.exLess.test(line) &&
                !config.regex.proto.test(line) && doc) {
              documentation.push(line);
            } else {
              // Store the function documentation.
              if (doc) {
                this.addFunctionToModule(file.name, {
                  label: label,
                  kind: 2,
                  detail: detail,
                  documentation: documentation.join('\n'),
                  insertText: insertText,
                });
              }

              documentation = [];
              doc = false;
            }
          });
        });

        this.verboseLog('Modules are parsed.\n');

        this.writeOutputToDestonation();
      }).catch((error) => {
        console.error(error);
      });
    });
  }

  /**
   * Adds a new modul to the output list.
   *
   * @param {string} name Name of the module.
   */
  addModuleToOutput(name) {
    this.output[name] = [];
  }

  /**
   * Adds a function to the selected module.
   *
   * @param {string} name The name of the function's module.
   * @param {object} item Details about the function (label, kind, detail, documentation, insertText).
   */
  addFunctionToModule(name, item) {
    this.output[name].push(item);
  }

  /**
   * Writes the output into the iotjscode in json format.
   */
  writeOutputToDestonation() {
    const outputPath = path.join(config.output.path, config.output.name);

    this.verboseLog(`Write the output into '${outputPath}'`);

    fs.writeFileSync(outputPath, JSON.stringify(this.output, null, 2), 'utf-8');
  }

  /**
   * Writes a verbose message to the console.
   *
   * @param {string} text Desired text to log.
   */
  verboseLog(text) {
    if (this.verbose) {
      console.info(text);
    }
  }
}

new DocsParser().start(process.argv);
