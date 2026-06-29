import mongoose from 'mongoose';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Load environment variables
const MONGODB_URI = process.env.MONGODB_URI;

// Path to store local fallback files
const DATA_DIR = path.join(process.cwd(), 'backend', 'data');

// Ensure data directory exists for fallback mode
if (!fsSync.existsSync(DATA_DIR)) {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

// Low-profile helper to load data synchronously or asynchronously
const readCollection = async (collectionName) => {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const writeCollection = async (collectionName, data) => {
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Custom Mongoose Fallback Driver
class FallbackModel {
  constructor(collectionName, data = {}) {
    this._collectionName = collectionName;
    Object.assign(this, data);
    if (!this._id) {
      this._id = 'id_' + Math.random().toString(36).substring(2, 11);
    }
    if (!this.createdAt) {
      this.createdAt = new Date().toISOString();
    }
    if (!this.updatedAt) {
      this.updatedAt = new Date().toISOString();
    }
  }

  async save() {
    const items = await readCollection(this._collectionName);
    const simplified = { ...this };
    delete simplified._collectionName;

    const idx = items.findIndex((i) => i._id === this._id);
    simplified.updatedAt = new Date().toISOString();

    if (idx >= 0) {
      items[idx] = simplified;
    } else {
      items.push(simplified);
    }

    await writeCollection(this._collectionName, items);
    
    // Assign properties to self
    Object.assign(this, simplified);
    return this;
  }

  // Create chainable populate behavior
  static _createChainable(promise, collectionName) {
    promise.populate = (pathName) => {
      const wrappedPromise = promise.then(async (result) => {
        if (!result) return result;
        
        // Define relations mapping path name to collection file name
        const relations = {
          client: 'users',
          freelancer: 'users',
          hiredFreelancer: 'users',
          job: 'jobs',
          bids: 'bids',
          sender: 'users',
          receiver: 'users',
          payer: 'users',
          owner: 'users' // Ensure Service (Gig) owners can populate
        };

        const targetCollectionName = relations[pathName];
        if (!targetCollectionName) return result;

        const targetItems = await readCollection(targetCollectionName);
        
        const populateItem = (item) => {
          if (!item) return item;
          const refId = item[pathName];
          if (refId && typeof refId === 'string') {
            const match = targetItems.find(t => t._id === refId);
            if (match) {
              const matchCopy = { ...match };
              delete matchCopy.password; // Do not expose password
              item[pathName] = matchCopy;
            }
          } else if (refId && Array.isArray(refId)) {
            item[pathName] = refId.map(id => {
              const match = targetItems.find(t => t._id === id);
              if (match) {
                const matchCopy = { ...match };
                delete matchCopy.password;
                return matchCopy;
              }
              return id;
            });
          }
          return item;
        };

        if (Array.isArray(result)) {
          return result.map(populateItem);
        } else {
          return populateItem(result);
        }
      });

      return FallbackModel._createChainable(wrappedPromise, collectionName);
    };

    promise.sort = (sortOptions) => {
      const sortedPromise = promise.then((result) => {
        if (!result || !Array.isArray(result)) return result;
        const sorted = [...result];
        const [field, direction] = Object.entries(sortOptions)[0];
        sorted.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return direction === -1 || direction === 'desc' ? 1 : -1;
          if (valA > valB) return direction === -1 || direction === 'desc' ? -1 : 1;
          return 0;
        });
        return sorted;
      });
      return FallbackModel._createChainable(sortedPromise, collectionName);
    };

    return promise;
  }

  static create(collectionName) {
    return class ModelInstance extends FallbackModel {
      constructor(data = {}) {
        super(collectionName, data);
      }

      static find(query = {}) {
        const matchItem = (item, qVal) => {
          return Object.entries(qVal).every(([key, val]) => {
            if (key === '$or' && Array.isArray(val)) {
              return val.some(subQuery => matchItem(item, subQuery));
            }
            const itemVal = item[key];
            if (val && typeof val === 'object') {
              return Object.entries(val).every(([op, opVal]) => {
                if (op === '$regex') {
                  const opt = val.$options || 'i';
                  const rx = new RegExp(opVal, opt);
                  if (Array.isArray(itemVal)) {
                    return itemVal.some(v => rx.test(String(v)));
                  }
                  return rx.test(String(itemVal || ''));
                }
                if (op === '$ne') {
                  return itemVal !== opVal;
                }
                if (op === '$gte') {
                  return Number(itemVal) >= Number(opVal);
                }
                if (op === '$lte') {
                  return Number(itemVal) <= Number(opVal);
                }
                if (op === '$gt') {
                  return Number(itemVal) > Number(opVal);
                }
                if (op === '$lt') {
                  return Number(itemVal) < Number(opVal);
                }
                return false;
              });
            }
            return itemVal === val;
          });
        };

        const promise = readCollection(collectionName).then((items) => {
          const filtered = items.filter(item => matchItem(item, query));
          // Deep copy items to avoid cross-contamination
          return filtered.map(item => new ModelInstance(JSON.parse(JSON.stringify(item))));
        });
        return FallbackModel._createChainable(promise, collectionName);
      }

      static findOne(query = {}) {
        const matchItem = (item, qVal) => {
          return Object.entries(qVal).every(([key, val]) => {
            if (key === '$or' && Array.isArray(val)) {
              return val.some(subQuery => matchItem(item, subQuery));
            }
            const itemVal = item[key];
            if (val && typeof val === 'object') {
              return Object.entries(val).every(([op, opVal]) => {
                if (op === '$regex') {
                  const opt = val.$options || 'i';
                  const rx = new RegExp(opVal, opt);
                  if (Array.isArray(itemVal)) {
                    return itemVal.some(v => rx.test(String(v)));
                  }
                  return rx.test(String(itemVal || ''));
                }
                if (op === '$ne') {
                  return itemVal !== opVal;
                }
                if (op === '$gte') {
                  return Number(itemVal) >= Number(opVal);
                }
                if (op === '$lte') {
                  return Number(itemVal) <= Number(opVal);
                }
                if (op === '$gt') {
                  return Number(itemVal) > Number(opVal);
                }
                if (op === '$lt') {
                  return Number(itemVal) < Number(opVal);
                }
                return false;
              });
            }
            return itemVal === val;
          });
        };

        const promise = readCollection(collectionName).then((items) => {
          const item = items.find(item => matchItem(item, query));
          if (!item) return null;
          return new ModelInstance(JSON.parse(JSON.stringify(item)));
        });
        return FallbackModel._createChainable(promise, collectionName);
      }

      static findById(id) {
        const promise = readCollection(collectionName).then((items) => {
          const item = items.find((item) => item._id === id);
          if (!item) return null;
          return new ModelInstance(JSON.parse(JSON.stringify(item)));
        });
        return FallbackModel._createChainable(promise, collectionName);
      }

      static async findByIdAndUpdate(id, updateData, options = {}) {
        const items = await readCollection(collectionName);
        const idx = items.findIndex((item) => item._id === id);
        if (idx === -1) return null;

        const currentItem = items[idx];
        const updatedItem = {
          ...currentItem,
          ...updateData,
          _id: id,
          updatedAt: new Date().toISOString()
        };

        items[idx] = updatedItem;
        await writeCollection(collectionName, items);

        return new ModelInstance(updatedItem);
      }

      static async findByIdAndDelete(id) {
        const items = await readCollection(collectionName);
        const idx = items.findIndex((item) => item._id === id);
        if (idx === -1) return null;

        const deleted = items.splice(idx, 1)[0];
        await writeCollection(collectionName, items);
        return new ModelInstance(deleted);
      }

      static async create(data) {
        const instance = new ModelInstance(data);
        return await instance.save();
      }

      static async countDocuments(query = {}) {
        const items = await readCollection(collectionName);
        return items.filter((item) => {
          return Object.entries(query).every(([key, val]) => item[key] === val);
        }).length;
      }

      static async deleteMany(query = {}) {
        const items = await readCollection(collectionName);
        const remaining = items.filter((item) => {
          return !Object.entries(query).every(([key, val]) => item[key] === val);
        });
        await writeCollection(collectionName, remaining);
        return { deletedCount: items.length - remaining.length };
      }

      static async updateMany(query = {}, updateData = {}) {
        const items = await readCollection(collectionName);
        const matchItem = (item, qVal) => {
          return Object.entries(qVal).every(([key, val]) => {
            if (key === '$or' && Array.isArray(val)) {
              return val.some(subQuery => matchItem(item, subQuery));
            }
            const itemVal = item[key];
            if (val && typeof val === 'object') {
              return Object.entries(val).every(([op, opVal]) => {
                if (op === '$regex') {
                  const opt = val.$options || 'i';
                  const rx = new RegExp(opVal, opt);
                  if (Array.isArray(itemVal)) {
                    return itemVal.some(v => rx.test(String(v)));
                  }
                  return rx.test(String(itemVal || ''));
                }
                if (op === '$ne') {
                  return itemVal !== opVal;
                }
                if (op === '$gte') {
                  return Number(itemVal) >= Number(opVal);
                }
                if (op === '$lte') {
                  return Number(itemVal) <= Number(opVal);
                }
                if (op === '$gt') {
                  return Number(itemVal) > Number(opVal);
                }
                if (op === '$lt') {
                  return Number(itemVal) < Number(opVal);
                }
                return false;
              });
            }
            return itemVal === val;
          });
        };

        const updateFields = updateData.$set || updateData;
        let matchedCount = 0;
        let modifiedCount = 0;

        const updatedItems = items.map(item => {
          if (matchItem(item, query)) {
            matchedCount++;
            modifiedCount++;
            return {
              ...item,
              ...updateFields,
              updatedAt: new Date().toISOString()
            };
          }
          return item;
        });

        await writeCollection(collectionName, updatedItems);
        return { matchedCount, modifiedCount };
      }

      static async findOneAndDelete(query = {}) {
        const items = await readCollection(collectionName);
        const matchItem = (item, qVal) => {
          return Object.entries(qVal).every(([key, val]) => {
            if (key === '$or' && Array.isArray(val)) {
              return val.some(subQuery => matchItem(item, subQuery));
            }
            const itemVal = item[key];
            if (val && typeof val === 'object') {
              return Object.entries(val).every(([op, opVal]) => {
                if (op === '$regex') {
                  const opt = val.$options || 'i';
                  const rx = new RegExp(opVal, opt);
                  if (Array.isArray(itemVal)) {
                    return itemVal.some(v => rx.test(String(v)));
                  }
                  return rx.test(String(itemVal || ''));
                }
                if (op === '$ne') {
                  return itemVal !== opVal;
                }
                if (op === '$gte') {
                  return Number(itemVal) >= Number(opVal);
                }
                if (op === '$lte') {
                  return Number(itemVal) <= Number(opVal);
                }
                if (op === '$gt') {
                  return Number(itemVal) > Number(opVal);
                }
                if (op === '$lt') {
                  return Number(itemVal) < Number(opVal);
                }
                return false;
              });
            }
            return itemVal === val;
          });
        };

        const idx = items.findIndex(item => matchItem(item, query));
        if (idx === -1) return null;

        const [deleted] = items.splice(idx, 1);
        await writeCollection(collectionName, items);
        return new ModelInstance(deleted);
      }

      static async findOneAndUpdate(query = {}, updateData = {}, options = {}) {
        const items = await readCollection(collectionName);
        const matchItem = (item, qVal) => {
          return Object.entries(qVal).every(([key, val]) => {
            if (key === '$or' && Array.isArray(val)) {
              return val.some(subQuery => matchItem(item, subQuery));
            }
            const itemVal = item[key];
            if (val && typeof val === 'object') {
              return Object.entries(val).every(([op, opVal]) => {
                if (op === '$regex') {
                  const opt = val.$options || 'i';
                  const rx = new RegExp(opVal, opt);
                  if (Array.isArray(itemVal)) {
                    return itemVal.some(v => rx.test(String(v)));
                  }
                  return rx.test(String(itemVal || ''));
                }
                if (op === '$ne') {
                  return itemVal !== opVal;
                }
                if (op === '$gte') {
                  return Number(itemVal) >= Number(opVal);
                }
                if (op === '$lte') {
                  return Number(itemVal) <= Number(opVal);
                }
                if (op === '$gt') {
                  return Number(itemVal) > Number(opVal);
                }
                if (op === '$lt') {
                  return Number(itemVal) < Number(opVal);
                }
                return false;
              });
            }
            return itemVal === val;
          });
        };

        const idx = items.findIndex(item => matchItem(item, query));
        if (idx === -1) {
          if (options.upsert) {
            const updateFields = updateData.$set || updateData;
            const newItem = { ...query, ...updateFields };
            const instance = new ModelInstance(newItem);
            return await instance.save();
          }
          return null;
        }

        const updateFields = updateData.$set || updateData;
        const currentItem = items[idx];
        const updatedItem = {
          ...currentItem,
          ...updateFields,
          updatedAt: new Date().toISOString()
        };

        items[idx] = updatedItem;
        await writeCollection(collectionName, items);

        return new ModelInstance(updatedItem);
      }
    };
  }
}

// Main MongoDB/Fallback database connection bootstrap
export const connectDB = async () => {
  if (MONGODB_URI && MONGODB_URI !== 'MY_GEMINI_API_KEY' && MONGODB_URI !== '') {
    try {
      console.log('Connecting to Live MongoDB Database...');
      await mongoose.connect(MONGODB_URI);
      console.log('MongoDB Connected Successfully.');
      return true;
    } catch (err) {
      console.error(`MongoDB Connection Error: ${err.message}. Falling back to local JSON engine.`);
    }
  }
  
  console.log('Using robust local JSON file persistence storage engine.');
  return false;
};

// Define Schema for MVC consistency
class SchemaMock {
  constructor(definition, options = {}) {
    this.definition = definition;
    this.options = options;
  }
}
SchemaMock.Types = {
  Mixed: 'Mixed',
  ObjectId: 'ObjectId'
};

export const mongooseInstance = (() => {
  if (MONGODB_URI && MONGODB_URI !== 'MY_GEMINI_API_KEY' && MONGODB_URI !== '') {
    return mongoose;
  } else {
    return {
      Schema: SchemaMock,
      model: (name, schema) => {
        // Map model name to pluralized collection name
        const collectionName = name.toLowerCase() + 's';
        return FallbackModel.create(collectionName);
      }
    };
  }
})();

export default mongooseInstance;
