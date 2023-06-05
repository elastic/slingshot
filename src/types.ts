import * as rt from 'io-ts';
import { Logger } from 'winston';
import { Moment } from 'moment';

export const TimerangeRT = rt.type({
  start: rt.string,
  end: rt.string,
  interval: rt.number,
});
export type Timerange = rt.TypeOf<typeof TimerangeRT>;

export const DocTypesRT = rt.keyof({
  hosts: null,
  pods: null,
  containers: null,
  services: null,
});
export type DocTypes = rt.TypeOf<typeof DocTypesRT>;

export const DistributionDefRT = rt.type({
  name: rt.string,
  mean: rt.number,
  stdev: rt.number,
});
export type DistributionDef = rt.TypeOf<typeof DistributionDefRT>;

export const SpikeDistributionDefRT = rt.intersection([
  rt.type({
    ...DistributionDefRT.props,
  }),
  rt.partial({
    duration: rt.string,
    hours: rt.array(rt.number),
    minutes: rt.array(rt.number),
  }),
]);
export type SpikeDistributionDef = rt.TypeOf<typeof SpikeDistributionDefRT>;

export const SpikeDefRT = rt.array(SpikeDistributionDefRT);
export type SpikeDef = rt.TypeOf<typeof SpikeDefRT>;

export const NormalDefRT = rt.array(DistributionDefRT);
export type NormalDef = rt.TypeOf<typeof NormalDefRT>;

export const TypeDefRT = rt.intersection([
  rt.type({
    total: rt.number,
    addCloudData: rt.boolean,
  }),
  rt.partial({
    offsetBy: rt.number,
    cloudProviders: rt.array(rt.string),
    platforms: rt.array(rt.string),
    osTypes: rt.array(rt.string),
    cloudRegions: rt.array(rt.string),
    spike: SpikeDefRT,
    normal: NormalDefRT,
    environment: rt.number,
    parent: rt.intersection([
      rt.type({
        total: rt.number,
        type: DocTypesRT,
      }),
      rt.partial({ offsetBy: rt.number }),
    ]),
  }),
]);
export type TypeDef = rt.TypeOf<typeof TypeDefRT>;

export const TypesRT = rt.partial({
  hosts: TypeDefRT,
  pods: TypeDefRT,
  containers: TypeDefRT,
  services: TypeDefRT,
});
export type Types = rt.TypeOf<typeof TypesRT>;

export const ConfigurationRT = rt.intersection([
  rt.type({
    elasticsearch: rt.unknown,
    timerange: TimerangeRT,
  }),
  rt.partial({
    types: TypesRT,
    dryRun: rt.boolean,
    purge: rt.boolean,
    logLevel: rt.string,
  }),
]);

export type Configuration = rt.TypeOf<typeof ConfigurationRT>;

export interface SlingshotContext {
  logger: Logger;
}

export type EventValueFn = (values: any) => any;
export type EventCycleValues = Record<string, any>;

export interface TypeGenerator {
  template: Array<Record<string, any | EventValueFn>>;
  index: string;
  docsPerCycle: number;
  createCycleValues: (index: number, time: Moment) => any;
}

export type TypeIntializationFn = (typeDef: TypeDef, ctx: SlingshotContext) => TypeGenerator;

export type TypeInitializers = Record<DocTypes, TypeIntializationFn>;
