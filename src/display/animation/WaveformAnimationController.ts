import type { RenderContext } from '../renderer/context.js'
import type { WaveformAnimation } from '../types/animation.js'
import { Animator } from './Animator.js'
import { WaveformPresentation } from './presentation/WaveformPresentation.js'

type Category = 'animation' | 'animationUpdate'
interface Batch {
  plan: WaveformPresentation
  pending: Set<Category>
}

export class WaveformAnimationController implements WaveformAnimation {
  private readonly animator?: Animator
  private readonly media?: MediaQueryList
  private batch?: Batch
  private target?: RenderContext
  private current?: RenderContext
  private version = 0
  private dead = false
  private elapsed = 0

  constructor(
    private readonly realm: Window & typeof globalThis,
    private readonly draw: (context: RenderContext) => void,
    private readonly reportError: (error: unknown) => void,
  ) {
    if (realm.requestAnimationFrame && realm.cancelAnimationFrame) {
      this.animator = new Animator(
        {
          now: () => realm.performance.now(),
          request: (callback) => realm.requestAnimationFrame(callback),
          cancel: (handle) => realm.cancelAnimationFrame(handle),
        },
        (error) => this.fail(error),
      )
    }
    this.media = realm.matchMedia?.('(prefers-reduced-motion: reduce)')
    realm.document.addEventListener('visibilitychange', this.visibility)
    this.media?.addEventListener?.('change', this.motion)
    this.visibility()
  }

  private visibility = () => {
    if (this.realm.document.hidden) this.animator?.pause('hidden')
    else this.animator?.resume('hidden')
  }

  private motion = () => {
    if (this.media?.matches && !this.dead) this.finish()
  }

  private assertAlive() {
    if (this.dead) throw new Error('Waveform has been destroyed')
  }
  pause() {
    this.assertAlive()
    this.animator?.pause('manual')
  }
  resume() {
    this.assertAlive()
    this.animator?.resume('manual')
  }
  isRunning() {
    this.assertAlive()
    return !!this.batch
  }
  invalidateNotifications() {
    ++this.version
  }

  /** Commit ownership before dispatching any old callbacks. */
  commit(target: RenderContext, animate: boolean, replace: boolean) {
    this.assertAlive()
    const version = ++this.version
    const old = this.batch
    this.batch = undefined
    this.animator?.stop()
    const previous = old?.plan.hasCrossfade ? old.plan.target : this.current
    this.target = target
    const plan =
      animate && this.animator && !this.media?.matches
        ? WaveformPresentation.create(previous, target)
        : undefined
    if (plan) {
      this.elapsed = 0
      this.batch = {
        plan,
        pending: new Set<Category>([
          ...(plan.enter ? ['animation' as const] : []),
          ...(plan.update ? ['animationUpdate' as const] : []),
        ]),
      }
      try {
        this.paint(plan.frame(0).context)
        this.animator!.start((elapsed) => this.frame(elapsed))
      } catch (error) {
        this.fail(error)
      }
    } else {
      try {
        this.paint(target)
      } catch (error) {
        if (old) this.notify(old, 'onAbort', version)
        throw error
      }
    }
    if (old) this.notify(old, replace ? 'onAbort' : 'onComplete', version)
  }

  private paint(context: RenderContext) {
    this.draw(context)
    this.current = context
  }

  private frame(elapsed: number) {
    const batch = this.batch
    if (!batch || this.dead) return
    this.elapsed = elapsed
    const version = this.version
    const frame = batch.plan.frame(
      elapsed,
      !batch.pending.has('animation'),
      !batch.pending.has('animationUpdate'),
    )
    this.paint(frame.context)
    const completed = new Set<Category>()
    if (frame.enterDone && batch.pending.delete('animation')) completed.add('animation')
    if (frame.updateDone && batch.pending.delete('animationUpdate'))
      completed.add('animationUpdate')
    if (!batch.pending.size) {
      this.batch = undefined
      this.animator?.stop()
    }
    this.notify({ ...batch, pending: completed }, 'onComplete', version)
  }

  configure(options: RenderContext['options']) {
    const batch = this.batch
    if (!batch) return
    const count = batch.plan.target.legendItems.reduce(
      (sum, item) => sum + item.series.data.length,
      0,
    )
    if (!options.animationEnabled || count >= options.animationThreshold) {
      this.finish()
      return
    }
    const completed = new Set<Category>()
    if (!options.animation.enabled && batch.pending.delete('animation')) completed.add('animation')
    if (!options.animationUpdate.enabled && batch.pending.delete('animationUpdate'))
      completed.add('animationUpdate')
    if (!completed.size) return
    const version = this.version
    try {
      const frame = batch.plan.frame(
        this.elapsed,
        !batch.pending.has('animation'),
        !batch.pending.has('animationUpdate'),
      )
      this.paint(frame.context)
      if (!batch.pending.size) {
        this.batch = undefined
        this.animator?.stop()
      }
      this.notify({ ...batch, pending: completed }, 'onComplete', version)
    } catch (error) {
      completed.forEach((category) => batch.pending.add(category))
      this.fail(error)
    }
  }

  finish(defer = false) {
    this.assertAlive()
    const batch = this.batch
    if (!batch) return
    const version = this.version
    this.batch = undefined
    this.animator?.stop()
    try {
      this.paint(batch.plan.target)
    } catch (error) {
      this.notify(batch, 'onAbort', version)
      this.reportError(error)
      return
    }
    const notify = () => this.notify(batch, 'onComplete', version)
    if (defer) this.realm.queueMicrotask(notify)
    else notify()
  }

  /** Empty state is already drawn by the owner, so only release animation state. */
  clear() {
    const version = ++this.version
    const batch = this.batch
    this.batch = undefined
    this.animator?.stop()
    this.target = undefined
    this.current = undefined
    if (batch) this.notify(batch, 'onAbort', version)
  }

  private fail(error: unknown) {
    const batch = this.batch
    const version = this.version
    this.batch = undefined
    this.animator?.stop()
    try {
      if (this.target) this.paint(this.target)
    } catch (drawError) {
      this.reportError(drawError)
    }
    if (batch) this.notify(batch, 'onAbort', version)
    this.reportError(error)
  }

  private notify(
    batch: Batch,
    kind: 'onComplete' | 'onAbort',
    version: number,
    destroying = false,
  ) {
    for (const category of ['animation', 'animationUpdate'] as const) {
      if (this.version !== version || (this.dead && !destroying)) break
      if (!batch.pending.has(category)) continue
      try {
        batch.plan.target.options[category][kind]?.()
      } catch (error) {
        this.reportError(error)
      }
    }
  }

  destroy() {
    if (this.dead) return
    this.dead = true
    const version = ++this.version
    const batch = this.batch
    this.batch = undefined
    this.animator?.stop()
    this.realm.document.removeEventListener('visibilitychange', this.visibility)
    this.media?.removeEventListener?.('change', this.motion)
    this.target = undefined
    this.current = undefined
    return () => {
      if (batch) this.notify(batch, 'onAbort', version, true)
    }
  }
}
