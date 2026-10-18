import type { WaveformOptions, WaveformSeries } from 'waveform-analysis/display'
import waveformData from '../waveform-data'

const colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea']
const rightAxisStart = Math.ceil(waveformData.length / 2)
const framePadding = { top: 32, right: 0, bottom: 62, left: 0 }

export const originalSeries: WaveformSeries[] = waveformData.map((waveform, index) => ({
  id: String(waveform.chnl_id),
  name: waveform.chnl,
  shot: waveform.shot,
  unit: waveform.dat_unit,
  order: index + 1,
  yAxis: index < rightAxisStart ? 'left' : 'right',
  data: waveform.data.map((y, pointIndex) => ({ x: waveform.time[pointIndex], y })),
  style: { color: colors[index % colors.length], lineWidth: 1.5 },
}))
export const initialOptions: WaveformOptions = {
  width: '100%',
  height: '100%',
  responsive: { enabled: false, aspectRatio: 2.6 },
  layout: { autoPadding: true },
  padding: framePadding,
  frameNumber: 1,
  shot: {
    visible: true,
    text: '#10001',
    color: '#78E8FF',
    fontSize: 14,
  },
  legend: {
    visible: true,
    position: 'top-left',
    orientation: 'horizontal',
    color: '#78E8FF',
    fontSize: 14,
  },
  frame: {
    visible: true,
    backgroundColor: '#000000',
    borderColor: '#78E8FF',
    borderWidth: 2,
  },
  point: { visible: false },
  animationEnabled: true,
  xDomainStrategy: { type: 'nice', bounds: 'both', tickCount: 10 },
  xAxis: {
    tickStrategy: 'nice',
    color: '#e2e8f0',
    fontColor: '#78E8FF',
    fontSize: 14,
    showEndValues: true,
    tickFormat: '.0f',
    title: { visible: true, text: 'Time', unit: 'ms', color: '#78E8FF', fontSize: 14 },
  },
  yAxes: [
    {
      id: 'left',
      position: 'left',
      color: colors[0],
      fontColor: colors[0],
      fontSize: 14,
      tickStrategy: 'nice',
      tickSize: 3,
      tickPadding: 5,
      unit: waveformData[0].dat_unit,
      title: {
        visible: true,
        text: waveformData[0].chnl,
        unit: waveformData[0].dat_unit,
        color: colors[0],
        fontSize: 14,
      },
    },
    {
      id: 'right',
      position: 'right',
      color: colors[rightAxisStart],
      fontColor: colors[rightAxisStart],
      fontSize: 14,
      tickStrategy: 'nice',
      tickSize: 3,
      tickPadding: 5,
      unit: waveformData[rightAxisStart].dat_unit,
      title: {
        visible: true,
        text: waveformData[rightAxisStart].chnl,
        unit: waveformData[rightAxisStart].dat_unit,
        color: colors[rightAxisStart],
        fontSize: 14,
      },
    },
  ],
  grid: { style: 'dashed', color: '#475569', y: { axisId: 'left' } },
  zeroLine: { axisId: 'left' },
}
