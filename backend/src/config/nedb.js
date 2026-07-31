'use strict'
/**
 * NeDB datastore initialiser.
 *
 * Replaces MongoDB/Mongoose for the desktop build.
 * All data is stored as plain JSON files inside the OS userData directory
 * (set via USERDATA_PATH env var, which electron/main.js injects before
 * requiring the backend).
 *
 * API compatibility: we expose a thin shim that mirrors the Mongoose
 * methods used in the codebase (find, findOne, create, updateOne,
 * deleteOne, countDocuments, distinct).
 */

const path = require('path')
const Datastore = require('@seald-io/nedb')

// Allow Electron to set the storage root before the backend loads.
const dataDir = process.env.USERDATA_PATH
  ? path.join(process.env.USERDATA_PATH, 'db')
  : path.join(__dirname, '..', '..', '..', '.nedb-data')

// Lazy singleton datastores — created once per process.
let _iconsDb = null

function getIconsDb() {
  if (_iconsDb) return _iconsDb
  _iconsDb = new Datastore({
    filename: path.join(dataDir, 'icons.db'),
    autoload: true,
    timestampData: true,   // adds createdAt + updatedAt automatically
  })
  // Indexes
  _iconsDb.ensureIndex({ fieldName: 'id', unique: true }, () => {})
  _iconsDb.ensureIndex({ fieldName: 'category' }, () => {})
  _iconsDb.ensureIndex({ fieldName: 'tags' }, () => {})
  return _iconsDb
}

module.exports = { getIconsDb, dataDir }
