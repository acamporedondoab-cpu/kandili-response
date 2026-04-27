const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve shared components outside the mobile/ project root
const rootDir = path.resolve(__dirname, '..');
config.watchFolders = [rootDir];

// When resolving node_modules imports from shared components, use mobile/node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Exclude Next.js build output and app/node_modules from Metro's watcher/resolver
const escapeForRegex = (s) => s.replace(/[\\]/g, '\\\\');
config.resolver.blockList = [
  new RegExp(`^${escapeForRegex(path.resolve(rootDir, 'app', '.next'))}.*`),
  new RegExp(`^${escapeForRegex(path.resolve(rootDir, 'app', 'node_modules'))}.*`),
];

module.exports = config;
