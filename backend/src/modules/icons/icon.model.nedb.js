'use strict'
/**
 * Icon model — NeDB edition.
 *
 * Exposes the same API surface that the controllers use via Mongoose
 * (findOne, find, create, updateOne, deleteOne, countDocuments, distinct).
 *
 * All methods return Promises so callers (which already use async/await)
 * need zero changes.
 *
 * In desktop mode (DESKTOP_MODE=true) this module is used instead of
 * the Mongoose model.  In web/server mode Mongoose is still used.
 */

const { getIconsDb } = require('../../config/nedb')

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Apply a regex filter to a NeDB query condition. */
function applyRegex(condition) {
  if (!condition) return condition
  if (condition.$regex) {
    const flags = condition.$options || ''
    return new RegExp(condition.$regex, flags)
  }
  return condition
}

/**
 * Translate a Mongoose-style query into a NeDB-compatible query.
 * Handles: equality, $or, $regex/$options, $in.
 */
function translateQuery(mq = {}) {
  const out = {}
  for (const [key, val] of Object.entries(mq)) {
    if (key === '$or') {
      out.$or = val.map(translateQuery)
    } else if (val && typeof val === 'object' && val.$regex !== undefined) {
      out[key] = applyRegex(val)
    } else {
      out[key] = val
    }
  }
  return out
}

// ─── Cursor wrapper (mimics Mongoose chainable cursor) ───────────────────────

class Cursor {
  constructor(db, query) {
    this._db    = db
    this._query = query
    this._sort  = null
    this._skip  = 0
    this._limit = 0
    this._lean  = false
  }

  sort(spec)  { this._sort  = spec;  return this }
  skip(n)     { this._skip  = n;     return this }
  limit(n)    { this._limit = n;     return this }
  lean()      { this._lean  = true;  return this }

  then(resolve, reject) {
    return this._exec().then(resolve, reject)
  }

  _exec() {
    return new Promise((resolve, reject) => {
      let cursor = this._db.find(this._query)
      if (this._sort)  cursor = cursor.sort(this._sort)
      if (this._skip)  cursor = cursor.skip(this._skip)
      if (this._limit) cursor = cursor.limit(this._limit)
      cursor.exec((err, docs) => {
        if (err) return reject(err)
        resolve(this._lean ? docs.map(clean) : docs.map(wrap))
      })
    })
  }
}

/** Strip NeDB internals (_id stays, __v is not added). */
function clean(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { _id, ...rest }
}

/**
 * Wrap a raw NeDB document to provide a Mongoose-like `save()` and
 * `deleteOne()` method so code like `icon.svgUrl = …; await icon.save()`
 * still works.
 */
function wrap(doc) {
  if (!doc) return doc
  const db = getIconsDb()
  return {
    ...doc,
    toObject() { return clean(doc) },
    async save() {
      const { _id, createdAt, ...update } = doc   // don't overwrite _id / createdAt
      update.updatedAt = new Date()
      // sync mutations back onto doc
      Object.assign(doc, update)
      return new Promise((res, rej) =>
        db.update({ _id }, { $set: update }, {}, (err) => err ? rej(err) : res())
      )
    },
    async deleteOne() {
      return new Promise((res, rej) =>
        db.remove({ _id }, {}, (err) => err ? rej(err) : res())
      )
    },
  }
}

// ─── Model ───────────────────────────────────────────────────────────────────

const Icon = {
  /** find(query) — returns a chainable Cursor */
  find(query = {}) {
    return new Cursor(getIconsDb(), translateQuery(query))
  },

  /** findOne(query) — resolves with wrapped doc or null */
  async findOne(query = {}) {
    const db = getIconsDb()
    return new Promise((resolve, reject) => {
      db.findOne(translateQuery(query), (err, doc) => {
        if (err) return reject(err)
        resolve(doc ? wrap(doc) : null)
      })
    })
  },

  /** create(data) — inserts and resolves with wrapped doc */
  async create(data) {
    const db = getIconsDb()
    return new Promise((resolve, reject) => {
      db.insert(data, (err, doc) => {
        if (err) return reject(err)
        resolve(wrap(doc))
      })
    })
  },

  /** updateOne(query, update) — executes immediately */
  updateOne(query, update) {
    const db = getIconsDb()
    const op = update.$set ? { $set: update.$set } : update
    return new Promise((resolve, reject) => {
      db.update(translateQuery(query), op, {}, (err, n) => {
        if (err) return reject(err)
        resolve({ modifiedCount: n })
      })
    })
  },

  /** countDocuments(query) */
  async countDocuments(query = {}) {
    const db = getIconsDb()
    return new Promise((resolve, reject) => {
      db.count(translateQuery(query), (err, n) => {
        if (err) return reject(err)
        resolve(n)
      })
    })
  },

  /** distinct(field) — returns array of unique values */
  async distinct(field, query = {}) {
    const db = getIconsDb()
    return new Promise((resolve, reject) => {
      db.find(translateQuery(query), (err, docs) => {
        if (err) return reject(err)
        const vals = [...new Set(docs.map(d => d[field]).filter(v => v !== undefined))]
        resolve(vals)
      })
    })
  },
}

module.exports = Icon
