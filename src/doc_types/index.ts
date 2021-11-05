import { TypeInitializers } from '../types';
import { initializeHosts } from './hosts';
import { initializePods } from './pods';
import { initializeMonitoringEs } from './monitoring_es';

export const docTypes: TypeInitializers = {
  hosts: initializeHosts,
  pods: initializePods,
  monitoring_es: initializeMonitoringEs,
};
