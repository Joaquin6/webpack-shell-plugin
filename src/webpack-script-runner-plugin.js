const os = require('os');
const { exec, spawn } = require('child_process');

const defaultOptions = {
  onBuildStart: [],
  onBuildEnd: [],
  onBuildExit: [],
  dev: true,
  verbose: false,
  safe: false
};

export default class WebpackScriptRunnerPlugin {
  constructor(options) {
    this.options = this.validateInput(this.mergeOptions(options, defaultOptions));
    this.plugin = { name: 'WebpackScriptRunnerPlugin' };
  }

  puts(error, stdout, stderr) {
    if (error) {
      throw error;
    }
  }

  spreadStdoutAndStdErr(proc) {
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stdout);
  }

  serializeScript(script) {
    if (typeof script === 'string') {
      const [command, ...args] = script.split(' ');

      return { command, args };
    }

    const { command, args } = script;

    return { command, args };
  }

  handleScript(script) {
    if (os.platform() === 'win32' || this.options.safe) {
      return this.spreadStdoutAndStdErr(exec(script, this.puts));
    }

    const { command, args } = this.serializeScript(script);
    const proc = spawn(command, args, { stdio: 'inherit' });

    proc.on('close', this.puts);
  }

  validateInput(options) {
    if (typeof options.onBuildStart === 'string') {
      options.onBuildStart = options.onBuildStart.split('&&');
    }

    if (typeof options.onBuildEnd === 'string') {
      options.onBuildEnd = options.onBuildEnd.split('&&');
    }

    if (typeof options.onBuildExit === 'string') {
      options.onBuildExit = options.onBuildExit.split('&&');
    }

    return options;
  }

  mergeOptions(options, defaults) {
    for (const key in defaults) {
      if (options.hasOwnProperty(key)) {
        defaults[key] = options[key];
      }
    }

    return defaults;
  }

  apply(compiler) {
    const beforeCompile = (params, callback) => {
      if (this.options.onBuildStart.length) {
        console.log('Executing pre-build scripts');

        for (let i = 0; i < this.options.onBuildStart.length; i++) {
          this.handleScript(this.options.onBuildStart[i]);
        }

        if (this.options.dev) {
          this.options.onBuildStart = [];
        }
      }

      callback();
    };

    const afterEmit = (compilation, callback) => {
      if (this.options.onBuildEnd.length) {
        console.log('Executing post-build scripts');

        for (let i = 0; i < this.options.onBuildEnd.length; i++) {
          this.handleScript(this.options.onBuildEnd[i]);
        }

        if (this.options.dev) {
          this.options.onBuildEnd = [];
        }
      }

      callback();
    };

    const done = (stats, callback) => {
      if (this.options.onBuildExit.length) {
        console.log('Executing additional scripts before exit');

        for (let i = 0; i < this.options.onBuildExit.length; i++) {
          this.handleScript(this.options.onBuildExit[i]);
        }
      }
    };

    if (compiler.hooks) {
      compiler.hooks.beforeCompile.tapAsync(this.plugin, beforeCompile);
      compiler.hooks.afterEmit.tapAsync(this.plugin, afterEmit);
      compiler.hooks.done.tapAsync(this.plugin, done);
    } else {
      compiler.plugin('compilation', beforeCompile);
      compiler.plugin('after-emit', afterEmit);
      compiler.plugin('done', done);
    }
  }
}
