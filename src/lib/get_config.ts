import dot from 'dot-object';
import fs from 'fs';
import { PathReporter } from 'io-ts/PathReporter';
import configDefaults from './config-defaults.json';
import { ConfigurationRT, Configuration } from '../types';

// converts dot notation object into fully nested object
const defaultConfig = dot.object(configDefaults) as Configuration;

function readConfig(path: string, userConfig: Configuration) {
  if (!path) {
    return { ...defaultConfig };
  }
  const rawJSON = fs.readFileSync(path, 'utf8');
  const fileConfig = JSON.parse(rawJSON);
  if (!ConfigurationRT.is(fileConfig)) {
    const results = ConfigurationRT.decode(fileConfig);
    const errors = PathReporter.report(results).join('\n');
    throw new Error(`The config file provided has errors: \n${errors}`);
  }
  return { ...defaultConfig, ...fileConfig, ...userConfig };
}

export function getConfig(userConfig: Configuration, path?: string) {
  if (path) {
    return readConfig(path, userConfig);
  }

  return { ...defaultConfig, ...userConfig };
}
