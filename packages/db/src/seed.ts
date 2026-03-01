import { db } from './client.js'
import { tenants, users, profissionaisTecnicos } from './schema/index.js'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create test tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: 'Engenharia Teste Ltda',
      slug: 'engenharia-teste',
      plan: 'professional',
      maxEditaisPerMonth: 50,
      maxCatsStored: 500,
      active: true,
    })
    .returning()

  if (!tenant) throw new Error('Failed to create tenant')
  console.log(`✅ Tenant created: ${tenant.slug} (${tenant.id})`)

  // Create admin user
  const [adminUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: 'admin@engenharia-teste.com.br',
      name: 'Admin Teste',
      role: 'admin',
      authProviderId: 'clerk_test_admin_001',
      active: true,
    })
    .returning()

  if (!adminUser) throw new Error('Failed to create admin user')
  console.log(`✅ Admin user created: ${adminUser.email}`)

  // Create analyst user
  const [analystUser] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email: 'analyst@engenharia-teste.com.br',
      name: 'Analista Teste',
      role: 'analyst',
      authProviderId: 'clerk_test_analyst_001',
      active: true,
    })
    .returning()

  if (!analystUser) throw new Error('Failed to create analyst user')
  console.log(`✅ Analyst user created: ${analystUser.email}`)

  // Create profissionais tecnicos
  const profissionais = await db
    .insert(profissionaisTecnicos)
    .values([
      {
        tenantId: tenant.id,
        nome: 'Eng. João Silva',
        numeroCreaCau: 'CREA-SP-12345',
        conselho: 'CREA',
        ufRegistro: 'SP',
        ativo: true,
      },
      {
        tenantId: tenant.id,
        nome: 'Arq. Maria Santos',
        numeroCreaCau: 'CAU-A12345-8',
        conselho: 'CAU',
        ufRegistro: 'SP',
        ativo: true,
      },
    ])
    .returning()

  console.log(`✅ ${profissionais.length} profissionais técnicos created`)

  console.log('\n🎉 Seed completed successfully!')
  console.log(`\nTenant ID: ${tenant.id}`)
  console.log(`Admin User ID: ${adminUser.id}`)
  process.exit(0)
}

seed().catch((error) => {
  console.error('❌ Seed failed:', error)
  process.exit(1)
})
