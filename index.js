// Initialize Parse.
var APP_ID = process.env.PARSE_APP_ID;
var JS_KEY = process.env.PARSE_JS_KEY;
var MASTER_KEY = process.env.PARSE_MASTER_KEY;
var Parse = require('parse/node');
Parse.initialize(APP_ID, JS_KEY, MASTER_KEY);
Parse.serverURL = process.env.PARSE_SERVER_URL;

// Other libraries.
var needle = require('needle');
const winston = require('winston');

// Initialize logger.
let log_level = 'info';
if (process.env.NODE_ENV !== 'production') {
  log_level = 'debug';
}
const logger = winston.createLogger({
  level: log_level,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console()
  ]
});

exports.addItem = async function (itemName, sessionToken)  {
  logger.info('Handling item request for ' + itemName + '...');
  logger.info('Session token is ' + sessionToken);

  if (!itemName) {
    throw('Missing item name');
  }

  if (!sessionToken) {
    throw('Invalid session token');
  }

  var options = {
    headers: {
      'X-Parse-Application-Id': APP_ID,
      'X-Parse-REST-API-Key': JS_KEY,
      'X-Parse-Session-Token': sessionToken
    }
  };

  logger.debug('Attempting to find current user...');
  let user;
  try {
    const result = await needle('get', Parse.serverURL + '/users/me', options);
    user = result.body;
  }
  catch (error) {
    logger.info('Error:', error.message);
    throw('Invalid session token');
  }

  logger.info('Logged in to Parse.');
  try {
    await upsertItem(user, sessionToken, itemName);
  }
  catch (error) {
    throw error.message;
  }
  logger.info('Saved object.');
};

// Upsert an item.
// TODO: think about moving upsert functionality into cloud code as beforesave hook.
async function upsertItem(user, sessionToken, itemName) {
  if (user === null || user.objectId === null) {
    logger.error('Malformed user object');
  }
  const Item = Parse.Object.extend('Item');
  const query = new Parse.Query(Item);
  query.equalTo('name', itemName);
  const queryItem = await query.first({ sessionToken: sessionToken });
  let item = new Item();
  if (typeof queryItem === 'object') {
    logger.info('Updating existing item...');
    item = queryItem;
    item.set('state', 3);
  }
  else {
    logger.info('Creating new item...');
    item.set('name', itemName);
    item.set('state', 3);
    item.set('quantity', 1);
    item.set('section', 'Uncategorized');
    var acl = new Parse.ACL();
    acl.setPublicReadAccess(false);
    acl.setPublicWriteAccess(false);
    acl.setReadAccess(user.objectId, true);
    acl.setWriteAccess(user.objectId, true);
    item.setACL(acl);
  }
  logger.info('Saving the item...');
  // Save the item.
  await item.save(null, { sessionToken: sessionToken });
}
