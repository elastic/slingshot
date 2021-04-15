import { TypeInitializers } from '../types';
import { initializeHosts } from './hosts';
import { intializePods } from './pods';

export const docTypes: TypeInitializers = {
  hosts: initializeHosts,
  pods: intializePods
};
