module.exports = {
  "parserOptions": {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  "env": {
    "browser": true,
    "node": true,
    "es6": true,
    "jquery": true
  },
  "extends": "eslint:recommended",
  "rules": {
    "no-console": "off",
    "no-var": 2,
    "max-len": ["error", {
      "code": 120,
      "ignoreUrls": true,
      "ignoreTemplateLiterals": true,
      "ignoreRegExpLiterals": true
    }]
  }
}
