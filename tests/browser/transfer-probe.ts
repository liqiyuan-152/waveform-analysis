const port = self as unknown as {
  onmessage: ((event: MessageEvent<Float64Array>) => void) | null
  postMessage(value: number): void
}
port.onmessage = (event) => {
  const values = event.data
  port.postMessage(values[0]! + values[values.length - 1]!)
}
