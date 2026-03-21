// Run with: npx ts-node scripts/seed-demo.ts
// Seeds realistic demo data for the hackathon pitch

import { createClient } from '@supabase/supabase-js'

const DEMO_SPLITS = [
  {
    id: 'demo-split-1',
    owner_id: 'demo-owner-1',
    source: 'miniapp',
    status: 'active',
    total_amount: 124.50,
    currency: 'EUR',
    merchant: 'Chez Marcel',
    participants: [
      { display_name: 'Omar', ton_address: 'EQDemo1...', ens_name: 'omar.eth', status: 'paid' },
      { display_name: 'Alice', ton_address: 'EQDemo2...', satsplit_subname: 'alice.satsplit.eth', status: 'pending' },
      { display_name: 'Bob', xrp_address: 'rBob...', status: 'pending' },
      { display_name: 'Sarah', handle: '@sarah_t', status: 'overdue' },
    ],
  },
  {
    id: 'demo-split-2',
    owner_id: 'demo-owner-1',
    source: 'bot',
    status: 'completed',
    total_amount: 45.00,
    currency: 'EUR',
    merchant: 'Migros',
    participants: [
      { display_name: 'Omar', ton_address: 'EQDemo1...', status: 'paid' },
      { display_name: 'Alice', ens_name: 'alice.eth', status: 'paid' },
    ],
  },
]

async function seed() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log('Seeding demo data...')

  for (const split of DEMO_SPLITS) {
    const { participants, ...splitData } = split
    console.log(`Creating split: ${splitData.merchant}`)

    const { data: splitRow, error: splitErr } = await supabase
      .from('split_sessions')
      .upsert({ ...splitData, created_at: new Date().toISOString() })
      .select()
      .single()

    if (splitErr) { console.error('Split error:', splitErr); continue }

    for (const p of participants) {
      const { status: pStatus, ...pData } = p
      const { data: participant } = await supabase
        .from('participants')
        .upsert({ ...pData, split_session_id: splitRow.id })
        .select()
        .single()

      if (participant && pStatus === 'paid') {
        const { data: pr } = await supabase
          .from('payment_requests')
          .upsert({
            split_session_id: splitRow.id,
            participant_id: participant.id,
            amount: splitData.total_amount / participants.length,
            status: 'paid',
            payment_link: 'ton://demo',
            rail: (pData as any).xrp_address ? 'xrpl' : 'ton',
          })
          .select()
          .single()

        if (pr) {
          await supabase.from('payment_receipts').upsert({
            payment_request_id: pr.id,
            tx_hash: `demo_tx_${Math.random().toString(36).slice(2)}`,
            rail: pr.rail,
            paid_at: new Date().toISOString(),
          })
        }
      }
    }
  }

  console.log('Demo data seeded successfully!')
}

seed().catch(console.error)
