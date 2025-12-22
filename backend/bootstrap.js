import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Register tsconfig paths
const tsConfigPaths = require('tsconfig-paths');
const tsConfig = require('./tsconfig.json');

tsConfigPaths.register({
  baseUrl: path.resolve(__dirname, tsConfig.compilerOptions.baseUrl || '.'),
  paths: tsConfig.compilerOptions.paths || {}
});

// Import and run the server
import('./dist/server.js');