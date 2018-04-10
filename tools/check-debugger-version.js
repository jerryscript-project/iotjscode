import Git from 'nodegit';
import path from 'path';
import rimraf from 'rimraf';
import { JERRY_DEBUGGER_VERSION } from '../src/app/modules/client/debugger';

try {
  Git.Clone.clone('https://github.com/Samsung/iotjs.git', path.resolve(__dirname, 'tmp'))
    .then(repo => Git.Submodule.lookup(repo, 'deps/jerry'))
    .then(submodule => {
      return Promise.resolve()
        .then(() => submodule.update(1))
        .then(() => submodule.open());
    })
    .then(repo => repo.getHeadCommit())
    .then(commit => commit.getEntry('jerry-core/debugger/debugger.h'))
    .then(entry => entry.getBlob())
    .then(blob => blob.toString())
    .then(data => data.split('\n')
      .find(line => line.includes('#define JERRY_DEBUGGER_VERSION'))
      .match(/^#.+\(([0-9])\)$/)[1])
    .then(version => {
      if (+version === JERRY_DEBUGGER_VERSION) {
        console.info('The IoT.js Code and IoT.js debugger version are match.');
      } else {
        throw new Error('The IoT.js Code and IoT.js debugger version are NOT match.');
      }
    })
    .catch(error => {
      throw new Error(error);
    })
    .finally(() => {
      rimraf(path.resolve(__dirname, 'tmp'), error => {
        if (error) throw new Error(error);
        process.exit(0);
      });
    });
} catch (error) {
  console.error(error);
  process.exit(1);
}
