/* tslint:disable */
/* eslint-disable */

/**
 * Returns [minimum X, maximum X, minimum Y, maximum Y], or an empty array for no valid points.
 */
export function calculate_range(x: Float64Array, y: Float64Array): Float64Array;

export function dataset_index_bytes(handle: number): number;

export function dispose_all_datasets(): void;

export function dispose_dataset(handle: number): boolean;

/**
 * Returns the half-open [start, end) range in the normalized ascending-X point sequence.
 */
export function find_visible_range(x: Float64Array, y: Float64Array, domain_start: number, domain_end: number): Uint32Array;

export function register_dataset(x: Float64Array, y: Float64Array, index_max_bytes: number): number;

export function register_sample_dataset(y: Float64Array, source_indexes: Uint32Array, start_time: number, sample_rate: number, index_max_bytes: number): number;

export function sample_aggregates(x: Float64Array, y: Float64Array, strategy: number, target: number): Float64Array;

export function sample_dataset_aggregates(handle: number, start: number, end: number, strategy: number, target: number): Float64Array;

export function sample_dataset_indexes(handle: number, start: number, end: number, strategy: number, target: number): Uint32Array;

export function sample_indexes(x: Float64Array, y: Float64Array, strategy: number, target: number): Uint32Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly calculate_range: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly dispose_dataset: (a: number) => number;
    readonly find_visible_range: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly register_dataset: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly register_sample_dataset: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly sample_aggregates: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly sample_dataset_aggregates: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly sample_dataset_indexes: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly sample_indexes: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly dispose_all_datasets: () => void;
    readonly dataset_index_bytes: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
