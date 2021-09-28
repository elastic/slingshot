![elastic slingshots](./four-elastic-slingshots_small.png)

# Slingshot

Slingshot is an Elastic data generator and loader. It can generate mock metrics data to be loaded into Elasticsearch for testing pursposes.

## Loading data

To generate and load data into Elasticsearch, run:

```sh
node slingshot load --config path/to/config.json
```

The `--config` argument is a **required** path to a configuration file specifying the parameters of the data you'd like to generate. Included in this repo are some example config files in the `/configs` folder.

See the **Configuration** section for information on how to write a config file.

### Optional arguments

#### Operational

- `--purge`: Deletes any data previously ingested into Elasticsearch from Slingshot before indexing new data.

#### Config overrides

You can override values specified in the config file using these arguments:

- `--start` and `--end`: A timestamp or a math string relative to `now` (e.g. `now-1h`) to start or end generating data.
- `--interval`: A number in milliseconds specifying how often data should be indexed over the period between `start` and `end`.
- `--elasticsearch`: The URL of your Elasticsearch cluster
- `--auth`: Auth credentials for your Elasticsearch cluster

## Configuration

Slingshot takes a JSON file to specify the data it should generate. Fields include:

### `elasticsearch`

```json
"elasticsearch": {
  "node": "https://localhost:9200",
  "auth": {
    "username": "elastic",
    "password": "changeme"
  },
  "ssl": {
    "rejectUnauthorized": false
  }
}
```

Specifies the `node` URL, the `auth` credentials, and `ssl` options.

### `timerange`

```json
"timerange": {
  "start": "now-1d/d",
  "end": "now+1d/d",
  "interval": 10000
}
```

`start` and `end` set the boundaries of when to generate data. They can take the form of exact timestamps, or math strings relative to `now`.

`interval` specifies, in milliseconds, how often documents should be indexed between this period.

This example JSON will generate documents every 10 seconds, starting 1 day ago and extending to 1 day in the future.

### `types`

This field configures the `hosts` and/or `pods` you would like to generate data for, and what values they should report.

```json
"types": {
  "hosts": {
    // Optional
    ...
  },
  "pods": {
    // Optional
    ...
  }
}
```

Subfields of the `hosts` or `pods` records include:

- `total` **(required)**: The number of hosts or pods to generate
- `addCloudData` **(required)**: If `true`, generates a `cloudProvider`, `cloudInstanceId`, and `cloudRegion` for each node.
- `normal` **(required)**: An **array** of metrics to generate data for, and what values they should fluctuate between. Takes the form of a record with:
  - `name`: The Inventory metric name. One of: `memory`, `cpu`, `load`, `rx`, `tx`
  - `mean`: What the mean value of this metric should be
  - `stddev`: How many standard deviations the value should fluctuate away from the `mean`
- `spike`: An **array** of metrics that should have a spike at some point in the data. Slingshot will randomly insert a spike into the data stream, as specified in these fields. Useful for generating anomalies. Includes the same `name`, `mean`, and `stddev` fields, in addition to:
  - `duration`: A time string (e.g. `5m`) specifying how long the spike should last
- `offsetBy`: Each node will be named `host-n` or `pod-n`, starting with `-0`. Add an `offsetBy` to start at a different number. For example, if `offsetBy` is `1`, host names will start at `host-1` and increment from there.
- `parent` **(on `pods` only)**: Generates a parent for the generated pods
  - `total`: The number of parent nodes
  - `type`: What type of nodes the parent nodes should be, e.g. `hosts`
- `cloudProviders`: An array of strings to use as cloud providers if `addCloudData` is true. If not specified, default cloud provider names will be used.
- `cloudRegions`: Similar to `cloudProviders`, an array of strings to use as cloud regions in generated cloud data.
- `platforms`: Similar to `cloudProviders`, an array of strings to use as platforms in generated cloud data.
