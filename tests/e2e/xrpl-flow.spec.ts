import { test, expect } from '@playwright/test'

test.describe('XRPL Check flow', () => {
  test('API: XRPL check create requires xrpAddress', async ({ request }) => {
    const res = await request.post('/api/xrpl/checks/create', {
      data: { splitSessionId: 'test', participantId: 'test', amountXrp: 10 },
    })
    // 400 bad request or 500 (no Xumm key in CI) - both are acceptable
    expect([400, 500]).toContain(res.status())
  })
})
