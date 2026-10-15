import { initializeWasmBackend } from './workerRuntime'

// Native charts create this transport only for sampled geometry. Load the numeric backend
// while the main thread normalizes input; errors retain the runtime's request-time reporting.
void initializeWasmBackend()
