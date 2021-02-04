const dot = require("dot-object");
const fs = require("fs");
const yaml = require("yaml");
const get_logger = require("./logger");
const merge = require("lodash.merge");
const default_config = require("./config-defaults");

// converts dot notation object into fully nested object
dot.object(default_config);

module.exports = function get_config(user_options = {}) {
  let user_file_options = {};
  const tmp_config = merge({}, default_config, user_options);
  const logger = get_logger(tmp_config);

  if (tmp_config.user_config_path) {
    try {
      const file = fs.readFileSync(tmp_config.user_config_path, "utf8");
      user_file_options = yaml.parse(file);
    } catch (err) {
      console.warn(
        `Attempted to load config from ${tmp_config.user_config_path} and failed`
      );
    }
  }

  return merge({}, default_config, user_file_options, user_options);
};
