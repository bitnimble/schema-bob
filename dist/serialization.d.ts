export interface Type<T> {
    serialize(t: T): Uint8Array;
    deserialize(u: Uint8Array): T;
    validate(u: unknown): T;
}
export declare type Reify<Schema> = Schema extends Record<string, Type<any>> ? {
    [K in keyof Schema]: ReturnType<Schema[K]['validate']>;
} : Schema extends Type<infer T> ? T extends (infer I)[] ? I[] : T : Schema extends (t: infer T) => Uint8Array ? T : Schema extends (u: Uint8Array) => infer T ? T : never;
export declare const bool: <T extends boolean>(name: string, literalValue?: T | undefined) => Type<T>;
export declare const str: <T extends string>(name: string, ...literalValues: T[]) => Type<T>;
export declare const num: <T extends number>(name: string, ...literalValues: T[]) => Type<T>;
export declare const u8array: (name: string) => Type<Uint8Array>;
export declare const optional: <S extends Type<any>>(base: S) => Type<Reify<S> | undefined>;
declare type RecordSchema = Record<string, Type<unknown>>;
export declare const rec: <S extends RecordSchema>(name: string, schema: S) => Type<Reify<S>>;
export declare const extend: <S extends RecordSchema, B extends Type<{
    [x: string]: unknown;
}>>(name: string, base: B, schema: S) => Type<Omit<Reify<B>, keyof Reify<S>> & Reify<S>>;
export declare const union: <D extends string, B extends Type<Record<string & D, any>>, S extends B[]>(name: string, discriminator: D, schemas: S) => Type<Reify<S[0]>>;
export declare const list: <S extends Type<unknown>>(name: string, itemSchema: S) => Type<Reify<S>[]>;
export {};
