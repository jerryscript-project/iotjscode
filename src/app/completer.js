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

/**
 * Constructor.
 */
function Completer() {
  if (!(this instanceof Completer)) {
    throw new TypeError("Completer constructor cannot be called as a function.");
  }
}

/**
 * Returns a slice from the functions list that based on prefix.
 *
 * @param {array} list JSON formatted list about the available functions.
 * @param {string} prefix Searched function name substring.
 * @param {array} modules List about the module metadata.
 * @return {object} Function list as JSON object.
 */
Completer.prototype.getCompleterWordList = function(list, prefix, modules) {
  var results = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].word.toLowerCase().includes(prefix.toLowerCase().split(""))) {
      if (modules.includes(list[i].meta.toLowerCase().split(" ")[0])) {
        results.push(list[i]);
      }
    }
  }

  return results;
}

/**
 * Checks the whole source code to find every require call,
 * extract the module name from it, then returns with them.
 *
 * @param {string} source The actual opened source code.
 * @return {array} List of the required module names.
 */
Completer.prototype.lookingForModules = function(source) {
  var expr = /require\(['"].+['"]\);/g;
  var array = null;

  // Add core modules to the return list.
  // These modules can be used without require in IoT.js.
  var modules = ["process", "events", "timers"];

  while ((array = expr.exec(source)) !== null) {
    if (array[0]) {
      // Slice down the require part.
      var name = array[0].slice(9);

      // Slice down the end of the statement.
      name = name.slice(0, name.length - 3);

      // Split up the module name and get the last element
      // (which should be the module's name).
      name = name.split("/");
      name = name[name.length - 1];

      if (!modules.includes(name)) {
        modules.push(name.toLowerCase());
      }
    }
  }

  return modules;
}

/**
 * IoT.js Basic and Extended API functions list.
 */
Completer.prototype.iotjsFunctions = [
  /* Basic API */
  { "word": "assert", "score": 300, "meta": "Assert" },
  { "word": "doesNotThrow", "score": 300, "meta": "Assert" },
  { "word": "equal", "score": 300, "meta": "Assert" },
  { "word": "fail", "score": 300, "meta": "Assert" },
  { "word": "notEqual", "score": 300, "meta": "Assert" },
  { "word": "notStrictEqual", "score": 300, "meta": "Assert" },
  { "word": "strictEqual", "score": 300, "meta": "Assert" },
  { "word": "throws", "score": 300, "meta": "Assert" },

  { "word": "compare", "score": 300, "meta": "Buffer" },
  { "word": "copy", "score": 300, "meta": "Buffer" },
  { "word": "equals", "score": 300, "meta": "Buffer" },
  { "word": "fill", "score": 300, "meta": "Buffer" },
  { "word": "slice", "score": 300, "meta": "Buffer" },
  { "word": "toString", "score": 300, "meta": "Buffer" },
  { "word": "write", "score": 300, "meta": "Buffer" },
  { "word": "writeUInt8", "score": 300, "meta": "Buffer" },
  { "word": "writeUInt16LE", "score": 300, "meta": "Buffer" },
  { "word": "writeUInt32LE", "score": 300, "meta": "Buffer" },
  { "word": "readInt8", "score": 300, "meta": "Buffer" },
  { "word": "readUInt8", "score": 300, "meta": "Buffer" },
  { "word": "readUInt16LE", "score": 300, "meta": "Buffer" },

  { "word": "lookup", "score": 300, "meta": "DNS" },

  { "word": "addListener", "score": 300, "meta": "Events" },
  { "word": "on", "score": 300, "meta": "Events" },
  { "word": "emit", "score": 300, "meta": "Events" },
  { "word": "once", "score": 300, "meta": "Events" },
  { "word": "removeListener", "score": 300, "meta": "Events" },
  { "word": "removeAllListeners", "score": 300, "meta": "Events" },

  { "word": "close", "score": 300, "meta": "FS" },
  { "word": "closeSync", "score": 300, "meta": "FS" },
  { "word": "exists", "score": 300, "meta": "FS" },
  { "word": "existsSync", "score": 300, "meta": "FS" },
  { "word": "fstat", "score": 300, "meta": "FS" },
  { "word": "fstatSync", "score": 300, "meta": "FS" },
  { "word": "mkdir", "score": 300, "meta": "FS" },
  { "word": "mkdirSync", "score": 300, "meta": "FS" },
  { "word": "open", "score": 300, "meta": "FS" },
  { "word": "openSync", "score": 300, "meta": "FS" },
  { "word": "read", "score": 300, "meta": "FS" },
  { "word": "readSync", "score": 300, "meta": "FS" },
  { "word": "readdir", "score": 300, "meta": "FS" },
  { "word": "readdirSync", "score": 300, "meta": "FS" },
  { "word": "readFile", "score": 300, "meta": "FS" },
  { "word": "readFileSync", "score": 300, "meta": "FS" },
  { "word": "rename", "score": 300, "meta": "FS" },
  { "word": "renameSync", "score": 300, "meta": "FS" },
  { "word": "rmdir", "score": 300, "meta": "FS" },
  { "word": "rmdirSync", "score": 300, "meta": "FS" },
  { "word": "stat", "score": 300, "meta": "FS" },
  { "word": "statSync", "score": 300, "meta": "FS" },
  { "word": "unlink", "score": 300, "meta": "FS" },
  { "word": "unlinkSync", "score": 300, "meta": "FS" },
  { "word": "write", "score": 300, "meta": "FS" },
  { "word": "writeSync", "score": 300, "meta": "FS" },
  { "word": "writeFile", "score": 300, "meta": "FS" },
  { "word": "writeFileSync", "score": 300, "meta": "FS" },

  { "word": "createServer", "score": 300, "meta": "Http" },
  { "word": "request", "score": 300, "meta": "Http" },
  { "word": "get", "score": 300, "meta": "Http" },
  { "word": "timeout", "score": 300, "meta": "Http Server" },
  { "word": "listen", "score": 300, "meta": "Http Server" },
  { "word": "close", "score": 300, "meta": "Http Server" },
  { "word": "setTimeout", "score": 300, "meta": "Http Server" },
  { "word": "end", "score": 300, "meta": "Http ServerResponse" },
  { "word": "getHeader", "score": 300, "meta": "Http ServerResponse" },
  { "word": "removeHeader", "score": 300, "meta": "Http ServerResponse" },
  { "word": "setHeader", "score": 300, "meta": "Http ServerResponse" },
  { "word": "setTimeout", "score": 300, "meta": "Http ServerResponse" },
  { "word": "write", "score": 300, "meta": "Http ServerResponse" },
  { "word": "writeHead", "score": 300, "meta": "Http ServerResponse" },
  { "word": "end", "score": 300, "meta": "Http ClientRequest" },
  { "word": "setTimeout", "score": 300, "meta": "Http ClientRequest" },
  { "word": "write", "score": 300, "meta": "Http ClientRequest" },
  { "word": "headers", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "method", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "socket", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "statusCode", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "statusMessage", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "url", "score": 300, "meta": "Http IncomingMessage" },
  { "word": "setTimeout", "score": 300, "meta": "Http IncomingMessage" },

  { "word": "require", "score": 300, "meta": "Module" },

  { "word": "createServer", "score": 300, "meta": "Net" },
  { "word": "connect", "score": 300, "meta": "Net" },
  { "word": "createConnection", "score": 300, "meta": "Net" },
  { "word": "listen", "score": 300, "meta": "Net Server" },
  { "word": "close", "score": 300, "meta": "Net Server" },
  { "word": "connect", "score": 300, "meta": "Net Socket" },
  { "word": "write", "score": 300, "meta": "Net Socket" },
  { "word": "end", "score": 300, "meta": "Net Socket" },
  { "word": "destroy", "score": 300, "meta": "Net Socket" },
  { "word": "pause", "score": 300, "meta": "Net Socket" },
  { "word": "resume", "score": 300, "meta": "Net Socket" },
  { "word": "setTimeout", "score": 300, "meta": "Net Socket" },
  { "word": "setKeepAlive", "score": 300, "meta": "Net Socket" },

  { "word": "nextTick", "score": 300, "meta": "Process" },
  { "word": "exit", "score": 300, "meta": "Process" },
  { "word": "cwd", "score": 300, "meta": "Process" },
  { "word": "chdir", "score": 300, "meta": "Process" },

  { "word": "setTimeout", "score": 300, "meta": "Timers" },
  { "word": "clearTimeout", "score": 300, "meta": "Timers" },
  { "word": "setInterval", "score": 300, "meta": "Timers" },
  { "word": "clearInterval", "score": 300, "meta": "Timers" },

  /* Extended API */
  { "word": "open", "score": 300, "meta": "ADC" },
  { "word": "read", "score": 300, "meta": "ADC" },
  { "word": "readSync", "score": 300, "meta": "ADC" },
  { "word": "close", "score": 300, "meta": "ADC" },
  { "word": "closeSync", "score": 300, "meta": "ADC" },

  { "word": "startAdvertising", "score": 300, "meta": "BLE" },
  { "word": "stopAdvertising", "score": 300, "meta": "BLE" },
  { "word": "setServices", "score": 300, "meta": "BLE" },

  { "word": "open", "score": 300, "meta": "GPIO" },
  { "word": "write", "score": 300, "meta": "GPIO" },
  { "word": "writeSync", "score": 300, "meta": "GPIO" },
  { "word": "read", "score": 300, "meta": "GPIO" },
  { "word": "readSync", "score": 300, "meta": "GPIO" },
  { "word": "close", "score": 300, "meta": "GPIO" },
  { "word": "closeSync", "score": 300, "meta": "GPIO" },

  { "word": "open", "score": 300, "meta": "I2C" },
  { "word": "read", "score": 300, "meta": "I2C Bus" },
  { "word": "write", "score": 300, "meta": "I2C Bus" },
  { "word": "close", "score": 300, "meta": "I2C Bus" },

  { "word": "open", "score": 300, "meta": "PWM" },
  { "word": "setPeriod", "score": 300, "meta": "PWM Pin" },
  { "word": "setPeriodSync", "score": 300, "meta": "PWM Pin" },
  { "word": "setFrequency", "score": 300, "meta": "PWM Pin" },
  { "word": "setFrequencySync", "score": 300, "meta": "PWM Pin" },
  { "word": "setDutyCycle", "score": 300, "meta": "PWM Pin" },
  { "word": "setDutyCycleSync", "score": 300, "meta": "PWM Pin" },
  { "word": "setEnable", "score": 300, "meta": "PWM Pin" },
  { "word": "setEnableSync", "score": 300, "meta": "PWM Pin" },
  { "word": "close", "score": 300, "meta": "PWM Pin" },
  { "word": "closeSync", "score": 300, "meta": "PWM Pin" },

  { "word": "open", "score": 300, "meta": "SPI" },
  { "word": "transfer", "score": 300, "meta": "SPI Bus" },
  { "word": "transferSync", "score": 300, "meta": "SPI Bus" },
  { "word": "close", "score": 300, "meta": "SPI Bus" },
  { "word": "closeSync", "score": 300, "meta": "SPI Bus" },

  { "word": "open", "score": 300, "meta": "UART" },
  { "word": "write", "score": 300, "meta": "UART Port" },
  { "word": "writeSync", "score": 300, "meta": "UART Port" },
  { "word": "close", "score": 300, "meta": "UART Port" },
  { "word": "closeSync", "score": 300, "meta": "UART Port" },

  { "word": "createSocket", "score": 300, "meta": "Dgram" },
  { "word": "addMembership", "score": 300, "meta": "Dgram Socket" },
  { "word": "address", "score": 300, "meta": "Dgram Socket" },
  { "word": "bind", "score": 300, "meta": "Dgram Socket" },
  { "word": "close", "score": 300, "meta": "Dgram Socket" },
  { "word": "dropMembership", "score": 300, "meta": "Dgram Socket" },
  { "word": "send", "score": 300, "meta": "Dgram Socket" },
  { "word": "setBroadcast", "score": 300, "meta": "Dgram Socket" },
  { "word": "setMulticastLoopback", "score": 300, "meta": "Dgram Socket" },
  { "word": "setMulticastTTL", "score": 300, "meta": "Dgram Socket" },
  { "word": "setTTL", "score": 300, "meta": "Dgram Socket" }
];

export default Completer;
