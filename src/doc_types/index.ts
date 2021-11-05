import { TypeInitializers } from '../types';
import { initializeHosts } from './hosts';
import { initializePods } from './pods';
import { initializeClusters } from './clusters';

export const docTypes: TypeInitializers = {
  hosts: initializeHosts,
  pods: initializePods,
  clusters: initializeClusters,
};
