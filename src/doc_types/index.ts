import { TypeInitializers } from '../types';
import { initializeHosts } from './hosts';
import { initializePods } from './pods';

export const docTypes: TypeInitializers = {
  hosts: initializeHosts,
  pods: initializePods,
};
