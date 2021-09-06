import { bool, extend, list, num, optional, rec, Reify, str, Type, u8array, union } from '../serialization';

function rt<T>(t: Type<T>, val: T) {
  return t.deserialize(t.serialize(val));
}

describe('serialization', () => {
  describe('bool', () => {
    it('can round-trip a bool', () => {
      const someBool = bool('someBool');
      expect(rt(someBool, true)).toBe(true);
      expect(rt(someBool, false)).toBe(false);
    });

    it('fails to serialize a bool of the wrong literal type', () => {
      const literalTrue = bool('literalTrue', true);
      // @ts-expect-error
      expect(() => literalTrue.serialize(false)).toThrow('Expected literalTrue to be true but found type boolean instead, with value false');
    });
  });

  describe('str', () => {
    it('can round-trip a string', () => {
      const someStr = str('someStr');
      expect(rt(someStr, 'hello world')).toEqual('hello world');
    });

    it('fails to serialize a string of the wrong literal type', () => {
      const literalHelloWorld = str('literalHelloWorld', 'hello', 'world');
      expect(rt(literalHelloWorld, 'hello')).toEqual('hello');
      expect(rt(literalHelloWorld, 'world')).toEqual('world');
      // @ts-expect-error
      expect(() => literalHelloWorld.serialize('invalid')).toThrow('Expected literalHelloWorld to be one of values ["hello", "world"] but found "invalid" instead');
    });
  });

  describe('num', () => {
    it('can round-trip a number', () => {
      const someNum = num('someNum');
      expect(rt(someNum, 0)).toEqual(0);
      expect(rt(someNum, 1)).toEqual(1);
      expect(rt(someNum, -1)).toEqual(-1);
      expect(rt(someNum, 9123)).toEqual(9123);
      expect(rt(someNum, NaN)).toEqual(NaN);
      expect(rt(someNum, Infinity)).toEqual(Infinity);
      expect(rt(someNum, -Infinity)).toEqual(-Infinity);
      expect(rt(someNum, 3.3333333333333333334)).toEqual(3.3333333333333333334);
    });

    it('fails to serialize a number of the wrong literal type', () => {
      const literal1234 = num('literal1234', 1, 2, 3, 4);
      expect(rt(literal1234, 1)).toEqual(1);
      expect(rt(literal1234, 3)).toEqual(3);
      // @ts-expect-error
      expect(() => literal1234.serialize(5)).toThrow('Expected literal1234 to be one of values [1, 2, 3, 4] but found 5 instead')
    });

    it('can be used with an enum', () => {
      const enum Dir {
        N = 1,
        E = 2,
        S = 3,
        W = 4,
      };
      const directions = num('directions', Dir.N, Dir.E, Dir.S, Dir.W);
      expect(rt(directions, Dir.N)).toEqual(Dir.N);
      expect(rt(directions, Dir.E)).toEqual(Dir.E);
      expect(rt(directions, Dir.S)).toEqual(Dir.S);
      expect(rt(directions, Dir.W)).toEqual(Dir.W);
    });
  });

  describe('u8array', () => {
    it('can round-trip a Uint8Array', () => {
      const arr = [0, 1, 3, 5, 7, 13];
      const u8 = Uint8Array.from(arr);
      const someu8Arr = u8array('someu8Arr');
      expect(Array.from(rt(someu8Arr, u8))).toEqual(arr);
    });
  });

  describe('optional', () => {
    it('can handle undefined values for an optional', () => {
      const someOptionalBool = optional(bool('someBool'));
      expect(rt(someOptionalBool, undefined)).toEqual(undefined);
      expect(rt(someOptionalBool, null)).toEqual(undefined);
      expect(rt(someOptionalBool, true)).toEqual(true);
      expect(rt(someOptionalBool, false)).toEqual(false);
    });

    it('allows undefined values for record properties', () => {
      const someRec = rec('someRec', {
        prop1: optional(bool('prop1')),
        prop2: optional(str('prop2')),
      });
      const val: Reify<typeof someRec> = {
        prop1: undefined,
        prop2: undefined,
      };
      expect(rt(someRec, val)).toEqual(val);
    });
  });

  describe('rec', () => {
    it('can round-trip a shallow record type', () => {
      const someRec = rec('someRec', {
        prop1: bool('prop1', true),
        prop2: str('prop2'),
        _prop3: optional(str('prop3')),
      });
      const val1: Reify<typeof someRec> = {
        prop1: true,
        prop2: 'hello world',
        _prop3: undefined,
      };
      const val2: Reify<typeof someRec> = {
        prop1: true,
        prop2: 'goodbye world',
        _prop3: 'hello universe',
      };
      expect(rt(someRec, val1)).toEqual(val1);
      expect(rt(someRec, val2)).toEqual(val2);
    });

    it('can round-trip a nested record type', () => {
      const someRec = rec('someRec', {
        nestedRec: rec('nestedRec', {
          prop1: str('nestedProp1'),
          prop2: str('nestedProp2'),
        }),
        prop1: str('topLevelProp1'),
        prop2: bool('topLevelProp1'),
      });
      const val: Reify<typeof someRec> = {
        nestedRec: {
          prop1: 'hello',
          prop2: 'world',
        },
        prop1: 'test',
        prop2: true,
      };
      expect(rt(someRec, val)).toEqual(val);
    });

    it('avoids serializing properties not present in the schema', () => {
      const someRec = rec('someRec', {
        prop: str('prop'),
        prop2: str('prop2'),
        prop3: str('prop3'),
      });
      const someSubRec = rec('someSubRec', {
        prop: str('prop'),
      });
      const val = {
        prop: 'hello world',
        prop2: 'this should disappear',
        prop3: 'begone demons',
      };
      expect(rt(someSubRec, val)).toEqual({ prop: 'hello world' });
      expect(() => someRec.deserialize(someSubRec.serialize(val))).toThrow('Expected prop2 to be string but found type undefined instead, with value undefined');
    });

    it('avoids deserializing properties not present in the schema', () => {
      const someRec = rec('someRec', {
        prop: str('prop'),
        prop2: str('prop2'),
        prop3: str('prop3'),
      });
      const someSubRec = rec('someSubRec', {
        prop: str('prop'),
      });
      const val = {
        prop: 'hello world',
        prop2: 'this should disappear',
        prop3: 'begone demons',
      };
      expect(someSubRec.deserialize(someRec.serialize(val))).toEqual({ prop: 'hello world' });
    });
  });

  describe('extend', () => {
    it('can round-trip an extended record', () => {
      const extended = extend(
        'extended',
        rec('base', {
          prop1: str('prop1'),
          prop2: bool('prop2'),
        }),
        {
          prop3: str('prop3'),
          prop4: optional(bool('prop4', true)),
        },
      );
      const val: Reify<typeof extended> = {
        prop1: 'hello',
        prop2: true,
        prop3: 'world',
        prop4: undefined,
      };
      expect(rt(extended, val)).toEqual(val);
    });

    it('can override properties on the base type', () => {
      const extended = extend(
        'extended',
        rec('base', {
          prop1: str('prop1'),
          prop2: bool('prop2'),
        }),
        {
          prop2: str('prop2str'),
        },
      );
      const val: Reify<typeof extended> = {
        prop1: 'hello',
        prop2: 'world',
      };
      expect(rt(extended, val)).toEqual(val);
    });
  });

  describe('union', () => {
    it('can round-trip any subschema', () => {
      const someUnion = union('someUnion', 'success', [
        rec('someRec1', {
          success: bool('success', true),
          prop1: str('prop1'),
          otherProp: bool('someOtherProp'),
        }),
        rec('someRec2', {
          success: bool('success', false),
          prop2: str('prop1'),
          differentProp: str('differentProp'),
        }),
      ]);
      const val1: Reify<typeof someUnion> = {
        success: true,
        prop1: 'hello world',
        otherProp: false,
      };
      const val2: Reify<typeof someUnion> = {
        success: false,
        prop2: 'goodbye world',
        differentProp: 'hello universe',
      };
      expect(rt(someUnion, val1)).toEqual(val1);
      expect(rt(someUnion, val2)).toEqual(val2);
    });

    it('throws an error if the subschema does not include the discriminator property', () => {
      expect(() => {
        union('someUnion', 'success', [
          rec('someRec1', {
            success: bool('success', true),
          }),
          // @ts-expect-error
          rec('someRec2', {
            prop1: bool('prop1'),
          }),
        ]);
      }).toThrow('Subschema "someRec2" of union type "someUnion" is missing discriminator property "success"');
    });

    it('can discriminate on string literal properties', () => {
      const someUnion = union('someUnion', 'kind', [
        rec('someRec1', {
          kind: str('kind', 'hello'),
          foo: bool('foo'),
        }),
        rec('someRec2', {
          kind: str('kind', 'goodbye'),
          bar: bool('bar'),
        }),
        rec('someRec2', {
          kind: str('kind', 'greetings'),
          baz: bool('baz'),
        }),
      ]);
      const val: Reify<typeof someUnion> = {
        kind: 'greetings',
        baz: true,
      };
      expect(rt(someUnion, val)).toEqual(val);
    });
  });

  describe('list', () => {
    it('can round-trip a list of primitives', () => {
      const someList = list('someList', num('someListItem'));
      const val = [1,2,3,6,8];
      expect(rt(someList, val)).toEqual(val);
    });

    it('can round-trip a list of nested records', () => {
      const someList = list('someList', rec('someListItem', {
        prop1: str('prop1'),
        nested: rec('nested', {
          nestedProp1: bool('nestedProp1'),
          nestedProp2: str('nestedProp2'),
        }),
      }));
      const val: Reify<typeof someList> = [
        {
          prop1: 'hello',
          nested: {
            nestedProp1: true,
            nestedProp2: 'beep'
          },
        },
        {
          prop1: 'world',
          nested: {
            nestedProp1: false,
            nestedProp2: 'boop',
          },
        },
      ];
      expect(rt(someList, val)).toEqual(val);
    });

    it('can round-trip a list of lists', () => {
      const someList = list('someList', list('nestedList', num('nestedListItem')));
      const val = [
        [1,4,6],
        [494, 182, 344],
        [-23, -67, 42],
      ];
      expect(rt(someList, val)).toEqual(val);
    });
  });
});
