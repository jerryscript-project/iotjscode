/* Copyright 2017 Samsung Electronics Co., Ltd. and other contributors
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var ignored_eslint_recommended = {
  'no-console': 0,
}

var best_practices = {
  'guard-for-in': 2,
  'no-plusplus': 0,
  'no-caller': 2,
  'no-extend-native': 2,
  'no-new-wrappers': 2,
  'semi': 2,
}

var stylistic_issues = {
  'array-bracket-spacing': [2, 'never'],
  'block-spacing': [2, 'never'],
  'brace-style': 2,
  'comma-dangle': [2, 'always-multiline'],
  'comma-spacing': 2,
  'comma-style': 2,
  'computed-property-spacing': 2,
  'eol-last': 2,
  'func-call-spacing': 2,
  'key-spacing': 2,
  'keyword-spacing': 2,
  'linebreak-style': 2,
  'new-cap': 2,
  'no-array-constructor': 2,
  'no-multiple-empty-lines': [2, {
    'max': 2
  }],
  'no-multi-spaces': 2,
  'no-multi-str': 2,
  'no-new-object': 2,
  'no-tabs': 2,
  'no-trailing-spaces': 2,
  'quotes': [2, 'single'],
  'semi-spacing': 2,
  'space-before-blocks': 2,
  'space-before-function-paren': [2, {
    'anonymous': 'never',
    'named': 'never',
  }],
  'spaced-comment': [2, 'always'],
  'switch-colon-spacing': 2,
}

var es6 = {
  'generator-star-spacing': [2, 'after'],
  'no-var': 2,
  'prefer-rest-params': 2,
  'prefer-spread': 2,
  'rest-spread-spacing': 2,
  'yield-star-spacing': [2, 'after'],
}

module.exports = {
  'extends': 'eslint:recommended',
  'env': {
    'browser': true,
    'node': true,
    'es6': true,
    'jquery': true,
  },
  'parserOptions': {
    'ecmaVersion': 6,
    'sourceType': 'module',
  },
  'rules': Object.assign(
    ignored_eslint_recommended,
    stylistic_issues,
    best_practices,
    es6,
    {
      'max-len': ['error', {
        'code': 120,
        'ignoreUrls': true,
        'ignoreTemplateLiterals': true,
        'ignoreRegExpLiterals': true,
      }]
    }),
}
