import unjs from "eslint-config-unjs";

// https://github.com/unjs/eslint-config
export default unjs({
  ignores: [],
  rules: {
  "unicorn/no-abusive-eslint-disable": 0,
  "unicorn/prefer-at": 0
},
});