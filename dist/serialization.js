"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.list = exports.union = exports.extend = exports.rec = exports.optional = exports.u8array = exports.num = exports.str = exports.bool = void 0;
const msgpackr = require("msgpackr");
class InvalidTypeError extends Error {
    constructor(name, expectedType, value) {
        super(`Expected ${name} to be ${expectedType} but found type ${typeof value} instead, with value ${JSON.stringify(value)}`);
    }
}
class TypeImpl {
    constructor(name) {
        this.name = name;
        this.serialize = (t) => {
            const validated = this.validate(t);
            return msgpackr.pack(validated);
        };
        this.deserialize = (u) => {
            const unpacked = msgpackr.unpack(u);
            const validated = this.validate(unpacked);
            return validated;
        };
    }
}
const bool = (name, literalValue) => new BoolType(name, literalValue);
exports.bool = bool;
class BoolType extends TypeImpl {
    constructor(name, literalValue) {
        super(name);
        this.literalValue = literalValue;
        this.validate = (b) => {
            if (typeof b !== 'boolean') {
                throw new InvalidTypeError(this.name, 'boolean', b);
            }
            if (this.literalValue != null && b !== this.literalValue) {
                throw new InvalidTypeError(this.name, this.literalValue.toString(), b);
            }
            return b;
        };
    }
}
const str = (name, ...literalValues) => new StringType(name, literalValues);
exports.str = str;
class StringType extends TypeImpl {
    constructor(name, literalValues) {
        super(name);
        this.literalValues = literalValues;
        this.validate = (s) => {
            if (typeof s !== 'string') {
                throw new InvalidTypeError(this.name, 'string', s);
            }
            if (this.literalValues.length > 0) {
                if (!this.literalValues.includes(s)) {
                    throw new Error(`Expected ${this.name} to be one of values [${this
                        .literalValues
                        .map(s => `"${s}"`)
                        .join(', ')}] but found "${s}" instead`);
                }
            }
            return s;
        };
    }
}
const num = (name, ...literalValues) => new NumberType(name, literalValues);
exports.num = num;
class NumberType extends TypeImpl {
    constructor(name, literalValues) {
        super(name);
        this.literalValues = literalValues;
        this.validate = (n) => {
            if (typeof n !== 'number') {
                throw new InvalidTypeError(this.name, 'number', n);
            }
            if (this.literalValues.length > 0) {
                if (!this.literalValues.includes(n)) {
                    throw new Error(`Expected ${this.name} to be one of values [${this
                        .literalValues
                        .join(', ')}] but found ${n} instead`);
                }
            }
            return n;
        };
    }
}
const u8array = (name) => new Uint8ArrayType(name);
exports.u8array = u8array;
class Uint8ArrayType extends TypeImpl {
    constructor() {
        super(...arguments);
        this.validate = (u) => {
            if (!(u instanceof Uint8Array)) {
                throw new InvalidTypeError(this.name, 'u8array', u);
            }
            return u;
        };
    }
}
// Nullable types will have the same `Type` as an optional type (i.e. `T | undefined | null`), so we add an additional
// meta-property `optional` to discriminate against it during `Reify`.
const optional = (base) => new OptionalType(base);
exports.optional = optional;
class OptionalType extends TypeImpl {
    constructor(base) {
        // TODO: wire parent name down into optionals
        super('');
        this.base = base;
        this.optional = true;
        this.validate = (u) => {
            if (u != null) {
                return this.base.validate(u);
            }
            return undefined;
        };
    }
}
const rec = (name, schema) => new RecordType(name, schema);
exports.rec = rec;
class RecordType extends TypeImpl {
    constructor(name, schema) {
        super(name);
        this.schema = schema;
        this.hasKey = (key) => {
            return Object.keys(this.schema).includes(key);
        };
        this.validate = (u, ignoredKeys) => {
            if (typeof u !== 'object') {
                throw new InvalidTypeError(this.name, 'object', u);
            }
            const ignoredKeySet = new Set(ignoredKeys);
            let result = {};
            // Test all property constraints
            for (const [key, validator] of Object.entries(this.schema)) {
                if (ignoredKeySet.has(key)) {
                    continue;
                }
                const propValue = u[key];
                const validatedValue = validator.validate(propValue);
                result[key] = validatedValue;
            }
            return result;
        };
        this.validateProperty = (key, value) => {
            return this.schema[key].validate(value);
        };
    }
}
const extend = (name, base, schema) => new ExtendsType(name, base, schema);
exports.extend = extend;
class ExtendsType extends TypeImpl {
    constructor(name, baseType, schema) {
        super(name);
        this.baseType = baseType;
        this.schema = schema;
        this.hasKey = (key) => {
            return Object.keys(this.schema).includes(key) || this.baseType.hasKey(key);
        };
        this.validate = (u) => {
            const ignoredKeys = Object.keys(this.schema);
            const baseResult = this.baseType.validate(u, ignoredKeys);
            const schemaResult = this.subtype.validate(u);
            return Object.assign(Object.assign({}, baseResult), schemaResult);
        };
        this.validateProperty = (key, value) => {
            return this.schema[key].validate(value);
        };
        this.subtype = new RecordType(name, schema);
    }
}
const union = (name, discriminator, schemas) => new UnionRecordType(name, discriminator, schemas);
exports.union = union;
class UnionRecordType extends TypeImpl {
    constructor(name, discriminator, schemas) {
        super(name);
        this.discriminator = discriminator;
        this.schemas = schemas;
        this.hasKey = (key) => {
            return this.schemas.every(s => s.hasKey(key));
        };
        this.validate = (u) => {
            const schema = this.schemas.find(s => {
                const ignoredKeys = Object.keys(s.schema);
                ignoredKeys.splice(ignoredKeys.indexOf(this.discriminator), 1);
                try {
                    s.validate(u, ignoredKeys);
                    return true;
                }
                catch (e) {
                    return false;
                }
            });
            if (!schema) {
                throw new InvalidTypeError(this.name, 'union', u);
            }
            const validated = schema.validate(u);
            return validated;
        };
        this.validateProperty = (key, value) => {
            // Test against all schemas, and return the last one
            let result;
            for (const subschema of this.schemas) {
                result = subschema.validateProperty(key, value);
            }
            return result;
        };
        for (const subschema of schemas) {
            if (!subschema.hasKey(discriminator)) {
                throw new Error(`Subschema "${subschema.name}" of union type "${name}" is missing discriminator property "${discriminator}"`);
            }
        }
    }
}
const list = (name, itemSchema) => new ListType(name, itemSchema);
exports.list = list;
class ListType extends TypeImpl {
    constructor(name, itemSchema) {
        super(name);
        this.itemSchema = itemSchema;
        this.validate = (u) => {
            if (!Array.isArray(u)) {
                throw new InvalidTypeError(this.name, 'array', u);
            }
            const result = [];
            for (const i of u) {
                result.push(this.itemSchema.validate(i));
            }
            return result;
        };
    }
}
