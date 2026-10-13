// Minimal transformer that returns HTML file contents as a module string
// Used by Jest so Angular templateUrl can be resolved in tests
module.exports = {
  process(src) {
    return { code: `module.exports = ${JSON.stringify(src)};` };
  },
};
