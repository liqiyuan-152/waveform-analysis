import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'waveform-analysis/native/style.css'
import '../shared/style.css'
import { exampleData } from '../shared/data'
import { diagnostics } from '../shared/diagnostics'
import { WaveformDemo } from './WaveformDemo'

function App() {
  const [version, setVersion] = useState(0)
  const [callbackVersion, setCallbackVersion] = useState(0)
  const [mounted, setMounted] = useState(true)
  const [narrow, setNarrow] = useState(false)
  const [second, setSecond] = useState(false)
  const data = useMemo(() => exampleData(version), [version])
  return (
    <>
      <h1>React DOM ref 示例</h1>
      <div className="example-controls">
        <button onClick={() => setVersion((value) => value + 1)}>替换数据</button>
        <button onClick={() => setCallbackVersion((value) => value + 1)}>更新回调</button>
        <button onClick={() => setNarrow((value) => !value)}>切换宽度</button>
        <button onClick={() => setMounted((value) => !value)}>挂载 / 卸载</button>
        <button onClick={() => setSecond((value) => !value)}>第二个图表</button>
      </div>
      {mounted && (
        <WaveformDemo
          data={data}
          narrow={narrow}
          onRendered={() => diagnostics.rendered(callbackVersion)}
        />
      )}
      {second && (
        <WaveformDemo
          data={data}
          narrow={narrow}
          onRendered={() => diagnostics.rendered(callbackVersion)}
        />
      )}
    </>
  )
}

createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
