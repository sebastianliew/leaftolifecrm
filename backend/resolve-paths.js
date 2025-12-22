import { readFileSync } from 'fs';
import { dirname, join, resolve as pathResolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read tsconfig.json
const tsconfigPath = join(__dirname, 'tsconfig.json');
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'));

const { baseUrl = '.', paths = {} } = tsconfig.compilerOptions || {};
const basePath = pathResolve(__dirname, baseUrl);

// Convert tsconfig paths to resolve map
const pathMappings = {};
for (const [alias, aliasPaths] of Object.entries(paths)) {
  const key = alias.replace('/*', '');
  pathMappings[key] = aliasPaths.map(p => 
    pathResolve(basePath, p.replace('/*', ''))
  );
}

export async function resolve(specifier, context, nextResolve) {
  // Check if this is one of our aliases
  for (const [alias, resolvedPaths] of Object.entries(pathMappings)) {
    if (specifier.startsWith(alias)) {
      const pathSegment = specifier.slice(alias.length);
      
      // Try each possible resolved path
      for (const resolvedPath of resolvedPaths) {
        try {
          const fullPath = join(resolvedPath, pathSegment);
          const url = pathToFileURL(fullPath).href;
          
          // Try with .js extension first
          try {
            return await nextResolve(url + '.js', context);
          } catch (e) {
            // Try without extension
            try {
              return await nextResolve(url, context);
            } catch (e2) {
              // Try as index.js
              try {
                return await nextResolve(url + '/index.js', context);
              } catch (e3) {
                // Continue to next path
              }
            }
          }
        } catch (err) {
          // Continue to next path
        }
      }
    }
  }
  
  // Default resolution
  return nextResolve(specifier, context);
}