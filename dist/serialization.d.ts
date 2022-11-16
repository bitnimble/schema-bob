export interface Type<T> {
    /**
     * Serializes an input value and returns a Uint8Array to be sent over-the-wire. For record-like
     * types, this will strip any additional unspecified properties before serializing it.
     * @param t the value to be serialized
     * @returns a Uint8Array buffer representing a serialized form of the input value
     */
    serialize(t: T): Uint8Array;
    /**
     * Attempts to deserialize an input Uint8Array back to the original type, and then validates that
     * it conforms to the constraints originally provided to the builder function. For record-like
     * types, this will strip any additional unspecified properties that happened to be present in the
     * deserialized value before returning it to the caller.
     * @param u a Uint8Array buffer
     */
    deserialize(u: Uint8Array): T;
    /**
     * Validates that the input conforms to the constraints originally provided to the builder
     * function. This does not attempt to transform or deserialize the input value before validating,
     * so it must be of the correct type first.
     * For primitives, this will return the input value.
     * For record-like types, this will return a deep copy that has any additional unspecified
     * properties stripped.
     * @param u
     */
    validate(u: unknown): T;
}
/**
 * From T, pick a set of properties whose values are assignable to U
 */
declare type PickValues<T, U> = Pick<T, {
    [K in keyof T]: T[K] extends U ? K : never;
}[keyof T]>;
declare type OmitValues<T, U> = Pick<T, {
    [K in keyof T]: T[K] extends U ? never : K;
}[keyof T]>;
declare type PickOptionals<Schema extends Record<string, Type<any>>> = PickValues<Schema, {
    optional: true;
}>;
declare type OmitOptionals<Schema extends Record<string, Type<any>>> = OmitValues<Schema, {
    optional: true;
}>;
declare type ReifyType<T extends Type<any>> = ReturnType<T['validate']>;
export declare type Reify<Schema> = Schema extends Record<string, Type<any>> ? {
    [K in keyof PickOptionals<Schema>]?: ReifyType<PickOptionals<Schema>[K]>;
} & {
    [K in keyof OmitOptionals<Schema>]: ReifyType<OmitOptionals<Schema>[K]>;
} : Schema extends Type<infer T> ? T extends (infer I)[] ? I[] : T : Schema extends (t: infer T) => Uint8Array ? T : Schema extends (u: Uint8Array) => infer T ? T : never;
export declare const bool: <T extends boolean>(name: string, literalValue?: T | undefined) => Type<T>;
export declare const str: <T extends string>(name: string, ...literalValues: T[]) => Type<T>;
export declare const num: <T extends number>(name: string, ...literalValues: T[]) => Type<T>;
export declare const u8array: (name: string) => Type<Uint8Array>;
export declare const optional: <S extends Type<any>>(base: S) => Type<Reify<S> | undefined> & {
    optional: true;
};
declare type RecordSchema = Record<string, Type<unknown>>;
export declare const rec: <S extends RecordSchema>(name: string, schema: S) => Type<Reify<S>>;
export declare const extend: <S extends RecordSchema, B extends Type<{} & {
    [x: string]: unknown;
}>>(name: string, base: B, schema: S) => Type<Omit<Reify<B>, keyof Reify<S>> & Reify<S>>;
export declare const union: <D extends string, B extends Type<Record<string & D, any>>, S extends B[]>(name: string, discriminator: D, schemas: S) => Type<Reify<S[0]>>;
export declare const list: <S extends Type<unknown>>(name: string, itemSchema: S) => Type<Reify<S>[]>;
export {};
