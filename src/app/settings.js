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

import store from 'store';

/**
 * Type of the available controls element in the settings menu.
 */
const CONTROL_TYPE = {
  TEXT: 0,
  NUMBER: 1,
  CHECKBOX: 2,
  SELECT: 3,
  SURFACE: 4,
};

export default class Settings {

  /**
   * Constructor.
   *
   * @param {object} editor The main editor instance.
   * @param {object} surface The main surface instance.
   */
  constructor(editor, surface) {
    this._editor = editor;
    this._surface = surface;
    this._settings = store.get('settings');

    // If the local storage settings is not exist, then create it.
    if (this._settings === undefined) {
      this.init();
    } else {
      this.validityCheck();
    }
  }

  /**
   * The settings menu controls and the info-panels items.
   * This object stores basic information about each settings item.
   *
   * In each controls,
   * - the first item of the array is the type of the control element
   * - the second item of the array is the handler function of the setting
   * - and the last item of the array is the default value of the setting.
   */
  get CONTROLS() {
    return {
      global: {
        theme: [CONTROL_TYPE.SELECT, theme => {
          window.monaco.editor.setTheme(theme);

          if (theme === 'vs') {
            $('body').removeClass('dark-theme');
          } else {
            $('body').addClass('dark-theme');
          }
        }, 'vs'],
      },
      editor: {
        fontsize: [CONTROL_TYPE.SELECT, size => {
          this._editor.updateOptions({
            fontSize: size,
          });
        }, '14px'],
        wrap: [CONTROL_TYPE.SELECT, wrap => {
          this._editor.updateOptions({
            wordWrap: wrap,
          });
        }, 'off'],
        wrapColumn: [CONTROL_TYPE.SELECT, column => {
          this._editor.updateOptions({
            wordWrapColumn: column,
          });
        }, '80'],
        lineHighlight: [CONTROL_TYPE.SELECT, highlght => {
          this._editor.updateOptions({
            renderLineHighlight: highlght,
          });
        }, 'all'],
        whitespace: [CONTROL_TYPE.SELECT, ws => {
          this._editor.updateOptions({
            renderWhitespace: ws,
          });
        }, 'all'],
        minimap: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            minimap: {
              enabled: enabled,
            },
          });
        }, true],
        folding: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            folding: enabled,
          });
        }, false],
        autoClosingBrackets: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            autoClosingBrackets: enabled,
          });
        }, true],
        matchBrackets: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            matchBrackets: enabled,
          });
        }, true],
        autoIndent: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            autoIndent: enabled,
          });
        }, true],
        renderIndentGuides: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            renderIndentGuides: enabled,
          });
        }, false],
        mouseWheelZoom: [CONTROL_TYPE.CHECKBOX, enabled => {
          this._editor.updateOptions({
            mouseWheelZoom: enabled,
          });
        }, false],
      },
      debugger: {
        backtraceRange: [CONTROL_TYPE.CHECKBOX, value => this.modify('debugger.backtraceRange', value), true],
        transpileToES5: [CONTROL_TYPE.CHECKBOX, value => this.modify('debugger.transpileToES5', value), false],
      },
      panels: {
        backtrace: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('backtrace'), true],
        breakpoints: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('breakpoints'), true],
        watch: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('watch'), false],
        chart: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('chart'), false],
        output: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('output'), false],
        run: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('run'), false],
        console: [CONTROL_TYPE.SURFACE, () => this._surface.togglePanel('console'), true],
      },
    };
  }

  /**
   * Returns a value of a setting based on the path argument.
   *
   * @param {string} path Path to a single setting value.
   */
  getValue(path) {
    let rv = undefined;

    if (path !== '') {
      path = path.split('.');

      if (path.length === 2) {
        if (this._settings[path[0]][path[1]]) {
          rv = this._settings[path[0]][path[1]];
        }
      }
    }

    return rv;
  }

  /**
   * Inits the settings menu items listeners (the panels are not included).
   * These listener handler function are stored in the controls array at the 1 position.
   */
  initListeners() {
    // Prevent the click when the item is disabled.
    $('.control-item select, .control-item input').on('click', e => {
      if (this._surface.settingItemIsDisabled(e.target.id)) {
        e.preventDefault();
        return false;
      }
    });

    // Listen on change.
    $('.control-item select, .control-item input').on('change', e => {
      const section = $(e.target).parent().parent().attr('id').split('-')[0];
      const id = e.target.id;

      switch (this.CONTROLS[section][id][0]) {
        case CONTROL_TYPE.CHECKBOX:
          this.CONTROLS[section][id][1]($(e.target).prop('checked'));
          this.modify(`${section}.${id}`, $(e.target).prop('checked'));
          break;
        case CONTROL_TYPE.SELECT:
        default:
          this.CONTROLS[section][id][1]($(e.target).val());
          this.modify(`${section}.${id}`, $(e.target).val());
          break;
      }
    });
  }

  /**
   * Fills up the settings variable with the default settings value
   * then save that into the local storage.
   * If the reset parameter is true then it will call the load function.
   *
   * @param {boolean} reset Indicates that the call is an initation or a reset.
   */
  init(reset = false) {
    if (!reset) {
      this._settings = {};
    }

    for (const section of Object.keys(this.CONTROLS)) {
      if (!reset) {
        this._settings[section] = {};
      }

      for (const item of Object.keys(this.CONTROLS[section])) {
        this._settings[section][item] = this.CONTROLS[section][item][2];
      }
    }

    if (reset) {
      this.load();
    }

    store.set('settings', this._settings);
  }

  /**
   * Compares the stored and the static setting objects based on their properties.
   * If they are not equals, then reinits the settings.
   */
  validityCheck() {
    const same = Object.keys(this._settings).every(section => {
      if (this.CONTROLS.hasOwnProperty(section)) {
        return Object.keys(this._settings[section]).every(item => this.CONTROLS[section].hasOwnProperty(item));
      } else {
        return false;
      }
    });

    if (!same) {
      this.init();
    }
  }

  /**
   * Loads the settings into the workspace, fills up the settings items and calls the handler functions of them.
   */
  load() {
    for (const section of Object.keys(this.CONTROLS)) {
      for (const item of Object.keys(this.CONTROLS[section])) {

        switch (this.CONTROLS[section][item][0]) {
          case CONTROL_TYPE.CHECKBOX:
            $(`#${item}`).prop('checked', this._settings[section][item]);
            this.CONTROLS[section][item][1](this._settings[section][item]);
            break;
          case CONTROL_TYPE.SURFACE:
            if (this._settings[section][item] !== this._surface.getPanelProperty(`${item}.active`)) {
              this.CONTROLS[section][item][1]();
            }
            break;
          case CONTROL_TYPE.SELECT:
          default:
            $(`#${item}`).val(this._settings[section][item]);
            this.CONTROLS[section][item][1](this._settings[section][item]);
            break;
        }
      }
    }
  }

  /**
   * Modify a single settings value based on the given path and value pair.
   *
   * @param {string} key Path to the item in the settings.
   * @param {any} value New value of the item.
   * @return {boolean} True if the modification was successful, false otherwise.
   */
  modify(key, value) {
    if (key !== '') {
      key = key.split('.');

      if (key.length === 2) {
        // Change the selected key's value.
        this._settings[key[0]][key[1]] = value;

        // Store the new modified settings object in the local storage.
        store.set('settings', this._settings);

        return true;
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
}
