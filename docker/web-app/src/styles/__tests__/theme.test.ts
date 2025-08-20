import test from 'node:test'
import assert from 'node:assert'
import { deviceOptionStyle, sliderBackgroundStyle, statusClasses } from '../theme'

test('deviceOptionStyle uses CSS variable tokens', () => {
  const unavailable = deviceOptionStyle(false)
  assert.match((unavailable.color ?? '') as string, /var\(--color-/)
  assert.match((unavailable.background ?? '') as string, /var\(--color-/)
})

test('sliderBackgroundStyle references slider tokens', () => {
  const style = sliderBackgroundStyle(50)
  const bg = style.background as string
  assert.ok(bg.includes('var(--color-slider-fill)'))
  assert.ok(bg.includes('var(--color-slider-track)'))
})

test('statusClasses use semantic tokens', () => {
  Object.values(statusClasses).forEach(cls => {
    assert.match(cls, /var\(--color-[a-z-]+\)/)
    assert.ok(!/#/.test(cls))
  })
})
