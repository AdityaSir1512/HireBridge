module.exports = {
  config: require('./config'),
  utils: {
    logger: require('./utils/logger'),
    errors: require('./utils/errors'),
    pagination: require('./utils/pagination'),
    validation: require('./utils/validation')
  },
  models: require('./models')
};
