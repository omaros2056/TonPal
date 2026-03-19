import { test, expect } from '@playwright/test'

test.describe('ENS identity flow', () => {
  test('API: invalid ENS name returns 400', async ({ request }) => {
    const res = await request.get('/api/ens/resolve/notaname')
    expect(res.status()).toBe(400)
  })

  test('API: valid ENS name format is accepted', async ({ request }) => {
    const res = await request.get('/api/ens/resolve/alice.eth')
    expect([200, 404]).toContain(res.status())
  })

  test('API: subname creation validates label', async ({ request }) => {
    const res = await request.post('/api/ens/subnames/create', {
      data: { label: 'x', evmAddress: '0x0000000000000000000000000000000000000001' },
    })
    expect(res.status()).toBe(400)
  })
})
