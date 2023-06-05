import { TypeInitializers } from '../types';
import { initializeContainers } from './containers';
import { initializeHosts } from './hosts';
import { initializePods } from './pods';
import { initializeServices } from './services';

export const docTypes: TypeInitializers = {
  containers: initializeContainers,
  hosts: initializeHosts,
  pods: initializePods,
  services: initializeServices,
};
