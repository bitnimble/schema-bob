# schema-bob: Bob the schema builder

This is a small library to help to define schemas, such as common types or request / response objects, to be shared between multiple clients. It allows you to define your schema in Typescript, and gives you functions back that will handle serialization / deserialization to an over-the-wire format, as well as validation.

Serialization and deserialization uses the [MessagePack](https://msgpack.org/index.html) binary format under the hood, via the [msgpackr](https://github.com/kriszyp/msgpackr) library.

### Quick example:

Defining the schema:
```ts
// A successful response from an API backend
const apiSuccess = rec('apiSuccess', {
  success: bool('success', true),
});
// An error response
const apiError = rec('apiError', {
  success: bool('success', false),
  statusCode: num('statusCode'),
  errorMessage: str('errorMessage'),
});
// Unioning the success and error responses into a common response type
const apiResponse = union('apiResponse', 'success', [apiSuccess, apiError]);
export const {
  serialize: serializeApiResponse,
  deserialize: deserializeApiResponse,
} = apiResponse;
```
Example backend usage:
```ts
import { serializeApiResponse } from 'your-schema';

const resp = serializeApiResponse({
  success: false,
  statusCode: 404,
  errorMessage: 'Not found',
}); // -> Uint8Array buffer to be sent over the wire
res.send(Buffer.from(resp));
```
and then to be deserialized on the other side of the wire, in the frontend:
```ts
import { deserializeApiResponse } from 'your-schema';

const fetchResp = new Uint8Array(await fetch(...).then(r => r.arrayBuffer()));
const resp = deserializeApiResponse(fetchResp);
if (!resp.success) {
  alert(`Server responded with ${statusCode} - ${errorMessage}`);
}
```

# Todo list
* Optionally strip names out in production builds
* Remove as many `any` type coercions as possible
* Restrict `union` discriminator to common properties on the supplied record types
* Add tests and documentation for more complex combinations of types

# Supported structures
Every builder function takes a name so that if an error occurs during serialization or deserialization, it can print the name in the error for easier debugging. They aren't required for any functional purpose otherwise.

Each builder returns a `Type<T>` that has three functions on it:
```ts
export interface Type<T> {
  serialize(t: T): Uint8Array;
  deserialize(u: Uint8Array): T;
  validate(u: unknown): T;
}
```

- Serialize: serializes an input value and returns a Uint8Array to be sent over-the-wire. <br>For record-like types, this will strip any additional unspecified properties before serializing it.
- Deserialize: attempts to deserialize an input Uint8Array back to the original type, and then validates that it conforms to the constraints originally provided to the builder function.<br>For record-like types, this will strip any additional unspecified properties that happened to be present in the deserialized value before returning it to the caller.
- Validate: validates that the input conforms to the constraints originally provided to the builder function. An `InvalidTypeError` will be thrown if the input value is not valid.<br>This does not attempt to transform or deserialize the input value before validating, so it must be of the correct type first.<br>
  * For primitives, this will return the input value.
  * For record-like types, this will return a deep copy that has any additional unspecified properties stripped.

## Primitives
### booleans
```ts
import { bool } from 'schema-bob';

const someBool = bool('someBool');

const serialized = someBool.serialize(true); // -> Uint8Array
const deserialized = someBool.deserialize(serialized); // -> true
```
It can also restrict to boolean literal types `true` and `false`, by providing the literal value to the builder:
```ts
const someTrue = bool('someTrue', true);

someTrue.serialize(false); // Argument of type 'false' is not assignable to parameter of type 'true'.
```

### strings
```ts
import { str } from 'schema-bob';

const someStr = str('someStr');

const serialized = someStr.serialize('hello world'); // -> Uint8Array
const deserialized = someStr.deserialize(serialized); // -> 'hello world'
```
Also supports string literal types, in the same fashion as boolean literal types:
```ts
const animalType = str('animalType', 'cat', 'dog');
animalType.serialize('cow'); // Argument of type '"cow"' is not assignable to parameter of type '"cat" | "dog"'.
```
Conveniently, this can be used for string-backed enums:
```ts
const enum Dir {
  N = 'N',
  E = 'W',
  S = 'S',
  W = 'W',
};
const direction = str('direction', Dir.N, Dir.E, Dir.S, Dir.W);
const serialized = direction.serialize(Dir.N); // -> Uint8Array
const deserialized = direction.deserialize(serialized); // -> 'N', or Dir.N
```

### numbers
Note: by default, msgpackr serializes all numbers as a float64 / double.
```ts
import { num } from 'schema-bob';

const someNum = num('someNum');

const serialized = someNum.serialize(5); // -> Uint8Array
const deserialized = someNum.deserialize(serialized); // -> 5
```
Numeric literal types, same as before...
```ts
const some123 = num('some123', 1, 2, 3);
some123.serialize(4); // Argument of type '4' is not assignable to parameter of type '1 | 2 | 3'.
```
And the same applies to numeric enums as well:
```ts
const enum Dir {
  N = 1,
  E = 2,
  S = 3,
  W = 4,
};
const direction = num('direction', Dir.N, Dir.E, Dir.S, Dir.W);
const serialized = direction.serialize(Dir.N); // -> Uint8Array
const deserialized = direction.deserialize(serialized); // -> 1, or Dir.N
```

### `Uint8Array`s
We can also serialize arbitrary Uint8Arrays as well, in order to support sending things like Buffers or Blobs.
```ts
import { u8array } from 'schema-bob';

const arr = [0, 1, 3, 5, 7, 13];
const u8 = Uint8Array.from(arr);
const someu8Arr = u8array('someu8Arr');

const serialized = someu8Arr.serialize(u8); // -> Uint8Array... but a wrapped one
const deserialized = someu8Array.deserialize(serialized); // -> our original u8
```

## Collections
### Records / objects
Records take a POJO to define the shape, where each property key is another `Type<T>`.
```ts
import { rec, num, str } from 'schema-bob';

const someRec = rec('someRec', {
  foo: str('foo'),
  bar: num('bar'),
});

const serialized = someRec.serialize({ foo: 'hello world', bar: 5 }); // -> Uint8Array
const deserialized = someRec.deserialize(serialized); // -> { foo: 'hello world', bar: 5 }
```
Upon both serialization and deserializtion, it will strip any excess properties that aren't specified in the schema:
```ts
const user = rec('user', {
  id: str('id'),
  username: str('username'),
});

const serialized = user.serialize({
  id: 1,
  username: 'anonymousthing',
  email: 'sensitive-info@gmail.com',
  bcyptedPasswordWhyIsThisHere: 'hunter2',
}); // -> Uint8Array, but 'sensitive-info@gmail.com' or 'hunter2' is not present in the byte stream
const deserialized = user.deserialize(serialized); // -> { id: 1, username: 'anonymousthing' }
```
Note: as with pretty much anything that is not your own code, you should not _rely_ on this as a guarantee that you aren't leaking data. You should always take your own precautions and only send the data that you need. This is just a convenient safety net.

### Optionals
You can use `optional` to box anything so that it's nullable. It can be used as-is on top of any `Type<T>`:
```ts
import { optional, num } from 'schema-bob';

const errorCode = optional(num('errorCode'));
const serialized = errorCode.serialize(undefined); // -> Uint8Array
const deserialized = errorCode.deserialize(serialized); // -> undefined
```
...or as a property in a record type:
```ts
import { rec, optional, num } from 'schema-bob';

const result = rec('result', {
  errorCode: optional(num('errorCode')),
});
const serialized = result.serialize({
  errorCode: undefined,
}); // -> Uint8Array
const deserialized = result.deserialize(serialized); // -> { errorCode: undefined }
```

### Combining records: extends
You can use `extend` to create subtypes of other record-like types.
```ts
import { extend, rec, num } from 'schema-bob';

const base = rec('base', {
  foo: num('foo'),
});
const extended = extend('extended', base, {
  bar: num('bar');
});

const serialized = extended.serialize({ foo: 1, bar: 2 }); // -> Uint8Array
const deserialized = extended.deserialize(serialized); // -> { foo: 1, bar: 2 }
const baseDeserialized = base.deserialize(serialized); // -> { foo: 1 }
```

### Combining records: union
`union` allows you to create discriminated union types. Narrowing can be done on any of the supported literal types (boolean, string, or number).

```ts
import { union, rec, bool, str } from 'schema-bob';

// Narrow on the 'success' property of the provided subtypes
const someUnion = union('someUnion', 'success', [
  rec('someRec1', {
    success: bool('success', true),
    prop1: str('prop1'),
  }),
  rec('someRec2', {
    success: bool('success', false),
    prop2: str('prop2'),
  }),
]);
const serialized = someUnion.serialize({
  success: true,
  prop1: 'hello world',
}); // -> Uint8Array
const deserialized = someUnion.deserialize(serialized); // -> { success: true, prop1: 'hello world' }

// Note that the return type from `deserialize` is still the full union type, so it must be narrowed in TS first.
if (deserialized.success) {
  console.log(deserialized.prop1);
} else {
  console.log(deserialized.prop2);
}
```

### Lists
Lists can contain any type, both primitives, record-like types, as well as nested lists.
```ts
import { list, num } from 'schema-bob';

const someList = list('someList', num('someCount'));
const serialized = someList.serialize([1, 2, 3, 4, 5]); // -> Uint8Array
const deserialized = someList.deserialize(serialized); // -> [1, 2, 3, 4, 5]
```

### Example complex types
```ts
// TODO
```
