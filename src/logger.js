function stamp() {
  return new Date().toISOString();
}

function info(...args) {
  console.log(`[${stamp()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${stamp()}]`, ...args);
}

function error(...args) {
  console.error(`[${stamp()}]`, ...args);
}

module.exports = { info, warn, error };
