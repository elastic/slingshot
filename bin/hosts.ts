#!/usr/bin/env ts-node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import { getConfig } from '../src/lib/get_config';
import { load } from '../src/lib/load';
const options = getConfig({}, `${__dirname}/../configs/hosts.json`);
load(options);
