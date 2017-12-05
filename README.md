# IoT.js Code <br> A browser based editor with devtools for IoT.js

[![License](https://img.shields.io/badge/licence-Apache%202.0-brightgreen.svg?style=flat)](LICENSE)
[![Build Status](https://travis-ci.org/Samsung/iotjscode.svg?branch=master)](https://travis-ci.org/Samsung/iotjscode)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FSamsung%2Fiotjscode.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FSamsung%2Fiotjscode?ref=badge_shield)

- [Introduction](#introduction)
- [Features](#features)
- [How to start](#how-to-start)
- [Layout overview](#layout-overview)
- [How to use with IoT.js](#how-to-use-with-iotjs)
- [How to use with JerryScript](#how-to-use-with-jerryscript)
- [License](#license)

# Introduction
`IoT.js Code` is an online editor with debugger tools for [IoT.js](https://github.com/Samsung/iotjs) that lets you debug the code which is running on a device and lets you upload your code to the device, directly from the browser, with the power of WebSocket.

# Features
The `IoT.js Code` provides you the following features:

- File management:
  - Open files from the local drive.
  - Create new files.
  - Save files from the editor to the local drive.
- Edit Javascript code with the integrated [Ace](https://ace.c9.io/) editor.
  - Customizable editor settings (e.g.: font size or show invisibles)
  - IoT.js API based autocomplete.
  - Javascript syntax highlight.
  - Multiple tabs.
- Stores the user settings in the browser local storage.
- Debug features:
  - Error and exception messages.
  - Insert/Delete breakpoints on multiple files.
  - Continue, Stop, Step-in and Next commands.
  - Backtrace log.
  - Variable evaluation.
- Watch variables or any expression under running.
- Display the Memory Usage under running and save the result to the local drive.
- Display the user program output.
- On-the-fly source code sending.
- Remote connection and debug over WebSocket.

# How to start
To start the project, do the following:

```
$ git clone https://github.com/Samsung/iotjscode.git
$ cd iotjscode

# Install the project's dependencies.
$ npm install

# Launch the developer liverload browser site.
# (this will open your browser at localhost:8080)
# Press `Ctrl + C` to kill **http-server** process.
$ npm start

# To build the project for production.
$ npm run build

# To see ESLint report.
$ npm run eslint

# To autofix the basic ESLint errors.
$ npm run lint-autofix
```

**Note:** This project requires [node.js](https://nodejs.org/en/) v8.x.x or higher and [npm](https://www.npmjs.com) 5.x.x or higher to be able to work properly.

# Layout overview
Live [Demo Page](https://samsung.github.io/iotjscode/).

There are four sections in the `IoT.js Code`:
1. **Menu**

    The menu contains three more section:
    - The hamburger style **menu toggle button**, which is to close or open the whole menu. In closed state the menu item texts are not visible, just the icons.
    - The **File**, **Settings** and **Download** items.
        - In the File menu, you can open, create or save a file.
        - In the Settings menu, you can modify the editor settings or you can reset the settings to the default values.
        - Finally in Download menu, you can download the Memory Usage report if that is available.
    - The **panel toggle buttons**, these are to turn on or off a single panel on the information panels area.

2. **Action buttons**

    These are on the top of the page. With these buttons and inputs, you can connect to the engine and you can control the main debugging process. The default `ip` and `port` where the client will try to connect is `localhost:5001`.

3. **Information panels**

    These panels are on the left side of the workspace. Within these panels you can see a few really useful information about the current state of the debugging.
    The available panels are the following:
    - **Backtrace panel**: when the debugger is stopped (on a breakpoint or an exception) this will contain the call stack from the stopped statement.
    - **Breakpoint list panel**: contains the currently active (inserted) breakpoints. You can delete all breakpoint at once with the `Delete all` button in the panel header.
    - **Watch panel**: you can add a variable or any expression what you want to watch while your code running. You can add a new expression with the `Add` button in the panel header, you can `Refresh` the watch list or you can delete every watched expression with the `Clear` button. If you do not want to delete all expression at once then you can delete them one-by-one with the `minus` icon at the end of an expression line in the list.
    - **Memory Chart panel**: you can monitoring memory usage of your code under running. Each time when the debugger stopped, the the memory chart will be updated with new values. The chart will show you the **total size** of your memory usage as well as the **byte code** size, **string** size, **property** size, **object** size and **allocated** memory size. You can control the panel behavior with the buttons in the panel header. The `Clear` button will reset the whole diagram, the `Pause` button will suspend the data collection and the `Record` button will start (or restart) the process.
    - **Output log panel**: in this panel you can see what is your code output. Every text-based output will be displayed in this.
    - **Source sending panel**: this section allows you to send source code to the engine on-the-fly after the engine is started in waiting mode. The available sources (the currently opened files) will be listed in the panel left side and you can select those file what you want to upload and run on the device. The selected files will be listed on the panel right side and the selected files order can be modified by grab and move them up or down. After you selected and ordered the files you can use the control buttons in the panel header. The `Run` button will send the sources to the device (if the engine is in waiting mode), the `Context reset` button will reset the engine context and will brake the connection between the engine and the client and will try to reconnect. The `Clear` button will remove the selected files from the stack. **Note** that the source sender process is sending one file at a time and the context reset will be processed after a file sending is done and the engine is waiting for a new source file.
    - **Console panel**: you can follow the whole debugging work in this panel. Every action or information will be displayed in this as plain text. There are a few basic command which is available in the console, if you want to use them just type the `help` keyword into the command line input. This panel has a unique feature, when you connected to a device and the code which is running on that is not loaded into the editor, it will give you a button, `Load from Jerry`, which is able to load the running source code from the device into a new file in the editor.


4. **Editor**

    The editor can be divided into two section. The first one is the `file header` where you can switch between the opened files and you can close them. The second one is the `code editor` itself where you can modify your code, insert or delete breakpoints by click on the proper line in the gutter and you can see where you stopped the debugging process.

# How to use with IoT.js

If you want to use the `IoT.js Code` with the [IoT.js](https://github.com/Samsung/iotjs) do the following (assumes that you have a cloned IoT.js and you are in the root directory):

```
# Build the IoT.js with the following switches.
$ ./tools/build.py --buildtype=debug --jerry-debugger

# To build with memory statistics.
$ ./tools/build.py --buildtype=debug --jerry-debugger --jerry-memstat

# If you want to debug the IoT.js javascript modules with the iotjscode
# then you have to turn off the snapshot in the IoT.js build
$ ./tools/build.py --buildtype=debug --jerry-debugger --no-snapshot

# Run the IoT.js with the following switches.
$ ./build/x86_64-linux/debug/bin/iotjs --start-debug-server {file}

# To run with diferent port (the default is 5001).
$ ./build/x86_64-linux/debug/bin/iotjs --start-debug-server --jerry-debugger-port={number} {file}

# To run with show opcodes.
$ ./build/x86_64-linux/debug/bin/iotjs --start-debug-server --show-opcodes {file}

# To run with source waiting mode (allows the on-the-fly source code sending).
$ ./build/x86_64-linux/debug/bin/iotjs --start-debug-server --debugger-wait-source
```

After the `IoT.js` started running you can connect to it with the `Connect to` button or with the `connect` command in the command line and then you can start using the `IoT.js Code` debugger tools.

# How to use with JerryScript

If you want to use the `IoT.js Code` only with the [JerryScript](https://github.com/jerryscript-project/jerryscript) do the following (assumes that you have a cloned IoT.js and you are in the IoT.js root directory):

```
# Build the JerryScript with the following switches.
$ ./tools/build.py --jerry-debugger=on --jerry-libc=off

# To build with memory statistics.
$ ./tools/build.py --jerry-debugger=on --jerry-libc=off --mem-stats=on

# To build without default port.
$ ./tools/build.py --jerry-debugger=on --jerry-libc=off --jerry-port-default=off

# Run the JerryScript with the following switches.
# The --log-level 3 is strongly recommended to see what happening on server side.
$ ./build/bin/jerry --start-debug-server --log-level 3 {files}

# To run with diferent port.
$ ./build/bin/jerry --start-debug-server --debug-port {number} {file}

# To run with source waiting mode (allows the on-the-fly source code sending).
$ ./build/bin/jerry --start-debug-server --debugger-wait-source
```

After the `JerryScript` started running and you have passed the `--log-level 3` runtime switch, you have to see the following message in the terminal:

```
Waiting for client connection
```

In this case, you can connect to the server from the `IoT.js Code` with the `Connect to` button or with the `connect` command in the command line and you can start using the debugger tools.

After you connected to the server you have to see a similar message in the terminal like this:
```
Connected from: 127.0.0.1
```

# License

IoT.js Code is Open Source software under the [Apache 2.0 license](LICENSE). Complete license and copyright information can be found within the code.

[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FSamsung%2Fiotjscode.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FSamsung%2Fiotjscode?ref=badge_large)
