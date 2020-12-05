const dot = require("dot-object");
const fs = require("fs");
const yaml = require("yaml");
const merge = require("lodash.merge");
const default_config = require("./config-defaults");

// converts dot notation object into fully nested object
dot.object(default_config);

module.exports = function get_config({
  user_config_path = false,
  ...user_options
} = {}) {
  let user_file_options = {};

  if (user_config_path) {
    const file = fs.readFileSync(user_config_path, "utf8");
    user_file_options = yaml.parse(file);
  }

  return merge({}, default_config, user_file_options, user_options);
};
