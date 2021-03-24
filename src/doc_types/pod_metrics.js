const random = require("random");
const FAKE_IDENTIFIER = "_SS";
const {
  randomInt,
  guardValue,
  chooseRandomItem,
} = require("../lib/value_helpers");

const IPS = [
  "10.136.197.75",
  "10.136.62.43",
  "10.136.197.74",
  "10.136.173.36",
  "10.244.0.238",
  "10.244.0.2",
  "10.244.1.41",
  "10.136.197.76",
  "10.244.1.201",
  "10.244.0.120",
  "10.244.0.212",
  "10.244.2.124",
]; // TODO: randomize somehow? within a range?

module.exports = function load_pods(options, { logger }) {
  const {
    n_hosts = 3, // how many hosts the pods will be spread across
    n_pods = 30, // how many pods will be created each cycle
    cloud = false, // whether these pods should be in the cloud (TODO: fix this)
    host_id_offset = 0, // use if you want to create different hosts than another run
    pod_id_offset = 0, // use if you want to create different pods than another run
    metrics = {},
  } = options;
  const {
    memory = { mean: 0.8, stdev: 0.05 },
    cpu = { mean: 0.4, stdev: 0.1 },
  } = metrics;

  // set some things up in scope for use of this builder
  const rand_memory = random.normal(memory.mean, memory.stdev);
  const rand_cpu = random.normal(cpu.mean, cpu.stdev);

  return {
    // set our index for this type of document explicitly so the new index strategy will work
    index: "metrics-kubernetes.pod-slingshot",
    // n_docs_per_cycle tells the loader how many documents represent one "cycle"
    n_docs_per_cycle: n_pods,
    create_cycle_values: (i, now) => {
      logger.verbose(`check ${now}`);
      logger.verbose(
        `Creating cycle values for ${new Date(now).toISOString()}`
      );
      // host number should increment 1 for each i value, then loop
      // pod number should be the same for each rotation through all host numbers
      // e.g. where n_hosts = 2:
      // i = 0 -> h1-p1
      // i = 1 -> h2-p1
      // i = 2 -> h3-p1
      // i = 3 -> h1-p2
      // etc
      const host_num = (i % n_hosts) + 1 + host_id_offset;
      const pod_num = Math.floor(i / n_hosts) + 1 + pod_id_offset;
      const host = `h${host_num}`;
      const pod = `p${pod_num}`;
      const pod_id = `${host}:${pod}`;

      const memory_pct = rand_memory();
      const cpu_pct = rand_cpu();

      return {
        date: new Date(now).toISOString(),
        host_num,
        pod_num,
        host,
        pod,
        pod_id,
        cloud_provider: cloud ? "aws" : "", // TODO: need to randomize this
        cloud_instance_id: cloud ? 10000 * host_num : "",
        cloud_region: cloud ? "us-east-1" : "", // TODO: need to randomize this
        event_duration: randomInt(80000000, 85000000), // TODO: is this the right range? does it matter?
        k8s_namespace: chooseRandomItem([
          "kube-system",
          "default",
          "nginx-ingress",
        ]), // TODO: need more of these values to choose from
        ip: chooseRandomItem(IPS),
        memory_pct: guardValue(memory_pct, { min: 0, max: 1 }),
        cpu_pct: guardValue(cpu_pct, { min: 0, max: 1 }),
      };
    },
    template: [
      {
        "@timestamp": "{{date}}",
        "agent.ephemeral_id": `{{host}}-ephemeral-uuid_${FAKE_IDENTIFIER}`,
        "agent.hostname": `{{host}}-agent-hostname_${FAKE_IDENTIFIER}`,
        "agent.id": `{{host}}-agent-uuid_${FAKE_IDENTIFIER}`,
        "agent.name": `{{host}}-agent-name_${FAKE_IDENTIFIER}`,
        "agent.type": "slingshot-metricbeat",
        "agent.version": "7.9.3",
        "cloud.instance.id": "{{cloud_instance_id}}",
        "cloud.provider": "{{cloud_provider}}",
        "cloud.region": "{{cloud_region}}",
        "ecs.version": "1.5.0",
        "event.dataset": "kubernetes.pod",
        "event.duration": "{{event_duration}}",
        "event.module": "kubernetes",
        "host.name": "{{host}}-hostname",
        "kubernetes.namespace": "{{k8s_namespace}}",
        "kubernetes.node.name": `{{host}}-k8s-nodename_${FAKE_IDENTIFIER}`,
        "kubernetes.pod.cpu.usage.node.pct": ({ cpu_pct }) => cpu_pct * 0.5,
        "kubernetes.pod.cpu.usage.limit.pct": ({ cpu_pct }) => cpu_pct,
        "kubernetes.pod.host_ip": "{{ip}}",
        "kubernetes.pod.ip": "{{ip}}",
        "kubernetes.pod.memory.usage.node.pct": ({ memory_pct }) => memory_pct * 0.5,
        "kubernetes.pod.memory.usage.limit.pct": ({ memory_pct }) => memory_pct,
        "kubernetes.pod.name": `{{host}}-{{pod}}-name_${FAKE_IDENTIFIER}`,
        "kubernetes.pod.status.phase": "running",
        "kubernetes.pod.status.ready": true,
        "kubernetes.pod.status.scheduled": true,
        "kubernetes.pod.uid": `{{host}}-{{pod}}-uid_${FAKE_IDENTIFIER}`,
        "metricset.name": "state_pod",
        "metricset.period": 10000,
        "service.address": `kube-state-metrics:8080_${FAKE_IDENTIFIER}`,
        "service.type": "slingshot-kubernetes",
      },
    ],
  };
};
